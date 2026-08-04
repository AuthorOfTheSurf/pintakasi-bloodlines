import Link from "next/link";
import { CLAIMER, ECONOMY, STAKER_FLOWS } from "@/engine/config";
import { fmtGp } from "@/engine/events";

export const dynamic = "force-dynamic";

export default function ClaimingPage() {
  return (
    <>
      <h1>Claiming</h1>
      <p className="lede">
        A claimer is an entry with a price tag on it. You put your own bird up to fight — and to
        be bought. Any other farm can pay the tag and take it home, but only after it&apos;s
        fought for you one last time.
      </p>

      <h2>What a claimer is</h2>
      <p>
        Entering a claimer costs the same entry fee as any real fight — {ECONOMY.REAL_ENTRY_FEE} GP
        — plus you set a separate tag price from the ladder below. The fee buys the fight; the tag
        is what you&apos;re willing to sell the bird for if somebody wants it. Anyone else&apos;s
        farm may then pay that exact tag to claim it.
      </p>

      <h2>The tag ladder</h2>
      <p>
        Five rungs, straddling the {ECONOMY.BREED_FEE} GP breed fee on purpose — two rungs
        cheaper than a cover, three dearer:
      </p>
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th className="num">Tag</th>
              <th className="num">≈ $</th>
              <th>Vs. the {ECONOMY.BREED_FEE} GP breed fee</th>
            </tr>
          </thead>
          <tbody>
            {CLAIMER.PRICES.map((price) => (
              <tr key={price}>
                <td className="num">{price} GP</td>
                <td className="num">${(price / ECONOMY.GP_PER_DOLLAR).toFixed(2)}</td>
                <td>{price < ECONOMY.BREED_FEE ? "cheaper than a cover" : "dearer than a cover"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>
        Claimer lobbies are keyed by tag price too, so a bird you enter at a given rung is pooled
        with — and drawn against — other birds tagged at that same rung. That&apos;s the real
        strategy: a cheap tag gets you an easier fight, because the field around it is thin, but
        anybody can buy your bird out from under you afterward for pocket change. A dear tag
        protects it — few farms will pay that much on a whim — but it also puts you in with
        whatever company chose to fight at that price, which tends to be the stronger birds.
      </p>

      <h2>The sequence</h2>
      <p>The order matters, and it&apos;s the same every time:</p>
      <ol>
        <li>You enter your bird into a claimer lobby at a tag price.</li>
        <li>
          Other farms place <strong>sealed claims</strong> — the tag amount escrows immediately,
          and you don&apos;t know how many claims are in, or from whom, until post time.
        </li>
        <li>The card goes off. Your bird fights for <strong>you</strong>, its original owner.</li>
        <li>
          You keep any prize money from the fight, win or lose — the claim hasn&apos;t settled yet.
        </li>
        <li>
          Only <strong>after</strong> the fight does the bird change hands. If nobody claimed it,
          nothing happens. If one farm claimed it, that farm gets the bird. If several farms
          claimed it, the RNG draws one winner — every losing claimant is refunded in full.
        </li>
      </ol>
      <div className="callout tip">
        <b>A claim can land at the last second.</b> Claims keep coming in right up until the card
        completes — a claim placed just before that moment either makes it onto the board or
        it&apos;s too late. Either way, the fight always happens before any bird actually moves.
      </div>

      <h2>The money</h2>
      <p>
        The selling barn banks the tag less a small staker rake — the same rake structure as a
        fight&apos;s pot, paid to the farms staking Land Tokens rather than to the house. The buyer
        always pays the full tag; the rake comes out of the sale, not on top of it.
      </p>
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th className="num">Tag</th>
              <th className="num">Staker rake</th>
              <th className="num">Seller banks</th>
            </tr>
          </thead>
          <tbody>
            {CLAIMER.PRICES.map((price) => {
              const tagCents = price * 100;
              const rakeCents = Math.round(tagCents * STAKER_FLOWS.CLAIM_RAKE);
              return (
                <tr key={price}>
                  <td className="num">{price} GP</td>
                  <td className="num">{fmtGp(rakeCents)} GP</td>
                  <td className="num">{fmtGp(tagCents - rakeCents)} GP</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="dim">
        The rake is {(STAKER_FLOWS.CLAIM_RAKE * 100).toFixed(0)}% of the tag — the seller keeps the
        rest. Nothing is ever printed here either; the rake is just GP moving from the sale into
        the staking pool.
      </p>

      <h2>Two more rules</h2>
      <ul>
        <li>
          <strong>An unmatched claimer still sells.</strong> If your bird draws no opponent — the
          odd bird out — its entry fee refunds, but any claim on it still settles. The sale
          doesn&apos;t need the fight.
        </li>
        <li>
          <strong>You can&apos;t claim your own bird, and the house never claims.</strong> Every
          claim is one farm buying from another. There is no bot on the other side of the escrow.
        </li>
      </ul>

      <div className="callout warn">
        <b>Entering a claimer means accepting the tag.</b> Once someone claims your bird, that
        decision is final — there&apos;s no buying it back, no outbidding, no cancelling. Only tag
        a bird at a price you&apos;re genuinely willing to let it go for.
      </div>

      <h2>What&apos;s next</h2>
      <p>
        A farm-to-farm marketplace is planned for birds outside the claiming system, using the
        same rake rule. It isn&apos;t built yet — claiming is the only way to buy or sell a bird
        today.
      </p>

      <div className="next">
        <Link href="/wiki/card">The card →</Link>
        <Link href="/wiki/money">Golden Pesos →</Link>
        <Link href="/wiki/land">Land Tokens →</Link>
      </div>
    </>
  );
}
