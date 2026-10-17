import type { ReactNode } from "react";

/**
 * The farm page's own sheet, in the house palette (dark and gold, monospace)
 * the office and the Handbook share. Its own sheet so a change here cannot
 * restyle either of them. Phones first: nothing here may push the page wider
 * than the screen; a grid scrolls inside its own box instead.
 */
export default function FarmLayout({ children }: { children: ReactNode }) {
  return (
    <div className="farmpage">
      <style>{CSS}</style>
      {children}
    </div>
  );
}

const CSS = `
  body { margin: 0; background: #12100d; }
  .farmpage { font-family: ui-monospace, Menlo, monospace; background: #12100d; color: #e8e0d0;
    min-height: 100vh; font-size: 14px; line-height: 1.5; overflow-x: hidden; }
  .farmpage *, .farmpage *::before, .farmpage *::after { box-sizing: border-box; }
  .farmpage a { color: #e8b64c; }
  .farmpage code { background: #1c1914; border: 1px solid #3a342a; border-radius: 3px; padding: 0 .3em; }
  .farmpage :focus-visible { outline: 2px solid #e8b64c; outline-offset: 2px; }
  .dim { color: #9a8f78; }
  .world { color: #9a8f78; font-style: italic; }
  .grade { font-weight: 700; }
  .statnum { color: #9a8f78; }
  .up { color: #7fc97f; }
  .down { color: #e07a6a; }

  .wrap { max-width: 1280px; margin: 0 auto; padding: 1rem 16px 7rem; }

  .btn { font: inherit; font-weight: 600; color: #12100d; background: #e8b64c; border: 1px solid #e8b64c;
    border-radius: 6px; padding: .55rem 1rem; min-height: 44px; cursor: pointer; }
  .btn.ghost { color: #e8b64c; background: transparent; }
  .btn.small { min-height: 32px; padding: .2rem .6rem; font-size: .85em; }
  .btn:disabled { opacity: .5; cursor: default; }
  .btn small { display: block; font-weight: 400; font-size: .75em; opacity: .85; }

  .signin { max-width: 520px; margin: 0 auto; padding: 2.5rem 16px; }
  .signin h1 { color: #e8b64c; font-size: 1.4rem; }
  .signin-form { display: grid; gap: .6rem; margin: 1.2rem 0; }
  .signin-form input { font: inherit; color: #e8e0d0; background: #1c1914; border: 1px solid #3a342a;
    border-radius: 6px; padding: .6rem .7rem; min-height: 44px; width: 100%; }
  .error { color: #e07a6a; margin: 0; }

  .farm-head { border: 1px solid #3a342a; background: #1a1712; border-radius: 8px; padding: .9rem 1rem; }
  .farm-top { display: flex; flex-wrap: wrap; justify-content: space-between; gap: .5rem 1rem; align-items: baseline; }
  .farm-name { display: flex; align-items: center; gap: .6rem; font-size: 1.2rem; font-weight: 700; color: #f4e9d0; }
  .crest { width: 1.3rem; height: 1.3rem; border-radius: 50%; border: 1px solid #3a342a; flex: none; }
  .clock { color: #9a8f78; }
  .wallet { display: flex; flex-wrap: wrap; gap: .3rem 1.2rem; margin: .5rem 0 .8rem; }
  .wallet b { color: #e8b64c; }
  .actions { display: flex; flex-wrap: wrap; gap: .6rem; align-items: stretch; }
  .actions form { margin-left: auto; }
  .panel { border: 1px solid #3a342a; border-left: 3px solid #e8b64c; background: #1c1914; border-radius: 6px;
    padding: .7rem .9rem; margin-top: .8rem; }
  .panel h3 { margin: 0 0 .4rem; font-size: .95rem; color: #f4e9d0; }
  .panel ul { margin: .3rem 0 .6rem; padding-left: 1.2rem; }
  .panel .row { display: flex; flex-wrap: wrap; gap: .6rem; margin-top: .6rem; }
  .panel.warn { border-left-color: #e07a6a; }

  .views { display: flex; flex-wrap: wrap; gap: .4rem; margin: 1.2rem 0 .6rem; }
  .views button { font: inherit; color: #9a8f78; background: transparent; border: 1px solid #3a342a;
    border-radius: 6px; padding: .4rem .9rem; min-height: 44px; cursor: pointer; }
  .views button[aria-pressed="true"] { color: #12100d; background: #e8b64c; border-color: #e8b64c; font-weight: 600; }
  .views .count { opacity: .7; font-size: .85em; }

  .toolbar { display: flex; flex-wrap: wrap; gap: .5rem; align-items: center; margin: 0 0 .5rem; }
  .toolbar input[type="search"] { font: inherit; color: #e8e0d0; background: #1c1914; border: 1px solid #3a342a;
    border-radius: 6px; padding: .45rem .7rem; min-height: 44px; flex: 1 1 14rem; min-width: 0; }
  .toolbar details { position: relative; }
  .toolbar summary { cursor: pointer; list-style: none; border: 1px solid #3a342a; border-radius: 6px;
    padding: .45rem .8rem; min-height: 44px; display: flex; align-items: center; color: #9a8f78; }
  .toolbar .colmenu { position: absolute; z-index: 5; right: 0; top: 100%; margin-top: .3rem; background: #1c1914;
    border: 1px solid #3a342a; border-radius: 6px; padding: .5rem .7rem; width: max-content; max-width: 80vw;
    max-height: 60vh; overflow: auto; }
  .toolbar .colmenu label { display: flex; gap: .5rem; align-items: center; min-height: 32px; }
  .summary { margin: 0 0 .5rem; color: #cfc6b2; }

  .gridbox { height: 60vh; min-height: 320px; width: 100%; }
  .ag-row.opens-fight { cursor: pointer; }
  .tonight-cell select { font: inherit; color: #e8e0d0; background: #1c1914; border: 1px solid #3a342a;
    border-radius: 4px; padding: .1rem .3rem; min-height: 32px; max-width: 100%; }
  .tonight-cell .locked { color: #7fc97f; }
  .tonight-cell .blocked { color: #e07a6a; }
  .spark { vertical-align: middle; }

  .detail { margin-top: 1rem; border: 1px solid #3a342a; border-radius: 8px; background: #1a1712; padding: .8rem 1rem; }
  .detail h3 { margin: 0 0 .5rem; font-size: 1rem; color: #f4e9d0; display: flex; flex-wrap: wrap; gap: .4rem; align-items: center; }
  .tabs { display: flex; flex-wrap: wrap; gap: .3rem; margin: 0 0 .6rem; }
  .tabs button { font: inherit; color: #9a8f78; background: transparent; border: 1px solid #3a342a;
    border-radius: 6px; padding: .3rem .8rem; min-height: 44px; cursor: pointer; }
  .tabs button[aria-selected="true"] { color: #e8b64c; border-color: #e8b64c; }
  .tablewrap { overflow-x: auto; }
  .detail table { border-collapse: collapse; width: 100%; font-size: .9em; }
  .detail th, .detail td { text-align: left; padding: .35rem .5rem; border-bottom: 1px solid #2a251e; white-space: nowrap; }
  .detail td.num, .detail th.num { text-align: right; }

  .bar { position: fixed; left: 0; right: 0; bottom: 0; background: #171410; border-top: 1px solid #3a342a; z-index: 10; }
  .bar-in { max-width: 1280px; margin: 0 auto; padding: .6rem 16px; display: flex; gap: .8rem; align-items: center;
    justify-content: space-between; flex-wrap: wrap; }
  .bar p { margin: 0; }
  .report { margin: .6rem 0 0; padding-left: 1.2rem; }

  dialog.fight-modal { width: min(800px, calc(100vw - 2rem)); max-height: 92vh; margin: 4vh auto auto; padding: 0;
    overflow-y: auto; background: #1f1b15; color: inherit; border: 1px solid #3a342a; border-radius: 6px; }
  dialog.fight-modal::backdrop { background: rgba(10, 8, 6, 0.72); }
  dialog.name-dialog { background: #1f1b15; color: inherit; border: 1px solid #3a342a; border-radius: 6px;
    padding: 1rem; width: min(420px, calc(100vw - 2rem)); }
  dialog.name-dialog::backdrop { background: rgba(10, 8, 6, 0.72); }
  dialog.name-dialog input { font: inherit; color: #e8e0d0; background: #1c1914; border: 1px solid #3a342a;
    border-radius: 6px; padding: .5rem .7rem; min-height: 44px; width: 100%; margin: .4rem 0 .6rem; }

  @media (max-width: 767px) {
    .gridbox { height: 65vh; }
    .actions form { margin-left: 0; }
  }
`;
