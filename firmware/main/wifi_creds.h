#pragma once

#include <stdbool.h>

#include "esp_wifi.h"

// The saved network lives in the project's own NVS namespace ("askneu"), not in
// the provisioning manager's, so a board can also be seeded from menuconfig.
//
// A "no_seed" marker is written on a factory reset. It keeps the build-time
// credentials from coming back and is cleared as soon as a real network is saved.

// Fills config->sta from NVS. False when nothing has been saved yet.
bool wifi_creds_load(wifi_config_t *config);

// Stores a network that has been proven to work.
void wifi_creds_save(const wifi_sta_config_t *sta);

// Forgets the network and blocks seed credentials until one is saved again.
void wifi_creds_erase(void);

// False after a factory reset, so the build-time credentials are not restored.
bool wifi_creds_seed_allowed(void);
