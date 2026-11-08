# AskNEU kiosk firmware

Firmware for the ESP32-S3-BOX-3 kiosk. A student holds the screen, asks a
question, and gets the staff-approved answer as text plus spoken audio.

```
hold screen ──► record 16 kHz mono WAV (up to 8 s)
             ──► POST /api/ask  (X-Device-Token)
             ──► answer text on screen
             ──► download the answer clip (MP3 or WAV)
             ──► play it through the speaker
             ──► back to the idle screen after 3 s
```

Hardware reference: <https://github.com/espressif/esp-box/blob/master/docs/getting_started.md>

The BOX-3 is **2.4 GHz Wi-Fi only**, has a 320x240 touch screen, a dual-mic
array (ES7210), a speaker codec (ES8311), 16 MB flash and 16 MB PSRAM. The BSP
owns all pin mapping; this project never touches GPIOs directly except through
`bsp_iot_button_create()`.

## Files

| File | Responsibility |
|---|---|
| `main.c` | boot order and nothing else |
| `wifi.c` / `wifi.h` | join the saved network, retry forever, fall back to setup mode |
| `wifi_creds.c` / `.h` | read/write the saved network in NVS, seed-once and reset markers |
| `wifi_setup.c` / `.h` | `AskNEU-Setup` access point + phone provisioning |
| `button.c` / `.h` | hardware buttons: 5 s on CONFIG forgets the network |
| `time_sync.c` / `.h` | SNTP clock, required before any HTTPS request |
| `ui.c` / `.h` | LVGL screens: idle, answer card, setup card, hints |
| `audio.c` / `.h` | codec setup, capture worker, speaker streaming |
| `ask.c` / `.h` | the one HTTP request per question |
| `player.c` / `.h` | download + WAV/MP3 playback |
| `wav.c` / `.h` | RIFF header write/parse (host-testable, no ESP-IDF) |
| `conversation.c` / `.h` | one turn: reject short clips, ask, show, play |

The audio worker task is the only place that blocks on the network. The LVGL
task stays free, and every `ui_*` function takes the LVGL lock itself.

## Configuration

`idf.py menuconfig` → **AskNEU**:

| Option | Meaning |
|---|---|
| `ASKNEU_WIFI_SSID` / `ASKNEU_WIFI_PASSWORD` | Seed network, used once on a fresh board |
| `ASKNEU_API_BASE_URL` | Origin only, no trailing slash. `http://` on the LAN, `https://` in production |
| `ASKNEU_DEVICE_TOKEN` | Sent as `X-Device-Token`, must match the server's `DEVICE_TOKEN` |

The real values live in `firmware/sdkconfig`, which is gitignored. Never put
the token or the Wi-Fi password in `sdkconfig.defaults`.

## Build and flash

```powershell
$env:IDF_TOOLS_PATH = "D:\development\esp"
$env:PYTHONNOUSERSITE = "True"
. D:\development\esp\frameworks\esp-idf-v5.4.4\export.ps1

Set-Location D:\development\askNEU\firmware
idf.py build
idf.py -p COM3 -b 460800 flash
```

Serial log:

```powershell
idf.py -p COM3 monitor
```

To start over with no saved Wi-Fi without touching the app partition:

```powershell
python -m esptool -p COM3 erase_region 0x9000 0x6000
```

## Operating the kiosk

* **Talk**: press and hold the red button, speak, release.
* **Too short**: a tap under 300 ms records nothing and shows "hold the screen
  while you ask" instead of asking the backend.
* **Change Wi-Fi**: hold the CONFIG (Boot) button for 5 s. The board forgets the
  network and restarts into setup mode.
* **Setup mode**: the screen shows `AskNEU-Setup` and the code `askneu`. Join
  that Wi-Fi from a phone, open the **ESP SoftAP Provisioning** app, enter the
  code and the target network. The board saves the credentials only after they
  work, joins, and returns to the idle screen.

Setup mode starts by itself when the saved network cannot be joined within 30 s.

## Backend contract

`POST {ASKNEU_API_BASE_URL}/api/ask` with a WAV body, `X-Device-Token` and
`X-Duration-Ms`. The kiosk reads:

```json
{
  "text": "Enrollment runs June 1 to 15 ...",
  "office": { "name": "Registrar", "room": "204", "hours": "8:00-17:00" },
  "audio_urls": ["https://.../clip.mp3"],
  "outcome": "answer"
}
```

Only `text` and the first `audio_urls` entry are required. Missing audio is not
fatal: the answer is still shown on screen.

## Troubleshooting

| Symptom | Look at |
|---|---|
| Blank screen | BSP display init; the log should say `screen ready (320x240)` |
| No sound | speaker volume, `audio_stream_begin` sample rate, MP3 decode log |
| Mic hears nothing | `MIC_GAIN_DB` (42 dB) and `captured ... rms=` in the log |
| No Wi-Fi | setup mode card; `joining "..."` and retry logs |
| HTTPS fails, HTTP works | clock: `clock set to ... UTC` must appear before the first request |
| Setup AP not visible | `setup mode: join "AskNEU-Setup"` in the log, phone on 2.4 GHz |

## Notes

* `main/CMakeLists.txt` must keep **no** `REQUIRES` list. With none, `main`
  implicitly depends on every component in the build; a manual list broke
  `nvs_flash.h` / `esp_netif.h` resolution.
* Do not call `bsp_audio_init(NULL)` before the codec helpers: they only bring
  up I2C when I2S is not running yet.
* `sdkconfig.defaults` must stay UTF-8 **without BOM**; a BOM makes kconfgen
  ignore the first line.
