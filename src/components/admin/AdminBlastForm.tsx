"use client";

import { useState, useTransition } from "react";
import { adminSendBlast } from "@/app/actions/admin";

type Segment = "all" | "active_challenge" | "funded";

const SEGMENT_LABELS: Record<Segment, string> = {
  all: "All users",
  active_challenge: "All active challenges",
  funded: "All funded",
};

export function AdminBlastForm({
  counts,
}: {
  counts: Record<Segment, number>;
}) {
  const [segment, setSegment] = useState<Segment>("all");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ count: number } | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [isPending, startTransition] = useTransition();

  const previewCount = counts[segment] ?? 0;

  function handleSend() {
    if (!confirmed) {
      setConfirmed(true);
      return;
    }
    setError(null);
    setResult(null);
    setConfirmed(false);
    startTransition(async () => {
      const res = await adminSendBlast(segment, subject, body);
      if (res.error) {
        setError(res.error);
      } else {
        setResult({ count: res.count });
        setSubject("");
        setBody("");
      }
    });
  }

  return (
    <div className="space-y-5">
      <div>
        <label className="text-xs text-muted-foreground block mb-1">
          Segment
        </label>
        <select
          value={segment}
          onChange={(e) => {
            setSegment(e.target.value as Segment);
            setConfirmed(false);
          }}
          className="w-full sm:w-64 px-3 py-2 rounded-lg border border-border bg-card text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-pf-pink/40"
        >
          {(Object.keys(SEGMENT_LABELS) as Segment[]).map((s) => (
            <option key={s} value={s}>
              {SEGMENT_LABELS[s]}
            </option>
          ))}
        </select>
        <p className="mt-1.5 text-xs text-muted-foreground">
          This will send to{" "}
          <span className="font-semibold text-foreground">{previewCount}</span>{" "}
          users.
        </p>
      </div>

      <div>
        <label className="text-xs text-muted-foreground block mb-1">
          Subject
        </label>
        <input
          type="text"
          value={subject}
          onChange={(e) => {
            setSubject(e.target.value);
            setConfirmed(false);
          }}
          placeholder="Email subject"
          className="w-full px-3 py-2 rounded-lg border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-pf-pink/40"
        />
      </div>

      <div>
        <label className="text-xs text-muted-foreground block mb-1">
          Message body
        </label>
        <textarea
          value={body}
          onChange={(e) => {
            setBody(e.target.value);
            setConfirmed(false);
          }}
          placeholder="Write your message..."
          rows={8}
          className="w-full px-3 py-2 rounded-lg border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-pf-pink/40 resize-none"
        />
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}
      {result && (
        <p className="text-sm text-pf-brand font-semibold">
          Blast sent to {result.count} users.
        </p>
      )}

      {confirmed && !isPending && (
        <p className="text-sm text-amber-400 font-medium">
          Are you sure? This will email {previewCount} users. Click Send again
          to confirm.
        </p>
      )}

      <button
        onClick={handleSend}
        disabled={isPending}
        className={`px-5 py-2 rounded-lg text-white text-sm font-semibold transition-colors disabled:opacity-50 ${
          confirmed
            ? "bg-red-500 hover:bg-red-600"
            : "bg-pf-pink hover:bg-pf-pink-dark"
        }`}
      >
        {isPending ? "Sending..." : confirmed ? "Confirm Send" : "Send blast"}
      </button>
    </div>
  );
}
