# runs/ — the experiment archive

One directory per experiment, named `YYYY-MM-DD-<slug>` (start date), so the
archive lists chronologically and reads like a lab notebook. Every experiment
that matters lands here — logs are cheap and this history does not
regenerate.

**Inside each experiment directory:**
- `journal.md` — the front door: the whole experiment stitched into one
  chronological read (setup → each segment's verbatim log → the coach session
  that followed it → verdict). Start here.
- `seg*.log` — pure, unedited sim logs, one per segment: the game day by day,
  the brains answering, the doctor's verdicts, failures exactly as printed.
- `coach*.md` — one per coach session: the scoreboard the coach saw, the
  diagnosis, the exact orders written, and what the next segment must show.
  Coaching is part of the loop; a run log without its coach notes is half a
  story.

## The experiments

| Directory | What it was | Verdict |
|---|---|---|
| `2026-08-14-phase4-fleet/` | First full-fleet week (19 barns, 14B) + the 30b bench + the 7-day persona A/B arms | Found the 64 KB message cap + wake stampede (both fixed); 30b MoE halves the clock; creeds redirect behavior |
| `2026-08-15-10v10-coached/` | 10 scripted vs 10 llm (30b), 91 days, coached every 4 weeks | scripted sweep (127k vs 61k avg, crowns 44–0) — but: coaching doubled volume; the crown blindness found + fixed (28 declarations post-fix); breeding never took |
| `2026-08-15-10v10-v2/` | Exp #2: llms start with exp1's lessons (crown-sighted, three-law creeds), Ginto tamed | still a scripted sweep (121k vs 70k avg) but ratio 0.48→0.58, SIX llm crowns (from zero), real breeding pipeline; remaining gap = roster depth × the brief's 12-fighter window |
| `2026-08-15-10v10-v3/` | Exp #3: exp2 + volume ceilings lifted (fighter window 24, reply 1400), literal laws | ratio 0.59, TWELVE llm crowns — every barn a champion; bot-12 reached rank 7 mid-run; the real ceiling identified: the model's ~5-action/day gait + crown brackets eating shallow rosters |
| `2026-08-15-10v10-v4/` | Exp #4: exp3 + bird-by-bird checklist + the hardcore truth (Majors retire losers) | honest negative result: record volume (+44% fights), ratio DOWN to 0.52 — volume without roster depth is negative-margin; exp3 stands as high-water mark |
| `2026-08-15-10v10-v5/` | Exp #5: the INSTRUMENT round — juvenile crown visibility, weekLedger margin feedback, blade-fit + cull laws, the retire verb (attempt 1 aborted day 75: daemon store corruption, see `aborted-attempt-1/`) | ratio 0.43 — better-informed, worse-paid: margin law halved volume (1,053 fights), and the juvenile door stayed locked behind a MODE WORD (0 llm juvenile fights vs 6,214 scripted — age-1 birds need `mode:"juvenile"` and nothing ever said so; instrument gap #4). Real wins: retire→breed loop alive (87 bred, 18 culls), clean infra |
| `2026-08-15-10v10-v6/` | Exp #6: exp5's lessons from day 1 — mode law, volume floor, week-1 pipeline, veteran law | ratio 0.40 — the juvenile door STAYED shut behind instrument gap #5: the enter schema's mode enum lacked "juvenile", making the ordered word unrepresentable at generation time (125 proposals, 0 legal). Real wins: eggs at all 10 barns, retire loop habitual, and the arc's biggest meta-finding — the preamble sets identity but only coach sessions start behavior chains ("coaching is the executive function") |
| `2026-08-16-10v10-v7/` | Exp #7: the open door — mode enum fixed + season plan as blunt day-2 orders (the wallpaper test); gap #6 (naming law) fixed at day 56 | ratio 0.44, best day-56 pace of the arc (0.55) — 568 juvenile fights and 20 juvenile crown entries (first ever, both waves: named starters month 1, christened chicks month 3), wallpaper hypothesis CONFIRMED (identical content: inert as preamble, immediate as dated orders), full discovery loop ran end to end; depth still decides the season (17 vs 377 end actives) |
| `2026-08-16-10v10-v8/` | Exp #8: the breeding-volume season — attempt 1 fail-fast-aborted at day 28 (gap #7: the stud MARKET was invisible, the pipeline killer of all seven prior experiments); attempt 2 with the market in the brief | ratio 0.38 — lowest of the arc AND the most structurally successful season: **first llm juvenile crown CHAMPION ever (Cruel Beak, Ilonggo Ironworks, B2, 1,110 GP)**, 252 bred (5.5× exp7), 167 end actives (10× exp7) — the age cliff finally out-bred; the deficit is a 91-day scoreboard pricing a 252-bird pipeline at zero. First-link law proven 3×: retire only ever fires from dated coach imperatives |

## Cross-cutting investigations

Not every directory is an experiment. Bugs and infrastructure findings that
span experiments get their own dated directory, because filing them under
whichever experiment happened to be running that day buries them.

| Directory | What it is |
|---|---|
| `2026-08-15-rivet-envoy-bug/` | The envoy-rebind bug hunt: hit in the wild across ALL 10v10 experiments (cold-tune wedges, slow rebinds, aged-daemon no-rebind), pinned with the minimal repro in `scripts/rivet-repro.ts`. `rivet-repro-session.md` is the six-generation session that isolated the mechanism. |
