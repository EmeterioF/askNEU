// Clock sync over SNTP. Without it the board's clock is 1970 and any HTTPS
// request fails certificate validation, which looks like the backend is down.

#include "time_sync.h"

#include <time.h>

#include "esp_log.h"
#include "esp_netif_sntp.h"
#include "freertos/FreeRTOS.h"

static const char *TAG = "askneu_time";

#define NTP_SERVER "pool.ntp.org"
#define NTP_TIMEOUT_MS 15000

esp_err_t time_sync_start(void)
{
    esp_sntp_config_t config = ESP_NETIF_SNTP_DEFAULT_CONFIG(NTP_SERVER);

    esp_err_t err = esp_netif_sntp_init(&config);

    if (err != ESP_OK) {
        ESP_LOGE(TAG, "cannot start SNTP: %s", esp_err_to_name(err));
        return err;
    }

    err = esp_netif_sntp_sync_wait(pdMS_TO_TICKS(NTP_TIMEOUT_MS));

    if (err != ESP_OK) {
        ESP_LOGE(TAG, "no time from %s: %s", NTP_SERVER, esp_err_to_name(err));
        return err;
    }

    time_t now = time(NULL);
    struct tm utc;
    gmtime_r(&now, &utc);

    ESP_LOGI(TAG, "clock set to %04d-%02d-%02d %02d:%02d:%02d UTC",
             utc.tm_year + 1900, utc.tm_mon + 1, utc.tm_mday,
             utc.tm_hour, utc.tm_min, utc.tm_sec);

    return ESP_OK;
}
