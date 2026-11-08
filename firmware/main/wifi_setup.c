// Setup mode. Uses the ESP-IDF provisioning manager with the SoftAP scheme:
// the phone joins "AskNEU-Setup", proves it can read the code from the screen
// (security 1 + proof of possession) and sends the home network credentials.

#include "wifi_setup.h"

#include "esp_event.h"
#include "esp_log.h"
#include "esp_netif.h"
#include "ui.h"
#include "wifi_creds.h"
#include "wifi_provisioning/manager.h"
#include "wifi_provisioning/scheme_softap.h"

static const char *TAG = "askneu_setup";

// Both are shown on screen: the phone app needs the exact same two values.
#define PROV_SSID "AskNEU-Setup"
#define PROV_POP "askneu"

static bool s_active;
static wifi_sta_config_t s_received;

static void on_prov_event(void *arg, esp_event_base_t base, int32_t id, void *data)
{
    switch (id) {
    case WIFI_PROV_CRED_RECV: {
        const wifi_sta_config_t *sta = data;

        ESP_LOGI(TAG, "phone sent credentials for \"%s\"", (const char *)sta->ssid);
        // Saved only once they are proven to work, so a typo is never kept.
        s_received = *sta;
        ui_setup_note("connecting...");
        break;
    }
    case WIFI_PROV_CRED_FAIL:
        ESP_LOGE(TAG, "provisioning failed, check the password");
        ui_setup_note("that didn't work - check the password");
        break;
    case WIFI_PROV_CRED_SUCCESS:
        ESP_LOGI(TAG, "provisioning successful");
        wifi_creds_save(&s_received);
        break;
    case WIFI_PROV_END:
        s_active = false;
        break;
    default:
        break;
    }
}

esp_err_t wifi_setup_run(void)
{
    ESP_LOGI(TAG, "setup mode: join \"%s\", app code \"%s\"", PROV_SSID, PROV_POP);
    ui_show_setup(PROV_SSID, PROV_POP);

    // The access point netif only exists in setup mode; the provisioning
    // manager starts and stops the actual AP around this.
    esp_netif_create_default_wifi_ap();

    ESP_ERROR_CHECK(esp_event_handler_register(WIFI_PROV_EVENT, ESP_EVENT_ANY_ID,
                                               on_prov_event, NULL));

    wifi_prov_mgr_config_t config = {
        .scheme = wifi_prov_scheme_softap,
        .scheme_event_handler = WIFI_PROV_EVENT_HANDLER_NONE,
    };

    ESP_ERROR_CHECK(wifi_prov_mgr_init(config));

    s_active = true;

    // Security 1 with a proof of possession: the phone must prove it can read
    // the code from this screen before it may hand over credentials.
    esp_err_t err = wifi_prov_mgr_start_provisioning(WIFI_PROV_SECURITY_1, PROV_POP,
                                                     PROV_SSID, NULL);

    if (err != ESP_OK) {
        ESP_LOGE(TAG, "cannot start provisioning: %s", esp_err_to_name(err));
        s_active = false;
        wifi_prov_mgr_deinit();
        return err;
    }

    // Returns when the manager stops itself after the phone is done. No timeout:
    // waiting for the phone is the whole job of setup mode.
    wifi_prov_mgr_wait();

    wifi_prov_mgr_deinit();
    s_active = false;

    ESP_LOGI(TAG, "setup mode finished");

    return ESP_OK;
}

bool wifi_setup_active(void)
{
    return s_active;
}
