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

- `public/brand/`
  - likely brand assets worth committing later if they are the chosen final set
- `automation/social/config/kai_character.json`
  - real social automation config
- `automation/social/config/`
  - broader social automation config folder that needs a deliberate review pass
- `scripts/social/build_kai_sora_job.mjs`
- `scripts/social/render_kai_sora_job.mjs`
  - real script entrypoints already referenced by `package.json`
- `scripts/purge-fixture-data.mjs`
  - useful production-safety/ops utility and a good candidate for a proper repo commit
- `docs/legal/playfunded-business-model-explainer-es.md`
- `docs/legal/playfunded-business-model-graphic-es.pdf`
- `docs/legal/playfunded-business-model-graphic-es.png`
- `docs/legal/playfunded-business-model-graphic-es.svg`
  - real lawyer-facing deliverables; keep visible until you decide whether they belong in the repo or should be archived externally
- `docs/ops/launch-status-recap-2026-05-12.md`
  - real operational recap and likely worth committing if it is still accurate
- `src/app/[locale]/(main)/empieza/`
- `src/app/api/bio-leads/`
- `src/components/landing/BioLeadCapture.tsx`
  - launch-adjacent product work that should not be bundled into unrelated deploys

Recommended next action for this bucket:

- commit only after a deliberate review pass
- do not bundle them into unrelated product deploys

## 3. Tracked files still dirty by design

- `.claude/plans/todo.md`
  - personal planning note; keep out of launch commits unless you intentionally want it versioned
- `docs/security/proof-based-validation-report.md`
  - real generated repo doc from the latest DB-backed proof run; safe to commit when you want docs synced to the latest verification state
- `automation/social/queues/slides_queue.json`
- `scripts/social/README.md`
- `scripts/social/build_slides.mjs`
- `scripts/social/tiktok_uploader.mjs`
  - tracked work already in motion; do not revert it casually, but keep it out of launch-only commits unless it is intentionally part of the release

## 4. Current launch-hardening files from 2026-05-13

These files are intentional results of the current pass and are safe to review as one focused launch-hardening change set:

- `package.json`
- `package-lock.json`
- `scripts/audit-launch-env.mjs`
- `docs/security/proof-based-validation-report.md`
- `docs/ops/launch-day-checklist.md`
- `docs/ops/production-readiness-audit-2026-05-13.md`

## Working Rule

Until launch:

- do not deploy from a dirty worktree
- either commit only the intended files
- or deploy from a clean exported snapshot, which is what we used for the recent production deploys
- when a pass must ship while unrelated work is still in progress, create a clean worktree from the intended commit and deploy from there
