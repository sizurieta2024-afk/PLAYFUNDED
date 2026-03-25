import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "crypto";

// Sentry → GitHub Codex autofix bridge.
//
// Sentry fires this endpoint when a new issue is created (alert rule).
// We validate the HMAC signature, extract error details, then trigger
// a GitHub repository_dispatch which kicks off the Codex autofix workflow.
//
// Required env vars:
//   SENTRY_WEBHOOK_SECRET  — client secret from Sentry Internal Integration
//   GH_DISPATCH_TOKEN      — GitHub PAT with repo scope (for repository_dispatch)
//   GITHUB_REPO            — e.g. "yourorg/playfunded"

function extractStackTrace(entries: unknown[]): string {
  if (!Array.isArray(entries)) return "";
  for (const entry of entries) {
    const e = entry as Record<string, unknown>;
    if (e.type === "exception") {
      const data = e.data as Record<string, unknown> | undefined;
      const values = data?.values as Array<Record<string, unknown>> | undefined;
      if (values?.[0]) {
        const exc = values[0];
        const st = exc.stacktrace as Record<string, unknown> | undefined;
        const frames = st?.frames as Array<Record<string, unknown>> | undefined;
        if (frames) {
          return frames
            .slice(-5)
            .map(
              (f) =>
                `  at ${f.function ?? "?"} (${f.filename ?? "?"}:${f.lineno ?? "?"})`,
            )
            .join("\n");
        }
      }
    }
  }
  return "";
}

function toTagMap(value: unknown): Record<string, string> {
  if (!Array.isArray(value)) return {};

  return value.reduce<Record<string, string>>((acc, tag) => {
    if (
      tag &&
      typeof tag === "object" &&
      "key" in tag &&
      "value" in tag &&
      typeof tag.key === "string" &&
      typeof tag.value === "string"
    ) {
      acc[tag.key] = tag.value;
    }
    return acc;
  }, {});
}

function extractEnvironments(
  payload: Record<string, unknown>,
  issue: Record<string, unknown>,
): string[] {
  const candidates = new Set<string>();
  const issueTags = toTagMap(issue.tags);

  if (issueTags.environment) {
    candidates.add(issueTags.environment.toLowerCase());
  }

  const data = payload.data as Record<string, unknown> | undefined;
  const event = data?.event as Record<string, unknown> | undefined;
  const eventTags = toTagMap(event?.tags);
  if (eventTags.environment) {
    candidates.add(eventTags.environment.toLowerCase());
  }

  const metadata = issue.metadata as Record<string, unknown> | undefined;
  const metadataEnvironment = metadata?.environment;
  if (typeof metadataEnvironment === "string") {
    candidates.add(metadataEnvironment.toLowerCase());
  }

  return [...candidates];
}

function isProductionIssue(environments: string[]) {
  if (environments.length === 0) return true;
  return environments.some((value) =>
    /(prod|production|live)/i.test(value),
  );
}

function shouldSkipAutofix(errorTitle: string, culprit: string, stackTrace: string) {
  const haystack = `${errorTitle}\n${culprit}\n${stackTrace}`.toLowerCase();
  const expectedNoise = [
    "payment_method_disabled",
    "country_not_available",
    "out_of_usage_credits",
    "quota",
    "credit limit",
    "disabled for launch",
    "mercado pago is disabled",
    "rate limit exceeded",
    "over request rate limit",
    "cron_failures",
  ];

  return expectedNoise.some((term) => haystack.includes(term));
}

async function hasOpenAutofixPr(
  ghToken: string,
  ghRepo: string,
  issueId: string,
) {
  const [owner, repo] = ghRepo.split("/");
  if (!owner || !repo) return false;

  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/pulls?state=open&head=${encodeURIComponent(
      `${owner}:codex/autofix-${issueId}`,
    )}`,
    {
      headers: {
        Authorization: `Bearer ${ghToken}`,
        Accept: "application/vnd.github.v3+json",
      },
    },
  );

  if (!response.ok) {
    const text = await response.text();
    console.warn("[sentry-webhook] Failed to query existing autofix PRs:", text);
    return false;
  }

  const pulls = (await response.json()) as Array<{ number: number }>;
  return pulls.length > 0;
}

export async function POST(request: NextRequest) {
  const body = await request.text();

  // ── Validate Sentry HMAC signature ──────────────────────────────────────
  const secret = process.env.SENTRY_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[sentry-webhook] SENTRY_WEBHOOK_SECRET not set");
    return NextResponse.json({ error: "Misconfigured" }, { status: 500 });
  }

  const sentrySignature = request.headers.get("sentry-hook-signature") ?? "";
  const expected = createHmac("sha256", secret).update(body).digest("hex");
  if (sentrySignature !== expected) {
    console.warn("[sentry-webhook] Invalid signature");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  // ── Only handle new issues ───────────────────────────────────────────────
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (payload.action !== "created") {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const data = payload.data as Record<string, unknown> | undefined;
  const issue = data?.issue as Record<string, unknown> | undefined;
  if (!issue) {
    return NextResponse.json({ error: "No issue in payload" }, { status: 400 });
  }

  const issueId = String(issue.id ?? "unknown");
  const errorTitle = String(issue.title ?? "Unknown error");
  const culprit = String(issue.culprit ?? "");
  const issueUrl = String(issue.permalink ?? "");
  const entries = (issue.entries as unknown[]) ?? [];
  const stackTrace = extractStackTrace(entries);
  const environments = extractEnvironments(payload, issue);

  if (!isProductionIssue(environments)) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: "non_production_issue",
      environments,
    });
  }

  if (shouldSkipAutofix(errorTitle, culprit, stackTrace)) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: "expected_operational_noise",
    });
  }

  // ── Trigger GitHub repository_dispatch ──────────────────────────────────
  const ghToken = process.env.GH_DISPATCH_TOKEN;
  const ghRepo = process.env.GITHUB_REPO; // e.g. "yourorg/playfunded"

  if (!ghToken || !ghRepo) {
    console.error("[sentry-webhook] GH_DISPATCH_TOKEN or GITHUB_REPO not set");
    return NextResponse.json({ error: "Misconfigured" }, { status: 500 });
  }

  if (await hasOpenAutofixPr(ghToken, ghRepo, issueId)) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: "autofix_pr_already_open",
      issue_id: issueId,
    });
  }

  const dispatchRes = await fetch(
    `https://api.github.com/repos/${ghRepo}/dispatches`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ghToken}`,
        Accept: "application/vnd.github.v3+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        event_type: "sentry-error",
        client_payload: {
          issue_id: issueId,
          error_title: errorTitle,
          culprit: culprit,
          issue_url: issueUrl,
          stack_trace: stackTrace,
          environment: environments[0] ?? "unknown",
        },
      }),
    },
  );

  if (!dispatchRes.ok) {
    const text = await dispatchRes.text();
    console.error("[sentry-webhook] GitHub dispatch failed:", text);
    return NextResponse.json(
      { error: "GitHub dispatch failed" },
      { status: 502 },
    );
  }

  console.info(
    `[sentry-webhook] Dispatched Codex autofix for issue ${issueId}: ${errorTitle}`,
  );
  return NextResponse.json({ ok: true, issue_id: issueId });
}
