import Link from "next/link";
import {
  ALL_ENTRY_FEES,
  BARN,
  BREED_SPLIT,
  CLAIMER,
  COVERS,
  ECONOMY,
  FIGHTS_PER_GROUP_BIRD,
  JUVENILE_MAJOR,
  LAND,
  LT_CENTS,
  PINTAKASI,
  STAKER_FLOWS,
  feeFor,
  fmtLt,
  nextExpansionCost,
  landForFight,
  landPotShare,
  stakePerFight,
} from "@/engine/config";
import { fmtGp } from "@/engine/events";

export const dynamic = "force-dynamic";

/**
 * Daily-card land at five rungs of the priced ladder (round 42) — every fee
 * read through `feeFor`, so the day a rung is re-priced this table re-prices
 * itself. It used to be two rows, "Juvenile" and "Real / Claimer", because
 * until round 42 there were only two prices in the whole game.
 */
const CARD_ROWS: { label: string; fee: number }[] = [
  {
    label: `Juvenile claimer, ${CLAIMER.PRICES[0]} GP tag`,
    fee: feeFor("juvenile", "claimer", CLAIMER.PRICES[0]),
  },
  { label: "Juvenile maiden", fee: feeFor("juvenile", "maiden") },
  { label: "Grown maiden or nw3", fee: feeFor("real", "maiden") },
  { label: "Juvenile open", fee: feeFor("juvenile", "open") },
  { label: "Grown open", fee: feeFor("real", "open") },
];

/**
 * ONE CROWN'S LAND POT, divided the way the bracket divides it: evenly across
 * every fight fought, so a bird's share is its own fights over all of them.
 * A full bracket of `bracketSize` runs `bracketSize − 1` fights and therefore
 * has twice that many fighter-slots. Rows are by FIGHTS FOUGHT, not by finish,
 * because that is genuinely what the pot pays on now — the champion and the
 * runner-up both fought every round, so they take the same land.
 */
