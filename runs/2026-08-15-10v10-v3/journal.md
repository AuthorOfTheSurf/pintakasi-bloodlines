# The 10v10 v3 journal — one continuous read

Experiment #3 (2026-08-15, overnight): exp2's build plus the postmortem's
carry-forward — the volume ceilings lifted (brief fighter window 12→24,
reply budget 700→1400) and the preamble's laws made literal ("15 healthy
birds means 15 entries"; "breed at least once every week"). Same split,
seed, model, segments, coach cadence.

---

## Segment 1 — days 1–28 (verbatim sim log)

```
$ bun run scripts/simulate.ts "28" "--seed=1" "--brain=qwen3:30b-a3b" "--llm=bot-7,bot-15,bot-marco,bot-9,bot-8,bot-16,bot-14,bot-12,bot-13,bot-17" --actors "--personas=championship"
Fresh world seeded at /Users/plumeria/Repos/pintakasi-bloodlines/data/sim-20260815-0419.db — day 0, Friday

Brain: qwen3:30b-a3b plays 10 stable(s) — bot-7, bot-15, bot-marco, bot-9, bot-8, bot-16, bot-14, bot-12, bot-13, bot-17

Personas set: 10 barn(s) start under the championship creeds

  [brain] Ilonggo Ironworks: 0 actions (12.8s)
  [brain] Hacienda Verde: 0 actions (13.5s)
  [brain] Pulang Bagwis: 0 actions (14.1s)
  [brain] Marco Gamefarm: 0 actions (14.8s)
  [brain] Batangas Sprint Club: 2 actions (15.8s)
  [brain] Talisay Tari Club: 1 actions (16.7s)
  [brain] Cuchillos de Sonora: 0 actions (17.4s)
  [brain] Sugalan Social Club: 2 actions (18.4s)
  [brain] Bagong Laban: 0 actions (19.0s)
  [brain] Cavite Bloodlines: 2 actions, 5 dropped (22.6s)
          ✗ 1× crown: unknown bird #3
          ✗ 1× enter: unknown bird #3
          ✗ 1× enter: unknown bird #1
          ✗ 1× enter: unknown bird #2
          ✗ 1× list_stud: unknown bird #4
Day 1 (Saturday): 0 fights, 0 unmatched, 0 claims settled, staking paid 831.90 GP to 11 stakers — 22.7s
  [brain] Ilonggo Ironworks: 0 actions (0.9s)
  [brain] Bagong Laban: 0 actions (1.6s)
  [brain] Batangas Sprint Club: 0 actions (2.3s)
  [brain] Pulang Bagwis: 2 actions, 15 dropped (7.7s)
          ✗ 14× enter: unknown bird #3
          ✗ 1× crown: unknown bird #3
  [brain] Talisay Tari Club: 2 actions, 5 dropped (10.0s)
          ✗ 5× enter: unknown bird #3
  [brain] Hacienda Verde: 1 actions (11.0s)
  [brain] Cuchillos de Sonora: 2 actions, 15 dropped (19.7s)
          ✗ 1× crown: unknown bird #3
          ✗ 1× enter: unknown bird #3
          ✗ 1× enter: unknown bird #2
          ✗ 1× enter: unknown bird #1
          ✗ 1× enter: unknown bird #4
          ✗ 1× enter: unknown bird #5
          ✗ 1× enter: unknown bird #6
          ✗ 1× enter: unknown bird #7
          ✗ 1× enter: unknown bird #8
          ✗ 1× enter: unknown bird #9
          ✗ 1× enter: unknown bird #10
          ✗ 1× enter: unknown bird #11
          ✗ 1× enter: unknown bird #12
          ✗ 1× enter: unknown bird #13
          ✗ 1× enter: unknown bird #14
  [brain] Sugalan Social Club: 2 actions (20.7s)
  [brain] Cavite Bloodlines: 1 actions (21.6s)
  [brain] Marco Gamefarm: 4 actions, 7 dropped (24.5s)
          ✗ 5× enter: unknown bird #3
          ✗ 1× crown: unknown bird #3
          ✗ 1× list_stud: unknown bird #3
Day 2 (Sunday): 0 fights, 0 unmatched, 0 claims settled, staking paid 1760.00 GP to 14 stakers — 24.8s
  [brain] Pulang Bagwis: 0 actions (1.0s)
  [brain] Ilonggo Ironworks: 0 actions (1.7s)
  [brain] Cuchillos de Sonora: 1 actions, 3 dropped (3.3s)
          ✗ 1× enter: unknown bird #5
          ✗ 1× enter: unknown bird #8
          ✗ 1× enter: unknown bird #1
  [brain] Batangas Sprint Club: 0 actions (4.1s)
  [brain] Bagong Laban: 2 actions (5.2s)
  [brain] Cavite Bloodlines: 0 actions (5.9s)
  [brain] Marco Gamefarm: 1 actions, 14 dropped (15.3s)
          ✗ 1× crown: unknown bird #3
          ✗ 1× enter: unknown bird #3
          ✗ 1× enter: unknown bird #4
          ✗ 1× enter: unknown bird #5
          ✗ 1× enter: unknown bird #6
          ✗ 1× enter: unknown bird #7
          ✗ 1× enter: unknown bird #8
          ✗ 1× enter: unknown bird #9
          ✗ 1× enter: unknown bird #10
          ✗ 1× enter: unknown bird #11
          ✗ 1× enter: unknown bird #12
          ✗ 1× enter: unknown bird #13
          ✗ 1× enter: unknown bird #14
          ✗ 1× enter: unknown bird #15
  [brain] Talisay Tari Club: 0 actions (16.0s)
  [brain] Hacienda Verde: 2 actions, 14 dropped (23.2s)
          ✗ 12× enter: unknown bird #3
          ✗ 1× crown: unknown bird #3
          ✗ 1× list_stud: unknown bird #3
  [brain] Sugalan Social Club: 1 actions, 17 dropped (30.9s)
          ✗ 1× enter: unknown bird #3
          ✗ 1× enter: unknown bird #4
          ✗ 1× enter: unknown bird #5
          ✗ 1× enter: unknown bird #6
          ✗ 1× enter: unknown bird #7
          ✗ 1× enter: unknown bird #8
          ✗ 1× enter: unknown bird #9
          ✗ 1× enter: unknown bird #10
          ✗ 1× enter: unknown bird #11
          ✗ 1× enter: unknown bird #12
          ✗ 1× enter: unknown bird #13
          ✗ 1× enter: unknown bird #14
          ✗ 1× enter: unknown bird #15
          ✗ 1× enter: unknown bird #16
          ✗ 1× enter: unknown bird #17
          ✗ 1× enter: unknown bird #18
          ✗ 1× enter: unknown bird #19
Day 3 (Monday): 0 fights, 0 unmatched, 0 claims settled, staking paid 855.98 GP to 18 stakers — 31.1s
  [brain] Batangas Sprint Club: 0 actions (1.0s)
  [brain] Marco Gamefarm: 2 actions (2.1s)
  [brain] Hacienda Verde: 2 actions, 3 dropped (4.5s)
          ✗ 1× crown: unknown bird #3
          ✗ 1× enter: unknown bird #3
          ✗ 1× list_stud: unknown bird #3
  [brain] Talisay Tari Club: 2 actions, 1 dropped (6.0s)
          ✗ 1× list_stud: unknown bird #1
  [brain] Pulang Bagwis: 2 actions, 2 dropped (8.1s)
          ✗ 1× crown: unknown bird #3
          ✗ 1× enter: unknown bird #3
  [brain] Cuchillos de Sonora: 3 actions, 2 dropped (10.4s)
          ✗ 1× crown: unknown bird #1
          ✗ 1× enter: unknown bird #1
  [brain] Ilonggo Ironworks: 1 actions, 4 dropped (13.3s)
          ✗ 1× enter: unknown bird #3
          ✗ 1× enter: unknown bird #2
          ✗ 1× enter: unknown bird #1
          ✗ 1× crown: unknown bird #3
  [brain] Bagong Laban: 1 actions, 15 dropped (20.6s)
          ✗ 14× enter: unknown bird #3
          ✗ 1× crown: unknown bird #3
  [brain] Sugalan Social Club: 1 actions (21.3s)
ts=2026-08-14T20:21:16.187488Z level=warn message="actor framework action error response" actor_id=57omeeimuy1rk2r3oy724yogzrbl00 generation=1 actor_key="Some(\"sim-20260815-0419/bot-9\")" group=rivetkit code=internal_error
level=warn msg="http error response" group=rivetkit code=internal_error message="An internal error occurred" actorId=57omeeimuy1rk2r3oy724yogzrbl00 generation=1 actorKey=sim-20260815-0419/bot-9
[bot-brain] bot-9 proposed nothing: An internal error occurred
Day 4 (Tuesday): 0 fights, 0 unmatched, 0 claims settled, staking paid 839.93 GP to 20 stakers — 44.0s
  [brain] Talisay Tari Club: 0 actions (1.0s)
  [brain] Batangas Sprint Club: 1 actions, 2 dropped (2.2s)
          ✗ 1× list_stud: unknown bird #3
          ✗ 1× enter: unknown bird #3
  [brain] Sugalan Social Club: 2 actions, 4 dropped (4.2s)
          ✗ 2× enter: unknown bird #3
          ✗ 1× crown: unknown bird #3
          ✗ 1× list_stud: unknown bird #3
  [brain] Bagong Laban: 0 actions (4.9s)
  [brain] Cavite Bloodlines: 2 actions (5.8s)
  [brain] Cuchillos de Sonora: 3 actions, 4 dropped (8.0s)
          ✗ 4× enter: unknown bird #3
  [brain] Pulang Bagwis: 2 actions (9.1s)
  [brain] Marco Gamefarm: 2 actions (10.0s)
  [brain] Ilonggo Ironworks: 2 actions, 2 dropped (12.2s)
          ✗ 1× crown: unknown bird #3
          ✗ 1× enter: unknown bird #3
  [brain] Hacienda Verde: 2 actions, 4 dropped (15.2s)
          ✗ 2× enter: unknown bird #3
          ✗ 1× crown: unknown bird #3
          ✗ 1× list_stud: unknown bird #3
Day 5 (Wednesday): 0 fights, 0 unmatched, 0 claims settled, staking paid 1096.07 GP to 20 stakers — 15.4s
  [brain] Cavite Bloodlines: 2 actions, 13 dropped (7.2s)
          ✗ 1× crown: unknown bird #3
          ✗ 1× enter: unknown bird #3
          ✗ 1× enter: unknown bird #1
          ✗ 1× enter: unknown bird #2
          ✗ 1× enter: unknown bird #4
          ✗ 1× enter: unknown bird #5
          ✗ 1× enter: unknown bird #6
          ✗ 1× enter: unknown bird #7
          ✗ 1× enter: unknown bird #8
          ✗ 1× enter: unknown bird #9
          ✗ 1× enter: unknown bird #10
          ✗ 1× enter: unknown bird #11
          ✗ 1× enter: unknown bird #12
  [brain] Batangas Sprint Club: 0 actions (7.9s)
  [brain] Talisay Tari Club: 0 actions (8.6s)
  [brain] Hacienda Verde: 2 actions, 3 dropped (11.0s)
          ✗ 1× crown: unknown bird #3
          ✗ 1× enter: unknown bird #3
          ✗ 1× list_stud: unknown bird #4
  [brain] Sugalan Social Club: 2 actions, 7 dropped (14.5s)
          ✗ 5× enter: unknown bird #3
          ✗ 1× crown: unknown bird #3
          ✗ 1× list_stud: unknown bird #3
  [brain] Cuchillos de Sonora: 2 actions (15.6s)
  [brain] Ilonggo Ironworks: 2 actions, 1 dropped (17.1s)
          ✗ 1× list_stud: unknown bird #3
  [brain] Pulang Bagwis: 1 actions (17.9s)
  [brain] Marco Gamefarm: 1 actions (18.8s)
  [brain] Bagong Laban: 3 actions, 5 dropped (21.3s)
          ✗ 1× crown: unknown bird #3
          ✗ 1× enter: unknown bird #1
          ✗ 1× enter: unknown bird #2
          ✗ 1× enter: unknown bird #3
          ✗ 1× list_stud: unknown bird #4
Day 6 (Thursday): 0 fights, 0 unmatched, 0 claims settled, staking paid 920.01 GP to 21 stakers — 21.4s
  [brain] Pulang Bagwis: 0 actions (1.0s)
  [brain] Cuchillos de Sonora: 3 actions, 3 dropped (2.6s)
          ✗ 1× crown: unknown bird #3
          ✗ 1× enter: unknown bird #3
          ✗ 1× list_stud: unknown bird #3
  [brain] Ilonggo Ironworks: 0 actions (3.3s)
  [brain] Batangas Sprint Club: 2 actions, 4 dropped (6.2s)
          ✗ 1× crown: unknown bird #3
          ✗ 1× enter: unknown bird #3
          ✗ 1× enter: unknown bird #2
          ✗ 1× enter: unknown bird #1
  [brain] Talisay Tari Club: 0 actions (6.8s)
  [brain] Bagong Laban: 0 actions (7.5s)
  [brain] Sugalan Social Club: 2 actions, 5 dropped (9.7s)
          ✗ 1× crown: unknown bird #3
          ✗ 1× enter: unknown bird #3
          ✗ 1× enter: unknown bird #5
          ✗ 1× list_stud: unknown bird #7
          ✗ 1× list_stud: unknown bird #9
  [brain] Hacienda Verde: 2 actions, 5 dropped (13.0s)
          ✗ 1× crown: unknown bird #3
          ✗ 1× enter: unknown bird #3
          ✗ 1× enter: unknown bird #1
          ✗ 1× enter: unknown bird #2
          ✗ 1× list_stud: unknown bird #4
  [brain] Cavite Bloodlines: 3 actions, 3 dropped (15.5s)
          ✗ 1× crown: unknown bird #3
          ✗ 1× enter: unknown bird #3
          ✗ 1× list_stud: unknown bird #1
  [brain] Marco Gamefarm: 2 actions, 1 dropped (16.8s)
          ✗ 1× list_stud: unknown bird #3
Day 7 (Friday): 0 fights, 0 unmatched, 0 claims settled, staking paid 839.96 GP to 21 stakers — HATCH FRIDAY (8 hatched) — 16.9s
        wk 1 · 7 days in 2:56 · avg 25.19s/day
  [brain] Bagong Laban: 11 actions (4.3s)
  [brain] Cavite Bloodlines: 12 actions (12.0s)
  [brain] Hacienda Verde: 12 actions (19.4s)
  [brain] Talisay Tari Club: 11 actions (24.6s)
  [brain] Marco Gamefarm: 11 actions (28.5s)
  [brain] Batangas Sprint Club: 0 actions (29.6s)
  [brain] Ilonggo Ironworks: 12 actions (36.8s)
  [brain] Sugalan Social Club: 11 actions (43.8s)
  [brain] Pulang Bagwis: 0 actions (45.0s)
  [brain] Cuchillos de Sonora: 14 actions (50.1s)
Day 8 (Saturday): 76 fights, 0 unmatched, 3 claims settled, staking paid 986.86 GP to 21 stakers — 50.6s
  [brain] Cavite Bloodlines: 0 actions (1.3s)
  [brain] Cuchillos de Sonora: 12 actions (6.3s)
  [brain] Pulang Bagwis: 12 actions (11.4s)
  [brain] Marco Gamefarm: 10 actions (19.1s)
  [brain] Sugalan Social Club: 11 actions (26.0s)
  [brain] Ilonggo Ironworks: 0 actions (27.3s)
  [brain] Talisay Tari Club: 0 actions (28.9s)
  [brain] Batangas Sprint Club: 11 actions (36.0s)
  [brain] Hacienda Verde: 0 actions (37.4s)
  [brain] Bagong Laban: 12 actions (42.5s)
Day 9 (Sunday): 102 fights, 0 unmatched, 4 claims settled, staking paid 941.59 GP to 21 stakers — 42.8s
  [brain] Pulang Bagwis: 10 actions (4.2s)
  [brain] Talisay Tari Club: 11 actions (9.0s)
  [brain] Sugalan Social Club: 11 actions (13.2s)
  [brain] Batangas Sprint Club: 6 actions (16.0s)
  [brain] Hacienda Verde: 14 actions (23.7s)
  [brain] Bagong Laban: 10 actions (27.9s)
  [brain] Marco Gamefarm: 9 actions (33.4s)
  [brain] Cuchillos de Sonora: 11 actions (39.1s)
  [brain] Cavite Bloodlines: 19 actions (45.0s)
  [brain] Ilonggo Ironworks: 11 actions (52.0s)
Day 10 (Monday): 67 fights, 0 unmatched, 2 claims settled, staking paid 931.60 GP to 21 stakers — 52.3s
  [brain] Hacienda Verde: 0 actions (1.6s)
  [brain] Batangas Sprint Club: 0 actions (3.0s)
  [brain] Bagong Laban: 11 actions (8.4s)
  [brain] Cuchillos de Sonora: 0 actions (9.7s)
  [brain] Pulang Bagwis: 2 actions (11.6s)
  [brain] Marco Gamefarm: 15 actions (20.4s)
  [brain] Ilonggo Ironworks: 0 actions (22.2s)
  [brain] Sugalan Social Club: 13 actions (30.0s)
  [brain] Cavite Bloodlines: 13 actions (38.0s)
  [brain] Talisay Tari Club: 0 actions (39.4s)
Day 11 (Tuesday): 78 fights, 0 unmatched, 8 claims settled, staking paid 916.76 GP to 21 stakers — 39.7s
  [brain] Marco Gamefarm: 0 actions (1.7s)
  [brain] Hacienda Verde: 1 actions (3.2s)
  [brain] Cavite Bloodlines: 2 actions (4.8s)
  [brain] Bagong Laban: 12 actions (11.8s)
  [brain] Pulang Bagwis: 13 actions (20.2s)
  [brain] Sugalan Social Club: 0 actions (21.5s)
  [brain] Cuchillos de Sonora: 9 actions (25.4s)
  [brain] Batangas Sprint Club: 11 actions (29.5s)
  [brain] Talisay Tari Club: 0 actions (30.7s)
  [brain] Ilonggo Ironworks: 0 actions (32.2s)
Day 12 (Wednesday): 88 fights, 0 unmatched, 4 claims settled, staking paid 877.59 GP to 21 stakers — 32.5s
  [brain] Talisay Tari Club: 19 actions (6.0s)
  [brain] Batangas Sprint Club: 0 actions (7.4s)
  [brain] Marco Gamefarm: 14 actions (12.8s)
  [brain] Cavite Bloodlines: 0 actions (14.0s)
  [brain] Bagong Laban: 12 actions (19.0s)
  [brain] Hacienda Verde: 0 actions (20.3s)
  [brain] Sugalan Social Club: 0 actions (21.8s)
  [brain] Ilonggo Ironworks: 15 actions (27.6s)
  [brain] Cuchillos de Sonora: 2 actions (29.6s)
  [brain] Pulang Bagwis: 0 actions (31.2s)
Day 13 (Thursday): 45 fights, 2 unmatched, 7 claims settled, staking paid 1052.65 GP to 21 stakers — 31.7s
  [brain] Hacienda Verde: 0 actions (1.6s)
  [brain] Cuchillos de Sonora: 0 actions (2.9s)
  [brain] Cavite Bloodlines: 14 actions (11.3s)
  [brain] Batangas Sprint Club: 11 actions (16.6s)
  [brain] Marco Gamefarm: 0 actions (17.8s)
  [brain] Pulang Bagwis: 0 actions (19.2s)
  [brain] Ilonggo Ironworks: 0 actions (20.9s)
  [brain] Bagong Laban: 0 actions (22.3s)
  [brain] Talisay Tari Club: 12 actions (30.5s)
  [brain] Sugalan Social Club: 12 actions (35.5s)
Day 14 (Friday): 84 fights, 1 unmatched, 3 claims settled, staking paid 858.78 GP to 21 stakers — HATCH FRIDAY (2 hatched) — 35.9s
        wk 2 · 7 days in 4:46 · avg 40.80s/day
  [brain] Batangas Sprint Club: 0 actions (1.5s)
  [brain] Pulang Bagwis: 8 actions (6.8s)
  [brain] Bagong Laban: 11 actions (11.0s)
  [brain] Cuchillos de Sonora: 19 actions (16.9s)
  [brain] Sugalan Social Club: 12 actions (21.8s)
  [brain] Talisay Tari Club: 0 actions (23.4s)
  [brain] Ilonggo Ironworks: 14 actions (32.1s)
  [brain] Marco Gamefarm: 7 actions (36.6s)
  [brain] Hacienda Verde: 0 actions (38.0s)
  [brain] Cavite Bloodlines: 12 actions (44.1s)
Day 15 (Saturday): 108 fights, 0 unmatched, 6 claims settled, staking paid 1012.62 GP to 21 stakers — 44.6s
  [brain] Batangas Sprint Club: 12 actions (5.2s)
  [brain] Pulang Bagwis: 14 actions (13.8s)
  [brain] Cavite Bloodlines: 0 actions (15.1s)
  [brain] Bagong Laban: 12 actions (20.2s)
  [brain] Cuchillos de Sonora: 14 actions (28.7s)
  [brain] Sugalan Social Club: 12 actions (34.0s)
  [brain] Talisay Tari Club: 0 actions (35.2s)
  [brain] Hacienda Verde: 0 actions (36.6s)
  [brain] Ilonggo Ironworks: 0 actions (38.1s)
  [brain] Marco Gamefarm: 0 actions (39.5s)
Day 16 (Sunday): 99 fights, 3 unmatched, 4 claims settled, staking paid 922.80 GP to 21 stakers — 39.9s
  [brain] Cuchillos de Sonora: 14 actions (6.8s)
  [brain] Hacienda Verde: 0 actions (8.1s)
  [brain] Bagong Laban: 12 actions (15.6s)
  [brain] Sugalan Social Club: 0 actions (16.9s)
  [brain] Cavite Bloodlines: 12 actions (22.1s)
  [brain] Talisay Tari Club: 12 actions (29.4s)
  [brain] Marco Gamefarm: 14 actions (36.4s)
  [brain] Batangas Sprint Club: 1 actions (37.8s)
  [brain] Pulang Bagwis: 9 actions (41.6s)
  [brain] Ilonggo Ironworks: 14 actions (46.8s)
Day 17 (Monday): 104 fights, 1 unmatched, 6 claims settled, staking paid 854.40 GP to 21 stakers — 47.2s
  [brain] Ilonggo Ironworks: 0 actions (1.4s)
  [brain] Cuchillos de Sonora: 12 actions (6.4s)
  [brain] Marco Gamefarm: 13 actions (12.7s)
  [brain] Hacienda Verde: 0 actions (13.9s)
  [brain] Bagong Laban: 13 actions (19.1s)
  [brain] Cavite Bloodlines: 12 actions (24.5s)
  [brain] Talisay Tari Club: 10 actions (31.0s)
  [brain] Batangas Sprint Club: 12 actions (35.5s)
  [brain] Pulang Bagwis: 13 actions (43.4s)
  [brain] Sugalan Social Club: 7 actions (46.6s)
Day 18 (Tuesday): 83 fights, 2 unmatched, 4 claims settled, staking paid 1002.00 GP to 21 stakers — 46.9s
  [brain] Bagong Laban: 14 actions (5.2s)
  [brain] Cuchillos de Sonora: 1 actions (7.2s)
  [brain] Marco Gamefarm: 6 actions (11.4s)
  [brain] Pulang Bagwis: 13 actions (19.7s)
  [brain] Batangas Sprint Club: 12 actions (26.9s)
  [brain] Ilonggo Ironworks: 13 actions (32.7s)
  [brain] Cavite Bloodlines: 2 actions (34.5s)
  [brain] Sugalan Social Club: 11 actions (41.4s)
  [brain] Talisay Tari Club: 12 actions (46.5s)
  [brain] Hacienda Verde: 0 actions (48.0s)
Day 19 (Wednesday): 140 fights, 2 unmatched, 6 claims settled, staking paid 859.80 GP to 21 stakers — 48.4s
  [brain] Sugalan Social Club: 0 actions (1.6s)
  [brain] Hacienda Verde: 0 actions (2.9s)
  [brain] Cuchillos de Sonora: 13 actions (11.6s)
  [brain] Pulang Bagwis: 11 actions (18.5s)
  [brain] Ilonggo Ironworks: 12 actions (24.5s)
  [brain] Batangas Sprint Club: 0 actions (25.7s)
  [brain] Bagong Laban: 13 actions (32.0s)
  [brain] Cavite Bloodlines: 0 actions (33.4s)
  [brain] Talisay Tari Club: 13 actions (38.6s)
  [brain] Marco Gamefarm: 0 actions (39.8s)
Day 20 (Thursday): 77 fights, 2 unmatched, 3 claims settled, staking paid 853.37 GP to 21 stakers — 40.2s
  [brain] Batangas Sprint Club: 0 actions (1.6s)
  [brain] Marco Gamefarm: 6 actions (4.8s)
  [brain] Hacienda Verde: 6 actions (8.5s)
  [brain] Pulang Bagwis: 1 actions (10.4s)
  [brain] Cuchillos de Sonora: 13 actions (15.9s)
  [brain] Sugalan Social Club: 0 actions (17.3s)
  [brain] Talisay Tari Club: 0 actions (19.0s)
  [brain] Ilonggo Ironworks: 11 actions (27.3s)
  [brain] Bagong Laban: 2 actions (29.3s)
  [brain] Cavite Bloodlines: 2 actions (31.4s)
Day 21 (Friday): 93 fights, 8 unmatched, 4 claims settled, staking paid 860.64 GP to 21 stakers — HATCH FRIDAY (0 hatched) — 31.8s
        wk 3 · 7 days in 4:59 · avg 42.72s/day
  [brain] Cavite Bloodlines: 0 actions (1.5s)
  [brain] Ilonggo Ironworks: 2 actions (3.6s)
  [brain] Hacienda Verde: 13 actions (9.4s)
  [brain] Pulang Bagwis: 6 actions (13.9s)
  [brain] Marco Gamefarm: 9 actions (17.4s)
  [brain] Talisay Tari Club: 3 actions (19.8s)
  [brain] Sugalan Social Club: 1 actions (21.7s)
  [brain] Batangas Sprint Club: 9 actions (27.4s)
  [brain] Cuchillos de Sonora: 12 actions (35.3s)
  [brain] Bagong Laban: 16 actions (45.7s)
Day 22 (Saturday): 140 fights, 4 unmatched, 10 claims settled, staking paid 871.57 GP to 21 stakers — 46.2s
  [brain] Talisay Tari Club: 7 actions (3.5s)
  [brain] Hacienda Verde: 2 actions (5.3s)
  [brain] Pulang Bagwis: 14 actions (11.4s)
  [brain] Cavite Bloodlines: 13 actions (19.6s)
  [brain] Batangas Sprint Club: 0 actions (20.9s)
  [brain] Cuchillos de Sonora: 10 actions (25.3s)
  [brain] Sugalan Social Club: 2 actions (26.8s)
  [brain] Bagong Laban: 10 actions (31.5s)
  [brain] Marco Gamefarm: 14 actions (41.1s)
  [brain] Ilonggo Ironworks: 11 actions (45.7s)
Day 23 (Sunday): 121 fights, 3 unmatched, 4 claims settled, staking paid 1230.42 GP to 21 stakers — 46.1s
  [brain] Ilonggo Ironworks: 0 actions (1.7s)
  [brain] Cavite Bloodlines: 11 actions (7.1s)
  [brain] Sugalan Social Club: 8 actions (11.1s)
  [brain] Hacienda Verde: 9 actions (15.9s)
  [brain] Bagong Laban: 14 actions (24.9s)
  [brain] Talisay Tari Club: 12 actions (30.0s)
  [brain] Cuchillos de Sonora: 7 actions (33.4s)
  [brain] Pulang Bagwis: 13 actions (38.5s)
  [brain] Marco Gamefarm: 0 actions (40.0s)
  [brain] Batangas Sprint Club: 1 actions (41.8s)
Day 24 (Monday): 98 fights, 0 unmatched, 5 claims settled, staking paid 919.38 GP to 21 stakers — 42.2s
  [brain] Bagong Laban: 13 actions (8.5s)
  [brain] Marco Gamefarm: 0 actions (10.4s)
  [brain] Ilonggo Ironworks: 0 actions (12.4s)
  [brain] Batangas Sprint Club: 10 actions (16.7s)
  [brain] Talisay Tari Club: 8 actions (20.7s)
  [brain] Hacienda Verde: 0 actions (22.4s)
  [brain] Cuchillos de Sonora: 14 actions (31.1s)
  [brain] Sugalan Social Club: 1 actions (33.0s)
  [brain] Pulang Bagwis: 9 actions (37.3s)
  [brain] Cavite Bloodlines: 11 actions (42.4s)
Day 25 (Tuesday): 104 fights, 0 unmatched, 4 claims settled, staking paid 935.22 GP to 21 stakers — 42.8s
  [brain] Marco Gamefarm: 0 actions (1.6s)
  [brain] Talisay Tari Club: 0 actions (3.1s)
  [brain] Hacienda Verde: 0 actions (4.9s)
  [brain] Cavite Bloodlines: 20 actions (12.2s)
  [brain] Cuchillos de Sonora: 7 actions (16.9s)
  [brain] Batangas Sprint Club: 0 actions (18.3s)
  [brain] Sugalan Social Club: 15 actions (24.3s)
  [brain] Bagong Laban: 14 actions (33.3s)
  [brain] Ilonggo Ironworks: 12 actions (39.8s)
  [brain] Pulang Bagwis: 15 actions (46.2s)
Day 26 (Wednesday): 115 fights, 3 unmatched, 6 claims settled, staking paid 867.79 GP to 21 stakers — 46.6s
  [brain] Batangas Sprint Club: 8 actions (5.3s)
  [brain] Pulang Bagwis: 9 actions (9.9s)
  [brain] Sugalan Social Club: 7 actions (13.3s)
  [brain] Cuchillos de Sonora: 11 actions (20.3s)
  [brain] Hacienda Verde: 0 actions (21.8s)
  [brain] Cavite Bloodlines: 12 actions (29.9s)
  [brain] Talisay Tari Club: 0 actions (31.4s)
  [brain] Ilonggo Ironworks: 14 actions (37.8s)
  [brain] Bagong Laban: 0 actions (40.0s)
  [brain] Marco Gamefarm: 2 actions (42.2s)
Day 27 (Thursday): 48 fights, 0 unmatched, 5 claims settled, staking paid 952.21 GP to 21 stakers — 42.6s
  [brain] Talisay Tari Club: 0 actions (1.4s)
  [brain] Batangas Sprint Club: 11 actions (5.9s)
  [brain] Marco Gamefarm: 12 actions (10.5s)
  [brain] Hacienda Verde: 0 actions (11.9s)
  [brain] Sugalan Social Club: 6 actions (15.0s)
  [brain] Cuchillos de Sonora: 0 actions (16.6s)
  [brain] Cavite Bloodlines: 12 actions (21.5s)
  [brain] Pulang Bagwis: 8 actions (27.2s)
  [brain] Ilonggo Ironworks: 0 actions (28.7s)
  [brain] Bagong Laban: 0 actions (30.7s)
Day 28 (Friday): 23 fights, 2 unmatched, 0 claims settled, staking paid 1152.00 GP to 21 stakers — HATCH FRIDAY (0 hatched) — 31.2s
        wk 4 · 7 days in 4:58 · avg 42.56s/day

TIMING
  seed + bots      0.0s
  simulation      17:40   (28 day(s), avg 37.87s/day · honest 8% / tick 92%)
  brains          17:31   (37.52s/day · 99% of the run, 280 call(s), 1 failed)
  doctor           0.5s
  total           17:41
  slowest days d10 52.3s · d8 50.6s · d19 48.4s
  per unit     523.66 ms/fight · 704.12 ms/entry

BARN CAREERS (durable actor state — persists across runs)
  bot-7     28 day(s) played · last day 27 · 135 proposed, 6 dropped, 0 failure(s) · 567.2s thinking
  bot-8     28 day(s) played · last day 27 · 209 proposed, 27 dropped, 0 failure(s) · 512.4s thinking
  bot-9     27 day(s) played · last day 27 · 189 proposed, 21 dropped, 1 failure(s) · 588.2s thinking
  bot-marco  28 day(s) played · last day 27 · 154 proposed, 22 dropped, 0 failure(s) · 580.6s thinking
  bot-12    28 day(s) played · last day 27 · 120 proposed, 6 dropped, 0 failure(s) · 447.7s thinking
  bot-13    28 day(s) played · last day 27 · 68 proposed, 29 dropped, 0 failure(s) · 446.3s thinking
  bot-14    28 day(s) played · last day 27 · 152 proposed, 33 dropped, 0 failure(s) · 636.2s thinking
  bot-15    28 day(s) played · last day 27 · 146 proposed, 7 dropped, 0 failure(s) · 652.8s thinking
  bot-16    28 day(s) played · last day 27 · 187 proposed, 17 dropped, 0 failure(s) · 540.3s thinking
  bot-17    28 day(s) played · last day 27 · 218 proposed, 20 dropped, 0 failure(s) · 563.1s thinking

PINTAKASI DOCTOR · data/sim-20260815-0419.db
day 28 · Friday, January 31, 3000 · week 4 · 21 farms · 228 birds

INVARIANTS
  PASS  GP conservation            568,800.00 GP in world = 568,800.00 expected
  PASS  LT conservation            140,566.98 LT held = 140,566.98 LT ledgered
  PASS  no negative balances       staker 0.10 · juice 0.01 · 21 wallets clean
  PASS  pit figures                2025 fights · 2025 mirrored · 0 inversions
  PASS  purses settle              8 completed crown(s), exact to the cent
  PASS  no stranded entries        9 resolved championship(s), every entry settled
  PASS  one card per bird per day  1506 entries across 1506 bird-days · 0 over cap
  PASS  fight counts match the log 1506 settled entries · 3786 fights claimed · 0 mismatched
  PASS  scout book matches the log 645 book lines audited · 0 out of step

CARD HEALTH
  1506 entries · 1473 fought · 33 unmatched (2.2%) · 152 lobbies
  weather timing  353/1234 starred entries ran on the bird's own element day (28.6% vs 20.0% by chance, 1.43×) ✓ entries are being timed

GROUP STAGE
  fights per settled entry  mean 2.51 of 3 · 1506 settled entries
  full cards  934 (62.0%) took all 3 · short 539 (35.8%) fought 1–2 · 33 (2.2%) never fought
  groups  438 dealt · mean 3.44 birds · 9 of one (9 were the lobby's only entry)

LOBBY FILL
  mean 9.91 birds per lobby · 152 lobbies · 9 held a single bird (5.9%)
      1 █                        5.9%
    2-3 ██████                   26.3%
    4-7 ███                      13.8%
   8-15 ████████                 31.6%
    16+ █████                    22.4%
  same-barn-only lobbies 8 · 18 birds stranded with no cross-barn opponent

WORST LOBBY KEYS
  real/maiden/b4                       10 entries, 40.0% unmatched
  real/claimer/b1@90                   10 entries, 30.0% unmatched
  real/maiden/b1                        8 entries, 25.0% unmatched

POPULATION
  eggs 0 · active 140 · retired 88 · 21 farms
  by age  1:14  2:15  3:13  4:98
  supply  hatches 228 · gacha eggs 60 · covers 0
  loss    hardcore 88
  barns   0 of 21 at capacity · 0 expansion(s) bought

FIGHT VOLUME
  wk  0       0  
  wk  1     496  █████████████████
  wk  2     697  ███████████████████████
  wk  3     721  ████████████████████████
  wk  4     111  ████  (1 day)

BLOODLINES
  gen   birds   mean grade     stars   home margin
  0       228   B+ ( 331.4)    1.31★      9.0
  · nothing has been bred yet — every bird in the world is a founder

FIGHT ECONOMY BY RUNG
    rung                      fee  entries  share   GP risked   LT minted  LT/100GP
    juvenile/claimer@90        24       21   1.4%         400       57.80     14.45
    juvenile/maiden            30       39   2.6%         760      111.27     14.64
    juvenile/claimer@180       48       38   2.5%       1,504      241.56     16.06
    real/claimer@90            48      125   8.3%       4,896      784.43     16.02
    real/maiden                60       39   2.6%         840      131.88     15.70
    real/nw3                   60       39   2.6%       1,680      277.62     16.53
    juvenile/claimer@270       72       24   1.6%       1,248      208.44     16.70
    real/claimer@180           96       78   5.2%       6,784    1,215.98     17.92
    real/claimer@270          144       61   4.1%       7,488    1,423.26     19.01
    juvenile/open             150      358  23.8%      44,900    8,553.79     19.05
    real/open                 300      684  45.4%     181,600   38,518.95     21.21

LAND SUPPLY
  circulating 140,566.98 LT · 136,862.00 staked (97.4%) · 3,704.98 idle
  minted      140,566.98 LT over 29 day(s) · 4,847.14 LT per day
    purse_payout     60,000.00 LT   42.7%
    card_settled     51,524.98 LT   36.7%
    buy_land         28,000.00 LT   19.9%
    gacha             1,042.00 LT    0.7%
  burned      0.00 LT (0.0% of issuance) — the sinks
  valuation   at $0.01/LT (pencilled) the world has issued $1,406 of land against $7,110 of GP faucet — $0.20 of LT per $1 of GP
  runway      100B-token target reached in 10,000+ year(s) at this population's rate — scales with farms, not with time

REPLAY
  203/203 sampled fight rows rebuild exactly from their seed

STAKER POOL
  paid out 27,003.90 GP over 28 day(s) · 0.10 waiting · 136,862.00 LT staked
  land_purchase 22,400.00 · gacha 4,280.00 · claim_rake 324.00

CHAMPIONSHIPS
  major     3 run / 0 cancelled · field 30.3 · purse 40,174.33
            paid 48/91 entrants (53%) · biggest take 13.2% of all purse GP · smallest 195.86 GP
            entry fees 14,560.00 GP fund 36% of the purse · the rest is juice (gacha + breed fees) · net to the field 25,614.33 GP
            under the door 0/48 winners (0%) took less purse than their entry fee
  juvenile  5 run / 1 cancelled · field 9.8 · purse 17,657.66
            paid 27/49 entrants (55%) · biggest take 19.6% of all purse GP · smallest 71.18 GP
            entry fees 2,352.00 GP fund 13% of the purse · the rest is juice (gacha + breed fees) · net to the field 15,305.66 GP
            under the door 0/27 winners (0%) took less purse than their entry fee

MECHANIC ADOPTION            farms of 21
  claims placed             19  ███████████████████░░
  studs listed               0  ░░░░░░░░░░░░░░░░░░░░░  ⚠ NOBODY WALKED THROUGH
  land purchased             1  █░░░░░░░░░░░░░░░░░░░░
  paid gacha rolls          10  ██████████░░░░░░░░░░░
  gacha bundles bought       1  █░░░░░░░░░░░░░░░░░░░░
  barn expanded              0  ░░░░░░░░░░░░░░░░░░░░░  ⚠ NOBODY WALKED THROUGH
  Major entries             17  █████████████████░░░░
  juvenile championship     11  ███████████░░░░░░░░░░
  ⚠ 2 door(s) unused: studs listed, barn expanded

DISCOVERY
  age 1    carded 278/1170 at the true best blade (23.8% vs random 20.0%) · 51.1% on or adjacent (random 48.1%) · answer coverage 37.9% · SCOUT 200/444 right (45.0% vs random 20.0%), 68.9% on or adjacent · clear home 128/233 (54.9%, 67.8% adjacent)
  age 2–3  carded 730/2616 at the true best blade (27.9% vs random 20.0%) · 55.1% on or adjacent (random 47.5%) · answer coverage 73.4% · SCOUT 761/1920 right (39.6% vs random 20.0%), 67.8% on or adjacent · clear home 436/961 (45.4%, 67.7% adjacent)
  age 4+   0 card decisions — too few to read
  explored  5/5 blades saw an age-1 entry in the discovery year
  flock shape  median home blade beats its runner-up by 9.0 pts · 45.2% of birds clear the 10-pt bar
  ⚠ only 45.2% of birds have a home blade worth finding — the flock is being bred flat, so there is little for discovery to discover

2 warnings · 0 invariant failures

Done → /Users/plumeria/Repos/pintakasi-bloodlines/data/sim-20260815-0419.db
Run `bun dev:sim` and open http://localhost:3435/admin — it always shows the newest sim.
```

