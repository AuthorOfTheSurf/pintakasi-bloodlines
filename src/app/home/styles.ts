/**
 * The front page's look: the Handbook's palette and type (src/app/wiki/
 * layout.tsx), with more air and hard two-pixel edges that match the fight
 * viewer's buttons, so the sprites sit in a frame drawn the same way they are.
 */
export const HOME_CSS = `
  body { margin: 0; background: #12100d; }
  .home { font-family: ui-monospace, Menlo, monospace; background: #12100d; color: #e8e0d0;
    min-height: 100vh; font-size: 15px; line-height: 1.65; }
  .home a { color: #e8b64c; }
  .home section { max-width: 1040px; margin: 0 auto; padding: 4.5rem 1.5rem; }
  .home section + section { border-top: 2px solid #231f19; }
  .home h2 { color: #e8b64c; font-size: 1.35rem; margin: 0 0 .4rem; letter-spacing: .02em; }
  .home .kicker { color: #9a8f78; margin: 0 0 2rem; max-width: 40rem; }
  .home p { margin: .7rem 0; }
  .home strong { color: #f4e9d0; }

  .hero { text-align: center; padding-top: 5.5rem !important; }
  .hero h1 { color: #e8b64c; font-size: clamp(1.9rem, 6vw, 3.4rem); line-height: 1.1;
    margin: 0 0 1rem; letter-spacing: .04em; text-shadow: 3px 3px 0 #4a3520; }
  .hero .pitch { font-size: clamp(1rem, 2.4vw, 1.2rem); color: #cfc6b2; max-width: 34rem;
    margin: 0 auto 2.6rem; }
  .parade { display: grid; grid-template-columns: repeat(auto-fit, 96px); justify-content: center;
    gap: 1.2rem .6rem; max-width: 860px; margin: 0 auto 2.6rem; list-style: none; padding: 0; }
  .parade li { display: flex; flex-direction: column; align-items: center; gap: .3rem; }
  .parade .perch { background: #1c1914; border: 2px solid #3a342a; padding: .5rem;
    width: 56px; height: 56px; display: grid; place-items: center; }
  .parade .tag { font-size: .72rem; color: #9a8f78; text-align: center; line-height: 1.3;
    overflow-wrap: anywhere; }
  .parade .tag b { display: block; color: #e8e0d0; font-weight: 500; }
  .ctas { display: flex; gap: .8rem; justify-content: center; flex-wrap: wrap; }
  .btn { display: inline-block; font: inherit; font-weight: 600; text-decoration: none;
    padding: .75rem 1.4rem; border: 2px solid #e8b64c; background: #e8b64c; color: #12100d !important;
    box-shadow: 4px 4px 0 #4a3520; cursor: pointer; }
  .btn:hover { background: #f4c96a; border-color: #f4c96a; }
  .btn.ghost { background: transparent; color: #e8b64c !important; border-color: #3a342a;
    box-shadow: none; }
  .btn.ghost:hover { border-color: #e8b64c; background: #1c1914; }
  .stats { display: flex; justify-content: center; flex-wrap: wrap; gap: .4rem 2.2rem;
    margin: 2.6rem 0 0; padding: 0; list-style: none; color: #9a8f78; font-size: .85rem; }
  .stats b { color: #f4e9d0; font-size: 1.05rem; font-variant-numeric: tabular-nums;
    margin-right: .35rem; }

  .pit { max-width: 760px; }
  /* The fight viewer's name plates borrow the office's stable badge. */
  .pit .farm-chip { white-space: nowrap; }
  .pit .dot { display: inline-block; width: .65em; height: .65em; border-radius: 50%;
    border: 2px solid; margin-right: .4em; }
  .pit button { touch-action: manipulation; }
  .poster { all: unset; box-sizing: border-box; cursor: pointer; width: 100%; min-height: 260px;
    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1rem;
    background: #171410; border: 2px solid #3a342a; padding: 1.5rem 1rem; text-align: center; }
  .poster:hover { border-color: #e8b64c; }
  .poster-birds { display: flex; align-items: center; gap: 1.4rem; }
  .poster .vs { color: #9a8f78; }
  .poster .flip { transform: scaleX(-1); line-height: 0; }
  .poster-names { color: #f4e9d0; font-weight: 600; }
  .watch-caption { color: #9a8f78; font-size: .85rem; margin: .8rem 0 0; }
  .empty { background: #1c1914; border: 2px dashed #3a342a; padding: 1.4rem; color: #9a8f78;
    max-width: 760px; }

  .steps { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 210px), 1fr)); gap: 1rem;
    list-style: none; padding: 0; margin: 0; counter-reset: step; }
  .steps li { background: #1c1914; border: 2px solid #3a342a; padding: 1.1rem 1.1rem 1rem;
    display: flex; flex-direction: column; counter-increment: step; }
  .steps li::before { content: counter(step); color: #12100d; background: #e8b64c; font-weight: 700;
    width: 1.7rem; height: 1.7rem; display: grid; place-items: center; margin-bottom: .7rem; }
  .steps h3 { color: #f4e9d0; font-size: 1rem; margin: 0 0 .4rem; }
  .steps p { margin: 0 0 .9rem; color: #cfc6b2; font-size: .9rem; flex: 1; }
  .steps a { font-size: .85rem; text-decoration: none; }
  .steps a:hover { text-decoration: underline; }

  .facts { list-style: none; padding: 0; margin: 0 0 2.4rem; display: grid; gap: .9rem;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 380px), 1fr)); }
  .facts li { border-left: 3px solid #e8b64c; padding: .1rem 0 .1rem .9rem; color: #cfc6b2; }
  .tree { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 1rem;
    max-width: 760px; }
  .tree .parents { display: grid; gap: .8rem; }
  .tree .arrow { color: #e8b64c; font-size: 1.4rem; }
  .bird-card { display: flex; align-items: center; gap: .9rem; background: #1c1914;
    border: 2px solid #3a342a; padding: .7rem .9rem; min-width: 0; }
  .bird-card.star { border-color: #e8b64c; box-shadow: 4px 4px 0 #4a3520; }
  .bird-card .sprite { line-height: 0; flex: none; }
  .bird-card .who { min-width: 0; font-size: .85rem; color: #9a8f78; line-height: 1.45; }
  .bird-card .who b { display: block; color: #f4e9d0; font-size: .95rem; overflow-wrap: anywhere; }
  .bird-card .role { color: #e8b64c; text-transform: uppercase; font-size: .7rem; letter-spacing: .1em; }
  .claim { color: #9a8f78; font-size: .85rem; margin-top: 1rem; }
  @media (max-width: 640px) {
    .tree { grid-template-columns: 1fr; }
    .tree .arrow { transform: rotate(90deg); justify-self: center; }
  }

  .claude { text-align: center; }
  .claude .kicker { margin-left: auto; margin-right: auto; }
  .chat { max-width: 34rem; margin: 0 auto 2.4rem; text-align: left; display: grid; gap: .6rem; }
  .chat p { margin: 0; padding: .7rem .9rem; border: 2px solid #3a342a; font-size: .9rem; }
  .chat .you { background: #1c1914; justify-self: end; max-width: 85%; }
  .chat .claude-says { background: #171410; color: #cfc6b2; max-width: 92%; }
  .chat .who { display: block; font-size: .7rem; color: #9a8f78; text-transform: uppercase;
    letter-spacing: .1em; margin-bottom: .2rem; }
  .seats { color: #9a8f78; font-size: .85rem; margin-top: 1.1rem; }

  .foot { max-width: 1040px; margin: 0 auto; padding: 2rem 1.5rem 3rem; border-top: 2px solid #231f19;
    display: flex; gap: 1.6rem; flex-wrap: wrap; font-size: .82rem; color: #6a6252; }
  .foot a { color: #9a8f78; text-decoration: none; }
  .foot a:hover { color: #e8b64c; }
`;
