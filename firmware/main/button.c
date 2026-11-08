// Hardware buttons. Only one action matters on the kiosk: holding the CONFIG
// (Boot) button long enough to forget the network and reboot into setup mode.

#include "button.h"

#include "bsp/esp-bsp.h"
#include "esp_log.h"
#include "esp_system.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "ui.h"
#include "wifi.h"

static const char *TAG = "askneu_button";

#define RESET_HOLD_MS 5000
#define RESTART_DELAY_MS 800

static void on_reset_long_press(void *handle, void *usr_data)
{
    ESP_LOGW(TAG, "config button held: forgetting Wi-Fi and restarting");

    ui_show_card("Wi-Fi forgotten\n\nrestarting...");
    wifi_factory_reset();

    // Give the card a moment to appear before the screen goes dark.
    vTaskDelay(pdMS_TO_TICKS(RESTART_DELAY_MS));
    esp_restart();
}

esp_err_t button_start(void)
{
    button_handle_t buttons[BSP_BUTTON_NUM] = {0};

    esp_err_t err = bsp_iot_button_create(buttons, NULL, BSP_BUTTON_NUM);

    if (buttons[BSP_BUTTON_CONFIG] == NULL) {
        ESP_LOGE(TAG, "config button not available: %s", esp_err_to_name(err));
        return ESP_FAIL;
    }

    if (err != ESP_OK) {
        // Another button failed; the reset gesture still works, so carry on.
        ESP_LOGW(TAG, "some buttons failed to start: %s", esp_err_to_name(err));
    }

    button_event_args_t args = {
        .long_press.press_time = RESET_HOLD_MS,
    };

    err = iot_button_register_cb(buttons[BSP_BUTTON_CONFIG], BUTTON_LONG_PRESS_START, &args,
                                 on_reset_long_press, NULL);

    if (err != ESP_OK) {
        ESP_LOGE(TAG, "cannot register config button: %s", esp_err_to_name(err));
        return err;
    }

    ESP_LOGI(TAG, "hold the config button %d s to change Wi-Fi", RESET_HOLD_MS / 1000);

    return ESP_OK;
}
