"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { COVERS, LT_CENTS, STUD_PRICE } from "@/engine/config";
import type { StudMove } from "../api/farm/stud/route";
import type { RetiredRowUI } from "./data";

/**
 * The stud control for one retired rooster: stand him at stud, set or change
 * his cover price, pull him. Before this the only way to price a stud was to
 * ask Claude. Every rule stays in the engine (POST /api/farm/stud); this panel
 * only shows the bounds, the land and the waiting price so a player can see
 * the answer before pressing.
 */
export function StudPanel({
  bird,
  landTokensCents,
}: {
  bird: RetiredRowUI;
  landTokensCents: number;
}) {
  const posted = bird.studPrice ?? STUD_PRICE.FLOOR;
  // What the price will be once nothing is waiting: the box starts there.
  const target = bird.pendingPrice ?? posted;
  const [text, setText] = useState(String(target));
  const [sending, setSending] = useState(false);
  // The page re-renders from the server after each move, which takes a moment
  // on a big barn. Until it lands the panel still shows the old state, so it
  // stays busy: a press made on stale buttons wrote a price note that changed
  // nothing ("from 300 GP to 300 GP").
  const [refreshing, startRefresh] = useTransition();
  const router = useRouter();
  const busy = sending || refreshing;
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const priceId = useId();
  const hintId = useId();

  const price = Number(text);
  const valid = /^\d+$/.test(text) && price >= STUD_PRICE.FLOOR && price <= STUD_PRICE.CAP;
  // On a rooster not standing, a price posts at once and drops any price
  // still waiting (a stud pulled before the tick keeps his). So the box is
  // worth sending whenever it differs from what he posts, or whenever a
  // waiting price would otherwise post at the tick against the player's pick.
  const canSetUnlisted = price !== posted || bird.pendingPrice !== null;
  const seatLt = COVERS.STUD_LISTING_LT / LT_CENTS;
  const shortOfLand =
    !bird.listedStud && !bird.seatPaid && landTokensCents < COVERS.STUD_LISTING_LT;

  const send = async (move: StudMove, done: string) => {
    setSending(true);
    setStatus(null);
    try {
      const res = await fetch("/api/farm/stud", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(move),
      });
      const body: unknown = await res.json().catch(() => null);
      if (!res.ok)
        throw new Error(
          body && typeof body === "object" && "error" in body
            ? String(body.error)
            : `The server answered ${res.status}.`
        );
      setStatus({ ok: true, message: done });
      startRefresh(() => router.refresh());
    } catch (err) {
      setStatus({ ok: false, message: err instanceof Error ? err.message : String(err) });
    } finally {
      setSending(false);
    }
  };

  const list = () =>
    send(
      // Only a price that changes something goes with the listing, so
      // pressing List does not write a price note that changes nothing.
      { action: "list", birdId: bird.id, price: valid && canSetUnlisted ? price : undefined },
      `${bird.name} stands at stud${valid ? ` at ${price} GP a cover` : ""}.`
    );
  const priced = () => {
    if (!bird.listedStud) return `${bird.name} is priced at ${price} GP a cover.`;
    if (price === posted) return `${bird.name} stays at ${price} GP. The waiting price is dropped.`;
    return `${bird.name}'s new price, ${price} GP, starts at the next tick.`;
  };
  const setPrice = () => send({ action: "price", birdId: bird.id, price }, priced());
  const unlist = () =>
    send({ action: "unlist", birdId: bird.id }, `${bird.name} is off the stud list.`);

  return (
    <section className="panel" aria-label={`${bird.name} at stud`}>
      <h3>At stud</h3>
      <p style={{ margin: 0 }}>
        {bird.listedStud ? (
          <>
            {bird.name} is standing at stud. A cover costs <b>{posted} GP</b>.
          </>
        ) : (
          <>
            {bird.name} is not at stud.{" "}
            {bird.studPrice === null
              ? `He has no price yet, so he would stand at the ${STUD_PRICE.FLOOR} GP floor.`
              : `His price is ${posted} GP a cover.`}
          </>
        )}
        {bird.pendingPrice !== null && bird.pendingPrice !== posted ? (
          <>
            {" "}
            His new price, <b>{bird.pendingPrice} GP</b>, takes effect at the next tick.
          </>
        ) : null}
      </p>
      {bird.listedStud ? null : (
        <p className="dim" style={{ margin: ".3rem 0 0" }}>
          {bird.seatPaid
            ? "His stud seat is paid for already, so listing him again is free."
            : `Listing him costs ${seatLt} LT, once. You have ${(landTokensCents / LT_CENTS).toFixed(2)} LT loose.`}
        </p>
      )}

      <div className="row stud-row">
        <label htmlFor={priceId} className="price-field">
          Cover price (GP)
          <input
            id={priceId}
            type="number"
            inputMode="numeric"
            min={STUD_PRICE.FLOOR}
            max={STUD_PRICE.CAP}
            step={1}
            value={text}
            aria-invalid={!valid}
            aria-describedby={hintId}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Enter" || !valid || busy) return;
              e.preventDefault();
              // Enter only ever prices him. Listing spends land, so it takes
              // a press of its own button.
              if (bird.listedStud ? price !== target : canSetUnlisted) void setPrice();
            }}
          />
        </label>
        {bird.listedStud ? (
          <>
            <button
              type="button"
              className="btn"
              onClick={setPrice}
              disabled={busy || !valid || price === target}
            >
              Change price<small>Takes effect at the next tick</small>
            </button>
            <button type="button" className="btn ghost" onClick={unlist} disabled={busy}>
              Pull from stud<small>Covers already bought stand</small>
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className="btn"
              onClick={list}
              disabled={busy || !valid || shortOfLand}
            >
              List at stud
              <small>{bird.seatPaid ? "Free: seat already paid" : `Costs ${seatLt} LT once`}</small>
            </button>
            <button
              type="button"
              className="btn ghost"
              onClick={setPrice}
              disabled={busy || !valid || !canSetUnlisted}
            >
              Set price<small>Takes effect now</small>
            </button>
          </>
        )}
      </div>
      <p id={hintId} className={valid ? "dim" : "down"} style={{ margin: ".4rem 0 0" }}>
        {valid ? "" : "Enter a whole number. "}A price runs from {STUD_PRICE.FLOOR} to{" "}
        {STUD_PRICE.CAP.toLocaleString()} GP.{" "}
        {bird.listedStud
          ? "He is standing, so a new price waits for the next tick. Every buyer sees one price all day."
          : "He is not standing yet, so a new price takes effect at once."}
      </p>
      {shortOfLand ? (
        <p className="down" style={{ margin: ".3rem 0 0" }}>
          You need {seatLt} LT loose to list him. Unstake some, or earn more in the pit.
        </p>
      ) : null}
      {/* Always in the page, so a screen reader announces each new answer. */}
      <p className={status?.ok ? "up" : "down"} role="status" style={{ margin: ".4rem 0 0" }}>
        {status?.message ?? ""}
      </p>
    </section>
  );
}
