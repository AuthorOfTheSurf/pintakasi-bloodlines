import Link from "next/link";
import {
  AGE,
  BARN,
  BATTLE,
  BREEDING,
  ELEMENTS,
  ELEMENT_BEATS,
  PHASES,
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
  description: "The six stats, the letter-grade ladder, elements and stars, and the bird life cycle.",
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
  const windPerHundredStamina = Math.round(100 * BATTLE.WIND_PER_STAMINA);

  return (
    <>
      <h1>Birds &amp; stats</h1>
      <p className="lede">
        Every bird is six stats, one element, a half-star rating, and an age. That&apos;s the whole
        bird — there is no hidden mechanic and no training screen. This page explains what each
        number actually does when two birds meet in the pit, and how to read a bird&apos;s card at a
        glance.
      </p>

      <h2>The six stats</h2>
      <p>
        Four stats are <strong>phase stats</strong> — which ones matter depends on how long the
        fight runs (that&apos;s the blade&apos;s &ldquo;distance,&rdquo; see{" "}
        <Link href="/wiki/fighting">Fighting</Link>). Two are <strong>anchor stats</strong> — they
        matter in every fight, at every distance, but never take the wheel by themselves.
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
              <td>Phase 1 — the break</td>
              <td>
                Drives turns 1–{PHASES.BREAK_THROUGH_TURN}, the opening fly-up. High agility means
                your bird tends to strike first and set the pace before anything else has
                mattered.
              </td>
            </tr>
            <tr>
              <td>Sight</td>
              <td>Phase 2 — open exchange</td>
              <td>
                Drives turns {PHASES.BREAK_THROUGH_TURN + 1}–{PHASES.OPEN_THROUGH_TURN}. This is
                accuracy and placement once both birds are trading — the stat that decides most
                short and medium fights.
              </td>
            </tr>
            <tr>
              <td>Stamina</td>
              <td>Fuel</td>
              <td>
                Two jobs. It sets the wind pool — every {windPerHundredStamina} points of stamina
                add roughly 1 point of wind on top of a small base pool, and wind is the fight&apos;s
                health bar. It also slows how fast agility and sight fade as the fight goes long —
                low-stamina birds are fighting on fumes by the deep rounds.
              </td>
            </tr>
            <tr>
              <td>Gameness</td>
              <td>Phase 3 — the deep fight</td>
              <td>
                Drives every turn past turn {PHASES.OPEN_THROUGH_TURN}, and unlike agility and
                sight it never decays — grit doesn&apos;t get tired. It also decides whether a badly
                hurt bird keeps fighting or runs: once per fight, a bird below a quarter of its
                wind checks its nerve, and low gameness means a real chance it breaks and quits.
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
        <b>Reading it in one line.</b> Short blades (Long Knife, Short Knife) live and die on
        agility and sight. Long blades (Long Gaff, Short Gaff) burn deep into stamina and gameness.
        Station and condition matter everywhere, all the time — see{" "}
        <Link href="/wiki/fighting">Fighting</Link> for how the four blades change the mix.
      </div>

      <h2>
        The 0–{STATS.MAX} scale and letter grades
      </h2>
      <p>
        Every stat is stored as a raw number from {STATS.MIN} to {STATS.MAX}. Nobody wants to
        compare six four-digit numbers at a glance, so the game also shows a letter grade — a
        100-point band read straight off the raw number. A card that says &ldquo;{bands[3]?.grade}{" "}
        {bands[3]?.min}&rdquo; means the raw stat is {bands[3]?.min}, and {bands[3]?.min} falls in
        the {bands[3]?.grade} band. The letter is for scanning; the number is for math.
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
        somewhere a fresh egg shows up. A bird&apos;s <strong>overall grade</strong> (shown on its
        card as one summary letter) is the same lookup run on the average of all six stats: six
        stats sitting exactly at the starter floor ({STATS.STARTER_MIN} each) average out to an
        overall {overallGradeOf(STATS.STARTER_MIN * 6)} — so a bird can flash a top grade in one
        stat and still carry a modest overall grade if the other five are ordinary.
      </p>
      <div className="callout">
        <b>Worked example.</b> A brand-new starter bird rolls each stat between {STATS.STARTER_MIN}{" "}
        and {STATS.STARTER_MAX} — a {gradeOf(STATS.STARTER_MIN)} to {gradeOf(STATS.STARTER_MAX)}{" "}
        bird on every line. About {Math.round(STATS.STARTER_SPIKE_CHANCE * 100)}% of the time, a
        single stat spikes instead, landing between {STATS.STARTER_SPIKE_MIN} and{" "}
        {STATS.STARTER_SPIKE_MAX} — as high as a {gradeOf(STATS.STARTER_SPIKE_MAX)}. That&apos;s
        deliberate: it gives a day-one stable something to point at, without the whole bird
        jumping bands. Raising the whole bird is what <Link href="/wiki/breeding">breeding</Link>{" "}
        is for.
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
        It&apos;s a slight edge, not a hard counter: overcoming the opponent&apos;s element adds a
        small flat bonus to every one of your rolls (worth roughly half a die on the 2d6 fights),
        enough to matter in a close bout and nowhere near enough to make a Fire bird unbeatable
        against Water.
      </p>
      <p>
        Alongside its element, every bird carries a <strong>star rating</strong> from 0 to{" "}
        {STARS.MAX_HALF_STARS / 2} in half-star steps — shown on its card as, for example,{" "}
        &ldquo;2.5★ Wood.&rdquo; Stars are a flat, format-agnostic boost: every full star adds{" "}
        {STARS.BOOST_PER_FULL_STAR} points to <em>all six stats</em> in battle, on top of whatever
        the bird rolled. A high-star bird with middling raw stats can genuinely out-fight a
        low-star bird with better numbers.
      </p>
      <p>
        Stars matter most at the nest. Breeding spreads a chick&apos;s half-stars within{" "}
        {BREEDING.STAR_SPREAD_HALF_STARS} half-stars of the parents&apos; average (see{" "}
        <Link href="/wiki/breeding">Breeding</Link>), so stacking stars across generations is one
        of the two real levers a breeder has — the other being the raw stat numbers themselves.
      </p>

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
        what a bird is actually good at from its stats, element, and stars, and{" "}
        <strong>placing</strong> it in the right company and the right blade to use that (see{" "}
        <Link href="/wiki/fighting">Fighting</Link>). The only way to raise the ceiling on a
        bloodline is <Link href="/wiki/breeding">breeding</Link> a better next generation — patience
        and pairing, not repetition.
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
