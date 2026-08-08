import Link from "next/link";
import {
  AGE,
  ECONOMY,
  FIGHTS_PER_GROUP_BIRD,
  FORMATS,
  JUVENILE_MAJOR,
  LT_CENTS,
  PINTAKASI,
  feeFor,
  fmtLt,
  landForFight,
  landPotShare,
  purseShareOf,
} from "@/engine/config";

export const dynamic = "force-dynamic";

/** dayIndex % 7 → day name (round 20's calendar), purely for display. */
const DAY_NAMES = ["Friday", "Saturday", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"];

/**
 * ONE CROWN'S LAND POT, split the way the bracket splits it (round 42): evenly
 * across every fight actually fought, so a bird takes its own fights over all
 * of them. Rows are keyed by FIGHTS FOUGHT rather than by finish, because that
 * is what the pot pays on — the champion and the runner-up both fought every
 * round, so they take identical land.
 *
 * ⚠ This replaced a per-fight mint on a second land curve PLUS an elimination
 * grant ladder that paid the earliest exit the most. Both are deleted from
 * config; the inversion they produced (a first-round loser out-earning the
 * champion) is what a single pot makes unreachable.
 */
function landByFights(potCents: number, bracketSize: number) {
  const fights = bracketSize - 1;
  return Array.from({ length: Math.log2(bracketSize) }, (_, i) => i + 1).map((mine) => ({
    mine,
    cents: landPotShare(potCents, fights * 2, mine),
  }));
}

/**
 * What each finish actually takes home, worked out the SAME WAY the bracket
 * pays it (see PINTAKASI.PURSE and Tournaments.resolve): ADVANCEMENT is split
 * across every fight WON, a win in round r scoring ROUND_MULTIPLIER^(r-1), and
 * CHAMPION / RUNNER_UP are bonuses on top of that.
 *
 * ⚠ Nothing in the table below is typed. Move a knob in config, or change the
 * bracket size, and every percentage on the page moves with it — which is the
 * whole reason this is a function and not a table of literals. (The engine
 * counts weight as the fights happen, because that is the only place a bye can
 * be told from a win; a FULL bracket has no byes, so counting it forwards from
 * the bracket size like this gives the identical answer.)
 */
function purseStages(
  bracketSize: number,
  purse: {
    readonly ADVANCEMENT: number;
    readonly CHAMPION: number;
    readonly RUNNER_UP: number;
    readonly ROUND_MULTIPLIER: number;
  }
) {
  const rounds = Math.log2(bracketSize);
  // The arithmetic itself lives in config beside the knobs it reads, so this
  // page and the MCP tool descriptions cannot drift apart from each other —
  // they had grown two separate copies of it within an hour of the rule
  // landing. This function is only the SHAPE OF THE TABLE now.
  const share = (wins: number, bonus: "champion" | "runnerUp" | "none") =>
    purseShareOf(bracketSize, purse, wins, bonus);

  const rows = [
    { label: "Champion", birds: 1, wins: rounds, share: share(rounds, "champion") },
    {
      label: "Runner-up — lost the final",
      birds: 1,
      wins: rounds - 1,
      share: share(rounds - 1, "runnerUp"),
    },
  ];
  // Down to ONE win: a bird with zero wins is paid nothing, and the pages below
  // give that its own row rather than listing a 0.0% finish here.
  for (let wins = rounds - 2; wins >= 1; wins--) {
    // How many rounds from the final the bird went out: 1 = semifinal.
    const fromFinal = rounds - 1 - wins;
    rows.push({
      label:
        fromFinal === 1
          ? "Lost the semifinal"
          : fromFinal === 2
            ? "Lost the quarterfinal"
            : `Lost in the round of ${2 ** (fromFinal + 1)}`,
      birds: bracketSize / 2 ** (wins + 1),
      wins,
      share: share(wins, "none"),
    });
  }
  return rows;
}

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
  // What the dearest ordinary night pays in land, as the yardstick the crown
  // pots are read against. `feeFor` because the daily card has a PRICED ladder
  // since round 42 — there is no single "real entry fee" left to quote.
  const dailyOpenFee = feeFor("real", "open");
  const dailyOpenLand = landForFight(dailyOpenFee);
  const exampleBracket = 16;
  // One bracket size for both purse tables, so "the juvenile purse is flatter"
  // is something a reader can SEE by comparing two columns rather than take on
  // trust. Both divisions cap at the same size today; if they ever diverge,
  // each table still describes its own division's real ceiling.
  // Full brackets — since round 43 the caps themselves are 32, so the old
  // Math.min(32, cap) guard against a 64-seat table simplifies away.
  const majorPurseBracket = PINTAKASI.MAX_BRACKET;
  const juvenilePurseBracket = JUVENILE_MAJOR.MAX_BRACKET;
  const majorStages = purseStages(majorPurseBracket, PINTAKASI.PURSE);
  const juvenileStages = purseStages(juvenilePurseBracket, JUVENILE_MAJOR.PURSE);
  const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
  // ── What the door costs, and when a finish pays for it ────────────────────
  // A share of a purse is not a number a player can spend. What they actually
  // ask, once entry has a price, is "does this finish get my money back?" —
  // and the honest answer is a THRESHOLD, because the purse changes every
  // week with the juice pool. So each row also carries the smallest purse at
  // which that finish repays the entry: fee ÷ share, rounded up. Nothing here
  // is typed — move ENTRY_FEE or ROUND_MULTIPLIER and the whole column moves.
  const fee = PINTAKASI.ENTRY_FEE;
  const juvenileFee = JUVENILE_MAJOR.ENTRY_FEE;
  const breakEven = (share: number) => Math.ceil(fee / share).toLocaleString();
  // "A win in each round is worth 1.5× a win in the round before" — the word
  // "double" was true only while the multiplier was 2 (it moved in round 41).
  const mult = PINTAKASI.PURSE.ROUND_MULTIPLIER;
  const juvenileMult = JUVENILE_MAJOR.PURSE.ROUND_MULTIPLIER;
  // The land pots, worked at the bracket each stage ordinarily runs, plus one
  // deliberately tiny field to show the thin-field effect (a fixed pot divided
  // fewer ways pays each bird MORE — the opposite of the old per-fight mint).
  const majorLand = landByFights(PINTAKASI.LAND_POT, majorPurseBracket);
  const juvenileLand = landByFights(JUVENILE_MAJOR.LAND_POT, juvenilePurseBracket);
  const thinBracket = 4;
  const thinLand = landByFights(PINTAKASI.LAND_POT, thinBracket);
  /** A pot is stored in hundredths and RULED as a round number of tokens. */
  const wholeLt = (cents: number) => (cents / LT_CENTS).toLocaleString();

  return (
    <>
      <h1>The Pintakasi Majors</h1>
      <p className="lede">
        Every {DAY_NAMES[PINTAKASI.DAY_OF_WEEK]} — the week&apos;s last day — three blade
        championships, called the <strong>Pintakasi Majors</strong> (or just &ldquo;the
        Majors&rdquo;), crown the best specialist at each distance. Entry costs {fee} GP, and that
        money goes straight into the purse. Getting a seat is the hard part, and every loser goes
        home for good. This is the biggest stage in the game — a separate, gentler and cheaper stage
        for one-year-olds runs the day before, at {juvenileFee} GP; see{" "}
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
        There is no test to pass. <strong>Any</strong> bird of yours may declare for a Major, as
        long as it is alive, fighting, has a real name, and is old enough to be allowed to risk its
        career: age {AGE.FORK}+. That age gate is the only hard rule left at the door. A bird that
        has never won anything can walk up, pay the {fee} GP, and register.
      </p>

      <h3 id="the-entry-fee">What the {fee} GP buys</h3>
      <p>
        Entry costs <strong>{fee} GP</strong>. Put that next to the daily card, where the classes are
        priced (see <Link href="/wiki/ladder">Fighting up</Link>): it is{" "}
        {(fee / feeFor("real", "maiden")).toFixed(1)}× a grown maiden night, and about{" "}
        {((fee / dailyOpenFee) * 100).toFixed(0)}% of a grown open night at {dailyOpenFee} GP — the
        dearest fight the ordinary card runs. Against the other anchor in the game, the{" "}
        {ECONOMY.BREED_FEE} GP it costs to <Link href="/wiki/breeding">breed a bird</Link>, a crown is{" "}
        {(fee / ECONOMY.BREED_FEE).toFixed(1)}× — so standing in one is priced like making a new
        animal, which is a fair way to feel the decision.
        The fee is <em>not</em> a gate — it does not decide who stands, and it buys no advantage in
        the bracket. It buys one thing: <strong>the purse gets bigger</strong>. Every peso paid at
        the door is added to the money the same bracket pays out that day. Nothing is skimmed off
        it.
      </p>
      <div className="callout tip">
        <b>Why a price at all, when it was free for a long time?</b> The purse used to come only
        from the <Link href="/wiki/money">juice pool</Link> — the shared pot that gacha rolls and
        breeding fees fill up. So the biggest stage in the game was paid for by whoever happened to
        be buying eggs and covers that week, and a barn could enter a crown every week having put
        nothing into the pot it was drawing from. That is backwards. Everywhere else in this game,
        the money in a pot is money the fighters put there — that is exactly how the daily card
        works. Now the crowns work that way too: part entrants, part juice.
      </div>
      <p>
        Your fee is <strong>held in escrow</strong>, not spent, from the moment you register. If the
        Committee bumps your bird out later in the week, you get it back. If the championship is
        cancelled for a short field, you get it back. See{" "}
        <Link href="/wiki/money">Golden Pesos</Link> for how escrow works.
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
        The door is open to any bird old enough, and the field is capped. So someone has to decide
        who actually stands when more birds declare than there are seats. Paying the {fee} GP does
        not decide it — money buys a place in the queue, never a seat. That is the Selection
        Committee&apos;s job. It ranks every entrant, in this order:
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
        A Major&apos;s purse is built from <strong>two things added together</strong>.
      </p>
      <ol>
        <li>
          <strong>Every entry fee paid at that crown.</strong> {fee} GP a bird, all of it, no rake.
          A field of twenty birds is {(fee * 20).toLocaleString()} GP in the pot before the juice is
          counted.
        </li>
        <li>
          <strong>The crown&apos;s share of the juice pool</strong> — the shared pot that gacha
          spend and breeding fees feed all week (see <Link href="/wiki/money">Golden Pesos</Link>{" "}
          for where juice comes from). Wednesday&apos;s Juvenile Championship draws its own fixed
          slice first (see below); the Majors take <strong>everything left in the pool</strong>,
          split evenly across however many Majors run that week.
        </li>
      </ol>
      <p>
        So a busy crown pays better than a quiet one, and it pays better <em>because</em> it was
        busy. Every bird that showed up made the pot deeper for the bird that wins it.
      </p>

      <h3>Every win pays</h3>
      <p>
        The purse is cut three ways. The biggest single part of it is paid on the{" "}
        <em>fights themselves</em>:
      </p>
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>Part of the purse</th>
              <th className="num">Share</th>
              <th>Who it goes to</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Advancement</td>
              <td className="num">{pct(PINTAKASI.PURSE.ADVANCEMENT)}</td>
              <td>Split across every fight won in the bracket</td>
            </tr>
            <tr>
              <td>Champion bonus</td>
              <td className="num">{pct(PINTAKASI.PURSE.CHAMPION)}</td>
              <td>The bird that wins the last fight</td>
            </tr>
            <tr>
              <td>Runner-up bonus</td>
              <td className="num">{pct(PINTAKASI.PURSE.RUNNER_UP)}</td>
              <td>The bird that loses the last fight</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>
        <strong>Win a fight here and you are paid for it.</strong> Not the same amount as everyone
        else, though. A win in each round is worth <strong>{mult}×</strong> a win in the round
        before. So round one pays least, the semifinal pays a lot, and the final pays most.
      </p>
      <div className="callout tip">
        <b>Why {mult}× and not double.</b> Doubling is the prettier number, and it was the rule
        until entry had a price. But at double, a bird that won its first fight in a full{" "}
        {majorPurseBracket}-bird Major took home <em>less than the {fee} GP it paid to be there</em>
        . Winning the hardest fight in the game and going home poorer is not &ldquo;every win
        pays&rdquo;. Softening the step to {mult}× moves money from the deep rounds to the shallow
        ones until every winner clears the door — and it costs the champion far less than you would
        think, because the entry fees grew the pot in the first place.
      </div>
      <div className="callout tip">
        <b>And the advancement share had to grow too.</b> When the door went up again — a crown is{" "}
        {fee} GP now — softening the step was no longer enough on its own, because the step was
        already soft. So the advancement slice was widened to {pct(PINTAKASI.PURSE.ADVANCEMENT)},
        taking money off the trophy and handing it to the birds that won a fight. The rule being
        protected is the same one every time: <strong>every win clears the door</strong>. The champion
        still takes far more than anybody else — it just takes a little less than it used to, so that
        all {majorPurseBracket / 2} birds who won a first-round fight go home ahead.
      </div>
      <p className="dim">
        Fair warning about the arithmetic: this is a <em>share</em> of one pot, so a bigger field
        means thinner slices. That is exactly why the bracket is capped at{" "}
        {PINTAKASI.MAX_BRACKET} seats — at the old 64-seat cap, a full field split the advancement
        pool among twice as many winners and no achievable purse could keep a single win ahead of
        the {fee} GP door. The cap is what keeps &ldquo;every win clears the door&rdquo; true on
        the busiest week.
      </p>
      <div className="callout tip">
        <b>Why it works this way.</b> The purse used to be a table of finishing places: champion,
        runner-up, the two semifinal losers, the four quarterfinal losers, and nothing at all below
        that. In a big bracket, most of the birds that won a fight were paid nothing for it. A bird
        could win a Major fight — the hardest fight in the game, with its own career on the line —
        and go home empty. That was wrong. If a bird risked everything and won, it gets paid.
      </div>
      <p>
        You don&apos;t have to do this arithmetic yourself. Here is what each finish actually takes
        home in a full {majorPurseBracket}-bird bracket:
      </p>
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>Finish</th>
              <th className="num">Fights won</th>
              <th className="num">How many birds</th>
              <th className="num">Each takes</th>
              <th className="num">Pays for the {fee} GP once the purse is</th>
            </tr>
          </thead>
          <tbody>
            {majorStages.map((row) => (
              <tr key={row.label}>
                <td>{row.label}</td>
                <td className="num">{row.wins}</td>
                <td className="num">{row.birds}</td>
                <td className="num">{pct(row.share)}</td>
                <td className="num">{breakEven(row.share)} GP</td>
              </tr>
            ))}
            <tr>
              <td>Lost its first fight</td>
              <td className="num">0</td>
              <td className="num">{majorPurseBracket / 2}</td>
              <td className="num">0%</td>
              <td className="num">never</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>
        Read the last column like this. A share is a slice of a pot whose size changes every week,
        so &ldquo;how much GP do I win?&rdquo; has no fixed answer — but &ldquo;how big does the pot
        have to be before this finish pays back my {fee} GP?&rdquo; does. Win one fight and go out,
        and you are ahead as soon as the purse is over {breakEven(majorStages[majorStages.length - 1].share)}{" "}
        GP. Lift the trophy and you needed only {breakEven(majorStages[0].share)} GP in the pot to
        break even, which every real crown clears many times over. Check{" "}
        <strong>tonight&apos;s projected purse</strong> on the championship board before you decide
        a fee is worth it.
      </p>
      <p className="dim">
        A bird that never won a fight is paid nothing — not because there is a rule against it, but
        because there is nothing to pay it <em>for</em>. Its share is zero wins&apos; worth of the
        advancement money and no bonus. The shares that <em>are</em> earned then stretch to fill the
        purse, so nothing is ever held back — a small bracket simply pays its few winners more
        each. Rounding dust always lands with the champion.
      </p>
      <div className="callout warn">
        <b>A bye is not a win.</b> If the field is short, the top seeds skip round one. That skipped
        round pays them nothing. Byes exist because there weren&apos;t enough birds, not because a
        bird beat somebody — and the advancement money is for beating somebody.
      </div>
      <p className="dim">
        Losing your first fight still isn&apos;t nothing. Every bird that threw a blade earns{" "}
        <Link href="/wiki/land">Land Tokens</Link> for it, win or lose. That is the next section.
      </p>

      <h2>The land</h2>
      <p>
        The purse follows the wins. Land follows the <strong>fights</strong>. Each crown has a{" "}
        <strong>fixed pot</strong> of <Link href="/wiki/land">Land Tokens (LT)</Link> — a Major&apos;s
        is {wholeLt(PINTAKASI.LAND_POT)} LT — and the pot is divided evenly across every fight
        actually fought in the bracket. Your bird&apos;s share is its own fights over all of them.
        Nothing about winning enters into it.
      </p>
      <p>Three things fall out of that, and they are all worth knowing before you enter:</p>
      <ul>
        <li>
          <strong>A deeper run earns more.</strong> Two fights is twice the land of one. So the
          champion and the runner-up take the <em>same</em> land — both fought every round.
        </li>
        <li>
          <strong>A bye earns nothing.</strong> Same rule as the purse: a bye is not a fight, so it
          buys no share.
        </li>
        <li>
          <strong>A thin field pays each bird more.</strong> The pot is the same size however many
          birds turn up, so a quiet crown divides it fewer ways. Showing up to an empty bracket is
          rewarded, not punished.
        </li>
      </ul>
      <p>
        Worked out for a full {majorPurseBracket}-bird Major, which runs {majorPurseBracket - 1}{" "}
        fights:
      </p>
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th className="num">Fights fought</th>
              <th>Who that is</th>
              <th className="num">Land</th>
            </tr>
          </thead>
          <tbody>
            {majorLand.map((r) => (
              <tr key={r.mine}>
                <td className="num">{r.mine}</td>
                <td>
                  {r.mine === 1
                    ? "Lost its first fight"
                    : r.mine === majorLand.length
                      ? "The champion, and the runner-up"
                      : `Won ${r.mine - 1}, then lost`}
                </td>
                {/* Pot shares are hundredths like every land figure since round
                    36 — format, never print raw. */}
                <td className="num">{fmtLt(r.cents)} LT</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="dim">
        For scale: a grown bird that fights its whole group on the dearest night the daily card runs
        — the open, at {dailyOpenFee} GP — earns {fmtLt(dailyOpenLand)} LT. Losing your first fight at
        a Major pays {fmtLt(majorLand[0].cents)} LT, or about{" "}
        {(majorLand[0].cents / dailyOpenLand).toFixed(1)}× that. So a first-round hardcore death still
        banks real land, which is the game&apos;s way of saying the risk was real — but the deep run
        is the one that pays, and that is new.
      </p>
      <div className="callout tip">
        <b>An empty-looking crown is a good crown to enter.</b> Take the same{" "}
        {wholeLt(PINTAKASI.LAND_POT)} LT pot and a field of only {thinBracket} birds. The bracket runs{" "}
        {thinBracket - 1} fights instead of {majorPurseBracket - 1}, so one fight is worth{" "}
        {fmtLt(thinLand[0].cents)} LT — against {fmtLt(majorLand[0].cents)} LT in the full field. Same
        pot, fewer ways to split it.
      </div>
      <p className="dim">
        This used to work the other way round, and it is worth saying so plainly because the old rule
        was memorable. Crowns paid land per fight on their own separate curve <em>and</em> handed
        every eliminated bird a consolation grant that grew the <em>earlier</em> it fell — so the
        first bird out could bank more land than the champion. Two scales that had never been priced
        against each other. One pot cannot invert like that: it is a single number, divided by
        counting. The consolation is gone; a fought round is the whole reward.
      </p>

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
        One barn may enter up to {JUVENILE_MAJOR.MAX_PER_BARN}{" "}
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
      <div className="callout tip">
        <b>
          The juvenile crown costs {juvenileFee} GP, against a Major&apos;s {fee}.
        </b>{" "}
        The two stages are priced apart on purpose: the discovery year is meant to be the cheaper
        door, and a chick&apos;s whole season is priced at about half a grown bird&apos;s (see{" "}
        <Link href="/wiki/ladder">Fighting up</Link>). But it is a real price, not a token one —{" "}
        {(juvenileFee / feeFor("juvenile", "maiden")).toFixed(1)}× a juvenile maiden night.
      </div>
      <div className="callout tip">
        <b>It used to be free, and that turned out to be backwards.</b> For one round there was no
        charge at this door at all, on the reasoning that a toll on a chick learning its trade would
        gate the exact stage that is supposed to be open. What changed is the rest of the ladder:
        every class of fight is priced now, and a juvenile open night costs{" "}
        {feeFor("juvenile", "open")} GP. So a free championship had quietly become the{" "}
        <em>cheapest</em> serious fight a one-year-old could take — the best stage in the discovery
        year, at no stake, while an ordinary night cost real money. The price is smaller than a
        Major&apos;s because the juvenile purse is smaller: at a bigger door a chick that won one
        fight would go home under water, which is the one thing the purse rules refuse to allow.
      </div>

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
        supposed to inherit later. A juvenile crown costs a bird nothing beyond the{" "}
        {juvenileFee} GP at the door — win or lose, it goes home able to keep climbing the ladder.
      </div>
      <p>
        Its purse comes out of the same juice pool the Majors draw from — a fixed{" "}
        {(JUVENILE_MAJOR.JUICE_SHARE * 100).toFixed(0)}% slice, taken before Thursday&apos;s Majors
        get whatever&apos;s left, split across the two crowns — both run every week. Entry fees of{" "}
        {juvenileFee} GP are added on top, the same way a Major&apos;s are, so a busy juvenile crown
        pays better than a quiet one.
      </p>
      <p>
        It is paid the same way a Major&apos;s purse is — every fight won pays, and a win in each
        round is worth {juvenileMult}× a win in the round before — but the three parts are set{" "}
        <strong>flatter</strong> on purpose. More of the money rides on winning fights and less on
        lifting the trophy:
      </p>
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>Part of the purse</th>
              <th className="num">Juvenile</th>
              <th className="num">A Major, for comparison</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Advancement (split across every fight won)</td>
              <td className="num">{pct(JUVENILE_MAJOR.PURSE.ADVANCEMENT)}</td>
              <td className="num">{pct(PINTAKASI.PURSE.ADVANCEMENT)}</td>
            </tr>
            <tr>
              <td>Champion bonus</td>
              <td className="num">{pct(JUVENILE_MAJOR.PURSE.CHAMPION)}</td>
              <td className="num">{pct(PINTAKASI.PURSE.CHAMPION)}</td>
            </tr>
            <tr>
              <td>Runner-up bonus</td>
              <td className="num">{pct(JUVENILE_MAJOR.PURSE.RUNNER_UP)}</td>
              <td className="num">{pct(PINTAKASI.PURSE.RUNNER_UP)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>
        What that adds up to: in a full {juvenilePurseBracket}-bird juvenile bracket the champion
        takes {pct(juvenileStages[0].share)}, where a Major champion takes{" "}
        {pct(majorStages[0].share)} of its own purse — and a chick that wins one fight and goes out
        takes {pct(juvenileStages[juvenileStages.length - 1].share)} against a Major&apos;s{" "}
        {pct(majorStages[majorStages.length - 1].share)}. The discovery year is trying to buy one
        behaviour: <strong>show up with a live one and win a fight</strong>. So that is the thing it
        pays for.
      </p>
      <p className="dim">
        Everything else works exactly as it does upstairs: a bye pays nothing, a chick that never
        won a fight is paid nothing, and the remaining shares stretch to fill the purse. The land
        works the same way too, off its own smaller pot — {wholeLt(JUVENILE_MAJOR.LAND_POT)} LT a
        crown, against a Major&apos;s {wholeLt(PINTAKASI.LAND_POT)} LT, split across every fight
        fought. In a full {juvenilePurseBracket}-bird bracket one fight pays{" "}
        {fmtLt(juvenileLand[0].cents)} LT and going the whole way pays{" "}
        {fmtLt(juvenileLand[juvenileLand.length - 1].cents)} LT. See{" "}
        <Link href="/wiki/land">Land Tokens</Link>.
      </p>

      <div className="next">
        <Link href="/wiki/card">The card →</Link>
        <Link href="/wiki/ladder">Fighting up →</Link>
        <Link href="/wiki/money">Golden Pesos →</Link>
        <Link href="/wiki/land">Land Tokens →</Link>
        <Link href="/wiki/breeding">Breeding →</Link>
      </div>
    </>
  );
}
