#!/usr/bin/env node
// Reads npm audit --json from stdin.
// Exits 1 if any high/critical vulnerability is NOT covered by AUDIT_SUPPRESS.
// AUDIT_SUPPRESS: comma-separated GHSA IDs to ignore.

const suppressed = new Set(
  (process.env.AUDIT_SUPPRESS || "").split(",").filter(Boolean),
);

let raw = "";
process.stdin.on("data", (c) => (raw += c));
process.stdin.on("end", () => {
  const d = JSON.parse(raw);
  const vulns = d.vulnerabilities || {};

  // Collect all advisory IDs present in the entire report
  const allAdvisoryIds = new Set();
  for (const v of Object.values(vulns)) {
    for (const via of v.via || []) {
      if (typeof via === "object" && via.url) {
        const m = via.url.match(/GHSA-[a-z0-9-]+/i);
        if (m) allAdvisoryIds.add(m[0]);
      }
    }
  }

  // A vulnerability is suppressed if ALL root advisory IDs in its chain are suppressed.
  // For transitive vulns (via = string[]), we check if the root pkg's advisory is suppressed.
  // Simpler: if every advisory ID in the entire report is suppressed, all high vulns are covered.
  const unsuppressedAdvisories = [...allAdvisoryIds].filter(
    (id) => !suppressed.has(id),
  );

  if (unsuppressedAdvisories.length > 0) {
    // Check if there are any high/critical with unsuppressed advisories
    const highVulns = Object.entries(vulns).filter(([, v]) =>
      ["high", "critical"].includes(v.severity),
    );

    const actuallyUnsuppressed = highVulns.filter(([, v]) => {
      // Get all advisory IDs from this vuln's direct via entries
      const directIds = (v.via || [])
        .filter((x) => typeof x === "object" && x.url)
        .map((x) => {
          const m = x.url.match(/GHSA-[a-z0-9-]+/i);
          return m ? m[0] : null;
        })
        .filter(Boolean);
      // If this is a transitive vuln (all via are strings), skip — parent handles it
      if (directIds.length === 0) return false;
      return directIds.some((id) => !suppressed.has(id));
    });

    if (actuallyUnsuppressed.length > 0) {
      console.error(
        "Unfixed high/critical vulnerabilities:",
        actuallyUnsuppressed
          .map(([name, v]) => `${name} (${v.severity})`)
          .join(", "),
      );
      process.exit(1);
    }
  }

  const suppressedList = [...suppressed].join(", ");
  console.log(
    suppressedList
      ? `Audit passed. Suppressed advisories: ${suppressedList}`
      : "Audit passed.",
  );
});
