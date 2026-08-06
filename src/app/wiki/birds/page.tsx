import Link from "next/link";
import {
  AGE,
  BARN,
  BATTLE,
  BREEDING,
  CARRIAGES,
  CARRIAGE_LABEL,
  ELEMENTS,
  ELEMENT_BEATS,
  PHASES,
  SCOUT,
  STARS,
  STATS,
} from "@/engine/config";
import { GRADES, gradeOf, overallGradeOf, type Grade } from "@/engine/grades";
import {
  canHardcore,
  canJuvenile,
  canManualRetire,
  canRealFight,
  isEggAge,
  mustRetire,
} from "@/engine/lifecycle";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Birds & stats — The Pintakasi Handbook",
  description: "The six hidden stats, the scout report, the letter-grade ladder, elements and stars, and the bird life cycle.",
};

/** Walks the real scale so the band table can never drift from grades.ts. */
function gradeBands(): { grade: Grade; min: number; max: number | null }[] {
  const bands: { grade: Grade; min: number; max: number | null }[] = [];
  let current = gradeOf(0);
  let start = 0;
  for (let v = 1; v <= STATS.MAX; v++) {
    const g = gradeOf(v);
    if (g !== current) {
      bands.push({ grade: current, min: start, max: v - 1 });
      current = g;
      start = v;
    }
  }
  bands.push({ grade: current, min: start, max: null });
  return bands;
}

/** Walks the real age gates so the life-cycle table can never drift from lifecycle.ts. */
function ageRows() {
  return Array.from({ length: AGE.FIGHTING_CAP + 1 }, (_, age) => ({
    age,
    egg: isEggAge(age),
    juvenile: canJuvenile(age),
    real: canRealFight(age),
    hardcore: canHardcore(age),
    canRetire: canManualRetire(age),
    forced: mustRetire(age),
  }));
}

const check = (b: boolean) => (b ? "✓" : "—");

