"use client";

import { useState, useTransition } from "react";
import { Clock, XCircle } from "lucide-react";
import { submitAffiliateApplication } from "@/app/actions/affiliate";

interface Application {
  id: string;
  status: string;
  reviewNote: string | null;
  createdAt: Date | string;
}

export function AffiliateApplyClient({
  application,
  t,
}: {
  application: Application | null;
  t: Record<string, string>;
}) {
  const [showForm, setShowForm] = useState(
    !application || application.status === "rejected",
  );
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [form, setForm] = useState({
    fullName: "",
    country: "",
    reason: "",
    tiktok: "",
    instagram: "",
    twitter: "",
    youtube: "",
    audienceSize: "" as
      | "under_1k"
      | "1k_5k"
      | "5k_20k"
      | "20k_plus"
      | "",
    website: "",
  });

  function set(key: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setError(null);
  }

  function handleSubmit() {
    if (
      !form.fullName.trim() ||
      !form.country.trim() ||
      form.reason.trim().length < 50
    ) {
      setError(t.submitError);
      return;
    }
    startTransition(async () => {
      const res = await submitAffiliateApplication({
        fullName: form.fullName,
        country: form.country,
        reason: form.reason,
        tiktok: form.tiktok || undefined,
        instagram: form.instagram || undefined,
        twitter: form.twitter || undefined,
        youtube: form.youtube || undefined,
        audienceSize: form.audienceSize || undefined,
        website: form.website || undefined,
      });
      if (res.error) {
        setError(t.submitError);
      } else {
        setSubmitted(true);
        setShowForm(false);
      }
    });
  }

  if (submitted || (application?.status === "pending" && !showForm)) {
    return (
      <div className="rounded-xl border border-pf-brand/20 bg-pf-brand/5 p-6 flex items-start gap-3">
        <Clock className="w-5 h-5 text-pf-brand shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-foreground">
            {t.applicationPending}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            {submitted ? t.submitSuccess : t.applicationPending}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {application?.status === "rejected" && !submitted && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-5 flex items-start gap-3">
          <XCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-foreground">
              {t.applicationRejected}
            </p>
            {application.reviewNote && (
              <p className="text-sm text-muted-foreground mt-1">
                {t.rejectionNote}: {application.reviewNote}
              </p>
            )}
            <p className="text-sm text-muted-foreground mt-1">{t.applyDesc}</p>
          </div>
        </div>
      )}

      {showForm && (
        <div className="rounded-xl border border-border bg-card p-6 space-y-5">
          {/* Basic info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {t.formFullName} *
              </label>
              <input
                type="text"
                value={form.fullName}
                onChange={(e) => set("fullName", e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-pf-pink/40"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {t.formCountry} *
              </label>
              <input
                type="text"
                value={form.country}
                onChange={(e) => set("country", e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-pf-pink/40"
              />
            </div>
          </div>

          {/* Why */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {t.formReason} *
            </label>
            <textarea
              value={form.reason}
              onChange={(e) => set("reason", e.target.value)}
              placeholder={t.formReasonPlaceholder}
              rows={4}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-pf-pink/40 resize-none"
            />
            <p className="text-xs text-muted-foreground">
              {form.reason.trim().length}/2000 (min 50 chars)
            </p>
          </div>

          {/* Social handles */}
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
              {t.formSocialTiktok.replace("TikTok", "Social")}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                {
                  key: "tiktok" as const,
                  label: t.formSocialTiktok,
                  placeholder: "@handle",
                },
                {
                  key: "instagram" as const,
                  label: t.formSocialInstagram,
                  placeholder: "@handle",
                },
                {
                  key: "twitter" as const,
                  label: t.formSocialTwitter,
                  placeholder: "@handle",
                },
                {
                  key: "youtube" as const,
                  label: t.formSocialYoutube,
                  placeholder: "Channel name or URL",
                },
              ].map(({ key, label, placeholder }) => (
                <div key={key} className="space-y-1">
                  <label className="text-xs text-muted-foreground">
                    {label}
                  </label>
                  <input
                    type="text"
                    value={form[key]}
                    onChange={(e) => set(key, e.target.value)}
                    placeholder={placeholder}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-pf-pink/40"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Audience size */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {t.formAudienceSize}
            </p>
            <div className="flex flex-wrap gap-2">
              {(["under_1k", "1k_5k", "5k_20k", "20k_plus"] as const).map(
                (size) => (
                  <button
                    key={size}
                    type="button"
                    onClick={() =>
                      set(
                        "audienceSize",
                        form.audienceSize === size ? "" : size,
                      )
                    }
                    className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                      form.audienceSize === size
                        ? "border-pf-brand bg-pf-brand/10 text-pf-brand"
                        : "border-border text-muted-foreground hover:border-pf-brand/40"
                    }`}
                  >
                    {size === "under_1k"
                      ? t.audienceUnder1k
                      : size === "1k_5k"
                        ? t.audience1k5k
                        : size === "5k_20k"
                          ? t.audience5k20k
                          : t.audience20kPlus}
                  </button>
                ),
              )}
            </div>
          </div>

          {/* Website */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {t.formWebsite}
            </label>
            <input
              type="url"
              value={form.website}
              onChange={(e) => set("website", e.target.value)}
              placeholder="https://yoursite.com"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-pf-pink/40"
            />
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <button
            onClick={handleSubmit}
            disabled={pending}
            className="w-full rounded-xl bg-pf-pink hover:bg-pf-pink-dark text-white font-semibold py-3 text-sm transition-colors disabled:opacity-50"
          >
            {pending ? t.formSubmitting : t.formSubmit}
          </button>
        </div>
      )}

      {!showForm && !submitted && application?.status !== "pending" && (
        <button
          onClick={() => setShowForm(true)}
          className="px-5 py-2.5 rounded-xl bg-pf-pink hover:bg-pf-pink-dark text-white text-sm font-semibold transition-colors"
        >
          {t.applyButton}
        </button>
      )}
    </div>
  );
}
