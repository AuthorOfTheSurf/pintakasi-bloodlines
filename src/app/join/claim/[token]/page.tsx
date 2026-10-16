import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { originOf } from "@/app/doors";
import { db } from "@/db/client";
import { Alpha } from "@/engine/alpha";
import type { FarmColor } from "@/engine/config";
import { SWATCH } from "../../swatches";

export const dynamic = "force-dynamic";

// The page prints a farm key, so it must not be indexed, and its URL (which
// is the credential) must not ride along in a Referer to the Handbook.
export const metadata: Metadata = {
  title: "Your farm is ready",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

/**
 * The player's welcome page, reached by the link a steward sends after
 * approving the application. The token is the only gate, so anyone holding
 * the link holds the farm. That is the same trust the farm key itself gets.
 */
export default async function Claim({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const alpha = new Alpha(db());
  const found = alpha.byClaimToken(token);
  if (!found) notFound();
  const { application, farm } = found;
  alpha.markClaimed(application.id);

  const mcpUrl = `${originOf(await headers())}/api/mcp?key=${farm.apiKey}`;
  const primary = SWATCH[farm.primaryColor as FarmColor] ?? farm.primaryColor;
  const secondary = SWATCH[farm.secondaryColor as FarmColor] ?? farm.secondaryColor;

  return (
    <>
      <h1>Welcome, {application.handler}.</h1>
      <p className="lede">You&apos;re in. Your farm is ready, and its eggs are waiting.</p>

      <div className="crest">
        <span
          className="dot"
          style={{ background: `linear-gradient(135deg, ${primary} 50%, ${secondary} 50%)` }}
        />
        <div>
          <strong>
            {farm.country ? `${farm.country} ` : ""}
            {farm.name}
          </strong>
          <div className="dim">
            {farm.primaryColor} and {farm.secondaryColor}
          </div>
        </div>
      </div>

      <h2>Your farm key</h2>
      <code className="secret">{farm.apiKey}</code>
      <div className="callout warn">
        <b>Keep this private.</b> Your farm key is your login. Anyone who has it can play your farm.
        The same goes for this page&apos;s link. Don&apos;t share either one.
      </div>

      <h2>Connect Claude</h2>
      <p>You play by talking to Claude. Claude connects to the game with this address:</p>
      <code className="secret">{mcpUrl}</code>

      <h3>Claude Desktop or claude.ai</h3>
      <ol>
        <li>Open Settings, then Connectors.</li>
        <li>Choose &ldquo;Add custom connector&rdquo;.</li>
        <li>Name it Pintakasi. Paste the address above as the URL. Save.</li>
        <li>Start a new chat and say: &ldquo;Check in on my Pintakasi farm.&rdquo;</li>
      </ol>

      <h3>Claude Code</h3>
      <p>Run this once in a terminal:</p>
      <code className="secret">claude mcp add --transport http pintakasi &quot;{mcpUrl}&quot;</code>
      <p>Then start Claude Code and ask it to check in on your farm.</p>

      <h2>What next</h2>
      <p>
        Claude will check in, name your birds, and card them with you. To learn the rules yourself,
        read <Link href="/wiki">the Handbook</Link>.
      </p>
    </>
  );
}
