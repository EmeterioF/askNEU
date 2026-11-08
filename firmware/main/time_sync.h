#pragma once

#include "esp_err.h"

// Sets the clock from NTP. TLS certificate checks compare against the current
// date and the board starts at 1970, so this must run before the first HTTPS
// request. Returns ESP_OK once the clock is trustworthy.
esp_err_t time_sync_start(void);
