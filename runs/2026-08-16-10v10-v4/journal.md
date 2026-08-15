# The 10v10 v4 journal — one continuous read

Experiment #4 (2026-08-16): exp3's build plus the postmortem's two levers —
A GOOD DAY walks the fighters list bird by bird ("12 fighters means ~12
enters"), and the instrument finally tells the barns what the game always
knew: Majors force-retire their losers, so a crown declaration should have
a bred replacement behind it. Same split, seed, model, segments, coach
cadence. This experiment also hosted the envoy-bug repro session at its
day-28 boundary (`rivet-repro-session.md`).

---

## Segment 1 — days 1–28 (verbatim sim log)

```
$ bun run scripts/simulate.ts "28" "--seed=1" "--brain=qwen3:30b-a3b" "--llm=bot-7,bot-15,bot-marco,bot-9,bot-8,bot-16,bot-14,bot-12,bot-13,bot-17" --actors "--personas=championship"
Fresh world seeded at /Users/plumeria/Repos/pintakasi-bloodlines/data/sim-20260815-1255.db — day 0, Friday

Brain: qwen3:30b-a3b plays 10 stable(s) — bot-7, bot-15, bot-marco, bot-9, bot-8, bot-16, bot-14, bot-12, bot-13, bot-17

Personas set: 10 barn(s) start under the championship creeds

  [brain] Batangas Sprint Club: 2 actions (14.1s)
  [brain] Sugalan Social Club: 1 actions (15.1s)
  [brain] Ilonggo Ironworks: 1 actions (15.9s)
  [brain] Marco Gamefarm: 0 actions (16.6s)
  [brain] Bagong Laban: 0 actions (17.4s)
  [brain] Hacienda Verde: 1 actions (18.2s)
  [brain] Cavite Bloodlines: 0 actions (18.9s)
  [brain] Cuchillos de Sonora: 0 actions (19.6s)
  [brain] Pulang Bagwis: 0 actions (20.3s)
  [brain] Talisay Tari Club: 0 actions (21.0s)
Day 1 (Saturday): 0 fights, 0 unmatched, 0 claims settled, staking paid 831.90 GP to 11 stakers — 21.1s
  [brain] Batangas Sprint Club: 2 actions, 7 dropped (3.6s)
          ✗ 1× crown: unknown bird #3
          ✗ 1× enter: unknown bird #3
          ✗ 1× enter: unknown bird #2
          ✗ 1× enter: unknown bird #1
          ✗ 1× enter: unknown bird #0
          ✗ 1× list_stud: unknown bird #4
          ✗ 1× list_stud: unknown bird #5
  [brain] Marco Gamefarm: 0 actions (4.3s)
  [brain] Sugalan Social Club: 0 actions (5.0s)
  [brain] Cavite Bloodlines: 1 actions, 14 dropped (9.9s)
          ✗ 14× enter: unknown bird #3
  [brain] Bagong Laban: 0 actions (10.7s)
  [brain] Hacienda Verde: 2 actions (11.6s)
  [brain] Pulang Bagwis: 2 actions (12.6s)
  [brain] Cuchillos de Sonora: 0 actions (13.3s)
  [brain] Talisay Tari Club: 0 actions (14.0s)
  [brain] Ilonggo Ironworks: 0 actions (14.7s)
Day 2 (Sunday): 0 fights, 0 unmatched, 0 claims settled, staking paid 1760.05 GP to 12 stakers — 14.9s
  [brain] Talisay Tari Club: 1 actions (1.1s)
  [brain] Pulang Bagwis: 2 actions, 12 dropped (8.5s)
          ✗ 1× crown: unknown bird #5
          ✗ 1× enter: unknown bird #3
          ✗ 1× enter: unknown bird #4
          ✗ 1× enter: unknown bird #6
          ✗ 1× enter: unknown bird #7
          ✗ 1× enter: unknown bird #8
          ✗ 1× enter: unknown bird #9
          ✗ 1× enter: unknown bird #10
          ✗ 1× enter: unknown bird #11
          ✗ 1× enter: unknown bird #12
          ✗ 1× enter: unknown bird #13
          ✗ 1× enter: unknown bird #14
  [brain] Bagong Laban: 2 actions, 14 dropped (13.9s)
          ✗ 1× crown: unknown bird #7
          ✗ 1× enter: unknown bird #1
          ✗ 1× enter: unknown bird #2
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
          ✗ 1× list_stud: unknown bird #13
  [brain] Cavite Bloodlines: 2 actions, 15 dropped (19.0s)
          ✗ 1× crown: unknown bird #1
          ✗ 1× enter: unknown bird #2
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
          ✗ 1× list_stud: unknown bird #15
  [brain] Marco Gamefarm: 1 actions, 13 dropped (23.9s)
          ✗ 12× enter: unknown bird #3
          ✗ 1× list_stud: unknown bird #3
  [brain] Hacienda Verde: 0 actions (24.6s)
  [brain] Batangas Sprint Club: 0 actions (25.3s)
  [brain] Ilonggo Ironworks: 0 actions (26.1s)
  [brain] Cuchillos de Sonora: 2 actions, 11 dropped (30.5s)
          ✗ 10× enter: unknown bird #3
          ✗ 1× crown: unknown bird #3
  [brain] Sugalan Social Club: 0 actions (31.2s)
Day 3 (Monday): 0 fights, 0 unmatched, 0 claims settled, staking paid 855.95 GP to 14 stakers — 31.3s
  [brain] Ilonggo Ironworks: 2 actions, 15 dropped (5.5s)
          ✗ 1× crown: unknown bird #1
          ✗ 1× enter: unknown bird #2
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
  [brain] Talisay Tari Club: 2 actions (6.4s)
  [brain] Sugalan Social Club: 0 actions (7.1s)
  [brain] Cavite Bloodlines: 1 actions (7.9s)
  [brain] Cuchillos de Sonora: 2 actions (8.9s)
  [brain] Hacienda Verde: 0 actions (9.6s)
  [brain] Pulang Bagwis: 1 actions, 2 dropped (11.4s)
          ✗ 1× list_stud: unknown bird #3
          ✗ 1× crown: unknown bird #3
  [brain] Bagong Laban: 2 actions, 3 dropped (13.3s)
          ✗ 1× crown: unknown bird #3
          ✗ 1× enter: unknown bird #3
          ✗ 1× list_stud: unknown bird #3
  [brain] Batangas Sprint Club: 0 actions (14.0s)
  [brain] Marco Gamefarm: 0 actions (14.8s)
Day 4 (Tuesday): 0 fights, 0 unmatched, 0 claims settled, staking paid 840.08 GP to 17 stakers — 14.9s
  [brain] Bagong Laban: 1 actions, 13 dropped (5.1s)
          ✗ 1× enter: unknown bird #2
          ✗ 1× enter: unknown bird #3
          ✗ 1× enter: unknown bird #5
          ✗ 1× enter: unknown bird #7
          ✗ 1× enter: unknown bird #12
          ✗ 1× enter: unknown bird #13
          ✗ 1× enter: unknown bird #14
          ✗ 1× enter: unknown bird #16
          ✗ 1× enter: unknown bird #17
          ✗ 1× enter: unknown bird #19
          ✗ 1× enter: unknown bird #20
          ✗ 1× enter: unknown bird #22
          ✗ 1× enter: unknown bird #23
  [brain] Marco Gamefarm: 2 actions, 15 dropped (13.9s)
          ✗ 1× crown: unknown bird #2
          ✗ 1× enter: unknown bird #1
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
  [brain] Ilonggo Ironworks: 0 actions (14.6s)
  [brain] Cavite Bloodlines: 2 actions, 9 dropped (21.3s)
          ✗ 1× crown: unknown bird #3
          ✗ 1× enter: unknown bird #3
          ✗ 1× enter: unknown bird #4
          ✗ 1× enter: unknown bird #5
          ✗ 1× enter: unknown bird #6
          ✗ 1× enter: unknown bird #7
          ✗ 1× enter: unknown bird #8
          ✗ 1× enter: unknown bird #9
          ✗ 1× enter: unknown bird #10
  [brain] Hacienda Verde: 0 actions (22.0s)
  [brain] Pulang Bagwis: 2 actions, 3 dropped (24.3s)
          ✗ 1× crown: unknown bird #3
          ✗ 1× enter: unknown bird #3
          ✗ 1× list_stud: unknown bird #3
  [brain] Sugalan Social Club: 0 actions (25.2s)
  [brain] Talisay Tari Club: 0 actions (25.9s)
  [brain] Batangas Sprint Club: 2 actions, 3 dropped (27.5s)
          ✗ 1× list_stud: unknown bird #3
          ✗ 1× crown: unknown bird #3
          ✗ 1× enter: unknown bird #3
  [brain] Cuchillos de Sonora: 1 actions (28.5s)
Day 5 (Wednesday): 0 fights, 0 unmatched, 0 claims settled, staking paid 1095.91 GP to 19 stakers — 28.6s
  [brain] Pulang Bagwis: 2 actions, 27 dropped (11.9s)
          ✗ 27× enter: unknown bird #3
  [brain] Cavite Bloodlines: 0 actions (12.6s)
  [brain] Hacienda Verde: 2 actions, 13 dropped (21.2s)
          ✗ 12× enter: unknown bird #3
          ✗ 1× crown: unknown bird #3
  [brain] Talisay Tari Club: 0 actions (21.9s)
  [brain] Cuchillos de Sonora: 1 actions (22.8s)
  [brain] Ilonggo Ironworks: 0 actions (23.5s)
  [brain] Marco Gamefarm: 0 actions (24.2s)
  [brain] Bagong Laban: 2 actions (25.1s)
  [brain] Batangas Sprint Club: 2 actions, 14 dropped (29.9s)
          ✗ 1× crown: unknown bird #3
          ✗ 1× enter: unknown bird #1
          ✗ 1× enter: unknown bird #2
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
  [brain] Sugalan Social Club: 2 actions, 5 dropped (33.5s)
          ✗ 1× crown: unknown bird #3
          ✗ 1× enter: unknown bird #1
          ✗ 1× enter: unknown bird #2
          ✗ 1× enter: unknown bird #3
          ✗ 1× list_stud: unknown bird #4
Day 6 (Thursday): 0 fights, 0 unmatched, 0 claims settled, staking paid 920.01 GP to 20 stakers — 33.6s
  [brain] Talisay Tari Club: 2 actions (1.1s)
  [brain] Cavite Bloodlines: 0 actions (1.8s)
  [brain] Sugalan Social Club: 0 actions (2.5s)
  [brain] Marco Gamefarm: 2 actions, 3 dropped (5.0s)
          ✗ 1× crown: unknown bird #3
          ✗ 1× enter: unknown bird #3
          ✗ 1× list_stud: unknown bird #3
  [brain] Hacienda Verde: 0 actions (5.6s)
  [brain] Pulang Bagwis: 0 actions (6.3s)
  [brain] Batangas Sprint Club: 0 actions (7.0s)
  [brain] Ilonggo Ironworks: 0 actions (7.7s)
  [brain] Bagong Laban: 0 actions (8.3s)
  [brain] Cuchillos de Sonora: 3 actions, 4 dropped (10.6s)
          ✗ 3× enter: unknown bird #3
          ✗ 1× crown: unknown bird #3
Day 7 (Friday): 0 fights, 0 unmatched, 0 claims settled, staking paid 840.04 GP to 21 stakers — HATCH FRIDAY (8 hatched) — 10.7s
        wk 1 · 7 days in 2:35 · avg 22.15s/day
  [brain] Ilonggo Ironworks: 0 actions (1.4s)
  [brain] Bagong Laban: 12 actions (5.9s)
  [brain] Hacienda Verde: 13 actions (11.3s)
  [brain] Cavite Bloodlines: 11 actions (15.3s)
  [brain] Pulang Bagwis: 12 actions (20.2s)
  [brain] Sugalan Social Club: 11 actions (24.0s)
  [brain] Cuchillos de Sonora: 12 actions (28.2s)
  [brain] Talisay Tari Club: 11 actions (35.3s)
  [brain] Batangas Sprint Club: 0 actions (36.6s)
  [brain] Marco Gamefarm: 2 actions (38.0s)
Day 8 (Saturday): 76 fights, 0 unmatched, 3 claims settled, staking paid 986.75 GP to 21 stakers — 38.3s
  [brain] Sugalan Social Club: 19 actions (5.4s)
  [brain] Pulang Bagwis: 0 actions (6.6s)
  [brain] Cavite Bloodlines: 10 actions (10.2s)
  [brain] Marco Gamefarm: 12 actions (14.2s)
  [brain] Batangas Sprint Club: 11 actions (18.3s)
  [brain] Ilonggo Ironworks: 2 actions (19.8s)
  [brain] Talisay Tari Club: 0 actions (20.9s)
  [brain] Hacienda Verde: 12 actions (25.1s)
  [brain] Cuchillos de Sonora: 13 actions (32.0s)
  [brain] Bagong Laban: 0 actions (33.2s)
Day 9 (Sunday): 102 fights, 0 unmatched, 4 claims settled, staking paid 941.61 GP to 21 stakers — 33.6s
  [brain] Bagong Laban: 0 actions (1.4s)
  [brain] Batangas Sprint Club: 12 actions (5.7s)
  [brain] Cuchillos de Sonora: 11 actions (9.6s)
  [brain] Ilonggo Ironworks: 0 actions (10.7s)
  [brain] Pulang Bagwis: 2 actions (12.1s)
  [brain] Marco Gamefarm: 0 actions (13.3s)
  [brain] Hacienda Verde: 0 actions (14.6s)
  [brain] Talisay Tari Club: 0 actions (15.7s)
  [brain] Cavite Bloodlines: 11 actions (19.6s)
  [brain] Sugalan Social Club: 11 actions (25.7s)
Day 10 (Monday): 67 fights, 0 unmatched, 2 claims settled, staking paid 931.60 GP to 21 stakers — 26.0s
  [brain] Cuchillos de Sonora: 0 actions (1.7s)
  [brain] Sugalan Social Club: 12 actions (8.3s)
  [brain] Talisay Tari Club: 11 actions (14.5s)
  [brain] Pulang Bagwis: 15 actions (19.3s)
  [brain] Marco Gamefarm: 12 actions (23.6s)
  [brain] Hacienda Verde: 0 actions (24.9s)
  [brain] Ilonggo Ironworks: 13 actions (29.4s)
  [brain] Cavite Bloodlines: 11 actions (33.4s)
  [brain] Bagong Laban: 0 actions (34.6s)
  [brain] Batangas Sprint Club: 13 actions (41.7s)
Day 11 (Tuesday): 78 fights, 0 unmatched, 8 claims settled, staking paid 916.76 GP to 21 stakers — 42.0s
  [brain] Batangas Sprint Club: 0 actions (1.4s)
  [brain] Pulang Bagwis: 14 actions (7.0s)
  [brain] Hacienda Verde: 11 actions (10.9s)
  [brain] Cavite Bloodlines: 0 actions (12.1s)
  [brain] Sugalan Social Club: 11 actions (18.1s)
  [brain] Cuchillos de Sonora: 2 actions (19.5s)
  [brain] Bagong Laban: 10 actions (24.0s)
  [brain] Talisay Tari Club: 10 actions (27.8s)
  [brain] Marco Gamefarm: 0 actions (28.9s)
  [brain] Ilonggo Ironworks: 12 actions (33.7s)
Day 12 (Wednesday): 88 fights, 0 unmatched, 4 claims settled, staking paid 877.59 GP to 21 stakers — 34.1s
  [brain] Marco Gamefarm: 1 actions (1.5s)
  [brain] Bagong Laban: 12 actions (5.9s)
  [brain] Batangas Sprint Club: 3 actions (8.1s)
  [brain] Ilonggo Ironworks: 0 actions (9.6s)
  [brain] Sugalan Social Club: 3 actions (11.5s)
  [brain] Hacienda Verde: 12 actions (15.9s)
  [brain] Talisay Tari Club: 0 actions (17.2s)
  [brain] Cuchillos de Sonora: 0 actions (18.7s)
  [brain] Pulang Bagwis: 3 actions (21.0s)
  [brain] Cavite Bloodlines: 12 actions (26.3s)
Day 13 (Thursday): 45 fights, 2 unmatched, 4 claims settled, staking paid 1047.28 GP to 21 stakers — 26.8s
  [brain] Sugalan Social Club: 2 actions (1.6s)
  [brain] Pulang Bagwis: 14 actions (6.6s)
  [brain] Marco Gamefarm: 11 actions (13.9s)
  [brain] Cuchillos de Sonora: 0 actions (15.2s)
  [brain] Ilonggo Ironworks: 13 actions (20.2s)
  [brain] Hacienda Verde: 0 actions (21.4s)
  [brain] Talisay Tari Club: 1 actions (22.8s)
  [brain] Batangas Sprint Club: 0 actions (24.2s)
  [brain] Bagong Laban: 0 actions (25.6s)
  [brain] Cavite Bloodlines: 0 actions (26.9s)
Day 14 (Friday): 83 fights, 1 unmatched, 3 claims settled, staking paid 858.76 GP to 21 stakers — HATCH FRIDAY (2 hatched) — 27.3s
        wk 2 · 7 days in 3:48 · avg 32.56s/day
  [brain] Ilonggo Ironworks: 14 actions (7.9s)
  [brain] Talisay Tari Club: 1 actions (9.5s)
  [brain] Bagong Laban: 18 actions (15.1s)
  [brain] Pulang Bagwis: 0 actions (16.6s)
  [brain] Hacienda Verde: 15 actions (21.9s)
  [brain] Marco Gamefarm: 12 actions (26.3s)
  [brain] Batangas Sprint Club: 12 actions (31.3s)
  [brain] Cavite Bloodlines: 0 actions (32.6s)
  [brain] Cuchillos de Sonora: 13 actions (37.5s)
  [brain] Sugalan Social Club: 0 actions (39.0s)
Day 15 (Saturday): 155 fights, 0 unmatched, 6 claims settled, staking paid 998.40 GP to 21 stakers — 39.4s
  [brain] Sugalan Social Club: 3 actions (1.9s)
  [brain] Marco Gamefarm: 0 actions (3.3s)
  [brain] Hacienda Verde: 13 actions (8.4s)
  [brain] Talisay Tari Club: 1 actions (9.8s)
  [brain] Ilonggo Ironworks: 13 actions (14.7s)
  [brain] Pulang Bagwis: 2 actions (16.4s)
  [brain] Cuchillos de Sonora: 13 actions (22.2s)
  [brain] Cavite Bloodlines: 1 actions (23.6s)
  [brain] Bagong Laban: 12 actions (28.2s)
  [brain] Batangas Sprint Club: 2 actions (29.8s)
Day 16 (Sunday): 94 fights, 0 unmatched, 3 claims settled, staking paid 913.03 GP to 21 stakers — 30.1s
  [brain] Talisay Tari Club: 0 actions (1.7s)
  [brain] Sugalan Social Club: 11 actions (6.1s)
  [brain] Pulang Bagwis: 16 actions (13.6s)
  [brain] Hacienda Verde: 14 actions (19.9s)
  [brain] Cuchillos de Sonora: 0 actions (21.5s)
  [brain] Bagong Laban: 0 actions (23.2s)
  [brain] Ilonggo Ironworks: 13 actions (28.3s)
  [brain] Batangas Sprint Club: 12 actions (35.4s)
  [brain] Marco Gamefarm: 1 actions (37.0s)
  [brain] Cavite Bloodlines: 19 actions (43.0s)
Day 17 (Monday): 100 fights, 0 unmatched, 3 claims settled, staking paid 848.98 GP to 21 stakers — 43.3s
  [brain] Talisay Tari Club: 2 actions (2.0s)
  [brain] Batangas Sprint Club: 12 actions (6.3s)
  [brain] Pulang Bagwis: 2 actions (8.2s)
  [brain] Bagong Laban: 0 actions (9.6s)
  [brain] Cuchillos de Sonora: 12 actions (14.0s)
  [brain] Sugalan Social Club: 1 actions (15.4s)
  [brain] Ilonggo Ironworks: 13 actions (20.5s)
  [brain] Cavite Bloodlines: 12 actions (27.2s)
  [brain] Hacienda Verde: 2 actions (29.0s)
  [brain] Marco Gamefarm: 11 actions (35.4s)
Day 18 (Tuesday): 99 fights, 11 unmatched, 2 claims settled, staking paid 1018.83 GP to 21 stakers — 35.8s
  [brain] Cuchillos de Sonora: 12 actions (7.3s)
  [brain] Ilonggo Ironworks: 14 actions (14.0s)
  [brain] Bagong Laban: 14 actions (19.3s)
  [brain] Pulang Bagwis: 2 actions (21.2s)
  [brain] Hacienda Verde: 0 actions (23.0s)
  [brain] Cavite Bloodlines: 0 actions (24.6s)
  [brain] Batangas Sprint Club: 1 actions (26.2s)
  [brain] Talisay Tari Club: 2 actions (27.9s)
  [brain] Sugalan Social Club: 12 actions (32.5s)
  [brain] Marco Gamefarm: 12 actions (37.5s)
Day 19 (Wednesday): 141 fights, 2 unmatched, 6 claims settled, staking paid 859.76 GP to 21 stakers — 38.0s
  [brain] Hacienda Verde: 14 actions (5.5s)
  [brain] Ilonggo Ironworks: 13 actions (14.5s)
  [brain] Pulang Bagwis: 15 actions (20.7s)
  [brain] Cavite Bloodlines: 12 actions (25.1s)
  [brain] Talisay Tari Club: 10 actions (29.1s)
  [brain] Sugalan Social Club: 0 actions (30.3s)
  [brain] Marco Gamefarm: 0 actions (31.7s)
  [brain] Bagong Laban: 0 actions (33.2s)
  [brain] Cuchillos de Sonora: 0 actions (34.7s)
  [brain] Batangas Sprint Club: 1 actions (36.2s)
Day 20 (Thursday): 66 fights, 2 unmatched, 2 claims settled, staking paid 851.62 GP to 21 stakers — 36.5s
  [brain] Batangas Sprint Club: 11 actions (7.8s)
  [brain] Marco Gamefarm: 12 actions (15.0s)
  [brain] Hacienda Verde: 0 actions (16.7s)
  [brain] Talisay Tari Club: 12 actions (22.5s)
  [brain] Cuchillos de Sonora: 12 actions (29.4s)
  [brain] Sugalan Social Club: 12 actions (34.6s)
  [brain] Pulang Bagwis: 0 actions (36.6s)
  [brain] Cavite Bloodlines: 12 actions (45.0s)
  [brain] Bagong Laban: 0 actions (46.7s)
  [brain] Ilonggo Ironworks: 0 actions (48.9s)
Day 21 (Friday): 126 fights, 1 unmatched, 11 claims settled, staking paid 878.57 GP to 21 stakers — HATCH FRIDAY (0 hatched) — 49.4s
        wk 3 · 7 days in 4:32 · avg 38.92s/day
  [brain] Batangas Sprint Club: 0 actions (2.0s)
  [brain] Pulang Bagwis: 16 actions (9.8s)
  [brain] Marco Gamefarm: 2 actions (11.8s)
  [brain] Talisay Tari Club: 12 actions (16.7s)
  [brain] Cavite Bloodlines: 11 actions (21.3s)
  [brain] Hacienda Verde: 0 actions (23.4s)
  [brain] Cuchillos de Sonora: 14 actions (30.7s)
  [brain] Ilonggo Ironworks: 0 actions (32.7s)
  [brain] Sugalan Social Club: 1 actions (34.8s)
  [brain] Bagong Laban: 14 actions (39.9s)
Day 22 (Saturday): 160 fights, 2 unmatched, 9 claims settled, staking paid 855.41 GP to 21 stakers — 40.5s
  [brain] Bagong Laban: 12 actions (4.7s)
  [brain] Ilonggo Ironworks: 14 actions (12.9s)
  [brain] Hacienda Verde: 14 actions (19.9s)
  [brain] Talisay Tari Club: 0 actions (21.4s)
  [brain] Sugalan Social Club: 0 actions (23.2s)
  [brain] Cavite Bloodlines: 11 actions (27.6s)
  [brain] Marco Gamefarm: 0 actions (28.9s)
  [brain] Batangas Sprint Club: 15 actions (37.1s)
  [brain] Cuchillos de Sonora: 14 actions (45.7s)
  [brain] Pulang Bagwis: 0 actions (47.5s)
Day 23 (Sunday): 132 fights, 1 unmatched, 6 claims settled, staking paid 1221.61 GP to 21 stakers — 48.0s
  [brain] Talisay Tari Club: 11 actions (7.0s)
  [brain] Batangas Sprint Club: 0 actions (9.2s)
  [brain] Pulang Bagwis: 15 actions (18.7s)
  [brain] Bagong Laban: 0 actions (20.5s)
  [brain] Ilonggo Ironworks: 0 actions (22.5s)
  [brain] Cuchillos de Sonora: 15 actions (29.8s)
  [brain] Marco Gamefarm: 12 actions (37.1s)
  [brain] Cavite Bloodlines: 10 actions (41.7s)
  [brain] Hacienda Verde: 13 actions (47.2s)
  [brain] Sugalan Social Club: 3 actions (49.8s)
Day 24 (Monday): 111 fights, 1 unmatched, 6 claims settled, staking paid 948.79 GP to 21 stakers — 50.2s
  [brain] Marco Gamefarm: 0 actions (1.6s)
  [brain] Ilonggo Ironworks: 13 actions (6.8s)
  [brain] Batangas Sprint Club: 0 actions (8.7s)
  [brain] Bagong Laban: 14 actions (16.7s)
  [brain] Talisay Tari Club: 12 actions (24.3s)
  [brain] Cuchillos de Sonora: 13 actions (29.7s)
  [brain] Hacienda Verde: 14 actions (35.4s)
  [brain] Pulang Bagwis: 0 actions (37.2s)
  [brain] Cavite Bloodlines: 10 actions (41.4s)
  [brain] Sugalan Social Club: 11 actions (48.3s)
Day 25 (Tuesday): 128 fights, 0 unmatched, 5 claims settled, staking paid 960.99 GP to 21 stakers — 48.7s
  [brain] Sugalan Social Club: 0 actions (1.6s)
  [brain] Pulang Bagwis: 0 actions (3.6s)
  [brain] Cavite Bloodlines: 0 actions (5.2s)
  [brain] Ilonggo Ironworks: 3 actions (7.5s)
  [brain] Hacienda Verde: 13 actions (13.1s)
  [brain] Marco Gamefarm: 0 actions (14.7s)
  [brain] Cuchillos de Sonora: 13 actions (21.6s)
  [brain] Bagong Laban: 1 actions (23.2s)
  [brain] Batangas Sprint Club: 14 actions (32.1s)
  [brain] Talisay Tari Club: 12 actions (37.9s)
Day 26 (Wednesday): 139 fights, 0 unmatched, 4 claims settled, staking paid 855.23 GP to 21 stakers — 38.3s
  [brain] Batangas Sprint Club: 0 actions (2.0s)
  [brain] Bagong Laban: 0 actions (3.8s)
  [brain] Pulang Bagwis: 15 actions (11.4s)
  [brain] Hacienda Verde: 13 actions (17.3s)
  [brain] Ilonggo Ironworks: 15 actions (26.0s)
  [brain] Talisay Tari Club: 0 actions (27.5s)
  [brain] Cavite Bloodlines: 2 actions (29.5s)
  [brain] Cuchillos de Sonora: 15 actions (35.3s)
  [brain] Marco Gamefarm: 0 actions (36.8s)
  [brain] Sugalan Social Club: 0 actions (38.4s)
Day 27 (Thursday): 66 fights, 0 unmatched, 4 claims settled, staking paid 1008.97 GP to 21 stakers — 38.8s
  [brain] Marco Gamefarm: 0 actions (1.6s)
  [brain] Batangas Sprint Club: 15 actions (8.5s)
  [brain] Pulang Bagwis: 16 actions (18.3s)
  [brain] Hacienda Verde: 0 actions (19.9s)
  [brain] Cavite Bloodlines: 10 actions (26.0s)
  [brain] Bagong Laban: 0 actions (27.3s)
  [brain] Sugalan Social Club: 12 actions (32.8s)
  [brain] Ilonggo Ironworks: 13 actions (37.8s)
  [brain] Cuchillos de Sonora: 14 actions (43.4s)
  [brain] Talisay Tari Club: 11 actions (47.8s)
Day 28 (Friday): 33 fights, 0 unmatched, 1 claims settled, staking paid 1257.81 GP to 21 stakers — HATCH FRIDAY (0 hatched) — 48.4s
        wk 4 · 7 days in 5:13 · avg 44.71s/day

TIMING
  seed + bots      0.0s
  simulation      16:11   (28 day(s), avg 34.67s/day · honest 8% / tick 92%)
  brains          16:01   (34.31s/day · 99% of the run, 280 call(s), 0 failed)
  doctor           0.5s
  total           16:11
  slowest days d24 50.2s · d21 49.4s · d25 48.7s
  per unit     435.50 ms/fight · 603.69 ms/entry

BARN CAREERS (durable actor state — persists across runs)
  bot-7     28 day(s) played · last day 27 · 124 proposed, 0 dropped, 0 failure(s) · 530.6s thinking
  bot-8     28 day(s) played · last day 27 · 207 proposed, 15 dropped, 0 failure(s) · 662.1s thinking
  bot-9     28 day(s) played · last day 27 · 171 proposed, 38 dropped, 0 failure(s) · 648.9s thinking
  bot-marco  28 day(s) played · last day 27 · 105 proposed, 31 dropped, 0 failure(s) · 555.0s thinking
  bot-12    28 day(s) played · last day 27 · 142 proposed, 24 dropped, 0 failure(s) · 529.8s thinking
  bot-13    28 day(s) played · last day 27 · 178 proposed, 13 dropped, 0 failure(s) · 537.6s thinking
  bot-14    28 day(s) played · last day 27 · 138 proposed, 5 dropped, 0 failure(s) · 602.8s thinking
  bot-15    28 day(s) played · last day 27 · 181 proposed, 15 dropped, 0 failure(s) · 527.9s thinking
  bot-16    28 day(s) played · last day 27 · 168 proposed, 44 dropped, 0 failure(s) · 467.8s thinking
  bot-17    28 day(s) played · last day 27 · 126 proposed, 30 dropped, 0 failure(s) · 535.7s thinking

PINTAKASI DOCTOR · data/sim-20260815-1255.db
day 28 · Friday, January 31, 3000 · week 4 · 21 farms · 230 birds

INVARIANTS
  PASS  GP conservation            559,200.00 GP in world = 559,200.00 expected
  PASS  LT conservation            147,914.48 LT held = 147,914.48 LT ledgered
  PASS  no negative balances       staker 0.11 · juice 0.01 · 21 wallets clean
  PASS  pit figures                2229 fights · 2229 mirrored · 0 inversions
  PASS  purses settle              8 completed crown(s), exact to the cent
  PASS  no stranded entries        9 resolved championship(s), every entry settled
  PASS  one card per bird per day  1608 entries across 1608 bird-days · 0 over cap
  PASS  fight counts match the log 1608 settled entries · 4178 fights claimed · 0 mismatched
  PASS  scout book matches the log 687 book lines audited · 0 out of step

CARD HEALTH
  1608 entries · 1585 fought · 23 unmatched (1.4%) · 144 lobbies
  weather timing  367/1305 starred entries ran on the bird's own element day (28.1% vs 20.0% by chance, 1.41×) ✓ entries are being timed

GROUP STAGE
  fights per settled entry  mean 2.60 of 3 · 1608 settled entries
  full cards  1080 (67.2%) took all 3 · short 505 (31.4%) fought 1–2 · 23 (1.4%) never fought
  groups  457 dealt · mean 3.52 birds · 7 of one (7 were the lobby's only entry)

LOBBY FILL
  mean 11.17 birds per lobby · 144 lobbies · 7 held a single bird (4.9%)
      1 █                        4.9%
    2-3 █████                    22.2%
    4-7 ████                     17.4%
   8-15 ██████                   25.0%
    16+ ███████                  30.6%
  same-barn-only lobbies 5 · 16 birds stranded with no cross-barn opponent

WORST LOBBY KEYS
  real/maiden/b1                       16 entries, 50.0% unmatched
  juvenile/maiden/b1                   10 entries, 10.0% unmatched
  juvenile/open/b5                     77 entries, 5.2% unmatched

POPULATION
  eggs 0 · active 137 · retired 93 · 21 farms
  by age  1:14  2:14  3:14  4:95
  supply  hatches 230 · gacha eggs 62 · covers 0
  loss    hardcore 93
  barns   0 of 21 at capacity · 0 expansion(s) bought

FIGHT VOLUME
  wk  0       0  
  wk  1     496  ██████████████
  wk  2     742  █████████████████████
  wk  3     865  ████████████████████████
  wk  4     126  ███  (1 day)

BLOODLINES
  gen   birds   mean grade     stars   home margin
  0       230   B+ ( 331.6)    1.33★      8.8
  · nothing has been bred yet — every bird in the world is a founder

FIGHT ECONOMY BY RUNG
    rung                      fee  entries  share   GP risked   LT minted  LT/100GP
    juvenile/claimer@90        24       29   1.8%         560       80.62     14.40
    juvenile/maiden            30       41   2.5%         780      113.85     14.60
    juvenile/claimer@180       48       33   2.1%       1,440      232.68     16.16
    real/claimer@90            48      146   9.1%       5,696      909.08     15.96
    real/maiden                60       24   1.5%         760      125.72     16.54
    real/nw3                   60       38   2.4%       1,880      311.22     16.55
    juvenile/claimer@270       72       21   1.3%       1,152      194.28     16.86
    real/claimer@180           96       85   5.3%       7,360    1,319.41     17.93
    real/claimer@270          144       48   3.0%       5,664    1,068.54     18.87
    juvenile/open             150      363  22.6%      45,100    8,591.66     19.05
    real/open                 300      780  48.5%     215,400   45,910.42     21.31

LAND SUPPLY
  circulating 147,914.48 LT · 143,403.00 staked (96.9%) · 4,511.48 idle
  minted      147,914.48 LT over 29 day(s) · 5,100.50 LT per day
    purse_payout     60,000.00 LT   40.6%
    card_settled     58,857.48 LT   39.8%
    buy_land         28,000.00 LT   18.9%
    gacha             1,057.00 LT    0.7%
  burned      0.00 LT (0.0% of issuance) — the sinks
  valuation   at $0.01/LT (pencilled) the world has issued $1,479 of land against $6,990 of GP faucet — $0.21 of LT per $1 of GP
  runway      100B-token target reached in 10,000+ year(s) at this population's rate — scales with farms, not with time

REPLAY
  203/203 sampled fight rows rebuild exactly from their seed

STAKER POOL
  paid out 27,182.29 GP over 28 day(s) · 0.11 waiting · 143,403.00 LT staked
  land_purchase 22,400.00 · gacha 4,480.00 · claim_rake 302.40

CHAMPIONSHIPS
  major     3 run / 0 cancelled · field 32.0 · purse 42,601.53
            paid 48/96 entrants (50%) · biggest take 13.0% of all purse GP · smallest 203.64 GP
            entry fees 15,360.00 GP fund 36% of the purse · the rest is juice (gacha + breed fees) · net to the field 27,241.53 GP
            under the door 0/48 winners (0%) took less purse than their entry fee
  juvenile  5 run / 1 cancelled · field 10.4 · purse 17,974.46
            paid 28/52 entrants (54%) · biggest take 17.4% of all purse GP · smallest 71.18 GP
            entry fees 2,496.00 GP fund 14% of the purse · the rest is juice (gacha + breed fees) · net to the field 15,478.46 GP
            under the door 0/28 winners (0%) took less purse than their entry fee

MECHANIC ADOPTION            farms of 21
  claims placed             16  ████████████████░░░░░
  studs listed               0  ░░░░░░░░░░░░░░░░░░░░░  ⚠ NOBODY WALKED THROUGH
  land purchased             1  █░░░░░░░░░░░░░░░░░░░░
  paid gacha rolls          10  ██████████░░░░░░░░░░░
  gacha bundles bought       1  █░░░░░░░░░░░░░░░░░░░░
  barn expanded              0  ░░░░░░░░░░░░░░░░░░░░░  ⚠ NOBODY WALKED THROUGH
  Major entries             19  ███████████████████░░
  juvenile championship     11  ███████████░░░░░░░░░░
  ⚠ 2 door(s) unused: studs listed, barn expanded

DISCOVERY
  age 1    carded 273/1188 at the true best blade (23.0% vs random 20.0%) · 51.0% on or adjacent (random 48.0%) · answer coverage 37.1% · SCOUT 197/441 right (44.7% vs random 20.0%), 69.2% on or adjacent · clear home 124/232 (53.4%, 66.4% adjacent)
  age 2–3  carded 889/2990 at the true best blade (29.7% vs random 20.0%) · 56.6% on or adjacent (random 47.7%) · answer coverage 73.3% · SCOUT 931/2191 right (42.5% vs random 20.0%), 69.8% on or adjacent · clear home 586/1091 (53.7%, 74.9% adjacent)
  age 4+   0 card decisions — too few to read
  explored  5/5 blades saw an age-1 entry in the discovery year
  flock shape  median home blade beats its runner-up by 8.8 pts · 44.3% of birds clear the 10-pt bar
  ⚠ only 44.3% of birds have a home blade worth finding — the flock is being bred flat, so there is little for discovery to discover

2 warnings · 0 invariant failures

Done → /Users/plumeria/Repos/pintakasi-bloodlines/data/sim-20260815-1255.db
Run `bun dev:sim` and open http://localhost:3435/admin — it always shows the newest sim.
```

---

## Coach session #1 — day 28 (2026-08-16)

World: `sim-20260815-1255`. Segment 1: 280 calls / 0 failed / 34.3 s/day ·
0 invariant failures. Exp4 = exp3 + the bird-by-bird checklist in A GOOD
DAY + the hardcore truth (Majors retire their losers) in system prompt and
preamble.

## Scoreboard at day 28

```
  scripted (10): total net worth 394,371 · avg 39,437 · crowns 7
  llm      (10): total net worth 241,651 · avg 24,165 · crowns 1
```

## Readings

- **Best day-28 volume of the four experiments**: 941 llm fights (exp3:
  772, exp2: 826, exp1: ~450); 1,007 enter proposals. The checklist works
  — but by *redistribution*, not expansion: proposals/day still ~5.5. The
  model spends its ~5-action budget more on entering (claims collapsed to
  15). The gait is the gait.
- Crown discipline visible: 104 crown proposals (exp3: 125) with the
  hardcore warning in place — slightly more selective, as intended. One
  crown won by day 28 (ties exp3's record start).
- Breeding: 1. Fourth experiment, same early number — the session-1
  pointed order remains load-bearing, so it returns unchanged.

## Orders — the proven session-1 set (exp2/exp3's, verbatim)

Card sharks / architects / claim scouts / talent scouts / operators each
get their creed's standing correction: volume held, crowns weekly, and
BREED THE MOMENT STOCK LINES UP. Applied mid-run after segment 2's launch.

---

## Segment 2 — days 29–56 (verbatim sim log)

```
$ bun run scripts/simulate.ts "28" --keep "--seed=1" "--brain=qwen3:30b-a3b" "--llm=bot-7,bot-15,bot-marco,bot-9,bot-8,bot-16,bot-14,bot-12,bot-13,bot-17" --actors
Brain: qwen3:30b-a3b plays 10 stable(s) — bot-7, bot-15, bot-marco, bot-9, bot-8, bot-16, bot-14, bot-12, bot-13, bot-17

ts=2026-08-15T05:27:00.252722Z level=error message="actor start failed" error="not_registered: Actor factory \'counter\' is not registered." error_chain="[\"not_registered: Actor factory \'counter\' is not registered.\"]"
  [brain] Marco Gamefarm: 11 actions (10.3s)
  [brain] Talisay Tari Club: 12 actions (15.4s)
  [brain] Sugalan Social Club: 11 actions (21.5s)
  [brain] Hacienda Verde: 0 actions (22.9s)
  [brain] Batangas Sprint Club: 12 actions (27.5s)
  [brain] Ilonggo Ironworks: 13 actions (34.8s)
  [brain] Bagong Laban: 12 actions (39.8s)
  [brain] Pulang Bagwis: 14 actions (47.8s)
  [brain] Cuchillos de Sonora: 13 actions (55.0s)
  [brain] Cavite Bloodlines: 0 actions (56.3s)
Day 29 (Saturday): 40 fights, 1 unmatched, 3 claims settled, staking paid 1418.82 GP to 21 stakers — 56.8s
  [brain] Marco Gamefarm: 0 actions (1.4s)
  [brain] Ilonggo Ironworks: 12 actions (8.4s)
  [brain] Bagong Laban: 13 actions (12.9s)
  [brain] Talisay Tari Club: 0 actions (14.2s)
  [brain] Cuchillos de Sonora: 0 actions (15.6s)
  [brain] Batangas Sprint Club: 2 actions (17.2s)
  [brain] Sugalan Social Club: 3 actions (18.9s)
  [brain] Hacienda Verde: 0 actions (20.3s)
  [brain] Cavite Bloodlines: 11 actions (26.2s)
  [brain] Pulang Bagwis: 15 actions (31.3s)
Day 30 (Sunday): 38 fights, 4 unmatched, 2 claims settled, staking paid 1019.58 GP to 21 stakers — 31.9s
  [brain] Hacienda Verde: 1 actions (1.6s)
  [brain] Ilonggo Ironworks: 13 actions (9.5s)
  [brain] Bagong Laban: 12 actions (13.7s)
  [brain] Cavite Bloodlines: 11 actions (18.2s)
  [brain] Batangas Sprint Club: 11 actions (23.4s)
  [brain] Marco Gamefarm: 0 actions (24.5s)
  [brain] Talisay Tari Club: 12 actions (30.8s)
  [brain] Sugalan Social Club: 10 actions (34.4s)
  [brain] Cuchillos de Sonora: 0 actions (35.7s)
  [brain] Pulang Bagwis: 0 actions (37.0s)
Day 31 (Monday): 44 fights, 2 unmatched, 2 claims settled, staking paid 979.63 GP to 21 stakers — 37.3s
  [brain] Cavite Bloodlines: 0 actions (1.5s)
  [brain] Pulang Bagwis: 0 actions (2.8s)
  [brain] Talisay Tari Club: 12 actions (9.2s)
  [brain] Hacienda Verde: 13 actions (16.3s)
  [brain] Marco Gamefarm: 0 actions (17.5s)
  [brain] Sugalan Social Club: 17 actions (22.4s)
  [brain] Cuchillos de Sonora: 13 actions (27.0s)
  [brain] Batangas Sprint Club: 11 actions (33.7s)
  [brain] Ilonggo Ironworks: 0 actions (35.1s)
  [brain] Bagong Laban: 0 actions (36.3s)
Day 32 (Tuesday): 58 fights, 0 unmatched, 3 claims settled, staking paid 856.17 GP to 21 stakers — 36.7s
  [brain] Batangas Sprint Club: 0 actions (1.5s)
  [brain] Hacienda Verde: 12 actions (8.2s)
  [brain] Marco Gamefarm: 12 actions (15.4s)
  [brain] Bagong Laban: 0 actions (16.5s)
  [brain] Ilonggo Ironworks: 0 actions (17.7s)
  [brain] Sugalan Social Club: 11 actions (25.2s)
  [brain] Cuchillos de Sonora: 0 actions (26.6s)
  [brain] Cavite Bloodlines: 0 actions (27.7s)
  [brain] Pulang Bagwis: 13 actions (33.8s)
  [brain] Talisay Tari Club: 12 actions (39.2s)
Day 33 (Wednesday): 42 fights, 1 unmatched, 2 claims settled, staking paid 935.20 GP to 21 stakers — 39.5s
  [brain] Sugalan Social Club: 0 actions (1.5s)
  [brain] Cavite Bloodlines: 9 actions (6.3s)
  [brain] Talisay Tari Club: 2 actions (7.6s)
  [brain] Bagong Laban: 12 actions (13.6s)
  [brain] Pulang Bagwis: 14 actions (21.1s)
  [brain] Batangas Sprint Club: 2 actions (22.6s)
  [brain] Cuchillos de Sonora: 13 actions (27.0s)
  [brain] Ilonggo Ironworks: 0 actions (28.2s)
  [brain] Hacienda Verde: 0 actions (29.4s)
  [brain] Marco Gamefarm: 0 actions (30.4s)
Day 34 (Thursday): 28 fights, 2 unmatched, 2 claims settled, staking paid 866.78 GP to 21 stakers — 30.7s
  [brain] Cuchillos de Sonora: 12 actions (6.8s)
  [brain] Batangas Sprint Club: 0 actions (7.9s)
  [brain] Cavite Bloodlines: 0 actions (8.8s)
  [brain] Bagong Laban: 9 actions (12.3s)
  [brain] Marco Gamefarm: 2 actions (13.5s)
  [brain] Ilonggo Ironworks: 13 actions (20.4s)
  [brain] Hacienda Verde: 1 actions (21.6s)
  [brain] Sugalan Social Club: 10 actions (25.7s)
  [brain] Pulang Bagwis: 13 actions (31.3s)
  [brain] Talisay Tari Club: 11 actions (35.5s)
Day 35 (Friday): 40 fights, 0 unmatched, 1 claims settled, staking paid 953.81 GP to 21 stakers — HATCH FRIDAY (0 hatched) — 35.9s
        wk 5 · 7 days in 4:29 · avg 38.40s/day
  [brain] Hacienda Verde: 13 actions (4.7s)
  [brain] Cavite Bloodlines: 16 actions (10.2s)
  [brain] Pulang Bagwis: 0 actions (11.4s)
  [brain] Batangas Sprint Club: 0 actions (12.4s)
  [brain] Cuchillos de Sonora: 0 actions (13.7s)
  [brain] Talisay Tari Club: 0 actions (14.9s)
  [brain] Sugalan Social Club: 9 actions (18.3s)
  [brain] Marco Gamefarm: 11 actions (22.0s)
  [brain] Bagong Laban: 11 actions (25.5s)
  [brain] Ilonggo Ironworks: 13 actions (31.3s)
Day 36 (Saturday): 42 fights, 0 unmatched, 0 claims settled, staking paid 1264.02 GP to 21 stakers — 31.8s
  [brain] Bagong Laban: 0 actions (1.4s)
  [brain] Marco Gamefarm: 0 actions (2.4s)
  [brain] Talisay Tari Club: 11 actions (6.1s)
  [brain] Pulang Bagwis: 0 actions (7.4s)
  [brain] Ilonggo Ironworks: 0 actions (8.8s)
  [brain] Cuchillos de Sonora: 2 actions (10.7s)
  [brain] Batangas Sprint Club: 10 actions (14.2s)
  [brain] Hacienda Verde: 0 actions (15.3s)
  [brain] Sugalan Social Club: 0 actions (16.3s)
  [brain] Cavite Bloodlines: 11 actions (19.9s)
Day 37 (Sunday): 22 fights, 1 unmatched, 2 claims settled, staking paid 1159.22 GP to 21 stakers — 20.3s
  [brain] Talisay Tari Club: 2 actions (1.7s)
  [brain] Bagong Laban: 11 actions (5.2s)
  [brain] Batangas Sprint Club: 11 actions (8.8s)
  [brain] Cuchillos de Sonora: 0 actions (10.0s)
  [brain] Hacienda Verde: 13 actions (14.6s)
  [brain] Cavite Bloodlines: 0 actions (15.7s)
  [brain] Marco Gamefarm: 2 actions (16.9s)
  [brain] Sugalan Social Club: 9 actions (21.6s)
  [brain] Ilonggo Ironworks: 12 actions (25.7s)
  [brain] Pulang Bagwis: 12 actions (32.4s)
Day 38 (Monday): 44 fights, 0 unmatched, 0 claims settled, staking paid 975.98 GP to 21 stakers — 32.7s
  [brain] Hacienda Verde: 13 actions (4.6s)
  [brain] Marco Gamefarm: 10 actions (9.8s)
ts=2026-08-15T05:32:54.219243Z level=error message="actor start failed" error="not_registered: Actor factory \'counter\' is not registered." error_chain="[\"not_registered: Actor factory \'counter\' is not registered.\"]"
  [brain] Batangas Sprint Club: 1 actions (11.1s)
  [brain] Ilonggo Ironworks: 13 actions (15.8s)
  [brain] Sugalan Social Club: 2 actions (17.0s)
  [brain] Cavite Bloodlines: 11 actions (20.8s)
  [brain] Cuchillos de Sonora: 0 actions (22.0s)
  [brain] Bagong Laban: 11 actions (27.0s)
  [brain] Pulang Bagwis: 13 actions (33.6s)
  [brain] Talisay Tari Club: 11 actions (39.7s)
Day 39 (Tuesday): 50 fights, 1 unmatched, 1 claims settled, staking paid 997.38 GP to 21 stakers — 40.0s
  [brain] Batangas Sprint Club: 2 actions (1.7s)
  [brain] Marco Gamefarm: 0 actions (2.8s)
  [brain] Pulang Bagwis: 13 actions (9.6s)
  [brain] Cavite Bloodlines: 0 actions (10.7s)
  [brain] Talisay Tari Club: 11 actions (16.8s)
  [brain] Sugalan Social Club: 9 actions (19.8s)
  [brain] Ilonggo Ironworks: 0 actions (21.1s)
  [brain] Cuchillos de Sonora: 12 actions (28.0s)
  [brain] Hacienda Verde: 12 actions (34.5s)
  [brain] Bagong Laban: 10 actions (38.0s)
Day 40 (Wednesday): 41 fights, 1 unmatched, 2 claims settled, staking paid 882.83 GP to 21 stakers — 38.3s
  [brain] Talisay Tari Club: 0 actions (1.4s)
  [brain] Hacienda Verde: 13 actions (8.4s)
  [brain] Batangas Sprint Club: 10 actions (12.2s)
  [brain] Ilonggo Ironworks: 10 actions (16.1s)
  [brain] Pulang Bagwis: 0 actions (17.4s)
  [brain] Cuchillos de Sonora: 12 actions (21.8s)
  [brain] Sugalan Social Club: 9 actions (24.7s)
  [brain] Bagong Laban: 10 actions (28.2s)
  [brain] Cavite Bloodlines: 1 actions (29.4s)
  [brain] Marco Gamefarm: 10 actions (35.0s)
Day 41 (Thursday): 30 fights, 0 unmatched, 0 claims settled, staking paid 983.98 GP to 21 stakers — 35.3s
  [brain] Sugalan Social Club: 0 actions (1.2s)
  [brain] Marco Gamefarm: 10 actions (5.2s)
  [brain] Pulang Bagwis: 2 actions (7.0s)
  [brain] Batangas Sprint Club: 10 actions (12.6s)
  [brain] Cavite Bloodlines: 0 actions (13.5s)
  [brain] Talisay Tari Club: 11 actions (17.8s)
  [brain] Cuchillos de Sonora: 12 actions (22.2s)
  [brain] Ilonggo Ironworks: 13 actions (26.7s)
  [brain] Bagong Laban: 0 actions (27.9s)
  [brain] Hacienda Verde: 0 actions (29.1s)
Day 42 (Friday): 25 fights, 0 unmatched, 0 claims settled, staking paid 920.00 GP to 21 stakers — HATCH FRIDAY (2 hatched) — 29.4s
        wk 6 · 7 days in 3:48 · avg 32.55s/day
  [brain] Sugalan Social Club: 10 actions (3.4s)
  [brain] Marco Gamefarm: 2 actions (4.8s)
  [brain] Cavite Bloodlines: 10 actions (8.3s)
  [brain] Hacienda Verde: 0 actions (9.4s)
  [brain] Talisay Tari Club: 0 actions (10.6s)
  [brain] Bagong Laban: 10 actions (14.9s)
  [brain] Ilonggo Ironworks: 0 actions (16.0s)
  [brain] Cuchillos de Sonora: 11 actions (20.7s)
  [brain] Batangas Sprint Club: 10 actions (24.4s)
  [brain] Pulang Bagwis: 13 actions (31.3s)
Day 43 (Saturday): 69 fights, 1 unmatched, 4 claims settled, staking paid 1609.01 GP to 21 stakers — 31.9s
  [brain] Bagong Laban: 0 actions (1.4s)
  [brain] Batangas Sprint Club: 0 actions (2.5s)
  [brain] Talisay Tari Club: 0 actions (3.8s)
  [brain] Cuchillos de Sonora: 0 actions (5.2s)
  [brain] Cavite Bloodlines: 0 actions (6.4s)
  [brain] Pulang Bagwis: 13 actions (11.1s)
  [brain] Marco Gamefarm: 10 actions (16.9s)
  [brain] Hacienda Verde: 12 actions (21.1s)
  [brain] Sugalan Social Club: 0 actions (22.3s)
  [brain] Ilonggo Ironworks: 11 actions (26.7s)
Day 44 (Sunday): 49 fights, 1 unmatched, 5 claims settled, staking paid 1118.39 GP to 21 stakers — 27.1s
  [brain] Cuchillos de Sonora: 12 actions (4.0s)
  [brain] Ilonggo Ironworks: 10 actions (9.3s)
  [brain] Bagong Laban: 2 actions (10.8s)
  [brain] Cavite Bloodlines: 9 actions (13.9s)
  [brain] Batangas Sprint Club: 0 actions (15.0s)
  [brain] Sugalan Social Club: 0 actions (16.0s)
  [brain] Talisay Tari Club: 0 actions (17.5s)
  [brain] Pulang Bagwis: 12 actions (24.3s)
  [brain] Marco Gamefarm: 10 actions (30.8s)
  [brain] Hacienda Verde: 11 actions (34.7s)
Day 45 (Monday): 72 fights, 0 unmatched, 1 claims settled, staking paid 1027.59 GP to 21 stakers — 35.0s
  [brain] Cavite Bloodlines: 10 actions (3.6s)
  [brain] Pulang Bagwis: 14 actions (11.1s)
  [brain] Ilonggo Ironworks: 0 actions (12.4s)
  [brain] Batangas Sprint Club: 10 actions (16.1s)
  [brain] Bagong Laban: 13 actions (21.3s)
  [brain] Marco Gamefarm: 10 actions (25.1s)
  [brain] Hacienda Verde: 12 actions (31.5s)
  [brain] Cuchillos de Sonora: 0 actions (32.7s)
  [brain] Sugalan Social Club: 2 actions (34.1s)
  [brain] Talisay Tari Club: 0 actions (35.4s)
Day 46 (Tuesday): 77 fights, 0 unmatched, 6 claims settled, staking paid 930.81 GP to 21 stakers — 35.8s
  [brain] Bagong Laban: 11 actions (4.2s)
  [brain] Cavite Bloodlines: 9 actions (7.5s)
  [brain] Batangas Sprint Club: 10 actions (11.4s)
  [brain] Ilonggo Ironworks: 13 actions (16.5s)
  [brain] Talisay Tari Club: 11 actions (20.6s)
  [brain] Sugalan Social Club: 0 actions (21.7s)
  [brain] Hacienda Verde: 12 actions (26.3s)
  [brain] Pulang Bagwis: 14 actions (31.4s)
  [brain] Marco Gamefarm: 11 actions (36.3s)
  [brain] Cuchillos de Sonora: 14 actions (41.2s)
Day 47 (Wednesday): 82 fights, 0 unmatched, 6 claims settled, staking paid 877.60 GP to 21 stakers — 41.7s
  [brain] Batangas Sprint Club: 10 actions (4.3s)
  [brain] Marco Gamefarm: 1 actions (5.6s)
  [brain] Cuchillos de Sonora: 0 actions (7.0s)
  [brain] Hacienda Verde: 12 actions (13.5s)
  [brain] Pulang Bagwis: 14 actions (18.2s)
  [brain] Cavite Bloodlines: 1 actions (19.3s)
  [brain] Bagong Laban: 10 actions (24.9s)
  [brain] Ilonggo Ironworks: 13 actions (29.8s)
  [brain] Talisay Tari Club: 0 actions (31.1s)
  [brain] Sugalan Social Club: 2 actions (32.5s)
Day 48 (Thursday): 26 fights, 1 unmatched, 2 claims settled, staking paid 842.83 GP to 21 stakers — 32.9s
  [brain] Hacienda Verde: 11 actions (6.2s)
  [brain] Sugalan Social Club: 9 actions (9.4s)
  [brain] Cuchillos de Sonora: 11 actions (13.6s)
  [brain] Ilonggo Ironworks: 14 actions (18.5s)
  [brain] Batangas Sprint Club: 10 actions (23.9s)
  [brain] Marco Gamefarm: 0 actions (25.1s)
  [brain] Talisay Tari Club: 0 actions (26.4s)
  [brain] Cavite Bloodlines: 0 actions (27.5s)
  [brain] Bagong Laban: 10 actions (33.2s)
  [brain] Pulang Bagwis: 0 actions (34.6s)
Day 49 (Friday): 75 fights, 4 unmatched, 5 claims settled, staking paid 872.96 GP to 21 stakers — HATCH FRIDAY (8 hatched) — 35.1s
        wk 7 · 7 days in 4:00 · avg 34.22s/day
  [brain] Ilonggo Ironworks: 0 actions (1.5s)
  [brain] Cuchillos de Sonora: 14 actions (6.1s)
  [brain] Bagong Laban: 0 actions (7.3s)
  [brain] Hacienda Verde: 0 actions (8.5s)
  [brain] Cavite Bloodlines: 0 actions (9.8s)
  [brain] Batangas Sprint Club: 0 actions (11.1s)
  [brain] Marco Gamefarm: 0 actions (12.2s)
  [brain] Sugalan Social Club: 1 actions (13.4s)
  [brain] Pulang Bagwis: 11 actions (17.3s)
  [brain] Talisay Tari Club: 10 actions (21.0s)
Day 50 (Saturday): 107 fights, 1 unmatched, 4 claims settled, staking paid 1333.65 GP to 21 stakers — 21.6s
  [brain] Cavite Bloodlines: 0 actions (1.3s)
  [brain] Cuchillos de Sonora: 0 actions (2.5s)
  [brain] Sugalan Social Club: 0 actions (3.6s)
  [brain] Ilonggo Ironworks: 12 actions (10.9s)
  [brain] Hacienda Verde: 11 actions (16.9s)
  [brain] Pulang Bagwis: 0 actions (18.3s)
  [brain] Marco Gamefarm: 0 actions (19.5s)
  [brain] Batangas Sprint Club: 0 actions (21.0s)
  [brain] Bagong Laban: 0 actions (22.3s)
  [brain] Talisay Tari Club: 13 actions (26.7s)
Day 51 (Sunday): 126 fights, 0 unmatched, 5 claims settled, staking paid 2163.75 GP to 21 stakers — 27.6s
  [brain] Pulang Bagwis: 12 actions (5.2s)
  [brain] Bagong Laban: 13 actions (10.0s)
  [brain] Batangas Sprint Club: 1 actions (11.3s)
  [brain] Cavite Bloodlines: 0 actions (12.5s)
  [brain] Marco Gamefarm: 0 actions (13.6s)
  [brain] Talisay Tari Club: 0 actions (15.0s)
  [brain] Sugalan Social Club: 0 actions (16.1s)
  [brain] Ilonggo Ironworks: 0 actions (17.4s)
  [brain] Cuchillos de Sonora: 13 actions (21.6s)
  [brain] Hacienda Verde: 0 actions (22.6s)
Day 52 (Monday): 89 fights, 0 unmatched, 4 claims settled, staking paid 989.62 GP to 21 stakers — 23.1s
  [brain] Cuchillos de Sonora: 11 actions (4.9s)
  [brain] Bagong Laban: 13 actions (9.8s)
  [brain] Hacienda Verde: 0 actions (10.9s)
  [brain] Pulang Bagwis: 11 actions (17.1s)
  [brain] Talisay Tari Club: 11 actions (23.3s)
  [brain] Sugalan Social Club: 10 actions (26.8s)
  [brain] Batangas Sprint Club: 8 actions (30.0s)
  [brain] Cavite Bloodlines: 8 actions (32.9s)
  [brain] Ilonggo Ironworks: 0 actions (34.3s)
  [brain] Marco Gamefarm: 0 actions (35.6s)
Day 53 (Tuesday): 124 fights, 3 unmatched, 3 claims settled, staking paid 874.79 GP to 21 stakers — 36.0s
  [brain] Pulang Bagwis: 12 actions (6.5s)
  [brain] Cuchillos de Sonora: 14 actions (11.5s)
  [brain] Marco Gamefarm: 0 actions (12.8s)
  [brain] Batangas Sprint Club: 11 actions (18.6s)
  [brain] Ilonggo Ironworks: 13 actions (23.7s)
  [brain] Bagong Laban: 0 actions (25.0s)
  [brain] Cavite Bloodlines: 11 actions (28.9s)
  [brain] Sugalan Social Club: 0 actions (30.1s)
  [brain] Talisay Tari Club: 0 actions (31.4s)
  [brain] Hacienda Verde: 0 actions (32.7s)
Day 54 (Wednesday): 110 fights, 2 unmatched, 4 claims settled, staking paid 1114.01 GP to 21 stakers — 33.3s
  [brain] Cavite Bloodlines: 0 actions (1.6s)
  [brain] Hacienda Verde: 12 actions (5.4s)
  [brain] Batangas Sprint Club: 2 actions (7.0s)
  [brain] Ilonggo Ironworks: 0 actions (8.6s)
  [brain] Sugalan Social Club: 0 actions (9.8s)
  [brain] Cuchillos de Sonora: 14 actions (14.8s)
  [brain] Pulang Bagwis: 12 actions (21.5s)
  [brain] Marco Gamefarm: 1 actions (23.0s)
  [brain] Bagong Laban: 12 actions (27.4s)
  [brain] Talisay Tari Club: 12 actions (33.8s)
Day 55 (Thursday): 32 fights, 4 unmatched, 0 claims settled, staking paid 967.99 GP to 21 stakers — 34.3s
  [brain] Ilonggo Ironworks: 0 actions (1.5s)
  [brain] Batangas Sprint Club: 0 actions (2.8s)
  [brain] Cuchillos de Sonora: 0 actions (4.3s)
  [brain] Sugalan Social Club: 0 actions (5.7s)
  [brain] Pulang Bagwis: 12 actions (11.8s)
  [brain] Cavite Bloodlines: 2 actions (13.2s)
  [brain] Bagong Laban: 13 actions (17.7s)
  [brain] Talisay Tari Club: 0 actions (19.1s)
  [brain] Marco Gamefarm: 0 actions (20.0s)
  [brain] Hacienda Verde: 0 actions (21.3s)
Day 56 (Friday): 66 fights, 2 unmatched, 3 claims settled, staking paid 1041.02 GP to 21 stakers — HATCH FRIDAY (8 hatched) — 21.8s
        wk 8 · 7 days in 3:18 · avg 28.24s/day

TIMING
  seed + bots      0.0s
  simulation      15:34   (28 day(s), avg 33.36s/day · honest 8% / tick 92%)
  brains          15:23   (32.97s/day · 99% of the run, 280 call(s), 0 failed)
  doctor           0.9s
  total           15:35
  slowest days d29 56.8s · d47 41.7s · d39 40.0s
  per unit     230.55 ms/fight · 308.62 ms/entry

BARN CAREERS (durable actor state — persists across runs)
  bot-7     56 day(s) played · last day 55 · 288 proposed, 0 dropped, 0 failure(s) · 1096.5s thinking
  bot-8     56 day(s) played · last day 55 · 410 proposed, 15 dropped, 0 failure(s) · 1174.2s thinking
  bot-9     56 day(s) played · last day 55 · 301 proposed, 38 dropped, 0 failure(s) · 1100.8s thinking
  bot-marco  56 day(s) played · last day 55 · 218 proposed, 31 dropped, 0 failure(s) · 1043.5s thinking
  bot-12    56 day(s) played · last day 55 · 296 proposed, 24 dropped, 0 failure(s) · 935.8s thinking
  bot-13    56 day(s) played · last day 55 · 362 proposed, 13 dropped, 0 failure(s) · 1030.1s thinking
  bot-14    56 day(s) played · last day 55 · 272 proposed, 5 dropped, 0 failure(s) · 1116.1s thinking
  bot-15    56 day(s) played · last day 55 · 379 proposed, 15 dropped, 0 failure(s) · 1054.6s thinking
  bot-16    56 day(s) played · last day 55 · 427 proposed, 44 dropped, 0 failure(s) · 1051.2s thinking
  bot-17    56 day(s) played · last day 55 · 344 proposed, 30 dropped, 0 failure(s) · 1063.9s thinking

PINTAKASI DOCTOR · data/sim-20260815-1255.db
day 56 · Friday, February 28, 3000 · week 8 · 21 farms · 490 birds

INVARIANTS
  PASS  GP conservation            944,800.00 GP in world = 944,800.00 expected
  PASS  LT conservation            423,170.31 LT held = 423,170.31 LT ledgered
  PASS  no negative balances       staker 0.09 · juice 0.02 · 21 wallets clean
  PASS  pit figures                4052 fights · 4052 mirrored · 0 inversions
  PASS  purses settle              28 completed crown(s), exact to the cent
  PASS  no stranded entries        29 resolved championship(s), every entry settled
  PASS  one card per bird per day  3027 entries across 3027 bird-days · 0 over cap
  PASS  fight counts match the log 3027 settled entries · 7474 fights claimed · 0 mismatched
  PASS  scout book matches the log 1295 book lines audited · 0 out of step

CARD HEALTH
  3027 entries · 2972 fought · 55 unmatched (1.8%) · 368 lobbies
  weather timing  719/2583 starred entries ran on the bird's own element day (27.8% vs 20.0% by chance, 1.39×) ✓ entries are being timed

GROUP STAGE
  fights per settled entry  mean 2.47 of 3 · 3027 settled entries
  full cards  1740 (57.5%) took all 3 · short 1232 (40.7%) fought 1–2 · 55 (1.8%) never fought
  groups  900 dealt · mean 3.36 birds · 28 of one (28 were the lobby's only entry)

LOBBY FILL
  mean 8.23 birds per lobby · 368 lobbies · 28 held a single bird (7.6%)
      1 ██                       7.6%
    2-3 ██████                   23.1%
    4-7 ██████                   25.5%
   8-15 ███████                  29.6%
    16+ ███                      14.1%
  same-barn-only lobbies 7 · 22 birds stranded with no cross-barn opponent

WORST LOBBY KEYS
  real/maiden/b1                       19 entries, 47.4% unmatched
  real/nw3/b4                           8 entries, 25.0% unmatched
  juvenile/claimer/b2@270              13 entries, 15.4% unmatched

POPULATION
  eggs 58 · active 239 · retired 193 · 21 farms
  by age  1:68  2:65  3:55  4:5  5:1  6:3  7:4  8:38
  supply  hatches 432 · gacha eggs 124 · covers 198
  loss    hardcore 193
  barns   0 of 21 at capacity · 0 expansion(s) bought

FIGHT VOLUME
  wk  0       0  
  wk  1     496  ██████████████
  wk  2     742  █████████████████████
  wk  3     865  ████████████████████████
  wk  4     378  ██████████
  wk  5     308  █████████
  wk  6     451  █████████████
  wk  7     720  ████████████████████
  wk  8      92  ███  (1 day)
  trough wk5 (308) = 35.6% of the wk3 peak (865) — EXPECTED: the age-3 founder flock is culled by the hardcore
  Majors before the first bred generation reaches fighting age, then volume
  recovers. Reference: wk3/4/5/6/7 = 1092/397/145/498/871 fights (20 farms, 91 days).

BLOODLINES
  gen   birds   mean grade     stars   home margin
  0       292   B+ ( 331.4)    1.60★      7.9
  1       198   B+ ( 346.3)    2.20★     14.1
  gen 1 vs gen 0  +14.9 mean stat · +0.6★ · +6.2 pts of home margin

FIGHT ECONOMY BY RUNG
    rung                      fee  entries  share   GP risked   LT minted  LT/100GP
    juvenile/claimer@90        24       70   2.3%       1,312      188.08     14.34
    juvenile/maiden            30       72   2.4%       1,320      192.25     14.56
    juvenile/claimer@180       48       59   1.9%       2,336      373.93     16.01
    real/claimer@90            48      195   6.4%       7,040    1,116.58     15.86
    real/maiden                60       43   1.4%       1,280      209.02     16.33
    real/nw3                   60       58   1.9%       2,320      380.52     16.40
    juvenile/claimer@270       72       45   1.5%       2,496      422.13     16.91
    real/claimer@180           96      132   4.4%      10,496    1,872.21     17.84
    real/claimer@270          144      100   3.3%      10,560    1,969.60     18.65
    juvenile/open             150      756  25.0%      91,600   17,380.73     18.97
    real/open                 300    1,497  49.5%     392,800   83,187.26     21.18

LAND SUPPLY
  circulating 423,170.31 LT · 422,142.00 staked (99.8%) · 1,028.31 idle
  minted      429,370.31 LT over 57 day(s) · 7,532.81 LT per day
    purse_payout    264,000.00 LT   61.5%
    card_settled    107,292.31 LT   25.0%
    buy_land         56,000.00 LT   13.0%
    gacha             2,078.00 LT    0.5%
  burned      6,200.00 LT (1.4% of issuance) — the sinks
    stud_listed       6,200.00 LT  100.0%
  valuation   at $0.01/LT (pencilled) the world has issued $4,294 of land against $11,810 of GP faucet — $0.36 of LT per $1 of GP
  runway      100B-token target reached in 10,000+ year(s) at this population's rate — scales with farms, not with time

REPLAY
  203/203 sampled fight rows rebuild exactly from their seed

STAKER POOL
  paid out 57,159.71 GP over 56 day(s) · 0.09 waiting · 422,142.00 LT staked
  land_purchase 44,800.00 · gacha 8,632.00 · breed 3,168.00 · claim_rake 559.80

CHAMPIONSHIPS
  major     15 run / 0 cancelled · field 13.9 · purse 104,059.12
            paid 106/208 entrants (51%) · biggest take 5.3% of all purse GP · smallest 173.10 GP
            entry fees 33,280.00 GP fund 32% of the purse · the rest is juice (gacha + breed fees) · net to the field 70,779.12 GP
            under the door 0/106 winners (0%) took less purse than their entry fee
  juvenile  13 run / 1 cancelled · field 10.4 · purse 31,628.86
            paid 71/135 entrants (53%) · biggest take 9.9% of all purse GP · smallest 44.26 GP
            entry fees 6,480.00 GP fund 20% of the purse · the rest is juice (gacha + breed fees) · net to the field 25,148.86 GP
            under the door 2/71 winners (3%) took less purse than their entry fee

MECHANIC ADOPTION            farms of 21
  claims placed             18  ██████████████████░░░
  studs listed              10  ██████████░░░░░░░░░░░
  land purchased             1  █░░░░░░░░░░░░░░░░░░░░
  paid gacha rolls          10  ██████████░░░░░░░░░░░
  gacha bundles bought       1  █░░░░░░░░░░░░░░░░░░░░
  barn expanded              0  ░░░░░░░░░░░░░░░░░░░░░  ⚠ NOBODY WALKED THROUGH
  Major entries             21  █████████████████████
  juvenile championship     11  ███████████░░░░░░░░░░
  ⚠ 1 door(s) unused: barn expanded

DISCOVERY
  age 1    carded 529/2378 at the true best blade (22.2% vs random 20.0%) · 49.0% on or adjacent (random 47.9%) · answer coverage 34.2% · SCOUT 399/814 right (49.0% vs random 20.0%), 70.1% on or adjacent · clear home 262/462 (56.7%, 68.6% adjacent)
  age 2–3  carded 1090/3959 at the true best blade (27.5% vs random 20.0%) · 56.0% on or adjacent (random 48.2%) · answer coverage 73.8% · SCOUT 1299/2920 right (44.5% vs random 20.0%), 71.5% on or adjacent · clear home 780/1392 (56.0%, 77.1% adjacent)
  age 4+   carded 445/1137 at the true best blade (39.1% vs random 20.0%) · 63.9% on or adjacent (random 47.7%) · answer coverage 68.5% · SCOUT 412/779 right (52.9% vs random 20.0%), 73.6% on or adjacent · clear home 217/388 (55.9%, 72.7% adjacent)
  explored  5/5 blades saw an age-1 entry in the discovery year
  flock shape  median home blade beats its runner-up by 10.1 pts · 50.0% of birds clear the 10-pt bar
  breeding  168 bot covers · hens carry +50.5 of their own shape (any bird: +55.5) · the sires chosen reinforce it by +30.5 (an unchosen sire: +8.5) · foals land at +35.0
  broodmare band  76.9% of 78 settled retired hens have ever carried · busiest hen 4 foals
  ✓ the scout beats chance on mature birds with a home — 55.9% vs 20.0%

1 warning · 0 invariant failures

Done → /Users/plumeria/Repos/pintakasi-bloodlines/data/sim-20260815-1255.db
Run `bun dev:sim` and open http://localhost:3435/admin — it always shows the newest sim.
```

---

## Coach session #2 — day 56 (2026-08-16)

World: `sim-20260815-1255` · 0 invariant failures.

## Scoreboard at day 56

```
  scripted (10): total net worth 731,978 · avg 73,198 · crowns 21
  llm      (10): total net worth 468,687 · avg 46,869 · crowns 5
```

**Hacienda Verde (bot-13, operator) holds rank 7** — an llm barn inside the
scripted pack for the second experiment running.

## Readings — the checklist's trade, visible

- Fight volume is the best of any experiment at this point: **2,004** llm
  fights (exp3: 1,379 · exp2: 1,424 · exp1: ~900). The bird-by-bird
  checklist works.
- But avg net worth trails exp3 (46,869 vs 50,739): more entries means more
  fees, and the fee side bites when rosters stay shallow — breeds regressed
  to 7 this segment (exp3 seg2: 14), and the seg-1 claims collapse (15
  proposals) starved the claim scouts' value engine. Volume without depth
  buys land but leaks GP.
- Crowns: 5 won, spread across five barns; the hardcore warning made
  declarations more selective, as designed — but selectivity without a
  breeding pipeline is just fewer shots.

## Orders

- **KEEP** (5): bot-13 (rank 7 — don't talk to the leader), bot-15, bot-8,
  bot-7, bot-marco (all crowned, all mid-band).
- **bot-9** (rank 19, architect): breeding is your whole trade and you bred
  twice this month — a pairing every week space allows, no exceptions.
- **bot-16** (11, claim scout, crownless): your claim engine went quiet —
  claim an undervalued bird every week, and get a declaration out.
- **bot-12** (16, talent scout, crownless): keep the volume, but bank one
  crown declaration every week and breed on stock.
- **bot-14** (18): same as bot-12 — declarations weekly, breed on stock.
- **bot-17** (20, operator): copy the leader of your own creed — bot-13's
  week is volume + a weekly declaration + breeding on stock. Do those three.
