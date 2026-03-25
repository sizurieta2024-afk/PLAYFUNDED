# Workspace Hygiene

Updated: 2026-03-25

This repo is now split into three buckets:

## 1. Local-only clutter hidden from Git status

These items were added to `.git/info/exclude`, not `.gitignore`, so the cleanup is local to this machine and does not change repo behavior for everyone else.

Hidden locally:

- root-level screenshot exports like `hero*.png`, `final-*.png`, `tier-*.png`
- `design-concepts/`
- `.claude/memory/`
- local-only Discord/admin helpers:
  - `scripts/discord-server-admin.mjs`
  - `scripts/discord-token-check.mjs`
- local-only email preview/send helpers:
  - `scripts/preview-emails.mjs`
  - `scripts/send-test-emails.mjs`

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
- `scripts/social/build_kai_sora_job.mjs`
- `scripts/social/render_kai_sora_job.mjs`
  - real script entrypoints already referenced by `package.json`
- `scripts/purge-fixture-data.mjs`
  - useful production-safety/ops utility and a good candidate for a proper repo commit

Recommended next action for this bucket:

- commit only after a deliberate review pass
- do not bundle them into unrelated product deploys

## 3. Tracked files still dirty by design

- `.claude/plans/todo.md`
  - personal planning note; keep out of launch commits unless you intentionally want it versioned
- `docs/security/proof-based-validation-report.md`
  - real generated repo doc from the latest proof run; safe to commit when you want docs synced to the latest verification state

## Working Rule

Until launch:

- do not deploy from a dirty worktree
- either commit only the intended files
- or deploy from a clean exported snapshot, which is what we used for the recent production deploys
