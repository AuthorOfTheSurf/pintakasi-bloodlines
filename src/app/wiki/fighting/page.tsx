import Link from "next/link";
import { gradeOf } from "@/engine/grades";
import {
  BATTLE,
  ELEMENTS,
  FIGURE,
  FORMATS,
  FORMAT_NAMES,
  PHASES,
  STARS,
  STATS,
  WEATHER,
  type FightFormat,
} from "@/engine/config";

export const dynamic = "force-dynamic";

/**
 * Rank the blades sprint → classic purely off their configured turn
 * caps, so the nicknames can't drift out of sync with the numbers next
 * to them if a balance pass reorders them.
 */
const DISTANCE_NICKNAMES = ["the sprint", "the hybrid", "the route", "the marathon", "the classic"];
const byLength = [...FORMAT_NAMES].sort((a, b) => FORMATS[a].maxTurns - FORMATS[b].maxTurns);
const distanceNickname = new Map<FightFormat, string>(
  byLength.map((name, i) => [name, DISTANCE_NICKNAMES[i] ?? `stage ${i + 1}`])
);

// Same trick for "swingy vs. true test": rank by crit multiplier, top half
// is swingy. Knives sweep this today, but the label reads off the numbers
// instead of assuming which blade key means what.
const byCrit = [...FORMAT_NAMES].sort((a, b) => FORMATS[b].critMult - FORMATS[a].critMult);
const swingy = new Set(byCrit.slice(0, Math.ceil(byCrit.length / 2)));

/**
 * What a TYPICAL STARTER's whole stat block is worth on a single turn roll.
 * This is the only honest yardstick for every flat bonus in the game, and it
 * exists as a derived value rather than a sentence because getting it wrong
 * is exactly how the element edge shipped at double its intended strength:
 * "+1 on 2d6 is half a die" reads as nothing, while "+1 against 0.80" reads
 * as what it is. Moves by itself if the starter band or ROLL_DIVISOR moves.
 */
const starterRollTerm = (
  (STATS.STARTER_MIN + STATS.STARTER_MAX) /
  2 /
  BATTLE.ROLL_DIVISOR
).toFixed(2);

/** The middle of the starter band — what a fresh bird's stats look like. */
const starterStat = Math.round((STATS.STARTER_MIN + STATS.STARTER_MAX) / 2);

/**
 * How wide one letter grade is, in stat points — MEASURED off `gradeOf`
 * rather than typed, because the whole point of the round-30 figure is that
 * "one grade = a fixed number of figure points" stays true by itself. If the
 * grade ladder is ever re-banded, the sentence below re-bands with it.
 */
const GRADE_BAND = (() => {
  let stat = 0;
  while (gradeOf(stat) === gradeOf(0)) stat += 1;
  return stat;
})();

/** The spine: what a bird with `stat` in every stat is worth, at any blade. */
const spineOf = (stat: number) => (stat / FIGURE.PEG_STAT) * FIGURE.PEG_FIGURE;

/** One letter grade, in figure points. Uniform everywhere on the ladder. */
const figurePerGrade = spineOf(GRADE_BAND);

/**
 * The specialist measurement quoted below — 600 fights a cell, taken from the
 * engine after the round-30 rebuild on a bird carrying +200 on the stats its
 * home blade keys and −200 on the rest. These are MEASUREMENTS, not config, so
 * they are written down; the config comment in `FIGURE` is their source.
 */
const SPECIALIST = [
  { base: 320, figures: [37.0, 32.0, 25.8, 16.3, 13.2] },
  { base: 500, figures: [54.7, 49.4, 43.1, 31.1, 27.1] },
  { base: 800, figures: [84.5, 79.6, 74.0, 58.8, 53.7] },
  { base: 1200, figures: [127.7, 122.2, 118.0, 103.0, 95.7] },
  { base: 1600, figures: [175.7, 170.8, 168.2, 153.0, 147.6] },
];

/** The blade that specialist fits best — read off the measurement, not typed. */
const specialistHomeBlade =
  FORMAT_NAMES[SPECIALIST[0].figures.indexOf(Math.max(...SPECIALIST[0].figures))];

