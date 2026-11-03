# Technical diagram scenes

The `diagram` template draws validated nodes, directed edges and moving request/response packets with SVG. **No diffusion video generation and no custom canvas renderer.**

## Demonstration

```bash
pnpm render:diagram
pnpm render:diagram:smoke
```

The example `examples/diagram.json` shows a **12-second** client → gateway → server request, followed by a response moving in reverse along the same links. It deliberately contains illustrative labels, not observed network measurements. The diagram uses an explicit step timeline at the bottom.

## Data model

The `diagram` scene's props are:

- `title`, `subtitle`, `accentColor`
- `nodes`: 2–8 elements with unique `id`, short `label`, and normalized `x`/`y` coordinates. Usable horizontal range is 0.12–0.88 and vertical range is 0.15–0.85.
- `edges`: 1–12 directed connections with unique `id`, existing `from`/`to` node IDs and optional `label`.
- `packets`: 1–20 moving markers with `id`, `edgeId`, `startFrame`, `endFrame` and optional `reverse`. Movement is linear and deterministic.
- `annotations`: 1–8 ordered, non-overlapping caption intervals with `startFrame`, `endFrame`, `text`.

Intervals use half-open frame ranges `[startFrame, endFrame)`, bounded by the parent scene's `durationInFrames`. Endpoints, duplicate IDs, packet references, collisions and invalid intervals are rejected by the manifest schema.

## Visual and motion constraints

- SVG viewBox 1500×450; node geometry and edge clipping are deterministic.
- Packets travel only along validated graph edges. A reverse packet uses the same geometry in reverse and a contrasting color.
- Labels remain deliberately short; automatic edge routing, curved parallel links and collision-free text wrapping are out of scope.
- Use `src/diagram/geometry.ts` for layout geometry and unit-test it independently of Chromium.
- Preview first/last frames, packet motion and annotation intervals in Remotion Studio. Metadata tests cannot guarantee good visual composition.

To evolve the model, preserve the existing v1 scene variants. New diagrams with cycles, layout algorithms or 3D may warrant separate schema variants in a future version.
