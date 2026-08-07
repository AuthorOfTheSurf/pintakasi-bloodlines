import Link from "next/link";
import {
  BREED_SPLIT,
  CLAIMER,
  COVERS,
  ECONOMY,
  FIGHTS_PER_GROUP_BIRD,
  LAND,
  LT_CENTS,
  PINTAKASI,
  STAKER_FLOWS,
  fmtLt,
  landForFight,
  landForTournamentFight,
  stakePerFight,
} from "@/engine/config";
import { fmtGp } from "@/engine/events";

export const dynamic = "force-dynamic";

/** Daily-card land, per fighter — read live so the curve can't go stale. */
const CARD_MODES: { label: string; fee: number }[] = [
  { label: "Juvenile", fee: ECONOMY.JUVENILE_ENTRY_FEE },
  { label: "Real / Claimer", fee: ECONOMY.REAL_ENTRY_FEE },
];

/** Elimination grants, EARLIEST exit first — the fallen-weighted inversion. */
const ELIMINATION_STAGES: { label: string; grant: number }[] = [
  { label: "Round of 64 loser (earliest possible exit)", grant: PINTAKASI.LAND_GRANTS.r64 },
  { label: "Round of 32 loser", grant: PINTAKASI.LAND_GRANTS.r32 },
  { label: "Round of 16 loser", grant: PINTAKASI.LAND_GRANTS.r16 },
  { label: "Quarterfinal loser", grant: PINTAKASI.LAND_GRANTS.qf },
  { label: "Semifinal loser", grant: PINTAKASI.LAND_GRANTS.sf },
  { label: "Runner-up", grant: PINTAKASI.LAND_GRANTS.runnerUp },
  { label: "Champion", grant: PINTAKASI.LAND_GRANTS.champion },
];

/**
 * Land quantities live in HUNDREDTHS of a token since round 36 — every figure
 * on this page has to be divided down before it is printed, or the page says
 * "673 LT" for a night's fighting. `fmtLt` is for the curve's output, which is
 * genuinely fractional; this is for the knobs a human ruled as round numbers
 * (a 1,000 LT cap, a 100 LT stud seat), where two decimal places would only
 * add noise.
 */
const wholeLt = (cents: number) => (cents / LT_CENTS).toLocaleString();