/**
 * Render a blade's weight row, biggest stat first, so the "stats that decide
 * it" column reads straight off the engine's own matrix and reorders itself
 * if a balance pass retunes a blade.
 */
function weightLine(weights: Record<string, number>): string {
  return Object.entries(weights)
    .sort((a, b) => b[1] - a[1])
    .map(([stat, w]) => `${stat} ${Math.round(w * 100)}%`)
    .join(" · ");
}

export default function FightingPage() {
  return (
    <>
      <h1>Fighting</h1>
      <p className="lede">
        Every fight is decided by a blade, a lot of dice, and two hidden meters: wind and gameness.
        You can&apos;t see any of this math anywhere else in the game — this page is the whole
        engine, in plain words. Read it once and every result on the card will make sense.
      </p>

      <h2>The five blades</h2>
      <p>
        The blade is the game&apos;s version of race distance. The five blades are numbered{" "}
        <strong>B1 through B5</strong>, from the shortest fights to the longest — think of them
        as points on one dial, not five separate weapons. B3 sits at the exact middle of that
        dial. The number decides how many turns a fight can run, how hard each hit lands, and —
        because of that — which of a bird&apos;s stats actually get to matter. The low end (B1,
        B2 — the knives) is short and swingy: a lucky double can end it in one blow, so upsets
        happen. The high end (B4, B5 — the gaffs) runs long and true: the bird with the better
        engine usually shows it by the end.
      </p>
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>Blade</th>
              <th>Character</th>
              <th>Stats that decide it</th>
              <th className="num">Length</th>
            </tr>
          </thead>
          <tbody>
            {FORMAT_NAMES.map((name) => {
              const fmt = FORMATS[name];
              return (
                <tr key={name}>
                  <td>
                    <strong>{fmt.label}</strong>
                    <br />
                    <span className="dim">
                      {fmt.flavor} · {distanceNickname.get(name)}
                    </span>
                  </td>
                  <td>
                    {swingy.has(name)
                      ? "Swingy — a Tari Strike (doubles on the dice) can decide it in one hit."
                      : "A true test — a lucky roll barely moves the needle."}
                  </td>
                  <td>{weightLine(fmt.weights)}</td>
                  <td className="num">up to {fmt.maxTurns} turns</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p>
        Reading the &ldquo;stats that decide it&rdquo; column: those are the blade&apos;s{" "}
        <strong>weights</strong> — how much of each stat joins every single roll on that blade.
        Every stat counts a little everywhere; the weights decide how much. B1 is agility country
        (the burst off the break), B2 leans on sight (accuracy in a real trade), B3 weighs all
        four <em>exactly equally</em> — the one blade where a perfectly flat bird is the best
        bird — B4 leans on stamina (the fuel tank, below), and B5 belongs to gameness (grit in
        the deep water). Think of the four stats as Start, Speed, Stamina and Finish on a race
        dial: neighbors share, and the ends are opposites.
      </p>
      <p className="dim">
        Star rating never touches these stats. Stars set how loudly a bird&apos;s{" "}
        <em>element</em> plays — the wheel edge and the weather edge both scale with stars, from
        nothing at 0★ up to the full value at {STARS.MAX_HALF_STARS / 2}★ (see{" "}
        <Link href="/wiki/birds">Birds &amp; stats</Link>). The same scaling whether the fight
        lasts {FORMATS.b1.maxTurns} turns or {FORMATS.b5.maxTurns}.
      </p>

      <div className="cards-2">
        <div className="minicard">
          <b>Station — the underdog&apos;s heart</b>
          If your fighting stats (everything except station itself) total behind your
          opponent&apos;s, your station claws back part of that gap on every roll — smoothly,
          with no magic cutoff. The further behind you are and the more station you carry, the
          bigger the claw, up to {BATTLE.UNDERDOG_CLAWBACK * 100}% of the gap&apos;s value at a
          perfect {STATS.MAX} station. It never claws back the <em>whole</em> gap, so the
          better bird is always still the favorite — station makes upsets possible, not free.
          Between even birds it does nothing (for now — a Crowd Noise mechanic is planned).
        </div>
        <div className="minicard">
          <b>Condition — the wildcard</b>
          Each turn, each bird rolls its &ldquo;form&rdquo; for that turn, somewhere between a
          floor and a perfect 1.0. Condition sets the floor — from {BATTLE.WORST_FORM} at the
          bottom up toward 1.0 as condition climbs toward {STATS.MAX}. High condition means
          the bird delivers what it is, nearly every turn; low condition means some turns just
          arrive ugly. It targets no blade and no phase — it makes everything else more real,
          which is why a condition advantage can quietly cover a stat weakness.
        </div>
      </div>

      <h2>How a fight resolves, turn by turn</h2>
      <ol>
        <li>
          <strong>Wind is the health bar — and it&apos;s the same for everyone.</strong> Every bird
          starts every fight with exactly {BATTLE.WIND} wind. No stat buys hit points. It only
          ever goes down once the fight starts.
        </li>
        <li>
          <strong>Both birds roll every turn.</strong> Two six-sided dice, plus a sliver of the
          bird&apos;s stats — all four distance stats, blended by the blade&apos;s weights from
          the table above — scaled down by dividing by {BATTLE.ROLL_DIVISOR} so a huge stat edge
          still can&apos;t out-muscle the dice entirely.
        </li>
        <li>
          <strong>The fuel tank — stamina&apos;s real job.</strong> A bird fights at full power
          for {BATTLE.FUEL.BASE_TURNS} turns, plus {BATTLE.FUEL.TURNS_PER_STAMINA} more per point
          of stamina. When the tank empties, the bird <strong>hits the wall</strong>: its agility
          and sight deliver only {Math.round(BATTLE.FUEL.WALL_FACTOR * 100)}% of themselves for
          the rest of the fight. Stamina and gameness never fade — the tank <em>is</em>{" "}
          stamina&apos;s mechanic, and grit is mental. A sprint ends before any tank empties; the
          deep-water blades are decided by who is still fighting at full book when it matters.
        </li>
        <li>
          <strong>Element can tip a roll.</strong> If your element overcomes your opponent&apos;s
          in the wuxing cycle, you get a flat +{BATTLE.ELEMENT_EDGE} on every roll. To know whether
          that is a lot, read it against the line above — never against the dice. A starter
          bird&apos;s <em>entire</em> stat block, divided by {BATTLE.ROLL_DIVISOR}, is worth about{" "}
          {starterRollTerm} on a roll. So the matchup is worth a good part of everything the bird
          itself brings, which is why the element wheel is not decoration. But it is smaller than
          the bird, and much smaller than the dice: between two evenly matched birds, the one with
          the matchup wins clearly more often than it loses, and still loses plenty.
        </li>
        <li>
          <strong>Whoever rolls higher lands the hit.</strong> Damage is the roll&apos;s margin ×
          the blade&apos;s damage multiplier. Rolling doubles is a{" "}
          <strong>Tari Strike</strong> — a critical hit that multiplies the damage again by the
          blade&apos;s crit multiplier. This is where knives do their swingy work: a big Tari
          Strike in a {FORMATS.b1.maxTurns}-turn fight can be the whole story.
        </li>
        <li>
          <strong>The morale check — once per fight.</strong> The instant a bird&apos;s wind first
          drops under {Math.round(BATTLE.QUIT_WIND_FRACTION * 100)}% of its max, two things
          trigger. Its gameness (divided by {BATTLE.GAMENESS_DIVISOR}) starts adding to every roll
          it makes for the rest of the fight — grit holding a hurt bird together. And it rolls once
          to decide whether it keeps fighting: the chance of quitting is{" "}
          {Math.round(BATTLE.QUIT_BASE_CHANCE * 100)}% × (1 − gameness ÷ {STATS.MAX}). High-gameness
          birds almost never run; low-gameness birds that get hurt early often do.
        </li>
        <li>
          <strong>The fight ends</strong> the moment one of these happens: a bird runs (the other
          wins); a bird&apos;s wind hits zero (the other wins); the blade&apos;s turn cap is
          reached and one bird still holds more wind (that bird wins on decision); or the turn cap
          is reached dead-even (the judges flip a coin).
        </li>
      </ol>
      <div className="callout warn">
        <b>A bird can quit.</b> The morale check above is real — a low-gameness bird that gets hurt
        early can break and run, losing the fight outright even with wind still left in the tank.
        Gameness is the stat that keeps a bird in a fight it&apos;s losing.
      </div>

      <h2>The day&apos;s element — weather</h2>
      <p>
        Every game-day, one of the five elements is <strong>ascendant</strong> — the day&apos;s
        &ldquo;weather.&rdquo; A bird whose element matches the day&apos;s weather gets a flat
        +{WEATHER.EDGE} on every roll it makes, on top of the head-to-head element edge above. It
        stacks: a Fire bird beating a Metal opponent on a Fire day gets both bonuses.
      </p>
      <p>
        <strong>The weather is the weaker of the two element bonuses, on purpose.</strong> Beating
        your opponent&apos;s element is worth +{BATTLE.ELEMENT_EDGE} — {BATTLE.ELEMENT_EDGE /
        WEATHER.EDGE}× the weather bonus. Matching the day gives a real but modest lift: between
        two birds that are otherwise dead even, it turns a coin flip into a little better than a
        coin flip. The matchup is the thing that decides fights; the weather is the thing that
        breaks ties. If you ever have to pick one, chase the matchup, not the forecast.
      </p>
      <div className="callout">
        <b>Why so small?</b> Every flat bonus in this game has to be read against the stat term,
        not against the dice. A turn roll is two dice plus your stat ÷ {BATTLE.ROLL_DIVISOR}, so a
        starter bird&apos;s six stats together are only worth about a point on the roll. A flat
        bonus anywhere near 1 doesn&apos;t nudge a bird&apos;s quality — it outweighs it. The
        weather is kept to a fraction of that for two reasons: a better bird should still beat a
        worse bird on the wrong day, and a lucky forecast shouldn&apos;t inflate the winner&apos;s
        Pit Figure enough to lie about what the bird is. At this size the day colors a fight; it
        doesn&apos;t relabel the bird.
      </div>
      <p>
        The weather is the same for <em>every</em> fight on the card that day, no matter the blade.
        It rotates irregularly from day to day across all five elements —{" "}
        {ELEMENTS.join(", ")} — so a bird&apos;s good day comes around without being predictable to
        the week. You can see today&apos;s element and tomorrow&apos;s in the game state (the{" "}
        <code>get_state</code> tool) and in the Stewards&apos; Office header, so you can plan which
        birds to run before the card goes off.
      </p>
      <p>
        Old fights remember their weather too. Every past fight in a bird&apos;s form book is
        stamped with that day&apos;s element, and the ones the bird ran on its <em>own</em> day are
        flagged — with its average Pit Figure on those days shown next to its average on all the
        others. That is there so you can tell a good day from a good bird. If a bird&apos;s two
        averages are close, the figures are telling you about the bird. If its own-day figures are
        much higher, some of what you were reading was the sky.
      </p>
      <div className="callout tip">
        <b>Why it exists.</b> A bird rarely gets its ideal blade <em>and</em> its ideal weather in
        the same fight. The weather is the random half of that tradeoff — the blade is the half you
        choose, out of whatever the day posted (see <Link href="/wiki/card">The card</Link>; the
        blade rotation and the weather are deliberately kept from lining up, so a blade never
        reliably arrives on its own element&apos;s day). Run a wrong-weather bird because the blade
        is right, or hold it for its day and
        run something else tonight. The birds drawn in by a good-weather day pull their natural
        counters in after them, and the counters&apos; counters — the card stays logical and a
        little foggy, which is the point.
      </div>

      <h2>The Pit Figure — a performance rating, not a strength rating</h2>
      <p>
        Every fight, win or lose, pays out a Pit Figure for both birds. Don&apos;t read it as
        &ldquo;how strong is this bird&rdquo; — read it as &ldquo;how well did this bird turn up, at
        this blade, on this day.&rdquo; It&apos;s the single most useful number in the game, and
        it&apos;s built the way a horse-racing speed figure is built: against a fixed ruler, so that
        the same number always means the same thing.
      </p>
      <p>
        A figure is built in two parts: a <strong>spine</strong>, which is what the bird is worth at
        that blade, and a <strong>night</strong>, which is how well it actually turned up.
      </p>

      <h3>The spine — the bird, on a fixed ruler</h3>
      <p>
        The spine is the bird&apos;s stats, blended by the blade&apos;s weights from the table at the
        top of this page, put on one fixed scale. The peg is simple: a bird carrying{" "}
        {FIGURE.PEG_STAT} in every stat — that is a {gradeOf(FIGURE.PEG_STAT)}, the top of the
        letter ladder — has a spine of {FIGURE.PEG_FIGURE}. Everything else is straight-line from
        there. No dice, no opponent, nothing about tonight.
      </p>
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>A bird with this in every stat</th>
              <th>Grade</th>
              <th className="num">Spine</th>
            </tr>
          </thead>
          <tbody>
            {[starterStat, 500, FIGURE.PEG_STAT, 1500].map((stat) => (
              <tr key={stat}>
                <td className="num">{stat}</td>
                <td>{gradeOf(stat)}</td>
                <td className="num">{spineOf(stat).toFixed(0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="dim">
        The first row is roughly a fresh starter, so a new bird&apos;s figures live down around{" "}
        {spineOf(starterStat).toFixed(0)}. That is not a bad number — that is what the bottom of
        the ladder looks like.
      </p>

      <div className="callout tip">
        <b>One letter grade is worth {figurePerGrade} figure points. Always.</b> A grade band is{" "}
        {GRADE_BAND} stat points wide, and the spine is a straight line, so the distance from a{" "}
        {gradeOf(0)} to the next grade up is the <em>same</em> {figurePerGrade} points as the
        distance from an {gradeOf(FIGURE.PEG_STAT)} to whatever comes after it. That is the whole
        reason the figure has a fixed ruler: {figurePerGrade} points means one grade, at every
        blade, at every level, forever. Two birds {figurePerGrade * 3} points apart are three
        grades apart.
      </div>

      <h3>The night — what it brought tonight</h3>
      <p>
        The spine is what the bird <em>is</em>. The night is what it delivered. It can move a bird
        up or down by as much as {FIGURE.NIGHT_RANGE * 100}% of its own spine, and it counts
        everything that made the bird bigger or smaller than itself in that fight: condition (rolled
        fresh every turn), the element wheel, the day&apos;s weather, an underdog&apos;s station
        clawback, and — the important one — the fuel wall. A bird that empties its tank and spends
        the back half at {Math.round(BATTLE.FUEL.WALL_FACTOR * 100)}% of its speed will show it in
        the number.
      </p>
      <p>
        The dice are deliberately left out. Luck is not a performance, so luck does not get to lift
        a figure.
      </p>

      <h3>Blade fit: a better bird shows its shape louder</h3>
      <p>
        Every blade&apos;s weights add up to the same 100%. A perfectly flat bird therefore blends
        the same at all five blades and posts the same figure everywhere — the blades are honestly
        comparable, by construction. A <em>shaped</em> bird is the interesting case: because the
        blend multiplies, the blades its stats key give it a bigger number, and the gap grows as the
        bird gets better.
      </p>
      <p>
        Here is a real specialist, measured in the engine: a bird carrying +200 on the stats{" "}
        {FORMATS[specialistHomeBlade].label} keys and −200 everywhere else, run at five levels.
      </p>
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th className="num">Base stat</th>
              {FORMAT_NAMES.map((name) => (
                <th key={name} className="num">
                  {FORMATS[name].label}
                </th>
              ))}
              <th className="num">Best − middle</th>
              <th className="num">Best − worst</th>
            </tr>
          </thead>
          <tbody>
            {SPECIALIST.map((row) => {
              const best = Math.max(...row.figures);
              const middle = row.figures[Math.floor(row.figures.length / 2)];
              const worst = Math.min(...row.figures);
              return (
                <tr key={row.base}>
                  <td className="num">{row.base}</td>
                  {row.figures.map((f, i) => (
                    <td key={FORMAT_NAMES[i]} className="num">
                      {f.toFixed(1)}
                    </td>
                  ))}
                  <td className="num">{(best - middle).toFixed(1)}</td>
                  <td className="num">{(best - worst).toFixed(1)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p>
        Read the last two columns. The gap between this bird&apos;s best blade and the middle blade
        holds near {figurePerGrade} points — one whole grade — at every level, and the gap to its
        worst blade <em>grows</em> as the bird improves. So finding a bird&apos;s blade never stops
        being worth money. The better your stock gets, the more clearly the wrong blade announces
        itself.
      </p>

      <h3>A loss is marked down by beaten lengths</h3>
      <p>
        Both birds are scored on their own spine and their own night first. Then the loser is marked
        down for how much wind the winner had left at the bell, as a share of its own figure — up to{" "}
        {FIGURE.BEATEN_SHARE * 100}% of it if it was beaten by the length of the pit, and never less
        than {FIGURE.MIN_BEATEN_SHARE * 100}%. A share, not a flat subtraction: losing badly costs a
        starter and a champion the same <em>proportion</em>, which is why a loss means the same
        thing at every level.
      </p>
      <p>
        <strong>There is no ceiling.</strong> Nothing clamps the top of the scale. If breeding
        produces a monster whose spine says 180, it posts 180.
      </p>
      <p>
        <strong>One noise roll, shared by both birds.</strong> A single &ldquo;track variant&rdquo;
        (±{FIGURE.NOISE}) is applied to the whole fight — the same roll for both sides — before the
        numbers are rounded to the nearest {FIGURE.BAND}. Because it is one shared roll and not two
        independent ones, the fog moves both figures together and can never flip which bird
        out-figured the other.
      </p>
      <div className="callout tip">
        <b>The rule that makes figures trustworthy.</b> The winner can never figure below the bird
        it beat. Both birds earn their own number, but the loser&apos;s beaten-length mark-down keeps
        it at least one band under the winner — so a 45 can never beat a 55. If you ever see a lower
        figure win, the two figures you&apos;re comparing aren&apos;t from the same fight.
      </div>
      <div className="callout tip">
        <b>The practical lesson, and it changed.</b> A HIGH figure in a LOSS is very good news, and
        it now means something sharper than it used to. A big number says the blade <em>suited</em>
        the bird — that is what the figure is built from. So a bird that figures 90 losing to a 95
        was at the right blade against a better animal. Keep the blade. Move it down in class. It is
        the LOW figures that tell you a blade is wrong, and the way you find out is never one
        fight — it is comparing a bird&apos;s figures <em>across</em> blades, over time.
      </div>

      <h2>Discovery: why the figures are the game</h2>
      <p>
        You never get to see a live bird&apos;s six raw stats — not on someone else&apos;s card,
        and not on your own. The sheet is sealed for the whole fighting career and revealed only
        at retirement (see <Link href="/wiki/birds">Birds &amp; stats</Link>); until then, every
        card shows stars, record, and figures, never numbers. Certifying a bird&apos;s true
        quality is deliberately expensive: nobody hands it to you for free, which is exactly what
        keeps an average bird worth entering. It might surprise you — even its own farm — and
        nobody knows until it fights.
      </p>
      <p>
        That&apos;s what the Pit Figure is for. It&apos;s the one honest window into <em>any</em>{" "}
        live bird, including your own — a number that survives being a loser, that says how far
        behind the loser finished, and that can&apos;t lie about who actually won. The game folds your
        bird&apos;s figures into a per-blade scout report (see{" "}
        <Link href="/wiki/birds">Birds &amp; stats</Link>) so you can read the pattern at a
        glance. Reading figures — yours and everyone else&apos;s — <em>is</em> the skill of the
        game.
      </p>

      <div className="next">
        <Link href="/wiki/birds">← Birds &amp; stats</Link>
        <Link href="/wiki/card">The card →</Link>
        <Link href="/wiki/pintakasi">The Pintakasi →</Link>
      </div>
    </>
  );
}
