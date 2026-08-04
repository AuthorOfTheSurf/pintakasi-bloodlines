import Link from "next/link";
import {
  BARN,
  ECONOMY,
  GACHA_BIRDS,
  GACHA_TOKENS,
  GACHA_WEIGHTS,
  LAND,
  STAKER_FLOWS,
  STATS,
  type GachaToken,
} from "@/engine/config";
import { fmtGp } from "@/engine/events";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "The gacha — The Pintakasi Handbook",
  description: "Odds, prices, where the money goes, and the honest cost of a mystery egg.",
};

export default function GachaPage() {
  const totalWeight = Object.values(GACHA_WEIGHTS).reduce((a, b) => a + b, 0);
  const eggTokens = GACHA_TOKENS.filter((t) => GACHA_BIRDS[t]);
  const eggTokenNames = eggTokens.join(" and ");
  const eggWeight = eggTokens.reduce((sum, t) => sum + GACHA_WEIGHTS[t], 0);
  const eggChance = eggWeight / totalWeight;
  const costPerEgg = ECONOMY.GACHA_ROLL_PRICE / eggChance;
  const dearerThanBreed = costPerEgg - ECONOMY.BREED_FEE;
  const eggVsBreedRatio = costPerEgg / ECONOMY.BREED_FEE;

  const rollCents = ECONOMY.GACHA_ROLL_PRICE * 100;
  const stakerCents = Math.round(rollCents * STAKER_FLOWS.GACHA_SHARE);
  const juiceCents = rollCents - stakerCents;
  const stakerPct = Math.round(STAKER_FLOWS.GACHA_SHARE * 100);
  const juicePct = 100 - stakerPct;

  const goldOverStarter = GACHA_BIRDS.Gold ? GACHA_BIRDS.Gold.statMax - STATS.STARTER_MAX : 0;

  return (
    <>
      <h1>The gacha</h1>
      <p className="lede">
        The gacha is a roll, a token, and sometimes a mystery egg. It is not the cheap way to fill
        a barn any more — that job belongs to breeding. Read this page before you spend GP on it,
        and compare it honestly to what a cover costs (see <Link href="/wiki/breeding">Breeding</Link>).
      </p>

      <h2>What a roll gives you</h2>
      <p>
        Every single roll, free or paid, always gives you two things: a rarity token, and{" "}
        {LAND.PER_GACHA_ROLL} Land Token. Only the rarest tokens — {eggTokenNames} — also drop a{" "}
        <strong>mystery egg</strong>: random element, hidden sex, no parents, hatching next Hatch
        Friday like any other egg.
      </p>

      <h2>The odds</h2>
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>Token</th>
              <th className="num">Chance</th>
              <th>Drops an egg?</th>
            </tr>
          </thead>
          <tbody>
            {GACHA_TOKENS.map((token: GachaToken) => {
              const pct = (GACHA_WEIGHTS[token] / totalWeight) * 100;
              const tier = GACHA_BIRDS[token];
              return (
                <tr key={token}>
                  <td>{token}</td>
                  <td className="num">{pct.toFixed(pct % 1 === 0 ? 0 : 1)}%</td>
                  <td>{tier ? "Yes" : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="dim">
        Those odds are read straight off the drop weights — they can&apos;t drift out of sync with
        this page. {eggTokenNames} together come out to{" "}
        {(eggChance * 100).toFixed(eggChance * 100 % 1 === 0 ? 0 : 1)}% of all rolls. Blue used to
        drop an egg too — round 23 cut it. Blue was the volume tier, and its egg was a sub-starter
        body nobody actually wanted; cutting it halved the overall egg rate and made the two
        tokens that still drop one worth actually chasing.
      </p>

      <h2>The price — and no daily cap</h2>
      <p>
        Every farm gets <strong>{ECONOMY.FREE_PULLS_PER_CHECK_IN}</strong> free pull a day from
        checking in — that one spends first, no GP involved. Past that, a single roll costs{" "}
        <strong>{ECONOMY.GACHA_ROLL_PRICE} GP</strong>, and there is <strong>no daily limit</strong> on
        how many you can buy. The price is the only limiter now — round 23 repriced the gacha back
        up specifically so a determined high roller could still buy as many as they want, without
        the old ceiling doing the job the price is supposed to do.
      </p>
      <div className="callout tip">
        <b>The {ECONOMY.BUNDLE_ROLLS}-roll bundle.</b> {ECONOMY.BUNDLE_PRICE} GP buys{" "}
        {ECONOMY.BUNDLE_ROLLS} rolls in one motion — {ECONOMY.BUNDLE_ROLLS - 1} rolls&apos; worth of
        money, one extra on the house. It&apos;s exactly one day&apos;s check-in drip ({ECONOMY.DAILY_DRIP}{" "}
        GP), spent all at once instead of trickling out one roll at a time. Free pulls aren&apos;t
        touched by it — the bundle is a purchase, not a spend of your daily allowance.
      </div>

      <h2>Where the money goes</h2>
      <p>
        A paid roll&apos;s {ECONOMY.GACHA_ROLL_PRICE} GP isn&apos;t burned — it splits the same way
        every other fee in the game does, and the bundle&apos;s {ECONOMY.BUNDLE_PRICE} GP splits by
        the same ratio:
      </p>
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>Recipient</th>
              <th className="num">Share</th>
              <th className="num">On a {ECONOMY.GACHA_ROLL_PRICE} GP roll</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                Land Token stakers (<Link href="/wiki/land">Land</Link>)
              </td>
              <td className="num">{stakerPct}%</td>
              <td className="num">{fmtGp(stakerCents)} GP</td>
            </tr>
            <tr>
              <td>
                The juice pool (<Link href="/wiki/pintakasi">the Pintakasi Majors</Link>)
              </td>
              <td className="num">{juicePct}%</td>
              <td className="num">{fmtGp(juiceCents)} GP</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="dim">
        Free pulls skip this entirely — there&apos;s no GP to split when the roll didn&apos;t cost
        any. Every GP a paid roll does spend directly funds the biggest stage in the game and pays
        every landholder a little more, whether or not they ever touch the gacha themselves.
      </p>

      <h2>The honest EV</h2>
      <p>
        Here&apos;s the number that actually matters if you&apos;re rolling for stars: divide the
        roll price by the chance of an egg. At {ECONOMY.GACHA_ROLL_PRICE} GP a roll and a{" "}
        {(eggChance * 100).toFixed(eggChance * 100 % 1 === 0 ? 0 : 1)}% combined egg rate, a mystery
        egg costs about <strong>{costPerEgg.toFixed(0)} GP</strong> on average — against a{" "}
        <strong>{ECONOMY.BREED_FEE} GP</strong> breed cover.
      </p>
      <div className="callout warn">
        <b>The gacha egg is now the dear way in — on purpose.</b> At roughly{" "}
        {eggVsBreedRatio.toFixed(1)}× the price of a cover ({dearerThanBreed.toFixed(0)} GP more, on
        average), a mystery egg costs more than breeding one, not less. Round 22 had briefly
        pushed the gacha the other way — it repriced to 16 GP a roll, and it worked so well that
        gacha out-supplied the breeding barn eight to one. Round 23 walked that back: the gacha
        isn&apos;t the cheap way to a <strong>body</strong> any more. What it sells now is a shot at{" "}
        <strong>stars</strong> — the {eggTokenNames} tiers carry 2★–4★ birds, well above anything a
        starter or an ordinary breeding pair produces in one generation (see{" "}
        <Link href="/wiki/birds">Birds &amp; stats</Link>). Breeding is still how a stable
        compounds. The gacha is the luxury lane straight into the breeding material that makes
        that compounding possible.
      </div>

      <h2>Gacha birds are capped</h2>
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>Token</th>
              <th className="num">Stars</th>
              <th className="num">Stats</th>
            </tr>
          </thead>
          <tbody>
            {eggTokens.map((token) => {
              const tier = GACHA_BIRDS[token]!;
              return (
                <tr key={token}>
                  <td>{token}</td>
                  <td className="num">
                    {tier.halfStars[0] / 2}★–{tier.halfStars[1] / 2}★
                  </td>
                  <td className="num">
                    {tier.statMin}–{tier.statMax}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p>
        Line that up against the starting flock, which rolls stats between{" "}
        {STATS.STARTER_MIN} and {STATS.STARTER_MAX}: even a Gold pull, the rarest token in the
        game, only tops out {goldOverStarter} points above a starter&apos;s ceiling. No gacha tier
        is built to meaningfully outclass the birds you already start with on raw stats — the
        difference is entirely in the stars.
      </p>
      <div className="callout warn">
        <b>The jackpot is stars, not stats.</b> A Gold egg can carry up to{" "}
        {GACHA_BIRDS.Gold ? GACHA_BIRDS.Gold.halfStars[1] / 2 : 0}★, a Purple up to{" "}
        {GACHA_BIRDS.Purple ? GACHA_BIRDS.Purple.halfStars[1] / 2 : 0}★ — both genuinely useful, but
        both still roll raw stats in shouting distance of a starter. That rule exists on purpose:
        if the gacha could hand out a bird that beat generations of careful breeding, breeding
        would stop mattering. The gacha&apos;s job is a lucky body with good stars to{" "}
        <em>breed with</em> — not a bird that skips the nest.
      </div>

      <h2>Barn-full behaviour</h2>
      <p>
        A mystery egg needs a slot to hatch into, same as any egg. If your barn is already at its{" "}
        {BARN.CAPACITY}-bird cap when a qualifying token drops, the token itself still counts
        toward your collection — but the egg is forfeit. Keep room in the barn if you&apos;re
        planning to roll.
      </p>
      <p>
        Whatever egg does land hatches exactly like a bred one: it comes out with an auto-name, and{" "}
        <Link href="/wiki/birds">the naming law</Link> applies before it can enter its first fight.
      </p>

      <div className="next">
        <Link href="/wiki/breeding">← Breeding</Link>
        <Link href="/wiki/birds">Birds &amp; stats →</Link>
        <Link href="/wiki/pintakasi">The Pintakasi →</Link>
      </div>
    </>
  );
}