---

## Coach session #1 — day 28 (2026-08-15, overnight)

World: `sim-20260815-0419`. Segment 1: 280 calls / 1 failed / 37.5 s/day ·
0 invariant failures. Exp3 = exp2 + lifted volume ceilings (fighter window
12→24, reply budget 700→1400) + cadence-sharpened preamble.

## Scoreboard at day 28

```
  scripted (10): total net worth 391,695 · avg 39,170 · crowns 7
  llm      (10): total net worth 250,212 · avg 25,021 · crowns 1
```

**First llm crown by day 28** — the earliest in three experiments (exp1:
never; exp2: ~day 45). Ginto again honest at rank 20 with a crown.

## Readings

- Enters 919 (exp2 day-28: 794) — mildly up. But avg proposals/day is still
  ~5.7: the lifted caps didn't move *early* volume because day-28 rosters
  are only 8–12 birds — the window binds late-game, exactly where exp2
  stalled. The instrument change is for segment 3's benefit; don't expect it
  to show yet.
- Breeding: 1 breed, third experiment running. Early-game law 3 needs the
  pointed per-barn order every time — the preamble alone has never done it.
  (Consistent and now expected: the general law starts the behavior only
  after the coach names the barn's own hen and stud.)
- Fights 772 vs scripted 2,808 — the roster-depth gap, as designed to close
  via the pipeline orders below.

## Orders — exp2's proven session-1 set, near-verbatim

Same five order-pairs as exp2 coach #1 (they measurably worked: breeding
0→95, first crowns): card sharks keep volume+crowns and breed on stock;
architects run the trade NOW; claim scouts hold volume; talent scouts fight
their pulls; operators add weekly crown + breeding. Applied mid-run after
segment 2's launch (the reliable bind path).

