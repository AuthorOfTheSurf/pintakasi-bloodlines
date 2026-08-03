"use client";

/**
 * The Stewards' Office clock levers — advance the world without leaving the
 * browser. +1 Day ticks one day; +1 Week jumps to the next Friday inclusive
 * (the API's tickWeek semantics: bots play ONE closing day and ONE card
 * resolves, not seven). The dev farm's fixed key authenticates the call.
 */
import { useRouter } from "next/navigation";
import { useState } from "react";

interface TickSummary {
  clock: { dayIndex: number; date: string; isHatchFriday: boolean };
  fridays: { hatched: unknown[] }[];
  card: { fights: unknown[]; unmatched: unknown[]; claims: unknown[] }[];
  staking: { paidGp: number; stakers: number };
  error?: string;
}

export function TickControls() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<string | null>(null);

  async function tick(unit: "day" | "week") {
    setBusy(true);
    try {
      const res = await fetch(`/api/tick/${unit}?key=fk_dev`, { method: "POST" });
      const t = (await res.json()) as TickSummary;
      if (!res.ok) {
        setLast(`✗ ${t.error ?? "tick failed"}`);
        return;
      }
      const fights = t.card.reduce((s, l) => s + l.fights.length, 0);
      const unmatched = t.card.reduce((s, l) => s + l.unmatched.length, 0);
      const hatched = t.fridays.reduce((s, f) => s + f.hatched.length, 0);
      setLast(
        `${t.clock.date} — ${fights} fights, ${unmatched} unmatched, ` +
          `staking paid ${t.staking.paidGp.toFixed(2)} GP to ${t.staking.stakers}` +
          (t.fridays.length ? ` · HATCH FRIDAY (${hatched} hatched)` : "")
      );
      router.refresh();
    } catch (err) {
      setLast(`✗ ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ticks">
      <button onClick={() => tick("day")} disabled={busy}>
        +1 Day
      </button>
      <button onClick={() => tick("week")} disabled={busy}>
        +1 Week ▸ Fri
      </button>
      {last && <span className="tick-last">{last}</span>}
    </div>
  );
}
