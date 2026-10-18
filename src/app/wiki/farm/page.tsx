import Link from "next/link";
import type { ReactNode } from "react";
import { AUTO_RESERVE } from "@/engine/auto-play";
import { CROWN_CHASE, STUD_MARKET } from "@/engine/bot-config";
import {
  AGE,
  BARN,
  CALENDAR,
  COVERS,
  ECONOMY,
  LAND,
  LT_CENTS,
  PINTAKASI,
  STATS,
  STUD_PRICE,
} from "@/engine/config";
import { LOG_LABELS, type LogLabel } from "@/engine/farm-log";
import { GameClock } from "@/engine/game-clock";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Your farm page — The Pintakasi Handbook",
  description:
    "Playing from a browser: signing in, tonight's card, the Enter card bar, what Play my day does, and your farm log.",
};

// One meaning per label, keyed by the engine's own labels, so a new label
// does not compile until this page says what it means.
const LABEL_MEANINGS: Record<LogLabel, ReactNode> = {
  you: (
    <>
      A move you made yourself, from this page or through Claude. Claude counts as you, because it
      only does what you ask.
    </>
  ),
  play_my_day: <>A move the Play my day button made for you.</>,
  game: (
    <>
      A move the game made on its own when the day ended: fights settling, payouts, crowns, Hatch
      Friday.
    </>
  ),
  another_farm: (
    <>
      A move a different farm made that touched yours, such as buying a cover on your stud or
      claiming one of your birds.
    </>
  ),
  house: (
    <>A house stable&apos;s own scripted move. You only see this on a house stable&apos;s log.</>
  ),
  llm_barn: (
    <>
      A move by a house stable that an AI model runs. You only see this on that stable&apos;s log.
    </>
  ),
  unrecorded: (
    <>
      A move made before this world started keeping the log. Nobody wrote down who made it, so the
      log does not guess.
    </>
  ),
};

