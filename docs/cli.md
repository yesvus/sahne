# Local Sahne CLI

The Sahne CLI is a thin, local wrapper around the existing Remotion CLI. It validates structured JSON before starting Chromium and encodes deterministic H.264 MP4 output.

## Requirements

- Node.js 22+, pnpm 10.20.0, a complete `pnpm install --frozen-lockfile`
- Chromium/browser support required by Remotion and FFmpeg support required for rendering
- Run commands from the **repository root**

## Validate a manifest

```sh
pnpm sahne validate examples/two-scenes.json
```

The example file uses Remotion's props wrapper:

```json
{
  "manifest": {
    "schemaVersion": 1,
    "scenes": [
      {
        "id": "example",
        "type": "metrics",
        "durationInFrames": 90,
        "props": {
          "schemaVersion": 1,
          "title": "Illustrative load",
          "subtitle": "Synthetic example, not measured data",
          "accentColor": "#4cc9f0",
          "metrics": [{"label": "Worker A", "value": 72}]
        }
      }
    ]
  }
}
```

Invalid JSON, unknown template types and invalid frame durations cause a nonzero exit code with field-level diagnostics.

## Render MP4

```sh
pnpm sahne render examples/two-scenes.json --output out/lesson.mp4
```

The default output is `out/sahne.mp4`. For a quick 30-frame inspection:

```sh
pnpm sahne render examples/two-scenes.json --output out/preview.mp4 --frames 0-29
```

`--frames` is a **zero-based, inclusive** interval and must be inside the manifest's total frame count. Output is 1920×1080 at 30fps with the H.264 codec. The CLI creates the output directory, delegates actual rendering to Remotion, and returns Remotion's exit code.

## Intentional limitations

This is not an asset manager or a video editor; it does not generate narration, synthesize footage, implement a queue, or run a remote worker. Scene templates remain code-defined and data is versioned JSON. Use `pnpm dev` for Remotion Studio preview.

The manifest file is subject to a 2MB size limit. Do not put secrets inside scene data: the renderer reads the same content. See [scene manifest contract](scene-manifest.md).
