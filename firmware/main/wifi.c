#include "wifi.h"

#include <stdio.h>
#include <string.h>

#include "esp_event.h"
#include "esp_log.h"
#include "esp_netif.h"
#include "esp_wifi.h"
#include "freertos/FreeRTOS.h"
#include "freertos/event_groups.h"
#include "nvs.h"
#include "sdkconfig.h"
#include "ui.h"
#include "wifi_provisioning/manager.h"
#include "wifi_provisioning/scheme_softap.h"

static const char *TAG = "askneu_wifi";

#define WIFI_CONNECTED_BIT BIT0
#define WIFI_PROV_DONE_BIT BIT1

// Reconnects before the first attempt at boot is called a failure.
#define STA_FAST_RETRIES 5
// How long the boot attempt waits for an IP before setup mode takes over.
#define STA_CONNECT_TIMEOUT_MS 30000
// After provisioning the board is normally already online; this is just slack.
#define PROV_CONNECT_TIMEOUT_MS 30000

// Both are shown on screen: the phone app needs the exact same two values.
#define PROV_SSID "AskNEU-Setup"
#define PROV_POP "askneu"

// The saved network lives in the project's own keys, not in the provisioning
// manager's, so the board can also be seeded from menuconfig.
#define NVS_NAMESPACE "askneu"
#define NVS_KEY_SSID "wifi_ssid"
#define NVS_KEY_PASS "wifi_pass"
// Set by a factory reset so build-time credentials are not seeded back.
#define NVS_KEY_NO_SEED "no_seed"

static EventGroupHandle_t s_events;
static int s_retries;
static char s_ip[16] = {0};
static bool s_reset_requested;
static bool s_provisioning;
static wifi_sta_config_t s_received;

static bool creds_load(wifi_config_t *config)
{
    nvs_handle_t nvs;

    if (nvs_open(NVS_NAMESPACE, NVS_READONLY, &nvs) != ESP_OK) {
        return false;
    }

    size_t ssid_len = sizeof(config->sta.ssid);
    size_t pass_len = sizeof(config->sta.password);
    esp_err_t err = nvs_get_str(nvs, NVS_KEY_SSID, (char *)config->sta.ssid, &ssid_len);

    if (err == ESP_OK) {
        // A missing password is valid: open networks store nothing.
        nvs_get_str(nvs, NVS_KEY_PASS, (char *)config->sta.password, &pass_len);
    }

    nvs_close(nvs);

    return err == ESP_OK && config->sta.ssid[0] != '\0';
}

static bool no_seed_set(void)
{
    nvs_handle_t nvs;
    uint8_t flag = 0;

    if (nvs_open(NVS_NAMESPACE, NVS_READONLY, &nvs) != ESP_OK) {
        return false;
    }

    nvs_get_u8(nvs, NVS_KEY_NO_SEED, &flag);
    nvs_close(nvs);

    return flag != 0;
}

static void creds_save(const wifi_sta_config_t *sta)
{
    nvs_handle_t nvs;

    if (nvs_open(NVS_NAMESPACE, NVS_READWRITE, &nvs) != ESP_OK) {
        ESP_LOGE(TAG, "cannot open NVS to save the network");
        return;
    }

    nvs_set_str(nvs, NVS_KEY_SSID, (const char *)sta->ssid);
    nvs_set_str(nvs, NVS_KEY_PASS, (const char *)sta->password);
    nvs_erase_key(nvs, NVS_KEY_NO_SEED);
    nvs_commit(nvs);
    nvs_close(nvs);
}

void wifi_factory_reset(void)
{
    nvs_handle_t nvs;

    s_reset_requested = true;

    if (nvs_open(NVS_NAMESPACE, NVS_READWRITE, &nvs) != ESP_OK) {
        return;
    }

    nvs_erase_key(nvs, NVS_KEY_SSID);
    nvs_erase_key(nvs, NVS_KEY_PASS);
    nvs_set_u8(nvs, NVS_KEY_NO_SEED, 1);
    nvs_commit(nvs);
    nvs_close(nvs);
}

static void handle_sta_disconnected(void)
{
    // While the provisioning manager owns the station it runs its own attempts.
    if (s_provisioning) {
        return;
    }

    s_retries++;

    if (s_retries <= STA_FAST_RETRIES) {
        ESP_LOGW(TAG, "disconnected, retry %d/%d", s_retries, STA_FAST_RETRIES);
    } else if (s_retries % 10 == 0) {
        ESP_LOGW(TAG, "still offline (%d attempts), keeping at it", s_retries);
    }

    // Retrying forever is deliberate: a kiosk that gives up needs a human.
    esp_wifi_connect();
}

static void handle_got_ip(ip_event_got_ip_t *event)
{
    snprintf(s_ip, sizeof(s_ip), IPSTR, IP2STR(&event->ip_info.ip));
    s_retries = 0;

    ESP_LOGI(TAG, "connected, ip=%s", s_ip);
    xEventGroupSetBits(s_events, WIFI_CONNECTED_BIT);
}

static void on_event(void *arg, esp_event_base_t base, int32_t id, void *data)
{
    if (base == WIFI_EVENT && id == WIFI_EVENT_STA_START) {
        if (!s_provisioning) {
            esp_wifi_connect();
        }
    } else if (base == WIFI_EVENT && id == WIFI_EVENT_STA_DISCONNECTED) {
        handle_sta_disconnected();
    } else if (base == IP_EVENT && id == IP_EVENT_STA_GOT_IP) {
        handle_got_ip((ip_event_got_ip_t *)data);
    }
}

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
        creds_save(&s_received);
        break;
    case WIFI_PROV_END:
        s_provisioning = false;
        wifi_prov_mgr_deinit();
        xEventGroupSetBits(s_events, WIFI_PROV_DONE_BIT);
        break;
    default:
        break;
    }
}

