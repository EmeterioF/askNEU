// Boot order: storage, audio, screen, buttons, conversation hook, network,
// clock. The kiosk is usable once Wi-Fi has an IP; time sync only matters for
// HTTPS and is deliberately non-fatal.

#include "esp_err.h"
#include "esp_log.h"
#include "nvs_flash.h"

#include "audio.h"
#include "button.h"
#include "conversation.h"
#include "time_sync.h"
#include "ui.h"
#include "wifi.h"

static const char *TAG = "askneu";

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

    if (ui_start() != ESP_OK) {
        ESP_LOGE(TAG, "ui failed to start, continuing headless");
    }

    // Not fatal: the reset gesture is a convenience, the kiosk works without it.
    button_start();

    conversation_start();

    esp_err_t err = wifi_start();
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "wifi failed: %s", esp_err_to_name(err));
        return;
    }

    // TLS certificate checks need the real date; without this HTTPS fails even
    // though the network is fine.
    if (time_sync_start() != ESP_OK) {
        ESP_LOGW(TAG, "clock not synced, https requests may fail");
    }

    ESP_LOGI(TAG, "ready at %s", wifi_ip());
}
