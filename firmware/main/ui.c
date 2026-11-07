#include "ui.h"

#include <stdbool.h>
#include <stdio.h>

#include "audio.h"
#include "bsp/esp-bsp.h"
#include "esp_log.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "lvgl.h"

static const char *TAG = "askneu_ui";

#define COLOR_BG 0x0B1020
#define COLOR_TEXT 0xF3F6FF
#define COLOR_MUTED 0x9AA4C0
#define COLOR_BUTTON 0xD92B2B
#define COLOR_BUTTON_PRESSED 0xFF3B30
#define COLOR_OK 0x2BD98A
#define COLOR_ERROR 0xFF8A5B

#define BUTTON_SIZE 120

// Touch sampling while checking for a boot-time hold.
#define HOLD_POLL_MS 100

static lv_obj_t *s_hint;
static lv_obj_t *s_button;
static lv_obj_t *s_answer;
static bool s_capturing;

// Split off so the LVGL callback (already on the LVGL task, holding the lock)
// can update the hint without re-taking the mutex.
static void hint_set(const char *text, uint32_t color)
{
    lv_label_set_text(s_hint, text);
    lv_obj_set_style_text_color(s_hint, lv_color_hex(color), 0);
}

static void show_idle_widgets(void)
{
    lv_obj_set_hidden(s_answer, true);
    lv_obj_set_hidden(s_button, false);
    lv_obj_set_hidden(s_hint, false);
}

static lv_obj_t *make_label(lv_obj_t *parent, const char *text, uint32_t color, const lv_font_t *font)
{
    lv_obj_t *label = lv_label_create(parent);

    lv_label_set_text(label, text);
    lv_obj_set_style_text_color(label, lv_color_hex(color), 0);
    lv_obj_set_style_text_font(label, font, 0);

    return label;
}

static void on_talk_button(lv_event_t *event)
{
    lv_event_code_t code = lv_event_get_code(event);

    if (code == LV_EVENT_PRESSED) {
        ESP_LOGI(TAG, "touch down");

        if (audio_clip_begin() != ESP_OK) {
            s_capturing = false;
            hint_set("one moment...", COLOR_MUTED);
            return;
        }

        s_capturing = true;
        hint_set("listening...", COLOR_OK);
        return;
    }

    if (code == LV_EVENT_RELEASED || code == LV_EVENT_PRESS_LOST) {
        ESP_LOGI(TAG, "touch up");

        if (!s_capturing) {
            return;
        }

        s_capturing = false;
        hint_set("thinking...", COLOR_MUTED);
        audio_clip_end();
    }
}

static lv_obj_t *create_talk_button(lv_obj_t *parent)
{
    lv_obj_t *button = lv_obj_create(parent);

    lv_obj_set_size(button, BUTTON_SIZE, BUTTON_SIZE);
    lv_obj_set_style_radius(button, LV_RADIUS_CIRCLE, 0);
    lv_obj_set_style_border_width(button, 0, 0);
    lv_obj_set_style_shadow_width(button, 0, 0);
    lv_obj_set_style_pad_all(button, 0, 0);
    lv_obj_set_style_bg_color(button, lv_color_hex(COLOR_BUTTON), 0);
    lv_obj_set_style_bg_color(button, lv_color_hex(COLOR_BUTTON_PRESSED), LV_STATE_PRESSED);
    lv_obj_set_scrollable(button, false);
    lv_obj_align(button, LV_ALIGN_CENTER, 0, 22);

    lv_obj_t *label = make_label(button, "HOLD", COLOR_TEXT, LV_FONT_DEFAULT);
    lv_obj_center(label);

    lv_obj_add_event_cb(button, on_talk_button, LV_EVENT_ALL, NULL);

    return button;
}

static void build_idle_screen(void)
{
    lv_obj_t *screen = lv_screen_active();

    lv_obj_clean(screen);
    lv_obj_set_style_bg_color(screen, lv_color_hex(COLOR_BG), 0);
    lv_obj_set_style_bg_opa(screen, LV_OPA_COVER, 0);

    lv_obj_t *title = make_label(screen, "AskNEU", COLOR_TEXT, &lv_font_montserrat_48);
    lv_obj_align(title, LV_ALIGN_TOP_MID, 0, 6);

    s_button = create_talk_button(screen);

    s_hint = make_label(screen, "hold the screen and ask", COLOR_MUTED, LV_FONT_DEFAULT);
    lv_obj_align(s_hint, LV_ALIGN_BOTTOM_MID, 0, -10);

    s_answer = make_label(screen, "", COLOR_TEXT, &lv_font_montserrat_20);
    lv_obj_set_width(s_answer, BSP_LCD_H_RES - 24);
    lv_label_set_long_mode(s_answer, LV_LABEL_LONG_MODE_WRAP);
    lv_obj_set_style_text_align(s_answer, LV_TEXT_ALIGN_CENTER, 0);
    lv_obj_align(s_answer, LV_ALIGN_CENTER, 0, 10);
    lv_obj_set_hidden(s_answer, true);
}

