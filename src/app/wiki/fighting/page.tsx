import Link from "next/link";
import {
  BATTLE,
  FIGURE,
  FORMATS,
  FORMAT_NAMES,
  PHASES,
  STARS,
  STATS,
  type FightFormat,
} from "@/engine/config";

export const dynamic = "force-dynamic";

/**
 * Rank the four blades sprint → marathon purely off their configured turn
 * caps, so the "sprint / hybrid / route / marathon" nicknames can't drift
 * out of sync with the numbers next to them if a balance pass reorders them.
 */
const DISTANCE_NICKNAMES = ["the sprint", "the hybrid", "the route", "the marathon"];
const byLength = [...FORMAT_NAMES].sort((a, b) => FORMATS[a].maxTurns - FORMATS[b].maxTurns);
const distanceNickname = new Map<FightFormat, string>(
  byLength.map((name, i) => [name, DISTANCE_NICKNAMES[i] ?? `stage ${i + 1}`])
);

// Same trick for "swingy vs. true test": rank by crit multiplier, top half
// is swingy. Knives sweep this today, but the label reads off the numbers
// instead of assuming which blade key means what.
const byCrit = [...FORMAT_NAMES].sort((a, b) => FORMATS[b].critMult - FORMATS[a].critMult);
const swingy = new Set(byCrit.slice(0, Math.ceil(byCrit.length / 2)));

