#include "wav.h"

#include <string.h>

// RIFF/WAVE is little-endian regardless of host byte order, so every field is
// serialised byte by byte instead of relying on struct layout.
static void put_u16le(uint8_t *dst, uint16_t value)
{
    dst[0] = (uint8_t)(value & 0xFF);
    dst[1] = (uint8_t)((value >> 8) & 0xFF);
}

static void put_u32le(uint8_t *dst, uint32_t value)
{
    dst[0] = (uint8_t)(value & 0xFF);
    dst[1] = (uint8_t)((value >> 8) & 0xFF);
    dst[2] = (uint8_t)((value >> 16) & 0xFF);
    dst[3] = (uint8_t)((value >> 24) & 0xFF);
}

static uint16_t get_u16le(const uint8_t *src)
{
    return (uint16_t)(src[0] | (src[1] << 8));
}

static uint32_t get_u32le(const uint8_t *src)
{
    return (uint32_t)src[0] | ((uint32_t)src[1] << 8) | ((uint32_t)src[2] << 16) | ((uint32_t)src[3] << 24);
}

void wav_write_header(uint8_t *header, size_t pcm_bytes, uint32_t sample_rate)
{
    const uint16_t channels = 1;
    const uint16_t bits_per_sample = 16;
    const uint16_t block_align = channels * bits_per_sample / 8;
    const uint32_t byte_rate = sample_rate * block_align;

    memcpy(header + 0, "RIFF", 4);
    put_u32le(header + 4, (uint32_t)(36 + pcm_bytes));
    memcpy(header + 8, "WAVE", 4);

    memcpy(header + 12, "fmt ", 4);
    put_u32le(header + 16, 16); // PCM fmt chunk size
    put_u16le(header + 20, 1);  // format tag: PCM
    put_u16le(header + 22, channels);
    put_u32le(header + 24, sample_rate);
    put_u32le(header + 28, byte_rate);
    put_u16le(header + 32, block_align);
    put_u16le(header + 34, bits_per_sample);

    memcpy(header + 36, "data", 4);
    put_u32le(header + 40, (uint32_t)pcm_bytes);
}

bool wav_parse(const uint8_t *data, size_t len, wav_info_t *out)
{
    if (data == NULL || out == NULL || len < 12) {
        return false;
    }
    if (memcmp(data, "RIFF", 4) != 0 || memcmp(data + 8, "WAVE", 4) != 0) {
        return false;
    }

    bool have_fmt = false;
    size_t pos = 12;

    while (pos + 8 <= len) {
        const uint8_t *chunk = data + pos;
        uint32_t chunk_size = get_u32le(chunk + 4);
        size_t body = pos + 8;

        // A truncated or hostile chunk cannot be walked past safely.
        if (chunk_size > len - body) {
            chunk_size = (uint32_t)(len - body);
        }

        if (memcmp(chunk, "fmt ", 4) == 0 && chunk_size >= 16) {
            out->channels = get_u16le(data + body + 2);
            out->sample_rate = get_u32le(data + body + 4);
            out->bits_per_sample = get_u16le(data + body + 14);
            have_fmt = true;
        } else if (memcmp(chunk, "data", 4) == 0) {
            if (!have_fmt) {
                return false;
            }

            out->pcm_offset = body;
            out->pcm_bytes = chunk_size;

            return out->channels > 0 && out->sample_rate > 0;
        }

        // Chunks are word aligned, so odd sizes carry a pad byte.
        pos = body + chunk_size + (chunk_size & 1u);
    }

    return false;
}
