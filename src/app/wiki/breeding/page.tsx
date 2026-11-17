import Link from "next/link";
import {
  AGE,
  BARN,
  BREEDING,
  BREEDING_SHAPES,
  BREED_SPLIT,
  COVERS,
  DISTANCE_STATS,
  LT_CENTS,
  STARS,
  STUD_PRICE,
  expectedFoalStat,
} from "@/engine/config";
import { splitBreedFee } from "@/engine/breeding";
import { fmtGp } from "@/engine/events";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Breeding — The Pintakasi Handbook",
  description:
    "Only retired birds breed — the bloodline rule, covers and stud prices, the fee split, inheritance, and the nest.",
};

export default function BreedingPage() {
  const floorSplit = splitBreedFee(STUD_PRICE.FLOOR);
  // A worked example above the floor: twice the floor, so it moves with the knob.
  const examplePrice = STUD_PRICE.FLOOR * 2;
  const exampleSplit = splitBreedFee(examplePrice);
  // On his own stud the owner's share comes back, so what he really pays is
  // the stakers' and the juice pool's part.
  const ownNetCents = exampleSplit.stakerPoolCents + exampleSplit.juicePoolCents;
  const premiumOwnerPct = Math.round(STUD_PRICE.PREMIUM_SPLIT.STUD_OWNER * 100);
  const premiumJuicePct = Math.round(STUD_PRICE.PREMIUM_SPLIT.JUICE * 100);
  const stakerPct = Math.round(BREED_SPLIT.STAKER * 100);
  const juicePct = Math.round(BREED_SPLIT.JUICE * 100);
  const studOwnerPct = 100 - stakerPct - juicePct;
  const coversPerWeek = COVERS.PER_WEEK + COVERS.OWNER_RESERVED;
  const mutationPct = Math.round(BREEDING.MUTATION_CHANCE * 100);
  const pullPct = Math.round(BREEDING.BETTER_PARENT_PULL * 100);
  // Worked example: a B+ hen's stat crossed with an A+ stud's.
  const exHen = 300;
  const exStud = 500;
  const exChick = Math.round(expectedFoalStat(exHen, exStud));
  const femalePct = Math.round(BREEDING.FEMALE_CHANCE * 100);
  const maxStars = STARS.MAX_HALF_STARS / 2;

  return (
    <>
      <h1>Breeding</h1>
      <p className="lede">
        A fighting career and a breeding life never overlap. A bird fights until it can&apos;t
        anymore, and only then does it get to make the next generation. This page covers who may
        breed, what it costs, who gets paid, and exactly how a chick inherits what it inherits.
      </p>

      <h2>Only retired birds breed</h2>
      <p>
        Breeding needs a hen and a rooster, and both must be <strong>retired</strong>. An active
        fighter — no matter how good — cannot sit at the nest. A bird reaches the barn one of three
        ways: it hits the age cap (age {AGE.FIGHTING_CAP}), it&apos;s pulled voluntarily once
        retirement unlocks at age {AGE.FORK}, or it loses a bout in a{" "}
        <Link href="/wiki/pintakasi">Pintakasi Major</Link>, which force-retires it on the spot.
      </p>
      <p>
        That&apos;s the loop, and it&apos;s deliberate: a fighting career <strong>ends</strong> and
        a breeding life <strong>begins</strong> — the same bird, a second job. A lost crown and an
        age retirement don&apos;t delete a bird from the game, they feed it into the barn. A bird
        you lost in a Major, or aged out, is still worth exactly as much to your bloodline as one
        you never risked.
      </p>

      <h2>The bloodline restriction</h2>
      <p>You cannot breed a bird with its own kin. Forbidden pairings are checked two ways:</p>
      <ul>
        <li>
          <strong>Ancestors, {BREEDING.ANCESTOR_DEPTH} generations back.</strong> A bird cannot
          breed with its parent, grandparent, or great-grandparent, in either direction.
        </li>
        <li>
          <strong>Siblings.</strong> Two birds that share a mother or a father cannot breed with
          each other, no matter how many generations separate them from any other shared ancestor.
        </li>
      </ul>
      <p>
        Say it plainly: this is a real wall, not a warning. The game refuses the pairing outright
        and tells you why — an in-family cover simply isn&apos;t offered.
      </p>

      <h2>Covers</h2>
      <p>
        A <strong>cover</strong> is one breeding — your hen paired against one rooster, retired, of
        your own or listed by another farm. The hen&apos;s owner pays; the hen&apos;s owner keeps
        the egg.
      </p>

      <h2>What a cover costs</h2>
      <p>
        The rooster&apos;s owner sets the price. It is a whole number of GP, never less than{" "}
        <strong>{STUD_PRICE.FLOOR} GP</strong> (the <strong>floor</strong>) and never more than{" "}
        <strong>{STUD_PRICE.CAP.toLocaleString()} GP</strong> (the <strong>cap</strong>,{" "}
        {STUD_PRICE.CAP_MULTIPLE}× the floor). A rooster nobody has priced costs the floor. The stud
        card in the barn shows each rooster&apos;s price before you buy. An owner sets the price on
        his <Link href="/wiki/farm#studs">farm page</Link> (click the rooster in the Retired view),
        or asks Claude to.
      </p>
      <ul>
        <li>
          <strong>Your own hens pay your price too.</strong> The owner&apos;s share of the cover
          comes straight back to you, so on your own {examplePrice} GP rooster a cover really costs
          you {fmtGp(ownNetCents)} GP: the stakers&apos; and the juice pool&apos;s part. Why: an
          owner should face the price he sets for everyone else. What he loses is the same house
          share any buyer pays, and no more.
        </li>
        <li>
          <strong>The price lives on the bird.</strong> It goes with him if he changes hands, and
          every cover pays whoever owns him on the day the cover is bought.
        </li>
        <li>
          <strong>A new price goes up at the next day.</strong> When an owner changes the price on a
          rooster that is already standing, it waits until the day turns, the same way the card
          does. So everyone sees one price for the whole game-day, and the price you see when you
          browse is the price you pay. The owner sees his waiting price in the barn until it goes
          up.
        </li>
        <li>
          <strong>Price him before you list him.</strong> A rooster that is not standing yet takes
          his price at once, because no buyer can see him. So set the price first (or name it when
          you list him), and he stands at that price from his very first cover. Why: if a new price
          always waited a day, every new stud would sell his first day at the floor.
        </li>
        <li>
          <strong>A cover already bought keeps its price.</strong> A buyer can also name the most he
          will pay. If the day turned and the price went up after he looked, the cover is refused
          instead of charging him more.
        </li>
      </ul>
      <p>
        <b>Why owners set it:</b> a great stud and a plain one used to cost exactly the same, so
        breeding a great rooster paid no more than breeding a plain one. Now the owner of a stud
        everyone wants can raise his price, and the hens that won&apos;t pay it go to other
        roosters.
      </p>
      <div className="callout tip">
        <b>How to price a stud.</b> Price from what anyone can see: his record, his crowns, and his
        revealed stat sheet. If he sells out every week, raise the price. If nobody buys, cut it.
        <br />
        <b>How to shop as a buyer.</b> Weigh the price against the chick you expect. A chick&apos;s
        stats start most of the way toward the better parent on each stat, so a stud worth paying
        more for is one whose sheet pulls your hen&apos;s numbers where you want them.
      </div>
      <p>
        Every rooster caps out at <strong>{coversPerWeek} covers a game-week</strong>:{" "}
        {COVERS.PER_WEEK} public slots any farm can buy, plus {COVERS.OWNER_RESERVED} reserved for
        the rooster&apos;s own farm. The cap is the point — a popular stud sells out, and demand
        that can&apos;t get in overflows onto other roosters instead of piling endlessly onto one.
      </p>
      <div className="callout tip">
        <b>Listing a retired rooster at stud is income.</b> You can always cover your own hens with
        your own retired rooster, up to the owner-reserved slots, whether or not you&apos;ve listed
        him. <em>Listing</em> him opens the public slots to every other farm&apos;s hens — and every
        cover anyone buys against him pays his owner a share (below). A good retired rooster sitting
        idle in your barn is money left on the table.
      </div>
      <div className="callout warn">
        <b>Listing costs land — the game&apos;s first Land Token sink.</b> Opening a rooster&apos;s
        {/* Land figures are hundredths of a token since round 36. */}
        public slots for the first time costs a flat{" "}
        <strong>{(COVERS.STUD_LISTING_LT / LT_CENTS).toLocaleString()} LT</strong>, spent outright —
        not staked, not refundable. Pulling him from the barn and re-listing him later is free; the
        land bought the seat, not a subscription. Why this door: a stud is the best asset in the
        game — it earns on every outside cover, and its own owner still breeds through it on the
        reserved slots. A gate that desirable is worth paying land for, and it&apos;s the first
        thing in the game that takes Land Tokens <em>out</em> of the world rather than just paying
        them out (barn expansion is the second) — see <Link href="/wiki/land">Land Tokens</Link> for
        why a sink is what turns a yield into a price.
      </div>

      <h2>The fee split</h2>
      <p>
        A cover&apos;s price doesn&apos;t all go to one place. It splits in two parts, computed in
        exact centi-GP so nothing is lost to rounding.
      </p>
      <ul>
        <li>
          <strong>The floor part</strong> (the first {STUD_PRICE.FLOOR} GP of every cover) splits
          three ways: {stakerPct}% to Land Token stakers, {juicePct}% to the juice pool,{" "}
          {studOwnerPct}% to the stud&apos;s owner.
        </li>
        <li>
          <strong>The premium</strong> (everything above the floor) splits two ways:{" "}
          {premiumOwnerPct}% to the stud&apos;s owner and {premiumJuicePct}% to the juice pool. The
          stakers get no cut of it.
        </li>
      </ul>
      <p>
        Why a different split above the floor: if the owner kept only {studOwnerPct}% of every extra
        GP, raising a price would mostly pay other people, and nobody would bother. The{" "}
        {premiumJuicePct}% is the house&apos;s share, the same idea as the share of the daily
        check-in that goes to the purses.
      </p>
      <p>Here is a cover at the floor next to one priced at {examplePrice} GP:</p>
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>Recipient</th>
              <th className="num">At the floor ({STUD_PRICE.FLOOR} GP)</th>
              <th className="num">At {examplePrice} GP</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                Land Token stakers (<Link href="/wiki/land">Land</Link>)
              </td>
              <td className="num">{fmtGp(floorSplit.stakerPoolCents)} GP</td>
              <td className="num">{fmtGp(exampleSplit.stakerPoolCents)} GP</td>
            </tr>
            <tr>
              <td>
                The juice pool (<Link href="/wiki/pintakasi">the Pintakasi Majors</Link>)
              </td>
              <td className="num">{fmtGp(floorSplit.juicePoolCents)} GP</td>
              <td className="num">{fmtGp(exampleSplit.juicePoolCents)} GP</td>
            </tr>
            <tr>
              <td>The stud&apos;s owner</td>
              <td className="num">{fmtGp(floorSplit.studOwnerCents)} GP</td>
              <td className="num">{fmtGp(exampleSplit.studOwnerCents)} GP</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="dim">
        The staker cut pays every farm holding Land Tokens, whether or not they ever breed a bird —
        it&apos;s a landholder&apos;s cut of the whole game&apos;s breeding activity, and it is the
        same on every cover however high the price. The juice pool is the same pot that gacha spend
        feeds, and it becomes the purse for the Thursday championships. Nothing here is printed or
        burned — every centi-GP of the price lands somewhere real.
      </p>

      <h2>Inheritance</h2>
      <div className="cards-2">
        <div className="minicard">
          <b>The six stats</b>
          Each stat starts {pullPct}% of the way from the weaker parent to the stronger one. A hen
          with {exHen} and a stud with {exStud} give a chick that starts at {exChick}, not halfway.
          That is why breeding a hen to a better stud pays: the chick keeps most of his edge. It
          also means a careful breeder&apos;s birds get a little better every generation. Then the
          stat shifts by up to {BREEDING.STAT_VARIANCE} points either way — that spread is why two
          eggs from the same pair are never identical. And because both parents are retired, both
          sheets are <em>public</em>: a stud card shows the rooster&apos;s full six revealed stats
          and his overall grade, so you can do this sum yourself before you buy the cover. On top of
          that, each stat has a {mutationPct}% chance to mutate, swinging it up to{" "}
          {BREEDING.MUTATION_SWING} further points in either direction. That&apos;s where a real
          surprise — a breakout stat, or a dud — comes from.
        </div>
        <div className="minicard">
          <b>Stars and element</b>
          Half-star rating lands within {BREEDING.STAR_SPREAD_HALF_STARS} half-stars of the
          parents&apos; average, up to the {maxStars}★ cap. The chick&apos;s element leans toward
          whichever parent carries the higher star rating most of the time, leans toward the other
          parent less often, and only rarely lands on a completely different element as its own
          small mutation.
        </div>
        <div className="minicard">
          <b>Carriage</b>
          Ground or Air inherits on the same preference-pair maths as stars: the magnitude draws
          around the parents&apos; average, and the lean follows whichever parent carries the
          stronger rating {Math.round(BREEDING.CARRIAGE_LEAN_STRONGER * 100)}% of the time —
          noticeably higher than the element lean, on purpose, because carriage is meant to be{" "}
          <em>selectable</em>: breed two shufflers, get another shuffler. See{" "}
          <Link href="/wiki/birds">Birds &amp; stats</Link> for what carriage means, and why it
          doesn&apos;t change tonight&apos;s fight yet.
        </div>
      </div>
      <p>
        One more thing is decided at the cover and hidden from you: the egg&apos;s sex, a flat{" "}
        {femalePct}/{100 - femalePct} coin flip, sealed until hatch day. You won&apos;t know if you
        bred a hen or a rooster until the egg actually opens.
      </p>

      <h2>What to breed for</h2>
      <p>
        Averaging two sheets is easy. Knowing <em>which</em> two sheets to average is the game. Here
        is the plan the game is built around, in order.
      </p>
      <p>
        <strong>First, pick a shape.</strong> The four fighting stats sit on a dial, from the sprint
        end to the deep-water end:{" "}
        {DISTANCE_STATS.map((stat, i) => (
          <span key={stat}>
            {i > 0 ? " → " : ""}
            <strong>{stat}</strong>
          </span>
        ))}
        . Aim your line at <em>two stats that sit next to each other</em> on that dial. There are
        three such pairs:
      </p>
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>Shape</th>
              <th>The two stats</th>
              <th>What it makes</th>
            </tr>
          </thead>
          <tbody>
            {BREEDING_SHAPES.map(({ pair }, i) => (
              <tr key={pair.join()}>
                <td>{["Sprint blood", "Middle blood", "Deep-water blood"][i]}</td>
                <td>
                  {pair[0]} &amp; {pair[1]}
                </td>
                <td>
                  {
                    [
                      "Fast, sharp birds — strongest at the short blades.",
                      "All-rounders — strongest through the middle of the dial.",
                      "Grinders — strongest at the long blades.",
                    ][i]
                  }
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>
        Why a <em>pair</em> and not one huge stat? Because a pair buys you a <strong>floor</strong>.
        A bird built on one towering stat is wonderful at one blade and ordinary at the other four —
        and since you can&apos;t see a chick&apos;s sheet, you won&apos;t know which blade that is
        for months. A paired bird is strong at the two blades its two stats key, still clearly ahead
        of a plain bird in the middle, and never truly bad anywhere. Under the fog, the floor is the
        part you actually own.
      </p>
      <p>
        <strong>Then take the extras where you can get them.</strong> Once two candidate covers give
        a similar shape, break the tie on <strong>station</strong>, <strong>condition</strong>, and{" "}
        <strong>stars</strong>. None of them keys a blade, so none of them fights your shape — they
        are pure profit on top of it.
      </p>
      <div className="callout tip">
        <b>Why bother?</b> A shaped bird is what wins the{" "}
        <Link href="/wiki/pintakasi">Pintakasi</Link> crowns, and a championship is the biggest
        prize in the game. A flock bred only for &ldquo;big numbers&rdquo; drifts toward birds that
        are mediocre everywhere and excellent nowhere — and those birds have nothing for the scout
        report to find, which quietly costs you the discovery game too.
      </div>
      <p className="dim">
        This is the opening plan, not the only one. Single big stats are a real line as well —
        stars, station and condition are all still on the table for a bird with one enormous number.
        Start with a pair; deviate once you know why you&apos;re deviating.
      </p>

      <h2>The nest rule and the calendar</h2>
      <div className="callout">
        <b>One hen, one pregnancy at a time.</b> A cover makes a hen pregnant until the nearest
        Friday. When she lays, she is free for another cover right away, even while the first egg
        waits to hatch the following Friday. Conceive now, lay Friday, cover again, hatch the
        following Friday.
      </div>
      <p>
        Plan around Fridays. A hen cannot take two covers while pregnant, but laying starts her next
        cycle before the first egg opens. Roosters have their own weekly cover cap above, so no
        single top stud can supply every nest.
      </p>
      <p>
        A new farm begins with {BARN.STARTER_EGGS} eggs. They hatch together on its first Hatch
        Friday, giving a new stable a full discovery-year flock before it starts breeding its own
        line.
      </p>

      <h2>Why breeding is the only way up</h2>
      <p>
        Every gacha bird&apos;s raw stats are deliberately held near or just above the starting
        flock&apos;s stat band — see <Link href="/wiki/gacha">the gacha</Link> for exactly how
        capped. A lucky roll can hand you real stars, but that&apos;s a single injection, not
        something that compounds — the next roll starts from zero again. Breeding is the only path
        where a chick&apos;s stats <em>and</em> stars start from something better than either parent
        — two strong birds plus a lucky mutation roll — and stack again in the next generation. The
        gacha can hand you a good body once. Only the nest hands you quality that keeps climbing.
      </p>
      <p>
        There&apos;s a second reason the nest is where fortunes are made: it&apos;s the one place in
        the game where you decide with the <strong>lights on</strong>. A live bird&apos;s stats are
        hidden until it retires (see <Link href="/wiki/birds">Birds &amp; stats</Link>) — but
        breeding only uses retired birds, so when you pick a pairing, both full sheets are on the
        table. That split is the point of the whole design: breeding is the <em>informed</em>{" "}
        decision, fighting is the <em>discovered</em> one. You breed with everything known, then
        spend a career finding out what the egg actually gave you.
      </p>

      <div className="next">
        <Link href="/wiki/birds">← Birds &amp; stats</Link>
        <Link href="/wiki/gacha">The gacha →</Link>
        <Link href="/wiki/pintakasi">The Pintakasi →</Link>
      </div>
    </>
  );
}
