# Social Automation (Approve-First Mode)

This flow is built for your current setup:

- Content generated in batches (slides)
- TikTok upload assisted with Playwright
- You manually approve/post in browser

## 1. Queues

- Slides queue: `automation/social/queues/slides_queue.json`
- Analyst queue (scaffold): `automation/social/queues/analyst_queue.json`

Each slideshow item must include:

- `id`
- `account` (`slides`)
- `status` (`ready` or `draft`)
- `topic`
- `slides` (array of text slides)
- `caption`
- `hashtags` (array)
- `linkInBioCta`

## 2. Build slides (1080x1920 PNGs)

```bash
npm run social:slides:build -- --limit 10
```

Optional AI backgrounds (uses `OPENAI_API_KEY`):

```bash
npm run social:slides:build -- --limit 10 --ai-backgrounds true
```

Outputs are written to `automation/social/generated/slides/...`
and queue items move to `status: "rendered"`.

## 3. Save TikTok auth session

```bash
npm run social:tiktok:auth -- --account slides
```

This opens a persistent browser profile at:
`automation/social/state/tiktok-slides`

Log in once, solve checks manually, then press ENTER in terminal.

## 4. Upload a rendered batch

Auto-picks first rendered/pending item:

```bash
npm run social:tiktok:upload -- --account slides
```

Upload specific item:

```bash
npm run social:tiktok:upload -- --account slides --id slides-20260306-001
```

The script uploads assets and tries to fill caption.
You complete final review/post and confirm in terminal.

## Notes

- `headless` defaults to `false` for manual review.
- Logs are written to `automation/social/logs/social.log`.
- Generated media and browser state are ignored by git.