void ui_set_status(ui_status_t status)
{
    if (!bsp_display_lock(0)) {
        return;
    }

    switch (status) {
    case UI_STATUS_IDLE:
        show_idle_widgets();
        hint_set("hold the screen and ask", COLOR_MUTED);
        break;
    case UI_STATUS_THINKING:
        show_idle_widgets();
        hint_set("thinking...", COLOR_MUTED);
        break;
    case UI_STATUS_TOO_SHORT:
        show_idle_widgets();
        hint_set("hold the screen while you ask", COLOR_MUTED);
        break;
    case UI_STATUS_ERROR:
        show_idle_widgets();
        hint_set("can't reach the office helper", COLOR_ERROR);
        break;
    }

    bsp_display_unlock();
}

void ui_show_answer(const char *text)
{
    if (text == NULL) {
        return;
    }

    if (!bsp_display_lock(0)) {
        return;
    }

    lv_label_set_text(s_answer, text);
    lv_obj_set_hidden(s_answer, false);
    lv_obj_set_hidden(s_button, true);
    lv_obj_set_hidden(s_hint, true);

    bsp_display_unlock();
}

bool ui_hold_detected(uint32_t hold_ms)
{
    lv_indev_t *indev = bsp_display_get_input_dev();

    if (indev == NULL) {
        return false;
    }

    if (bsp_display_lock(0)) {
        hint_set("hold the screen to change Wi-Fi", COLOR_MUTED);
        bsp_display_unlock();
    }

    uint32_t held_ms = 0;

    for (uint32_t elapsed = 0; elapsed < hold_ms; elapsed += HOLD_POLL_MS) {
        bool pressed = false;

        // LVGL keeps the input device state current, so no touch driver access
        // is needed here; the lock keeps this in step with the LVGL task.
        if (bsp_display_lock(0)) {
            pressed = lv_indev_get_state(indev) == LV_INDEV_STATE_PRESSED;
            bsp_display_unlock();
        }

        // Letting go at any point starts the count again.
        held_ms = pressed ? held_ms + HOLD_POLL_MS : 0;
        vTaskDelay(pdMS_TO_TICKS(HOLD_POLL_MS));
    }

    if (bsp_display_lock(0)) {
        hint_set("hold the screen and ask", COLOR_MUTED);
        bsp_display_unlock();
    }

    return held_ms >= hold_ms;
}

void ui_show_setup(const char *ssid, const char *pop)
{
    if (ssid == NULL || pop == NULL) {
        return;
    }

    char text[128];
    snprintf(text, sizeof(text), "Setup mode\n\njoin Wi-Fi\n\"%s\"\n\nESP SoftAP Prov app\ncode: %s",
             ssid, pop);

    if (!bsp_display_lock(0)) {
        return;
    }

    lv_label_set_text(s_answer, text);
    lv_obj_set_hidden(s_answer, false);
    lv_obj_set_hidden(s_button, true);
    lv_obj_set_hidden(s_hint, false);
    hint_set("waiting for your phone...", COLOR_MUTED);

    bsp_display_unlock();
}

void ui_setup_note(const char *note)
{
    if (note == NULL) {
        return;
    }

    if (!bsp_display_lock(0)) {
        return;
    }

    hint_set(note, COLOR_MUTED);

    bsp_display_unlock();
}

esp_err_t ui_start(void)
{
    lv_display_t *display = bsp_display_start();

    if (display == NULL) {
        ESP_LOGE(TAG, "display init failed");
        return ESP_FAIL;
    }

    // LVGL runs in its own task; every lv_* call from app_main needs the lock.
    if (bsp_display_lock(0)) {
        build_idle_screen();
        bsp_display_unlock();
    }

    ESP_ERROR_CHECK(bsp_display_backlight_on());

    ESP_LOGI(TAG, "screen ready (%dx%d)", BSP_LCD_H_RES, BSP_LCD_V_RES);

    return ESP_OK;
}
