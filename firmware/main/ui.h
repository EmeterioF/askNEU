#pragma once

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

// Replaces the talk button with a wrapped text card: answers, setup details,
// or a short message before a restart.
void ui_show_card(const char *text);

// Setup mode card: which access point to join and which app code to enter.
void ui_show_setup(const char *ssid, const char *pop);

// Small line under the setup card, for progress and failures.
void ui_setup_note(const char *note);
