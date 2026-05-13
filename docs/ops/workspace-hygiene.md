# Workspace Hygiene

Updated: 2026-05-13

This repo is now split into three buckets:

## 1. Local-only clutter hidden from Git status

These items were added to `.git/info/exclude`, not `.gitignore`, so the cleanup is local to this machine and does not change repo behavior for everyone else.

Hidden locally:

- root-level screenshot exports like `hero*.png`, `final-*.png`, `tier-*.png`
- `.DS_Store` files
- `error.log`
- `design-concepts/`
- `automation/exports/`
- `.claude/memory/`
- local-only Discord/admin helpers:
  - `scripts/discord-server-admin.mjs`
  - `scripts/discord-token-check.mjs`
- local-only email preview/send helpers:
  - `scripts/preview-emails.mjs`
  - `scripts/send-test-emails.mjs`
- temporary social/browser helper scripts matching `scripts/social/*_tmp.mjs`

Why:

- they are useful for local iteration
- they are not part of the launch-critical app
- they were polluting `git status` and increasing accidental-commit risk

## 2. Real repo candidates still intentionally visible

These untracked items look like real product/tooling files and should stay visible until they are reviewed on purpose:

- `scripts/purge-fixture-data.mjs`
  - useful production-safety/ops utility and a good candidate for a proper repo commit
- `docs/legal/playfunded-business-model-explainer-es.md`
- `docs/legal/playfunded-business-model-graphic-es.pdf`
- `docs/legal/playfunded-business-model-graphic-es.png`
- `docs/legal/playfunded-business-model-graphic-es.svg`
  - real lawyer-facing deliverables; keep visible until you decide whether they belong in the repo or should be archived externally
- `docs/ops/launch-status-recap-2026-05-12.md`
  - real operational recap; commit separately from app/product changes if it is still accurate
- `scripts/social/build_reels_from_carousels.mjs`
  - real social automation helper; keep out of launch-only commits until the social pass is reviewed

Recommended next action for this bucket:

- commit only after a deliberate review pass
- do not bundle them into unrelated product deploys

## 3. Tracked files still dirty by design

- `.env.example`
  - social/Instagram env documentation work; review with the social automation pass before committing
- `automation/social/queues/slides_queue.json`
- `scripts/social/README.md`
- `scripts/social/build_slides.mjs`
- `scripts/social/tiktok_uploader.mjs`
  - tracked work already in motion; do not revert it casually, but keep it out of launch-only commits unless it is intentionally part of the release

## 4. Current launch-hardening files from 2026-05-13

The latest shipped launch-hardening commits are:

- `9700c4c`:
  - restored public affiliate landing/apply
  - restored approved-only affiliate dashboard tools
  - fixed localized metadata/canonical/OG URLs
  - kept affiliate out of sitemap discovery
- `8b3da64`:
  - aligned README and ops docs with the current launch posture
  - added controlled ops-alert workflow inputs
  - confirmed Vercel/GitHub env audit status
- `855506d`:
  - recorded controlled Discord alert proof
  - confirmed the latest CI and production deploy path

Current verified production state:

- `main` is the GitHub default branch for `sizurieta2024-afk/PLAYFUNDED`
- Vercel CLI account checks point to `sizurieta2024-4707`
- `playfunded.lat`, `/en`, `/pt-BR`, and all three affiliate routes returned HTTP 200
- CI, launch-smokes, and production deploy passed for `855506d`
- `/api/ops/health` returned green after the latest deploy

## Working Rule

Until launch:

- do not deploy from a dirty worktree
- either commit only the intended files
- or deploy from a clean exported snapshot, which is what we used for the recent production deploys
- when a pass must ship while unrelated work is still in progress, create a clean worktree from the intended commit and deploy from there
