import Link from "next/link";
import {
  BREED_SPLIT,
  CLAIMER,
  COVERS,
  ECONOMY,
  FIGHTS_PER_GROUP_BIRD,
  LAND,
  PINTAKASI,
  STAKER_FLOWS,
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

export default function LandPage() {
  // The "fighting up pays more land" comparison, re-anchored in round 31 on the
  // two modes the daily card actually runs. It used to be measured against the
  // hardcore entry, which left the card that round — the curve is unchanged,
  // only the pair of points we quote on it.
  //
  // ⚠ THE SIGN OF THIS CAN FLIP, and round 34 flipped it before catching it.
  // The curve is superlinear, but land is paid in WHOLE tokens with a floor of
  // 1, and at the cheap end the rounding can be worth more than the exponent.
  // Moving the juvenile night to 9 GP pushed (9/8)^1.15 to 1.145, which `ceil`
  // made TWO tokens — so for a few hours the discovery year paid 0.222 LT per
  // GP against a real card's 0.167, i.e. the cheapest company in the game paid
  // the best land in it. LAND.FEE_PER_TOKEN moved 8 → 9 to fix it at the
  // source; see its note in config.
  //
  // The branch below STAYS anyway, and deliberately. It was written when the
  // sign really was inverted, and it is the right shape regardless: a page that
  // asserts "fighting up pays more per peso" while the arithmetic says
  // otherwise is exactly the confident nonsense the Handbook exists to prevent.
  // Now it simply reads the true branch, and it will catch the next fee change
  // that trips the same rounding boundary without anybody noticing.
  const realLandPerGp = landForFight(ECONOMY.REAL_ENTRY_FEE) / ECONOMY.REAL_ENTRY_FEE;
  const juvenileLandPerGp = landForFight(ECONOMY.JUVENILE_ENTRY_FEE) / ECONOMY.JUVENILE_ENTRY_FEE;
  const upFightingBonus = Math.round((realLandPerGp / juvenileLandPerGp - 1) * 100);
  // What the curve would pay a real entry before whole-token rounding — the
  // honest way to show that the exponent is doing its job even when the floor
  // hides it at these two particular prices.
  const juvenileRaw = Math.pow(ECONOMY.JUVENILE_ENTRY_FEE / LAND.FEE_PER_TOKEN, LAND.FIGHT_EXPONENT);
  const juvenileBetterPct = Math.round((juvenileLandPerGp / realLandPerGp - 1) * 100);
  const crownLand = landForTournamentFight(PINTAKASI.LAND_BASIS);

  // Every worked number below is computed from the live config, not typed —
  // so this page can never quietly go stale.
  const exampleClaimTag = CLAIMER.PRICES[2];
  const exampleClaimRakeCents = Math.round(exampleClaimTag * 100 * STAKER_FLOWS.CLAIM_RAKE);
  const exampleGachaCents = Math.round(ECONOMY.GACHA_ROLL_PRICE * 100 * STAKER_FLOWS.GACHA_SHARE);
  const exampleBreedCents = Math.round(ECONOMY.BREED_FEE * 100 * BREED_SPLIT.STAKER_SHARE);
  const exampleLandPurchaseGp = Math.ceil((LAND.DAILY_BUY_CAP * LAND.GP_PER_100_TOKENS) / 100);
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
                <td className="num">{landForFight(m.fee)} LT</td>
                <td className="num">
                  {landForFight(stakePerFight(m.fee) * (FIGHTS_PER_GROUP_BIRD - 1))} LT
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
          is the curve: every step up in stakes pays more than its share. The steepest step of all
          is the Pintakasi Majors, below.
        </p>
      ) : (
        <p className="dim">
          One honest wrinkle, at these two particular prices. Land is minted in whole tokens and
          never rounds below 1, and down at the cheap end that rounding is worth more than the
          curve: the juvenile award works out at {juvenileRaw.toFixed(2)} before rounding and is
          paid as {landForFight(ECONOMY.JUVENILE_ENTRY_FEE)} LT. So per GP staked, the discovery
          year is actually the <em>better</em> land deal right now — about {juvenileBetterPct}%
          better. The curve underneath is still superlinear, and it shows properly once the stakes
          are big enough for the rounding to stop mattering: the Pintakasi Majors, below, are the
          steepest step of all. Card your one-year-olds; the land is cheap there.
        </p>
      )}

      <h3>The Pintakasi Majors pay even steeper</h3>
      <p>
        Every round of a Pintakasi Major mints land on a steeper curve than the daily card —{" "}
        {crownLand} LT to each fighter, per fight, measured against the {PINTAKASI.LAND_BASIS} GP
        stake the Majors represent. A bird that survives several rounds banks that amount again and
        again before it ever gets to the elimination grants below.
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
                <td className="num">{s.grant} LT</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="dim">
        Every Major bout is hardcore — the loser&apos;s career ends there, and the Majors are the
        only place in the game a hardcore fight happens at all. The grant is the game&apos;s way of
        saying a first-round hardcore death is never a pure loss: the money goes
        to the champion, but the land goes to the fallen. The Wednesday Juvenile Championship mints
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
              <td className="num">{LAND.PER_GACHA_ROLL} LT</td>
              <td>Free or paid — every roll pays land, whatever else drops.</td>
            </tr>
            <tr>
              <td>Buying land outright</td>
              <td className="num">{LAND.GP_PER_100_TOKENS} GP per 100 LT</td>
              <td>
                Capped at {LAND.DAILY_BUY_CAP.toLocaleString()} LT per farm per game-day (
                {Math.ceil((LAND.DAILY_BUY_CAP * LAND.GP_PER_100_TOKENS) / 100).toLocaleString()} GP
                to buy the whole cap).
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
        <b>Standing a rooster at stud costs {COVERS.STUD_LISTING_LT} LT.</b> Opening a retired
        rooster&apos;s public cover slots for the first time spends {COVERS.STUD_LISTING_LT} Land
        Tokens outright — not staked, not refundable, gone. Re-listing him later, after pulling him
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
                Buying the full {LAND.DAILY_BUY_CAP.toLocaleString()} LT daily cap costs{" "}
                {exampleLandPurchaseGp} GP — all {fmtGp(exampleLandPurchaseCents)} GP of it goes
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