export default function BirdsPage() {
  const bands = gradeBands();
  const topGrade = GRADES[GRADES.length - 1];
  const secondTopGrade = GRADES[GRADES.length - 2];

  return (
    <>
      <h1>Birds &amp; stats</h1>
      <p className="lede">
        Every bird is six stats, one element, a half-star rating, and an age. The six stats are
        fixed the day it hatches and never change — but here is the twist: <strong>you cannot see
        them while the bird can still fight.</strong> The sheet is sealed for the whole career and
        revealed in full the day the bird retires, however it retires. What you <em>can</em> always
        see: its <strong>overall grade</strong>, stars, element, carriage, sex, age, record, and
        every Pit Figure it has ever posted. The grade tells you how strong the bird is; it never
        tells you what shape it is. Working out what a bird is from how it fights — that discovery
        is the game.
      </p>

      <h2>The six stats</h2>
      <p>
        This table is what the hidden sheet holds. You never read these numbers off a live
        bird&apos;s card — you learn them the slow way, by watching the bird fight and reading its
        figures, and you see the real sheet only when the career ends. Knowing what each stat{" "}
        <em>does</em> is still essential, because it&apos;s how you turn what you watched into a
        guess about what&apos;s underneath.
      </p>
      <p>
        Four stats are <strong>distance stats</strong> — all four join every roll, but each blade
        weighs them differently (that&apos;s the blade&apos;s &ldquo;distance,&rdquo; see{" "}
        <Link href="/wiki/fighting">Fighting</Link>). Think Start, Speed, Stamina, Finish on a
        race dial. Two are <strong>anchor stats</strong> — they matter in every fight, at every
        distance, but never take the wheel by themselves.
      </p>
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>Stat</th>
              <th>Type</th>
              <th>What it does in a fight</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Agility</td>
              <td>Distance — the Start</td>
              <td>
                The burst off the break. Weighs heaviest on the short blades — B1 leans on it
                harder than on anything else — and lightest, but never zero, on the deep-water
                end.
              </td>
            </tr>
            <tr>
              <td>Sight</td>
              <td>Distance — the Speed</td>
              <td>
                Accuracy and placement in a real trade. The key stat of B2, and a solid share of
                every other blade — sustained hitting is welcome everywhere.
              </td>
            </tr>
            <tr>
              <td>Stamina</td>
              <td>Distance — the fuel tank</td>
              <td>
                Sets how many turns the bird fights at full power: {BATTLE.FUEL.BASE_TURNS} turns
                plus {BATTLE.FUEL.TURNS_PER_STAMINA} per point of stamina. When the tank empties
                the bird hits the wall — agility and sight drop to{" "}
                {Math.round(BATTLE.FUEL.WALL_FACTOR * 100)}% for the rest of the fight. It also
                carries its own weight on every roll, heaviest at B4. A sprint never empties a
                tank; a marathon is decided by it.
              </td>
            </tr>
            <tr>
              <td>Gameness</td>
              <td>Distance — the Finish</td>
              <td>
                Grit in the deep water — the key stat of B5, and it never hits the wall: heart
                doesn&apos;t get tired. It also decides whether a badly hurt bird keeps fighting
                or runs: once per fight, a bird below a quarter of its wind checks its nerve, and
                low gameness means a real chance it breaks and quits.
              </td>
            </tr>
            <tr>
              <td>Station</td>
              <td>Anchor — the underdog&apos;s path</td>
              <td>
                The rivalry modifier. If the opponent is meaningfully stronger on paper, station
                adds a clutch bonus to every one of your rolls for the rest of the fight. It&apos;s
                the stat that makes upsets possible instead of just unlucky.
              </td>
            </tr>
            <tr>
              <td>Condition</td>
              <td>Anchor — the form stabilizer</td>
              <td>
                How close to its best a bird performs on a given day, re-rolled fresh every turn.
                High condition keeps a bird near its book number almost every turn; low condition
                means real off-turns where it fights well under its stats. Condition never helps
                beyond 100% form — it only closes the gap between an ugly day and a good one.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="callout tip">
        <b>Reading it in one line.</b> One key stat per blade: B1 agility, B2 sight, B4 stamina,
        B5 gameness — and B3, the exact middle, weighs all four the same, so the most balanced
        bird wins there. Station and condition matter everywhere, all the time — see{" "}
        <Link href="/wiki/fighting">Fighting</Link> for how the five blades change the mix.
      </div>

      <h2>
        The 0–{STATS.MAX} scale and letter grades
      </h2>
      <p>
        Every stat is stored as a raw number from {STATS.MIN} to {STATS.MAX}. Nobody wants to
        compare six four-digit numbers at a glance, so a revealed sheet also carries a letter
        grade — a 100-point band read straight off the raw number. Per-stat grades appear only
        where the sheet does: on <strong>retired birds</strong> and on <strong>stud cards</strong>,
        never on a live fighter. A revealed line that says &ldquo;{bands[3]?.grade} {bands[3]?.min}&rdquo;
        means the raw stat is {bands[3]?.min}, and {bands[3]?.min} falls in the {bands[3]?.grade}{" "}
        band. The letter is for scanning; the number is for math.
      </p>
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>Grade</th>
              <th className="num">Raw range</th>
            </tr>
          </thead>
          <tbody>
            {bands.map((b) => (
              <tr key={b.grade}>
                <td>{b.grade}</td>
                <td className="num">
                  {b.min}–{b.max === null ? `${STATS.MAX}+` : b.max}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>
        The families run C → B → A → S → {secondTopGrade[0]}, each with a plain and a
        &ldquo;+&rdquo; rung. The top band, {topGrade}, is deliberately out of reach for a starter
        or gacha bird — it&apos;s where generations of good breeding eventually land, not
        somewhere a fresh egg shows up. A bird&apos;s <strong>overall grade</strong> is the same
        lookup run on the average of all six stats: six
        stats sitting exactly at the starter floor ({STATS.STARTER_MIN} each) average out to an
        overall {overallGradeOf(STATS.STARTER_MIN * 6)} — so a bird can flash a top grade in one
        stat and still carry a modest overall grade if the other five are ordinary.
      </p>
      <div className="callout tip">
        <b>The overall grade is always public — even under the fog.</b> It is the one number you
        can read off a bird on day one, and it is the exception that proves the rule: it tells you{" "}
        <em>how strong</em> the bird is, never <em>what shape</em> it is. Two birds can both be{" "}
        {bands[3]?.grade} overall and want opposite ends of the blade ladder — one a sprinter, one
        a stayer — and the letter cannot tell them apart. So it gives you something to be excited
        about the day an egg hatches, and something honest to bid on in the claiming ring, without
        answering the question the <Link href="/wiki/card">card</Link> is supposed to answer.
      </div>
      <div className="callout">
        <b>Worked example.</b> A brand-new starter bird rolls each stat between {STATS.STARTER_MIN}{" "}
        and {STATS.STARTER_MAX} — a {gradeOf(STATS.STARTER_MIN)} to {gradeOf(STATS.STARTER_MAX)}{" "}
        bird on every line. About {Math.round(STATS.STARTER_SPIKE_CHANCE * 100)}% of the time, a
        single stat spikes instead, landing between {STATS.STARTER_SPIKE_MIN} and{" "}
        {STATS.STARTER_SPIKE_MAX} — as high as a {gradeOf(STATS.STARTER_SPIKE_MAX)}. That&apos;s
        deliberate: it hides one real talent in some day-one flocks, without the whole bird jumping
        bands — and since the sheet is sealed, finding out <em>which</em> bird carries the spike,
        and where, is your first season&apos;s detective work. Raising the whole bird is what{" "}
        <Link href="/wiki/breeding">breeding</Link> is for.
      </div>

      <h2>The scout report</h2>
      <p>
        If you can&apos;t read the sheet, what <em>do</em> you read? Every bird carries a{" "}
        <strong>scout report</strong>: for each of the five blades, its record there, its average
        and best Pit Figure, and a single <strong>score</strong> — the game&apos;s honest estimate
        of how good the bird has looked at that blade so far. Bots read the same report you do.
        Nobody, human or machine, reads a live bird&apos;s sheet.
      </p>
      <p>
        The score is deliberately <strong>shrunk toward a neutral prior</strong> of{" "}
        {SCOUT.PRIOR_FIGURE} — the figure an even, ordinary fight tends to produce. Concretely, the
        report acts as if every blade already had {SCOUT.PRIOR_WEIGHT} average fights on the books
        before the real ones are counted. Two reasons. First, one lucky big figure must not type a
        bird — a single loud 80 gets pulled back toward the middle until more fights back it up.
        Second, a blade the bird has never fought reads as &ldquo;unknown, average&rdquo; —
        never as &ldquo;bad.&rdquo; No evidence is not bad evidence.
      </p>
      <p>
        The scout also makes one small, public correction before it compares blades. A better bird
        is expected to post a louder figure, so the scout subtracts that expectation using the
        letter grade printed on the old card — {SCOUT.OWN_GRADE_STEP} points per grade, the exact
        amount a grade is worth. What is left is the part of the number the bird&apos;s <em>blade</em>
        earned. The win, the beaten lengths and the blade itself all stay in.
      </p>
      <p>
        It does <strong>not</strong> correct for who the bird fought, and that is not an oversight.
        A Pit Figure is built against a fixed ruler rather than against the opponent, so the company
        a bird kept barely touches its number in the first place — there is nothing to take out.
        Beating a monster is worth a great deal to your record and your pocket. It is not worth
        extra figure points.
      </p>
      <div className="callout tip">
        <b>Grade and figure are two different readings — compare them.</b> The overall grade is
        public and covers all six stats. A Pit Figure only weighs the four distance stats that the
        blade keys, so station and condition never show up in it directly. A bird whose figures keep
        landing <em>below</em> what its grade would suggest is usually carrying its weight in those
        two anchors — real quality, just not the kind that scores. That gap is a read worth having.
      </div>
      <p>
        A blade stays marked <strong>unread</strong> until the bird has at least {SCOUT.MIN_READS}{" "}
        figures there — one reading, however loud, isn&apos;t a verdict. Unread blades are
        exploration targets: the only way to fill in the report is to card the bird there and pay
        for the answer, which is exactly what the cheap juvenile year is for.
      </p>
      <div className="callout tip">
        <b>Why the fog exists at all.</b> If every live bird wore its sheet openly, every fight,
        every claim, and every stud fee would be arithmetic — the better spreadsheet would win
        before the birds ever met. Hidden sheets keep a live bird a <em>judgement call</em>:
        claiming one is a bet on your read of its figures, and an average-looking bird stays worth
        carding because it might be better than its record. The sheet reveals at retirement, so
        the truth always comes out — just after the career, when it feeds{" "}
        <Link href="/wiki/breeding">breeding</Link> instead of fight-picking.
      </div>

      <h2>Elements and half-star ratings</h2>
      <p>
        Every bird carries one of five elements: {ELEMENTS.join(", ")}. They sit on the 克{" "}
        <em>(kè, &ldquo;overcoming&rdquo;)</em> wheel from BaZi five-element theory — each element
        beats exactly one other and loses to exactly one other:
      </p>
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>Element</th>
              <th>Overcomes</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(ELEMENT_BEATS).map(([from, to]) => (
              <tr key={from}>
                <td>{from}</td>
                <td>{to}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>
        It&apos;s an edge, not a hard counter — and how big an edge depends entirely on the
        bird&apos;s <strong>stars</strong> (below). At the full {STARS.MAX_HALF_STARS / 2}★, a
        favorable matchup adds +{BATTLE.ELEMENT_EDGE} to every roll — a huge deal, since a
        starter bird&apos;s whole stat block is only worth about{" "}
        {(((STATS.STARTER_MIN + STATS.STARTER_MAX) / 2 / BATTLE.ROLL_DIVISOR)).toFixed(2)} on a
        roll. At 0★ the wheel does nothing at all. Even at full stars it can&apos;t make a Fire
        bird unbeatable against Water, because the dice are louder than any bonus and a
        genuinely better bird outgrows the wheel. On top of this, one element is{" "}
        <strong>ascendant</strong> each day — the day&apos;s weather — worth half as much as the
        wheel edge, scaled by the same stars. Both are explained in{" "}
        <Link href="/wiki/fighting">Fighting</Link>.
      </p>
      <p>
        Alongside its element, every bird carries a <strong>star rating</strong> from 0 to{" "}
        {STARS.MAX_HALF_STARS / 2} in half-star steps — shown on its card as, for example,{" "}
        &ldquo;2.5★ Wood.&rdquo; Stars are the element&apos;s <em>volume knob</em>: every edge
        the element grants (the wheel, the weather) is multiplied by the bird&apos;s stars out
        of {STARS.MAX_HALF_STARS / 2}. A 2.5★ bird gets half the edge; a 0★ bird&apos;s element
        is just a color on the card. Every half-star is a real step. Stars do <em>not</em> add
        stat points — a 5★ bird with weak stats is a weak bird that punches hard on the right
        matchup, not a strong bird.
      </p>
      <p>
        Stars matter most at the nest. Breeding spreads a chick&apos;s half-stars within{" "}
        {BREEDING.STAR_SPREAD_HALF_STARS} half-stars of the parents&apos; average (see{" "}
        <Link href="/wiki/breeding">Breeding</Link>), so stacking stars across generations is one
        of the two real levers a breeder has — the other being the raw stat numbers themselves.
      </p>
      <div className="callout">
        <b>Starters open low, on purpose.</b> A fresh egg out of the starting flock rolls between{" "}
        {STARS.STARTER_MIN_HALF / 2}★ and {STARS.STARTER_MAX_HALF / 2}★ — nowhere near the{" "}
        {STARS.MAX_HALF_STARS / 2}★ ceiling. Anything higher comes from one of two doors: a lucky{" "}
        <Link href="/wiki/gacha">gacha</Link> pull (Purple and Gold tokens carry 2★–4★ birds), or
        several generations of breeding stacking half-stars upward. A 4★ bird sitting on the board
        in week one would make the whole rating meaningless — stars are supposed to be the thing
        you chase, not something you start with.
      </div>

      <h2>Carriage — Ground vs. Air</h2>
      <p>
        Every bird also carries a <strong>carriage</strong>: {CARRIAGES.join(" or ")}. Think of it
        as a second star-like axis, separate from element — a lean plus its own magnitude (0 to{" "}
        {STARS.MAX_HALF_STARS / 2}★), rolled at hatch and inherited from parents the same way
        elements are (see <Link href="/wiki/breeding">Breeding</Link>).
      </p>
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>Carriage</th>
              <th>What it means</th>
            </tr>
          </thead>
          <tbody>
            {CARRIAGES.map((c) => (
              <tr key={c}>
                <td>{c}</td>
                <td>{CARRIAGE_LABEL[c]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="callout warn">
        <b>Not wired into fights yet.</b> Carriage is tracked, rolled, and inherited, but tonight&apos;s
        fight engine doesn&apos;t read it — every bout today still runs on stats, element, and
        stars alone. The intended hook: the sim already runs in phases (see below), and Air is
        meant to pay early — over the top of a low fighter before anyone&apos;s wind is gone —
        while Ground pays late, once the flyer is blown and the shuffler grinds it down. That would
        tie carriage straight to blade choice, since a B1 bout lives almost entirely in the
        early phase and a B5 bout spends most of its turns in the late one. Until that lands,
        treat carriage as a trait you&apos;re breeding <em>for</em>, not one that changes tonight&apos;s
        card.
      </div>

      <h2>Age and the life cycle</h2>
      <p>
        A bird ages one bird-year per game-week, on Hatch Fridays. Age is never trained or spent —
        it only ever ticks forward, and it gates what a bird is allowed to fight.
      </p>
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th className="num">Age</th>
              <th>Egg</th>
              <th>Juvenile card</th>
              <th>Real card</th>
              <th>Hardcore card</th>
              <th>Can retire</th>
              <th>Force-retires</th>
            </tr>
          </thead>
          <tbody>
            {ageRows().map((r) => (
              <tr key={r.age}>
                <td className="num">{r.age}</td>
                <td>{check(r.egg)}</td>
                <td>{check(r.juvenile)}</td>
                <td>{check(r.real)}</td>
                <td>{check(r.hardcore)}</td>
                <td>{check(r.canRetire)}</td>
                <td>{check(r.forced)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>
        In words: age {AGE.EGG} is an egg — sex hidden, nothing to enter. Age {AGE.CHICK} is the{" "}
        <strong>discovery year</strong>, a closed division of juvenile-only fights against other
        chicks, so a five-year veteran can never drop down and bully a chick. From age{" "}
        {AGE.REAL_STAKES} a bird is in <strong>real</strong> company and starts a career record.
        From age {AGE.FORK} two things unlock together — <strong>hardcore</strong> cards (where a
        loss ends a career on the spot) and <strong>manual retirement</strong> (so a farm can pull
        a good bird out to stud before it&apos;s forced to). At age {AGE.FIGHTING_CAP} a bird
        force-retires — the natural end of a compressed lifespan, not a punishment.
      </p>
      <div className="callout">
        <b>A retired bird&apos;s age freezes.</b> The week it retires becomes its permanent age on
        record. A bird that retired young stays &ldquo;young&rdquo; forever in the barn — it just
        isn&apos;t fighting anymore. Only active birds keep aging toward the cap.
      </div>

      <h2>The naming law</h2>
      <p>
        Every bird hatches with an auto-name — the kind you&apos;d see stamped &ldquo;Egg of
        …&rdquo; on a crate. <strong>A bird cannot enter its first fight while it still wears that
        name.</strong> Renaming it is free, takes a moment, and is the one thing every card demands
        before it&apos;ll let a bird in.
      </p>
      <p>
        Think of it as a ritual, not a rule you tripped over. A bird that has never fought hasn&apos;t
        earned an identity yet — naming it is the farm actually claiming the bird as theirs before
        sending it out. It also has a practical side: bird names are unique across the whole
        world, so no arena ever has two birds sharing a name.
      </p>

      <h2>No training — stats are fixed at birth</h2>
      <div className="callout warn">
        <b>There is no training mechanic, on purpose.</b> Whatever a bird rolls at hatch — six
        stats, one element, a star rating — is what it fights with for its entire career. Nothing
        you do after hatching changes a single number.
      </div>
      <p>
        This is the single most important thing to understand about the game. Pintakasi is not
        about grinding a bird stronger — it&apos;s about two other skills: <strong>judging</strong>{" "}
        what a bird is actually good at from its figures and its scout report (the stats
        themselves stay sealed until retirement — see above), and <strong>placing</strong> it in
        the right company and the right blade to use that (see{" "}
        <Link href="/wiki/fighting">Fighting</Link>). When the career ends, the sheet unseals and
        you finally see how right you were. The only way to raise the ceiling on a bloodline is{" "}
        <Link href="/wiki/breeding">breeding</Link> a better next generation — patience and
        pairing, not repetition.
      </p>

      <h2>The barn</h2>
      <p>
        A farm&apos;s barn holds up to <strong>{BARN.CAPACITY}</strong> birds and eggs combined.
        Eggs count against the cap the moment they&apos;re laid — a full barn simply can&apos;t
        breed again until something retires, hatches out, or is otherwise moved on. It&apos;s worth
        watching if you&apos;re breeding aggressively; see{" "}
        <Link href="/wiki/breeding">Breeding</Link> and{" "}
        <Link href="/wiki/gacha">the gacha</Link> for the two ways a barn fills up.
      </p>

      <div className="next">
        <Link href="/wiki/fighting">Fighting →</Link>
        <Link href="/wiki/breeding">Breeding →</Link>
        <Link href="/wiki/gacha">The gacha →</Link>
      </div>
    </>
  );
}
