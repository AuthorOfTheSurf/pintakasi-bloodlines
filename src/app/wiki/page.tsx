import Link from "next/link";
import {
  AGE,
  BARN,
  ECONOMY,
  FIGHTS_PER_GROUP_BIRD,
  JUVENILE_MAJOR,
  LAND,
  PINTAKASI,
  STATS,
} from "@/engine/config";

export const dynamic = "force-dynamic";

/** dayIndex % 7 → day name (round 20's calendar), purely for display. */
const DAY_NAMES = ["Friday", "Saturday", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"];

/** The hub — the whole game in five minutes, then doors to the detail. */
export default function WikiHome() {
  return (
    <>
      <h1>Pintakasi: Bloodlines</h1>
      <p className="lede">
        You run a gamefarm. You raise fighting cocks, card them against other players&apos; birds,
        and try to build a bloodline good enough to win a Major. Every bird&apos;s stats are fixed
        the day it hatches — and hidden until the day it retires — so the game is about{" "}
        <strong>judging</strong> birds from how they fight, <strong>placing</strong> them, and{" "}
        <strong>breeding</strong> better ones. Not grinding them stronger.
      </p>

      <h2>The five-minute version</h2>
      <ol>
        <li>
          <strong>Check in</strong> every game-day. It pays {ECONOMY.DAILY_DRIP.toLocaleString()} GP
          and {ECONOMY.FREE_PULLS_PER_CHECK_IN} free gacha pull.
        </li>
        <li>
          <strong>Name your birds.</strong> A bird cannot fight while it&apos;s still called
          &ldquo;Egg of…&rdquo;. That&apos;s a real rule, enforced at the door.
        </li>
        <li>
          <strong>Card them.</strong> Each day posts a short list of fights — a blade, a class,
          sometimes a price. Pick one of those and enter. At the day&apos;s end every lobby deals
          its birds into small groups, and each bird fights everyone else in its group — up to{" "}
          {FIGHTS_PER_GROUP_BIRD} fights off one entry.
        </li>
        <li>
          <strong>Bank the land.</strong> Win or lose, both fighters earn Land Tokens. Stake them and
          they pay you GP every day, forever.
        </li>
        <li>
          <strong>Chase a Major.</strong> Thursday&apos;s Pintakasi Majors are free and open to any
          age-{AGE.FORK} bird — but seats are limited, and the birds that have won the most money
          keep them. The biggest purse in the game.
        </li>
      </ol>

      <div className="callout warn">
        <b>The one rule that will hurt you.</b> Every bout of a Pintakasi Major is{" "}
        <strong>hardcore</strong> — the loser&apos;s career ends on the spot. It keeps its stats and
        can still breed, but it will never fight again. The Majors are the only place in the game
        that happens: there is no hardcore fight on the ordinary daily card. (And the Juvenile
        Championship, the one other crown, never force-retires.) Nobody is ever entered into a
        force-retire fight by accident, and you should never enter one casually.
      </div>

      <h2>The two currencies</h2>
      <div className="cards-2">
        <div className="minicard">
          <b>Golden Pesos (GP)</b>
          The spending money. Entry fees, covers, gacha rolls, claiming tags. You start with{" "}
          {ECONOMY.STARTING_GP.toLocaleString()} GP and the drip tops you up daily.{" "}
          <Link href="/wiki/money">How GP works →</Link>
        </div>
        <div className="minicard">
          <b>Land Tokens (LT)</b>
          The one you keep. Minted by fighting, never sellable, and{" "}
          <strong>staked land earns a share of nearly every GP that changes hands in the world</strong>.{" "}
          <Link href="/wiki/land">How land works →</Link>
        </div>
      </div>

      <h2>The shape of a bird</h2>
      <p>
        Six stats on a 0–{STATS.MAX} scale, one element with a half-star rating, and an age. Stats
        never change after hatching — and they stay <strong>hidden</strong> for the whole fighting
        career, revealed only at retirement. Until then you read the bird&apos;s figures and its
        scout report, not its sheet. A barn holds {BARN.CAPACITY} birds.{" "}
        <Link href="/wiki/birds">The full anatomy →</Link>
      </p>

      <h2>The week</h2>
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>Day</th>
              <th>What happens</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Friday</td>
              <td>
                <strong>Hatch Friday</strong> — eggs hatch, the oldest birds retire on age
              </td>
            </tr>
            <tr>
              <td>Sat–Tue</td>
              <td>Ordinary cards: juvenile and real fights, maidens, conditions, claimers</td>
            </tr>
            <tr>
              <td>{DAY_NAMES[JUVENILE_MAJOR.DAY_OF_WEEK]}</td>
              <td>
                <strong>The Juvenile Championship</strong> — two blade crowns for age-1 birds,{" "}
                <em>not</em> hardcore
              </td>
            </tr>
            <tr>
              <td>Thursday</td>
              <td>
                <strong>The Pintakasi Majors</strong> — three blade championships, hardcore
                throughout
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="dim">
        A game-day ends at midnight Philippine time. Everything you entered that day goes off at
        once. An ordinary card is posted <em>every</em> day, including the two championship days —
        but which fights are on it changes daily. See <Link href="/wiki/card">The card</Link>.
      </p>

      <h2>Where to go next</h2>
      <div className="cards-2">
        <div className="minicard">
          <b>Never played?</b>
          Read <Link href="/wiki/birds">Birds &amp; stats</Link>, then{" "}
          <Link href="/wiki/card">The card</Link>. That&apos;s enough to play your first week.
        </div>
        <div className="minicard">
          <b>Want to win money?</b>
          <Link href="/wiki/fighting">Fighting</Link> explains the five blades and how to read a Pit
          Figure — the whole skill of the game.
        </div>
        <div className="minicard">
          <b>Playing the long game?</b>
          <Link href="/wiki/breeding">Breeding</Link> and <Link href="/wiki/land">Land Tokens</Link>{" "}
          are where a farm compounds instead of just churning.
        </div>
        <div className="minicard">
          <b>Chasing a Major?</b>
          <Link href="/wiki/pintakasi">The Pintakasi Majors</Link> — free, open to any age-{AGE.FORK}{" "}
          bird, and seated on what the bird has earned.
        </div>
      </div>

      <p className="dim" style={{ marginTop: "2rem" }}>
        Every number on these pages is read live from the game&apos;s own settings — the handbook
        cannot drift out of date. Land is priced at {LAND.GP_PER_100_TOKENS} GP per 100 LT.
      </p>
    </>
  );
}
