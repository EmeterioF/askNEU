#pragma once

#include <stdbool.h>

#include "esp_err.h"

// Setup mode: raises the "AskNEU-Setup" access point and waits for a phone to
// hand over Wi-Fi credentials through the ESP SoftAP Provisioning app.
//
// Blocks until the phone is done, however long that takes — a kiosk in setup
// mode is supposed to wait. Credentials are saved before this returns.
esp_err_t wifi_setup_run(void);

// True while the setup access point is running. The normal station retry loop
// stays out of the way because the provisioning manager drives the station.
bool wifi_setup_active(void);
