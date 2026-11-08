# ADR: Local-first JSON-to-composition workflow with a lightweight web control plane

Status: **proposed implementation direction, not yet deployed**. Decision recorded 2026-11-08 in [#72](https://github.com/yesvus/sahne/issues/72).

## Problem and decision

Sahne should turn **versioned project JSON into deterministic, editable video code** using templates and approved assets. It is not building a general-purpose nonlinear editor, and it will not ship a native macOS application.

The initial editor preference is the **open-source browser HyperFrames Studio**. Start with the upstream `hyperframes preview` workflow on the creator's machine, not with a homegrown timeline or an immediately public Studio server. HyperFrames has HTML/CSS/GSAP compositions, template variables, a local CLI, and the `@hyperframes/core` parsers and composition generator. Its Studio's individual React components need project/server context and are not drop-in widgets.

Treat Clipkit and FableCut as fallbacks only if a measured HyperFrames spike fails essential edit or import/export requirements. Do not fork multiple editors.

## Ownership and runtime boundaries

```text
sahne.yesvus.com (Gurbet: k3s / Traefik / Argo CD)
  Login | project index | revision/status | templates + asset metadata
  review/approval workflow | agent request queue | optional handoff bundles
               |
               | versioned JSON / manifest only (no implicit media upload)
               v
Creator's local machine
  private project + asset files
      |
      v
  Sahne Zod schema + typed JSON patches
      |
      v
  JSON -> pinned template compiler -> HyperFrames HTML/CSS/GSAP
      |                                    |
      |                                    v
      |                      upstream HyperFrames Studio / browser preview
      |                                    |
      +------------------------------------+
      v
  local HyperFrames CLI/producer, FFmpeg, per-shot cache
      |
      v
  local draft MP4 + QA -> explicit human approval -> optional private archive
```

**Gurbet is a control plane, not a renderer.** Never run user-supplied compositions in the web app pod, launch persistent Chromium workers in the cluster, or store raw videos, narration and cache there. Its current root disk is already constrained (read-only spot check on 2026-11-08: 81% used, ~38 GiB free; ~13 GiB available RAM). Deploy at most a small authenticated web/API service at first, through the existing k3s namespace + Traefik HTTPS + Argo CD GitOps path. Measure resource use before settling requests/limits. Reuse existing monitoring and storage instead of introducing new database, queue or orchestrator.

**Remote browser access does not automatically grant access to the creator's disk.** For v0, use a versioned bundle to exchange project JSON, selected asset references and editor settings, while HyperFrames Studio runs locally. A local loopback companion with explicit device pairing can be considered only when measured friction warrants it. Never expose a development file-write API or a local file server over public Ingress.

## The canonical contract

- A validated, versioned **Sahne project JSON** is the source of truth: project ID/revision, channel style version, FPS/canvas, ordered shot IDs and spans, template ID/version, typed variables, stable approved asset IDs, rights/provenance references, optional narration/SFX timing and QA decisions.
- An agent submits a **JSON patch** against an expected revision. Validate it and reject conflicting revisions, unapproved assets, timestamp/frame violations or template parameters outside the declared schema.
- A pure compiler converts the validated project to HyperFrames composition files. Reuse upstream `@hyperframes/core` generation, parser and lint facilities where practical, plus native composition variables (`data-composition-variables`, `data-variable-values`). Keep the compiler's output stable for the same project/template versions.
- **Templates are versioned code, not ad-hoc HTML generated on every render**. Prefer upstream registry blocks and existing Sahne fixtures. Assets are private reviewed binaries with IDs, hashes, sources and license evidence. Never convert a stock search result into an approved asset automatically.
- Manual Studio edits must not be silently destroyed by JSON regeneration. Either map the edit back into validated JSON (supported property/timeline changes) or mark the composition as a **versioned source override** and require explicit reconciliation before regenerating. Test round-trip behavior before committing to an embedded editor.
- Generated HTML can contain executable JavaScript/CSS and external resource references. Only locally trusted template source executes in v0; no arbitrary code execution service on Gurbet. A future hosted renderer requires isolated execution, strict resource/network/file boundaries and review.

## Minimal user-facing web stack

Use Next.js/React + shadcn/ui/Radix conventions (or a smaller React shell if measured simpler). No neon-themed custom UI. Initial screens: projects/revisions, template gallery with parameters, approved asset metadata, agent change proposals, timestamped human review, and export QA. Delegate actual playback/editing to upstream HyperFrames Studio/Player rather than duplicating its timeline and inspector.

The web deployment is not a requirement for the first verified 3-minute episode (#49). Avoid scope growth from dashboards or integrations.

## Delivery steps and gates

1. **Local proof**: use the existing approved still + B-roll + motion fixture from #69 to compile JSON into a HyperFrames composition, open it in Studio, edit a parameter and shot span, then render locally. Check FPS, duration, output codec, asset approvals, and version consistency.
2. **Edit round-trip**: demonstrate a human edit and an agent JSON patch on the same revision, with a conflict check, explicit source override policy, and non-lossy rollback.
3. **Web shell**: deploy a small authenticated project/review UI to `https://sahne.yesvus.com`. Prove HTTPS, auth, GitOps, resource measurements, media privacy and no renderer running on Gurbet.
4. **Local handoff**: only if necessary, design a loopback-only paired companion. A plain localhost dev server may not be securely reachable from a remote HTTPS origin in all browsers; do not assume automatic file access.
5. **Production QA**: verify a 3-minute edited episode with proper asset provenance and real watch-through before attempting ten-minute scale. Cache unchanged rendered shots by pinned template/asset/style inputs (#50).

## Explicit non-goals

No new video editor, no native macOS UI, no cloud renderer by default, no unnecessary Kubernetes workers, no video storage on Gurbet, no auto-publishing, no mandatory paid AI provider, and no implicit exposure of private content.

## References

- [HyperFrames Studio documentation](https://github.com/heygen-com/hyperframes/blob/main/docs/packages/studio.mdx)
- [HyperFrames core](https://github.com/heygen-com/hyperframes/tree/main/packages/core)
- [HyperFrames upstream repository](https://github.com/heygen-com/hyperframes)
- [#72: Web editor integration](https://github.com/yesvus/sahne/issues/72)
- [#50: Cached shot composition](https://github.com/yesvus/sahne/issues/50)
- [#52: Human review](https://github.com/yesvus/sahne/issues/52)
