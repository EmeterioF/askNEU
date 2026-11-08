#pragma once

#include "esp_err.h"

// Registers the hardware buttons. Holding the CONFIG (Boot) button for five
// seconds forgets the saved Wi-Fi and restarts into setup mode, the same
// gesture the stock Espressif firmware uses.
//
// Must be called after ui_start(), because one of the BSP buttons lives on the
// touch panel that the display brings up.
esp_err_t button_start(void);
