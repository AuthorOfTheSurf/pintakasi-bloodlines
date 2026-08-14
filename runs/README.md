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
| `2026-08-16-10v10-v2/` | Exp #2: llms start with exp1's lessons (crown-sighted, three-law creeds), Ginto tamed | still a scripted sweep (121k vs 70k avg) but ratio 0.48→0.58, SIX llm crowns (from zero), real breeding pipeline; remaining gap = roster depth × the brief's 12-fighter window |
| `2026-08-16-10v10-v3/` | Exp #3: exp2 + volume ceilings lifted (fighter window 24, reply 1400), literal laws | in progress |
