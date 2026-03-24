"use client";

import { useState, useTransition } from "react";
import { adminSendUserEmail } from "@/app/actions/admin";

export function AdminSendMessageForm({ userId }: { userId: string }) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSend() {
    setError(null);
    setSuccess(false);
    startTransition(async () => {
      const result = await adminSendUserEmail(userId, subject, body);
      if (result.error) {
        setError(result.error);
      } else {
        setSuccess(true);
        setSubject("");
        setBody("");
      }
    });
  }

  return (
    <section>
      <h2 className="text-base font-semibold mb-3">Send Message</h2>
      <div className="rounded-xl border border-border bg-card p-5 space-y-3">
        <div>
          <label className="text-xs text-muted-foreground block mb-1">
            Subject
          </label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Email subject"
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-pf-pink/40"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">
            Message
          </label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write your message..."
            rows={5}
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-pf-pink/40 resize-none"
          />
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        {success && (
          <p className="text-sm text-pf-brand font-semibold">
            Message sent successfully.
          </p>
        )}
        <button
          onClick={handleSend}
          disabled={isPending}
          className="px-4 py-2 rounded-lg bg-pf-pink hover:bg-pf-pink-dark text-white text-sm font-semibold transition-colors disabled:opacity-50"
        >
          {isPending ? "Sending..." : "Send"}
        </button>
      </div>
    </section>
  );
}
