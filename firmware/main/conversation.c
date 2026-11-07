#include "conversation.h"

#include <stddef.h>
#include <stdint.h>

#include "ask.h"
#include "audio.h"
#include "esp_log.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "player.h"
#include "ui.h"

static const char *TAG = "askneu_talk";

// A stray tap records one 32 ms chunk; that is not a question.
#define MIN_CLIP_MS 300

// Runs on the audio worker task, after capture and before the next press.
static void on_clip(const uint8_t *pcm, size_t bytes)
{
    uint32_t duration_ms = (uint32_t)((uint64_t)bytes * 1000 / (AUDIO_SAMPLE_RATE * 2));
    ask_answer_t answer;

    if (bytes == 0 || duration_ms < MIN_CLIP_MS) {
        ESP_LOGI(TAG, "clip is %.0f ms, ignoring it", (double)duration_ms);
        ui_set_status(UI_STATUS_TOO_SHORT);
        return;
    }

    ui_set_status(UI_STATUS_THINKING);

    if (ask_send(pcm, bytes, duration_ms, &answer) != ESP_OK) {
        ui_set_status(UI_STATUS_ERROR);
        return;
    }

    ESP_LOGI(TAG, "answer \"%s\" (audio %.1f s, %s)",
             answer.text, (double)bytes / (AUDIO_SAMPLE_RATE * 2), answer.audio_url);

    if (answer.text[0] == '\0') {
        ui_set_status(UI_STATUS_ERROR);
        return;
    }

    ui_show_answer(answer.text);

    // The text stays on screen while the clip plays; then the kiosk goes back
    // to inviting the next student. The short hold keeps a failed clip from
    // flashing the answer away in the same frame it appeared.
    if (answer.audio_url[0] != '\0' && player_play_url(answer.audio_url) != ESP_OK) {
        ESP_LOGW(TAG, "answer audio failed to play");
    }

    vTaskDelay(pdMS_TO_TICKS(3000));
    ui_set_status(UI_STATUS_IDLE);
}

esp_err_t conversation_start(void)
{
    audio_set_clip_handler(on_clip);

    return ESP_OK;
}
