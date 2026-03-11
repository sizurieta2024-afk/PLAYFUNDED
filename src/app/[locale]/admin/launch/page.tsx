import {
  adminDeleteCountryPolicyOverride,
  adminSaveCountryPolicyOverride,
} from "@/app/actions/admin";
import {
  ALL_CHECKOUT_METHODS,
  ALL_MARKET_STATUSES,
  ALL_PAYOUT_METHODS,
  COUNTRY_POLICY_VERSION,
} from "@/lib/country-policy";
import {
  listRecentOpsEvents,
  listResolvedCountryPolicies,
  type ResolvedCountryPolicy,
} from "@/lib/country-policy-store";

type OpsEventRow = Awaited<ReturnType<typeof listRecentOpsEvents>>[number];
import { PLATFORM_POLICY, getPayoutWindowLabel } from "@/lib/platform-policy";

function renderCheck(value: boolean) {
  return value ? "Yes" : "No";
}

function formatBoolInputName(name: string) {
  return name;
}

export default async function AdminLaunchPage() {
  const [policies, recentOpsEvents] = await Promise.all([
    listResolvedCountryPolicies(),
    listRecentOpsEvents(50),
  ]);

  return (
    <div className="space-y-8 max-w-7xl">
      <div>
        <h1 className="text-2xl font-bold">Launch Readiness</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Internal checklist only. Policy version {COUNTRY_POLICY_VERSION}.
        </p>
      </div>

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground mb-1">Payout window</p>
          <p className="text-lg font-semibold">{getPayoutWindowLabel()}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground mb-1">Payout minimum</p>
          <p className="text-lg font-semibold">
            ${(PLATFORM_POLICY.payouts.minimumCents / 100).toFixed(2)}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground mb-1">Gift purchases</p>
          <p className="text-lg font-semibold">
            {PLATFORM_POLICY.commercial.giftPurchasesCardOnly
              ? "Card only"
              : "Enabled"}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground mb-1">Live betting</p>
          <p className="text-lg font-semibold">
            {PLATFORM_POLICY.trading.liveBettingAllowed ? "Allowed" : "Blocked"}
          </p>
        </div>
      </section>

      <section className="rounded-xl border border-border overflow-x-auto">
        <table className="w-full min-w-[1200px] text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              {[
                "Country",
                "Market",
                "Override",
                "Public",
                "Purchases",
                "Payouts",
                "Checkout",
                "Payout methods",
                "Legal",
                "PSP",
                "Copy",
                "KYC",
                "Affiliate",
                "Gifts",
                "Note",
              ].map((label) => (
                <th
                  key={label}
                  className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground whitespace-nowrap"
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {policies.map((policy: ResolvedCountryPolicy) => (
              <tr
                key={policy.country ?? "unknown"}
                className="border-b border-border last:border-0"
              >
                <td className="px-4 py-3 whitespace-nowrap font-medium">
                  {policy.displayName}
                </td>
                <td className="px-4 py-3 capitalize">{policy.marketStatus}</td>
                <td className="px-4 py-3">{renderCheck(policy.hasOverride)}</td>
                <td className="px-4 py-3">
                  {renderCheck(policy.publicAccess)}
                </td>
                <td className="px-4 py-3">
                  {renderCheck(policy.challengePurchasesEnabled)}
                </td>
                <td className="px-4 py-3">
                  {renderCheck(policy.payoutsEnabled)}
                </td>
                <td className="px-4 py-3">
                  {policy.checkoutMethods.length > 0
                    ? policy.checkoutMethods.join(", ")
                    : "-"}
                </td>
                <td className="px-4 py-3">
                  {policy.payoutMethods.length > 0
                    ? policy.payoutMethods.join(", ")
                    : "-"}
                </td>
                <td className="px-4 py-3">
                  {renderCheck(policy.launchChecklist.legalApproved)}
                </td>
                <td className="px-4 py-3">
                  {renderCheck(policy.launchChecklist.pspApproved)}
                </td>
                <td className="px-4 py-3">
                  {renderCheck(policy.launchChecklist.copyApproved)}
                </td>
                <td className="px-4 py-3">
                  {renderCheck(policy.launchChecklist.kycEnabled)}
                </td>
                <td className="px-4 py-3">
                  {renderCheck(policy.marketing.affiliateProgramEnabled)}
                </td>
                <td className="px-4 py-3">
                  {renderCheck(policy.marketing.giftsEnabled)}
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  {policy.reviewNote ?? "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Country Overrides</h2>
          <p className="text-sm text-muted-foreground">
            These forms write explicit country overrides to the database. Saving
            a row makes it editable without code changes. Reset removes the DB
            override and falls back to the static baseline.
          </p>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {policies.map((policy: ResolvedCountryPolicy) => (
            <form
              key={`${policy.country ?? "unknown"}-form`}
              action={adminSaveCountryPolicyOverride}
              className="rounded-xl border border-border bg-card p-4 space-y-4"
            >
              <input
                type="hidden"
                name="country"
                value={policy.country ?? ""}
              />
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold">
                    {policy.displayName}{" "}
                    {policy.country ? `(${policy.country})` : ""}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {policy.hasOverride
                      ? `Override active${policy.overrideUpdatedAt ? ` · updated ${policy.overrideUpdatedAt.toISOString()}` : ""}`
                      : "Using static baseline"}
                  </p>
                </div>
                {policy.country ? (
                  <button
                    formAction={adminDeleteCountryPolicyOverride.bind(
                      null,
                      policy.country,
                    )}
                    className="text-xs px-3 py-2 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors"
                  >
                    Reset
                  </button>
                ) : null}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1 text-xs">
                  <span className="text-muted-foreground">Display name</span>
                  <input
                    name="displayName"
                    defaultValue={policy.displayName}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  />
                </label>
                <label className="space-y-1 text-xs">
                  <span className="text-muted-foreground">Market status</span>
                  <select
                    name="marketStatus"
                    defaultValue={policy.marketStatus}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  >
                    {ALL_MARKET_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="space-y-1 text-xs block">
                <span className="text-muted-foreground">Review note</span>
                <textarea
                  name="reviewNote"
                  defaultValue={policy.reviewNote ?? ""}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm min-h-20"
                />
              </label>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                {[
                  ["publicAccess", "Public access", policy.publicAccess],
                  [
                    "challengePurchasesEnabled",
                    "Purchases",
                    policy.challengePurchasesEnabled,
                  ],
                  ["payoutsEnabled", "Payouts", policy.payoutsEnabled],
                  [
                    "requiresReviewNotice",
                    "Review notice",
                    policy.requiresReviewNotice,
                  ],
                  [
                    "showExactCommercialTerms",
                    "Exact terms",
                    policy.marketing.showExactCommercialTerms,
                  ],
                  [
                    "showProcessorNames",
                    "Processor names",
                    policy.marketing.showProcessorNames,
                  ],
                  [
                    "affiliateProgramEnabled",
                    "Affiliate",
                    policy.marketing.affiliateProgramEnabled,
                  ],
                  ["giftsEnabled", "Gifts", policy.marketing.giftsEnabled],
                  [
                    "legalApproved",
                    "Legal approved",
                    policy.launchChecklist.legalApproved,
                  ],
                  [
                    "pspApproved",
                    "PSP approved",
                    policy.launchChecklist.pspApproved,
                  ],
                  [
                    "copyApproved",
                    "Copy approved",
                    policy.launchChecklist.copyApproved,
                  ],
                  [
                    "kycEnabled",
                    "KYC enabled",
                    policy.launchChecklist.kycEnabled,
                  ],
                ].map(([name, label, checked]) => (
                  <label
                    key={String(name)}
                    className="rounded-lg border border-border px-3 py-2 flex items-center gap-2"
                  >
                    <input
                      type="checkbox"
                      name={formatBoolInputName(String(name))}
                      defaultChecked={Boolean(checked)}
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">
                  Checkout methods
                </p>
                <div className="flex flex-wrap gap-2 text-xs">
                  {ALL_CHECKOUT_METHODS.map((method) => (
                    <label
                      key={method}
                      className="rounded-lg border border-border px-3 py-2 flex items-center gap-2"
                    >
                      <input
                        type="checkbox"
                        name="checkoutMethods"
                        value={method}
                        defaultChecked={policy.checkoutMethods.includes(method)}
                      />
                      <span>{method}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">
                  Payout methods
                </p>
                <div className="flex flex-wrap gap-2 text-xs">
                  {ALL_PAYOUT_METHODS.map((method) => (
                    <label
                      key={method}
                      className="rounded-lg border border-border px-3 py-2 flex items-center gap-2"
                    >
                      <input
                        type="checkbox"
                        name="payoutMethods"
                        value={method}
                        defaultChecked={policy.payoutMethods.includes(method)}
                      />
                      <span>{method}</span>
                    </label>
                  ))}
                </div>
              </div>

              <button className="px-4 py-2 rounded-lg bg-pf-brand text-white text-sm font-semibold hover:bg-pf-brand/90 transition-colors">
                Save override
              </button>
            </form>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Recent Ops Events</h2>
          <p className="text-sm text-muted-foreground">
            Persisted operational events from checkout, webhooks, payouts, KYC,
            and admin actions.
          </p>
        </div>
        <div className="rounded-xl border border-border overflow-x-auto">
          <table className="w-full min-w-[960px] text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                {[
                  "Time",
                  "Level",
                  "Type",
                  "Source",
                  "Subject",
                  "Country",
                  "Details",
                ].map((label) => (
                  <th
                    key={label}
                    className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground whitespace-nowrap"
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recentOpsEvents.map((event: OpsEventRow) => (
                <tr
                  key={event.id}
                  className="border-b border-border last:border-0 align-top"
                >
                  <td className="px-4 py-3 whitespace-nowrap text-xs text-muted-foreground">
                    {event.createdAt.toISOString()}
                  </td>
                  <td className="px-4 py-3 capitalize">{event.level}</td>
                  <td className="px-4 py-3 font-medium">{event.type}</td>
                  <td className="px-4 py-3">{event.source ?? "-"}</td>
                  <td className="px-4 py-3 text-xs">
                    {event.subjectType && event.subjectId
                      ? `${event.subjectType}:${event.subjectId}`
                      : "-"}
                  </td>
                  <td className="px-4 py-3">{event.country ?? "-"}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground max-w-xl">
                    <pre className="whitespace-pre-wrap break-words font-mono">
                      {JSON.stringify(event.details, null, 2)}
                    </pre>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
