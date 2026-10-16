import Link from "next/link";

/**
 * The alpha's front door: the application form and each player's welcome
 * page. Same dark-and-gold palette as the Handbook (wiki/layout.tsx), but its
 * own sheet, so a change to either page family can't restyle the other.
 */
export const metadata = {
  title: "Join the Pintakasi alpha",
  description: "Apply for a farm in the Pintakasi: Bloodlines alpha.",
};

export default function JoinLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="join">
      <style>{CSS}</style>
      <header className="join-head">
        <Link href="/" className="brand">
          🐓 Pintakasi: Bloodlines
        </Link>
        <Link href="/wiki" className="backlink">
          The Handbook →
        </Link>
      </header>
      <main className="join-main">{children}</main>
    </div>
  );
}

const CSS = `
  body { margin: 0; background: #12100d; }
  .join { font-family: ui-monospace, Menlo, monospace; background: #12100d; color: #e8e0d0;
    min-height: 100vh; font-size: 15px; line-height: 1.6; overflow-wrap: anywhere; }
  .join *, .join *::before, .join *::after { box-sizing: border-box; }
  .join-head { display: flex; align-items: center; justify-content: space-between; gap: 1rem;
    padding: 1rem 2rem; border-bottom: 1px solid #3a342a; flex-wrap: wrap; }
  .join-head .brand { color: #e8b64c; font-size: 1.1rem; font-weight: 600; text-decoration: none; }
  .join-head .backlink { color: #9a8f78; text-decoration: none; }
  .join-head .backlink:hover { color: #e8b64c; }
  .join-main { max-width: 720px; margin: 0 auto; padding: 1.5rem 2rem 5rem; }
  @media (max-width: 600px) {
    .join-head { padding: .8rem 1rem; }
    .join-main { padding: 1.2rem 1rem 4rem; }
  }
  .join-main h1 { color: #e8b64c; font-size: 1.5rem; margin: 0 0 .3rem; line-height: 1.3; }
  .join-main h2 { color: #e8b64c; font-size: 1.05rem; margin: 2rem 0 .5rem;
    border-bottom: 1px solid #3a342a; padding-bottom: .3rem; }
  .join-main h3 { color: #f4e9d0; font-size: .95rem; margin: 1.4rem 0 .3rem; }
  .join-main p { margin: .6rem 0; }
  .join-main ol, .join-main ul { margin: .6rem 0; padding-left: 1.4rem; }
  .join-main li { margin: .4rem 0; }
  .join-main a { color: #e8b64c; }
  .join-main strong { color: #f4e9d0; }
  .join-main code { background: #1c1914; border: 1px solid #3a342a; border-radius: 3px;
    padding: .05em .35em; color: #f4e9d0; }
  .lede { color: #cfc6b2; border-left: 3px solid #e8b64c; padding-left: .9rem; margin: .8rem 0 1.4rem; }
  .callout { background: #1c1914; border: 1px solid #3a342a; border-left: 3px solid #e8b64c;
    border-radius: 5px; padding: .7rem .9rem; margin: 1rem 0; }
  .callout.warn { border-left-color: #e07a6a; }
  .callout.tip { border-left-color: #7fc97f; }
  .callout b { color: #e8b64c; }
  .callout.warn b { color: #e07a6a; }
  .callout.tip b { color: #7fc97f; }
  .dim { color: #9a8f78; }

  .form { display: grid; gap: 1.1rem; margin: 1.2rem 0; }
  .field label, .field .label { display: block; color: #f4e9d0; margin-bottom: .3rem; }
  .field .hint { display: block; color: #9a8f78; font-size: .85em; margin-top: .2rem; }
  .field input, .field textarea { width: 100%; font: inherit; color: #e8e0d0; background: #1c1914;
    border: 1px solid #3a342a; border-radius: 5px; padding: .55rem .7rem; }
  .field textarea { min-height: 6rem; resize: vertical; }
  .field input:focus, .field textarea:focus { outline: none; border-color: #e8b64c; }
  .swatches { display: flex; flex-wrap: wrap; gap: .45rem; }
  .swatch { width: 2.3rem; height: 2.3rem; border-radius: 50%; border: 2px solid #3a342a;
    cursor: pointer; padding: 0; }
  .swatch.on { border-color: #e8b64c; box-shadow: 0 0 0 3px #12100d, 0 0 0 5px #e8b64c; }
  .honey { position: absolute; left: -10000px; width: 1px; height: 1px; overflow: hidden; }
  .submit { font: inherit; font-weight: 600; color: #12100d; background: #e8b64c; border: 0;
    border-radius: 5px; padding: .7rem 1.4rem; cursor: pointer; justify-self: start; }
  .submit:disabled { opacity: .6; cursor: wait; }
  .error { color: #e07a6a; }

  .crest { display: flex; align-items: center; gap: .8rem; margin: 1rem 0; }
  .crest .dot { width: 2.4rem; height: 2.4rem; border-radius: 50%; border: 2px solid #3a342a;
    flex: 0 0 auto; }
  .secret { display: block; background: #1c1914; border: 1px solid #3a342a; border-radius: 5px;
    padding: .6rem .8rem; color: #f4e9d0; word-break: break-all; margin: .4rem 0; }
`;
