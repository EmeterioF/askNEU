// One request per question: the recorded PCM is wrapped in a WAV header and
// posted to the backend, and the JSON answer is parsed into ask_answer_t.
// Retries once, because a single Wi-Fi hiccup should not cost the student an
// answer.

#include "ask.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "cJSON.h"
#include "esp_crt_bundle.h"
#include "esp_http_client.h"
#include "esp_log.h"
#include "sdkconfig.h"

#include "audio.h"
#include "wav.h"

static const char *TAG = "askneu_ask";

// The mock answer is ~300 bytes of JSON; 2 KB leaves room for a real one.
#define RESPONSE_MAX 2048

static esp_err_t write_all(esp_http_client_handle_t client, const uint8_t *data, size_t len)
{
    size_t sent = 0;

    while (sent < len) {
        int written = esp_http_client_write(client, (const char *)data + sent, len - sent);

        if (written <= 0) {
            ESP_LOGE(TAG, "write failed after %u/%u bytes", (unsigned)sent, (unsigned)len);
            return ESP_FAIL;
        }

        sent += (size_t)written;
    }

    return ESP_OK;
}

static esp_err_t read_body(esp_http_client_handle_t client, char *buffer, size_t capacity)
{
    size_t total = 0;

    while (total < capacity - 1) {
        int read = esp_http_client_read(client, buffer + total, capacity - 1 - total);

        if (read < 0) {
            ESP_LOGE(TAG, "read failed");
            return ESP_FAIL;
        }
        if (read == 0) {
            break;
        }

        total += (size_t)read;
    }

    buffer[total] = '\0';

    return ESP_OK;
}

// Pulls the fields the kiosk needs out of the contract response. Missing audio
// is not fatal: the screen can still show the text.
static void parse_answer(const char *json, ask_answer_t *out)
{
    cJSON *root = cJSON_Parse(json);

    if (root == NULL) {
        ESP_LOGE(TAG, "response is not valid JSON");
        return;
    }

    const cJSON *text = cJSON_GetObjectItemCaseSensitive(root, "text");

    if (cJSON_IsString(text) && text->valuestring != NULL) {
        strlcpy(out->text, text->valuestring, sizeof(out->text));
    }

    const cJSON *urls = cJSON_GetObjectItemCaseSensitive(root, "audio_urls");

    if (cJSON_IsArray(urls)) {
        const cJSON *first = cJSON_GetArrayItem(urls, 0);

        if (cJSON_IsString(first) && first->valuestring != NULL) {
            strlcpy(out->audio_url, first->valuestring, sizeof(out->audio_url));
        }
    }

    cJSON_Delete(root);
}

static esp_err_t ask_send_once(const uint8_t *pcm, size_t pcm_bytes, uint32_t duration_ms, ask_answer_t *out)
{
    if (pcm == NULL || pcm_bytes == 0 || out == NULL) {
        return ESP_ERR_INVALID_ARG;
    }

    memset(out, 0, sizeof(*out));

    esp_http_client_config_t config = {
        .url = CONFIG_ASKNEU_API_BASE_URL "/api/ask",
        .method = HTTP_METHOD_POST,
        .timeout_ms = 20000,
        // Works for both http:// on the LAN and https:// in production; the
        // bundle is ignored for plain connections.
        .crt_bundle_attach = esp_crt_bundle_attach,
    };

    esp_http_client_handle_t client = esp_http_client_init(&config);

    if (client == NULL) {
        ESP_LOGE(TAG, "http client init failed");
        return ESP_FAIL;
    }

    char duration_header[16];
    snprintf(duration_header, sizeof(duration_header), "%lu", (unsigned long)duration_ms);

    esp_http_client_set_header(client, "Content-Type", "audio/wav");
    esp_http_client_set_header(client, "X-Device-Token", CONFIG_ASKNEU_DEVICE_TOKEN);
    esp_http_client_set_header(client, "X-Duration-Ms", duration_header);

    uint8_t header[WAV_HEADER_SIZE];
    wav_write_header(header, pcm_bytes, AUDIO_SAMPLE_RATE);

    esp_err_t err = ESP_FAIL;
    char *body = NULL;

    if (esp_http_client_open(client, WAV_HEADER_SIZE + pcm_bytes) != ESP_OK) {
        ESP_LOGE(TAG, "connect to %s failed", config.url);
        goto cleanup;
    }

    if (write_all(client, header, WAV_HEADER_SIZE) != ESP_OK ||
        write_all(client, pcm, pcm_bytes) != ESP_OK) {
        goto cleanup;
    }

    if (esp_http_client_fetch_headers(client) < 0) {
        ESP_LOGE(TAG, "no response headers");
        goto cleanup;
    }

    int status = esp_http_client_get_status_code(client);

    body = malloc(RESPONSE_MAX);

    if (body == NULL) {
        ESP_LOGE(TAG, "no memory for response");
        goto cleanup;
    }

    if (read_body(client, body, RESPONSE_MAX) != ESP_OK) {
        goto cleanup;
    }

    ESP_LOGI(TAG, "status=%d body=%s", status, body);

    if (status != 200) {
        ESP_LOGE(TAG, "backend rejected the request");
        goto cleanup;
    }

    parse_answer(body, out);
    err = ESP_OK;

cleanup:
    free(body);
    esp_http_client_close(client);
    esp_http_client_cleanup(client);

    return err;
}

esp_err_t ask_send(const uint8_t *pcm, size_t pcm_bytes, uint32_t duration_ms, ask_answer_t *out)
{
    esp_err_t err = ask_send_once(pcm, pcm_bytes, duration_ms, out);

    if (err == ESP_OK) {
        return ESP_OK;
    }

    // One Wi-Fi hiccup should not cost the student their answer, so the whole
    // request is replayed once before the screen shows an error.
    ESP_LOGW(TAG, "request failed, retrying once");

    return ask_send_once(pcm, pcm_bytes, duration_ms, out);
}
