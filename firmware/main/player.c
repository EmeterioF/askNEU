// Downloads an answer clip into PSRAM and plays it. The container is sniffed
// instead of trusted from the URL: RIFF/WAVE goes straight to the codec, and
// everything else is decoded with Helix MP3 (the format the backend produces).

#include "player.h"

#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>
#include <string.h>

#include "audio.h"
#include "esp_crt_bundle.h"
#include "esp_heap_caps.h"
#include "esp_http_client.h"
#include "esp_log.h"
#include "mp3dec.h"
#include "wav.h"

static const char *TAG = "askneu_player";

// Cached answers are tens of KB; 1 MB is a generous ceiling that still fits
// comfortably in PSRAM next to the 256 KB capture buffer.
#define MAX_CLIP_BYTES (1024 * 1024)

// Helix emits at most 1152 samples per channel per MP3 frame.
#define MAX_FRAME_SAMPLES 1152
// Frames handed to the codec per write, so a long clip never lands in one call.
#define BLOCK_FRAMES 1024

static esp_err_t download(const char *url, uint8_t *buffer, size_t capacity, size_t *out_len)
{
    esp_http_client_config_t config = {
        .url = url,
        .method = HTTP_METHOD_GET,
        .timeout_ms = 20000,
        .crt_bundle_attach = esp_crt_bundle_attach,
    };

    esp_http_client_handle_t client = esp_http_client_init(&config);

    if (client == NULL) {
        ESP_LOGE(TAG, "http client init failed");
        return ESP_FAIL;
    }

    esp_err_t err = ESP_FAIL;

    if (esp_http_client_open(client, 0) != ESP_OK) {
        ESP_LOGE(TAG, "connect failed: %s", url);
        goto cleanup;
    }

    if (esp_http_client_fetch_headers(client) < 0) {
        ESP_LOGE(TAG, "no response headers");
        goto cleanup;
    }

    int status = esp_http_client_get_status_code(client);

    if (status != 200) {
        ESP_LOGE(TAG, "audio fetch status=%d", status);
        goto cleanup;
    }

    size_t total = 0;

    while (total < capacity) {
        int read = esp_http_client_read(client, (char *)buffer + total, capacity - total);

        if (read < 0) {
            ESP_LOGE(TAG, "read failed");
            goto cleanup;
        }
        if (read == 0) {
            break;
        }

        total += (size_t)read;
    }

    // A clip that exactly fills the buffer is fine only if the stream ended.
    // Probing one more byte tells a truncated answer from a complete one.
    if (total == capacity) {
        char probe;
        int extra = esp_http_client_read(client, &probe, 1);

        if (extra < 0) {
            ESP_LOGE(TAG, "read failed");
            goto cleanup;
        }
        if (extra > 0) {
            ESP_LOGE(TAG, "clip exceeds %u bytes, refusing to play half of it",
                     (unsigned)capacity);
            err = ESP_ERR_NO_MEM;
            goto cleanup;
        }
    }

    *out_len = total;
    err = ESP_OK;

cleanup:
    esp_http_client_close(client);
    esp_http_client_cleanup(client);

    return err;
}

// Averaging keeps a stereo clip audible through the single speaker instead of
// silently dropping one channel.
static size_t to_mono(const int16_t *interleaved, int channels, size_t samples_total, int16_t *mono)
{
    if (channels <= 1) {
        memcpy(mono, interleaved, samples_total * sizeof(int16_t));
        return samples_total;
    }

    size_t frames = samples_total / (size_t)channels;

    for (size_t i = 0; i < frames; i++) {
        int32_t sum = 0;

        for (int c = 0; c < channels; c++) {
            sum += interleaved[i * (size_t)channels + (size_t)c];
        }

        mono[i] = (int16_t)(sum / channels);
    }

    return frames;
}

static esp_err_t play_wav(const uint8_t *data, size_t len)
{
    wav_info_t info;

    if (!wav_parse(data, len, &info)) {
        ESP_LOGE(TAG, "clip is not a usable WAV");
        return ESP_ERR_INVALID_ARG;
    }

    if (info.bits_per_sample != 16) {
        ESP_LOGE(TAG, "unsupported WAV depth: %u bits", info.bits_per_sample);
        return ESP_ERR_NOT_SUPPORTED;
    }

    ESP_LOGI(TAG, "wav %lu Hz, %u ch, %.1f s",
             (unsigned long)info.sample_rate, info.channels,
             (double)info.pcm_bytes / (info.sample_rate * info.channels * 2));

    int16_t *scratch = heap_caps_malloc(BLOCK_FRAMES * sizeof(int16_t), MALLOC_CAP_SPIRAM);

    if (scratch == NULL) {
        return ESP_ERR_NO_MEM;
    }

    esp_err_t err = ESP_FAIL;

    if (audio_stream_begin(info.sample_rate) != ESP_OK) {
        goto done;
    }

    const int16_t *samples = (const int16_t *)(data + info.pcm_offset);
    size_t sample_count = info.pcm_bytes / sizeof(int16_t);
    size_t cursor = 0;

    err = ESP_OK;

    while (cursor < sample_count) {
        size_t take = BLOCK_FRAMES * (size_t)info.channels;

        if (take > sample_count - cursor) {
            take = sample_count - cursor;
        }

        size_t frames = to_mono(samples + cursor, info.channels, take, scratch);

        if (audio_stream_write(scratch, frames) != ESP_OK) {
            err = ESP_FAIL;
            break;
        }

        cursor += take;
    }

    audio_stream_end();

done:
    heap_caps_free(scratch);

    return err;
}

