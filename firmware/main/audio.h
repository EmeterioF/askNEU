#pragma once

#include <stddef.h>
#include <stdint.h>

#include "esp_err.h"

// 16 kHz mono 16-bit PCM, the format the backend expects.
#define AUDIO_SAMPLE_RATE 16000
#define AUDIO_MAX_SECONDS 8
#define AUDIO_MAX_BYTES (AUDIO_SAMPLE_RATE * 2 * AUDIO_MAX_SECONDS)

// Runs one turn once the user releases the talk button. Called from the audio
// worker task with a pointer to the recorded PCM (valid only for the duration of
// the call), so the handler may block on the network.
typedef void (*audio_clip_handler_t)(const uint8_t *pcm, size_t bytes);

esp_err_t audio_init(void);

void audio_set_clip_handler(audio_clip_handler_t handler);

// Starts capturing into the internal clip buffer. Returns immediately; a worker
// task records until audio_clip_end() or AUDIO_MAX_SECONDS.
esp_err_t audio_clip_begin(void);

// Stops capture. The worker then hands the clip to the registered handler.
void audio_clip_end(void);

// Streaming playback at an arbitrary rate, used for decoded MP3 clips whose
// sample rate is decided at runtime.
esp_err_t audio_stream_begin(uint32_t sample_rate);
esp_err_t audio_stream_write(const int16_t *pcm, size_t frames);
void audio_stream_end(void);
