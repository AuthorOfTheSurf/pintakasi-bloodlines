import Link from "next/link";
import { CLAIMER, ECONOMY, LAND, PINTAKASI, STAKER_FLOWS } from "@/engine/config";
import { splitBreedFee } from "@/engine/breeding";
import { fmtGp } from "@/engine/events";

export const dynamic = "force-dynamic";

/** GP → dollars, at the peg. Every figure on this page runs through this. */
const usd = (gp: number) => (gp / ECONOMY.GP_PER_DOLLAR).toFixed(2);

const ENTRY_FEES: { label: string; fee: number }[] = [
  { label: "Juvenile entry", fee: ECONOMY.JUVENILE_ENTRY_FEE },
  { label: "Real entry", fee: ECONOMY.REAL_ENTRY_FEE },
  { label: "Hardcore entry", fee: ECONOMY.HARDCORE_ENTRY_FEE },
];

export default function MoneyPage() {
  // Worked example for the "cents" section: a claiming tag, rake-adjusted.
  // (The daily-card pot no longer rakes at all — see STAKER_FLOWS.FIGHT_RAKE.)
  const exampleClaimTag = CLAIMER.PRICES[2];
  const exampleClaimTagCents = exampleClaimTag * 100;
  const exampleClaimRakeCents = Math.round(exampleClaimTagCents * STAKER_FLOWS.CLAIM_RAKE);

  // The breed fee, split three ways — computed by the same function the
  // engine uses to pay it out, so this page can never drift from reality.
  const breedSplit = splitBreedFee(ECONOMY.BREED_FEE);
  const breedFeeCents = ECONOMY.BREED_FEE * 100;
  const breedStakerPct = ((breedSplit.stakerPoolCents / breedFeeCents) * 100).toFixed(1);
  const breedJuicePct = ((breedSplit.juicePoolCents / breedFeeCents) * 100).toFixed(1);
  const breedOwnerPct = ((breedSplit.studOwnerCents / breedFeeCents) * 100).toFixed(1);

  // The gacha spend split — same math the roll actually runs (gacha.ts).
  const gachaCents = ECONOMY.GACHA_ROLL_PRICE * 100;
  const gachaStakerCents = Math.round(gachaCents * STAKER_FLOWS.GACHA_SHARE);
  const gachaJuiceCents = gachaCents - gachaStakerCents;

  const realFightsPerDrip = Math.floor(ECONOMY.DAILY_DRIP / ECONOMY.REAL_ENTRY_FEE);
  const juvenileFightsPerDrip = Math.floor(ECONOMY.DAILY_DRIP / ECONOMY.JUVENILE_ENTRY_FEE);

  return (
    <>
      <h1>Golden Pesos</h1>
      <p className="lede">
        Golden Pesos (GP) are the money in the game. Every fee, every prize, every purchase moves
        in GP. This page is about where it comes from, where it goes, and the one promise the
        ledger keeps no matter what: nobody&apos;s GP appears from nowhere, and nobody&apos;s GP
        vanishes into nowhere either.
      </p>

      <h2>The peg</h2>
      <p>
        GP is pegged to the dollar at <strong>{ECONOMY.GP_PER_DOLLAR} GP = $1</strong>. No real
        money moves yet — the peg exists so every number in this game means something you can
        feel, not just a big scary integer.
      </p>
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>What</th>
              <th className="num">GP</th>
              <th className="num">≈ $</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>A new farm&apos;s starting stake</td>
              <td className="num">{ECONOMY.STARTING_GP}</td>
              <td className="num">${usd(ECONOMY.STARTING_GP)}</td>
            </tr>
            <tr>
              <td>The daily check-in drip</td>
              <td className="num">{ECONOMY.DAILY_DRIP}</td>
              <td className="num">${usd(ECONOMY.DAILY_DRIP)}</td>
            </tr>
            <tr>
              <td>A real-fight entry</td>
              <td className="num">{ECONOMY.REAL_ENTRY_FEE}</td>
              <td className="num">${usd(ECONOMY.REAL_ENTRY_FEE)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>
        So a new farm opens with about ${usd(ECONOMY.STARTING_GP)} to play with, and logging in
        every day tops that up by about ${usd(ECONOMY.DAILY_DRIP)} — plenty to keep fighting real
        cards at ${usd(ECONOMY.REAL_ENTRY_FEE)} a side, forever, without ever touching a wallet.
      </p>

      <h2>The one rule</h2>
      <div className="callout">
        <b>GP is never printed, and never burned.</b> Two moments mint new GP into the game, and
        exactly two: <strong>genesis</strong> — every farm&apos;s starting stake, plus a small seed
        of championship juice so the first Thursday has something worth winning — and the{" "}
        <strong>daily drip</strong>, forever after, because farms can&apos;t fund real accounts
        yet and the drip keeps everyone able to play. That&apos;s it. Every other GP movement in
        this game — a fight pot, a claim, a cover, a gacha roll, a land purchase — is just GP
        moving from one farm (or pool) to another. Nothing else creates it, and nothing destroys
        it.
      </div>
      <p>
        The game proves this to itself, every tick. GP in circulation is defined as one number:
        every farm&apos;s wallet, plus everything currently held in escrow, plus the two shared
        pools you&apos;ll meet below. That total can only move by a drip or a genesis mint — if it
        ever moved for any other reason, that would mean GP leaked out of the game somewhere, and
        the books would stop balancing to the cent. They don&apos;t. This is the trust story
        underneath everything else on this page: your GP is never quietly worth less because the
        house needed some.
      </p>

      <h2>Where GP goes</h2>
      <p>
        Every way to spend GP, read straight from the game&apos;s own settings — nothing here is
        typed by hand, so this table can&apos;t go stale:
      </p>
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>Spend</th>
              <th className="num">GP</th>
              <th className="num">≈ $</th>
            </tr>
          </thead>
          <tbody>
            {ENTRY_FEES.map((e) => (
              <tr key={e.label}>
                <td>{e.label}</td>
                <td className="num">{e.fee}</td>
                <td className="num">${usd(e.fee)}</td>
              </tr>
            ))}
            {CLAIMER.PRICES.map((price, i) => (
              <tr key={price}>
                <td>Claiming tag, rung {i + 1} of {CLAIMER.PRICES.length}</td>
                <td className="num">{price}</td>
                <td className="num">${usd(price)}</td>
              </tr>
            ))}
            <tr>
              <td>A breeding cover</td>
              <td className="num">{ECONOMY.BREED_FEE}</td>
              <td className="num">${usd(ECONOMY.BREED_FEE)}</td>
            </tr>
            <tr>
              <td>A paid gacha roll</td>
              <td className="num">{ECONOMY.GACHA_ROLL_PRICE}</td>
              <td className="num">${usd(ECONOMY.GACHA_ROLL_PRICE)}</td>
            </tr>
            <tr>
              <td>The {ECONOMY.BUNDLE_ROLLS}-roll gacha bundle</td>
              <td className="num">{ECONOMY.BUNDLE_PRICE}</td>
              <td className="num">${usd(ECONOMY.BUNDLE_PRICE)}</td>
            </tr>
            <tr>
              <td>Land Tokens, per 100 LT</td>
              <td className="num">{LAND.GP_PER_100_TOKENS}</td>
              <td className="num">${usd(LAND.GP_PER_100_TOKENS)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="dim">
        The Pintakasi Majors cost{" "}
        {PINTAKASI.ENTRY_FEE === 0 ? "nothing to enter — you earn a seat by winning, not by paying"
          : `${PINTAKASI.ENTRY_FEE} GP to enter`}. See <Link href="/wiki/pintakasi">The Pintakasi</Link>.
        Land is capped at {LAND.DAILY_BUY_CAP} LT bought per farm per game-day, and it is never
        sellable back — see <Link href="/wiki/land">Land Tokens</Link>. Standing a rooster at stud
        costs Land Tokens, not GP — see <Link href="/wiki/breeding">Breeding</Link>.
      </p>

      <h2>The two pools</h2>
      <p>
        Almost every spend above doesn&apos;t vanish — most of it, or a slice of it, lands in one
        of two shared pools. This is the part that confuses new farms, so slow down here.
      </p>
      <div className="cards-2">
        <div className="minicard">
          <b>The juice pool</b>
          <p>
            Funds the week&apos;s championships — see <Link href="/wiki/pintakasi">The Pintakasi</Link>.
            It fills from two places: {breedJuicePct}% of every breeding cover (the other half of
            what&apos;s left after the staker cut goes to the stud&apos;s owner), and{" "}
            {((gachaJuiceCents / gachaCents) * 100).toFixed(0)}% of every paid gacha roll. Wednesday&apos;s
            Juvenile Championship takes its slice first — the pool sends it a fixed share, split
            across whichever of its two blades run that week — and Thursday&apos;s Pintakasi Majors
            take the entire remainder, split evenly across however many Majors run, then paid out
            top-heavy by finish.
          </p>
        </div>
        <div className="minicard">
          <b>The staker pool</b>
          <p>
            Pays everyone with staked land, pro-rata, every single day — see{" "}
            <Link href="/wiki/land">Land Tokens</Link>. It skims from nearly every fee in the game:{" "}
            {(STAKER_FLOWS.CLAIM_RAKE * 100).toFixed(0)}% of every claim tag,{" "}
            {(STAKER_FLOWS.GACHA_SHARE * 100).toFixed(0)}% of gacha spend, {breedStakerPct}% of
            every breeding cover, and the entire GP price of every land purchase. The one thing it
            does <em>not</em> skim any more is the daily-card fight pot — round 23 zeroed that rake
            back to nothing, so a fight&apos;s pot is pure winner-takes-it-all.
          </p>
        </div>
      </div>
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>Inflow</th>
              <th className="num">Staker pool</th>
              <th className="num">Juice pool</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Daily-card fight pot (both entries)</td>
              <td className="num">{(STAKER_FLOWS.FIGHT_RAKE * 100).toFixed(0)}%</td>
              <td className="num">—</td>
            </tr>
            {STAKER_FLOWS.FIGHT_RAKE === 0 && (
              <tr>
                <td className="dim" colSpan={3}>
                  ↳ zeroed in round 23 — the daily card is a pure pot again; the plumbing stays
                  wired at 0% so a future season can turn it back on.
                </td>
              </tr>
            )}
            <tr>
              <td>Claiming tag</td>
              <td className="num">{(STAKER_FLOWS.CLAIM_RAKE * 100).toFixed(0)}%</td>
              <td className="num">—</td>
            </tr>
            <tr>
              <td>Breeding cover ({ECONOMY.BREED_FEE} GP)</td>
              <td className="num">{breedStakerPct}%</td>
              <td className="num">{breedJuicePct}%</td>
            </tr>
            <tr>
              <td>Paid gacha roll ({ECONOMY.GACHA_ROLL_PRICE} GP)</td>
              <td className="num">{(STAKER_FLOWS.GACHA_SHARE * 100).toFixed(0)}%</td>
              <td className="num">{((gachaJuiceCents / gachaCents) * 100).toFixed(0)}%</td>
            </tr>
            <tr>
              <td>Buying Land Tokens</td>
              <td className="num">{(STAKER_FLOWS.LAND_PURCHASE_SHARE * 100).toFixed(0)}%</td>
              <td className="num">—</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="callout tip">
        <b>The rest of a breeding cover</b> — the piece that isn&apos;t the {breedStakerPct}%
        staker cut or the {breedJuicePct}% juice share — goes straight to the stud&apos;s owner,
        {" "}{breedOwnerPct}% of the fee. On the {ECONOMY.BREED_FEE} GP cover that&apos;s{" "}
        {fmtGp(breedSplit.stakerPoolCents)} GP staker / {fmtGp(breedSplit.juicePoolCents)} GP juice
        / {fmtGp(breedSplit.studOwnerCents)} GP to whoever owns the stud. See{" "}
        <Link href="/wiki/breeding">Breeding</Link>.
      </div>
      <p className="dim">
        A marketplace rake is reserved in the settings ({(STAKER_FLOWS.MARKET_RAKE * 100).toFixed(0)}%)
        for a farm-to-farm bird market that isn&apos;t built yet. Fight pots and claim tags don&apos;t
        feed the juice pool at all today — that pool is fed only by breeding and the gacha.
      </p>

      <h2>Escrow</h2>
      <p>
        Entering a fight or placing a claim doesn&apos;t spend your GP — it <strong>holds</strong>{" "}
        it. The moment you enter a lobby, your entry fee moves out of your wallet and into escrow;
        the moment you place a claim, the tag price does the same. Nothing is actually paid out
        until the fight (or the claim draw) resolves. GP sitting in escrow still counts as GP in
        the game — it just isn&apos;t anyone&apos;s to spend yet.
      </p>
      <p>Escrow comes back to you, in full, in three cases:</p>
      <ul>
        <li>
          <strong>An unmatched bird.</strong> If your bird is the odd one out when a lobby closes,
          it draws no fight — your entry fee refunds in full. See{" "}
          <Link href="/wiki/card">The card</Link>.
        </li>
        <li>
          <strong>A lost claim draw.</strong> Several farms can claim the same bird at once; only
          one wins the RNG draw. Every losing claimant&apos;s tag refunds in full. See{" "}
          <Link href="/wiki/claiming">Claiming</Link>.
        </li>
        <li>
          <strong>A cancelled championship.</strong> If too few birds qualify for a Pintakasi
          bracket, the whole thing cancels and any entry escrowed for it refunds — moot today,
          since entry currently costs{" "}
          {PINTAKASI.ENTRY_FEE === 0 ? "nothing" : `${PINTAKASI.ENTRY_FEE} GP`}, but the machinery
          is there the day that changes.
        </li>
      </ul>

      <h2>Cents</h2>
      <p>
        Everywhere above, GP moves in whole numbers most of the time. It goes fractional in two
        kinds of places: a <strong>rake-adjusted amount</strong> and a{" "}
        <strong>staking payout</strong>. Both exist because a percentage of an odd number
        doesn&apos;t always land on a whole GP. (The daily-card fight pot used to be the classic
        example of the first kind — it isn&apos;t any more, now that its rake sits at{" "}
        {(STAKER_FLOWS.FIGHT_RAKE * 100).toFixed(0)}%. The claiming tag still rakes, so it&apos;s
        the live example below.)
      </p>
      <p>
        Take a {exampleClaimTag} GP claiming tag. The staker rake takes{" "}
        {(STAKER_FLOWS.CLAIM_RAKE * 100).toFixed(0)}% of that, {fmtGp(exampleClaimRakeCents)} GP —
        so the seller banks <strong>{fmtGp(exampleClaimTagCents - exampleClaimRakeCents)} GP</strong>,
        not the full tag. Staking payouts work the same idea but rarely land as clean: splitting
        the day&apos;s staker pool pro-rata across everyone&apos;s staked land, however oddly that
        land happens to be divided up — see <Link href="/wiki/land">Land Tokens</Link>. If your
        balance ever shows something like .40 or .78 on the end, that&apos;s why.
      </p>

      <h2>How to not go broke</h2>
      <p>
        The daily drip alone covers about <strong>{realFightsPerDrip} real-fight entries</strong>{" "}
        a day (or {juvenileFightsPerDrip} juvenile ones) — you cannot actually run out of GP to
        play with as long as you check in. The cheapest way to keep new birds coming without
        touching your wallet is the free gacha pull that check-in also grants: it costs nothing,
        it always mints a little land, and on the better tokens it drops a whole mystery egg. See{" "}
        <Link href="/wiki/gacha">The gacha</Link>. Save paid rolls and covers for when you&apos;re
        actually chasing stars or a specific element — the free pull is the floor everyone stands
        on.
      </p>

      <div className="next">
        <Link href="/wiki/land">Land Tokens →</Link>
        <Link href="/wiki/gacha">The gacha →</Link>
        <Link href="/wiki/breeding">Breeding →</Link>
      </div>
    </>
  );
}
