#include "audio.h"

#include <math.h>
#include <stdbool.h>
#include <stdint.h>

#include "bsp/esp-bsp.h"
#include "esp_codec_dev.h"
#include "esp_heap_caps.h"
#include "esp_log.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

static const char *TAG = "askneu_audio";

#define READ_CHUNK 1024
#define SPEAKER_VOLUME 90
// ES7210 tops out at 37.5 dB; the BSP audio example asks for 42 dB for the
// same reason: the mics sit far from the talker and are very quiet at 0 dB.
#define MIC_GAIN_DB 42.0f
// The worker runs HTTP, cJSON and the MP3 decoder, so it needs more headroom
// than a bare capture loop. Helix's own examples reserve 16 KB for decoding.
#define TASK_STACK 16384
#define TASK_PRIORITY 5

static esp_codec_dev_handle_t s_speaker;
static esp_codec_dev_handle_t s_microphone;

static uint8_t *s_clip;
static size_t s_clip_len;
static volatile bool s_recording;
static TaskHandle_t s_worker;
static audio_clip_handler_t s_clip_handler;

static esp_codec_dev_sample_info_t clip_format(void)
{
    esp_codec_dev_sample_info_t format = {
        .sample_rate = AUDIO_SAMPLE_RATE,
        .channel = 1,
        .bits_per_sample = 16,
    };

    return format;
}

static void log_clip_level(void)
{
    const int16_t *samples = (const int16_t *)s_clip;
    size_t count = s_clip_len / sizeof(int16_t);
    int32_t peak = 0;
    uint64_t sum_sq = 0;

    for (size_t i = 0; i < count; i++) {
        int32_t mag = samples[i] < 0 ? -(int32_t)samples[i] : samples[i];

        if (mag > peak) {
            peak = mag;
        }
        sum_sq += (uint64_t)(mag * mag);
    }

    ESP_LOGI(TAG, "captured %.1f s peak=%ld rms=%lu",
             (double)s_clip_len / (AUDIO_SAMPLE_RATE * 2),
             (long)peak,
             (unsigned long)(count ? sqrt((double)sum_sq / count) : 0));
}

static void capture(void)
{
    esp_codec_dev_sample_info_t format = clip_format();

    // Cleared before the open so a failed open cannot leave the previous
    // recording in the buffer and resend an old question.
    s_clip_len = 0;

    if (esp_codec_dev_open(s_microphone, &format) != ESP_OK) {
        ESP_LOGE(TAG, "microphone open failed");
        return;
    }

    while (s_recording && (s_clip_len + READ_CHUNK) <= AUDIO_MAX_BYTES) {
        if (esp_codec_dev_read(s_microphone, s_clip + s_clip_len, READ_CHUNK) != ESP_OK) {
            ESP_LOGE(TAG, "microphone read failed");
            break;
        }

        s_clip_len += READ_CHUNK;
    }

    esp_codec_dev_close(s_microphone);

    log_clip_level();
}

esp_err_t audio_stream_begin(uint32_t sample_rate)
{
    esp_codec_dev_sample_info_t format = {
        .sample_rate = sample_rate,
        .channel = 1,
        .bits_per_sample = 16,
    };

    if (esp_codec_dev_open(s_speaker, &format) != ESP_OK) {
        ESP_LOGE(TAG, "speaker open failed at %lu Hz", (unsigned long)sample_rate);
        return ESP_FAIL;
    }

    esp_codec_dev_set_out_vol(s_speaker, SPEAKER_VOLUME);

    return ESP_OK;
}

esp_err_t audio_stream_write(const int16_t *pcm, size_t frames)
{
    int ret = esp_codec_dev_write(s_speaker, (void *)pcm, frames * sizeof(int16_t));

    if (ret != ESP_CODEC_DEV_OK) {
        ESP_LOGE(TAG, "speaker write failed: %d", ret);
        return ESP_FAIL;
    }

    return ESP_OK;
}

void audio_stream_end(void)
{
    esp_codec_dev_close(s_speaker);
}

static void audio_worker(void *arg)
{
    capture();

    // Called even for an empty clip: a tap that recorded nothing still needs an
    // answer on screen, and only the handler knows what to say.
    if (s_clip_handler != NULL) {
        s_clip_handler(s_clip, s_clip_len);
    }

    s_worker = NULL;
    vTaskDelete(NULL);
}

esp_err_t audio_init(void)
{
    // Do not call bsp_audio_init() first: the codec helpers only bring up the
    // I2C bus (needed to talk to ES8311/ES7210) when I2S is not up yet. Calling
    // it here made them skip bsp_i2c_init() and assert on a NULL i2c_ctrl_if.
    s_speaker = bsp_audio_codec_speaker_init();
    s_microphone = bsp_audio_codec_microphone_init();

    if (s_speaker == NULL || s_microphone == NULL) {
        ESP_LOGE(TAG, "codec init failed (speaker=%p, mic=%p)", s_speaker, s_microphone);
        return ESP_FAIL;
    }

    // PSRAM keeps 256 KB of clip data out of the small internal heap.
    s_clip = heap_caps_malloc(AUDIO_MAX_BYTES, MALLOC_CAP_SPIRAM);

    if (s_clip == NULL) {
        ESP_LOGE(TAG, "clip buffer allocation failed");
        return ESP_ERR_NO_MEM;
    }

    esp_codec_dev_set_in_gain(s_microphone, MIC_GAIN_DB);

    ESP_LOGI(TAG, "ready (%d Hz mono, %d s max, mic gain %.1f dB)",
             AUDIO_SAMPLE_RATE, AUDIO_MAX_SECONDS, MIC_GAIN_DB);

    return ESP_OK;
}

void audio_set_clip_handler(audio_clip_handler_t handler)
{
    s_clip_handler = handler;
}

esp_err_t audio_clip_begin(void)
{
    if (s_worker != NULL) {
        return ESP_ERR_INVALID_STATE;
    }

    s_recording = true;

    if (xTaskCreate(audio_worker, "audio_clip", TASK_STACK, NULL, TASK_PRIORITY, &s_worker) != pdPASS) {
        s_recording = false;
        s_worker = NULL;
        return ESP_ERR_NO_MEM;
    }

    return ESP_OK;
}

void audio_clip_end(void)
{
    s_recording = false;
}
