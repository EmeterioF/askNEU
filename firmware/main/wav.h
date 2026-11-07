#pragma once

#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>

// Canonical 44-byte RIFF/WAVE header for uncompressed 16-bit PCM.
#define WAV_HEADER_SIZE 44

// Writes a RIFF/WAVE header describing `pcm_bytes` of 16-bit mono PCM at
// `sample_rate`. The caller owns `header` and must supply WAV_HEADER_SIZE bytes.
void wav_write_header(uint8_t *header, size_t pcm_bytes, uint32_t sample_rate);

typedef struct {
    uint32_t sample_rate;
    uint16_t channels;
    uint16_t bits_per_sample;
    size_t pcm_offset;
    size_t pcm_bytes;
} wav_info_t;

// Reads the chunk layout of an in-memory RIFF/WAVE file. Chunks the kiosk does
// not care about (LIST, fact, ...) are skipped. Returns false when the buffer is
// not a WAV file or the fmt/data chunks are missing.
bool wav_parse(const uint8_t *data, size_t len, wav_info_t *out);
