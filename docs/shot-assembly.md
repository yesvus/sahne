# Assemble storyboard-aligned shots (first part of #50)

Sahne can now concatenate **already-rendered, silent, frame-aligned** H.264 MP4 shots into one visual film before the existing audio mix/mux steps. It uses the FFmpeg concat demuxer and `-c:v copy`: **no new renderer or NLE**. The input files are provided by HyperFrames, Remotion, Avenox or other approved sources, after normalizing footage upstream.

This is an incremental integration step, **not** automatic text-to-shot generation, shot caching, final editorial QA or a completed 3-minute video.

## Production command

In a private working directory, render each selected shot to exactly the beat's required duration, using uniform **1920×1080 yuv420p H.264 and the storyboard FPS**. All clips must be silent and use compatible encoder settings and MP4 time bases.

```bash
pnpm shots:assemble \
  /private/episode \
  /private/episode/storyboard.json \
  /private/episode/shot-files.json \
  /private/episode/outputs/silent-visual.mp4

# For voice or SFX, use the existing separate audio path:
pnpm audio:mix /private/episode /private/episode/storyboard.json \
  "/private/Asset Library" /private/episode/outputs/audio-master.wav

pnpm video:assemble /private/episode/storyboard.json \
  /private/episode/outputs/silent-visual.mp4 \
  /private/episode/outputs/audio-master.wav \
  /private/episode/outputs/final.mp4
```

Example shot map: [`examples/production/shot-files.sfx-only-en.sample.json`](../examples/production/shot-files.sfx-only-en.sample.json). It corresponds to the 14.5-second English SFX storyboard's three beats, but **the example clip paths are placeholders**, not included reusable assets. Store actual video files and private production data *outside GitHub*.

```json
{
  "schemaVersion": 1,
  "shots": [
    {"beatId": "intro", "visualPath": "rendered/intro.mp4"},
    {"beatId": "request-journey", "visualPath": "rendered/request-journey.mp4"},
    {"beatId": "response", "visualPath": "rendered/response.mp4"}
  ]
}
```

Shot order is the storyboard beat order; every beat needs exactly one clip. Each clip starts at its own time zero. The input storyboard must cover the whole production with **no gaps**; gap-filling and video overlays belong to a later editorial edit or an explicit rendered shot. The existing storyboard allows overlay beats and temporal gaps, but this command currently deliberately requires full coverage. It **does not** composite overlays onto an underlying video layer: overlay-treated beats must already be flattened into a full-frame shot.

## Checks and output

- Validate existing storyboard and shot-map schemas, unique ordered beat IDs, and timeline coverage after quantizing timecodes to output frames.
- Each referenced clip resolves inside the private project root (no path traversal or symlinks escaping that root); reject missing files, wrong codec/resolution/FPS, embedded audio and non-matching shot frame counts.
- Compare essential H.264 stream properties across shots; do not silently stretch, trim or re-encode clips to hide mismatches.
- Refuse to overwrite existing output or source inputs.
- Verify final MP4 video stream, duration and frame count; include ordered source hashes and timeline frames in machine-readable JSON. Hashes provide **input provenance**, not a completed renderer cache.
- The video remains **silent**: `pnpm audio:mix` and `pnpm video:assemble` are existing independent steps that add the correct language-specific narration or SFX. The final mux has an additional constant-frame-timing validation.

Existing FFmpeg concatenation is not a general editor. Not every MP4 from arbitrary cameras or stock sites has compatible H.264 SPS/PPS, time base or color settings. Normalize/approve media before using it as a shot; do not disable audio or licensing checks merely to force it through.

## Still needed for #50

1. Produce actual shots from template parameters, selected assets and a pinned channel/video project; this command currently **consumes completed clips**.
2. Record renderer/source/style fingerprints and cache successful **shot render jobs**. Reuse unchanged outputs when another shot changes; resume failed jobs without overwriting good intermediates.
3. Add real still-image, footage and motion-graphic examples in one episode, including explicit still→video conversion and approved media provenance.
4. Prove a genuine 3-minute episode, measure rendering, then a 10-minute project with restart/recovery tests.
5. Fully review the entire final film and captions; an MP4 technical probe cannot judge factual accuracy, pacing, speech clarity or rights.

Do not add cloud queues, a custom editor or a media database before the local workflow shows they are needed.
