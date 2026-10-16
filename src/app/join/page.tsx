import Link from "next/link";
import { BARN, ECONOMY } from "@/engine/config";
import { JoinForm } from "./join-form";

export const dynamic = "force-dynamic";

/** The alpha application. Numbers come from config, like the Handbook's. */
export default function Join() {
  return (
    <>
      <h1>Join the alpha</h1>
      <p className="lede">
        Pintakasi: Bloodlines is a game about raising fighting cocks and breeding better ones. We
        are opening it to a small group of players first. This is the alpha.
      </p>

      <h2>How it works</h2>
      <ol>
        <li>
          <strong>Apply below.</strong> Tell us your farm&apos;s name, its colors, and how to reach
          you. Seats are limited, so not everyone gets in right away.
        </li>
        <li>
          <strong>We reach out.</strong> A steward will message you about the buy-in. That part
          happens person to person, not on this site.
        </li>
        <li>
          <strong>You get your farm.</strong> Once you&apos;re in, we send you a private link. It
          shows your farm and your farm key.
        </li>
        <li>
          <strong>You play through Claude.</strong> You connect Claude to the game, and Claude runs
          your farm with you. The welcome page shows you how, step by step.
        </li>
      </ol>

      <div className="callout tip">
        <b>Everyone starts even.</b> Every farm begins with the same stake:{" "}
        {ECONOMY.STARTING_GP.toLocaleString()} GP and {BARN.STARTER_EGGS} starter eggs. The buy-in
        gets you a seat, not a head start.
      </div>

      <h2>Apply</h2>
      <JoinForm />

      <p className="dim">
        Want to know the rules first? Read <Link href="/wiki">the Handbook</Link>.
      </p>
    </>
  );
}
