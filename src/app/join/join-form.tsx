"use client";

import { useState } from "react";
import { APPLICATION_LIMITS, FARM_COLORS, type FarmColor } from "@/engine/config";
import { SWATCH } from "./swatches";

type Phase = { kind: "editing"; error: string | null } | { kind: "sending" } | { kind: "sent" };

function Swatches({
  label,
  value,
  onPick,
}: {
  label: string;
  value: FarmColor;
  onPick: (c: FarmColor) => void;
}) {
  return (
    <div className="field" role="radiogroup" aria-label={label}>
      <span className="label">
        {label}: <span className="dim">{value}</span>
      </span>
      <div className="swatches">
        {FARM_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={c === value}
            aria-label={c}
            title={c}
            className={c === value ? "swatch on" : "swatch"}
            style={{ background: SWATCH[c] }}
            onClick={() => onPick(c)}
          />
        ))}
      </div>
    </div>
  );
}

export function JoinForm() {
  const [phase, setPhase] = useState<Phase>({ kind: "editing", error: null });
  const [primaryColor, setPrimary] = useState<FarmColor>("red");
  const [secondaryColor, setSecondary] = useState<FarmColor>("gold");

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const field = (name: string) => String(form.get(name) ?? "");
    setPhase({ kind: "sending" });
    try {
      const res = await fetch("/api/alpha/apply", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          farmName: field("farmName"),
          handler: field("handler"),
          contact: field("contact"),
          country: field("country"),
          background: field("background"),
          website: field("website"),
          primaryColor,
          secondaryColor,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setPhase({ kind: "editing", error: body.error ?? "Something went wrong. Try again." });
        return;
      }
      setPhase({ kind: "sent" });
    } catch {
      setPhase({ kind: "editing", error: "Could not reach the server. Try again." });
    }
  }

  if (phase.kind === "sent")
    return (
      <div className="callout tip">
        <b>You&apos;re on the list.</b> Thanks for applying. A steward will reach out about the
        buy-in. When your farm is ready, you will get a private link to your welcome page.
      </div>
    );

  return (
    <form className="form" onSubmit={submit}>
      <div className="field">
        <label htmlFor="farmName">Farm name</label>
        <input id="farmName" name="farmName" required maxLength={APPLICATION_LIMITS.farmName} />
        <span className="hint">Every other player sees this. It has to be unique.</span>
      </div>
      <div className="field">
        <label htmlFor="handler">Your name</label>
        <input id="handler" name="handler" required maxLength={APPLICATION_LIMITS.handler} />
      </div>
      <div className="field">
        <label htmlFor="contact">How can we reach you?</label>
        <input id="contact" name="contact" required maxLength={APPLICATION_LIMITS.contact} />
        <span className="hint">Email, phone, or a chat handle. Only the stewards see it.</span>
      </div>
      <div className="field">
        <label htmlFor="country">Country (optional)</label>
        <input
          id="country"
          name="country"
          maxLength={APPLICATION_LIMITS.country}
          placeholder="🇵🇭"
        />
      </div>
      <Swatches label="First color" value={primaryColor} onPick={setPrimary} />
      <Swatches label="Second color" value={secondaryColor} onPick={setSecondary} />
      <div className="field">
        <label htmlFor="background">Your breeding background (optional)</label>
        <textarea id="background" name="background" maxLength={APPLICATION_LIMITS.background} />
        <span className="hint">New to it? That&apos;s fine. Just say so.</span>
      </div>
      {/* The honeypot: off-screen and skipped by keyboards, so only a bot fills it. */}
      <div className="honey" aria-hidden="true">
        <label htmlFor="website">Website</label>
        <input id="website" name="website" tabIndex={-1} autoComplete="off" />
      </div>
      {phase.kind === "editing" && phase.error && <p className="error">{phase.error}</p>}
      <button className="submit" type="submit" disabled={phase.kind === "sending"}>
        {phase.kind === "sending" ? "Sending…" : "Apply for a farm"}
      </button>
    </form>
  );
}