function landByFights(potCents: number, bracketSize: number) {
  const fights = bracketSize - 1;
  const rounds = Math.log2(bracketSize);
  return Array.from({ length: rounds }, (_, i) => i + 1).map((mine) => ({
    mine,
    cents: landPotShare(potCents, fights * 2, mine),
  }));
}

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
  // The "fighting up pays more land" comparison, re-anchored in round 42 on the
  // two ends of ONE division's class ladder — a grown maiden against a grown
  // open. That is the comparison the round created and the one a player can act
  // on: same bird, same night, two prices. (It used to compare the two
  // DIVISIONS, which was the only pair of prices that existed before the ladder
  // was priced, and which no single bird could ever choose between.)
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
  const dearFee = feeFor("real", "open");
  const cheapFee = feeFor("real", "maiden");
  const dearLandPerGp = landForFight(dearFee) / dearFee;
  const cheapLandPerGp = landForFight(cheapFee) / cheapFee;
  const upFightingBonus = Math.round((dearLandPerGp / cheapLandPerGp - 1) * 100);
  // The same step said the other way: what the money multiplies by, against
  // what the land multiplies by. The second number has to be the bigger one.
  const feeMultiple = dearFee / cheapFee;
  const landMultiple = landForFight(dearFee) / landForFight(cheapFee);
  // What the curve pays the cheap rung before any rounding at all — kept so the
  // false branch can still show its work if the ordering ever inverts again.
  const cheapRaw = Math.pow(cheapFee / LAND.FEE_PER_TOKEN, LAND.FIGHT_EXPONENT);
  const cheapBetterPct = Math.round((cheapLandPerGp / dearLandPerGp - 1) * 100);
  // The whole span of the ladder, so the prose can quote the cheapest and
  // dearest nights without either being typed.
  const cheapestNight = Math.min(...ALL_ENTRY_FEES);
  const dearestNight = Math.max(...ALL_ENTRY_FEES);

  // ── The crowns' fixed land pots (round 42) ────────────────────────────────
  // One pot per crown, split across every fight fought. The worked table shows
  // a FULL bracket — since round 43 the cap itself is 32, so the full bracket
  // and the ordinary shape are the same thing (the old Math.min(32, cap) guard
  // died with the 64 cap it guarded against). The tiny bracket below it shows
  // the thin-field effect, which is the surprising half of the rule.
  const majorBracket = PINTAKASI.MAX_BRACKET;
  const majorLand = landByFights(PINTAKASI.LAND_POT, majorBracket);
  const majorTopFights = majorLand[majorLand.length - 1];
  const majorOneFight = majorLand[0];
  const thinBracket = 4;
  const thinLand = landByFights(PINTAKASI.LAND_POT, thinBracket);
  const thinOneFight = thinLand[0];
  const juvenileLand = landByFights(JUVENILE_MAJOR.LAND_POT, JUVENILE_MAJOR.MAX_BRACKET);

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
        <b>Land comes in fractions.</b> A grown maiden night pays{" "}
        {fmtLt(landForFight(cheapFee))} LT, not a round number — awards are minted in hundredths of
        a token, the same way GP is counted in centavos. That is there
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
        Every award on this page moved when the entry fees moved. Each class of fight has its own
        price now — a maiden night and an open night are no longer the same money (see{" "}
        <Link href="/wiki/ladder">Fighting up</Link>) — and since land is measured off what your bird
        risked, a dearer class simply mints more of it. That is the whole point of pricing the
        classes.
      </p>
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>A night at&hellip;</th>
              <th className="num">Entry fee</th>
              <th className="num">Full card of {FIGHTS_PER_GROUP_BIRD}</th>
              <th className="num">Short card of {FIGHTS_PER_GROUP_BIRD - 1}</th>
            </tr>
          </thead>
          <tbody>
            {CARD_ROWS.map((m) => (
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
        Those five are a sample, not the whole ladder — the daily card runs prices from{" "}
        {cheapestNight} GP up to {dearestNight} GP. <Link href="/wiki/ladder">Fighting up</Link> lists
        every rung and what each one mints.
      </p>
      <p className="dim">
        A short card pays less, and honestly so — the bird risked less. It happens when your
        bird&apos;s group held one of your own barn-mates, since two birds of one farm are never
        matched against each other and that fight is simply skipped.
      </p>
      {upFightingBonus > 0 ? (
        <p className="dim">
          A grown open night costs {feeMultiple.toFixed(1)}× a grown maiden night, but it mints{" "}
          {landMultiple.toFixed(1)}× the land — about {upFightingBonus}% more land{" "}
          <em>per GP staked</em>. That is the curve: every step up in class pays more than its share
          of the extra money you put in, and that ordering holds at every price in the game — it is
          checked against every entry fee from 1 to 300 GP. This is the reason to climb, and it has
          its own page: <Link href="/wiki/ladder">Fighting up</Link>.
        </p>
      ) : (
        <p className="dim">
          One honest wrinkle, at these two particular prices. The rounding on the award is worth
          more than the curve down at the cheap end: the cheaper award works out at{" "}
          {cheapRaw.toFixed(2)} before rounding and is paid as {fmtLt(landForFight(cheapFee))} LT. So
          per GP staked, the cheap rung is actually the <em>better</em> land deal right now — about{" "}
          {cheapBetterPct}% better, which is backwards and worth reporting. The curve underneath is
          still steeper than a straight line; it just needs bigger stakes before the rounding stops
          mattering.
        </p>
      )}

      <h3>The crowns pay one fixed pot</h3>
      <p>
        The championships do not use the curve above at all. Each crown has a{" "}
        <strong>fixed pot of land</strong> set in advance — {wholeLt(PINTAKASI.LAND_POT)} LT for a
        Pintakasi Major, {wholeLt(JUVENILE_MAJOR.LAND_POT)} LT for a Juvenile Championship — and that
        pot is divided <strong>evenly across every fight actually fought in the bracket</strong>. Your
        bird&apos;s share is simply its own fights divided by all of them.
      </p>
      <p>That one sentence has three consequences, and all three are meant:</p>
      <ul>
        <li>
          <strong>A deeper run earns more land.</strong> Two fights is twice one fight. Nothing is
          weighted, nothing is a bonus — it is just counting.
        </li>
        <li>
          <strong>A bye earns nothing.</strong> If the field was short and your bird skipped a round,
          that round bought it no land, because a bye is not a fight.
        </li>
        <li>
          <strong>A thin field pays each bird more.</strong> The pot is the same size whether{" "}
          {majorBracket} birds show up or {thinBracket} do, so a quiet crown divides the same land
          across far fewer fights. Turning up early, while a stage is still small, is rewarded.
        </li>
      </ul>
      <p>
        Here is a full {majorBracket}-bird Major, which runs {majorBracket - 1} fights in total:
      </p>
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th className="num">Fights your bird took</th>
              <th>Which birds those are</th>
              <th className="num">Land</th>
            </tr>
          </thead>
          <tbody>
            {majorLand.map((r) => (
              <tr key={r.mine}>
                <td className="num">{r.mine}</td>
                <td>
                  {r.mine === 1
                    ? "Lost its first fight"
                    : r.mine === majorLand.length
                      ? "The champion and the runner-up — both fought every round"
                      : `Won ${r.mine - 1}, then lost`}
                </td>
                {/* Pot shares are hundredths like every land figure since round
                    36 — format, never print raw. */}
                <td className="num">{fmtLt(r.cents)} LT</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="callout tip">
        <b>The champion and the runner-up take the same land.</b> Land counts{" "}
        <em>fights</em>, not wins — and both of them fought every round. The purse is what separates
        them (see <Link href="/wiki/pintakasi">The Pintakasi</Link>); the land does not care who won.
      </div>
      <div className="callout tip">
        <b>What a quiet crown is worth.</b> Take that same {wholeLt(PINTAKASI.LAND_POT)} LT pot and a
        field of only {thinBracket} birds. Now the bracket runs {thinBracket - 1} fights instead of{" "}
        {majorBracket - 1}, so losing your first fight pays {fmtLt(thinOneFight.cents)} LT — against{" "}
        {fmtLt(majorOneFight.cents)} LT in the full field. Same pot, fewer ways to split it. If a
        crown looks empty on the board, that is an argument for entering, not against.
      </div>
      <p className="dim">
        The Wednesday Juvenile Championship works exactly the same way off its own smaller pot: in a
        full bracket one fight pays {fmtLt(juvenileLand[0].cents)} LT and going all the way pays{" "}
        {fmtLt(juvenileLand[juvenileLand.length - 1].cents)} LT. Every share is written into your
        ledger as its own line, so you can add up a crown night yourself and check it against your
        barn&apos;s land pile — every token in the world traces back to a line somebody can read.
      </p>
      <p className="dim">
        This replaced two older rules at once, and it is worth knowing what is gone, because the old
        one was the opposite of this one. Crowns used to mint land per fight on their own separate
        curve <em>and</em> hand every eliminated bird a consolation grant that got{" "}
        <em>bigger the earlier it fell</em> — so a first-round loser could bank more land than the
        champion. Two scales that nobody had priced against each other. One pot cannot invert like
        that, because it is one division of one number. A first-round exit at a Major now simply takes
        the smallest share on the board — {fmtLt(majorOneFight.cents)} LT of a{" "}
        {wholeLt(PINTAKASI.LAND_POT)} LT pot, still a great deal of land — and the deep run is the one
        that pays most.
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

      <h2>The second sink — expanding the barn</h2>
      <p>
        A barn starts with {BARN.CAPACITY} slots and a full one refuses new covers, so any stable
        that breeds seriously will eventually need more room. Each expansion adds{" "}
        {BARN.EXPANSION_SLOTS} slots, and the price <strong>climbs</strong>: the first costs{" "}
        {wholeLt(nextExpansionCost(0))} LT, the second {wholeLt(nextExpansionCost(1))}, the third{" "}
        {wholeLt(nextExpansionCost(2))}, and so on. Like the stud seat, the land is spent outright
        — not staked, not refundable, gone.
      </p>
      <p>
        Why it climbs instead of sitting at one price: a leading stable earns four figures of land
        a day, so a flat price would stop being a decision after the first month. And why it
        matters that it&apos;s land: nearly all of a stable&apos;s tokens are normally staked, so
        expanding means unstaking — giving up that land&apos;s share of every future payout. The
        slots aren&apos;t the real price. The yield is.
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
        <Link href="/wiki/ladder">Fighting up →</Link>
        <Link href="/wiki/card">The card →</Link>
        <Link href="/wiki/pintakasi">The Pintakasi →</Link>
        <Link href="/wiki/gacha">The gacha →</Link>
      </div>
    </>
  );
}
