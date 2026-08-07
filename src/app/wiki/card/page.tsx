import Link from "next/link";
import {
  AGE,
  ALL_ENTRY_FEES,
  CALENDAR,
  CARD,
  CLAIMER,
  ECONOMY,
  FIGHTS_PER_GROUP_BIRD,
  FIGHT_MODES,
  FORMATS,
  FORMAT_NAMES,
  GROUP,
  LOBBIES,
  NW_CAP,
  PINTAKASI,
  STAKER_FLOWS,
  cardOfDay,
  feeFor,
  fmtLt,
  landForFight,
  stakePerFight,
} from "@/engine/config";
import type { FightFormat, FightMode } from "@/engine/config";
import { fmtGp } from "@/engine/events";

export const dynamic = "force-dynamic";

/**
 * Every mode's age gate, keyed by the engine's own FIGHT_MODES — so a mode that
 * leaves the daily card (hardcore did, in round 31) leaves this page with it,
 * and a new one won't compile until it's documented.
 *
 * ⚠ THERE IS NO "MODE FEE" ANY MORE (round 42). A division used to have one
 * price; now every CLASS is priced inside every division, so a fee needs both
 * axes and comes through `feeFor`. What a mode still owns is who may enter it.
 */
const MODE_LABEL: Record<FightMode, string> = { juvenile: "Juvenile", real: "Real" };
const MODE_WHO: Record<FightMode, React.ReactNode> = {
  juvenile: <>age {AGE.CHICK} only — the discovery year</>,
  real: (
    <>
      age {AGE.REAL_STAKES}+ (below the age {AGE.FIGHTING_CAP} cap)
    </>
  ),
};

