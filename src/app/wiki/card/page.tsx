import Link from "next/link";
import {
  AGE,
  CALENDAR,
  CARD,
  CLAIMER,
  ECONOMY,
  FIGHT_MODES,
  FORMATS,
  FORMAT_NAMES,
  LOBBIES,
  NW_CAP,
  PINTAKASI,
  STAKER_FLOWS,
  cardOfDay,
  landForFight,
} from "@/engine/config";
import type { FightMode } from "@/engine/config";
import { fmtGp } from "@/engine/events";

export const dynamic = "force-dynamic";

/**
 * Every mode's fee and age gate, keyed by the engine's own FIGHT_MODES — so a
 * mode that leaves the daily card (hardcore did, in round 31) leaves this page
 * with it, and a new one won't compile until it's documented.
 */
const MODE_FEE: Record<FightMode, number> = {
  juvenile: ECONOMY.JUVENILE_ENTRY_FEE,
  real: ECONOMY.REAL_ENTRY_FEE,
};
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

export default function CardPage() {
  const exampleCard = cardOfDay(EXAMPLE_DAY);
  const crownDayCard = cardOfDay(PINTAKASI.DAY_OF_WEEK);

  // How big the space of POSSIBLE fights is, versus how much of it runs on any
  // one day. Both computed, so widening the blade dial or the tag ladder moves
  // these sentences by itself.
  const adultClasses = LOBBIES.filter((c) => c !== "claimer").length;
  const juvenileClasses = LOBBIES.filter((c) => c !== "claimer" && c !== "nw3").length;
  const possibleKeys =
    FORMAT_NAMES.length *
    (adultClasses + CLAIMER.PRICES.length + juvenileClasses + CLAIMER.JUVENILE_PRICES.length);

  return (
    <>
      <h1>The card</h1>
      <p className="lede">
        Every game-day the stewards <strong>post a card</strong> — a short list of the fights
        running tonight. Each line on it is a lobby, named by division, class and blade (plus a tag
        price, for claimers). You enter birds into the lobbies you like; when the day ends, every
        lobby pairs its birds off at random and the fights run.
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
        escrowed the moment you enter, and the bird&apos;s one fight for the day is spent. There is
        no cancelling.
      </p>
      <p>
        Lobbies used to cap out, and a second room opened on the same fight once the first was full.
        That quietly worked against the whole point of a card — splitting a busy fight back into two
        half-empty ones. It also rewarded camping: under a cap, entering late could land you in a
        different room than the one you were watching, so the smart move was to hang back. Now there
        is nothing to wait for. You can always get in, and the number of birds you see in a lobby
        only ever goes up.
      </p>
      <div className="callout warn">
        <b>The catch: an odd lobby still strands one bird.</b> The old cap was an even number on
        purpose — a full room paired everybody. A room with no limit closes on whatever number of
        birds walked in, and if that number is odd, one bird goes home unmatched. It gets its entry
        fee back and earns nothing else: no land, no points, no fight.{" "}
        <strong>Land is for fighting, not queueing.</strong>
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
              <th className="num">Entry fee</th>
              <th>Who may enter</th>
              <th className="num">Land minted, per fighter</th>
            </tr>
          </thead>
          <tbody>
            {FIGHT_MODES.map((mode) => (
              <tr key={mode}>
                <td>{MODE_LABEL[mode]}</td>
                <td className="num">{MODE_FEE[mode]} GP</td>
                <td>{MODE_WHO[mode]}</td>
                <td className="num">{landForFight(MODE_FEE[mode])} LT</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>Class</th>
              <th>Who may enter</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>open</td>
              <td>Any eligible bird — no record requirement.</td>
            </tr>
            <tr>
              <td>maiden</td>
              <td>Birds with zero stakes wins — never won a real fight.</td>
            </tr>
            <tr>
              <td>nw3</td>
              <td>
                Birds with fewer than {NW_CAP} stakes wins. The one conditioned rung between maiden
                and open.
              </td>
            </tr>
            <tr>
              <td>claimer</td>
              <td>
                Entered with a tag price from the claiming ladder — see{" "}
                <Link href="/wiki/claiming">Claiming</Link>.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
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
        Juvenile claimers get their own, cheaper tag ladder — pricing a one-year-old against the
        grown-bird rungs would mean nobody dares tag one at all:
      </p>
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th className="num">Juvenile tag</th>
              <th className="num">≈ $</th>
            </tr>
          </thead>
          <tbody>
            {CLAIMER.JUVENILE_PRICES.map((price) => (
              <tr key={price}>
                <td className="num">{price} GP</td>
                <td className="num">${(price / ECONOMY.GP_PER_DOLLAR).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="dim">
        The card posts {CARD.real.claimer} grown claimers a night — always the cheapest rung (
        {CLAIMER.PRICES[0]} GP) plus one dearer rung, rotating. The cheap rung is where nearly all
        the trade happens, so it is never off the card; a night of nothing but dear tags would price
        half the world out of the marketplace. See <Link href="/wiki/claiming">Claiming</Link> for
        the full sequence — including the rule for a claimer that draws no fight.
      </p>

      <h2>The pot</h2>
      <p>
        Both sides post the entry fee.{" "}
        {STAKER_FLOWS.FIGHT_RAKE === 0
          ? "The daily card takes no cut at all: the winner banks the whole pooled pot, and the loser loses exactly its entry — nothing more, nothing less."
          : `The winner takes the pooled pot, less a ${(STAKER_FLOWS.FIGHT_RAKE * 100).toFixed(0)}% rake that goes to the farms staking Land Tokens, not to the house.`}{" "}
        No GP is ever printed or destroyed here.
      </p>
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>Mode</th>
              <th className="num">Pot (2× entry)</th>
              <th className="num">Winner banks</th>
            </tr>
          </thead>
          <tbody>
            {FIGHT_MODES.map((mode) => {
              const potCents = MODE_FEE[mode] * 2 * 100;
              const rakeCents = Math.round(potCents * STAKER_FLOWS.FIGHT_RAKE);
              return (
                <tr key={mode}>
                  <td>{MODE_LABEL[mode]}</td>
                  <td className="num">{fmtGp(potCents)} GP</td>
                  <td className="num">{fmtGp(potCents - rakeCents)} GP</td>
                </tr>
              );
            })}
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
          The rake is {(STAKER_FLOWS.FIGHT_RAKE * 100).toFixed(0)}% of the whole pot, both entries
          combined — the loser still loses its full entry either way.
        </p>
      )}

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

      <h2>Matchmaking</h2>
      <p>
        When a lobby closes, its birds are paired off at random — but never two birds from the same
        barn. If you enter several birds into one lobby, the draw actively keeps them apart from
        each other.
      </p>
      <p>
        That guarantee has a cost: if a lobby fills unevenly, the surplus from the biggest barn can
        run out of opponents. Whatever&apos;s left over after every cross-barn pair is drawn goes
        home as the odd bird out — fee refunded in full, but no land. A crowded card is the fix for
        that, which is most of why the card exists at all: fewer, fuller lobbies mean far fewer
        birds standing around with nobody to fight.
      </p>

      <h2>After the win</h2>
      <p>
        A win on the daily card banks qualification points toward{" "}
        {DAY_NAMES[PINTAKASI.DAY_OF_WEEK]}&apos;s Pintakasi Majors — {PINTAKASI.POINTS_FOR.real} for
        a real win, {PINTAKASI.POINTS_FOR.juvenile} for juvenile practice. A bird needs{" "}
        {PINTAKASI.QUALIFYING_POINTS} of them to stand in a Major, and a lobby win is the{" "}
        <strong>only</strong> way to earn one — winning a championship banks none. See{" "}
        <Link href="/wiki/pintakasi">The Pintakasi</Link> for the full bracket.
      </p>

      <div className="next">
        <Link href="/wiki/claiming">Claiming →</Link>
        <Link href="/wiki/fighting">Fighting →</Link>
        <Link href="/wiki/pintakasi">The Pintakasi →</Link>
      </div>
    </>
  );
}
