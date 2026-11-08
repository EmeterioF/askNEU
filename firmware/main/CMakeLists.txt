# No REQUIRES list on purpose: with none, main implicitly depends on every
# component in the build. A manual list broke nvs_flash.h / esp_netif.h
# resolution.
idf_component_register(
    SRCS
        "main.c"
        "audio.c"
        "ask.c"
        "button.c"
        "conversation.c"
        "player.c"
        "time_sync.c"
        "ui.c"
        "wav.c"
        "wifi.c"
        "wifi_creds.c"
        "wifi_setup.c"
    INCLUDE_DIRS "."
)