static void station_start(const wifi_config_t *config)
{
    wifi_config_t local = *config;

    ESP_ERROR_CHECK(esp_wifi_set_mode(WIFI_MODE_STA));
    ESP_ERROR_CHECK(esp_wifi_set_config(WIFI_IF_STA, &local));
    ESP_ERROR_CHECK(esp_wifi_start());
}

static bool wait_for_connected(uint32_t timeout_ms)
{
    EventBits_t bits = xEventGroupWaitBits(s_events, WIFI_CONNECTED_BIT, pdTRUE, pdTRUE,
                                           pdMS_TO_TICKS(timeout_ms));

    return (bits & WIFI_CONNECTED_BIT) != 0;
}

static esp_err_t start_provisioning(void)
{
    ESP_LOGI(TAG, "setup mode: join \"%s\", app code \"%s\"", PROV_SSID, PROV_POP);
    ui_show_setup(PROV_SSID, PROV_POP);

    wifi_prov_mgr_config_t config = {
        .scheme = wifi_prov_scheme_softap,
        .scheme_event_handler = WIFI_PROV_EVENT_HANDLER_NONE,
    };

    ESP_ERROR_CHECK(wifi_prov_mgr_init(config));

    s_provisioning = true;

    // Security 1 with a proof of possession: the phone must prove it can read
    // the code from this screen before it may hand over Wi-Fi credentials.
    esp_err_t err = wifi_prov_mgr_start_provisioning(WIFI_PROV_SECURITY_1, PROV_POP, PROV_SSID, NULL);

    if (err != ESP_OK) {
        ESP_LOGE(TAG, "cannot start provisioning: %s", esp_err_to_name(err));
        s_provisioning = false;
        return err;
    }

    // Waits for the phone, however long that takes: the manager stops itself
    // and posts WIFI_PROV_END once the credentials are in and the station is up.
    xEventGroupWaitBits(s_events, WIFI_PROV_DONE_BIT, pdTRUE, pdTRUE, portMAX_DELAY);

    // The setup access point is gone by now, so the card must go too, even if
    // the join still fails: the station retries on its own from here.
    ui_set_status(UI_STATUS_IDLE);

    if (!wait_for_connected(PROV_CONNECT_TIMEOUT_MS)) {
        ESP_LOGE(TAG, "provisioned but no IP yet");
        return ESP_FAIL;
    }

    return ESP_OK;
}

esp_err_t wifi_start(void)
{
    s_events = xEventGroupCreate();

    if (s_events == NULL) {
        return ESP_ERR_NO_MEM;
    }

    ESP_ERROR_CHECK(esp_netif_init());
    ESP_ERROR_CHECK(esp_event_loop_create_default());
    esp_netif_create_default_wifi_sta();
    // The access point only exists in setup mode, but the netif must be ready
    // before the provisioning manager can use it.
    esp_netif_create_default_wifi_ap();

    wifi_init_config_t init_config = WIFI_INIT_CONFIG_DEFAULT();
    ESP_ERROR_CHECK(esp_wifi_init(&init_config));

    // A factory reset must also forget the copy the Wi-Fi driver keeps in its
    // own NVS, or the board could quietly rejoin the old network during setup.
    if (s_reset_requested) {
        wifi_config_t empty = {0};

        if (esp_wifi_set_config(WIFI_IF_STA, &empty) != ESP_OK) {
            ESP_LOGW(TAG, "could not clear the network saved by the driver");
        }
    }

    ESP_ERROR_CHECK(esp_event_handler_register(WIFI_EVENT, ESP_EVENT_ANY_ID, on_event, NULL));
    ESP_ERROR_CHECK(esp_event_handler_register(IP_EVENT, IP_EVENT_STA_GOT_IP, on_event, NULL));
    ESP_ERROR_CHECK(esp_event_handler_register(WIFI_PROV_EVENT, ESP_EVENT_ANY_ID, on_prov_event, NULL));

    wifi_config_t config = {0};
    bool have_creds = creds_load(&config);

    if (!have_creds && !s_reset_requested && !no_seed_set() && CONFIG_ASKNEU_WIFI_SSID[0] != '\0') {
        strlcpy((char *)config.sta.ssid, CONFIG_ASKNEU_WIFI_SSID, sizeof(config.sta.ssid));
        strlcpy((char *)config.sta.password, CONFIG_ASKNEU_WIFI_PASSWORD,
                sizeof(config.sta.password));

        // Persist once so from now on it behaves like any phone-set network.
        creds_save(&config.sta);
        have_creds = true;

        ESP_LOGI(TAG, "first boot, using \"%s\" from the build config", CONFIG_ASKNEU_WIFI_SSID);
    }

    if (have_creds) {
        ESP_LOGI(TAG, "joining \"%s\"", (const char *)config.sta.ssid);
        station_start(&config);

        if (wait_for_connected(STA_CONNECT_TIMEOUT_MS)) {
            return ESP_OK;
        }

        ESP_LOGW(TAG, "could not join \"%s\", switching to setup mode",
                 (const char *)config.sta.ssid);
    } else {
        ESP_LOGI(TAG, "no saved network, starting setup mode");
    }

    return start_provisioning();
}

const char *wifi_ip(void)
{
    return s_ip;
}
