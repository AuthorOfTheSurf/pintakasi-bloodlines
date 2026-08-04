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
  const eggWeight = GACHA_TOKENS.filter((t) => GACHA_BIRDS[t]).reduce(
    (sum, t) => sum + GACHA_WEIGHTS[t],
    0
  );
  const eggChance = eggWeight / totalWeight;
  const costPerEgg = ECONOMY.GACHA_ROLL_PRICE / eggChance;
  const cheaperThanBreed = ECONOMY.BREED_FEE - costPerEgg;

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
        The gacha is the fast way to add a body to your barn — a roll, a token, and sometimes an
        egg. It is not a shortcut to a better bird. Read this page before you spend GP on it, and
        compare it honestly to what a cover costs (see <Link href="/wiki/breeding">Breeding</Link>).
      </p>

      <h2>What a roll gives you</h2>
      <p>
        Every single roll, free or paid, always gives you two things: a rarity token, and{" "}
        {LAND.PER_GACHA_ROLL} Land Token. The three rarer tokens — Blue, Purple, and Gold — also
        drop a <strong>mystery egg</strong>: random element, hidden sex, no parents, hatching next
        Hatch Friday like any other egg.
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
        this page. Blue, Purple, and Gold together come out to{" "}
        {(eggChance * 100).toFixed(eggChance * 100 % 1 === 0 ? 0 : 1)}% of all rolls.
      </p>

      <h2>The price and the caps</h2>
      <p>
        Every farm gets <strong>{ECONOMY.FREE_PULLS_PER_CHECK_IN}</strong> free pull a day from
        checking in — that one spends first, no GP involved. Past that, a farm may buy up to{" "}
        <strong>{ECONOMY.PAID_PULLS_PER_DAY}</strong> more rolls per game-day, at{" "}
        <strong>{ECONOMY.GACHA_ROLL_PRICE} GP</strong> each. That&apos;s a hard daily ceiling —{" "}
        {ECONOMY.FREE_PULLS_PER_CHECK_IN + ECONOMY.PAID_PULLS_PER_DAY} rolls total per farm, per
        day, no matter how much GP you&apos;re holding.
      </p>

      <h2>Where the money goes</h2>
      <p>
        A paid roll&apos;s {ECONOMY.GACHA_ROLL_PRICE} GP isn&apos;t burned — it splits the same way
        every other fee in the game does:
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
                The juice pool (<Link href="/wiki/pintakasi">Thursday&apos;s championships</Link>)
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
        Here&apos;s the number that actually matters if you&apos;re rolling for a body: divide the
        roll price by the chance of an egg. At {ECONOMY.GACHA_ROLL_PRICE} GP a roll and a{" "}
        {(eggChance * 100).toFixed(eggChance * 100 % 1 === 0 ? 0 : 1)}% combined egg rate, a mystery
        egg costs about <strong>{costPerEgg.toFixed(0)} GP</strong> on average — against a{" "}
        <strong>{ECONOMY.BREED_FEE} GP</strong> breed cover.
      </p>
      <div className="callout tip">
        <b>The gacha is cheaper, and that&apos;s the point.</b> At roughly{" "}
        {cheaperThanBreed.toFixed(0)} GP less per bird, the gacha is the cheap way to add a{" "}
        <strong>body</strong> to your barn — more wings to fill out juvenile cards, more elements
        in the yard, more depth. Breeding costs more per egg because it&apos;s buying something the
        gacha structurally can&apos;t: a chick built from two parents you chose, with a real shot at
        beating what either of them was. Gacha adds bodies. Breeding adds quality. See{" "}
        <Link href="/wiki/breeding">Breeding</Link> for the full inheritance math.
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
            {GACHA_TOKENS.filter((t) => GACHA_BIRDS[t]).map((token) => {
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
        is built to meaningfully outclass the birds you already start with.
      </p>
      <div className="callout warn">
        <b>The jackpot on a Gold pull is stars, not stats.</b> A Gold egg can carry up to{" "}
        {GACHA_BIRDS.Gold ? GACHA_BIRDS.Gold.halfStars[1] / 2 : 0}★ — genuinely useful — but its raw
        stats stay in shouting distance of a starter. That rule exists on purpose: if the gacha
        could hand out a bird that beat generations of careful breeding, breeding would stop
        mattering. The gacha&apos;s job is a lucky body with good stars to <em>breed with</em> — not
        a bird that skips the nest.
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
