# Storage and reusable assets

> Decision for the initial, personal video-production workflow. Google Drive folder creation is a **separate action**; this document does not imply it exists yet.

## Canonical systems of record

| Kind | Home | Reason |
| --- | --- | --- |
| Open-source Sahne code, docs, issues, generic schemas | Public `yesvus/sahne` GitHub repository | Versioned development and collaboration |
| Brainstorming conversation | ChatGPT | Exploration; not the durable index |
| Selected ideas and working scripts | Private Google Drive workspace | Easy review/editing with ChatGPT and large accessible storage |
| Raw voice, footage, music, B-roll binaries, previews, masters | Google Drive | Private archive of large files |
| Episode manifests and asset catalog metadata | **Private** project workspace, initially next to Drive media | Search/reproducibility without leaking unpublished work |
| Agent workspace and rendering cache | Local machine/temporary working directory | Processing; not authoritative storage |

**Do not commit unpublished scripts, personal recordings, private Drive identifiers/URLs, or large media to the public repository.** Use GitHub Issues for Sahne *engineering tasks*, not every video idea. Add a private production Git repo only once versioning/branching of episode manifests is demonstrably useful.

## Proposed Drive organization

```text
Sahne Production/
├── Ideas/
│   └── Idea Index (Google Doc)
├── Videos/
│   └── <yyyy-mm>-<episode-slug>/
│       ├── script.md (or Google Doc)
│       ├── voice-original.wav
│       ├── transcript.json
│       ├── storyboard.json
│       ├── project.json
│       ├── sources/              # editable visual source, footage, references
│       └── exports/              # previews and final master
└── Asset Library/
    └── <stable-asset-id>/
        ├── asset.json
        ├── source/               # editable original, if available
        └── renders/              # reusable transparent/video/image variants
```

This is **a convention, not a requirement to precreate every directory**. Start with Ideas, Videos and Asset Library; create per-video subfolders on demand. Do not depend on naming alone for machine discovery.

## Minimum asset catalog record

The catalog is a set of small JSON sidecars, not a database. Example with dummy values:

```json
{
  "schemaVersion": 1,
  "id": "asset-network-request-flow-v1",
  "title": "Client-server request flow",
  "description": "Animated request/response between client and service",
  "category": "motion-graphic",
  "tags": ["networking", "request", "response", "systems"],
  "kind": "editable-animation",
  "aspectRatio": "16:9",
  "durationMs": 6000,
  "rights": {
    "origin": "original",
    "license": "creator-owned",
    "attribution": null
  },
  "reviewStatus": "approved",
  "location": {
    "storage": "google-drive",
    "fileId": "<private-file-id>",
    "relativePath": "Asset Library/asset-network-request-flow-v1/"
  },
  "sha256": "<checksum-of-master-binary-or-source-archive>",
  "createdFrom": "example-video/project.json"
}
```

The above ID, values and file ID are examples, not a real uploaded asset. Keep actual private file IDs in the private catalog. A future public schema/example should remove access credentials, file identifiers and unpublished titles. For a real production asset, record owner, creation date and relevant source revision when known.

An episode manifest references **`asset-network-request-flow-v1`**, not a transient local pathname. Asset IDs should remain stable; use a new version/ID for materially changed output rather than silently overwriting a reused clip.

## Search, reuse and lifecycle

- Search initially by titles, tags, descriptions and rights status. Plain JSON files plus a small CLI index are sufficient.
- Prefer `approved` reusable assets; distinguish `draft`, `approved` and `retired` from project-only renders.
- Retain editable source (HTML/JS, Remotion component, SVG, etc.) when possible, plus the video/image export.
- Capture whether the asset is original, licensed stock, third-party, or AI-generated. **Do not assume a GitHub repository's contents grant rights to all example media.**
- Hash files for duplicate detection/integrity; keep the authoritative binary in Drive and use temporary local copies for rendering.
- Audit and update usage/references when an asset is reused; this helps identify high-value templates.
- Do not publish or share private Drive URLs as part of the public docs.

## What we deliberately postpone

No bespoke DAM, semantic/vector database, Drive auto-sync daemon, Google Sheets control plane, giant Git LFS repository, cloud render infrastructure or video-centric issue tracker before the first complete narrated video proves the need. Add stronger indexing and version control incrementally based on failures.

## Migration path if needed

When multiple productions or multiple people make manual catalog tracking painful, move *metadata only* to a private Git repository or database. Leave binary originals in Drive or another object store. Preserve stable asset IDs so project manifests survive that migration.

## Implemented local catalog CLI (v0)

The first asset-discovery slice reads **private local copies** of `*.asset.json` sidecar files. It does not call the Google Drive API or upload assets. You can download/sync an `Asset Library` folder outside this public repository and point the CLI to it:

```bash
pnpm assets:validate "/path/to/Sahne Production/Asset Library"
pnpm assets:search "/path/to/Sahne Production/Asset Library" "network request"
pnpm assets:search "/path/to/Sahne Production/Asset Library" "network request" --all
```

- `validate` recursively checks schema validity and rejects duplicate stable IDs; valid empty directories report `count: 0`.
- `search` matches all query words across title, tags and description, case-insensitively. It emits JSON for agent consumption; results are sorted by relevance. No semantic model or database is used.
- By default only `approved` assets with `cleared` rights are returned. `--all` is **for inspection**, not permission to reuse draft or unlicensed assets.
- The metadata location is either `{"kind":"local","relativePath":"..."}` or a **private** Google Drive reference. Any actual Drive file ID belongs in a private sidecar, never in the public repository.
- `editableSource` is an optional path relative to the asset's own workspace. Reference an asset by its stable `id` in future project manifests; catalog lookup should resolve that ID to its location.

Minimal metadata example (**illustrative only**, not an asset that has been produced or uploaded):

```json
{
  "schemaVersion": 1,
  "id": "client-request-flow-v1",
  "title": "Client-server request flow",
  "description": "Animated HTTP request-response explainer",
  "category": "motion-graphic",
  "tags": ["networking", "http", "request"],
  "reviewStatus": "draft",
  "rights": {
    "origin": "original",
    "clearance": "review-needed",
    "license": "creator-owned"
  },
  "location": {
    "kind": "local",
    "relativePath": "client-request-flow-v1/renders/overlay.webm"
  },
  "aspectRatio": "16:9",
  "durationMs": 6000
}
```

The earlier illustrative `asset.json` sketch above is a design example; the **validated `*.asset.json` schema** in `src/assets/catalog.ts` is the implementation contract. Assets are initially tracked manually; automatic indexing, tagging and synchronization will only be added when justified by real footage reuse.
