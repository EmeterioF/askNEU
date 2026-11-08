// Station connection and the fallback to setup mode. Credential storage lives
// in wifi_creds.c, the setup access point in wifi_setup.c; this file only
// decides which one to use and keeps the station connected afterwards.

#include "wifi.h"

#include <stdio.h>
#include <string.h>

#include "esp_event.h"
#include "esp_log.h"
#include "esp_netif.h"
#include "esp_wifi.h"
#include "freertos/FreeRTOS.h"
#include "freertos/event_groups.h"
#include "sdkconfig.h"
#include "ui.h"
#include "wifi_creds.h"
#include "wifi_setup.h"

static const char *TAG = "askneu_wifi";

#define WIFI_CONNECTED_BIT BIT0

// Fast reconnects before the boot attempt is called a failure.
#define STA_FAST_RETRIES 5
// How long the boot attempt waits for an IP before setup mode takes over.
#define STA_CONNECT_TIMEOUT_MS 30000
// After provisioning the board is normally already online; this is just slack.
#define PROV_CONNECT_TIMEOUT_MS 30000

static EventGroupHandle_t s_events;
static int s_retries;
static char s_ip[16] = {0};

static void handle_sta_disconnected(void)
{
    // While the provisioning manager drives the station it runs its own attempts.
    if (wifi_setup_active()) {
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
        if (!wifi_setup_active()) {
            esp_wifi_connect();
        }
    } else if (base == WIFI_EVENT && id == WIFI_EVENT_STA_DISCONNECTED) {
        handle_sta_disconnected();
    } else if (base == IP_EVENT && id == IP_EVENT_STA_GOT_IP) {
        handle_got_ip((ip_event_got_ip_t *)data);
    }
}

static bool wait_for_connected(uint32_t timeout_ms)
{
    EventBits_t bits = xEventGroupWaitBits(s_events, WIFI_CONNECTED_BIT, pdTRUE, pdTRUE,
                                           pdMS_TO_TICKS(timeout_ms));

    return (bits & WIFI_CONNECTED_BIT) != 0;
}

static void station_start(const wifi_config_t *config)
{
    wifi_config_t local = *config;

    ESP_ERROR_CHECK(esp_wifi_set_mode(WIFI_MODE_STA));
    ESP_ERROR_CHECK(esp_wifi_set_config(WIFI_IF_STA, &local));
    ESP_ERROR_CHECK(esp_wifi_start());
}

// On a fresh board the menuconfig credentials are saved once, so from then on
// they behave exactly like a network set from the phone.
static bool seed_from_build_config(wifi_config_t *config)
{
    if (CONFIG_ASKNEU_WIFI_SSID[0] == '\0' || !wifi_creds_seed_allowed()) {
        return false;
    }

    strlcpy((char *)config->sta.ssid, CONFIG_ASKNEU_WIFI_SSID, sizeof(config->sta.ssid));
    strlcpy((char *)config->sta.password, CONFIG_ASKNEU_WIFI_PASSWORD,
            sizeof(config->sta.password));

    wifi_creds_save(&config->sta);

    ESP_LOGI(TAG, "first boot, using \"%s\" from the build config", CONFIG_ASKNEU_WIFI_SSID);

    return true;
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

    wifi_init_config_t init_config = WIFI_INIT_CONFIG_DEFAULT();
    ESP_ERROR_CHECK(esp_wifi_init(&init_config));

    ESP_ERROR_CHECK(esp_event_handler_register(WIFI_EVENT, ESP_EVENT_ANY_ID, on_event, NULL));
    ESP_ERROR_CHECK(esp_event_handler_register(IP_EVENT, IP_EVENT_STA_GOT_IP, on_event, NULL));

    wifi_config_t config = {0};

    if (wifi_creds_load(&config) || seed_from_build_config(&config)) {
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

    if (wifi_setup_run() != ESP_OK) {
        return ESP_FAIL;
    }

    // The setup access point is gone by now, so the card must go too, even if
    // the join still fails: the station retries on its own from here.
    ui_set_status(UI_STATUS_IDLE);

    if (!wait_for_connected(PROV_CONNECT_TIMEOUT_MS)) {
        ESP_LOGE(TAG, "provisioned but no IP yet");
        return ESP_FAIL;
    }

    return ESP_OK;
}

void wifi_factory_reset(void)
{
    wifi_config_t empty = {0};

    wifi_creds_erase();

    // The Wi-Fi driver keeps its own copy of the last config in NVS. Clear it,
    // or the next boot could quietly rejoin the old network during setup.
    if (esp_wifi_set_config(WIFI_IF_STA, &empty) != ESP_OK) {
        ESP_LOGW(TAG, "could not clear the network saved by the driver");
    }
}

const char *wifi_ip(void)
{
    return s_ip;
}
