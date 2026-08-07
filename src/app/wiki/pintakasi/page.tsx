import Link from "next/link";
import {
  AGE,
  ECONOMY,
  FIGHTS_PER_GROUP_BIRD,
  FORMATS,
  JUVENILE_MAJOR,
  LAND,
  PINTAKASI,
  fmtLt,
  landForFight,
  landForTournamentFight,
} from "@/engine/config";

export const dynamic = "force-dynamic";

/** dayIndex % 7 → day name (round 20's calendar), purely for display. */
const DAY_NAMES = ["Friday", "Saturday", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"];

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
  const dailyRealLand = landForFight(ECONOMY.REAL_ENTRY_FEE);
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

      <h2>Thursday is open</h2>
      <p>
        There is no entry fee and there is no test to pass. <strong>Any</strong> bird of yours may
        declare for a Major, as long as it is alive, fighting, has a real name, and is old enough to
        be allowed to risk its career: age {AGE.FORK}+. That age gate is the only hard rule left at
        the door. A bird that has never won anything can walk up and register.
      </p>
      <div className="callout warn">
        <b>Registering is not the same as standing.</b> Every crown has only{" "}
        {PINTAKASI.MAX_BRACKET} seats. Once they are full, the <strong>Selection Committee</strong>{" "}
        decides who keeps one — and it can refuse you at the door, or bump you out later in the
        week when a better bird declares. Your entry is only safe on Thursday, when the bracket
        actually runs.
      </div>
      <p>
        So a crown is not a line you cross. It is a <strong>seat you have to be good enough to
        hold</strong>. Where your bird sits in the seating list is not a secret number: it is what
        the bird has <strong>earned in its career</strong> — all the GP it has ever taken home from
        the pit. See <Link href="#the-selection-committee">the Selection Committee</Link>, below.
      </p>
      <div className="callout tip">
        <b>Why an open door instead of a threshold.</b> A Major used to demand a fixed number of
        &ldquo;qualification points&rdquo;, banked one per win on the daily card. That gate is gone,
        for two reasons. It was <em>binary</em>: one point short and your bird was nothing, one
        point over and the 40th-best bird in the world stood on exactly the same footing as the
        4th. And it counted a number you could not see anywhere else in the game. A ranking is
        better on both counts. It is continuous — every peso a bird has ever won moves it up the
        list — and it is <em>visible</em>, because career earnings are printed on the bird&apos;s
        own card. You always know roughly where you stand.
      </div>
      <p className="dim">
        The practical effect: on a quiet week, a young bird with nothing on its record really can
        get a seat. On a busy week it will be bumped by birds with real money behind them. That is
        what an open Thursday is supposed to feel like — the door is never locked, but the room
        only holds so many.
      </p>
      <p className="dim">
        One entry on the daily card is a group of up to {FIGHTS_PER_GROUP_BIRD} fights (see{" "}
        <Link href="/wiki/card">The card</Link>), and every win in that group pays its own pot. So a
        bird that sweeps a full group can move a long way up the seating list in a single night.
        Earnings build fast for a bird that is actually winning.
      </p>

      <h2>Hardcore throughout</h2>
      <div className="callout warn">
        <b>Every loss in a Major ends a career.</b> This is the only place in the game a hardcore
        fight happens — the ordinary daily card has none. Win or go home, permanently. A bird that
        falls in round one is done fighting for life. It keeps its stats and its bloodline, its
        hidden sheet reveals on the spot (a hardcore loss counts as a retirement), and it can
        still <Link href="/wiki/breeding">breed</Link> — but it will never fight again. Don&apos;t
        enter a bird here unless you mean it. (The Juvenile Championship, below, is the one
        exception in the whole game — it does <em>not</em> force-retire.)
      </div>

      <h2 id="the-selection-committee">The Selection Committee</h2>
      <p>
        Entry is free and open, and the field is capped. So someone has to decide who actually
        stands when more birds declare than there are seats. That is the Selection Committee. It
        ranks every entrant, in this order:
      </p>
      <ol>
        <li>
          <strong>Career earnings</strong> — every peso the bird has ever won, first and decisively.
          That means pot money from fights it won on the daily card, plus any purse it has taken at
          a championship. Losing costs a bird nothing here; it just doesn&apos;t add anything.
        </li>
        <li>Career wins.</li>
        <li>Average pit figure.</li>
        <li>
          And if two birds are still dead level, a fixed tiebreak, so the order is always the same
          for everyone reading the board.
        </li>
      </ol>
      <p>
        That ranking does two jobs. It <strong>seeds the bracket</strong> (see below), and it draws
        the <strong>bump line</strong>: once a championship&apos;s field fills to{" "}
        {PINTAKASI.MAX_BRACKET}, a new entrant only gets in over the body of the current weakest
        bird in the field. If the newcomer outranks it, that bird is sent home — refunded, live, in
        public — and the newcomer takes its seat. If the newcomer does <em>not</em> outrank it, the
        newcomer is refused instead.
      </p>
      <p>
        Because earnings lead the ranking, the seat goes to the bird that has actually made money in
        the pit, not to the barn that registered first and not to the barn with the fattest wallet.
        You cannot buy earnings: a bird only has them because it won fights.
      </p>
      <div className="callout tip">
        <b>How to keep a seat.</b> Watch the board (it is public all week — see below) and look at
        where your bird sits. Near the bottom of a full field on Monday means somebody will very
        likely bump it by Thursday. The answer is the same as it has always been: go and win real
        fights on the daily card. Every pot you take pushes the bird up the list.
      </div>

      <h2>The bracket</h2>
      <p>
        The bracket scales to whoever is still seated on the day: the next power of two at or above
        the field size, up to a hard ceiling of {PINTAKASI.MAX_BRACKET}. If the field doesn&apos;t fill
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
        ordinary daily-card fight. The regular card pays land once per entry, at settle-up — a
        dear bird that fights its whole group takes {fmtLt(dailyRealLand)} LT for the night. A
        Pintakasi fight mints {fmtLt(crownFightLand)} LT per fighter <em>every single round</em>, no
        matter who wins, and a bird that keeps winning keeps collecting it. (Land is minted in
        hundredths of a token, which is why these are decimals — see{" "}
        <Link href="/wiki/land">Land Tokens</Link>.)
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
                  {/* Grants are stored in the same hundredths as every land
                      figure since round 36 — format, never print raw. */}
                  <td className="num">{fmtLt(grant)}</td>
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
        biggest stage in the game is a public act — you&apos;re choosing to be seen declaring for
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
        This stage <em>does</em> keep a hard gate, and it is the only one left in the game: a
        juvenile bird needs <strong>{JUVENILE_MAJOR.QUALIFYING_WINS} juvenile wins</strong> (see{" "}
        <Link href="/wiki/card">The card</Link> for the discovery-year ladder) before it may stand.
        There is no GP entry either way. One barn may enter up to {JUVENILE_MAJOR.MAX_PER_BARN}{" "}
        birds per blade, in a bracket capped at {JUVENILE_MAJOR.MAX_BRACKET} — half a Major&apos;s
        ceiling, sized for a stage about discovery, not the biggest purse in the game.
      </p>
      <p className="dim">
        Why does the junior stage gate when the senior one doesn&apos;t? Because a one-year-old has
        no career earnings to rank it by — it has barely earned anything at all — so the
        Committee&apos;s seating list would be nearly all ties. A small win requirement does the
        same job here that earnings do upstairs: it asks the chick to show it can beat somebody
        first.
      </p>

      <h3>Which of the two crowns?</h3>
      <p>
        The same rule the Majors use applies here: <strong>one championship per bird per week</strong>.
        Both juvenile crowns run on the same day, so entering one spends the other. Your chick has
        to declare.
      </p>
      <p>
        Nothing steers you toward one blade or the other — a chick that has its{" "}
        {JUVENILE_MAJOR.QUALIFYING_WINS} wins may declare for whichever it likes, whatever it won
        them at. But the useful way to choose is to read the bird&apos;s{" "}
        <Link href="/wiki/birds">scout report</Link> and send it to the blade it reads better at.{" "}
        {FORMATS[JUVENILE_MAJOR.BLADES[0]].label} is the short end of the dial and{" "}
        {FORMATS[JUVENILE_MAJOR.BLADES[1]].label} the long one, and working out which end a bird
        belongs to is the entire point of the discovery year. The crown it declares for is that
        verdict, said out loud.
      </p>
      <p className="dim">
        And if the two read dead even? Then you have a middle-distance bird, no juvenile crown runs
        at the middle, and there is no right answer — pick the softer field, take the result as one
        more piece of data, and go and find its real distance on the daily card.
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
        get whatever&apos;s left, split across the two crowns — both run every week — and paid
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