/** dayIndex % 7 → day name (round 20's calendar), purely for display. */
const DAY_NAMES = ["Friday", "Saturday", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"];

/**
 * The worked example below is the world's OPENING day. Any fixed number would
 * do — the card is a pure function of the day index, so this table is the real
 * schedule the engine posts, not an illustration of one.
 */
const EXAMPLE_DAY = 0;

/**
 * How a field of N birds is cut up, using the engine's own levelling rule
 * (Lobbies.dealGroups): as FEW groups as will hold the field, then the sizes
 * levelled across them. Written out here rather than typed as "3+3+3" so the
 * worked example below re-deals itself if GROUP.SIZE ever moves.
 */
function dealSizes(n: number): number[] {
  const count = Math.ceil(n / GROUP.SIZE);
  return Array.from({ length: count }, (_, i) => Math.floor(n / count) + (i < n % count ? 1 : 0));
}

/** The example fields the group-stage table walks through. */
const EXAMPLE_FIELDS = [
  GROUP.SIZE,
  GROUP.SIZE * 2 + 1,
  GROUP.SIZE * 3 + 2,
  GROUP.SIZE * 7 + 2,
];

/**
 * The classes a division actually POSTS, in ladder order — the juvenile card
 * has no nw3 (a one-year-old has no stakes record to sort by), so listing that
 * rung in a juvenile fee table would advertise a fight nobody can enter. Read
 * off CARD rather than asserted, so a widened juvenile card documents itself.
 */
const postedClasses = (mode: FightMode): string[] => Object.keys(CARD[mode]);

/** One priced rung, both divisions — the round-42 ladder in table form. */
type Rung = { label: string; juvenile: number | null; real: number };
const RUNGS: Rung[] = [
  ...(["maiden", "nw3", "open"] as const).map((c) => ({
    label: c as string,
    juvenile: postedClasses("juvenile").includes(c) ? feeFor("juvenile", c) : null,
    real: feeFor("real", c),
  })),
  ...CLAIMER.PRICES.map((price) => ({
    label: `claimer, ${price} GP tag`,
    juvenile: feeFor("juvenile", "claimer", price),
    real: feeFor("real", "claimer", price),
  })),
];

/**
 * The longest a bird ever waits for one particular blade in a division's open
 * class — MEASURED off four weeks of real cards, not asserted.
 *
 * Round 32 widened CARD.juvenile.open to 3 for exactly this number (at 2 the
 * worst gap was four days against a seven-day juvenile career), so the page
 * reads the wait off the schedule itself. Move the slot count and the sentence
 * moves with it; nobody has to remember to re-count.
 */
const GAP_WINDOW = 28;
function worstBladeGap(mode: FightMode): number {
  const lastSeen = new Map<FightFormat, number>();
  let worst = 0;
  for (let day = 0; day < GAP_WINDOW; day++) {
    for (const key of cardOfDay(day)) {
      if (key.mode !== mode || key.classType !== "open") continue;
      const prev = lastSeen.get(key.format);
      if (prev !== undefined) worst = Math.max(worst, day - prev);
      lastSeen.set(key.format, day);
    }
  }
  return worst;
}

export default function CardPage() {
  const exampleCard = cardOfDay(EXAMPLE_DAY);
  const crownDayCard = cardOfDay(PINTAKASI.DAY_OF_WEEK);
  const juvenileGap = worstBladeGap("juvenile");

  // How big the space of POSSIBLE fights is, versus how much of it runs on any
  // one day. Both computed, so widening the blade dial or the tag ladder moves
  // these sentences by itself.
  const adultClasses = LOBBIES.filter((c) => c !== "claimer").length;
  const juvenileClasses = LOBBIES.filter((c) => c !== "claimer" && c !== "nw3").length;
  // ⚠ CLAIMER.PRICES twice, not two different ladders (round 42 merged them):
  // juveniles now card on the SAME tag rungs as grown birds, at half the entry
  // fee. There is no separate juvenile tag ladder left to count.
  const possibleKeys =
    FORMAT_NAMES.length *
    (adultClasses + CLAIMER.PRICES.length + juvenileClasses + CLAIMER.PRICES.length);
  // The span of the priced ladder, for the prose that has to say what a night
  // costs now that there is no single answer.
  const cheapestNight = Math.min(...ALL_ENTRY_FEES);
  const dearestNight = Math.max(...ALL_ENTRY_FEES);

  return (
    <>
      <h1>The card</h1>
      <p className="lede">
        Every game-day the stewards <strong>post a card</strong> — a short list of the fights
        running tonight. Each line on it is a lobby, named by division, class and blade (plus a tag
        price, for claimers). You enter birds into the lobbies you like; when the day ends, every
        lobby deals its birds into small <strong>groups</strong>, and inside a group everybody
        fights everybody. One entry buys your bird a whole night — up to{" "}
        {FIGHTS_PER_GROUP_BIRD} fights, not one.
      </p>

      <h2>Tonight&apos;s card, and tomorrow&apos;s</h2>
      <p>
        This is the rule to learn first: <strong>you can only enter a fight that is posted</strong>.
        There are {possibleKeys} different fights the stewards <em>could</em> run. On any given day
        they run about {exampleCard.length} of them.
      </p>
      <p>
        It used to work the other way. Asking for a fight created it, so every fight existed every
        day — which sounds generous and was actually the problem. The perfect card for your bird
        always existed, because you invented it by asking, and so did everybody else. Birds spread
        themselves across dozens of near-empty rooms, and roughly one entry in six never drew an
        opponent at all. No matchmaker can fix that. Only crowding can.
      </p>
      <p className="dim">
        Crowding got it down to about one entry in twenty, and the last of it was arithmetic rather
        than a shortage of birds: while fights were drawn in <em>pairs</em>, a room holding an odd
        number of birds always sent one home. The group stage below finished the job. Nobody sits
        out any more unless they were the only bird in the room.
      </p>
      <p>
        So now the day picks the fights and you pick from the day. If tonight has nothing perfect
        for your bird, you have two honest choices: run it in a good-enough spot tonight, or wait
        for its blade to come around. That wait is short — a few days at most — and the card for
        tomorrow is published as well, so you are never guessing. Waiting is a real decision with a
        real cost, which is exactly what makes it interesting.
      </p>

      <h3>An example: the world&apos;s first day</h3>
      <p>
        The card is worked out from the day&apos;s number alone, so it is the same for everybody and
        can be read in advance for any day, past or future. Here is the whole card for day{" "}
        {EXAMPLE_DAY}:
      </p>
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>Division</th>
              <th>Class</th>
              <th>Blade</th>
              <th className="num">Tag</th>
            </tr>
          </thead>
          <tbody>
            {exampleCard.map((k) => (
              <tr key={`${k.mode}-${k.classType}-${k.format}-${k.price ?? ""}`}>
                <td>{MODE_LABEL[k.mode]}</td>
                <td>{k.classType}</td>
                <td>{FORMATS[k.format].label}</td>
                <td className="num">{k.price ? `${k.price} GP` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3>Every class runs every day — the blades rotate</h3>
      <p>
        Look down that Class column and you will see each class appear on every card. That is
        deliberate, and it is the heart of the design.
      </p>
      <p>
        The classes <strong>nest</strong>: a bird that may enter a maiden may also enter nw3, and a
        bird that may enter nw3 may also enter open. But it does not work upwards. Once a bird has
        won {NW_CAP} times at real stakes it is an <em>open</em> bird and nothing else — so if open
        were ever left off the card, every veteran in the game would have nowhere to run that night.
        <strong> Nothing may ever be locked out of the game.</strong>
      </p>
      <p>
        The scarcity goes on the <strong>blade</strong> instead — only some of the{" "}
        {FORMAT_NAMES.length} blades run for each class each day. That is the right place for it,
        because the blade is the discovery axis: which distance suits your bird is the most
        interesting question you have about it. So the choice the card forces on you is
        &ldquo;wait for its distance, or find out how it handles a different one&rdquo; — never
        &ldquo;sit out&rdquo;.
      </p>
      <p>
        The blades are dealt from a shuffled deck rather than drawn at random each day, so no blade
        can vanish for a week on bad luck. Every blade is guaranteed to come around. That matters
        most for one-year-olds: the discovery year is only{" "}
        {CALENDAR.DAYS_PER_WEEK} game-days long, and a chick can&apos;t afford to wait out a blade
        that never shows.
      </p>
      <p>
        Which is why the one-year-olds get the wider deal. The juvenile open class is dealt{" "}
        {CARD.juvenile.open} of the {FORMAT_NAMES.length} blades every single night — as wide a
        rotation as any class on the card gets. Do the arithmetic
        and the reason is plain: a discovery year lasts {CALENDAR.DAYS_PER_WEEK} game-days, and no more than{" "}
        {juvenileGap} days ever pass between two runnings of the same juvenile blade. Every chick
        gets offered every distance while it is still young enough to try them.
      </p>
      <p className="dim">
        It used to be a narrower deal, and the sums didn&apos;t work. A chick could reach its
        second birthday having never once been offered two of the {FORMAT_NAMES.length} blades —
        which means it spent the only year it is allowed to experiment in never finding out what it
        was. That is the whole job of the discovery year, so the juvenile card was widened until
        the wait fit inside a career.
      </p>
      <div className="callout tip">
        <b>{DAY_NAMES[PINTAKASI.DAY_OF_WEEK]} is thinner on purpose.</b> That is the Pintakasi
        Majors&apos; crown day, and every bird registered for a Major is barred from the daily card —
        its crown <em>is</em> its card. With that many birds missing, the adult open class drops to{" "}
        {CARD.CROWN_DAY_OPEN_BLADES} blades instead of {CARD.real.open}, so the fights that do run
        still fill up. {DAY_NAMES[PINTAKASI.DAY_OF_WEEK]}&apos;s card carries{" "}
        {crownDayCard.length} lobbies rather than {exampleCard.length}.
      </div>

      <h2>What a lobby is</h2>
      <p>
        There is exactly <strong>one lobby per posted fight</strong>, and it has no size limit.
        Everybody who enters that fight tonight is in the same room. Entering is binding: the fee is
        escrowed the moment you enter, and the bird&apos;s one entry for the day is spent. There is
        no cancelling.
      </p>
      <p className="dim">
        One <em>entry</em> a day, note — not one fight. A bird may be carded once per game-day, and
        that single card is what buys it its group of fights below.
      </p>
      <p>
        Lobbies used to cap out, and a second room opened on the same fight once the first was full.
        That quietly worked against the whole point of a card — splitting a busy fight back into two
        half-empty ones. It also rewarded camping: under a cap, entering late could land you in a
        different room than the one you were watching, so the smart move was to hang back. Now there
        is nothing to wait for. You can always get in, and the number of birds you see in a lobby
        only ever goes up.
      </p>
      <h2>The group stage</h2>
      <p className="lede">
        This is the newest rule in the game, and the one that changes the shape of a night. When a
        lobby closes, it does not draw pairs. It deals its birds into <strong>groups</strong> of at
        most {GROUP.SIZE}. Everybody in a group fights everybody else in that group. So one entry
        buys your bird up to <strong>{FIGHTS_PER_GROUP_BIRD} fights in a night</strong>.
      </p>
      <p>
        Three fights is a real evening of evidence. One figure is an opinion; three, at the same
        blade, on the same night, is something you can actually read a bird by — which is the whole
        point of the discovery year and most of the point of carding a grown bird at all. See{" "}
        <Link href="/wiki/fighting">Fighting</Link> for how to read the figures it hands you.
      </p>

      <h3>How the groups are dealt</h3>
      <p>
        The sizes are <strong>levelled</strong>, not packed. The lobby uses as few groups as will
        hold the field and then spreads the birds evenly across them, so a field of nine becomes
        three groups of three rather than {GROUP.SIZE}+{GROUP.SIZE}+1. That is the rule that makes
        the old problem go away: there is no leftover bird, because there is no leftover.
      </p>
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th className="num">Birds in the lobby</th>
              <th>Groups dealt</th>
              <th className="num">Fights each bird gets</th>
            </tr>
          </thead>
          <tbody>
            {EXAMPLE_FIELDS.map((n) => {
              const sizes = dealSizes(n);
              return (
                <tr key={n}>
                  <td className="num">{n}</td>
                  <td>{sizes.join(" + ")}</td>
                  <td className="num">
                    {sizes[0] === sizes[sizes.length - 1]
                      ? sizes[0] - 1
                      : `${sizes[sizes.length - 1] - 1}–${sizes[0] - 1}`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p>
        A group of {GROUP.SIZE} is {FIGHTS_PER_GROUP_BIRD} fights. A group of three is two fights, a
        group of two is one. Below {GROUP.MIN_SIZE} birds there is no fight to make at all — a bird
        alone in an empty room is the one case left where nobody gets carded, and it is refunded in
        full.
      </p>
      <div className="callout tip">
        <b>Why {GROUP.SIZE} and not eight.</b> Every extra bird in a group costs everyone else
        another fight, and it climbs fast: a group of six would be five fights a bird in one night. A
        group of {GROUP.SIZE} is already a full evening — enough evidence to read a bird by, without
        a single card deciding its whole career.
      </div>

      <h3>Barn-mates are kept apart</h3>
      <p>
        Two birds from the same farm never fight each other. That rule has always held, and the deal
        works to protect it: the biggest barn in the room is dealt out first, while there is still
        room to spread it across groups. Enter five birds into one lobby and the deal will do its
        best to put all five in different groups.
      </p>
      <p>
        Sometimes it can&apos;t — a room where most of the birds are yours has nowhere to spread
        them. Then two of your birds share a group, that pairing is simply skipped, and both of them
        fight one fewer time. Nothing is lost: they only pay for the fights they got (below).
      </p>

      <h3>You pay per fight, and the rest comes back</h3>
      <p>
        The entry fee is the price of the <em>night</em>, and it splits evenly across the{" "}
        {FIGHTS_PER_GROUP_BIRD} fights the night can hold. It escrows whole when you enter; each
        fight risks one share; anything your bird never got to risk is handed straight back when the
        card settles.
      </p>
      <p>
        <strong>What a night costs depends on the company.</strong> Every class has its own price —
        from {cheapestNight} GP up to {dearestNight} GP — and the whole point of that is on its own
        page: <Link href="/wiki/ladder">Fighting up</Link>. Two rungs, for the arithmetic:
      </p>
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>A night at&hellip;</th>
              <th className="num">Entry fee</th>
              <th className="num">Risked per fight</th>
              <th className="num">Full card of {FIGHTS_PER_GROUP_BIRD}</th>
              <th className="num">Short card of {FIGHTS_PER_GROUP_BIRD - 1}</th>
            </tr>
          </thead>
          <tbody>
            {[
              { label: "Grown maiden or nw3", fee: feeFor("real", "maiden") },
              { label: "Grown open", fee: feeFor("real", "open") },
            ].map((row) => {
              const stake = stakePerFight(row.fee);
              return (
                <tr key={row.label}>
                  <td>{row.label}</td>
                  <td className="num">{row.fee} GP</td>
                  <td className="num">{stake} GP</td>
                  <td className="num">{stake * FIGHTS_PER_GROUP_BIRD} GP risked, 0 back</td>
                  <td className="num">
                    {stake * (FIGHTS_PER_GROUP_BIRD - 1)} GP risked, {stake} GP back
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="callout tip">
        <b>Every price divides by {FIGHTS_PER_GROUP_BIRD}.</b> That is not an accident. One entry
        buys a group, the group is up to {FIGHTS_PER_GROUP_BIRD} fights, and the stake has to split
        across them without leaving a fraction of a peso behind. So every fee on the ladder is a
        multiple of {FIGHTS_PER_GROUP_BIRD} — the cheapest night in the game is {cheapestNight} GP and
        the dearest is {dearestNight} GP, and both divide clean.
      </div>
      <div className="callout warn">
        <b>Land is paid once, on what you actually risked.</b> Not once per fight. When the card
        settles, your bird earns Land Tokens on the total it put up that night — a full card of{" "}
        {FIGHTS_PER_GROUP_BIRD} grown open fights mints {fmtLt(landForFight(feeFor("real", "open")))}{" "}
        LT, a short card of {FIGHTS_PER_GROUP_BIRD - 1} mints{" "}
        {fmtLt(
          landForFight(stakePerFight(feeFor("real", "open")) * (FIGHTS_PER_GROUP_BIRD - 1))
        )}{" "}
        LT. Those decimals are real: land is minted in hundredths of a token, so an award is almost
        never a round number. A bird that drew nobody at all earns none.{" "}
        <strong>Land is for fighting, not queueing.</strong> And because the curve underneath is
        steeper than a straight line, a dearer class mints more land than its extra cost — see{" "}
        <Link href="/wiki/land">Land Tokens</Link>.
      </div>

      <h2>The board</h2>
      <p>
        The lobby board shows tonight&apos;s card, not just the rooms people have already walked
        into. A posted fight that nobody has entered yet appears with a count of zero. That is real
        information: it is a fight you could be first into, and being first is often how a good
        lobby gets started.
      </p>

      <h2>The two divisions</h2>
      <p>
        The mode sets the stakes. Juvenile is practice — it builds an amateur record and nothing
        more. Real is where a career actually lives.
      </p>
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>Mode</th>
              <th>Who may enter</th>
              <th className="num">A maiden night</th>
              <th className="num">An open night</th>
            </tr>
          </thead>
          <tbody>
            {FIGHT_MODES.map((mode) => (
              <tr key={mode}>
                <td>{MODE_LABEL[mode]}</td>
                <td>{MODE_WHO[mode]}</td>
                <td className="num">{feeFor(mode, "maiden")} GP</td>
                <td className="num">{feeFor(mode, "open")} GP</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>
        Every juvenile rung is exactly <strong>half</strong> its grown twin. A one-year-old is still
        learning what it is, and the year it learns in should not cost what a veteran&apos;s does.
      </p>
      <p>
        Juveniles fight only juveniles — the discovery-year gate reads the bird&apos;s age, not its
        class, so a grown bird can never drop down and bully a chick&apos;s card.
      </p>
      <div className="callout warn">
        <b>There is no hardcore fight on the daily card.</b> Hardcore means the loser&apos;s career
        ends on the spot, and it now runs in one place only: the{" "}
        <Link href="/wiki/pintakasi">Pintakasi Majors</Link>, where every bout is hardcore. It used
        to be a third mode you could enter any night, and almost nobody did — a handful of entries a
        week, nearly half of which never found an opponent. A fight that dangerous should be the
        biggest stage in the game, not a lonely room on a Tuesday. (The Juvenile Championship is the
        one championship that is <em>not</em> hardcore.)
      </div>

      <h2>The class ladder</h2>
      <p>
        The class narrows who may enter, so the field sorts itself without a matchmaker having to
        judge anybody&apos;s strength. The {LOBBIES.length} classes: {LOBBIES.join(" · ")}.
      </p>
      <p>
        Each rung has its <strong>own price</strong>, and the harder the company the dearer the night.
        That is the single most important thing to understand about placing a bird, so it has its own
        page — <Link href="/wiki/ladder">Fighting up</Link> — and this is just the summary:
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
            <tr>
              <td>maiden</td>
              <td>Birds with zero stakes wins — never won a real fight.</td>
              <td className="num">{feeFor("juvenile", "maiden")} GP</td>
              <td className="num">{feeFor("real", "maiden")} GP</td>
            </tr>
            <tr>
              <td>nw3</td>
              <td>
                Birds with fewer than {NW_CAP} stakes wins. The one conditioned rung between maiden
                and open.
              </td>
              <td className="num">not posted</td>
              <td className="num">{feeFor("real", "nw3")} GP</td>
            </tr>
            <tr>
              <td>open</td>
              <td>Any eligible bird — no record requirement, and no protection either.</td>
              <td className="num">{feeFor("juvenile", "open")} GP</td>
              <td className="num">{feeFor("real", "open")} GP</td>
            </tr>
            <tr>
              <td>claimer</td>
              <td>
                Entered with a tag price from the claiming ladder — see{" "}
                <Link href="/wiki/claiming">Claiming</Link>. The cheaper the tag, the cheaper the
                night.
              </td>
              <td className="num">
                {RUNGS.filter((r) => r.label.startsWith("claimer"))
                  .map((r) => r.juvenile)
                  .join(" / ")}{" "}
                GP
              </td>
              <td className="num">
                {RUNGS.filter((r) => r.label.startsWith("claimer"))
                  .map((r) => r.real)
                  .join(" / ")}{" "}
                GP
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="dim">
        Maiden and nw3 cost the same money deliberately. A group stage hands out up to{" "}
        {FIGHTS_PER_GROUP_BIRD} fights a night, so most birds win their first fight almost at once and
        spend their real early career in nw3 — pricing the two rungs apart would tax an accident of
        timing. It is the step up to <em>open</em> that costs, because that is the step where the
        company genuinely changes.
      </p>
      <div className="callout tip">
        <b>The rule that&apos;s easy to miss.</b> The ladder reads a bird&apos;s <em>stakes</em>{" "}
        wins — real fights only — never its lifetime record. A juvenile&apos;s practice wins
        don&apos;t count. Without this, every two-year-old would arrive with an amateur win already
        on its card and the maiden class would never open for anybody.
      </div>
      <p className="dim">
        There used to be a second conditioned class, for birds under two stakes wins. It was cut:
        one win apart from nw3, it split an already thin field in half for no gain. Juvenile lobbies
        run <em>open</em>, <em>maiden</em> and <em>claimer</em> only — nw3 stays out, since a
        one-year-old hasn&apos;t fought long enough to have the record it sorts by.
      </p>

      <h2>The discovery-year ladder</h2>
      <p>
        The juvenile season isn&apos;t one flat division. It runs its own maiden, open (stakes),
        and claimer classes — the same shape as the grown card, so a bird learns the ladder in the
        one year its results don&apos;t follow it forever.
      </p>
      <div className="callout tip">
        <b>Which record it reads is the trick.</b> A grown bird&apos;s maiden class reads its{" "}
        <em>stakes</em> wins — real fights only. A one-year-old has no stakes record yet, so its
        juvenile maiden class reads its <em>juvenile</em> wins instead — the same rule, pointed at
        whichever record the bird is actually old enough to have.
      </div>
      <p>
        Juvenile claimers run on the <strong>same tag ladder</strong> as grown birds — the same{" "}
        {CLAIMER.PRICES.join(" / ")} GP rungs — but at <strong>half the entry fee</strong>:
      </p>
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th className="num">Tag</th>
              <th className="num">≈ $</th>
              <th className="num">Juvenile entry</th>
              <th className="num">Grown entry</th>
            </tr>
          </thead>
          <tbody>
            {CLAIMER.PRICES.map((price) => (
              <tr key={price}>
                <td className="num">{price} GP</td>
                <td className="num">${(price / ECONOMY.GP_PER_DOLLAR).toFixed(2)}</td>
                <td className="num">{feeFor("juvenile", "claimer", price)} GP</td>
                <td className="num">{feeFor("real", "claimer", price)} GP</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="dim">
        One ladder, two prices, and the split is the interesting part. The <em>tag</em> says what the
        bird is worth; the <em>entry</em> says what a night costs. A one-year-old that has campaigned
        has real earnings behind it, so it is worth a grown bird&apos;s price — but the season it
        earned them in is still half price to run. There used to be a separate, much cheaper juvenile
        tag ladder, and once juvenile entries cost real money that ladder would have made the
        discovery year the bargain bin of the game.
      </p>
      <p className="dim">
        The card posts {CARD.real.claimer} grown claimers a night — always the cheapest rung (
        {CLAIMER.PRICES[0]} GP) plus one dearer rung, rotating. The cheap rung is where nearly all
        the trade happens, so it is never off the card; a night of nothing but dear tags would price
        half the world out of the marketplace. See <Link href="/wiki/claiming">Claiming</Link> for
        the full sequence — including the rule for a claimer that draws no fight.
      </p>

      <h2>The pot</h2>
      <p>
        Every fight has its own pot, and it is built from <strong>stakes, not entry fees</strong>.
        Both birds put up one share of their entry — {stakePerFight(feeFor("real", "open"))} GP each in
        a grown open fight — so the pot for one fight is two shares, not two entries. Everybody in a
        lobby paid the same entry fee, because the price belongs to the fight and not to the bird, so
        the two sides of a pot are always level. Win all {FIGHTS_PER_GROUP_BIRD} and you take{" "}
        {FIGHTS_PER_GROUP_BIRD} pots.{" "}
        {STAKER_FLOWS.FIGHT_RAKE === 0
          ? "The daily card takes no cut at all: the winner banks the whole pot, and the loser loses exactly its stake — nothing more, nothing less."
          : `The winner takes the pot, less a ${(STAKER_FLOWS.FIGHT_RAKE * 100).toFixed(0)}% rake that goes to the farms staking Land Tokens, not to the house.`}{" "}
        No GP is ever printed or destroyed here.
      </p>
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>A fight in&hellip;</th>
              <th className="num">Entry fee</th>
              <th className="num">Stake, per fight</th>
              <th className="num">Pot (2 stakes)</th>
              <th className="num">Winner banks</th>
            </tr>
          </thead>
          <tbody>
            {RUNGS.filter((r) => !r.label.startsWith("claimer")).flatMap((r) =>
              FIGHT_MODES.map((mode) => {
                const fee = mode === "juvenile" ? r.juvenile : r.real;
                if (fee === null) return null;
                const stake = stakePerFight(fee);
                const potCents = stake * 2 * 100;
                const rakeCents = Math.round(potCents * STAKER_FLOWS.FIGHT_RAKE);
                return (
                  <tr key={`${mode}-${r.label}`}>
                    <td>
                      {MODE_LABEL[mode]} {r.label}
                    </td>
                    <td className="num">{fee} GP</td>
                    <td className="num">{stake} GP</td>
                    <td className="num">{fmtGp(potCents)} GP</td>
                    <td className="num">{fmtGp(potCents - rakeCents)} GP</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      {STAKER_FLOWS.FIGHT_RAKE === 0 ? (
        <p className="dim">
          The plumbing for a fight-pot rake still exists in the settings (currently{" "}
          {(STAKER_FLOWS.FIGHT_RAKE * 100).toFixed(0)}%) so a future season can turn it back on —
          today it&apos;s off, and the daily card is a pure pot. The claiming tag still pays a
          rake; see <Link href="/wiki/claiming">Claiming</Link>.
        </p>
      ) : (
        <p className="dim">
          The rake is {(STAKER_FLOWS.FIGHT_RAKE * 100).toFixed(0)}% of the whole pot, both stakes
          combined — the loser still loses its full stake either way.
        </p>
      )}
      <p className="dim">
        So a bird that sweeps its group doubles its money: an entry of {feeFor("real", "open")} GP in
        the grown open comes back as{" "}
        {stakePerFight(feeFor("real", "open")) * 2 * FIGHTS_PER_GROUP_BIRD} GP, and one that loses all{" "}
        {FIGHTS_PER_GROUP_BIRD} is out its entry and nothing more. Every fight in between just adds
        up. That is true at every rung, because the pot is always two stakes — which is exactly why
        the dearer classes are worth entering with a bird that can win, and exactly why they are
        punishing with one that can&apos;t.
      </p>
      <p className="dim">
        A night is a small run of results rather than a single coin flip, which is the point: one bad
        draw no longer decides what you learned about your bird.
      </p>

      <h2>The fog</h2>
      <p>
        The fog has two layers, and they&apos;re the same doctrine: <strong>you don&apos;t get to
        know who you&apos;re fighting, and you don&apos;t get to know exactly what any live bird
        is</strong> — not even your own.
      </p>
      <p>
        The first layer covers <strong>who is entered</strong>. Every lobby on the board shows how
        many birds are in it — that count is always public. What it does not show, while the lobby
        is still open, is whose birds they are. You can see that a lobby has seven birds waiting;
        you can&apos;t see which farms or which birds until the lobby closes and the draw is made.
      </p>
      <p>
        The second layer covers <strong>what a live bird is</strong>. A fighting bird&apos;s six
        stats are sealed until it retires — the card shows stars, element, record, and figures,
        never the sheet (see <Link href="/wiki/birds">Birds &amp; stats</Link>). So even when a
        field <em>is</em> visible, as in a claimer, you&apos;re reading a scout report, not a
        spreadsheet.
      </p>
      <p>
        The point of both layers is the same: nobody can dodge a strong bird by scouting first,
        and an average bird stays worth carding instead of getting cherry-picked around. Judging a
        lobby&apos;s likely strength from the fill count, and a bird&apos;s likely quality from
        its figures, is the skill.
      </p>
      <p>
        Claimer lobbies are the deliberate exception: their fields are visible from the moment a
        bird is entered. You can&apos;t place a claim on a bird you can&apos;t see — fighting for a
        tag means accepting the exposure.
      </p>

      <h2>The draw</h2>
      <p>
        When a lobby closes, the deal happens and the fog lifts together. You see the whole field,
        and you see your bird&apos;s group — the birds it is about to fight, all{" "}
        {FIGHTS_PER_GROUP_BIRD} of them if the group filled. Your own barn-mates are not on that
        list, because your bird will never be matched against them.
      </p>
      <p>
        An empty list means your bird drew nobody: it was alone in the room. That is the only way a
        card comes to nothing now, and it refunds in full when the day settles. A crowded card is
        still the fix — the fuller the lobby, the fuller everybody&apos;s group.
      </p>

      <h2>After the win</h2>
      <p>
        A win pays you the pot, and the pot is not the only thing it buys. The GP a bird wins goes
        on its <strong>career earnings</strong>, and career earnings are how the Selection Committee
        decides who gets a seat at {DAY_NAMES[PINTAKASI.DAY_OF_WEEK]}&apos;s Pintakasi Majors. There
        is no separate points counter to bank any more, and no test to pass: any age-{AGE.FORK}+
        bird may declare for a Major by paying the {PINTAKASI.ENTRY_FEE} GP entry. But the fee buys
        no seat and the seats are limited, so what a bird has won on the
        ordinary card is what keeps it in the field. Each fight in the group counts on its own, so a
        bird that sweeps a full group of {FIGHTS_PER_GROUP_BIRD} climbs that list hard in one night
        — and every fight goes on its lifetime record too. See{" "}
        <Link href="/wiki/pintakasi">The Pintakasi</Link> for the seating rules and the full bracket.
      </p>

      <div className="next">
        <Link href="/wiki/ladder">Fighting up →</Link>
        <Link href="/wiki/claiming">Claiming →</Link>
        <Link href="/wiki/fighting">Fighting →</Link>
        <Link href="/wiki/pintakasi">The Pintakasi →</Link>
      </div>
    </>
  );
}