export default function LandPage() {
  // The "fighting up pays more land" comparison, re-anchored in round 31 on the
  // two modes the daily card actually runs. It used to be measured against the
  // hardcore entry, which left the card that round — the curve is unchanged,
  // only the pair of points we quote on it.
  //
  // ⚠ THE SIGN OF THIS ONCE FLIPPED, and round 36 removed the mechanism that
  // let it. The history, because it explains why the branch below exists: land
  // used to be minted in WHOLE tokens with a floor of 1, so `ceil` was
  // load-bearing, and at the cheap end of a superlinear curve the rounding is
  // worth more than the exponent. Moving the juvenile night to 9 GP pushed
  // (9/8)^1.15 to 1.145, which `ceil` made TWO tokens — so the discovery year
  // paid 0.222 LT per GP against a real card's 0.167, the cheapest company in
  // the game paying the best land in it. Round 34 answered by moving
  // LAND.FEE_PER_TOKEN 8 → 9, which fixed the direction but cost a ~13%
  // haircut everywhere and would have broken again on the next fee change.
  // Round 36 cured the cause: land mints in hundredths, the rounding error is
  // two orders of magnitude smaller than the gap it was corrupting, and the
  // ordering now falls out of the exponent by itself — pinned in
  // lobbies.test.ts across every fee from 1 to 300. FEE_PER_TOKEN is back to 8
  // and the haircut is handed back.
  //
  // The branch below STAYS anyway, and deliberately. It is the right shape
  // regardless: a page that asserts "fighting up pays more per peso" while the
  // arithmetic says otherwise is exactly the confident nonsense the Handbook
  // exists to prevent. It reads the true branch now, and it stays as the
  // tripwire for whatever the next fee change does to a curve nobody re-checked.
  const realLandPerGp = landForFight(ECONOMY.REAL_ENTRY_FEE) / ECONOMY.REAL_ENTRY_FEE;
  const juvenileLandPerGp = landForFight(ECONOMY.JUVENILE_ENTRY_FEE) / ECONOMY.JUVENILE_ENTRY_FEE;
  const upFightingBonus = Math.round((realLandPerGp / juvenileLandPerGp - 1) * 100);
  // What the curve pays a juvenile entry before any rounding at all — kept so
  // the false branch can still show its work if the ordering ever inverts again.
  const juvenileRaw = Math.pow(ECONOMY.JUVENILE_ENTRY_FEE / LAND.FEE_PER_TOKEN, LAND.FIGHT_EXPONENT);
  const juvenileBetterPct = Math.round((juvenileLandPerGp / realLandPerGp - 1) * 100);
  const crownLand = landForTournamentFight(PINTAKASI.LAND_BASIS);

  // Every worked number below is computed from the live config, not typed —
  // so this page can never quietly go stale.
  const exampleClaimTag = CLAIMER.PRICES[2];
  const exampleClaimRakeCents = Math.round(exampleClaimTag * 100 * STAKER_FLOWS.CLAIM_RAKE);
  const exampleGachaCents = Math.round(ECONOMY.GACHA_ROLL_PRICE * 100 * STAKER_FLOWS.GACHA_SHARE);
  const exampleBreedCents = Math.round(ECONOMY.BREED_FEE * 100 * BREED_SPLIT.STAKER_SHARE);
  // DAILY_BUY_CAP is in hundredths; the price is quoted per 100 WHOLE tokens,
  // so the cap has to come back to tokens before it meets the price.
  const dailyBuyCapTokens = LAND.DAILY_BUY_CAP / LT_CENTS;
  const exampleLandPurchaseGp = Math.ceil((dailyBuyCapTokens * LAND.GP_PER_100_TOKENS) / 100);
  const exampleLandPurchaseCents = Math.round(
    exampleLandPurchaseGp * 100 * STAKER_FLOWS.LAND_PURCHASE_SHARE
  );

  // The worked pro-rata example — a clean pool and a clean stake, so the
  // arithmetic is easy to follow by hand.
  const poolGp = 500;
  const yourShareOfPool = 0.1;
  const yourPayoutGp = poolGp * yourShareOfPool;

  return (
    <>
      <h1>Land Tokens</h1>
      <p className="lede">
        Land Tokens (LT) are the second currency. You can earn LT and you can buy LT — but you can{" "}
        <strong>never sell it back</strong>. That is not a bug. Land only ever accumulates, so it
        behaves like a store of value instead of a trading chip. Nobody can dump it and crash it.
        The dream is that a stockpile of LT is worth real money one day. Whether that happens
        depends on the world staying busy — see &ldquo;Is it worth it?&rdquo; below.
      </p>

      <div className="callout warn">
        <b>One-way, permanently.</b> There is no sell button, no marketplace for LT, and no plan to
        add one. Every LT you ever hold, you keep. Buying it is a one-way door too — GP spent on
        land does not come back.
      </div>

      <h2>Every way to get land</h2>
      <p>
        Land is unconditional on the result — you get paid whether you win or lose — but it scales
        with what was at stake, and the curve underneath it is{" "}
        <strong>steeper than a straight line</strong>. Fighting &ldquo;up&rdquo; into dearer company
        is meant to pay disproportionately more land, not just more money — and at the big-money
        end, where the Majors live, it plainly does.
      </p>
      <p>
        On the daily card it is paid <strong>once per entry</strong>, when the night settles, and it
        is measured on the total your bird actually risked — not on what you paid at the door. One
        entry now buys a group of up to {FIGHTS_PER_GROUP_BIRD} fights (see{" "}
        <Link href="/wiki/card">The card</Link>), so a bird that fights its whole group is paid on
        the whole entry:
      </p>
      <div className="callout tip">
        <b>Land comes in fractions.</b> A night&apos;s fighting pays{" "}
        {fmtLt(landForFight(ECONOMY.REAL_ENTRY_FEE))} LT, not 7 — awards are minted in hundredths of
        a token, the same way GP is counted in centavos. That is new as of round 36, and it is there
        to keep the curve honest: when land only came in whole tokens, the rounding at the cheap end
        was worth more than the curve itself, and for one round the discovery year paid better land
        per peso than a real card did. Hundredths make the rounding too small to matter.
        <br />
        <br />
        The rule of thumb: <strong>you earn fractional land, you buy and stake round numbers</strong>
        . Fighting, the gacha and the crowns all mint decimals. Buying land, staking it and
        unstaking it are whole-token actions.
      </div>
      <p className="dim">
        Every land award also went slightly <em>up</em> this round, by roughly a seventh. Round 34
        had shaved them all — it raised the amount of GP one token costs, as a way of working
        around the rounding problem above. With the cause cured properly, that haircut is handed
        back.
      </p>
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>Mode</th>
              <th className="num">Entry fee</th>
              <th className="num">Full card of {FIGHTS_PER_GROUP_BIRD}</th>
              <th className="num">Short card of {FIGHTS_PER_GROUP_BIRD - 1}</th>
            </tr>
          </thead>
          <tbody>
            {CARD_MODES.map((m) => (
              <tr key={m.label}>
                <td>{m.label}</td>
                <td className="num">{m.fee} GP</td>
                <td className="num">{fmtLt(landForFight(m.fee))} LT</td>
                <td className="num">
                  {fmtLt(landForFight(stakePerFight(m.fee) * (FIGHTS_PER_GROUP_BIRD - 1)))} LT
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="dim">
        A short card pays less, and honestly so — the bird risked less. It happens when your
        bird&apos;s group held one of your own barn-mates, since two birds of one farm are never
        matched against each other and that fight is simply skipped.
      </p>
      {upFightingBonus > 0 ? (
        <p className="dim">
          A real entry costs {(ECONOMY.REAL_ENTRY_FEE / ECONOMY.JUVENILE_ENTRY_FEE).toFixed(1)}× a
          juvenile one, but it pays about {upFightingBonus}% more land <em>per GP staked</em>. That
          is the curve: every step up in stakes pays more than its share, and since round 36 that
          ordering holds at every price in the game — it is checked against every entry fee from 1
          to 300 GP. The steepest step of all is the Pintakasi Majors, below.
        </p>
      ) : (
        <p className="dim">
          One honest wrinkle, at these two particular prices. The rounding on the award is worth
          more than the curve down at the cheap end: the juvenile award works out at{" "}
          {juvenileRaw.toFixed(2)} before rounding and is paid as{" "}
          {fmtLt(landForFight(ECONOMY.JUVENILE_ENTRY_FEE))} LT. So per GP staked, the discovery
          year is actually the <em>better</em> land deal right now — about {juvenileBetterPct}%
          better. The curve underneath is still superlinear, and it shows properly once the stakes
          are big enough for the rounding to stop mattering: the Pintakasi Majors, below, are the
          steepest step of all. Card your one-year-olds; the land is cheap there.
        </p>
      )}

      <h3>The Pintakasi Majors pay even steeper</h3>
      <p>
        Every round of a Pintakasi Major mints land on a steeper curve than the daily card —{" "}
        {fmtLt(crownLand)} LT to each fighter, per fight, measured against the {PINTAKASI.LAND_BASIS} GP
        stake the Majors represent. A bird that survives several rounds banks that amount again and
        again before it ever gets to the elimination grants below.
      </p>
      <div className="callout tip">
        <b>
          That {PINTAKASI.LAND_BASIS} GP is not the entry fee, and the two are meant to differ.
        </b>{" "}
        A Major costs {PINTAKASI.ENTRY_FEE} GP to enter (see{" "}
        <Link href="/wiki/pintakasi">The Pintakasi</Link>). The {PINTAKASI.LAND_BASIS} GP here is a
        separate figure: what a crown fight is <em>worth in land</em>, set by how much a career is
        being risked, not by what the barn paid at the door. Land to the fallen only works if it is
        big, so it is priced against the risk.
      </div>
      <p className="dim">
        Every one of those per-fight awards is written into your ledger as its own line, round by
        round. So you can add up a Major night yourself and check it against your barn&apos;s land
        pile — every token in the world traces back to a line somebody can read.
      </p>
      <p>
        On top of the per-fight land, every eliminated bird collects a one-time grant the moment it
        falls — and the grants run <strong>backwards</strong>. The earliest exit pays the most:
      </p>
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>Stage</th>
              <th className="num">One-time land grant</th>
            </tr>
          </thead>
          <tbody>
            {ELIMINATION_STAGES.map((s) => (
              <tr key={s.label}>
                <td>{s.label}</td>
                {/* Grants live in the same hundredths as every other land
                    figure since round 36 — the farm's balance is credited with
                    this number directly, so it must be formatted, not printed
                    raw. */}
                <td className="num">{fmtLt(s.grant)} LT</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="dim">
        Every Major bout is hardcore — the loser&apos;s career ends there, and the Majors are the
        only place in the game a hardcore fight happens at all. The grant is the game&apos;s way of
        saying a first-round hardcore death is never a pure loss: the purse follows
        the wins, but the land goes to the fallen. The Wednesday Juvenile Championship mints
        per-fight land too, but off the much smaller juvenile entry fee — it&apos;s a discovery-year
        stage, not a Major, and losing one doesn&apos;t end a career. See{" "}
        <Link href="/wiki/pintakasi">The Pintakasi</Link> for both.
      </p>

      <h3>Gacha and buying outright</h3>
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>Source</th>
              <th className="num">LT</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Every gacha roll</td>
              <td className="num">{wholeLt(LAND.PER_GACHA_ROLL)} LT</td>
              <td>
                Free or paid — every roll pays land, whatever else drops. The{" "}
                {ECONOMY.BUNDLE_ROLLS}-roll bundle pays for all {ECONOMY.BUNDLE_ROLLS} of its rolls
                ({wholeLt(LAND.PER_GACHA_ROLL * ECONOMY.BUNDLE_ROLLS)} LT), banked as one line in
                your ledger rather than {ECONOMY.BUNDLE_ROLLS} separate ones.
              </td>
            </tr>
            <tr>
              <td>Buying land outright</td>
              <td className="num">{LAND.GP_PER_100_TOKENS} GP per 100 LT</td>
              <td>
                Capped at {wholeLt(LAND.DAILY_BUY_CAP)} LT per farm per game-day (
                {exampleLandPurchaseGp.toLocaleString()} GP to buy the whole cap). Buying is a
                whole-token action — you cannot buy a fraction of a token, only earn one.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>
        See <Link href="/wiki/gacha">The gacha</Link> for the roll odds and{" "}
        <Link href="/wiki/money">Golden Pesos</Link> for where GP itself comes from.
      </p>

      <div className="callout warn">
        <b>The one exception: a bird that never fights earns nothing.</b> If your bird was the only
        one entered in its lobby, it draws nobody, its entry fee is refunded in full — and it earns
        zero land. Land is for fighting, not queueing. That is the only way to come away with
        nothing now; any bird that got even one fight is paid on what it risked.
      </div>

      <h2>Spending it — the first sink</h2>
      <p>
        Until round 23, land only ever flowed one direction: earn it, buy it, stake it, collect the
        yield. There was nowhere to actually <strong>spend</strong> it — which meant its value was
        purely reflexive, backed by nothing but the promise of tomorrow&apos;s payout. The breeding
        barn changed that.
      </p>
      <div className="callout warn">
        <b>Standing a rooster at stud costs {wholeLt(COVERS.STUD_LISTING_LT)} LT.</b> Opening a
        retired rooster&apos;s public cover slots for the first time spends{" "}
        {wholeLt(COVERS.STUD_LISTING_LT)} Land Tokens outright — not staked, not refundable, gone. Re-listing him later, after pulling him
        from the barn, is free; the land bought the seat once, not a subscription. See{" "}
        <Link href="/wiki/breeding">Breeding</Link> for the full mechanic.
      </div>
      <p>
        Why a stud, of everything in the game: it&apos;s the best asset there is. It earns on every
        outside cover, it makes the birds, and its own owner still breeds through it on the
        reserved slots at nothing above the ordinary fee. A gate that desirable is worth paying
        land for — and it puts every barn in the same choice: stake land for yield, or spend it to
        open an income stream. That choice is exactly what a sink is for.
      </p>

      <h2>Staking — the heart of the page</h2>
      <p>
        Liquid LT just sits in your barn. <strong>Staked</strong> LT earns a pro-rata share of a
        shared pool, paid out to every staker every single game-day at the tick. &ldquo;Pro-rata&rdquo;
        means simply this: your share of today&apos;s payout equals your share of all the land
        currently staked, by anyone, in the whole game. Own 10% of the staked land in the world and
        you take home 10% of whatever the pool holds today. Nothing more complicated than that.
      </p>
      <p>Nearly every GP that changes hands in the game feeds that pool. Here is every inflow, computed live:</p>
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>What feeds the pool</th>
              <th className="num">Share</th>
              <th>Worked today</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Every claiming tag</td>
              <td className="num">{(STAKER_FLOWS.CLAIM_RAKE * 100).toFixed(0)}%</td>
              <td>
                A {exampleClaimTag} GP tag sends {fmtGp(exampleClaimRakeCents)} GP to the pool; the
                seller banks the rest. See <Link href="/wiki/claiming">Claiming</Link>.
              </td>
            </tr>
            <tr>
              <td>Every paid gacha roll</td>
              <td className="num">{(STAKER_FLOWS.GACHA_SHARE * 100).toFixed(0)}%</td>
              <td>
                A {ECONOMY.GACHA_ROLL_PRICE} GP roll sends {fmtGp(exampleGachaCents)} GP to the pool
                (free rolls send nothing — there&apos;s no GP to share).
              </td>
            </tr>
            <tr>
              <td>Every breed cover</td>
              <td className="num">{(BREED_SPLIT.STAKER_SHARE * 100).toFixed(0)}%</td>
              <td>
                The {ECONOMY.BREED_FEE} GP cover fee sends {fmtGp(exampleBreedCents)} GP to the pool
                before the stud owner and the fight-juice pool split the rest.
              </td>
            </tr>
            <tr>
              <td>Every land purchase</td>
              <td className="num">{(STAKER_FLOWS.LAND_PURCHASE_SHARE * 100).toFixed(0)}%</td>
              <td>
                Buying the full {wholeLt(LAND.DAILY_BUY_CAP)} LT daily cap costs{" "}
                {exampleLandPurchaseGp.toLocaleString()} GP — all {fmtGp(exampleLandPurchaseCents)} GP of it goes
                straight to the pool. When someone buys land, the people already holding it get
                paid for the dilution.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="dim">
        Missing from that list on purpose: the daily-card fight pot. It fed the pool at{" "}
        {(STAKER_FLOWS.FIGHT_RAKE * 100).toFixed(0)}% through round 22, but round 23 zeroed that
        rake — see <Link href="/wiki/card">The card</Link> — so today it contributes nothing. The
        plumbing stays wired at zero rather than removed, so a future season can turn it back on
        with one number.
      </p>

      <div className="callout tip">
        <b>A worked example.</b> Say the pool holds {poolGp} GP today, and your staked land is{" "}
        {(yourShareOfPool * 100).toFixed(0)}% of all the LT staked in the game. At tonight&apos;s
        tick you get {(yourShareOfPool * 100).toFixed(0)}% of {poolGp} GP — {yourPayoutGp.toFixed(2)}{" "}
        GP, credited straight to your wallet. Every other staker gets paid the exact same way, off
        the exact same pool, at the exact same moment.
      </div>
      <p className="dim">
        Payouts are floored to the whole cent per farm. Whatever fraction of a cent is left over
        after everyone is paid stays in the pool for tomorrow — it is never lost, and it is never
        somebody&apos;s to keep. If nobody is staking on a given day, the whole pool just waits.
      </p>

      <h2>Stake it immediately</h2>
      <div className="callout warn">
        <b>Liquid land earns nothing. None. Zero.</b> Staking costs nothing to do, and you can
        unstake any time you want your land back to spend or hold liquid. There is no reason —
        ever — to leave LT sitting unstaked in your barn. Every game-day it sits idle is a payout
        you didn&apos;t collect and can never get back. Stake it the moment you earn it.
      </div>
      <p className="dim">
        Staking and unstaking work in whole tokens, so the odd fraction on the end of your balance
        stays liquid until the next award rounds it up past the next whole number. It is not lost —
        it is just waiting to be staked with its neighbours.
      </p>

      <h2>Why the flows got wider</h2>
      <p>
        This used to be a thin loop. Staking once paid out of breed-cover fees only, and nothing
        else — and when the designer actually measured it, ten farms staking over 10,000 LT between
        them earned about 56 GP <em>combined</em>, across 35 game-days. That is not a reason to
        hold land. It is a reason to ignore it.
      </p>
      <p>
        The fix was not a bigger number on one flow — it was more flows. The claiming tag, the
        gacha spend, the breed cover, and every land purchase all pay the pool now. (Round 23
        pulled the fight pot back out again — see above — but the other flows are exactly why the
        pool survived that without going thin again.) The intent is plain: make land worth
        holding, so that players play <strong>for</strong> it, not just around it.
      </p>

      <h2>Is it worth it?</h2>
      <p>
        Honestly: land&apos;s value today comes from two places, not one — the yield stream above,
        and now a real sink (see &ldquo;Spending it,&rdquo; above). Neither one is a sure thing yet.
        A few things worth saying straight, not sold:
      </p>
      <ul>
        <li>
          The pool only grows if the world is busy. Empty lobbies and no claims and no covers mean
          an empty pool, and an empty pool pays nothing, however much you have staked.
        </li>
        <li>
          Every new LT minted — by fighting, by the gacha, by anyone buying land — dilutes
          everybody else&apos;s share of the same pool. Your 10% today can become 9% tomorrow if
          the total staked grows faster than your own stake does.
        </li>
        <li>
          There is no floor and no guarantee. The pool has been thin before (see above) and could
          be again if activity drops. What changed round 22 is how many taps feed it, not a promise
          about how full it stays.
        </li>
      </ul>
      <p>
        None of that changes the practical advice above — idle land still earns strictly less than
        staked land, always. It just means land is a bet on the game staying alive and busy, not a
        guaranteed annuity.
      </p>

      <div className="next">
        <Link href="/wiki/money">Golden Pesos →</Link>
        <Link href="/wiki/card">The card →</Link>
        <Link href="/wiki/pintakasi">The Pintakasi →</Link>
        <Link href="/wiki/gacha">The gacha →</Link>
      </div>
    </>
  );
}
