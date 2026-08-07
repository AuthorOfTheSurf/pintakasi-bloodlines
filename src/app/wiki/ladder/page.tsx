import Link from "next/link";
import {
  AGE,
  ALL_ENTRY_FEES,
  CLAIMER,
  ECONOMY,
  FIGHTS_PER_GROUP_BIRD,
  JUVENILE_MAJOR,
  LAND,
  LT_CENTS,
  NW_CAP,
  PINTAKASI,
  feeFor,
  fmtLt,
  landForFight,
  stakePerFight,
} from "@/engine/config";

export const dynamic = "force-dynamic";

/**
 * THE PRICED LADDER (round 42) — the page that did not exist while there was
 * only one price. Until this round every fight in a division cost the same, so
 * "climb the classes" was advice with no arithmetic behind it: harder company,
 * identical stake, identical reward. Now each rung is priced and the land curve
 * is superlinear, so climbing pays more than it costs — and a new player has no
 * way at all to infer that from a lobby name. Hence a page.
 *
 * Every figure here comes through `feeFor` and `landForFight`. Nothing on this
 * page may be typed, because the whole subject of the page is a table of
 * numbers somebody will re-tune.
 */

/** One rung of the ladder, priced in both divisions. */
type Rung = { label: string; who: React.ReactNode; juvenile: number; real: number };

const RUNGS: Rung[] = [
  {
    label: "maiden",
    who: <>Birds that have never won a fight at their own level.</>,
    juvenile: feeFor("juvenile", "maiden"),
    real: feeFor("real", "maiden"),
  },
  {
    label: "nw3",
    who: <>Birds with fewer than {NW_CAP} wins at real stakes.</>,
    juvenile: feeFor("juvenile", "nw3"),
    real: feeFor("real", "nw3"),
  },
  {
    label: "open",
    who: <>Anybody. No record requirement, and no protection either.</>,
    juvenile: feeFor("juvenile", "open"),
    real: feeFor("real", "open"),
  },
  ...CLAIMER.PRICES.map((price) => ({
    label: `claimer, ${price} GP tag`,
    who: (
      <>
        Birds entered for sale at {price} GP — see <Link href="/wiki/claiming">Claiming</Link>.
      </>
    ),
    juvenile: feeFor("juvenile", "claimer", price),
    real: feeFor("real", "claimer", price),
  })),
];

/**
 * Every priced night in the game, cheapest first, with what it mints. Built
 * from RUNGS rather than from ALL_ENTRY_FEES so each row can be LABELLED — the
 * bare fee list has duplicates (a grown maiden and a grown nw3 are the same
 * money) and a table of unlabelled numbers teaches nobody anything.
 *
 * ⚠ Juvenile nw3 is skipped on purpose: it is priced in config so the lookup is
 * total, but the juvenile card never posts that class, so listing it here would
 * advertise a fight nobody can enter.
 */
const LAND_ROWS = RUNGS.flatMap((r) => [
  ...(r.label === "nw3" ? [] : [{ division: "Juvenile", rung: r.label, fee: r.juvenile }]),
  { division: "Grown", rung: r.label, fee: r.real },
]).sort((a, b) => a.fee - b.fee);

