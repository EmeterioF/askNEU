# Step 3 spike tests

These are local experiments. They do not modify the application routes.

## Setup

Create `.env.local` with:

```env
CF_ACCOUNT_ID=
CF_API_TOKEN=
HEALTH_URL=http://localhost:3000/api/health
HEALTH_RUNS=10
```

Keep the Cloudflare credentials private. The test scripts never print them.

Install the existing dependencies, then run:

```powershell
npx tsc --noEmit
npx tsx test/model-test.ts
npx tsx test/tts-test.ts
npx tsx test/whisper-test.ts
npx tsx test/health-test.ts
```

## Audio setup

For Whisper, add your own non-sensitive recordings:

```text
test/audio/question-8s.wav
test/audio/tap-04s.wav
test/audio/silence-3s.wav
```

Use 16 kHz, mono, 16-bit PCM WAV files. The script runs each file with and without
the vocabulary prompt and prints latency and transcript text.

The current fixtures were derived from the `16000/test01_20s.wav` sample in
the [`voxserv/audio_quality_testing_samples`](https://github.com/voxserv/audio_quality_testing_samples)
repository. Review that repository's source and Creative Commons license information
before redistributing the recordings. The files are ignored locally and are not
intended to be committed.

## Outputs

TTS writes `test/output/melotts-sample.mp3`. Do not commit generated audio or
recordings. Add `test/output/` and `test/audio/` to `.gitignore` if these files
will remain in the working tree.

## Tests not automated here

Free-tier eligibility and dashboard neuron usage must be checked in Cloudflare.
Better Auth latency cannot be measured until Better Auth is implemented.