function phasesReached(maxTurns: number): string {
  const phases = ["agility"];
  if (maxTurns > PHASES.BREAK_THROUGH_TURN) phases.push("sight");
  if (maxTurns > PHASES.OPEN_THROUGH_TURN) phases.push("gameness");
  return phases.join(" → ");
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

      <h2>The four blades</h2>
      <p>
        The blade is the game&apos;s version of race distance. It decides how many turns a fight
        can run, how hard each hit lands, and — because of that — which of a bird&apos;s stats
        actually get to matter. Knives are short and swingy: a lucky double can end it in one
        blow, so upsets happen. Gaffs run long and true: crits barely move the needle, and the
        bird with the better engine usually shows it by the end.
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
                    <span className="dim">{distanceNickname.get(name)}</span>
                  </td>
                  <td>
                    {swingy.has(name)
                      ? "Swingy — a Tari Strike (doubles on the dice) can decide it in one hit."
                      : "A true test — a lucky roll barely moves the needle."}
                  </td>
                  <td>{phasesReached(fmt.maxTurns)}</td>
                  <td className="num">up to {fmt.maxTurns} turns</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p>
        Reading the &ldquo;stats that decide it&rdquo; column: turns 1 through{" "}
        {PHASES.BREAK_THROUGH_TURN} are <strong>the break</strong> — agility, who strikes first.
        Turns up to {PHASES.OPEN_THROUGH_TURN} are the <strong>open exchange</strong> — sight,
        accuracy in a real trade. Past that it&apos;s the <strong>deep fight</strong> —{" "}
        <strong>gameness</strong>, grit under punishment. A {FORMATS.longKnife.maxTurns}-turn Long
        Knife bout is over before gameness ever gets a say. A {FORMATS.shortGaff.maxTurns}-turn
        Short Gaff bout lives almost entirely in the deep fight.
      </p>
      <p className="dim">
        Star rating matters equally everywhere: each full star adds{" "}
        {STARS.BOOST_PER_FULL_STAR} points to all six stats before any of this math runs (see{" "}
        <Link href="/wiki/birds">Birds &amp; stats</Link>) — the same boost whether the fight lasts
        {" "}
        {FORMATS.longKnife.maxTurns} turns or {FORMATS.shortGaff.maxTurns}.
      </p>

      <div className="cards-2">
        <div className="minicard">
          <b>Station — the underdog&apos;s edge</b>
          If your total stats are at least {BATTLE.UNDERDOG_RATIO}× behind your opponent&apos;s,
          you&apos;re the underdog for the whole fight, and your station (divided by{" "}
          {BATTLE.STATION_DIVISOR}) adds to every roll you make. It&apos;s the game&apos;s
          built-in path to upsets — matters in every blade, all fight long.
        </div>
        <div className="minicard">
          <b>Condition — your variance floor</b>
          Each turn, each bird rolls its &ldquo;form&rdquo; for that turn, somewhere between a
          floor and a perfect 1.0. Condition sets the floor — from {BATTLE.WORST_FORM} at the
          bottom up toward 1.0 as condition climbs toward {STATS.MAX}. High condition means you
          rarely have a bad turn; low condition means some turns just arrive ugly.
        </div>
      </div>

      <h2>How a fight resolves, turn by turn</h2>
      <ol>
        <li>
          <strong>Wind is the health bar.</strong> Each bird&apos;s max wind is{" "}
          {BATTLE.BASE_WIND} plus its stamina × {BATTLE.WIND_PER_STAMINA}, rounded to a whole
          number. It only ever goes down once the fight starts.
        </li>
        <li>
          <strong>Both birds roll every turn.</strong> Two six-sided dice, plus a sliver of the
          stat this phase calls for (agility, sight, or gameness — see the table above), scaled
          down by dividing by {BATTLE.ROLL_DIVISOR} so a huge stat edge still can&apos;t out-muscle
          the dice entirely.
        </li>
        <li>
          <strong>Two stats fade as the fight goes.</strong> Agility and sight are physical — they
          decay {Math.round(BATTLE.DECAY_PER_TURN * 100)}% per turn, cushioned by how much stamina
          the bird carries, and never drop below {Math.round(BATTLE.DECAY_FLOOR * 100)}% of their
          starting value. Gameness never decays — grit doesn&apos;t get tired.
        </li>
        <li>
          <strong>Element can tip a roll.</strong> If your element overcomes your opponent&apos;s
          in the wuxing cycle, you get a flat +{BATTLE.ELEMENT_EDGE} on every roll — real, but
          small enough that the wrong-element bird still usually wins on stats.
        </li>
        <li>
          <strong>Whoever rolls higher lands the hit.</strong> Damage is the roll&apos;s margin ×
          the blade&apos;s damage multiplier. Rolling doubles is a{" "}
          <strong>Tari Strike</strong> — a critical hit that multiplies the damage again by the
          blade&apos;s crit multiplier. This is where knives do their swingy work: a big Tari
          Strike in a {FORMATS.longKnife.maxTurns}-turn fight can be the whole story.
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

      <h2>The Pit Figure — a performance rating, not a strength rating</h2>
      <p>
        Every fight, win or lose, pays out a Pit Figure for both birds. Don&apos;t read it as
        &ldquo;how strong is this bird&rdquo; — read it as &ldquo;how well did it perform, against
        what, on this day.&rdquo; It&apos;s the single most useful number in the game, and it&apos;s
        built the way a horse-racing speed figure is built.
      </p>
      <p>
        <strong>The winner is timed against a ghost.</strong> Every fight is measured against an
        invisible, maxed-out bird&apos;s pace for that exact blade. Match the ghost&apos;s pace and
        you score {FIGURE.GHOST_FIGURE}. An even fight between two starter-grade birds typically
        lands well under that — there&apos;s real room to grow into.
      </p>
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>Blade</th>
              <th className="num">Ghost pace</th>
            </tr>
          </thead>
          <tbody>
            {FORMAT_NAMES.map((name) => (
              <tr key={name}>
                <td>{FORMATS[name].label}</td>
                <td className="num">{FIGURE.GHOST_PACE[name]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>
        Gaff fights run long, so their damage-per-turn is naturally lower than a knife&apos;s — the
        ghost pace is tuned per blade so figures still mean the same thing across all four, and you
        can compare one bird&apos;s Long Knife figure to its Short Gaff figure honestly.
      </p>
      <p>
        <strong>The loser is scored down from the winner.</strong> It doesn&apos;t get an
        independent rating — it&apos;s marked down from the winner&apos;s figure by the
        &ldquo;beaten lengths&rdquo;: how much wind the winner had left at the bell, as a share of
        the loser&apos;s own pool. A photo-finish loss is marked down only a little; a bird that
        ran, or emptied its wind completely, is marked down the full margin. A loss is never marked
        down by more than {FIGURE.BEATEN_SCALE} figure points at the extreme, and never by less than{" "}
        {FIGURE.MIN_BEATEN} — a loss always sits at least one band below the win.
      </p>
      <p>
        <strong>The figure also books the class of the bird you beat.</strong> Beating a
        genuinely strong bird lifts your figure even if the fight itself looked ordinary. That
        matters because of a quirk in how the dice work: two maxed-out birds trade damage at
        exactly the same pace as two starters do, since every turn is decided by the{" "}
        <em>difference</em> between two rolls, not the size of either one. Raw pace alone
        can&apos;t tell a monster from a maiden — so the figure measures the loser&apos;s average
        stat against the starter band&apos;s middle ({FIGURE.CLASS_BASE}), and adds one point for
        every {FIGURE.CLASS_DIVISOR} points above that line. Beat good birds, figure higher.
      </p>
      <p>
        <strong>One noise roll, shared by both birds.</strong> A single &ldquo;track
        variant&rdquo; (±{FIGURE.NOISE}) is applied to the whole fight — the same roll for both
        sides, before the numbers are rounded to the nearest {FIGURE.BAND} and clamped between 0
        and {FIGURE.MAX} (headroom sits above {FIGURE.GHOST_FIGURE} on purpose, for bred stock that
        eventually outruns the ghost). Because it&apos;s one shared roll and not two independent
        ones, the fog can add a little noise to both figures — but it can never flip which bird
        out-figures the other.
      </p>
      <div className="callout tip">
        <b>The rule that makes figures trustworthy.</b> The winner can never figure below the bird
        it beat. The loser&apos;s figure is built <em>from</em> the winner&apos;s by subtracting a
        real amount — so a 45 can never beat a 55. If you ever see a lower figure win, something
        about the two figures you&apos;re comparing isn&apos;t from the same fight.
      </div>
      <div className="callout tip">
        <b>The practical lesson.</b> A HIGH figure in a LOSS is not a bad bird — it means the bird
        was in the wrong format, or the wrong company. A bird that figures 90 losing to a 95 ran a
        monster close in the wrong crowd; move it down in class or try a different blade. The way
        you actually find out what a bird is isn&apos;t one fight — it&apos;s comparing its figures
        <em> across</em> blades and cards over time.
      </div>

      <h2>Discovery: why the figures are the game</h2>
      <p>
        You never get to see a bird&apos;s six raw stats laid out on someone else&apos;s card —
        the board only shows stars and record, never numbers (see{" "}
        <Link href="/wiki/card">The card</Link>). Certifying a bird&apos;s true quality is
        deliberately expensive: nobody hands it to you for free, which is exactly what keeps an
        average bird worth entering. It might surprise you, and you won&apos;t know until it
        fights.
      </p>
      <p>
        That&apos;s what the Pit Figure is for. It&apos;s the one honest window into a bird you
        don&apos;t own — a number that survives being a loser, that accounts for who it lost to,
        and that can&apos;t lie about who actually won. Reading figures — yours and everyone
        else&apos;s — <em>is</em> the skill of the game.
      </p>

      <div className="next">
        <Link href="/wiki/birds">← Birds &amp; stats</Link>
        <Link href="/wiki/card">The card →</Link>
        <Link href="/wiki/pintakasi">The Pintakasi →</Link>
      </div>
    </>
  );
}
