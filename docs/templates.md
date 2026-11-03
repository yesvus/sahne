# Reusable scene templates

Sahne uses **deterministic, code-driven** graphics, not text-to-video diffusion. A scene has a declared `type`, strict validated `props`, and an integer duration. Use the JSON in [examples/templates.json](../examples/templates.json) to experiment.

## Built-in templates (v1)

| Type | Purpose | Required props |
| --- | --- | --- |
| `title` | Kinetic word-by-word title reveal | `title`, `subtitle`, `eyebrow`, `accentColor` |
| `metrics` | Existing animated bar metrics (backward compatible) | `schemaVersion:1`, `title`, `subtitle`, `accentColor`, `metrics` |
| `stat` | Highlight one 0–100% metric and its progress bar | `title`, `subtitle`, `label`, `value`, `accentColor` |
| `comparison` | Compare two 0–100% metrics in cards | `title`, `subtitle`, `left`, `right`, `accentColor` |
| `diagram` | SVG graph and moving packet flow | `title`, `subtitle`, `accentColor`, `nodes`, `edges`, `packets`, `annotations` |

`left` and `right` each contain `{"label": "...", "value": 0..100}`.

All template props are strict. Numeric values for `stat` and `comparison` intentionally represent **percentages**. Do not assume arbitrary values (e.g. dollars) are valid percentages. Use realistic data only if independently verified and attributed.

## Preview and render

```sh
pnpm dev
pnpm render:templates
pnpm render:templates:smoke
```

The sample renders a 13-second, 390-frame video at 1920×1080/30fps. The smoke command renders frames 255–284, crossing the `stat` to `comparison` boundary. The example data is clearly labeled illustrative, not factual.

Each template derives motion from `useCurrentFrame()` and the **local scene duration**; seeking in Remotion Studio does not depend on playback history. Prefer existing `SceneCanvas`, `SceneHeader` and timing helpers.

## Adding a new template

1. Declare a strict Zod props schema and a discriminated scene variant in `src/manifest.ts`.
2. Implement a React component in `src/compositions/`, using shared visual primitives and frame-driven motion.
3. Add exhaustive dispatch in `SahneTimeline`. Preserve existing scene types and the v1 manifest version.
4. Add a JSON fixture and tests for malformed props and frame calculations.
5. Render and inspect beginning, middle, final frames and scene boundaries for clipping and factual claims.

The schema version remains `1` because adding a new scene type is backward compatible.

See [technical diagrams](diagrams.md) for graph-specific validation, geometry and timed annotations.
