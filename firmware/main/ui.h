#pragma once

#include <stdbool.h>
#include <stdint.h>

#include "esp_err.h"

typedef enum {
    UI_STATUS_IDLE,
    UI_STATUS_THINKING,
    UI_STATUS_TOO_SHORT,
    UI_STATUS_ERROR,
} ui_status_t;

esp_err_t ui_start(void);

// Safe to call from any task: the LVGL lock is taken internally.
void ui_set_status(ui_status_t status);

// Replaces the talk button with a wrapped answer card.
void ui_show_answer(const char *text);

// True when the screen stays pressed for the whole window. Blocks for up to
// hold_ms; used at boot to trigger a Wi-Fi reset.
bool ui_hold_detected(uint32_t hold_ms);

// Setup mode card: which access point to join and which app code to enter.
void ui_show_setup(const char *ssid, const char *pop);

// Small line under the setup card, for progress and failures.
void ui_setup_note(const char *note);