---

## Segment 2 — days 29–56 (verbatim sim log)

```
$ bun run scripts/simulate.ts "28" --keep "--seed=1" "--brain=qwen3:30b-a3b" "--llm=bot-7,bot-15,bot-marco,bot-9,bot-8,bot-16,bot-14,bot-12,bot-13,bot-17" --actors
Brain: qwen3:30b-a3b plays 10 stable(s) — bot-7, bot-15, bot-marco, bot-9, bot-8, bot-16, bot-14, bot-12, bot-13, bot-17

level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"57omeeimuy1rk2r3oy724yogzrbl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"92b8r89mhw0n7piuhpejodod6jbl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"d5w1wh8e9ua93scg7muu108yejcl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"d1xjgkbtzpf8mz8hbj4psl2ldecl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"d9nl41yus15fir5kbx7ynru208bl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"lfhf8wlnorsemc896255mpevykal00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"hohecpuxd0dpxxh4mad9u0phh6dl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"puvvhf4ihwae80wdy8gsx9secwal00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"1k3wxorf9awdbevnwupdf1gd1ncl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"9uoh9f3v29ib05eyh9v71li2igal00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"57omeeimuy1rk2r3oy724yogzrbl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"d1xjgkbtzpf8mz8hbj4psl2ldecl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"lfhf8wlnorsemc896255mpevykal00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"92b8r89mhw0n7piuhpejodod6jbl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"d9nl41yus15fir5kbx7ynru208bl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"d5w1wh8e9ua93scg7muu108yejcl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"puvvhf4ihwae80wdy8gsx9secwal00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"1k3wxorf9awdbevnwupdf1gd1ncl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"hohecpuxd0dpxxh4mad9u0phh6dl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"9uoh9f3v29ib05eyh9v71li2igal00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"lfhf8wlnorsemc896255mpevykal00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"57omeeimuy1rk2r3oy724yogzrbl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"d1xjgkbtzpf8mz8hbj4psl2ldecl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"92b8r89mhw0n7piuhpejodod6jbl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"d9nl41yus15fir5kbx7ynru208bl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"d5w1wh8e9ua93scg7muu108yejcl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"puvvhf4ihwae80wdy8gsx9secwal00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"9uoh9f3v29ib05eyh9v71li2igal00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"hohecpuxd0dpxxh4mad9u0phh6dl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"1k3wxorf9awdbevnwupdf1gd1ncl00\"}"
[bot-brain] bot-7 proposed nothing: Actor failed to start (92b8r89mhw0n7piuhpejodod6jbl00): "no_envoys"
[bot-brain] bot-8 proposed nothing: Actor failed to start (hohecpuxd0dpxxh4mad9u0phh6dl00): "no_envoys"
[bot-brain] bot-9 proposed nothing: Actor failed to start (57omeeimuy1rk2r3oy724yogzrbl00): "no_envoys"
[bot-brain] bot-marco proposed nothing: Actor failed to start (lfhf8wlnorsemc896255mpevykal00): "no_envoys"
[bot-brain] bot-12 proposed nothing: Actor failed to start (d1xjgkbtzpf8mz8hbj4psl2ldecl00): "no_envoys"
[bot-brain] bot-13 proposed nothing: Actor failed to start (d5w1wh8e9ua93scg7muu108yejcl00): "no_envoys"
[bot-brain] bot-14 proposed nothing: Actor failed to start (d9nl41yus15fir5kbx7ynru208bl00): "no_envoys"
[bot-brain] bot-15 proposed nothing: Actor failed to start (1k3wxorf9awdbevnwupdf1gd1ncl00): "no_envoys"
[bot-brain] bot-16 proposed nothing: Actor failed to start (puvvhf4ihwae80wdy8gsx9secwal00): "no_envoys"
[bot-brain] bot-17 proposed nothing: Actor failed to start (9uoh9f3v29ib05eyh9v71li2igal00): "no_envoys"
Day 29 (Saturday): 10 fights, 1 unmatched, 0 claims settled, staking paid 1992.02 GP to 21 stakers — 2:01
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"hohecpuxd0dpxxh4mad9u0phh6dl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"9uoh9f3v29ib05eyh9v71li2igal00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"92b8r89mhw0n7piuhpejodod6jbl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"puvvhf4ihwae80wdy8gsx9secwal00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"lfhf8wlnorsemc896255mpevykal00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"1k3wxorf9awdbevnwupdf1gd1ncl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"d9nl41yus15fir5kbx7ynru208bl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"d5w1wh8e9ua93scg7muu108yejcl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"d1xjgkbtzpf8mz8hbj4psl2ldecl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"57omeeimuy1rk2r3oy724yogzrbl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"92b8r89mhw0n7piuhpejodod6jbl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"9uoh9f3v29ib05eyh9v71li2igal00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"hohecpuxd0dpxxh4mad9u0phh6dl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"puvvhf4ihwae80wdy8gsx9secwal00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"lfhf8wlnorsemc896255mpevykal00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"1k3wxorf9awdbevnwupdf1gd1ncl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"d9nl41yus15fir5kbx7ynru208bl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"d5w1wh8e9ua93scg7muu108yejcl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"d1xjgkbtzpf8mz8hbj4psl2ldecl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"57omeeimuy1rk2r3oy724yogzrbl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"hohecpuxd0dpxxh4mad9u0phh6dl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"9uoh9f3v29ib05eyh9v71li2igal00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"92b8r89mhw0n7piuhpejodod6jbl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"puvvhf4ihwae80wdy8gsx9secwal00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"lfhf8wlnorsemc896255mpevykal00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"1k3wxorf9awdbevnwupdf1gd1ncl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"d9nl41yus15fir5kbx7ynru208bl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"d5w1wh8e9ua93scg7muu108yejcl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"d1xjgkbtzpf8mz8hbj4psl2ldecl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"57omeeimuy1rk2r3oy724yogzrbl00\"}"
[bot-brain] bot-7 proposed nothing: Actor failed to start (92b8r89mhw0n7piuhpejodod6jbl00): "no_envoys"
[bot-brain] bot-8 proposed nothing: Actor failed to start (hohecpuxd0dpxxh4mad9u0phh6dl00): "no_envoys"
[bot-brain] bot-9 proposed nothing: Actor failed to start (57omeeimuy1rk2r3oy724yogzrbl00): "no_envoys"
[bot-brain] bot-marco proposed nothing: Actor failed to start (lfhf8wlnorsemc896255mpevykal00): "no_envoys"
[bot-brain] bot-12 proposed nothing: Actor failed to start (d1xjgkbtzpf8mz8hbj4psl2ldecl00): "no_envoys"
[bot-brain] bot-13 proposed nothing: Actor failed to start (d5w1wh8e9ua93scg7muu108yejcl00): "no_envoys"
[bot-brain] bot-14 proposed nothing: Actor failed to start (d9nl41yus15fir5kbx7ynru208bl00): "no_envoys"
[bot-brain] bot-15 proposed nothing: Actor failed to start (1k3wxorf9awdbevnwupdf1gd1ncl00): "no_envoys"
[bot-brain] bot-16 proposed nothing: Actor failed to start (puvvhf4ihwae80wdy8gsx9secwal00): "no_envoys"
[bot-brain] bot-17 proposed nothing: Actor failed to start (9uoh9f3v29ib05eyh9v71li2igal00): "no_envoys"
Day 30 (Sunday): 23 fights, 0 unmatched, 0 claims settled, staking paid 999.97 GP to 21 stakers — 2:00
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"lfhf8wlnorsemc896255mpevykal00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"puvvhf4ihwae80wdy8gsx9secwal00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"d1xjgkbtzpf8mz8hbj4psl2ldecl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"hohecpuxd0dpxxh4mad9u0phh6dl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"d9nl41yus15fir5kbx7ynru208bl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"d5w1wh8e9ua93scg7muu108yejcl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"57omeeimuy1rk2r3oy724yogzrbl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"1k3wxorf9awdbevnwupdf1gd1ncl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"92b8r89mhw0n7piuhpejodod6jbl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"9uoh9f3v29ib05eyh9v71li2igal00\"}"
level=warn msg="http error response" group=actor code=dropped_reply message="An internal error occurred" actorId=puvvhf4ihwae80wdy8gsx9secwal00 generation=2 actorKey=sim-20260815-0419/bot-16
  [brain] Cavite Bloodlines: 9 actions (17.4s)
  [brain] Cuchillos de Sonora: 9 actions (22.5s)
  [brain] Marco Gamefarm: 0 actions (24.7s)
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"92b8r89mhw0n7piuhpejodod6jbl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"d5w1wh8e9ua93scg7muu108yejcl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"d1xjgkbtzpf8mz8hbj4psl2ldecl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"1k3wxorf9awdbevnwupdf1gd1ncl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"9uoh9f3v29ib05eyh9v71li2igal00\"}"
  [brain] Pulang Bagwis: 0 actions (9.5s)
  [brain] Hacienda Verde: 7 actions (4.2s)
  [brain] Ilonggo Ironworks: 8 actions (7.5s)
  [brain] Batangas Sprint Club: 2 actions (8.8s)
  [brain] Talisay Tari Club: 2 actions (10.2s)
  [brain] Bagong Laban: 7 actions (14.1s)
Day 31 (Monday): 36 fights, 2 unmatched, 2 claims settled, staking paid 1031.21 GP to 21 stakers — 1:44
  [brain] Pulang Bagwis: 8 actions (4.7s)
  [brain] Cuchillos de Sonora: 0 actions (5.9s)
  [brain] Hacienda Verde: 0 actions (7.0s)
  [brain] Sugalan Social Club: 7 actions (9.9s)
  [brain] Batangas Sprint Club: 7 actions (12.2s)
  [brain] Marco Gamefarm: 7 actions (15.5s)
  [brain] Ilonggo Ironworks: 0 actions (16.7s)
  [brain] Bagong Laban: 0 actions (17.8s)
  [brain] Talisay Tari Club: 7 actions (21.6s)
  [brain] Cavite Bloodlines: 12 actions (25.9s)
Day 32 (Tuesday): 37 fights, 1 unmatched, 3 claims settled, staking paid 904.16 GP to 21 stakers — 26.2s
  [brain] Marco Gamefarm: 2 actions (1.6s)
  [brain] Batangas Sprint Club: 14 actions (6.0s)
  [brain] Cuchillos de Sonora: 0 actions (7.1s)
  [brain] Sugalan Social Club: 8 actions (11.7s)
  [brain] Cavite Bloodlines: 0 actions (12.9s)
  [brain] Hacienda Verde: 13 actions (17.1s)
  [brain] Pulang Bagwis: 9 actions (22.0s)
  [brain] Ilonggo Ironworks: 0 actions (23.1s)
  [brain] Bagong Laban: 0 actions (24.3s)
  [brain] Talisay Tari Club: 0 actions (25.3s)
Day 33 (Wednesday): 24 fights, 1 unmatched, 0 claims settled, staking paid 952.04 GP to 21 stakers — 25.6s
  [brain] Marco Gamefarm: 2 actions (1.5s)
  [brain] Talisay Tari Club: 7 actions (5.3s)
  [brain] Bagong Laban: 7 actions (7.9s)
  [brain] Ilonggo Ironworks: 0 actions (9.0s)
  [brain] Hacienda Verde: 6 actions (12.2s)
  [brain] Pulang Bagwis: 0 actions (13.6s)
  [brain] Cavite Bloodlines: 10 actions (20.1s)
  [brain] Batangas Sprint Club: 0 actions (21.1s)
  [brain] Cuchillos de Sonora: 0 actions (22.2s)
  [brain] Sugalan Social Club: 2 actions (23.4s)
Day 34 (Thursday): 15 fights, 3 unmatched, 0 claims settled, staking paid 855.97 GP to 21 stakers — 23.7s
  [brain] Bagong Laban: 0 actions (1.4s)
  [brain] Talisay Tari Club: 0 actions (2.5s)
  [brain] Cuchillos de Sonora: 6 actions (5.7s)
  [brain] Batangas Sprint Club: 0 actions (6.8s)
  [brain] Ilonggo Ironworks: 1 actions (7.9s)
  [brain] Marco Gamefarm: 6 actions (11.1s)
  [brain] Hacienda Verde: 0 actions (12.2s)
  [brain] Sugalan Social Club: 8 actions (15.0s)
  [brain] Cavite Bloodlines: 0 actions (16.2s)
  [brain] Pulang Bagwis: 0 actions (17.5s)
Day 35 (Friday): 5 fights, 2 unmatched, 3 claims settled, staking paid 1015.23 GP to 21 stakers — HATCH FRIDAY (0 hatched) — 17.8s
        wk 5 · 7 days in 7:19 · avg 62.65s/day
  [brain] Pulang Bagwis: 6 actions (3.6s)
  [brain] Talisay Tari Club: 13 actions (8.1s)
  [brain] Sugalan Social Club: 7 actions (10.5s)
  [brain] Batangas Sprint Club: 0 actions (11.4s)
  [brain] Cavite Bloodlines: 5 actions (14.3s)
  [brain] Marco Gamefarm: 6 actions (17.5s)
  [brain] Bagong Laban: 8 actions (20.5s)
  [brain] Ilonggo Ironworks: 8 actions (23.2s)
  [brain] Cuchillos de Sonora: 7 actions (26.2s)
  [brain] Hacienda Verde: 7 actions (30.0s)
Day 36 (Saturday): 28 fights, 0 unmatched, 2 claims settled, staking paid 1258.79 GP to 21 stakers — 30.3s
  [brain] Cuchillos de Sonora: 0 actions (1.3s)
  [brain] Pulang Bagwis: 9 actions (6.4s)
  [brain] Sugalan Social Club: 6 actions (9.1s)
  [brain] Hacienda Verde: 7 actions (11.6s)
  [brain] Batangas Sprint Club: 6 actions (14.6s)
  [brain] Cavite Bloodlines: 10 actions (18.1s)
  [brain] Marco Gamefarm: 1 actions (19.2s)
  [brain] Ilonggo Ironworks: 7 actions (22.8s)
  [brain] Talisay Tari Club: 6 actions (25.9s)
  [brain] Bagong Laban: 7 actions (28.1s)
Day 37 (Sunday): 18 fights, 3 unmatched, 1 claims settled, staking paid 1203.60 GP to 21 stakers — 28.5s
  [brain] Bagong Laban: 0 actions (1.2s)
  [brain] Hacienda Verde: 6 actions (3.6s)
  [brain] Pulang Bagwis: 7 actions (6.3s)
  [brain] Batangas Sprint Club: 0 actions (7.2s)
  [brain] Sugalan Social Club: 1 actions (8.4s)
  [brain] Marco Gamefarm: 6 actions (11.6s)
  [brain] Cuchillos de Sonora: 6 actions (14.8s)
  [brain] Talisay Tari Club: 1 actions (16.1s)
  [brain] Ilonggo Ironworks: 7 actions (19.7s)
  [brain] Cavite Bloodlines: 0 actions (20.8s)
Day 38 (Monday): 31 fights, 0 unmatched, 1 claims settled, staking paid 965.40 GP to 21 stakers — 21.1s
  [brain] Batangas Sprint Club: 0 actions (1.1s)
  [brain] Cavite Bloodlines: 9 actions (4.4s)
  [brain] Bagong Laban: 1 actions (6.3s)
  [brain] Sugalan Social Club: 0 actions (7.5s)
  [brain] Ilonggo Ironworks: 8 actions (12.6s)
  [brain] Cuchillos de Sonora: 0 actions (13.8s)
  [brain] Pulang Bagwis: 0 actions (15.1s)
  [brain] Marco Gamefarm: 6 actions (18.9s)
  [brain] Talisay Tari Club: 0 actions (20.1s)
  [brain] Hacienda Verde: 0 actions (21.3s)
Day 39 (Tuesday): 16 fights, 5 unmatched, 2 claims settled, staking paid 1059.60 GP to 21 stakers — 21.6s
  [brain] Cuchillos de Sonora: 12 actions (4.4s)
  [brain] Ilonggo Ironworks: 7 actions (8.3s)
  [brain] Bagong Laban: 8 actions (12.4s)
  [brain] Marco Gamefarm: 5 actions (14.7s)
  [brain] Sugalan Social Club: 8 actions (18.2s)
  [brain] Hacienda Verde: 0 actions (19.3s)
  [brain] Talisay Tari Club: 1 actions (20.7s)
  [brain] Pulang Bagwis: 1 actions (22.3s)
  [brain] Cavite Bloodlines: 7 actions (25.5s)
  [brain] Batangas Sprint Club: 8 actions (28.1s)
Day 40 (Wednesday): 28 fights, 4 unmatched, 1 claims settled, staking paid 877.39 GP to 21 stakers — 28.4s
  [brain] Cavite Bloodlines: 2 actions (1.8s)
  [brain] Cuchillos de Sonora: 8 actions (6.7s)
  [brain] Batangas Sprint Club: 8 actions (10.5s)
  [brain] Talisay Tari Club: 1 actions (12.0s)
  [brain] Sugalan Social Club: 0 actions (13.3s)
  [brain] Hacienda Verde: 1 actions (14.9s)
  [brain] Bagong Laban: 10 actions (18.4s)
  [brain] Pulang Bagwis: 8 actions (22.0s)
  [brain] Marco Gamefarm: 0 actions (23.2s)
  [brain] Ilonggo Ironworks: 2 actions (24.7s)
Day 41 (Thursday): 3 fights, 4 unmatched, 0 claims settled, staking paid 1032.02 GP to 21 stakers — 25.0s
  [brain] Sugalan Social Club: 6 actions (3.7s)
  [brain] Bagong Laban: 0 actions (5.1s)
  [brain] Marco Gamefarm: 0 actions (6.5s)
  [brain] Pulang Bagwis: 11 actions (13.7s)
  [brain] Hacienda Verde: 5 actions (17.1s)
  [brain] Ilonggo Ironworks: 9 actions (22.1s)
  [brain] Cavite Bloodlines: 5 actions (25.6s)
  [brain] Talisay Tari Club: 0 actions (26.9s)
  [brain] Cuchillos de Sonora: 9 actions (32.1s)
  [brain] Batangas Sprint Club: 0 actions (33.1s)
Day 42 (Friday): 9 fights, 2 unmatched, 1 claims settled, staking paid 1029.38 GP to 21 stakers — HATCH FRIDAY (5 hatched) — 33.5s
        wk 6 · 7 days in 3:08 · avg 26.93s/day
  [brain] Cavite Bloodlines: 2 actions (1.8s)
  [brain] Pulang Bagwis: 0 actions (3.9s)
  [brain] Marco Gamefarm: 2 actions (5.6s)
  [brain] Ilonggo Ironworks: 0 actions (6.9s)
  [brain] Cuchillos de Sonora: 0 actions (8.2s)
  [brain] Talisay Tari Club: 6 actions (11.7s)
  [brain] Sugalan Social Club: 7 actions (15.6s)
  [brain] Bagong Laban: 0 actions (17.1s)
  [brain] Batangas Sprint Club: 1 actions (18.4s)
  [brain] Hacienda Verde: 7 actions (22.5s)
Day 43 (Saturday): 61 fights, 2 unmatched, 2 claims settled, staking paid 1387.62 GP to 21 stakers — 23.0s
  [brain] Pulang Bagwis: 10 actions (5.6s)
  [brain] Cuchillos de Sonora: 9 actions (8.9s)
  [brain] Cavite Bloodlines: 0 actions (10.3s)
  [brain] Bagong Laban: 9 actions (15.3s)
  [brain] Ilonggo Ironworks: 0 actions (16.5s)
  [brain] Hacienda Verde: 7 actions (19.6s)
  [brain] Sugalan Social Club: 9 actions (22.8s)
  [brain] Talisay Tari Club: 7 actions (26.2s)
  [brain] Marco Gamefarm: 0 actions (27.4s)
  [brain] Batangas Sprint Club: 0 actions (28.5s)
Day 44 (Sunday): 58 fights, 0 unmatched, 2 claims settled, staking paid 1047.21 GP to 21 stakers — 28.9s
  [brain] Pulang Bagwis: 0 actions (1.9s)
  [brain] Talisay Tari Club: 0 actions (3.2s)
  [brain] Marco Gamefarm: 3 actions (5.2s)
  [brain] Batangas Sprint Club: 7 actions (7.5s)
  [brain] Ilonggo Ironworks: 9 actions (11.1s)
  [brain] Bagong Laban: 0 actions (12.5s)
  [brain] Sugalan Social Club: 0 actions (13.8s)
  [brain] Cuchillos de Sonora: 7 actions (18.2s)
  [brain] Hacienda Verde: 6 actions (22.0s)
  [brain] Cavite Bloodlines: 0 actions (23.4s)
Day 45 (Monday): 44 fights, 0 unmatched, 3 claims settled, staking paid 1112.19 GP to 21 stakers — 23.8s
  [brain] Cavite Bloodlines: 0 actions (1.5s)
  [brain] Pulang Bagwis: 10 actions (6.1s)
  [brain] Batangas Sprint Club: 0 actions (7.1s)
  [brain] Marco Gamefarm: 0 actions (8.5s)
  [brain] Talisay Tari Club: 0 actions (9.9s)
  [brain] Hacienda Verde: 6 actions (13.4s)
  [brain] Bagong Laban: 8 actions (16.6s)
  [brain] Cuchillos de Sonora: 2 actions (18.4s)
  [brain] Sugalan Social Club: 0 actions (19.7s)
  [brain] Ilonggo Ironworks: 9 actions (23.3s)
Day 46 (Tuesday): 52 fights, 1 unmatched, 4 claims settled, staking paid 943.22 GP to 21 stakers — 23.7s
  [brain] Cuchillos de Sonora: 1 actions (1.7s)
  [brain] Cavite Bloodlines: 7 actions (5.5s)
  [brain] Bagong Laban: 0 actions (6.9s)
  [brain] Sugalan Social Club: 7 actions (9.7s)
  [brain] Ilonggo Ironworks: 0 actions (11.0s)
  [brain] Talisay Tari Club: 6 actions (14.9s)
  [brain] Marco Gamefarm: 10 actions (19.3s)
  [brain] Batangas Sprint Club: 0 actions (20.2s)
  [brain] Pulang Bagwis: 8 actions (24.7s)
  [brain] Hacienda Verde: 7 actions (29.2s)
Day 47 (Wednesday): 60 fights, 6 unmatched, 4 claims settled, staking paid 870.38 GP to 21 stakers — 29.5s
  [brain] Bagong Laban: 10 actions (6.1s)
  [brain] Cuchillos de Sonora: 0 actions (7.6s)
  [brain] Cavite Bloodlines: 0 actions (9.1s)
  [brain] Batangas Sprint Club: 5 actions (12.3s)
  [brain] Sugalan Social Club: 8 actions (16.2s)
  [brain] Ilonggo Ironworks: 8 actions (21.0s)
  [brain] Talisay Tari Club: 7 actions (23.8s)
  [brain] Marco Gamefarm: 8 actions (28.6s)
  [brain] Hacienda Verde: 6 actions (31.4s)
  [brain] Pulang Bagwis: 9 actions (37.0s)
Day 48 (Thursday): 33 fights, 8 unmatched, 3 claims settled, staking paid 848.20 GP to 21 stakers — 37.5s
  [brain] Pulang Bagwis: 10 actions (6.1s)
  [brain] Talisay Tari Club: 8 actions (11.0s)
  [brain] Cavite Bloodlines: 8 actions (14.7s)
  [brain] Sugalan Social Club: 10 actions (18.2s)
  [brain] Hacienda Verde: 0 actions (19.5s)
  [brain] Marco Gamefarm: 6 actions (23.5s)
  [brain] Cuchillos de Sonora: 0 actions (24.9s)
  [brain] Bagong Laban: 8 actions (30.0s)
  [brain] Ilonggo Ironworks: 7 actions (34.3s)
  [brain] Batangas Sprint Club: 0 actions (35.4s)
Day 49 (Friday): 79 fights, 8 unmatched, 6 claims settled, staking paid 894.41 GP to 21 stakers — HATCH FRIDAY (8 hatched) — 35.9s
        wk 7 · 7 days in 3:22 · avg 28.90s/day
  [brain] Cavite Bloodlines: 0 actions (1.7s)
  [brain] Marco Gamefarm: 0 actions (3.0s)
  [brain] Bagong Laban: 9 actions (6.9s)
  [brain] Ilonggo Ironworks: 9 actions (12.5s)
  [brain] Batangas Sprint Club: 0 actions (13.6s)
  [brain] Pulang Bagwis: 9 actions (17.8s)
  [brain] Cuchillos de Sonora: 8 actions (22.6s)
  [brain] Hacienda Verde: 6 actions (25.3s)
  [brain] Sugalan Social Club: 0 actions (26.7s)
  [brain] Talisay Tari Club: 5 actions (29.8s)
Day 50 (Saturday): 128 fights, 3 unmatched, 5 claims settled, staking paid 1306.97 GP to 21 stakers — 30.4s
  [brain] Sugalan Social Club: 11 actions (3.6s)
  [brain] Cuchillos de Sonora: 0 actions (5.2s)
  [brain] Marco Gamefarm: 0 actions (7.0s)
  [brain] Pulang Bagwis: 0 actions (8.8s)
  [brain] Bagong Laban: 0 actions (10.4s)
  [brain] Batangas Sprint Club: 0 actions (11.5s)
  [brain] Cavite Bloodlines: 0 actions (13.1s)
  [brain] Ilonggo Ironworks: 13 actions (18.2s)
  [brain] Talisay Tari Club: 0 actions (19.4s)
  [brain] Hacienda Verde: 6 actions (22.3s)
Day 51 (Sunday): 102 fights, 0 unmatched, 4 claims settled, staking paid 1635.83 GP to 21 stakers — 22.9s
  [brain] Bagong Laban: 9 actions (4.6s)
  [brain] Hacienda Verde: 0 actions (6.1s)
  [brain] Marco Gamefarm: 7 actions (10.3s)
  [brain] Talisay Tari Club: 9 actions (14.1s)
  [brain] Cuchillos de Sonora: 0 actions (16.1s)
  [brain] Batangas Sprint Club: 8 actions (20.2s)
  [brain] Sugalan Social Club: 0 actions (21.6s)
  [brain] Pulang Bagwis: 0 actions (23.7s)
  [brain] Cavite Bloodlines: 15 actions (29.1s)
  [brain] Ilonggo Ironworks: 7 actions (32.6s)
Day 52 (Monday): 97 fights, 2 unmatched, 6 claims settled, staking paid 982.39 GP to 21 stakers — 33.1s
  [brain] Batangas Sprint Club: 7 actions (2.4s)
  [brain] Bagong Laban: 10 actions (7.6s)
  [brain] Talisay Tari Club: 2 actions (9.3s)
  [brain] Sugalan Social Club: 7 actions (12.8s)
  [brain] Cuchillos de Sonora: 7 actions (17.5s)
  [brain] Ilonggo Ironworks: 12 actions (22.1s)
  [brain] Hacienda Verde: 6 actions (24.5s)
  [brain] Cavite Bloodlines: 14 actions (29.8s)
  [brain] Marco Gamefarm: 6 actions (32.7s)
  [brain] Pulang Bagwis: 7 actions (37.5s)
Day 53 (Tuesday): 101 fights, 0 unmatched, 4 claims settled, staking paid 942.40 GP to 21 stakers — 38.0s
  [brain] Pulang Bagwis: 13 actions (5.8s)
  [brain] Ilonggo Ironworks: 9 actions (10.9s)
  [brain] Cavite Bloodlines: 10 actions (15.4s)
  [brain] Hacienda Verde: 7 actions (19.6s)
  [brain] Cuchillos de Sonora: 9 actions (23.8s)
  [brain] Talisay Tari Club: 11 actions (27.7s)
  [brain] Sugalan Social Club: 10 actions (31.8s)
  [brain] Batangas Sprint Club: 5 actions (33.9s)
  [brain] Bagong Laban: 0 actions (35.4s)
  [brain] Marco Gamefarm: 2 actions (37.5s)
Day 54 (Wednesday): 111 fights, 1 unmatched, 7 claims settled, staking paid 1079.40 GP to 21 stakers — 38.1s
  [brain] Marco Gamefarm: 6 actions (3.6s)
  [brain] Batangas Sprint Club: 5 actions (6.8s)
  [brain] Pulang Bagwis: 8 actions (10.5s)
  [brain] Talisay Tari Club: 8 actions (13.9s)
  [brain] Hacienda Verde: 6 actions (18.1s)
  [brain] Sugalan Social Club: 9 actions (23.4s)
  [brain] Bagong Laban: 0 actions (24.9s)
  [brain] Ilonggo Ironworks: 9 actions (30.6s)
  [brain] Cuchillos de Sonora: 0 actions (32.1s)
  [brain] Cavite Bloodlines: 7 actions (37.1s)
Day 55 (Thursday): 25 fights, 5 unmatched, 1 claims settled, staking paid 955.60 GP to 21 stakers — 37.6s
  [brain] Pulang Bagwis: 2 actions (2.5s)
  [brain] Cuchillos de Sonora: 0 actions (3.8s)
  [brain] Ilonggo Ironworks: 8 actions (9.2s)
  [brain] Talisay Tari Club: 8 actions (12.7s)
  [brain] Hacienda Verde: 0 actions (14.0s)
  [brain] Bagong Laban: 0 actions (16.0s)
  [brain] Cavite Bloodlines: 10 actions (22.7s)
  [brain] Sugalan Social Club: 0 actions (24.0s)
  [brain] Marco Gamefarm: 10 actions (30.4s)
  [brain] Batangas Sprint Club: 6 actions (33.8s)
Day 56 (Friday): 79 fights, 0 unmatched, 4 claims settled, staking paid 1083.79 GP to 21 stakers — HATCH FRIDAY (8 hatched) — 34.5s
        wk 8 · 7 days in 3:55 · avg 33.51s/day

TIMING
  seed + bots      0.0s
  simulation      17:44   (28 day(s), avg 38.01s/day · honest 9% / tick 91%)
  brains          17:34   (37.65s/day · 99% of the run, 280 call(s), 20 failed)
  doctor           0.8s
  total           17:45
  slowest days d29 2:01 · d30 2:00 · d31 1:44
  per unit     303.05 ms/fight · 389.29 ms/entry

BARN CAREERS (durable actor state — persists across runs)
  bot-7     54 day(s) played · last day 55 · 250 proposed, 6 dropped, 0 failure(s) · 989.6s thinking
  bot-8     54 day(s) played · last day 55 · 309 proposed, 27 dropped, 0 failure(s) · 884.3s thinking
  bot-9     53 day(s) played · last day 55 · 331 proposed, 21 dropped, 1 failure(s) · 1006.2s thinking
  bot-marco  54 day(s) played · last day 55 · 255 proposed, 22 dropped, 0 failure(s) · 989.2s thinking
  bot-12    54 day(s) played · last day 55 · 209 proposed, 6 dropped, 0 failure(s) · 860.0s thinking
  bot-13    54 day(s) played · last day 55 · 190 proposed, 29 dropped, 0 failure(s) · 904.1s thinking
  bot-14    54 day(s) played · last day 55 · 283 proposed, 33 dropped, 0 failure(s) · 1037.0s thinking
  bot-15    54 day(s) played · last day 55 · 303 proposed, 7 dropped, 0 failure(s) · 1110.5s thinking
  bot-16    54 day(s) played · last day 55 · 332 proposed, 17 dropped, 0 failure(s) · 888.9s thinking
  bot-17    54 day(s) played · last day 55 · 329 proposed, 20 dropped, 0 failure(s) · 930.8s thinking

PINTAKASI DOCTOR · data/sim-20260815-0419.db
day 56 · Friday, February 28, 3000 · week 8 · 21 farms · 485 birds

INVARIANTS
  PASS  GP conservation            952,800.00 GP in world = 952,800.00 expected
  PASS  LT conservation            400,703.90 LT held = 400,703.90 LT ledgered
  PASS  no negative balances       staker 0.11 · juice 0.02 · 21 wallets clean
  PASS  pit figures                3512 fights · 3512 mirrored · 0 inversions
  PASS  purses settle              27 completed crown(s), exact to the cent
  PASS  no stranded entries        29 resolved championship(s), every entry settled
  PASS  one card per bird per day  2734 entries across 2734 bird-days · 0 over cap
  PASS  fight counts match the log 2734 settled entries · 6412 fights claimed · 0 mismatched
  PASS  scout book matches the log 1249 book lines audited · 0 out of step

CARD HEALTH
  2734 entries · 2637 fought · 97 unmatched (3.5%) · 391 lobbies
  weather timing  649/2387 starred entries ran on the bird's own element day (27.2% vs 20.0% by chance, 1.36×) ✓ entries are being timed

GROUP STAGE
  fights per settled entry  mean 2.35 of 3 · 2734 settled entries
  full cards  1411 (51.6%) took all 3 · short 1226 (44.8%) fought 1–2 · 97 (3.5%) never fought
  groups  846 dealt · mean 3.23 birds · 38 of one (38 were the lobby's only entry)

LOBBY FILL
  mean 6.99 birds per lobby · 391 lobbies · 38 held a single bird (9.7%)
      1 ██                       9.7%
    2-3 ███████                  28.9%
    4-7 ██████                   24.8%
   8-15 ██████                   26.9%
    16+ ██                       9.7%
  same-barn-only lobbies 19 · 45 birds stranded with no cross-barn opponent

WORST LOBBY KEYS
  real/maiden/b3                        9 entries, 77.8% unmatched
  real/maiden/b4                       17 entries, 64.7% unmatched
  real/claimer/b1@90                   22 entries, 54.5% unmatched

POPULATION
  eggs 56 · active 238 · retired 191 · 21 farms
  by age  1:65  2:55  3:61  4:7  5:5  6:5  7:3  8:37
  supply  hatches 429 · gacha eggs 124 · covers 193
  loss    hardcore 191
  barns   0 of 21 at capacity · 0 expansion(s) bought

FIGHT VOLUME
  wk  0       0  
  wk  1     496  █████████████████
  wk  2     697  ███████████████████████
  wk  3     721  ████████████████████████
  wk  4     259  █████████
  wk  5     164  █████
  wk  6     367  ████████████
  wk  7     690  ███████████████████████
  wk  8     118  ████  (1 day)
  trough wk5 (164) = 22.7% of the wk3 peak (721) — EXPECTED: the age-3 founder flock is culled by the hardcore
  Majors before the first bred generation reaches fighting age, then volume
  recovers. Reference: wk3/4/5/6/7 = 1092/397/145/498/871 fights (20 farms, 91 days).

BLOODLINES
  gen   birds   mean grade     stars   home margin
  0       292   B+ ( 331.6)    1.60★      8.3
  1       193   B+ ( 344.7)    1.94★     13.4
  gen 1 vs gen 0  +13.1 mean stat · +0.3★ · +5.1 pts of home margin

FIGHT ECONOMY BY RUNG
    rung                      fee  entries  share   GP risked   LT minted  LT/100GP
    juvenile/claimer@90        24       55   2.0%         960      137.16     14.29
    juvenile/maiden            30       70   2.6%       1,240      179.47     14.47
    juvenile/claimer@180       48       62   2.3%       2,240      355.39     15.87
    real/claimer@90            48      180   6.6%       6,176      983.51     15.92
    real/maiden                60       79   2.9%       1,880      299.74     15.94
    real/nw3                   60       63   2.3%       2,240      361.76     16.15
    juvenile/claimer@270       72       60   2.2%       3,072      515.49     16.78
    real/claimer@180           96      107   3.9%       8,064    1,434.32     17.79
    real/claimer@270          144      123   4.5%      13,920    2,624.44     18.85
    juvenile/open             150      747  27.3%      89,200   16,880.21     18.92
    real/open                 300    1,188  43.5%     298,200   62,922.41     21.10

LAND SUPPLY
  circulating 400,703.90 LT · 398,481.00 staked (99.4%) · 2,222.90 idle
  minted      405,803.90 LT over 57 day(s) · 7,119.37 LT per day
    purse_payout    261,000.00 LT   64.3%
    card_settled     86,693.90 LT   21.4%
    buy_land         56,000.00 LT   13.8%
    gacha             2,110.00 LT    0.5%
  burned      5,100.00 LT (1.3% of issuance) — the sinks
    stud_listed       5,100.00 LT  100.0%
  valuation   at $0.01/LT (pencilled) the world has issued $4,058 of land against $11,910 of GP faucet — $0.34 of LT per $1 of GP
  runway      100B-token target reached in 10,000+ year(s) at this population's rate — scales with farms, not with time

REPLAY
  201/201 sampled fight rows rebuild exactly from their seed

STAKER POOL
  paid out 57,270.29 GP over 56 day(s) · 0.11 waiting · 398,481.00 LT staked
  land_purchase 44,800.00 · gacha 8,792.00 · breed 3,088.00 · claim_rake 590.40

CHAMPIONSHIPS
  major     15 run / 0 cancelled · field 13.7 · purse 104,732.72
            paid 107/206 entrants (52%) · biggest take 5.1% of all purse GP · smallest 185.17 GP
            entry fees 32,960.00 GP fund 31% of the purse · the rest is juice (gacha + breed fees) · net to the field 71,772.72 GP
            under the door 0/107 winners (0%) took less purse than their entry fee
  juvenile  12 run / 2 cancelled · field 10.6 · purse 31,291.26
            paid 64/127 entrants (50%) · biggest take 11.0% of all purse GP · smallest 40.80 GP
            entry fees 6,096.00 GP fund 19% of the purse · the rest is juice (gacha + breed fees) · net to the field 25,195.26 GP
            under the door 1/64 winners (2%) took less purse than their entry fee

MECHANIC ADOPTION            farms of 21
  claims placed             20  ████████████████████░
  studs listed              10  ██████████░░░░░░░░░░░
  land purchased             1  █░░░░░░░░░░░░░░░░░░░░
  paid gacha rolls          10  ██████████░░░░░░░░░░░
  gacha bundles bought       1  █░░░░░░░░░░░░░░░░░░░░
  barn expanded              0  ░░░░░░░░░░░░░░░░░░░░░  ⚠ NOBODY WALKED THROUGH
  Major entries             21  █████████████████████
  juvenile championship     11  ███████████░░░░░░░░░░
  ⚠ 1 door(s) unused: barn expanded

DISCOVERY
  age 1    carded 507/2296 at the true best blade (22.1% vs random 20.0%) · 49.6% on or adjacent (random 47.9%) · answer coverage 34.0% · SCOUT 412/781 right (52.8% vs random 20.0%), 73.5% on or adjacent · clear home 281/445 (63.1%, 75.7% adjacent)
  age 2–3  carded 939/3541 at the true best blade (26.5% vs random 20.0%) · 53.7% on or adjacent (random 48.0%) · answer coverage 72.6% · SCOUT 1069/2570 right (41.6% vs random 20.0%), 70.4% on or adjacent · clear home 569/1242 (45.8%, 70.1% adjacent)
  age 4+   carded 125/575 at the true best blade (21.7% vs random 20.0%) · 56.7% on or adjacent (random 49.7%) · answer coverage 52.7% · SCOUT 122/303 right (40.3% vs random 20.0%), 67.0% on or adjacent · clear home 52/142 (36.6%, 52.8% adjacent)
  explored  5/5 blades saw an age-1 entry in the discovery year
  flock shape  median home blade beats its runner-up by 9.8 pts · 49.1% of birds clear the 10-pt bar
  breeding  168 bot covers · hens carry +50.5 of their own shape (any bird: +55.5) · the sires chosen reinforce it by +43.5 (an unchosen sire: +6.5) · foals land at +33.0
  broodmare band  75.3% of 77 settled retired hens have ever carried · busiest hen 4 foals
  ✓ the scout beats chance on mature birds with a home — 36.6% vs 20.0%
  ⚠ only 49.1% of birds have a home blade worth finding — the flock is being bred flat, so there is little for discovery to discover

2 warnings · 0 invariant failures

Done → /Users/plumeria/Repos/pintakasi-bloodlines/data/sim-20260815-0419.db
Run `bun dev:sim` and open http://localhost:3435/admin — it always shows the newest sim.
```

