#pragma once

#include "esp_err.h"

// Joins the saved network, or on a fresh board the development credentials from
// menuconfig. When that fails, the board brings up the "AskNEU-Setup" access
// point instead, so Wi-Fi can be changed from a phone. Blocks until an IP is
// assigned; setup mode keeps waiting for the phone.
esp_err_t wifi_start(void);

// Throws away the saved network and points at setup mode on the next
// wifi_start(). Called when the screen is held during boot.
void wifi_factory_reset(void);

// Copy of the last DHCP address, or an empty string before the first connect.
const char *wifi_ip(void);
