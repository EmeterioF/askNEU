// Persistent Wi-Fi credentials. One small module so the connection logic in
// wifi.c and the provisioning flow in wifi_setup.c share the same storage.

#include "wifi_creds.h"

#include <stddef.h>

#include "esp_log.h"
#include "nvs.h"

static const char *TAG = "askneu_creds";

#define NVS_NAMESPACE "askneu"
#define NVS_KEY_SSID "wifi_ssid"
#define NVS_KEY_PASS "wifi_pass"
#define NVS_KEY_NO_SEED "no_seed"

bool wifi_creds_load(wifi_config_t *config)
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

void wifi_creds_save(const wifi_sta_config_t *sta)
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

void wifi_creds_erase(void)
{
    nvs_handle_t nvs;

    if (nvs_open(NVS_NAMESPACE, NVS_READWRITE, &nvs) != ESP_OK) {
        return;
    }

    nvs_erase_key(nvs, NVS_KEY_SSID);
    nvs_erase_key(nvs, NVS_KEY_PASS);
    nvs_set_u8(nvs, NVS_KEY_NO_SEED, 1);
    nvs_commit(nvs);
    nvs_close(nvs);
}

bool wifi_creds_seed_allowed(void)
{
    nvs_handle_t nvs;
    uint8_t blocked = 0;

    if (nvs_open(NVS_NAMESPACE, NVS_READONLY, &nvs) != ESP_OK) {
        return true;
    }

    nvs_get_u8(nvs, NVS_KEY_NO_SEED, &blocked);
    nvs_close(nvs);

    return blocked == 0;
}
