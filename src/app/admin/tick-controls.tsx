"use client";

/**
 * The Stewards' Office clock levers — advance the world without leaving the
 * browser. +1 Day ticks one day; +1 Week jumps to the next Friday inclusive
 * (the API's tickWeek semantics: ONE closing day plays and ONE card resolves,
 * not seven). Every stable plays its honest day — bots and player farms
 * alike (sim-era rule). The dev farm's fixed key authenticates the call.
 */
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FIGHTS_PER_GROUP_BIRD } from "@/engine/config";

interface TickSummary {
  clock: { dayIndex: number; date: string; isHatchFriday: boolean };
  fridays: { hatched: unknown[] }[];
  // One line per ENTRY since round 34 — a lobby entry buys a group of up to
  // three fights, so "how many fights went off" and "how many birds got a
  // full evening" are different questions and the toast answers both.
  card: {
    fights: unknown[];
    settlements: { fights: number; refunded: number }[];
    unmatched: unknown[];
    claims: unknown[];
  }[];
  pintakasi: { label: string; cancelled: boolean; champion: { bird: string } | null }[];
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
      // Read off the settlements, not `unmatched`: the two agree on the birds
      // that fought nothing, but only the settlements can tell a FULL card
      // from a SHORT one, and the short count is the round-34 number.
      const settlements = t.card.flatMap((l) => l.settlements ?? []);
      const full = settlements.filter((s) => s.fights >= FIGHTS_PER_GROUP_BIRD).length;
      const short = settlements.filter(
        (s) => s.fights > 0 && s.fights < FIGHTS_PER_GROUP_BIRD
      ).length;
      const unmatched = t.card.reduce((s, l) => s + l.unmatched.length, 0);
      const hatched = t.fridays.reduce((s, f) => s + f.hatched.length, 0);
      const crowns = (t.pintakasi ?? [])
        .map((p) => (p.cancelled ? `${p.label} cancelled` : `${p.champion?.bird} 👑 ${p.label}`))
        .join(", ");
      setLast(
        `${t.clock.date} — ${fights} fights · ${full} full cards, ${short} short, ` +
          `${unmatched} drew nobody · ` +
          `staking paid ${t.staking.paidGp.toFixed(2)} GP to ${t.staking.stakers}` +
          (t.fridays.length ? ` · HATCH FRIDAY (${hatched} hatched)` : "") +
          (crowns ? ` · PINTAKASI: ${crowns}` : "")
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
