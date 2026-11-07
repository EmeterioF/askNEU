#pragma once

#include "esp_err.h"

// Wires the audio worker to the backend round-trip. Requires audio_init() and
// ui_start() to have succeeded first.
esp_err_t conversation_start(void);
