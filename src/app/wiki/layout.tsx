import Link from "next/link";

/**
 * THE PINTAKASI HANDBOOK — the player-facing wiki (round 22).
 *
 * Zane's ask: "Currently I have to ask an agent to investigate the code to
 * find out little details. A wiki will help me get my cousins into the game."
 * So the rule for every page in here is simple and load-bearing:
 *
 *   NUMBERS ARE IMPORTED, NEVER TYPED.
 *
 * Every fee, odd, cap and share on these pages reads from @/engine/config at
 * render time. Change a knob and the handbook changes with it — a wiki that
 * can go stale is worse than no wiki, because it teaches confident nonsense.
 *
 * The voice is for a cousin who has never played, not for the engine's
 * author: short sentences, concrete money, and the WHY behind a rule where
 * the rule alone would look arbitrary.
 */

export const metadata = {
  title: "The Pintakasi Handbook",
  description: "How Pintakasi: Bloodlines works — birds, blades, money, and land.",
};

const NAV: { href: string; label: string; blurb: string }[] = [
  { href: "/wiki", label: "Start here", blurb: "the game in five minutes" },
  { href: "/wiki/birds", label: "Birds & stats", blurb: "what makes a fighter" },
  { href: "/wiki/fighting", label: "Fighting", blurb: "the five blades, and figures" },
  { href: "/wiki/card", label: "The card", blurb: "the daily card, classes, the fog" },
  { href: "/wiki/claiming", label: "Claiming", blurb: "buying a bird off the card" },
  { href: "/wiki/pintakasi", label: "The Pintakasi", blurb: "Thursday's Majors" },
  { href: "/wiki/breeding", label: "Breeding", blurb: "retired birds make the next ones" },
  { href: "/wiki/gacha", label: "The gacha", blurb: "odds, prices, mystery eggs" },
  { href: "/wiki/money", label: "Golden Pesos", blurb: "where GP comes from and goes" },
  { href: "/wiki/land", label: "Land Tokens", blurb: "the second currency, and staking" },
];

export default function WikiLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="wiki">
      <style>{CSS}</style>
      <header className="wiki-head">
        <Link href="/wiki" className="brand">
          🐓 The Pintakasi Handbook
        </Link>
        <Link href="/admin" className="backlink">
          ← Stewards&apos; Office
        </Link>
      </header>
      <div className="wiki-body">
        <nav className="wiki-nav">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href}>
              <b>{n.label}</b>
              <span>{n.blurb}</span>
            </Link>
          ))}
        </nav>
        <main className="wiki-main">{children}</main>
      </div>
    </div>
  );
}

const CSS = `
  body { margin: 0; }
  .wiki { font-family: ui-monospace, Menlo, monospace; background: #12100d; color: #e8e0d0;
    min-height: 100vh; font-size: 14px; line-height: 1.6; }
  .wiki-head { display: flex; align-items: center; justify-content: space-between; gap: 1rem;
    padding: 1rem 2rem; border-bottom: 1px solid #3a342a; position: sticky; top: 0;
    background: #12100d; z-index: 5; flex-wrap: wrap; }
  .wiki-head .brand { color: #e8b64c; font-size: 1.15rem; font-weight: 600; text-decoration: none; }
  .wiki-head .backlink { color: #9a8f78; text-decoration: none; }
  .wiki-head .backlink:hover { color: #e8b64c; }
  .wiki-body { display: grid; grid-template-columns: 250px minmax(0, 1fr); gap: 2rem;
    max-width: 1200px; margin: 0 auto; padding: 1.5rem 2rem 5rem; }
  @media (max-width: 860px) { .wiki-body { grid-template-columns: 1fr; } }
  .wiki-nav { display: flex; flex-direction: column; gap: .3rem; align-self: start;
    position: sticky; top: 5rem; }
  .wiki-nav a { display: block; padding: .45rem .7rem; border-radius: 5px; text-decoration: none;
    border: 1px solid transparent; }
  .wiki-nav a:hover { background: #1c1914; border-color: #3a342a; }
  .wiki-nav a b { display: block; color: #e8e0d0; font-weight: 500; }
  .wiki-nav a span { display: block; color: #6a6252; font-size: .82em; }
  .wiki-main h1 { color: #e8b64c; font-size: 1.5rem; margin: 0 0 .3rem; }
  .wiki-main h2 { color: #e8b64c; font-size: 1.05rem; margin: 2rem 0 .5rem;
    border-bottom: 1px solid #3a342a; padding-bottom: .3rem; }
  .wiki-main h3 { color: #f4e9d0; font-size: .95rem; margin: 1.4rem 0 .3rem; }
  .wiki-main p { margin: .6rem 0; }
  .wiki-main ul, .wiki-main ol { margin: .6rem 0; padding-left: 1.4rem; }
  .wiki-main li { margin: .3rem 0; }
  .wiki-main a { color: #e8b64c; }
  .wiki-main code { background: #1c1914; border: 1px solid #3a342a; border-radius: 3px;
    padding: .05em .35em; color: #f4e9d0; }
  .wiki-main strong { color: #f4e9d0; }
  .lede { color: #cfc6b2; font-size: 1.02em; border-left: 3px solid #e8b64c;
    padding-left: .9rem; margin: .8rem 0 1.4rem; }
  .callout { background: #1c1914; border: 1px solid #3a342a; border-left: 3px solid #e8b64c;
    border-radius: 5px; padding: .7rem .9rem; margin: 1rem 0; }
  .callout.warn { border-left-color: #e07a6a; }
  .callout.tip { border-left-color: #7fc97f; }
  .callout b { color: #e8b64c; }
  .callout.warn b { color: #e07a6a; }
  .callout.tip b { color: #7fc97f; }
  .tablewrap { overflow-x: auto; margin: 1rem 0; }
  .wiki-main table { border-collapse: collapse; width: 100%; font-size: .92em; }
  .wiki-main th, .wiki-main td { border: 1px solid #3a342a; padding: .4rem .6rem; text-align: left; }
  .wiki-main th { background: #171410; color: #9a8f78; font-weight: 500; }
  .wiki-main td.num, .wiki-main th.num { text-align: right; font-variant-numeric: tabular-nums; }
  .wiki-main tr:nth-child(even) td { background: #1a1712; }
  .cards-2 { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: .7rem; margin: 1rem 0; }
  .minicard { background: #1c1914; border: 1px solid #3a342a; border-radius: 6px; padding: .7rem .9rem; }
  .minicard b { display: block; color: #e8b64c; margin-bottom: .2rem; }
  .next { display: flex; gap: .6rem; flex-wrap: wrap; margin-top: 2.5rem;
    border-top: 1px solid #3a342a; padding-top: 1rem; }
  .next a { color: #e8b64c; text-decoration: none; border: 1px solid #3a342a;
    border-radius: 5px; padding: .35rem .8rem; }
  .next a:hover { background: #1c1914; }
  .dim { color: #9a8f78; }
`;