export default function FarmPage() {
  // The stud seat is stored in hundredths of a token (round 36), like all land.
  const studSeatLt = COVERS.STUD_LISTING_LT / LT_CENTS;
  // The Hatch Friday repricing at the house's own appetite (STUD_MARKET.AUTO_PLAY).
  const greed = STUD_MARKET.AUTO_PLAY.greed;
  const pct = (share: number) => `${Math.round(share * 100)}%`;
  return (
    <>
      <h1>Your farm page</h1>
      <p className="lede">
        The farm page is where you play the game in a web browser. It shows your whole barn, lets
        you pick tonight&apos;s fights, and enters them with one press. You can still play by
        talking to Claude instead. Both ways use the same farm, the same rules and the same money.
      </p>

      <h2>Signing in</h2>
      <p>
        You sign in with your <strong>farm key</strong>. That is the key on your welcome page, the
        one that starts with <code>fk_</code>. The welcome page has an <strong>Open my farm</strong>{" "}
        button that signs you in with it. You can also go to <Link href="/farm">/farm</Link> and
        paste the key there.
      </p>
      <p>
        The browser keeps the key in a cookie, so you stay signed in on that device. The page&apos;s
        own scripts can&apos;t read that cookie, and other websites can&apos;t send it. Use{" "}
        <strong>Sign out</strong> on a shared computer. Your key still works everywhere else.
      </p>
      <div className="callout warn">
        <b>Your key is your farm. </b>Anyone who has it can play your farm, from a browser or from
        Claude. Don&apos;t paste it anywhere but the sign-in box.
      </div>

      <h2>What the page shows</h2>
      <p>
        At the top is your farm: its name, your GP and Land Tokens, and two buttons,{" "}
        <strong>Check in</strong> and <strong>Play my day for me</strong>. Under that are five
        views. Four hold your birds. The fifth, <strong>Your farm</strong>, is your farm log.
      </p>
      <p>
        The top also shows the <strong>game day</strong>, such as &ldquo;Game Friday&rdquo;. The
        game keeps its own calendar, set in the year {CALENDAR.START_YEAR}, so it never looks like
        today&apos;s date. Its weekday is the one that matters: eggs hatch on game Friday, and the
        Majors run on game {GameClock.weekdayOf(PINTAKASI.DAY_OF_WEEK)}. The game&apos;s Friday is
        often not your Friday.
      </p>
      <p>The five views:</p>
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>View</th>
              <th>What&apos;s in it</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Fighting</td>
              <td>Every bird that can still fight, with its record and tonight&apos;s choice</td>
            </tr>
            <tr>
              <td>Retired</td>
              <td>Your breeding stock, with the full stat sheet showing</td>
            </tr>
            <tr>
              <td>Eggs</td>
              <td>Eggs waiting for Hatch Friday</td>
            </tr>
            <tr>
              <td>Results</td>
              <td>
                How your birds&apos; fights went, newest first. It loads one page of fights at a
                time; press <strong>Load older fights</strong> for more. The all-time line above it
                counts every fight, loaded or not.
              </td>
            </tr>
            <tr>
              <td>Your farm</td>
              <td>
                Your farm log: every move made on your farm, newest first, and who made it. See{" "}
                <a href="#farm-log">The farm log</a> below.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>
        Click a column heading to sort by it, and use the filter to narrow a long barn. Click a row
        to open the bird. There you see its <strong>form book</strong> (every fight it has had, with
        a <strong>Watch replay</strong> link), its record on each of the five blades, and its family
        tree.
      </p>

      <h2>The fog still holds</h2>
      <p>
        A bird has six stats, each on a 0–{STATS.MAX} scale. While a bird can still fight, those
        stats are hidden, even from you. So the Fighting table has no stat columns. You judge a live
        bird the way everyone does: from its record and its figures. The sheet shows up in the
        Retired table, because a bird&apos;s stats are revealed when its career ends.
      </p>
      <p>
        This is on purpose. The game is about judging birds from how they fight. A table of hidden
        numbers would give that away. See <Link href="/wiki/card">The card</Link> for the whole fog.
      </p>

      <h2>The Tonight column</h2>
      <p>
        Each day posts a short list of fights. The <strong>Tonight</strong> column gives every
        fighting bird a drop-down of the fights on that list it is allowed to enter, with what each
        one costs. Fights the bird can&apos;t enter are left out, so you can&apos;t pick a fight the
        door would turn down.
      </p>
      <p>
        Each drop-down starts on a <strong>suggestion</strong>. That is a fight like the one the
        house would pick if it played your day (see below). It is not always the very same one. The
        house rolls its own dice, may rest a bird to wait for tomorrow&apos;s weather, and pays for
        crown entries first. The suggestions are spent down the barn, keeping {AUTO_RESERVE} GP
        back, so all of them together cost what your wallet can pay. Sometimes the suggestion is to
        rest the bird tonight. You can change any of them.
      </p>
      <p>
        Some birds have no drop-down. A bird already entered tonight shows its fight, locked. A bird
        still called &ldquo;Egg of…&rdquo; needs a name first. A bird may also be barred for the
        day, such as on a crown day. The column says why.
      </p>

      <h2>Enter card</h2>
      <p>
        When the choices look right, press <strong>Enter card</strong>. Every bird with a fight
        picked is entered at once. Each entry is checked on its own. If one is turned down (you ran
        out of GP, say), the rest still go in, and the page tells you why that one didn&apos;t. The
        same report is saved in your farm log.
      </p>
      <div className="callout warn">
        <b>Entries are binding. </b>Once a bird is entered, its fee is held and its one card for the
        day is spent. You can&apos;t take it back. The fights go off when the day ends.
      </div>

      <h2>Play my day for me</h2>
      <p>
        This button plays one whole day for your farm, right now. It does what a careful player
        would do on a busy day, in this order:
      </p>
      <ol>
        <li>
          <strong>Checks in</strong>, if you haven&apos;t yet. That pays your{" "}
          {ECONOMY.DAILY_DRIP.toLocaleString()} GP drip and your free gacha pull.
        </li>
        <li>
          <strong>Spends your free gacha pulls.</strong> Only the free ones. It never pays GP for a
          roll, because breeding is the better way to fill a barn.
        </li>
        <li>
          <strong>Stands your retired roosters at stud.</strong> It prices each one the way an
          average stable would, then lists him. The first listing of a rooster costs {studSeatLt}{" "}
          LT.
        </li>
        <li>
          <strong>On Hatch Friday, reprices your studs.</strong> It looks at how many covers each
          standing stud sold last week, out of {COVERS.PER_WEEK}. A stud that sold out goes up about{" "}
          {pct(STUD_MARKET.RAISE_SOLD_OUT * greed)}. One that sold at least{" "}
          {pct(STUD_MARKET.HOT_SHARE)} of them goes up about {pct(STUD_MARKET.RAISE_HOT * greed)}.
          One that sold {STUD_MARKET.COLD_COVERS} or fewer gives up {pct(STUD_MARKET.CUT_COLD)} of
          what he asks over the {STUD_PRICE.FLOOR} GP floor.{" "}
          <strong>This replaces a price you set by hand.</strong>
        </li>
        <li>
          <strong>Grows the barn</strong> when it is within {BARN.EXPAND_HEADROOM} slots of full, so
          you never run out of room to breed. To pay, it takes Land Tokens back out of the pool. If
          you don&apos;t have enough staked, it buys the land with GP instead, at{" "}
          {LAND.GP_PER_100_TOKENS} GP per 100 LT. That purchase does not keep the {AUTO_RESERVE} GP
          back, so a big expansion can take a real bite out of your wallet.
        </li>
        <li>
          <strong>Stakes your loose Land Tokens.</strong> Every whole token goes into the pool,
          where it earns GP every day.
        </li>
        <li>
          <strong>Buys one cover</strong> for a retired hen with an empty nest. That is at most one
          a day.
        </li>
        <li>
          <strong>Names any unnamed fighting birds</strong> with a random starter name. A bird
          can&apos;t fight until it has a name. You can rename it later.
        </li>
        <li>
          <strong>Enters the crowns.</strong> It registers birds for this week&apos;s championships:
          birds aged {AGE.FORK} or older with {CROWN_CHASE.CROWN_MIN_REAL_WINS} or more real wins go
          to the Pintakasi Majors, and qualified chicks go to the Juvenile Championship.
        </li>
        <li>
          <strong>Cards every fighting bird it can afford.</strong> It keeps {AUTO_RESERVE} GP back
          so one bad night can&apos;t empty your wallet.
        </li>
      </ol>
      <div className="callout warn">
        <b>It can put a bird in a Major. </b>The Pintakasi Majors are hardcore: every loser&apos;s
        career ends on the spot. Entry costs {PINTAKASI.ENTRY_FEE} GP. If you have a bird aged{" "}
        {AGE.FORK} or older that you don&apos;t want to risk, retire it before you press this
        button, or play that week by hand.
      </div>
      <p>
        Like Enter card, everything it does is binding. It can&apos;t be undone. When it finishes,
        the page tells you what it did: GP before and after, pulls spent, studs listed, studs
        repriced (each with its old and new price), land unstaked or bought for the barn, tokens
        staked, covers bought, birds named, crowns entered, and birds carded. That report is saved
        in your farm log, so you can read it again later.
      </p>
      <p>
        <strong>Why use it?</strong> Some days you don&apos;t have time to card twenty birds. A day
        you skip gets no drip and no fights. This button turns a missed day into an honest, average
        day. It plays only <em>your</em> farm, and only when you press it. The game never plays a
        player&apos;s farm on its own.
      </p>
      <div className="callout tip">
        <b>Set a stud price on a Hatch Friday? </b>Press Play my day first, then set your price. A
        price you set after the house has played stays as you set it.
      </div>
      <div className="callout tip">
        <b>Mix the two. </b>Enter the birds you care about by hand first. Then press Play my day. A
        bird that is already entered keeps its fight, and the house cards the rest.
      </div>

      <h2 id="farm-log">The farm log</h2>
      <p>
        The <strong>farm log</strong> is the <strong>Your farm</strong> view. It has one line for
        each move made on your farm, newest first. A <strong>move</strong> is anything that changed
        your farm: GP in or out, a bird entered, hatched or retired, land staked, a cover bought.
        Every line says who made it.
      </p>
      <p>
        <strong>Why it exists.</strong> Your GP can drop while you are not looking. A fight settles,
        Play my day spends, another farm claims a bird. Without a record, all you see is a smaller
        number. The log lets you find the line that moved your money, and see who moved it and why.
      </p>
      <p>Each line carries one of these labels. You can filter the log to one label at a time.</p>
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>Label</th>
              <th>What it means</th>
            </tr>
          </thead>
          <tbody>
            {(Object.keys(LABEL_MEANINGS) as LogLabel[]).map((key) => (
              <tr key={key}>
                <td>{LOG_LABELS[key]}</td>
                <td>{LABEL_MEANINGS[key]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>
        A press of <strong>Enter card</strong> or <strong>Play my day</strong> leaves one{" "}
        <strong>summary line</strong>. It is the report the page showed you when the press finished.
        Every move that press made sits under it, so you can see what one press did as a whole. If a
        press stops partway, its summary line says so, and why.
      </p>
      <p>
        Some lines are not money. Naming a bird shows up, and so does setting a stud price, whoever
        set it.
      </p>
      <div className="callout warn">
        <b>Check the log after a Hatch Friday. </b>When Play my day reprices your studs, each new
        price shows as a <strong>{LOG_LABELS.play_my_day}</strong> line, not a{" "}
        <strong>{LOG_LABELS.you}</strong> line. That is how you can tell a price you set by hand was
        replaced.
      </div>
      <p>
        <strong>Who can see it.</strong> Only you, while signed in to your farm. There is no way to
        open another farm&apos;s log. The stewards who run the world can see every farm&apos;s
        moves, so they can help when something looks wrong. Hidden stats never appear in the log. It
        keeps the same fog as the rest of the page.
      </p>
      <p>
        Claude reads the same log with its <code>farm_log</code> tool. Ask it &ldquo;why did my GP
        drop?&rdquo; and it can find the money lines and tell you who made each one.
      </p>

      <div className="next">
        <Link href="/wiki">← Start here</Link>
        <Link href="/wiki/card">The card →</Link>
        <Link href="/wiki/birds">Birds &amp; stats →</Link>
      </div>
    </>
  );
}
