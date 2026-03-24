const BASE_URL = process.env.BASE_URL ?? "http://127.0.0.1:3001";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function fetchText(path, init) {
  const res = await fetch(`${BASE_URL}${path}`, init);
  const text = await res.text();
  return { res, text };
}

async function proveReviewHome() {
  const { res, text } = await fetchText("/en");
  assert(res.ok, `GET /en expected 200, got ${res.status}`);
  assert(
    text.includes(
      "Country availability, payout methods, affiliate access, and gift purchases can change while compliance review is still open.",
    ),
    "Home page did not render the review notice for default review markets.",
  );
  assert(
    text.includes("Country review"),
    "Home page did not switch the payout stat to review-safe wording.",
  );
}

async function proveAffiliateReviewGate() {
  const { res, text } = await fetchText("/en/affiliate");
  assert(res.ok, `GET /en/affiliate expected 200, got ${res.status}`);
  assert(
    text.includes(
      "Affiliate enrollment stays disabled until legal, processor, and copy approvals are complete for your market.",
    ),
    "Affiliate page did not render the review-market gate message.",
  );
  assert(
    !text.includes('href="/en/dashboard/affiliate"'),
    "Affiliate page still rendered the affiliate dashboard CTA in a review market.",
  );
}

async function proveLegalDisclosure() {
  const { res, text } = await fetchText("/en/legal");
  assert(res.ok, `GET /en/legal expected 200, got ${res.status}`);
  assert(
    text.includes("Payout review window") && text.includes("1-3 UTC"),
    "Legal page did not render the payout review window disclosure.",
  );
}

async function proveChallengeReviewNotice() {
  const { res, text } = await fetchText("/en/challenges");
  assert(res.ok, `GET /en/challenges expected 200, got ${res.status}`);
  assert(
    text.includes(
      "Payment methods and product availability may change while compliance review is ongoing in your country.",
    ),
    "Challenges page did not render the country review notice.",
  );
}

async function proveUsGeoBlock() {
  const res = await fetch(`${BASE_URL}/en`, {
    headers: { "x-vercel-ip-country": "US" },
    redirect: "manual",
  });
  assert(
    [302, 307, 308].includes(res.status),
    `US geo-block expected redirect status, got ${res.status}`,
  );
  const location = res.headers.get("location") ?? "";
  assert(
    location.includes("/auth/geo-blocked"),
    `US geo-block expected redirect to /auth/geo-blocked, got ${location || "<none>"}`,
  );
}

async function main() {
  const proofs = [
    ["review_home", proveReviewHome],
    ["affiliate_review_gate", proveAffiliateReviewGate],
    ["legal_disclosure", proveLegalDisclosure],
    ["challenge_review_notice", proveChallengeReviewNotice],
    ["us_geo_block", proveUsGeoBlock],
  ];

  for (const [name, fn] of proofs) {
    await fn();
    console.log(`PASS ${name}`);
  }
}

main().catch((error) => {
  console.error(`FAIL ${error.message}`);
  process.exit(1);
});
