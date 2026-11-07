# HTTP request — cinematic visual revision (v2)

> **Status:** revised *source* and metadata-only draft. **Real HyperFrames render and visual QA not yet verified.** The existing v1 render and files remain untouched.

## Why this revision exists

The original HTTP B-roll successfully proved **HTML/GSAP → HyperFrames → MP4**, but the first review identified too much miniature copy, panels, permanent headers/footers and general web/dashboard styling.

This revision follows [#30](https://github.com/yesvus/sahne/issues/30):

- **Intro:** very large editorial text and one highlight wipe.
- **Journey:** a simple three-node diagram (`Client → Gateway → Server`) animated by a traveling point rather than information cards. No constant UI chrome.
- **Outro:** a large, uncluttered illustrative `200 OK` response.
- **Channel color inputs:** `channelAccent`, `channelBackground`, `channelForeground` are HyperFrames-native composition variables and can be supplied from a pinned channel style. For project/template identity architecture, see `docs/channel-style-and-templates.md` once #29 lands.

Everything remains code-driven, deterministic in principle, **silent** and non-diffusion. This is **not yet** a recorded-narration video.

## Render locally when a workstation is available

Use upstream HyperFrames v0.9.20 and FFmpeg, as tested for the earlier v1. Work outside a Drive/rclone sync folder:

```bash
# From the Sahne repository root:
npm exec --yes --package=hyperframes@0.9.20 -- \
  hyperframes init sahne-cinematic-demo --example blank --skip-skills --non-interactive
cp examples/hyperframes/http-request-cinematic/index.html sahne-cinematic-demo/index.html

npm exec --yes --package=hyperframes@0.9.20 -- \
  hyperframes check sahne-cinematic-demo
npm exec --yes --package=hyperframes@0.9.20 -- \
  hyperframes render sahne-cinematic-demo --fps 30 --workers 2 \
  --output sahne-cinematic-demo/renders/http-flow-v2.mp4

ffprobe -v error \
  -show_entries format=duration:stream=codec_name,width,height,r_frame_rate \
  -of default=noprint_wrappers=1 sahne-cinematic-demo/renders/http-flow-v2.mp4
```

Expected authored settings: **1920×1080, 30 FPS, 14.5s**, if the renderer accepts the composition. These are *targets*, not yet verified output.

## Review checklist

- [ ] HyperFrames lint/check **actually passes**. Address real layout/contrast/motion findings.
- [ ] Play the MP4 and examine frames at the intro, each node arrival and outro.
- [ ] Confirm no tiny UI text, no accidental occlusion and enough reading time.
- [ ] Verify 14.5s, 1080p and 30fps with ffprobe.
- [ ] Archive the tested v2 under a **new** Drive folder / asset ID, not over the v1 render.
- [ ] User approves before `reviewStatus=approved` or automatic asset reuse.

### Deployment note

At the time the source was authored, the macOS workstation `zombie` was unreachable by SSH/Tailscale from `gurbet` (its Tailscale peer was offline). This is an *environment blocker*, not a passing visual QA test. Keep the PR unmerged until the real render has been checked.

The original silent v1 proof can be found in [the predecessor](../http-request/README.md).
