import Link from "next/link";
import { AGE, BREEDING, BREED_SPLIT, COVERS, ECONOMY, STARS } from "@/engine/config";
import { splitBreedFee } from "@/engine/breeding";
import { fmtGp } from "@/engine/events";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Breeding — The Pintakasi Handbook",
  description: "Only retired birds breed — the bloodline rule, covers, the fee split, inheritance, and the nest.",
};

export default function BreedingPage() {
  const split = splitBreedFee(ECONOMY.BREED_FEE);
  const stakerPct = Math.round(BREED_SPLIT.STAKER_SHARE * 100);
  const restPct = 100 - stakerPct;
  const juicePct = Math.round(restPct * BREED_SPLIT.JUICE_SHARE_OF_REST);
  const studOwnerPct = restPct - juicePct;
  const coversPerWeek = COVERS.PER_WEEK + COVERS.OWNER_RESERVED;
  const mutationPct = Math.round(BREEDING.MUTATION_CHANCE * 100);
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
        retirement unlocks at age {AGE.FORK}, or it loses a hardcore fight, which force-retires it
        on the spot (see <Link href="/wiki/fighting">Fighting</Link>).
      </p>
      <p>
        That&apos;s the loop, and it&apos;s deliberate: a fighting career <strong>ends</strong>{" "}
        and a breeding life <strong>begins</strong> — the same bird, a second job. Hardcore losses
        and age retirements don&apos;t delete a bird from the game, they feed it into the barn. A
        bird you lost with hardcore, or aged out, is still worth exactly as much to your bloodline
        as one you never risked.
      </p>

      <h2>The bloodline restriction</h2>
      <p>
        You cannot breed a bird with its own kin. Forbidden pairings are checked two ways:
      </p>
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
        A <strong>cover</strong> is one breeding — your hen paired against one rooster, retired,
        of your own or listed by another farm. Buying a cover costs a flat{" "}
        <strong>{ECONOMY.BREED_FEE} GP</strong>, no matter whose stud it is or how decorated its
        record. The hen&apos;s owner pays; the hen&apos;s owner keeps the egg.
      </p>
      <p>
        Every rooster caps out at <strong>{coversPerWeek} covers a game-week</strong>:{" "}
        {COVERS.PER_WEEK} public slots any farm can buy, plus {COVERS.OWNER_RESERVED} reserved for
        the rooster&apos;s own farm. The cap is the point — a popular stud sells out, and demand
        that can&apos;t get in overflows onto other roosters instead of piling endlessly onto one.
      </p>
      <div className="callout tip">
        <b>Listing a retired rooster at stud is income.</b> You can always cover your own hens with
        your own retired rooster, up to the owner-reserved slots, whether or not you&apos;ve listed
        him. <em>Listing</em> him opens the public slots to every other farm&apos;s hens — and
        every cover anyone buys against him pays his owner a share (below). A good retired rooster
        sitting idle in your barn is money left on the table.
      </div>
      <div className="callout warn">
        <b>Listing costs land — the game&apos;s first Land Token sink.</b> Opening a rooster&apos;s
        public slots for the first time costs a flat <strong>{COVERS.STUD_LISTING_LT} LT</strong>,
        spent outright — not staked, not refundable. Pulling him from the barn and re-listing him
        later is free; the land bought the seat, not a subscription. Why this door: a stud is the
        best asset in the game — it earns on every outside cover, and its own owner still breeds
        through it on the reserved slots at nothing above the ordinary fee. A gate that desirable
        is worth paying land for, and it&apos;s the first thing in the game that takes Land Tokens{" "}
        <em>out</em> of the world rather than just paying them out — see{" "}
        <Link href="/wiki/land">Land Tokens</Link> for why a sink is what turns a yield into a
        price.
      </div>

      <h2>The fee split</h2>
      <p>
        A cover&apos;s {ECONOMY.BREED_FEE} GP fee doesn&apos;t all go to one place. It splits three
        ways, computed in exact centi-GP so nothing is lost to rounding:
      </p>
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>Recipient</th>
              <th className="num">Share</th>
              <th className="num">On a {ECONOMY.BREED_FEE} GP cover</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                Land Token stakers (<Link href="/wiki/land">Land</Link>)
              </td>
              <td className="num">{stakerPct}%</td>
              <td className="num">{fmtGp(split.stakerPoolCents)} GP</td>
            </tr>
            <tr>
              <td>
                The juice pool (<Link href="/wiki/pintakasi">the Pintakasi Majors</Link>)
              </td>
              <td className="num">{juicePct}%</td>
              <td className="num">{fmtGp(split.juicePoolCents)} GP</td>
            </tr>
            <tr>
              <td>The stud&apos;s owner</td>
              <td className="num">{studOwnerPct}%</td>
              <td className="num">{fmtGp(split.studOwnerCents)} GP</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="dim">
        The staker cut pays every farm holding Land Tokens, whether or not they ever breed a bird —
        it&apos;s a landholder&apos;s cut of the whole game&apos;s breeding activity. The juice
        pool is the same pot that gacha spend feeds, and it becomes the purse for the Thursday
        championships. Nothing here is printed or burned — every centi-GP in the fee lands
        somewhere real.
      </p>

      <h2>Inheritance</h2>
      <div className="cards-2">
        <div className="minicard">
          <b>The six stats</b>
          Each stat starts at the parents&apos; average, then shifts by up to{" "}
          {BREEDING.STAT_VARIANCE} points either way — that spread is why two eggs from the same
          pair are never identical. On top of that, each stat has a {mutationPct}% chance to
          mutate, swinging it up to {BREEDING.MUTATION_SWING} further points in either direction.
          That&apos;s where a real surprise — a breakout stat, or a dud — comes from.
        </div>
        <div className="minicard">
          <b>Stars and element</b>
          Half-star rating lands within {BREEDING.STAR_SPREAD_HALF_STARS} half-stars of the
          parents&apos; average, up to the {maxStars}★ cap. The chick&apos;s element leans toward
          whichever parent carries the higher star rating most of the time, leans toward the
          other parent less often, and only rarely lands on a completely different element as its
          own small mutation.
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
        {femalePct}/{100 - femalePct} coin flip, sealed until hatch day. You won&apos;t know if
        you bred a hen or a rooster until the egg actually opens.
      </p>

      <h2>The nest rule and the calendar</h2>
      <div className="callout">
        <b>One hen, one egg, at a time.</b> A hen that&apos;s already sitting on an egg cannot take
        another cover — she&apos;s blocked until it hatches. The timeline: buy the cover today, the
        egg is laid on the nearest Friday, and it hatches the Friday after that. Conceive now, lay
        Friday, hatch the following Friday.
      </div>
      <p>
        Plan around it. A hen is a slow, one-at-a-time asset — if you want three chicks out of one
        hen, that&apos;s three separate nest cycles, not three covers in one week. Roosters don&apos;t
        have this limit; that&apos;s exactly why the weekly cover cap above exists on the rooster
        side instead.
      </p>

      <h2>Why breeding is the only way up</h2>
      <p>
        Every gacha bird&apos;s raw stats are deliberately held near or just above the starting
        flock&apos;s stat band — see <Link href="/wiki/gacha">the gacha</Link> for exactly how
        capped. A lucky roll can hand you real stars, but that&apos;s a single injection, not
        something that compounds — the next roll starts from zero again. Breeding is the only path
        where a chick&apos;s stats <em>and</em> stars start from something better than either
        parent — two strong birds plus a lucky mutation roll — and stack again in the next
        generation. The gacha can hand you a good body once. Only the nest hands you quality that
        keeps climbing.
      </p>

      <div className="next">
        <Link href="/wiki/birds">← Birds &amp; stats</Link>
        <Link href="/wiki/gacha">The gacha →</Link>
        <Link href="/wiki/pintakasi">The Pintakasi →</Link>
      </div>
    </>
  );
}
