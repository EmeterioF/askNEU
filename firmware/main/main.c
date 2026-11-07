#include <stdbool.h>

#include "esp_err.h"
#include "esp_log.h"
#include "nvs_flash.h"

#include "audio.h"
#include "conversation.h"
#include "ui.h"
#include "wifi.h"

static const char *TAG = "askneu";

// Keep the screen pressed this long at boot to forget the saved network.
#define WIFI_RESET_HOLD_MS 5000

static void init_nvs(void)
{
    esp_err_t err = nvs_flash_init();

    // NVS layout changed or ran out of pages across a firmware swap: wipe it once.
    if (err == ESP_ERR_NVS_NO_FREE_PAGES || err == ESP_ERR_NVS_NEW_VERSION_FOUND) {
        ESP_LOGW(TAG, "erasing NVS (%s)", esp_err_to_name(err));
        ESP_ERROR_CHECK(nvs_flash_erase());
        err = nvs_flash_init();
    }

    ESP_ERROR_CHECK(err);
}

void app_main(void)
{
    ESP_LOGI(TAG, "AskNEU firmware booting");

    init_nvs();

    if (audio_init() != ESP_OK) {
        ESP_LOGE(TAG, "audio failed to start, continuing silent");
    }

    bool ui_ok = ui_start() == ESP_OK;

    if (!ui_ok) {
        ESP_LOGE(TAG, "ui failed to start, continuing headless");
    }

    if (ui_ok && ui_hold_detected(WIFI_RESET_HOLD_MS)) {
        ESP_LOGW(TAG, "screen held at boot: forgetting the saved network");
        wifi_factory_reset();
    }

    conversation_start();

    esp_err_t err = wifi_start();
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "wifi failed: %s", esp_err_to_name(err));
        return;
    }

    ESP_LOGI(TAG, "ready at %s", wifi_ip());
}