static esp_err_t play_mp3(const uint8_t *data, size_t len)
{
    HMP3Decoder decoder = MP3InitDecoder();

    if (decoder == NULL) {
        ESP_LOGE(TAG, "decoder init failed");
        return ESP_FAIL;
    }

    int16_t *frame = heap_caps_malloc(MAX_FRAME_SAMPLES * 2 * sizeof(int16_t),
                                      MALLOC_CAP_SPIRAM);
    int16_t *mono = heap_caps_malloc(MAX_FRAME_SAMPLES * sizeof(int16_t),
                                     MALLOC_CAP_SPIRAM);

    if (frame == NULL || mono == NULL) {
        heap_caps_free(frame);
        heap_caps_free(mono);
        MP3FreeDecoder(decoder);
        return ESP_ERR_NO_MEM;
    }

    uint8_t *cursor = (uint8_t *)data;
    int remaining = (int)len;
    bool stream_open = false;
    int sample_rate = 0;
    size_t frames_played = 0;
    int32_t peak = 0;

    while (remaining > 0) {
        int offset = MP3FindSyncWord(cursor, remaining);

        if (offset < 0) {
            break;
        }

        cursor += offset;
        remaining -= offset;

        int remaining_before = remaining;
        int decode_err = MP3Decode(decoder, &cursor, &remaining, frame, 0);

        if (decode_err == ERR_MP3_INDATA_UNDERFLOW) {
            break;
        }
        if (decode_err != 0) {
            ESP_LOGW(TAG, "decode error %d, skipping", decode_err);

            // Guard against a decoder that rejects a frame without consuming it.
            if (remaining == remaining_before) {
                cursor++;
                remaining--;
            }

            continue;
        }

        MP3FrameInfo info;
        MP3GetLastFrameInfo(decoder, &info);

        if (!stream_open || info.samprate != sample_rate) {
            if (stream_open) {
                audio_stream_end();
            }

            sample_rate = info.samprate;

            if (audio_stream_begin((uint32_t)sample_rate) != ESP_OK) {
                ESP_LOGE(TAG, "speaker open failed at %d Hz", sample_rate);
                break;
            }

            stream_open = true;
        }

        size_t frames = to_mono(frame, info.nChans, (size_t)info.outputSamps, mono);

        // Logged so a quiet answer can be told apart from a quiet source.
        for (size_t i = 0; i < frames; i++) {
            int32_t mag = mono[i] < 0 ? -(int32_t)mono[i] : mono[i];

            if (mag > peak) {
                peak = mag;
            }
        }

        if (audio_stream_write(mono, frames) != ESP_OK) {
            break;
        }

        frames_played += frames;
    }

    if (stream_open) {
        audio_stream_end();
    }

    MP3FreeDecoder(decoder);
    heap_caps_free(frame);
    heap_caps_free(mono);

    ESP_LOGI(TAG, "mp3 played %.1f s at %d Hz (peak %ld)",
             (double)frames_played / (sample_rate ? sample_rate : 1), sample_rate,
             (long)peak);

    return frames_played > 0 ? ESP_OK : ESP_FAIL;
}

esp_err_t player_play_url(const char *url)
{
    if (url == NULL || url[0] == '\0') {
        return ESP_ERR_INVALID_ARG;
    }

    uint8_t *clip = heap_caps_malloc(MAX_CLIP_BYTES, MALLOC_CAP_SPIRAM);

    if (clip == NULL) {
        ESP_LOGE(TAG, "out of memory for playback");
        return ESP_ERR_NO_MEM;
    }

    esp_err_t err = ESP_FAIL;
    size_t clip_len = 0;

    if (download(url, clip, MAX_CLIP_BYTES, &clip_len) != ESP_OK) {
        goto done;
    }

    ESP_LOGI(TAG, "clip downloaded: %u bytes", (unsigned)clip_len);

    // The backend contract says MP3, but cached clips can also be delivered as
    // WAV, so the container is sniffed instead of trusted from the URL.
    if (clip_len > 12 && memcmp(clip, "RIFF", 4) == 0 && memcmp(clip + 8, "WAVE", 4) == 0) {
        err = play_wav(clip, clip_len);
    } else {
        err = play_mp3(clip, clip_len);
    }

done:
    heap_caps_free(clip);

    return err;
}
