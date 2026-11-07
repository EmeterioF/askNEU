#pragma once

#include <stddef.h>
#include <stdint.h>

#include "esp_err.h"

// Longest answer sentence the kiosk will render on one screen.
#define ASK_TEXT_MAX 192
// Longest audio URL the backend can hand back.
#define ASK_URL_MAX 192

typedef struct {
    char text[ASK_TEXT_MAX];
    char audio_url[ASK_URL_MAX];
} ask_answer_t;

// Sends one recorded question to POST /api/ask.
//
// `pcm` is 16-bit mono PCM at AUDIO_SAMPLE_RATE; the WAV container is built here
// so callers never handle raw RIFF bytes. Blocks until the backend answers, so
// call it from a worker task, never from the LVGL task.
esp_err_t ask_send(const uint8_t *pcm, size_t pcm_bytes, uint32_t duration_ms, ask_answer_t *out);
