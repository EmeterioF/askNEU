#pragma once

#include "esp_err.h"

// Downloads an MP3 clip and plays it through the speaker. Blocks for the length
// of the clip, so call it from a worker task, never from the LVGL task.
esp_err_t player_play_url(const char *url);
