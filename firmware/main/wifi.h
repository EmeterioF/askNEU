#pragma once

#include "esp_err.h"

// Connects the kiosk, in this order:
//   1. the network saved in NVS;
//   2. the development credentials from menuconfig, on a fresh board;
//   3. setup mode (see wifi_setup.h) when neither connects.
//
// Blocks until an IP is assigned. In setup mode it keeps waiting for a phone.
esp_err_t wifi_start(void);

// Forgets the saved network and the copy the Wi-Fi driver keeps, so the next
// boot starts in setup mode. The caller is expected to restart afterwards.
void wifi_factory_reset(void);

// Copy of the last DHCP address, or an empty string before the first connect.
const char *wifi_ip(void);
