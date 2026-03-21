"use client";

import { useState, useTransition } from "react";
import {
  adminCreateAffiliate,
  adminMarkAffiliatePaid,
  setAffiliateActive,
  setAffiliateDiscountPct,
  setAffiliateRate,
} from "@/app/actions/admin";

interface AffiliateRow {
  id: string;
  code: string;
  commissionRate: "five" | "ten";
  discountPct: number;
  isActive: boolean;
  totalClicks: number;
  totalConversions: number;
  purchaseCount: number;
  uniqueCustomers: number;
  grossSales: number;
  discountsGiven: number;
  totalEarned: number;
  pendingPayout: number;
  user: { email: string; name: string | null };
}

function formatUSD(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export function AdminAffiliatesTable({
  affiliates,
}: {
  affiliates: AffiliateRow[];
}) {
  const [pending, startTransition] = useTransition();
  const [createEmail, setCreateEmail] = useState("");
  const [createRate, setCreateRate] = useState<"five" | "ten">("five");
  const [createDiscountPct, setCreateDiscountPct] = useState("10");
  const [createMessage, setCreateMessage] = useState<string>("");
  const [discountInputs, setDiscountInputs] = useState<Record<string, string>>(
    Object.fromEntries(
      affiliates.map((affiliate) => [affiliate.id, String(affiliate.discountPct)]),
    ),
  );

  function toggleRate(id: string, current: "five" | "ten") {
    const next: "five" | "ten" = current === "five" ? "ten" : "five";
    startTransition(async () => {
      await setAffiliateRate(id, next);
    });
  }

  function toggleActive(id: string, next: boolean) {
    startTransition(async () => {
      await setAffiliateActive(id, next);
    });
  }

  function saveDiscount(id: string) {
    startTransition(async () => {
      await setAffiliateDiscountPct(id, Number(discountInputs[id] ?? 0));
    });
  }

  function markPaid(id: string) {
    startTransition(async () => {
      await adminMarkAffiliatePaid(id);
    });
  }

  function createAffiliate() {
    startTransition(async () => {
      setCreateMessage("");
      const result = await adminCreateAffiliate(
        createEmail,
        createRate,
        Number(createDiscountPct),
      );
      if (result.error) {
        if (result.error === "affiliate_exists") {
          setCreateMessage(`Affiliate already exists: ${result.code}`);
          return;
        }
        setCreateMessage(result.error);
        return;
      }
      setCreateEmail("");
      setCreateDiscountPct("10");
      setCreateRate("five");
      setCreateMessage(result.code ? `Created code ${result.code}` : "Created");
    });
  }

  if (affiliates.length === 0) {
    return (
      <div className="space-y-6">
        <CreateAffiliateCard
          pending={pending}
          createEmail={createEmail}
          setCreateEmail={setCreateEmail}
          createRate={createRate}
          setCreateRate={setCreateRate}
          createDiscountPct={createDiscountPct}
          setCreateDiscountPct={setCreateDiscountPct}
          createAffiliate={createAffiliate}
          createMessage={createMessage}
        />
        <p className="text-sm text-muted-foreground py-8 text-center">
          No affiliates yet.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <CreateAffiliateCard
        pending={pending}
        createEmail={createEmail}
        setCreateEmail={setCreateEmail}
        createRate={createRate}
        setCreateRate={setCreateRate}
        createDiscountPct={createDiscountPct}
        setCreateDiscountPct={setCreateDiscountPct}
        createAffiliate={createAffiliate}
        createMessage={createMessage}
      />

      <div className="rounded-xl border border-border overflow-x-auto">
        <table className="w-full text-sm min-w-[1080px]">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              {[
                "Affiliate",
                "Code",
                "Status",
                "Commission",
                "Discount",
                "Clicks",
                "Purchases",
                "Customers",
                "Sales",
                "Discounts",
                "Earned",
                "Pending",
                "Actions",
              ].map((h) => (
                <th
                  key={h}
                  className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {affiliates.map((a) => (
              <tr key={a.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3">
                  <p className="font-medium text-foreground text-xs">
                    {a.user.name ?? "—"}
                  </p>
                  <p className="text-xs text-muted-foreground">{a.user.email}</p>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-pf-brand">
                  {a.code}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex px-2 py-0.5 rounded-md text-xs font-bold ${
                      a.isActive
                        ? "bg-pf-brand/15 text-pf-brand"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {a.isActive ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => toggleRate(a.id, a.commissionRate)}
                    disabled={pending}
                    className="inline-flex px-2.5 py-1.5 rounded-lg border border-border text-xs font-semibold text-foreground hover:bg-secondary disabled:opacity-50"
                  >
                    {a.commissionRate === "ten" ? "10%" : "5%"}
                  </button>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={discountInputs[a.id] ?? String(a.discountPct)}
                      onChange={(e) =>
                        setDiscountInputs((prev) => ({
                          ...prev,
                          [a.id]: e.target.value,
                        }))
                      }
                      className="w-16 rounded-lg border border-border bg-background px-2 py-1.5 text-xs"
                    />
                    <button
                      onClick={() => saveDiscount(a.id)}
                      disabled={pending}
                      className="text-xs px-2.5 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-secondary disabled:opacity-50"
                    >
                      Save
                    </button>
                  </div>
                </td>
                <td className="px-4 py-3 tabular-nums text-muted-foreground">
                  {a.totalClicks}
                </td>
                <td className="px-4 py-3 tabular-nums text-muted-foreground">
                  {a.purchaseCount}
                </td>
                <td className="px-4 py-3 tabular-nums text-muted-foreground">
                  {a.uniqueCustomers}
                </td>
                <td className="px-4 py-3 tabular-nums text-xs">
                  {formatUSD(a.grossSales)}
                </td>
                <td className="px-4 py-3 tabular-nums text-xs text-amber-400">
                  {formatUSD(a.discountsGiven)}
                </td>
                <td className="px-4 py-3 tabular-nums text-xs">
                  {formatUSD(a.totalEarned)}
                </td>
                <td className="px-4 py-3 tabular-nums text-xs text-amber-400">
                  {formatUSD(a.pendingPayout)}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      onClick={() => toggleActive(a.id, !a.isActive)}
                      disabled={pending}
                      className="text-xs px-2.5 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-50"
                    >
                      {a.isActive ? "Disable" : "Enable"}
                    </button>
                    {a.pendingPayout > 0 && (
                      <button
                        onClick={() => markPaid(a.id)}
                        disabled={pending}
                        className="text-xs px-2.5 py-1.5 rounded-lg bg-pf-brand/10 text-pf-brand border border-pf-brand/30 hover:bg-pf-brand/20 transition-colors disabled:opacity-50"
                      >
                        Mark Paid
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CreateAffiliateCard({
  pending,
  createEmail,
  setCreateEmail,
  createRate,
  setCreateRate,
  createDiscountPct,
  setCreateDiscountPct,
  createAffiliate,
  createMessage,
}: {
  pending: boolean;
  createEmail: string;
  setCreateEmail: (value: string) => void;
  createRate: "five" | "ten";
  setCreateRate: (value: "five" | "ten") => void;
  createDiscountPct: string;
  setCreateDiscountPct: (value: string) => void;
  createAffiliate: () => void;
  createMessage: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-foreground">Create affiliate</h2>
        <p className="text-xs text-muted-foreground mt-1">
          Affiliate codes are admin-managed only. Use an existing user email.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_110px_110px_auto]">
        <input
          type="email"
          value={createEmail}
          onChange={(e) => setCreateEmail(e.target.value)}
          placeholder="user@example.com"
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
        />
        <select
          value={createRate}
          onChange={(e) => setCreateRate(e.target.value as "five" | "ten")}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
        >
          <option value="five">5% commission</option>
          <option value="ten">10% commission</option>
        </select>
        <input
          type="number"
          min="0"
          max="100"
          value={createDiscountPct}
          onChange={(e) => setCreateDiscountPct(e.target.value)}
          placeholder="10"
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
        />
        <button
          onClick={createAffiliate}
          disabled={pending}
          className="rounded-lg bg-pf-brand text-white px-4 py-2 text-sm font-semibold hover:bg-pf-brand/90 disabled:opacity-50"
        >
          Create
        </button>
      </div>
      {createMessage ? (
        <p className="text-xs text-amber-400">{createMessage}</p>
      ) : null}
    </div>
  );
}
