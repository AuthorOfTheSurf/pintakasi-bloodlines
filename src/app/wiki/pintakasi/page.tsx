import Link from "next/link";
import {
  AGE,
  ECONOMY,
  FORMATS,
  JUVENILE_MAJOR,
  LAND,
  PINTAKASI,
  landForFight,
  landForTournamentFight,
} from "@/engine/config";

export const dynamic = "force-dynamic";

/** dayIndex % 7 → day name (round 20's calendar), purely for display. */
const DAY_NAMES = ["Friday", "Saturday", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"];

const POINT_LABELS: Record<string, string> = {
  juvenile: "Juvenile win (discovery year)",
  real: "Real win",
  hardcore: "Hardcore win",
};

const PURSE_LABELS: Record<string, string> = {
  champion: "Champion",
  runnerUp: "Runner-up",
  sfLoser: "Semifinal loser (each — two of these every time)",
  qfLoser: "Quarterfinal loser (each — four of these, when the bracket is big enough)",
};

const LAND_LABELS: Record<string, string> = {
  champion: "Champion",
  runnerUp: "Runner-up",
  sf: "Semifinal loser",
  qf: "Quarterfinal loser",
  r16: "Round of 16 loser",
  r32: "Round of 32 loser",
  r64: "Round of 64 loser",
};

/** The classic single-elimination pattern, whatever the bracket size. */
function classicSeedPairs(bracketSize: number): string {
  let placement = [1];
  while (placement.length < bracketSize)
    placement = placement.flatMap((s) => [s, placement.length * 2 + 1 - s]);
  const pairs: string[] = [];
  for (let i = 0; i < placement.length; i += 2) pairs.push(`${placement[i]} vs. ${placement[i + 1]}`);
  return pairs.join(", ");
}

export default function PintakasiPage() {
  const realWinsNeeded = Math.ceil(PINTAKASI.QUALIFYING_POINTS / PINTAKASI.POINTS_FOR.real);
  const hardcoreWinsNeeded = Math.ceil(PINTAKASI.QUALIFYING_POINTS / PINTAKASI.POINTS_FOR.hardcore);
  const dailyHardcoreLand = landForFight(ECONOMY.HARDCORE_ENTRY_FEE);
  const crownFightLand = landForTournamentFight(PINTAKASI.LAND_BASIS);
  const exampleBracket = 16;
  const juvenilePurseTotal = Object.values(JUVENILE_MAJOR.PURSE_SHARES).reduce((a, b) => a + b, 0);

  return (
    <>
      <h1>The Pintakasi Majors</h1>
      <p className="lede">
        Every {DAY_NAMES[PINTAKASI.DAY_OF_WEEK]} — the week&apos;s last day — three blade
        championships, called the <strong>Pintakasi Majors</strong> (or just &ldquo;the
        Majors&rdquo;), crown the best specialist at each distance. Entry costs{" "}
        {PINTAKASI.ENTRY_FEE === 0 ? "nothing" : `${PINTAKASI.ENTRY_FEE} GP`}. Getting a seat is the
        hard part, and every loser goes home for good. This is the biggest stage in the game — a
        separate, gentler stage for one-year-olds runs the day before; see{" "}
        <Link href="#juvenile-championship">the Juvenile Championship</Link> below.
      </p>

      <h2>What it is</h2>
      <p>
        The same three blades run <strong>every</strong> week: the two ends of the dial and its
        exact middle. No rotation, no parity to remember — if your bird is a{" "}
        {FORMATS[PINTAKASI.BLADES[2]].label} specialist, its crown runs every single week. The two
        blades the Majors skip, {FORMATS.b2.label} and {FORMATS.b4.label}, are not left out: they
        are the Juvenile Championship&apos;s fixed blades, the day before.
      </p>
      <p>
        Three crowns for three kinds of bird. Nothing rewards a bird built to be good at
        everything. A blade favors different stats — a {FORMATS.b1.label} bird lives on the
        opening break, a {FORMATS[PINTAKASI.BLADES[2]].label} bird on outlasting a long fight, and
        the middle blade weighs everything a bird is at once — and the Pintakasi is built to find
        and crown the bird that mastered ONE of those, not the bird that&apos;s merely fine at all
        of them. Read <Link href="/wiki/fighting">Fighting</Link> for how the blades differ.
      </p>
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>Crown</th>
              <th>Blade</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>The Sprint</td>
              <td>{FORMATS[PINTAKASI.BLADES[0]].label}</td>
            </tr>
            <tr>
              <td>The Middle</td>
              <td>{FORMATS[PINTAKASI.BLADES[1]].label}</td>
            </tr>
            <tr>
              <td>The Classic</td>
              <td>{FORMATS[PINTAKASI.BLADES[2]].label}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2>Free to enter — but you have to earn it</h2>
      <p>
        There is no entry fee. A bird gets in by <strong>campaigning</strong>: every win on the
        ordinary daily card banks qualification points toward a Major. A juvenile win banks zero of{" "}
        <em>these</em> points — the discovery year has its own, separate ladder toward its own
        championship (see below). Real fights and hardcore fights bank points here, and hardcore
        pays double, because that bird wagered its career to win the point.
      </p>
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>Win type</th>
              <th className="num">Points banked</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(PINTAKASI.POINTS_FOR).map(([mode, points]) => (
              <tr key={mode}>
                <td>{POINT_LABELS[mode] ?? mode}</td>
                <td className="num">{points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>
        A bird needs <strong>{PINTAKASI.QUALIFYING_POINTS} points</strong> to stand in a Major —
        roughly {realWinsNeeded} real wins, or {hardcoreWinsNeeded} hardcore
        {hardcoreWinsNeeded === 1 ? " win" : " wins"}, in any mix that adds up. It also has to be
        old enough to fight hardcore at all: age {AGE.FORK}+.
      </p>
      <div className="callout tip">
        <b>Why this way, not a price tag.</b> Buying a seat would just mean the deepest wallet wins
        the biggest purse in the game. Earning a seat means the field is exactly the birds that have
        been proving themselves all week — the Majors reward a campaign, not a bank balance.
      </div>

      <h2>Hardcore throughout</h2>
      <div className="callout warn">
        <b>Every loss in a Major ends a career.</b> Win or go home — permanently. A bird that
        falls in round one is done fighting for life. It keeps its stats and its bloodline, its
        hidden sheet reveals on the spot (a hardcore loss counts as a retirement), and it can
        still <Link href="/wiki/breeding">breed</Link> — but it will never fight again. Don&apos;t
        enter a bird here unless you mean it. (The Juvenile Championship, below, is the one
        exception in the whole game — it does <em>not</em> force-retire.)
      </div>

      <h2>The Selection Committee</h2>
      <p>
        With a free entry and a hard cap on the field, someone has to decide who gets a seat when
        too many birds qualify. That&apos;s the Selection Committee. It ranks every entrant, in
        order:
      </p>
      <ol>
        <li>Qualification points — the campaign that got it here, first and decisively.</li>
        <li>Career earnings.</li>
        <li>Career wins.</li>
        <li>Average pit figure.</li>
      </ol>
      <p>
        That ranking does two jobs. It <strong>seeds the bracket</strong> (see below), and it draws
        the <strong>bump line</strong>: once a championship&apos;s field fills to{" "}
        {PINTAKASI.MAX_BRACKET}, a new entrant only gets in over the body of the current weakest
        birds in the field — if the newcomer outranks them, the weakest bird is sent home and the
        newcomer takes its seat, live, in public. If it doesn&apos;t outrank them, entry is refused.
        Since points lead the ranking, the bump line rewards whichever bird campaigned hardest that
        week, not whichever barn showed up first.
      </p>

      <h2>The bracket</h2>
      <p>
        The bracket scales to whoever actually qualified: the next power of two at or above the
        field size, up to a hard ceiling of {PINTAKASI.MAX_BRACKET}. If the field doesn&apos;t fill
        every seat, the empty seats become <strong>byes</strong>, and byes go to the top seeds — the
        birds the Committee ranked highest skip round one clean. Below {PINTAKASI.MIN_FIELD} entrants
        and there isn&apos;t a fight worth having, so the whole championship is cancelled instead.
      </p>
      <p>
        Seeding is classic tournament pairing: the top seed meets the bottom seed, the next pair
        meets in the middle, and so on — for a {exampleBracket}-bird bracket that&apos;s{" "}
        {classicSeedPairs(exampleBracket)}. It keeps the strongest birds apart until late, and
        barn-mates can absolutely be drawn against each other. So be it — the Committee seeds by
        strength, not by ownership.
      </p>
      <p>
        The whole bracket — every round, from the opener to the final — runs in{" "}
        <strong>one day</strong>, and winners heal to full wind between rounds. That&apos;s a
        deliberate break from realism: Pintakasi: Bloodlines is a game, not a cockfighting
        simulator, and nobody wants to re-register a surviving bird every morning for a week just to
        keep a bracket alive. One day, start to finish, and you find out who&apos;s crowned before
        you go to bed.
      </p>

      <h2>The money</h2>
      <p>
        The purse isn&apos;t funded by entries — entry is free. It&apos;s the <strong>juice
        pool</strong>, the shared pot that gacha spend and breeding fees feed all week (see{" "}
        <Link href="/wiki/money">Golden Pesos</Link> for where juice comes from). Wednesday&apos;s
        Juvenile Championship draws its own fixed slice first (see below); the Majors take
        <strong> everything left in the pool</strong>, split evenly across however many Majors run
        that week — and each blade&apos;s share becomes its purse, paid out top-heavy, with every
        bird eliminated in round one taking zero.
      </p>
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>Finish</th>
              <th className="num">Share of the purse</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(PINTAKASI.PURSE_SHARES).map(([stage, share]) => (
              <tr key={stage}>
                <td>{PURSE_LABELS[stage] ?? stage}</td>
                <td className="num">{(share * 100).toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="dim">
        First-round losers are zeroed outright, and the remaining shares stretch to cover whatever
        the bracket size actually pays out — a straight final pays the champion everything; an
        eight-bird bracket pays only champion, runner-up, and the two semifinal losers. Rounding
        dust always lands with the champion.
      </p>

      <h2>The land</h2>
      <p>
        Purses go to the birds still standing. Land goes the other way —{" "}
        <strong>weighted to the fallen</strong>. Every fight in the bracket mints{" "}
        <Link href="/wiki/land">Land Tokens (LT)</Link> to both birds, on a steeper curve than an
        ordinary daily-card fight: a hardcore fight on the regular card mints {dailyHardcoreLand} LT
        per fighter; a Pintakasi fight mints {crownFightLand} LT per fighter, every round, no matter
        who wins.
      </p>
      <p>
        On top of that, elimination itself pays a grant — and the grant gets bigger the{" "}
        <strong>earlier</strong> a bird falls:
      </p>
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>Eliminated as</th>
              <th className="num">Land grant (LT)</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(PINTAKASI.LAND_GRANTS)
              .sort(([, a], [, b]) => a - b)
              .map(([stage, grant]) => (
                <tr key={stage}>
                  <td>{LAND_LABELS[stage] ?? stage}</td>
                  <td className="num">{grant}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      <div className="callout tip">
        <b>Why the dead outscore the champion on land.</b> The champion already took most of the
        purse. A bird that dies in the first round took the worst hardcore outcome the game has —
        career over, day one — so its consolation is the biggest land grant on the board. A
        first-round death at the Pintakasi is never a pure loss: {LAND.GP_PER_100_TOKENS} GP buys
        100 LT, staked LT pays out daily forever, and that grant keeps paying long after the bird
        itself is done fighting.
      </div>

      <h2>How many birds</h2>
      <p>
        One barn may enter up to <strong>{PINTAKASI.MAX_PER_BARN} birds</strong> in a single
        Major — a deep barn can load one blade with specialists instead of spreading thin. But
        it&apos;s one Major per bird per week: a bird registered for one blade this week can not
        also stand in another blade&apos;s bracket the same week.
      </p>

      <h2>The field is public</h2>
      <p>
        The daily card is fogged — you don&apos;t see who you&apos;re about to fight until the day
        ticks over (see <Link href="/wiki/card">The card</Link>). The Majors&apos; field is the
        opposite: public the moment a bird registers, and public all week. Two reasons. Entering the
        biggest stage in the game is a public act — you&apos;re choosing to be seen campaigning for
        it. And the bump line only means anything if you can see who you&apos;d be bumping: a
        newcomer, and every farm watching, needs to know exactly who the current weakest seed is
        before the Committee makes that call.
      </p>

      <h2 id="juvenile-championship">The day before: the Juvenile Championship</h2>
      <p>
        Round 23 gave the discovery year its own stage. Every{" "}
        {DAY_NAMES[JUVENILE_MAJOR.DAY_OF_WEEK]} — the day before the Majors — two championships run
        for age-{AGE.CHICK} birds only, on the two blades the Majors don&apos;t run:{" "}
        {FORMATS[JUVENILE_MAJOR.BLADES[0]].label} and {FORMATS[JUVENILE_MAJOR.BLADES[1]].label},
        every week. Between the two stages, all five blades crown somebody every single week.
      </p>
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>Crown</th>
              <th>Blade</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Juvenile short blade</td>
              <td>{FORMATS[JUVENILE_MAJOR.BLADES[0]].label}</td>
            </tr>
            <tr>
              <td>Juvenile long blade</td>
              <td>{FORMATS[JUVENILE_MAJOR.BLADES[1]].label}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>
        Qualification is the same idea as the Majors, scaled to the discovery year: a juvenile
        bird needs <strong>{JUVENILE_MAJOR.QUALIFYING_WINS} juvenile wins</strong> (see{" "}
        <Link href="/wiki/card">The card</Link> for the discovery-year ladder) to stand — no GP
        entry either way. One barn may enter up to {JUVENILE_MAJOR.MAX_PER_BARN} birds per blade,
        in a bracket capped at {JUVENILE_MAJOR.MAX_BRACKET} — half a Major&apos;s ceiling, sized for
        a stage about discovery, not the biggest purse in the game.
      </p>
      <div className="callout warn">
        <b>The only championship in the game that isn&apos;t hardcore.</b> Every Major force-retires
        its losers. This one can&apos;t: the discovery year exists to find out what a bird actually
        is, and ending careers at age one would strangle the very population the Majors are
        supposed to inherit later. A juvenile crown costs a bird nothing but the fight itself — win
        or lose, it goes home able to keep climbing the ladder.
      </div>
      <p>
        Its purse comes out of the same juice pool the Majors draw from — a fixed{" "}
        {(JUVENILE_MAJOR.JUICE_SHARE * 100).toFixed(0)}% slice, taken before Thursday&apos;s Majors
        get whatever&apos;s left, split across whichever of the two blades runs that week and paid
        out flatter than a Major&apos;s purse — a discovery-year stage rewards showing up with a
        live one, not just winning it all:
      </p>
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>Finish</th>
              <th className="num">Share of the purse</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(JUVENILE_MAJOR.PURSE_SHARES).map(([stage, share]) => (
              <tr key={stage}>
                <td>{PURSE_LABELS[stage] ?? stage}</td>
                <td className="num">{((share / juvenilePurseTotal) * 100).toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="dim">
        Renormalized to whatever the bracket actually pays out, the same rule as the Majors above.
        Every fight in the bracket still mints Land Tokens to both birds, off the juvenile entry
        fee&apos;s much smaller base — see <Link href="/wiki/land">Land Tokens</Link>.
      </p>

      <div className="next">
        <Link href="/wiki/card">The card →</Link>
        <Link href="/wiki/money">Golden Pesos →</Link>
        <Link href="/wiki/land">Land Tokens →</Link>
        <Link href="/wiki/breeding">Breeding →</Link>
      </div>
    </>
  );
}