---

## Coach session #2 — day 56 (2026-08-15, overnight)

World: `sim-20260815-0419` · 0 invariant failures.

## Scoreboard at day 56

```
  scripted (10): total net worth 691,172 · avg 69,117 · crowns 18
  llm      (10): total net worth 507,392 · avg 50,739 · crowns 9
```

**The breakthrough: Batangas Sprint Club (bot-12, talent scout) holds rank
7 — the first llm barn in three experiments to break into the scripted
pack** — with 3 crowns and 11,445 GP in crown winnings. Seven llm barns
hold at least one crown (9 total; exp2's day 56: 5). Ratio 0.73 (exp2 day
56: 0.70; exp1: 0.58).

## Readings

- Crown engine fully on: 9 crowns, spread across 7 barns.
- Breeding: 14 breeds in seg2 — running but *below* exp2's seg2 (33). The
  near-verbatim orders landed later relative to stock availability;
  cadence needs a direct push in three barns.
- Fights 1,379 vs 4,900 — same 3.5× as ever at this stage; the window lift
  shows up as rosters deepen in seg3, or it doesn't.
- Proposal rate 4.7/day — the model's natural gait, unmoved by the raised
  caps so far.

## Orders

- **KEEP** (7): bot-12 (don't talk to the leader mid-streak), bot-17,
  bot-9, bot-marco, bot-13, bot-15, bot-7.
- **bot-16, bot-14, bot-8** (crownless, lower half): one line each — enter
  everything healthy daily, keep a weekly crown declaration out, and breed
  the moment stock lines up; the three barns above you differ only in
  doing all three every week.

---

## Segment 3 — days 57–91 (verbatim sim log)

```
$ bun run scripts/simulate.ts "35" --keep "--seed=1" "--brain=qwen3:30b-a3b" "--llm=bot-7,bot-15,bot-marco,bot-9,bot-8,bot-16,bot-14,bot-12,bot-13,bot-17" --actors
Brain: qwen3:30b-a3b plays 10 stable(s) — bot-7, bot-15, bot-marco, bot-9, bot-8, bot-16, bot-14, bot-12, bot-13, bot-17

level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"hohecpuxd0dpxxh4mad9u0phh6dl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"92b8r89mhw0n7piuhpejodod6jbl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"puvvhf4ihwae80wdy8gsx9secwal00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"d5w1wh8e9ua93scg7muu108yejcl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"lfhf8wlnorsemc896255mpevykal00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"d9nl41yus15fir5kbx7ynru208bl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"1k3wxorf9awdbevnwupdf1gd1ncl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"9uoh9f3v29ib05eyh9v71li2igal00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"57omeeimuy1rk2r3oy724yogzrbl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"d1xjgkbtzpf8mz8hbj4psl2ldecl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"92b8r89mhw0n7piuhpejodod6jbl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"hohecpuxd0dpxxh4mad9u0phh6dl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"d9nl41yus15fir5kbx7ynru208bl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"puvvhf4ihwae80wdy8gsx9secwal00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"d5w1wh8e9ua93scg7muu108yejcl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"lfhf8wlnorsemc896255mpevykal00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"d1xjgkbtzpf8mz8hbj4psl2ldecl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"9uoh9f3v29ib05eyh9v71li2igal00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"1k3wxorf9awdbevnwupdf1gd1ncl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"57omeeimuy1rk2r3oy724yogzrbl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"d9nl41yus15fir5kbx7ynru208bl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"92b8r89mhw0n7piuhpejodod6jbl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"hohecpuxd0dpxxh4mad9u0phh6dl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"d1xjgkbtzpf8mz8hbj4psl2ldecl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"puvvhf4ihwae80wdy8gsx9secwal00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"d5w1wh8e9ua93scg7muu108yejcl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"9uoh9f3v29ib05eyh9v71li2igal00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"1k3wxorf9awdbevnwupdf1gd1ncl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"lfhf8wlnorsemc896255mpevykal00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"57omeeimuy1rk2r3oy724yogzrbl00\"}"
[bot-brain] bot-7 proposed nothing: Actor failed to start (92b8r89mhw0n7piuhpejodod6jbl00): "no_envoys"
[bot-brain] bot-8 proposed nothing: Actor failed to start (hohecpuxd0dpxxh4mad9u0phh6dl00): "no_envoys"
[bot-brain] bot-9 proposed nothing: Actor failed to start (57omeeimuy1rk2r3oy724yogzrbl00): "no_envoys"
[bot-brain] bot-marco proposed nothing: Actor failed to start (lfhf8wlnorsemc896255mpevykal00): "no_envoys"
[bot-brain] bot-12 proposed nothing: Actor failed to start (d1xjgkbtzpf8mz8hbj4psl2ldecl00): "no_envoys"
[bot-brain] bot-13 proposed nothing: Actor failed to start (d5w1wh8e9ua93scg7muu108yejcl00): "no_envoys"
[bot-brain] bot-14 proposed nothing: Actor failed to start (d9nl41yus15fir5kbx7ynru208bl00): "no_envoys"
[bot-brain] bot-15 proposed nothing: Actor failed to start (1k3wxorf9awdbevnwupdf1gd1ncl00): "no_envoys"
[bot-brain] bot-16 proposed nothing: Actor failed to start (puvvhf4ihwae80wdy8gsx9secwal00): "no_envoys"
[bot-brain] bot-17 proposed nothing: Actor failed to start (9uoh9f3v29ib05eyh9v71li2igal00): "no_envoys"
Day 57 (Saturday): 83 fights, 2 unmatched, 4 claims settled, staking paid 1618.80 GP to 21 stakers — 2:01
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"d5w1wh8e9ua93scg7muu108yejcl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"hohecpuxd0dpxxh4mad9u0phh6dl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"puvvhf4ihwae80wdy8gsx9secwal00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"57omeeimuy1rk2r3oy724yogzrbl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"d9nl41yus15fir5kbx7ynru208bl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"1k3wxorf9awdbevnwupdf1gd1ncl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"lfhf8wlnorsemc896255mpevykal00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"9uoh9f3v29ib05eyh9v71li2igal00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"92b8r89mhw0n7piuhpejodod6jbl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"d1xjgkbtzpf8mz8hbj4psl2ldecl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"d9nl41yus15fir5kbx7ynru208bl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"hohecpuxd0dpxxh4mad9u0phh6dl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"d5w1wh8e9ua93scg7muu108yejcl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"lfhf8wlnorsemc896255mpevykal00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"1k3wxorf9awdbevnwupdf1gd1ncl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"9uoh9f3v29ib05eyh9v71li2igal00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"92b8r89mhw0n7piuhpejodod6jbl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"puvvhf4ihwae80wdy8gsx9secwal00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"57omeeimuy1rk2r3oy724yogzrbl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"d1xjgkbtzpf8mz8hbj4psl2ldecl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"hohecpuxd0dpxxh4mad9u0phh6dl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"d5w1wh8e9ua93scg7muu108yejcl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"1k3wxorf9awdbevnwupdf1gd1ncl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"d9nl41yus15fir5kbx7ynru208bl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"9uoh9f3v29ib05eyh9v71li2igal00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"lfhf8wlnorsemc896255mpevykal00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"92b8r89mhw0n7piuhpejodod6jbl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"puvvhf4ihwae80wdy8gsx9secwal00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"57omeeimuy1rk2r3oy724yogzrbl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"d1xjgkbtzpf8mz8hbj4psl2ldecl00\"}"
[bot-brain] bot-7 proposed nothing: Actor failed to start (92b8r89mhw0n7piuhpejodod6jbl00): "no_envoys"
[bot-brain] bot-8 proposed nothing: Actor failed to start (hohecpuxd0dpxxh4mad9u0phh6dl00): "no_envoys"
[bot-brain] bot-9 proposed nothing: Actor failed to start (57omeeimuy1rk2r3oy724yogzrbl00): "no_envoys"
[bot-brain] bot-marco proposed nothing: Actor failed to start (lfhf8wlnorsemc896255mpevykal00): "no_envoys"
[bot-brain] bot-12 proposed nothing: Actor failed to start (d1xjgkbtzpf8mz8hbj4psl2ldecl00): "no_envoys"
[bot-brain] bot-13 proposed nothing: Actor failed to start (d5w1wh8e9ua93scg7muu108yejcl00): "no_envoys"
[bot-brain] bot-14 proposed nothing: Actor failed to start (d9nl41yus15fir5kbx7ynru208bl00): "no_envoys"
[bot-brain] bot-15 proposed nothing: Actor failed to start (1k3wxorf9awdbevnwupdf1gd1ncl00): "no_envoys"
[bot-brain] bot-16 proposed nothing: Actor failed to start (puvvhf4ihwae80wdy8gsx9secwal00): "no_envoys"
[bot-brain] bot-17 proposed nothing: Actor failed to start (9uoh9f3v29ib05eyh9v71li2igal00): "no_envoys"
Day 58 (Sunday): 114 fights, 0 unmatched, 9 claims settled, staking paid 1083.01 GP to 21 stakers — 2:01
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"hohecpuxd0dpxxh4mad9u0phh6dl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"9uoh9f3v29ib05eyh9v71li2igal00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"puvvhf4ihwae80wdy8gsx9secwal00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"d1xjgkbtzpf8mz8hbj4psl2ldecl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"92b8r89mhw0n7piuhpejodod6jbl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"d9nl41yus15fir5kbx7ynru208bl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"1k3wxorf9awdbevnwupdf1gd1ncl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"lfhf8wlnorsemc896255mpevykal00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"57omeeimuy1rk2r3oy724yogzrbl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"d5w1wh8e9ua93scg7muu108yejcl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"hohecpuxd0dpxxh4mad9u0phh6dl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"9uoh9f3v29ib05eyh9v71li2igal00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"puvvhf4ihwae80wdy8gsx9secwal00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"d1xjgkbtzpf8mz8hbj4psl2ldecl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"1k3wxorf9awdbevnwupdf1gd1ncl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"d9nl41yus15fir5kbx7ynru208bl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"lfhf8wlnorsemc896255mpevykal00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"57omeeimuy1rk2r3oy724yogzrbl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"92b8r89mhw0n7piuhpejodod6jbl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"d5w1wh8e9ua93scg7muu108yejcl00\"}"
level=warn msg="http error response" group=actor code=dropped_reply message="An internal error occurred" actorId=hohecpuxd0dpxxh4mad9u0phh6dl00 generation=3 actorKey=sim-20260815-0419/bot-8
  [brain] Sugalan Social Club: 7 actions (16.4s)
  [brain] Cuchillos de Sonora: 8 actions (4.1s)
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"9uoh9f3v29ib05eyh9v71li2igal00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"puvvhf4ihwae80wdy8gsx9secwal00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"d1xjgkbtzpf8mz8hbj4psl2ldecl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"1k3wxorf9awdbevnwupdf1gd1ncl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"lfhf8wlnorsemc896255mpevykal00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"57omeeimuy1rk2r3oy724yogzrbl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"92b8r89mhw0n7piuhpejodod6jbl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"d5w1wh8e9ua93scg7muu108yejcl00\"}"
[bot-brain] bot-7 proposed nothing: Actor failed to start (92b8r89mhw0n7piuhpejodod6jbl00): "no_envoys"
[bot-brain] bot-9 proposed nothing: Actor failed to start (57omeeimuy1rk2r3oy724yogzrbl00): "no_envoys"
[bot-brain] bot-marco proposed nothing: Actor failed to start (lfhf8wlnorsemc896255mpevykal00): "no_envoys"
[bot-brain] bot-12 proposed nothing: Actor failed to start (d1xjgkbtzpf8mz8hbj4psl2ldecl00): "no_envoys"
[bot-brain] bot-13 proposed nothing: Actor failed to start (d5w1wh8e9ua93scg7muu108yejcl00): "no_envoys"
[bot-brain] bot-15 proposed nothing: Actor failed to start (1k3wxorf9awdbevnwupdf1gd1ncl00): "no_envoys"
[bot-brain] bot-16 proposed nothing: Actor failed to start (puvvhf4ihwae80wdy8gsx9secwal00): "no_envoys"
[bot-brain] bot-17 proposed nothing: Actor failed to start (9uoh9f3v29ib05eyh9v71li2igal00): "no_envoys"
Day 59 (Monday): 90 fights, 0 unmatched, 3 claims settled, staking paid 1002.80 GP to 21 stakers — 2:01
  [brain] Pulang Bagwis: 0 actions (1.8s)
  [brain] Sugalan Social Club: 17 actions (7.0s)
  [brain] Cuchillos de Sonora: 15 actions (12.4s)
  [brain] Batangas Sprint Club: 5 actions (15.4s)
  [brain] Bagong Laban: 10 actions (19.0s)
  [brain] Cavite Bloodlines: 12 actions (23.0s)
  [brain] Talisay Tari Club: 11 actions (27.4s)
  [brain] Hacienda Verde: 0 actions (28.6s)
  [brain] Marco Gamefarm: 0 actions (29.9s)
  [brain] Ilonggo Ironworks: 9 actions (34.3s)
Day 60 (Tuesday): 147 fights, 2 unmatched, 8 claims settled, staking paid 1059.19 GP to 21 stakers — 34.9s
  [brain] Sugalan Social Club: 0 actions (1.4s)
  [brain] Cuchillos de Sonora: 8 actions (5.1s)
  [brain] Batangas Sprint Club: 0 actions (6.0s)
  [brain] Ilonggo Ironworks: 0 actions (7.2s)
  [brain] Marco Gamefarm: 0 actions (8.4s)
  [brain] Talisay Tari Club: 0 actions (9.4s)
  [brain] Hacienda Verde: 0 actions (10.4s)
  [brain] Pulang Bagwis: 0 actions (11.6s)
  [brain] Cavite Bloodlines: 0 actions (12.8s)
  [brain] Bagong Laban: 0 actions (14.1s)
Day 61 (Wednesday): 96 fights, 0 unmatched, 6 claims settled, staking paid 942.41 GP to 21 stakers — 14.6s
  [brain] Talisay Tari Club: 7 actions (3.7s)
  [brain] Cuchillos de Sonora: 0 actions (5.1s)
  [brain] Ilonggo Ironworks: 0 actions (6.2s)
  [brain] Cavite Bloodlines: 0 actions (7.4s)
  [brain] Bagong Laban: 7 actions (11.6s)
  [brain] Batangas Sprint Club: 0 actions (12.5s)
  [brain] Pulang Bagwis: 0 actions (13.9s)
  [brain] Marco Gamefarm: 0 actions (15.0s)
  [brain] Sugalan Social Club: 0 actions (16.2s)
  [brain] Hacienda Verde: 1 actions (17.4s)
Day 62 (Thursday): 36 fights, 6 unmatched, 4 claims settled, staking paid 962.78 GP to 21 stakers — 17.9s
  [brain] Ilonggo Ironworks: 5 actions (2.3s)
  [brain] Marco Gamefarm: 0 actions (3.4s)
  [brain] Sugalan Social Club: 10 actions (6.8s)
  [brain] Cuchillos de Sonora: 0 actions (8.0s)
  [brain] Hacienda Verde: 6 actions (11.0s)
  [brain] Pulang Bagwis: 0 actions (12.1s)
  [brain] Cavite Bloodlines: 9 actions (16.6s)
  [brain] Talisay Tari Club: 0 actions (17.7s)
  [brain] Batangas Sprint Club: 0 actions (18.5s)
  [brain] Bagong Laban: 0 actions (19.9s)
Day 63 (Friday): 78 fights, 2 unmatched, 3 claims settled, staking paid 949.41 GP to 21 stakers — HATCH FRIDAY (8 hatched) — 20.5s
        wk 9 · 7 days in 7:30 · avg 64.27s/day
  [brain] Bagong Laban: 0 actions (1.8s)
  [brain] Pulang Bagwis: 6 actions (4.3s)
  [brain] Cavite Bloodlines: 5 actions (7.6s)
  [brain] Hacienda Verde: 7 actions (10.4s)
  [brain] Talisay Tari Club: 7 actions (13.3s)
  [brain] Cuchillos de Sonora: 13 actions (18.1s)
  [brain] Marco Gamefarm: 0 actions (19.8s)
  [brain] Sugalan Social Club: 8 actions (22.5s)
  [brain] Ilonggo Ironworks: 0 actions (23.8s)
  [brain] Batangas Sprint Club: 5 actions (25.8s)
Day 64 (Saturday): 143 fights, 0 unmatched, 7 claims settled, staking paid 1372.60 GP to 21 stakers — 26.7s
  [brain] Talisay Tari Club: 0 actions (1.3s)
  [brain] Ilonggo Ironworks: 6 actions (3.5s)
  [brain] Pulang Bagwis: 7 actions (6.0s)
  [brain] Marco Gamefarm: 0 actions (7.3s)
  [brain] Batangas Sprint Club: 0 actions (8.2s)
  [brain] Cuchillos de Sonora: 0 actions (9.4s)
  [brain] Sugalan Social Club: 0 actions (10.5s)
  [brain] Bagong Laban: 7 actions (14.5s)
  [brain] Hacienda Verde: 0 actions (15.4s)
  [brain] Cavite Bloodlines: 6 actions (18.8s)
Day 65 (Sunday): 165 fights, 0 unmatched, 7 claims settled, staking paid 1155.80 GP to 21 stakers — 19.5s
  [brain] Batangas Sprint Club: 11 actions (2.9s)
  [brain] Cavite Bloodlines: 6 actions (6.2s)
  [brain] Hacienda Verde: 7 actions (9.9s)
  [brain] Marco Gamefarm: 0 actions (11.2s)
  [brain] Bagong Laban: 0 actions (12.5s)
  [brain] Pulang Bagwis: 0 actions (13.8s)
  [brain] Ilonggo Ironworks: 7 actions (16.5s)
  [brain] Cuchillos de Sonora: 14 actions (22.9s)
  [brain] Sugalan Social Club: 12 actions (28.3s)
  [brain] Talisay Tari Club: 0 actions (29.6s)
Day 66 (Monday): 113 fights, 1 unmatched, 6 claims settled, staking paid 1414.40 GP to 21 stakers — 30.2s
  [brain] Cavite Bloodlines: 6 actions (3.6s)
  [brain] Sugalan Social Club: 7 actions (7.5s)
  [brain] Cuchillos de Sonora: 0 actions (9.0s)
  [brain] Bagong Laban: 0 actions (10.5s)
  [brain] Pulang Bagwis: 7 actions (14.8s)
  [brain] Ilonggo Ironworks: 0 actions (16.2s)
  [brain] Batangas Sprint Club: 0 actions (17.3s)
  [brain] Marco Gamefarm: 13 actions (21.6s)
  [brain] Hacienda Verde: 0 actions (22.7s)
  [brain] Talisay Tari Club: 14 actions (26.9s)
Day 67 (Tuesday): 145 fights, 0 unmatched, 3 claims settled, staking paid 986.82 GP to 21 stakers — 27.5s
  [brain] Pulang Bagwis: 0 actions (1.5s)
  [brain] Marco Gamefarm: 9 actions (6.6s)
  [brain] Talisay Tari Club: 7 actions (9.7s)
  [brain] Sugalan Social Club: 8 actions (13.2s)
  [brain] Cuchillos de Sonora: 8 actions (17.9s)
  [brain] Ilonggo Ironworks: 7 actions (21.9s)
  [brain] Bagong Laban: 0 actions (23.3s)
  [brain] Batangas Sprint Club: 6 actions (25.3s)
  [brain] Cavite Bloodlines: 7 actions (29.0s)
  [brain] Hacienda Verde: 8 actions (32.0s)
Day 68 (Wednesday): 100 fights, 0 unmatched, 5 claims settled, staking paid 964.58 GP to 21 stakers — 32.6s
  [brain] Cuchillos de Sonora: 6 actions (3.7s)
  [brain] Sugalan Social Club: 7 actions (7.4s)
  [brain] Pulang Bagwis: 0 actions (8.5s)
  [brain] Cavite Bloodlines: 9 actions (12.9s)
  [brain] Batangas Sprint Club: 0 actions (13.8s)
  [brain] Talisay Tari Club: 0 actions (14.9s)
  [brain] Hacienda Verde: 9 actions (19.1s)
  [brain] Bagong Laban: 6 actions (22.3s)
  [brain] Ilonggo Ironworks: 5 actions (25.3s)
  [brain] Marco Gamefarm: 2 actions (26.8s)
Day 69 (Thursday): 61 fights, 2 unmatched, 3 claims settled, staking paid 999.20 GP to 21 stakers — 27.5s
  [brain] Hacienda Verde: 0 actions (1.2s)
  [brain] Sugalan Social Club: 0 actions (2.2s)
  [brain] Cuchillos de Sonora: 0 actions (3.5s)
  [brain] Batangas Sprint Club: 5 actions (6.9s)
  [brain] Ilonggo Ironworks: 0 actions (8.2s)
  [brain] Talisay Tari Club: 0 actions (9.6s)
  [brain] Pulang Bagwis: 0 actions (10.9s)
  [brain] Cavite Bloodlines: 0 actions (12.3s)
  [brain] Bagong Laban: 5 actions (15.4s)
  [brain] Marco Gamefarm: 2 actions (16.8s)
Day 70 (Friday): 90 fights, 0 unmatched, 5 claims settled, staking paid 900.60 GP to 21 stakers — HATCH FRIDAY (8 hatched) — 17.6s
        wk 10 · 7 days in 3:02 · avg 25.94s/day
  [brain] Talisay Tari Club: 7 actions (2.8s)
  [brain] Ilonggo Ironworks: 8 actions (6.0s)
  [brain] Hacienda Verde: 6 actions (8.5s)
  [brain] Marco Gamefarm: 6 actions (11.3s)
  [brain] Sugalan Social Club: 7 actions (15.3s)
  [brain] Batangas Sprint Club: 0 actions (16.5s)
  [brain] Bagong Laban: 0 actions (18.2s)
  [brain] Pulang Bagwis: 7 actions (22.3s)
  [brain] Cavite Bloodlines: 4 actions (24.8s)
  [brain] Cuchillos de Sonora: 8 actions (28.6s)
Day 71 (Saturday): 167 fights, 0 unmatched, 8 claims settled, staking paid 1447.40 GP to 21 stakers — 29.5s
  [brain] Cavite Bloodlines: 5 actions (3.4s)
  [brain] Batangas Sprint Club: 9 actions (7.7s)
  [brain] Cuchillos de Sonora: 12 actions (13.1s)
  [brain] Pulang Bagwis: 2 actions (14.6s)
  [brain] Ilonggo Ironworks: 9 actions (20.0s)
  [brain] Hacienda Verde: 7 actions (22.9s)
  [brain] Marco Gamefarm: 13 actions (28.3s)
  [brain] Bagong Laban: 7 actions (31.7s)
  [brain] Sugalan Social Club: 0 actions (33.4s)
  [brain] Talisay Tari Club: 0 actions (35.0s)
Day 72 (Sunday): 113 fights, 4 unmatched, 6 claims settled, staking paid 1249.20 GP to 21 stakers — 35.7s
  [brain] Batangas Sprint Club: 0 actions (1.4s)
  [brain] Talisay Tari Club: 0 actions (2.6s)
  [brain] Cavite Bloodlines: 2 actions (4.8s)
  [brain] Sugalan Social Club: 13 actions (11.5s)
  [brain] Pulang Bagwis: 8 actions (15.1s)
  [brain] Marco Gamefarm: 8 actions (19.0s)
  [brain] Bagong Laban: 0 actions (21.2s)
  [brain] Ilonggo Ironworks: 6 actions (25.5s)
  [brain] Cuchillos de Sonora: 0 actions (27.1s)
  [brain] Hacienda Verde: 1 actions (28.5s)
Day 73 (Monday): 130 fights, 0 unmatched, 7 claims settled, staking paid 1768.21 GP to 21 stakers — 29.4s
  [brain] Marco Gamefarm: 10 actions (6.5s)
  [brain] Ilonggo Ironworks: 7 actions (10.6s)
  [brain] Bagong Laban: 8 actions (14.1s)
  [brain] Cavite Bloodlines: 2 actions (16.6s)
  [brain] Hacienda Verde: 0 actions (18.1s)
  [brain] Batangas Sprint Club: 8 actions (21.0s)
  [brain] Cuchillos de Sonora: 0 actions (22.9s)
  [brain] Pulang Bagwis: 12 actions (28.8s)
  [brain] Talisay Tari Club: 7 actions (33.2s)
  [brain] Sugalan Social Club: 8 actions (38.1s)
Day 74 (Tuesday): 153 fights, 1 unmatched, 8 claims settled, staking paid 1094.60 GP to 21 stakers — 38.9s
  [brain] Talisay Tari Club: 7 actions (4.2s)
  [brain] Pulang Bagwis: 6 actions (8.3s)
  [brain] Sugalan Social Club: 0 actions (9.7s)
  [brain] Cuchillos de Sonora: 0 actions (11.2s)
  [brain] Bagong Laban: 8 actions (14.7s)
  [brain] Hacienda Verde: 0 actions (15.7s)
  [brain] Cavite Bloodlines: 6 actions (19.9s)
  [brain] Batangas Sprint Club: 0 actions (21.2s)
  [brain] Marco Gamefarm: 8 actions (24.6s)
  [brain] Ilonggo Ironworks: 1 actions (26.3s)
Day 75 (Wednesday): 131 fights, 0 unmatched, 5 claims settled, staking paid 1005.58 GP to 21 stakers — 26.9s
  [brain] Talisay Tari Club: 0 actions (1.6s)
  [brain] Marco Gamefarm: 8 actions (5.1s)
  [brain] Ilonggo Ironworks: 1 actions (6.9s)
  [brain] Batangas Sprint Club: 7 actions (11.0s)
  [brain] Hacienda Verde: 0 actions (12.0s)
  [brain] Cuchillos de Sonora: 0 actions (13.8s)
  [brain] Bagong Laban: 0 actions (15.5s)
  [brain] Cavite Bloodlines: 5 actions (18.8s)
  [brain] Sugalan Social Club: 0 actions (20.2s)
  [brain] Pulang Bagwis: 0 actions (21.7s)
Day 76 (Thursday): 33 fights, 7 unmatched, 3 claims settled, staking paid 1045.42 GP to 21 stakers — 22.4s
  [brain] Ilonggo Ironworks: 10 actions (5.8s)
  [brain] Marco Gamefarm: 7 actions (9.4s)
  [brain] Sugalan Social Club: 0 actions (10.8s)
  [brain] Cuchillos de Sonora: 9 actions (16.1s)
  [brain] Bagong Laban: 1 actions (17.8s)
  [brain] Batangas Sprint Club: 6 actions (20.7s)
  [brain] Cavite Bloodlines: 0 actions (22.2s)
  [brain] Talisay Tari Club: 6 actions (25.1s)
  [brain] Hacienda Verde: 6 actions (29.1s)
  [brain] Pulang Bagwis: 7 actions (32.1s)
Day 77 (Friday): 87 fights, 1 unmatched, 4 claims settled, staking paid 986.82 GP to 21 stakers — HATCH FRIDAY (7 hatched) — 32.9s
        wk 11 · 7 days in 3:36 · avg 30.82s/day
  [brain] Bagong Laban: 1 actions (2.2s)
  [brain] Hacienda Verde: 7 actions (6.9s)
  [brain] Batangas Sprint Club: 0 actions (8.3s)
  [brain] Cuchillos de Sonora: 0 actions (10.4s)
  [brain] Cavite Bloodlines: 6 actions (14.9s)
  [brain] Pulang Bagwis: 8 actions (19.0s)
  [brain] Sugalan Social Club: 2 actions (21.1s)
  [brain] Talisay Tari Club: 0 actions (22.9s)
  [brain] Ilonggo Ironworks: 0 actions (24.8s)
  [brain] Marco Gamefarm: 7 actions (30.3s)
Day 78 (Saturday): 137 fights, 0 unmatched, 5 claims settled, staking paid 2012.56 GP to 21 stakers — 31.5s
  [brain] Talisay Tari Club: 0 actions (1.5s)
  [brain] Marco Gamefarm: 0 actions (3.2s)
  [brain] Ilonggo Ironworks: 15 actions (11.3s)
  [brain] Cavite Bloodlines: 9 actions (17.3s)
  [brain] Cuchillos de Sonora: 0 actions (18.8s)
  [brain] Bagong Laban: 9 actions (23.4s)
  [brain] Hacienda Verde: 0 actions (24.6s)
  [brain] Pulang Bagwis: 16 actions (31.2s)
  [brain] Batangas Sprint Club: 1 actions (32.5s)
  [brain] Sugalan Social Club: 7 actions (36.9s)
Day 79 (Sunday): 146 fights, 3 unmatched, 6 claims settled, staking paid 1364.61 GP to 21 stakers — 37.7s
  [brain] Sugalan Social Club: 0 actions (1.9s)
  [brain] Cavite Bloodlines: 11 actions (5.6s)
  [brain] Cuchillos de Sonora: 14 actions (12.3s)
  [brain] Marco Gamefarm: 6 actions (16.9s)
  [brain] Bagong Laban: 0 actions (18.7s)
  [brain] Batangas Sprint Club: 0 actions (20.1s)
  [brain] Ilonggo Ironworks: 0 actions (21.8s)
  [brain] Pulang Bagwis: 10 actions (27.6s)
  [brain] Hacienda Verde: 0 actions (29.0s)
  [brain] Talisay Tari Club: 9 actions (34.1s)
Day 80 (Monday): 155 fights, 0 unmatched, 5 claims settled, staking paid 1234.81 GP to 21 stakers — 34.9s
  [brain] Talisay Tari Club: 8 actions (3.1s)
  [brain] Ilonggo Ironworks: 0 actions (4.3s)
  [brain] Batangas Sprint Club: 7 actions (7.6s)
  [brain] Sugalan Social Club: 0 actions (9.0s)
  [brain] Cavite Bloodlines: 5 actions (12.7s)
  [brain] Pulang Bagwis: 11 actions (17.9s)
  [brain] Bagong Laban: 9 actions (21.9s)
  [brain] Cuchillos de Sonora: 14 actions (27.0s)
  [brain] Hacienda Verde: 0 actions (28.4s)
  [brain] Marco Gamefarm: 7 actions (31.6s)
Day 81 (Tuesday): 139 fights, 1 unmatched, 4 claims settled, staking paid 1096.21 GP to 21 stakers — 32.3s
  [brain] Hacienda Verde: 6 actions (3.8s)
  [brain] Cavite Bloodlines: 4 actions (7.8s)
  [brain] Batangas Sprint Club: 0 actions (9.4s)
  [brain] Pulang Bagwis: 16 actions (16.0s)
  [brain] Marco Gamefarm: 4 actions (20.5s)
  [brain] Sugalan Social Club: 2 actions (22.9s)
  [brain] Talisay Tari Club: 2 actions (25.6s)
  [brain] Ilonggo Ironworks: 6 actions (29.9s)
  [brain] Cuchillos de Sonora: 9 actions (36.0s)
  [brain] Bagong Laban: 8 actions (40.7s)
Day 82 (Wednesday): 95 fights, 2 unmatched, 5 claims settled, staking paid 1075.77 GP to 21 stakers — 41.4s
  [brain] Batangas Sprint Club: 9 actions (3.2s)
  [brain] Ilonggo Ironworks: 6 actions (7.4s)
  [brain] Hacienda Verde: 10 actions (11.3s)
  [brain] Sugalan Social Club: 0 actions (12.9s)
  [brain] Cavite Bloodlines: 9 actions (17.0s)
  [brain] Marco Gamefarm: 6 actions (20.4s)
  [brain] Cuchillos de Sonora: 0 actions (22.0s)
  [brain] Talisay Tari Club: 0 actions (23.5s)
  [brain] Bagong Laban: 0 actions (25.4s)
  [brain] Pulang Bagwis: 2 actions (27.3s)
Day 83 (Thursday): 47 fights, 2 unmatched, 2 claims settled, staking paid 1023.21 GP to 21 stakers — 28.1s
  [brain] Cuchillos de Sonora: 13 actions (4.2s)
  [brain] Pulang Bagwis: 9 actions (10.7s)
  [brain] Marco Gamefarm: 0 actions (12.8s)
  [brain] Bagong Laban: 16 actions (22.0s)
  [brain] Cavite Bloodlines: 6 actions (25.1s)
  [brain] Sugalan Social Club: 0 actions (26.5s)
  [brain] Batangas Sprint Club: 7 actions (29.3s)
  [brain] Talisay Tari Club: 7 actions (32.2s)
  [brain] Hacienda Verde: 6 actions (35.9s)
  [brain] Ilonggo Ironworks: 2 actions (37.8s)
Day 84 (Friday): 99 fights, 3 unmatched, 5 claims settled, staking paid 1027.80 GP to 21 stakers — HATCH FRIDAY (8 hatched) — 38.6s
        wk 12 · 7 days in 4:04 · avg 34.92s/day
  [brain] Talisay Tari Club: 0 actions (1.5s)
  [brain] Ilonggo Ironworks: 6 actions (5.0s)
  [brain] Cuchillos de Sonora: 0 actions (6.9s)
  [brain] Pulang Bagwis: 7 actions (10.5s)
  [brain] Marco Gamefarm: 2 actions (13.1s)
  [brain] Bagong Laban: 11 actions (18.1s)
  [brain] Hacienda Verde: 8 actions (21.8s)
  [brain] Cavite Bloodlines: 6 actions (26.4s)
  [brain] Batangas Sprint Club: 10 actions (30.0s)
  [brain] Sugalan Social Club: 0 actions (31.5s)
Day 85 (Saturday): 162 fights, 0 unmatched, 5 claims settled, staking paid 2012.61 GP to 21 stakers — 32.7s
  [brain] Bagong Laban: 14 actions (5.2s)
  [brain] Pulang Bagwis: 5 actions (9.0s)
  [brain] Ilonggo Ironworks: 5 actions (12.6s)
  [brain] Marco Gamefarm: 0 actions (14.4s)
  [brain] Hacienda Verde: 5 actions (17.4s)
  [brain] Cavite Bloodlines: 2 actions (19.5s)
  [brain] Talisay Tari Club: 7 actions (22.5s)
  [brain] Sugalan Social Club: 0 actions (23.9s)
  [brain] Batangas Sprint Club: 9 actions (28.0s)
  [brain] Cuchillos de Sonora: 0 actions (29.4s)
Day 86 (Sunday): 170 fights, 5 unmatched, 4 claims settled, staking paid 1320.99 GP to 21 stakers — 30.2s
  [brain] Bagong Laban: 0 actions (1.5s)
  [brain] Cuchillos de Sonora: 7 actions (6.3s)
  [brain] Marco Gamefarm: 5 actions (10.3s)
  [brain] Ilonggo Ironworks: 2 actions (12.3s)
  [brain] Pulang Bagwis: 7 actions (17.2s)
  [brain] Cavite Bloodlines: 5 actions (20.9s)
  [brain] Talisay Tari Club: 0 actions (22.5s)
  [brain] Hacienda Verde: 0 actions (23.9s)
  [brain] Sugalan Social Club: 0 actions (25.2s)
  [brain] Batangas Sprint Club: 8 actions (29.4s)
Day 87 (Monday): 183 fights, 0 unmatched, 5 claims settled, staking paid 1312.18 GP to 21 stakers — 30.3s
  [brain] Talisay Tari Club: 7 actions (5.0s)
  [brain] Marco Gamefarm: 18 actions (12.4s)
  [brain] Hacienda Verde: 5 actions (15.8s)
  [brain] Batangas Sprint Club: 0 actions (17.4s)
  [brain] Ilonggo Ironworks: 7 actions (22.1s)
  [brain] Cavite Bloodlines: 2 actions (24.3s)
  [brain] Sugalan Social Club: 0 actions (26.1s)
  [brain] Cuchillos de Sonora: 7 actions (30.8s)
  [brain] Bagong Laban: 18 actions (37.3s)
  [brain] Pulang Bagwis: 9 actions (42.1s)
Day 88 (Tuesday): 188 fights, 0 unmatched, 7 claims settled, staking paid 1112.23 GP to 21 stakers — 42.9s
  [brain] Hacienda Verde: 5 actions (3.1s)
  [brain] Marco Gamefarm: 8 actions (9.4s)
  [brain] Cavite Bloodlines: 5 actions (11.8s)
  [brain] Cuchillos de Sonora: 13 actions (16.7s)
  [brain] Bagong Laban: 11 actions (21.3s)
  [brain] Ilonggo Ironworks: 6 actions (24.5s)
  [brain] Sugalan Social Club: 9 actions (29.8s)
  [brain] Talisay Tari Club: 7 actions (34.3s)
  [brain] Batangas Sprint Club: 7 actions (38.5s)
  [brain] Pulang Bagwis: 2 actions (40.5s)
Day 89 (Wednesday): 203 fights, 0 unmatched, 4 claims settled, staking paid 1142.38 GP to 21 stakers — 41.3s
  [brain] Hacienda Verde: 0 actions (1.5s)
  [brain] Talisay Tari Club: 0 actions (3.0s)
  [brain] Marco Gamefarm: 0 actions (5.3s)
  [brain] Sugalan Social Club: 0 actions (7.0s)
  [brain] Cavite Bloodlines: 5 actions (9.9s)
  [brain] Cuchillos de Sonora: 0 actions (11.3s)
  [brain] Batangas Sprint Club: 0 actions (12.9s)
  [brain] Bagong Laban: 0 actions (14.8s)
  [brain] Ilonggo Ironworks: 6 actions (18.1s)
  [brain] Pulang Bagwis: 7 actions (23.1s)
Day 90 (Thursday): 66 fights, 6 unmatched, 2 claims settled, staking paid 1059.61 GP to 21 stakers — 23.8s
  [brain] Batangas Sprint Club: 0 actions (1.6s)
  [brain] Hacienda Verde: 8 actions (6.1s)
  [brain] Pulang Bagwis: 0 actions (8.5s)
  [brain] Talisay Tari Club: 0 actions (10.4s)
  [brain] Ilonggo Ironworks: 0 actions (12.3s)
  [brain] Cavite Bloodlines: 7 actions (17.6s)
  [brain] Cuchillos de Sonora: 8 actions (23.5s)
  [brain] Marco Gamefarm: 18 actions (33.5s)
  [brain] Bagong Laban: 0 actions (35.7s)
  [brain] Sugalan Social Club: 9 actions (39.6s)
Day 91 (Friday): 146 fights, 0 unmatched, 7 claims settled, staking paid 997.58 GP to 21 stakers — HATCH FRIDAY (7 hatched) — 40.5s
        wk 13 · 7 days in 4:02 · avg 34.54s/day

TIMING
  seed + bots      0.0s
  simulation      22:14   (35 day(s), avg 38.11s/day · honest 9% / tick 91%)
  brains          21:50   (37.42s/day · 98% of the run, 350 call(s), 28 failed)
  doctor           1.7s
  total           22:16
  slowest days d57 2:01 · d59 2:01 · d58 2:01
  per unit     163.66 ms/fight · 214.68 ms/entry

BARN CAREERS (durable actor state — persists across runs)
  bot-7     86 day(s) played · last day 90 · 370 proposed, 6 dropped, 0 failure(s) · 1499.9s thinking
  bot-8     87 day(s) played · last day 90 · 495 proposed, 27 dropped, 0 failure(s) · 1391.8s thinking
  bot-9     85 day(s) played · last day 90 · 497 proposed, 21 dropped, 1 failure(s) · 1497.8s thinking
  bot-marco  86 day(s) played · last day 90 · 422 proposed, 22 dropped, 0 failure(s) · 1494.4s thinking
  bot-12    86 day(s) played · last day 90 · 329 proposed, 6 dropped, 0 failure(s) · 1380.2s thinking
  bot-13    86 day(s) played · last day 90 · 308 proposed, 29 dropped, 0 failure(s) · 1446.4s thinking
  bot-14    87 day(s) played · last day 90 · 416 proposed, 33 dropped, 0 failure(s) · 1630.0s thinking
  bot-15    86 day(s) played · last day 90 · 445 proposed, 7 dropped, 0 failure(s) · 1621.0s thinking
  bot-16    86 day(s) played · last day 90 · 503 proposed, 17 dropped, 0 failure(s) · 1431.4s thinking
  bot-17    86 day(s) played · last day 90 · 485 proposed, 20 dropped, 0 failure(s) · 1516.9s thinking

PINTAKASI DOCTOR · data/sim-20260815-0419.db
day 91 · Friday, April 4, 3000 · week 13 · 21 farms · 1038 birds

INVARIANTS
  PASS  GP conservation            1,419,200.00 GP in world = 1,419,200.00 expected
  PASS  LT conservation            777,758.00 LT held = 777,758.00 LT ledgered
  PASS  no negative balances       staker 0.13 · juice 0.01 · 21 wallets clean
  PASS  pit figures                8150 fights · 8150 mirrored · 0 inversions
  PASS  purses settle              52 completed crown(s), exact to the cent
  PASS  no stranded entries        54 resolved championship(s), every entry settled
  PASS  one card per bird per day  6213 entries across 6213 bird-days · 0 over cap
  PASS  fight counts match the log 6213 settled entries · 14834 fights claimed · 0 mismatched
  PASS  scout book matches the log 2716 book lines audited · 0 out of step

CARD HEALTH
  6213 entries · 6066 fought · 147 unmatched (2.4%) · 764 lobbies
  weather timing  1530/5812 starred entries ran on the bird's own element day (26.3% vs 20.0% by chance, 1.32×) ✓ entries are being timed

GROUP STAGE
  fights per settled entry  mean 2.39 of 3 · 6213 settled entries
  full cards  3212 (51.7%) took all 3 · short 2854 (45.9%) fought 1–2 · 147 (2.4%) never fought
  groups  1857 dealt · mean 3.35 birds · 48 of one (48 were the lobby's only entry)

LOBBY FILL
  mean 8.13 birds per lobby · 764 lobbies · 48 held a single bird (6.3%)
      1 ██                       6.3%
    2-3 █████                    20.5%
    4-7 ███████                  27.6%
   8-15 ████████                 33.2%
    16+ ███                      12.3%
  same-barn-only lobbies 28 · 70 birds stranded with no cross-barn opponent

WORST LOBBY KEYS
  real/maiden/b2                       12 entries, 41.7% unmatched
  real/maiden/b4                       36 entries, 33.3% unmatched
  juvenile/claimer/b3@90               10 entries, 20.0% unmatched

POPULATION
  eggs 122 · active 414 · retired 502 · 21 farms
  by age  1:133  2:124  3:92  4:27  5:13  6:11  7:5  8:9
  supply  hatches 916 · gacha eggs 208 · covers 662
  loss    hardcore 457 · age 45
  barns   0 of 21 at capacity · 4 expansion(s) bought

FIGHT VOLUME
  wk  0       0  
  wk  1     496  ██████████
  wk  2     697  ██████████████
  wk  3     721  ███████████████
  wk  4     259  █████
  wk  5     164  ███
  wk  6     367  ████████
  wk  7     690  ██████████████
  wk  8     713  ███████████████
  wk  9     885  ██████████████████
  wk 10     904  ███████████████████
  wk 11     894  ██████████████████
  wk 12    1160  ████████████████████████
  wk 13     200  ████  (1 day)
  trough wk5 (164) = 22.7% of the wk3 peak (721) — EXPECTED: the age-3 founder flock is culled by the hardcore
  Majors before the first bred generation reaches fighting age, then volume
  recovers. Reference: wk3/4/5/6/7 = 1092/397/145/498/871 fights (20 farms, 91 days).

BLOODLINES
  gen   birds   mean grade     stars   home margin
  0       376   B+ ( 331.2)    1.82★      7.8
  1       527   B+ ( 350.7)    2.13★     13.6
  2       135   B+ ( 364.4)    2.37★     17.6
  gen 2 vs gen 0  +33.2 mean stat · +0.6★ · +9.8 pts of home margin

FIGHT ECONOMY BY RUNG
    rung                      fee  entries  share   GP risked   LT minted  LT/100GP
    juvenile/claimer@90        24      159   2.6%       2,800      399.54     14.27
    juvenile/maiden            30      157   2.5%       2,980      433.10     14.53
    juvenile/claimer@180       48      136   2.2%       4,928      781.08     15.85
    real/claimer@90            48      504   8.1%      18,464    2,938.45     15.91
    real/maiden                60      148   2.4%       4,720      760.69     16.12
    real/nw3                   60      219   3.5%       9,520    1,560.65     16.39
    juvenile/claimer@270       72      121   1.9%       6,096    1,023.83     16.80
    real/claimer@180           96      268   4.3%      20,288    3,594.75     17.72
    real/claimer@270          144      226   3.6%      23,616    4,434.30     18.78
    juvenile/open             150    1,795  28.9%     220,000   41,704.61     18.96
    real/open                 300    2,480  39.9%     623,200  131,473.00     21.10

LAND SUPPLY
  circulating 777,758.00 LT · 775,305.00 staked (99.7%) · 2,453.00 idle
  minted      799,558.00 LT over 92 day(s) · 8,690.85 LT per day
    purse_payout    516,000.00 LT   64.5%
    card_settled    189,104.00 LT   23.7%
    buy_land         91,000.00 LT   11.4%
    gacha             3,454.00 LT    0.4%
  burned      21,800.00 LT (2.7% of issuance) — the sinks
    stud_listed      16,800.00 LT   77.1%
    barn_expanded     5,000.00 LT   22.9%
  valuation   at $0.01/LT (pencilled) the world has issued $7,996 of land against $17,740 of GP faucet — $0.45 of LT per $1 of GP
  runway      100B-token target reached in 10,000+ year(s) at this population's rate — scales with farms, not with time

REPLAY
  202/202 sampled fight rows rebuild exactly from their seed

STAKER POOL
  paid out 99,072.47 GP over 91 day(s) · 0.13 waiting · 775,305.00 LT staked
  land_purchase 72,800.00 · gacha 14,552.00 · breed 10,592.00 · claim_rake 1,128.60

CHAMPIONSHIPS
  major     30 run / 0 cancelled · field 16.2 · purse 222,209.53
            paid 256/487 entrants (53%) · biggest take 2.4% of all purse GP · smallest 126.77 GP
            entry fees 77,920.00 GP fund 35% of the purse · the rest is juice (gacha + breed fees) · net to the field 144,289.53 GP
            under the door 21/256 winners (8%) took less purse than their entry fee
  juvenile  22 run / 2 cancelled · field 13.5 · purse 56,342.46
            paid 150/298 entrants (50%) · biggest take 6.1% of all purse GP · smallest 40.80 GP
            entry fees 14,304.00 GP fund 25% of the purse · the rest is juice (gacha + breed fees) · net to the field 42,038.46 GP
            under the door 1/150 winners (1%) took less purse than their entry fee

MECHANIC ADOPTION            farms of 21
  claims placed             20  ████████████████████░
  studs listed              11  ███████████░░░░░░░░░░
  land purchased             1  █░░░░░░░░░░░░░░░░░░░░
  paid gacha rolls          10  ██████████░░░░░░░░░░░
  gacha bundles bought       1  █░░░░░░░░░░░░░░░░░░░░
  barn expanded              3  ███░░░░░░░░░░░░░░░░░░
  Major entries             21  █████████████████████
  juvenile championship     11  ███████████░░░░░░░░░░

DISCOVERY
  age 1    carded 1191/5610 at the true best blade (21.2% vs random 20.0%) · 48.9% on or adjacent (random 47.7%) · answer coverage 33.6% · SCOUT 1065/1883 right (56.6% vs random 20.0%), 75.8% on or adjacent · clear home 740/1124 (65.8%, 79.2% adjacent)
  age 2–3  carded 2204/8307 at the true best blade (26.5% vs random 20.0%) · 53.7% on or adjacent (random 47.9%) · answer coverage 78.1% · SCOUT 2948/6486 right (45.5% vs random 20.0%), 70.5% on or adjacent · clear home 1905/3469 (54.9%, 73.9% adjacent)
  age 4+   carded 201/917 at the true best blade (21.9% vs random 20.0%) · 57.1% on or adjacent (random 49.3%) · answer coverage 62.6% · SCOUT 226/574 right (39.4% vs random 20.0%), 72.1% on or adjacent · clear home 138/320 (43.1%, 73.8% adjacent)
  explored  5/5 blades saw an age-1 entry in the discovery year
  flock shape  median home blade beats its runner-up by 11.4 pts · 54.7% of birds clear the 10-pt bar
  breeding  609 bot covers · hens carry +53.5 of their own shape (any bird: +69.0) · the sires chosen reinforce it by +61.5 (an unchosen sire: +7.0) · foals land at +50.0
  broodmare band  72.8% of 213 settled retired hens have ever carried · busiest hen 9 foals
  ✓ the scout beats chance on mature birds with a home — 43.1% vs 20.0%

0 warnings · 0 invariant failures

Done → /Users/plumeria/Repos/pintakasi-bloodlines/data/sim-20260815-0419.db
Run `bun dev:sim` and open http://localhost:3435/admin — it always shows the newest sim.
```

---

## Postmortem #3 — day 91 (2026-08-15, dawn)

World: `sim-20260815-0419` · 0 invariant failures · clean run, no host reaps.

## Final scoreboard

```
  scripted (10): total net worth 1,185,648 · avg 118,565 · crowns 36
  llm      (10): total net worth   704,188 · avg  70,419 · crowns 12
```

## The three-experiment arc

| Measure | Exp1 | Exp2 | Exp3 |
|---|---|---|---|
| llm avg net worth | 61,343 | 69,905 | **70,419** |
| llm/scripted ratio | 0.48 | 0.58 | **0.59** |
| llm crowns | 0 | 6 | **12 — every barn ≥1** |
| First llm crown | never | ~day 45 | day ≤28 |
| llm breeds | 2 | ~95 | ~50 |
| Best llm rank | 10 | 10 | 7 mid-run (bot-12, 3 crowns); 10–11 at close |

Every llm barn is now a champion — in exp1, none was, and the cause chain
is fully documented: blindness (no crown facts) → sight (instrument fix) →
declarations → wins, with each link measured in its own experiment.

## What exp3's specific changes did — and didn't

- The lifted fighter window (12→24) and reply budget (700→1400) did NOT
  move the model's gait: 4.6 proposals/day in segment 3, same as ever, max
  18. **The ceiling was never the instrument this time — it's the model's
  natural action budget.** A scripted bot happily writes 20+ actions; the
  30b converges on ~5 considered ones.
- Roster depth remains the wall, and now with a twist: crown brackets
  FORCE-RETIRE losers, so chasing championships with a shallow roster eats
  the roster. bot-12 finished rank 11 holding FOUR active birds (Kevin:
  81). The llm barns fight above their depth.

## The exp4 lever, when Zane wants it

The remaining gap is a volume/depth war the current prompt shape can't
win at ~5 actions/day. Candidate levers, in rough order of promise:
1. **Structured volume**: make the ask per-domain ("for EACH fighter in
   your brief, enter or say why not") or two-pass (card pass + economy
   pass) — turns the ~5-action gait into a per-bird checklist.
2. **Protect the roster**: teach hardcore/crown risk (force-retirement) so
   depth survives the crown chase; pair with heavier breeding.
3. Bigger local model for the player, or Haiku-class hosted for an arm.
