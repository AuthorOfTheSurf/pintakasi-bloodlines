import Link from "next/link";
import {
  AGE,
  CLAIMER,
  ECONOMY,
  LOBBIES,
  LOBBY,
  PINTAKASI,
  STAKER_FLOWS,
  landForFight,
} from "@/engine/config";
import { fmtGp } from "@/engine/events";

export const dynamic = "force-dynamic";

/** Every mode's entry fee and land, read live so this table can't go stale. */
const MODES: { label: string; mode: "juvenile" | "real" | "hardcore"; fee: number; who: React.ReactNode }[] = [
  {
    label: "Juvenile",
    mode: "juvenile",
    fee: ECONOMY.JUVENILE_ENTRY_FEE,
    who: <>age {AGE.CHICK} only — the discovery year</>,
  },
  {
    label: "Real",
    mode: "real",
    fee: ECONOMY.REAL_ENTRY_FEE,
    who: <>age {AGE.REAL_STAKES}+ (below the age {AGE.FIGHTING_CAP} cap)</>,
  },
  {
    label: "Hardcore",
    mode: "hardcore",
    fee: ECONOMY.HARDCORE_ENTRY_FEE,
    who: <>age {AGE.FORK}+ (below the age {AGE.FIGHTING_CAP} cap)</>,
  },
];

export default function CardPage() {
  return (
    <>
      <h1>The card</h1>
      <p className="lede">
        &ldquo;Tonight&apos;s card&rdquo; is every lobby currently open. A lobby is one slot on it —
        keyed by mode, class, and blade (plus a tag price, for claimers). You enter a bird into a
        lobby; when the game-day ends, every lobby that filled pairs its birds off at random and
        the fights run.
      </p>

      <h2>What a lobby is</h2>
      <p>
        Entering a bird joins the open lobby matching your (mode, class, blade) choice, or opens a
        fresh one if the matching lobby is already full. Every lobby is locked at a capacity of{" "}
        {LOBBY.CAPACITY} — an even number, so a lobby that fills completely can pair every bird it
        holds. Entering is binding: the fee is escrowed the moment you enter, and the bird&apos;s
        one fight for the day is spent. There is no cancelling.
      </p>

      <h2>The three modes</h2>
      <p>
        The mode sets the stakes. Juvenile is practice — it builds an amateur record and nothing
        more. Real is where a career actually lives. Hardcore is real stakes with the safety off:
        the loser doesn&apos;t just take a loss, it retires on the spot.
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
            {MODES.map((m) => (
              <tr key={m.mode}>
                <td>{m.label}</td>
                <td className="num">{m.fee} GP</td>
                <td>{m.who}</td>
                <td className="num">{landForFight(m.fee)} LT</td>
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
        <b>Hardcore is not just a dearer fee.</b> Lose one and your bird&apos;s career ends that
        instant — it keeps its stats (its hidden sheet finally reveals, as at any retirement) and
        can still breed, but it never fights again. Every
        Pintakasi Major bout runs under this same rule — the Juvenile Championship is the one
        exception in the game. Only enter one on purpose.
      </div>

      <h2>The class ladder</h2>
      <p>
        The class narrows who may enter, so the field sorts itself without a matchmaker having to
        judge anybody&apos;s strength. The five classes: {LOBBIES.join(" · ")}.
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
              <td>Birds with zero stakes wins — never won a real or hardcore fight.</td>
            </tr>
            <tr>
              <td>nw2</td>
              <td>Birds with fewer than two stakes wins.</td>
            </tr>
            <tr>
              <td>nw3</td>
              <td>Birds with fewer than three stakes wins.</td>
            </tr>
            <tr>
              <td>claimer</td>
              <td>
                Real fights only, entered with a tag price from the claiming ladder — see{" "}
                <Link href="/wiki/claiming">Claiming</Link>.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="callout tip">
        <b>The rule that&apos;s easy to miss.</b> The ladder reads a bird&apos;s <em>stakes</em>{" "}
        wins — real and hardcore only — never its lifetime record. A juvenile&apos;s practice wins
        don&apos;t count. Without this, every two-year-old would arrive with an amateur win already
        on its card and the maiden class would never open for anybody.
      </div>
      <p className="dim">
        Hardcore runs in the open class only — the key rule already does the sorting a ladder
        would. Juvenile lobbies only open <em>open</em>, <em>maiden</em>, and <em>claimer</em> — nw2
        and nw3 stay out, since a one-year-old hasn&apos;t fought long enough to have the record
        they sort by.
      </p>

      <h2>The discovery-year ladder</h2>
      <p>
        The juvenile season isn&apos;t one flat division. It runs its own maiden, open (stakes),
        and claimer classes — the same shape as the grown card, so a bird learns the ladder in the
        one year its results don&apos;t follow it forever.
      </p>
      <div className="callout tip">
        <b>Which record it reads is the trick.</b> A grown bird&apos;s maiden class reads its{" "}
        <em>stakes</em> wins — real and hardcore fights only. A one-year-old has no stakes record
        yet, so its juvenile maiden class reads its <em>juvenile</em> wins instead — the same rule,
        pointed at whichever record the bird is actually old enough to have.
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
        See <Link href="/wiki/claiming">Claiming</Link> for the full sequence — including the rule
        for a claimer that draws no fight.
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
            {MODES.map((m) => {
              const potCents = m.fee * 2 * 100;
              const rakeCents = Math.round(potCents * STAKER_FLOWS.FIGHT_RAKE);
              return (
                <tr key={m.mode}>
                  <td>{m.label}</td>
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
        full it is — that count is always public. What it does not show, while the lobby is still
        open, is whose birds are in it. You can see a lobby is 6 of {LOBBY.CAPACITY} full; you
        can&apos;t see which farms or which birds until the lobby closes and the draw is made.
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
        home as the odd bird out — fee refunded in full, but no land. <strong>Land is for
        fighting, not queueing.</strong>
      </p>

      <h2>After the win</h2>
      <p>
        A win on the daily card banks qualification points toward Thursday&apos;s Pintakasi Majors
        —{" "}
        {PINTAKASI.POINTS_FOR.real} for a real win, {PINTAKASI.POINTS_FOR.hardcore} for a hardcore
        win, {PINTAKASI.POINTS_FOR.juvenile} for juvenile practice. A bird needs{" "}
        {PINTAKASI.QUALIFYING_POINTS} of them to stand in a Major. See{" "}
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