export default function LadderPage() {
  // The headline step: the two ends of one grown bird's ladder.
  const maidenFee = feeFor("real", "maiden");
  const openFee = feeFor("real", "open");
  const feeMultiple = openFee / maidenFee;
  const landMultiple = landForFight(openFee) / landForFight(maidenFee);

  const cheapest = Math.min(...ALL_ENTRY_FEES);
  const dearest = Math.max(...ALL_ENTRY_FEES);

  // Against the breed fee, which is the anchor the whole ladder was priced
  // from — a body is cheap and a night is dear, on purpose.
  const juvenileMaidenVsBreed = (feeFor("juvenile", "maiden") / ECONOMY.BREED_FEE) * 100;
  const openVsBreed = openFee / ECONOMY.BREED_FEE;
  const juvenileOpenVsBreed = (feeFor("juvenile", "open") / ECONOMY.BREED_FEE) * 100;

  // ⚠ /LT_CENTS. `landForFight` returns HUNDREDTHS of a token, so dividing it
  // straight by the fee gives hundredths-per-GP — a number a hundred times too
  // big, printed next to a "LT" that would make it a lie.
  const landPerGp = (fee: number) => landForFight(fee) / LT_CENTS / fee;

  return (
    <>
      <h1>Fighting up</h1>
      <p className="lede">
        Every class of fight has its <strong>own price</strong>. A maiden night is cheap, an open
        night is dear, and the gap between them is the point. Harder company costs more money — and
        pays back more than the extra money you put in. This page is the whole argument for climbing
        the ladder instead of hiding at the bottom of it.
      </p>

      <div className="callout">
        <b>The one-line version.</b> An open night costs {feeMultiple.toFixed(1)}× a maiden night and
        mints {landMultiple.toFixed(1)}× the <Link href="/wiki/land">Land Tokens</Link>. Pay{" "}
        {feeMultiple.toFixed(1)} times as much, get {landMultiple.toFixed(1)} times as much. That is
        the deal, and it is the same shape at every step of the ladder.
      </div>

      <h2>It used to be one flat price</h2>
      <p>
        This is new, and the old rule is worth knowing so the new one makes sense. Until now a
        division had a single entry fee: every fight a grown bird could take cost exactly the same,
        whether it was beating up never-winners in a maiden or standing in the open against the best
        birds in the world.
      </p>
      <p>
        So the class ladder carried no weight. A bird that climbed it took on harder company for no
        extra stake and no extra reward — which means the sensible play was to never climb at all,
        and sit in the softest class that would still take your bird. That is backwards. The whole
        shape of the game is supposed to be a bird working its way up.
      </p>

      <h2>What a night costs now</h2>
      <p>
        Prices run from {cheapest} GP to {dearest} GP. The right-hand column is what a grown bird
        pays; the middle column is what the same fight costs in the discovery year, which is{" "}
        <strong>half</strong> — see below.
      </p>
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>Class</th>
              <th>Who may enter</th>
              <th className="num">Juvenile</th>
              <th className="num">Grown</th>
            </tr>
          </thead>
          <tbody>
            {RUNGS.map((r) => (
              <tr key={r.label}>
                <td>{r.label}</td>
                <td>{r.who}</td>
                <td className="num">
                  {r.label === "nw3" ? "—" : `${r.juvenile} GP`}
                </td>
                <td className="num">{r.real} GP</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="dim">
        The discovery year has no nw3 class — a one-year-old hasn&apos;t fought long enough to have
        the record it sorts by — so that cell is empty rather than cheap. And maiden and nw3 cost the
        same money on purpose: a group stage hands out up to {FIGHTS_PER_GROUP_BIRD} fights a night,
        so most birds graduate out of maiden almost at once, and charging the two rungs apart would
        just tax an accident of timing.
      </p>
      <div className="callout tip">
        <b>Every price divides by {FIGHTS_PER_GROUP_BIRD}.</b> One entry buys a group of up to{" "}
        {FIGHTS_PER_GROUP_BIRD} fights, and the fee splits evenly across them — so an open night
        risks {stakePerFight(openFee)} GP a fight and a maiden night {stakePerFight(maidenFee)} GP.
        Any fight your bird never got is refunded when the card settles. The fees are the numbers
        they are so the split never leaves a fraction of a peso behind. See{" "}
        <Link href="/wiki/card">The card</Link>.
      </div>

      <h2>What the extra money buys</h2>
      <p>
        Land. Your bird earns <Link href="/wiki/land">Land Tokens</Link> on the total it risked in a
        night, win or lose, and the curve underneath is <strong>steeper than a straight line</strong>.
        Doubling the stake more than doubles the land.
      </p>
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>Division</th>
              <th>Class</th>
              <th className="num">Entry</th>
              <th className="num">Land, full card of {FIGHTS_PER_GROUP_BIRD}</th>
              <th className="num">Land per GP risked</th>
            </tr>
          </thead>
          <tbody>
            {LAND_ROWS.map((r) => (
              <tr key={`${r.division}-${r.rung}`}>
                <td>{r.division}</td>
                <td>{r.rung}</td>
                <td className="num">{r.fee} GP</td>
                <td className="num">{fmtLt(landForFight(r.fee))} LT</td>
                <td className="num">{landPerGp(r.fee).toFixed(3)} LT</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>
        Read the last column from top to bottom. It never falls, and from the cheapest night in the
        game to the dearest it climbs by about{" "}
        {Math.round((landPerGp(dearest) / landPerGp(cheapest) - 1) * 100)}%. That is the incentive in
        one number: the dearer the company, the more land each peso you risked comes back as. A cheap
        fight is cheap in every sense.
      </p>
      <div className="callout tip">
        <b>Why land and not prize money.</b> Prize money comes out of the other bird&apos;s pocket —
        a fight pot is just the two stakes, so the game cannot pay you more for climbing without
        taking it off somebody. Land is <em>minted</em>. So land is the lever the game uses to reward
        a decision, and 1 Land Token is minted per {LAND.FEE_PER_TOKEN} GP risked at the bottom of the
        curve and rather more than that further up. See <Link href="/wiki/land">Land Tokens</Link> for
        what land is actually worth to you.
      </div>

      <h2>Why the open is the dearest fight on the card</h2>
      <p>
        A grown open night is {openFee} GP, the priciest thing on any daily card, and the juvenile
        open at {feeFor("juvenile", "open")} GP is dearer than a grown maiden. That is deliberate,
        and the reason is <strong>information</strong>.
      </p>
      <p>
        Your bird&apos;s six stats are hidden for its whole fighting career (see{" "}
        <Link href="/wiki/birds">Birds &amp; stats</Link>). All you ever get is how it performs. So
        the most valuable thing you can buy in this game is a straight answer about how good your
        bird really is — and the only place to buy that answer is against the best company available.
        If a one-year-old can win in the open at a given blade, you know something about it that no
        amount of beating maidens will ever tell you.
      </p>
      <div className="callout tip">
        <b>The most expensive discovery in the game, on purpose.</b> A juvenile open night is{" "}
        {juvenileOpenVsBreed.toFixed(0)}% of what it costs to breed a whole new bird. That is not a
        mistake. The discovery year exists to find out what a bird is, and the sharpest read costs
        the most. Send your best one-year-old there; send the rest somewhere cheaper.
      </div>

      <h2>Priced against the cost of a bird</h2>
      <p>
        Every number above was set against one anchor: the {ECONOMY.BREED_FEE} GP it costs to breed a
        bird (see <Link href="/wiki/breeding">Breeding</Link>). The rule the designer wanted is short
        — <strong>a body is cheap and a night is dear</strong>.
      </p>
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>What</th>
              <th className="num">GP</th>
              <th>Against the {ECONOMY.BREED_FEE} GP cost of making a bird</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>A juvenile maiden night</td>
              <td className="num">{feeFor("juvenile", "maiden")}</td>
              <td>{juvenileMaidenVsBreed.toFixed(0)}% of it</td>
            </tr>
            <tr>
              <td>A juvenile open night</td>
              <td className="num">{feeFor("juvenile", "open")}</td>
              <td>{juvenileOpenVsBreed.toFixed(0)}% of it</td>
            </tr>
            <tr>
              <td>A grown open night</td>
              <td className="num">{openFee}</td>
              <td>{openVsBreed.toFixed(2)}× it</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>
        Why that way round: a bird that can actually win should earn back what it cost to create in a
        night or two of good company. That makes a good bird worth a lot more than the price of a
        cover — which is what makes birds worth breeding, worth buying, and worth arguing about. And
        it means your GP goes on <em>fighting</em> rather than on collecting animals you never card.
      </p>

      <h2>The discovery year is half price</h2>
      <p>
        Look down the two fee columns again: every juvenile rung is exactly half its grown twin. A
        one-year-old is still learning what it is, and the season it learns in should not cost what a
        veteran&apos;s does. Age {AGE.CHICK} is the only year a bird&apos;s results don&apos;t follow
        it forever, so it is the right year to experiment in — and the price says so.
      </p>
      <p>
        Keeping it exactly half is a deliberate choice rather than a rounding. It makes &ldquo;campaign
        this bird hard as a juvenile&rdquo; a real economic decision, not a difference you&apos;d never
        notice.
      </p>
      <div className="callout warn">
        <b>But a juvenile is not cheap to sell.</b> Claiming tags are the{" "}
        <em>same ladder</em> for both seasons — {CLAIMER.PRICES.join(" / ")} GP — because a
        one-year-old that has campaigned has real earnings behind it and is worth a grown bird&apos;s
        price. Half the entry fee, full price on the animal. See{" "}
        <Link href="/wiki/claiming">Claiming</Link>.
      </div>

      <h2>Above the ladder: the crowns</h2>
      <p>
        The championships sit above every rung on the card, and they are priced above them too.
      </p>
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>Stage</th>
              <th className="num">Entry</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>A Pintakasi Major</td>
              <td className="num">{PINTAKASI.ENTRY_FEE} GP</td>
              <td>
                Age {AGE.FORK}+, and every loss ends a career. The whole fee goes into that
                crown&apos;s purse.
              </td>
            </tr>
            <tr>
              <td>A Juvenile Championship</td>
              <td className="num">{JUVENILE_MAJOR.ENTRY_FEE} GP</td>
              <td>
                Age {AGE.CHICK} only, {JUVENILE_MAJOR.QUALIFYING_WINS} juvenile wins to stand, and
                nobody is force-retired.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>
        The juvenile crown used to be free. It stopped being free the moment the ladder got priced,
        and for a simple reason: once a juvenile open night costs{" "}
        {feeFor("juvenile", "open")} GP, a free championship would be the{" "}
        <em>cheapest</em> serious fight a one-year-old could take. The best stage in the discovery
        year, at no cost, while an ordinary Tuesday cost real money — exactly backwards. It is{" "}
        {JUVENILE_MAJOR.ENTRY_FEE} GP now, which is still less than{" "}
        {(JUVENILE_MAJOR.ENTRY_FEE / feeFor("juvenile", "maiden")).toFixed(1)}× a juvenile maiden
        night. Read <Link href="/wiki/pintakasi">The Pintakasi</Link> for what the crowns pay.
      </p>

      <h2>So what should you actually do?</h2>
      <ul>
        <li>
          <strong>Don&apos;t hide.</strong> Sitting in the softest class your bird qualifies for is
          the cheapest way to learn the least and mint the least.
        </li>
        <li>
          <strong>Spend the discovery year finding the blade.</strong> Half price, results that
          don&apos;t follow the bird, and the open class is where the honest answers live.
        </li>
        <li>
          <strong>Card a good bird up.</strong> If it keeps winning, the dearer class pays for itself
          twice — bigger pots and disproportionately more land.
        </li>
        <li>
          <strong>Use claimers when you&apos;re unsure.</strong> The cheapest fight in the game is a
          juvenile claimer at the {CLAIMER.PRICES[0]} GP tag (
          {feeFor("juvenile", "claimer", CLAIMER.PRICES[0])} GP to enter) — but somebody can buy the
          bird afterwards, and that is the price of the discount.
        </li>
      </ul>

      <div className="next">
        <Link href="/wiki/card">The card →</Link>
        <Link href="/wiki/land">Land Tokens →</Link>
        <Link href="/wiki/claiming">Claiming →</Link>
        <Link href="/wiki/pintakasi">The Pintakasi →</Link>
      </div>
    </>
  );
}
