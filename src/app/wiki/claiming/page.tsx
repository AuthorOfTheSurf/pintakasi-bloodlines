import Link from "next/link";
import { CLAIMER, ECONOMY, FIGHTS_PER_GROUP_BIRD, STAKER_FLOWS, feeFor } from "@/engine/config";
import { fmtGp } from "@/engine/events";

export const dynamic = "force-dynamic";

export default function ClaimingPage() {
  return (
    <>
      <h1>Claiming</h1>
      <p className="lede">
        A claimer is an entry with a price tag on it. You put your own bird up to fight — and to
        be bought. Any other farm can pay the tag and take it home, but only after it&apos;s
        fought for you one last time.
      </p>

      <h2>What a claimer is</h2>
      <p>
        A claimer entry has <strong>two prices on it</strong>, and keeping them straight is most of
        understanding the mechanic.
      </p>
      <ul>
        <li>
          The <strong>tag</strong> — what you are willing to sell the bird for. You pick it from the
          ladder below, and it names the lobby.
        </li>
        <li>
          The <strong>entry fee</strong> — what the night&apos;s fights cost. Like every class of
          fight, a claimer is priced (see <Link href="/wiki/ladder">Fighting up</Link>), and{" "}
          <em>the dearer the tag, the dearer the night</em>: {feeFor("real", "claimer", CLAIMER.PRICES[0])}{" "}
          GP at the cheap rung up to {feeFor("real", "claimer", CLAIMER.PRICES[CLAIMER.PRICES.length - 1])}{" "}
          GP at the dear one, and half those numbers in the discovery year.
        </li>
      </ul>
      <p>
        You pay the fee whatever happens. The tag only changes hands if somebody wants your bird —
        and then it is another farm paying you, not the house.
      </p>
      <p>
        A claimer runs the group stage like every other lobby (see{" "}
        <Link href="/wiki/card">The card</Link>): your bird is dealt into a group and fights up to{" "}
        {FIGHTS_PER_GROUP_BIRD} birds before anybody takes it home. So a claim is placed on a bird
        that is about to be tested three times, not once — and the claimant is buying it on that
        evidence.
      </p>

      <h2>The tag ladder</h2>
      <p>
        {CLAIMER.PRICES.length} rungs, straddling the {ECONOMY.BREED_FEE} GP breed fee on purpose —{" "}
        {CLAIMER.PRICES.filter((p) => p < ECONOMY.BREED_FEE).length} cheaper than a cover,{" "}
        {CLAIMER.PRICES.filter((p) => p >= ECONOMY.BREED_FEE).length} dearer:
      </p>
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th className="num">Tag</th>
              <th className="num">≈ $</th>
              <th>Vs. the {ECONOMY.BREED_FEE} GP breed fee</th>
              <th className="num">Grown entry</th>
              <th className="num">Juvenile entry</th>
            </tr>
          </thead>
          <tbody>
            {CLAIMER.PRICES.map((price) => (
              <tr key={price}>
                <td className="num">{price} GP</td>
                <td className="num">${(price / ECONOMY.GP_PER_DOLLAR).toFixed(2)}</td>
                <td>{price < ECONOMY.BREED_FEE ? "cheaper than a cover" : "dearer than a cover"}</td>
                <td className="num">{feeFor("real", "claimer", price)} GP</td>
                <td className="num">{feeFor("juvenile", "claimer", price)} GP</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>
        A claimer lobby is named by its tag price as well as its blade, so a bird you enter at a
        given rung is pooled with — and drawn against — other birds tagged at that same rung.
        That&apos;s the real trade: a cheap tag is cheap company, but anybody can buy your bird out
        from under you afterward for pocket change. A dear tag protects it — few farms will pay that
        much on a whim — but it also puts you in with whatever company chose to fight at that price,
        which tends to be the stronger birds.
      </p>
      <div className="callout warn">
        <b>You can only use a rung that&apos;s on tonight&apos;s card.</b> Like every other fight,
        claimers are posted daily rather than conjured on demand (see{" "}
        <Link href="/wiki/card">The card</Link>). Each night&apos;s card carries the cheapest rung —{" "}
        {CLAIMER.PRICES[0]} GP, where nearly all the trade happens — plus one dearer rung, which
        rotates. So the bargain end is always open, and the expensive end comes around. If you want
        to run at a rung that isn&apos;t posted, you wait a day or two.
      </div>

      <h3>One-year-olds use the same tags</h3>
      <p>
        Claimers run in the discovery year too, on <strong>exactly the ladder above</strong> — the
        same {CLAIMER.PRICES.join(" / ")} GP rungs. What is cheaper for a one-year-old is the{" "}
        <em>entry fee</em>, which is half the grown price at every rung (that is the last column of
        the table above).
      </p>
      <p>
        Why the animal isn&apos;t discounted, when the night is: a one-year-old that has campaigned
        has real money on its record, because its own entries cost real money. It is worth a grown
        bird&apos;s price. There used to be a separate, far cheaper juvenile ladder — the rungs sat
        well under a single breed fee — and once the discovery year stopped being nearly free, those
        rungs would have turned it into the bargain bin of the whole game: anybody could have bought
        a proven young bird for pocket change.
      </p>
      <p>
        The juvenile card posts a claimer every night, with the rung alternating, so every price comes
        around quickly. Everything else about the sequence below works exactly the same whether the
        bird tagged is a one-year-old or a veteran.
      </p>

      <h2>The sequence</h2>
      <p>The order matters, and it&apos;s the same every time:</p>
      <ol>
        <li>You enter your bird into a claimer lobby at a tag price.</li>
        <li>
          Other farms place <strong>sealed claims</strong> — the tag amount escrows immediately,
          and you don&apos;t know how many claims are in, or from whom, until post time.
        </li>
        <li>
          The card goes off. Your bird fights its whole group for <strong>you</strong>, its original
          owner.
        </li>
        <li>
          You keep any prize money from those fights, win or lose — the claim hasn&apos;t settled
          yet.
        </li>
        <li>
          Only <strong>after</strong> the fight does the bird change hands. If nobody claimed it,
          nothing happens. If one farm claimed it, that farm gets the bird. If several farms
          claimed it, the RNG draws one winner — every losing claimant is refunded in full.
        </li>
      </ol>
      <div className="callout tip">
        <b>A claim can land at the last second.</b> Claims keep coming in right up until the card
        completes — a claim placed just before that moment either makes it onto the board or
        it&apos;s too late. Either way, the fight always happens before any bird actually moves.
      </div>

      <h2>The money</h2>
      <p>
        The selling barn banks the tag less a small staker rake, paid to the farms staking Land
        Tokens rather than to the house. This rake is one of the few in the game that&apos;s still
        live — the daily-card fight pot itself rakes nothing any more (see{" "}
        <Link href="/wiki/card">The card</Link>). The buyer always pays the full tag; the rake
        comes out of the sale, not on top of it.
      </p>
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th className="num">Tag</th>
              <th className="num">Staker rake</th>
              <th className="num">Seller banks</th>
            </tr>
          </thead>
          <tbody>
            {CLAIMER.PRICES.map((price) => {
              const tagCents = price * 100;
              const rakeCents = Math.round(tagCents * STAKER_FLOWS.CLAIM_RAKE);
              return (
                <tr key={price}>
                  <td className="num">{price} GP</td>
                  <td className="num">{fmtGp(rakeCents)} GP</td>
                  <td className="num">{fmtGp(tagCents - rakeCents)} GP</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="dim">
        The rake is {(STAKER_FLOWS.CLAIM_RAKE * 100).toFixed(0)}% of the tag — the seller keeps the
        rest. Nothing is ever printed here either; the rake is just GP moving from the sale into
        the staking pool.
      </p>

      <h2>Two more rules</h2>
      <ul>
        <li>
          <strong>No fight, no claim — but one fight is enough.</strong> If your bird draws nobody
          at all — it was the only bird in the room — the whole thing calls off: its entry fee
          refunds, and so does every claim standing on it, in full. A sale needs a fight to actually
          happen; a bird that never fought never proved anything worth buying. But if the group came
          up short and your bird fought once or twice instead of {FIGHTS_PER_GROUP_BIRD} times, the
          sale goes through as normal — a short card is the lobby&apos;s fault, not the bird&apos;s,
          and voiding a sale over it would punish the seller for the draw.
        </li>
        <li>
          <strong>You can&apos;t claim your own bird, and the house never claims.</strong> Every
          claim is one farm buying from another. There is no bot on the other side of the escrow.
        </li>
      </ul>

      <div className="callout warn">
        <b>Entering a claimer means accepting the tag.</b> Once someone claims your bird, that
        decision is final — there&apos;s no buying it back, no outbidding, no cancelling. Only tag
        a bird at a price you&apos;re genuinely willing to let it go for.
      </div>

      <h2>What&apos;s next</h2>
      <p>
        A farm-to-farm marketplace is planned for birds outside the claiming system, using the
        same rake rule. It isn&apos;t built yet — claiming is the only way to buy or sell a bird
        today.
      </p>

      <div className="next">
        <Link href="/wiki/card">The card →</Link>
        <Link href="/wiki/ladder">Fighting up →</Link>
        <Link href="/wiki/money">Golden Pesos →</Link>
        <Link href="/wiki/land">Land Tokens →</Link>
      </div>
    </>
  );
}
