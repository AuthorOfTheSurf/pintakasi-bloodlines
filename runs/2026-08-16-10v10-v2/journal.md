# The 10v10 v2 journal — one continuous read

Experiment #2 (2026-08-16, overnight): same protocol as exp1 — 10 scripted
vs 10 llm, 91 days, coach at days 28/56 — but the llm side starts with
everything exp1 taught: crown-sighted briefs from day 1, and the three-law
preamble (volume mints land · declare the crowns · run the pipeline) baked
into every creed. Ginto (scripted whale) tamed to a solvent spender per
Zane's ruling. Model: qwen3:30b-a3b. Seed 1.

---

## Segment 1 — days 1–28 (verbatim sim log)

```
$ bun run scripts/simulate.ts "28" "--seed=1" "--brain=qwen3:30b-a3b" "--llm=bot-7,bot-15,bot-marco,bot-9,bot-8,bot-16,bot-14,bot-12,bot-13,bot-17" --actors "--personas=championship"
Fresh world seeded at /Users/plumeria/Repos/pintakasi-bloodlines/data/sim-20260815-0245.db — day 0, Friday

Brain: qwen3:30b-a3b plays 10 stable(s) — bot-7, bot-15, bot-marco, bot-9, bot-8, bot-16, bot-14, bot-12, bot-13, bot-17

Personas set: 10 barn(s) start under the championship creeds

  [brain] Hacienda Verde: 2 actions (1.5s)
  [brain] Bagong Laban: 1 actions (2.4s)
  [brain] Marco Gamefarm: 1 actions (3.7s)
  [brain] Cavite Bloodlines: 3 actions, 5 dropped (5.9s)
          ✗ 2× enter: unknown bird #3
          ✗ 1× crown: unknown bird #3
          ✗ 1× list_stud: unknown bird #3
          ✗ 1× breed: unknown mother #3
  [brain] Talisay Tari Club: 0 actions (6.6s)
  [brain] Pulang Bagwis: 0 actions (7.3s)
  [brain] Ilonggo Ironworks: 1 actions (8.2s)
  [brain] Batangas Sprint Club: 1 actions (9.3s)
  [brain] Cuchillos de Sonora: 1 actions (10.1s)
  [brain] Sugalan Social Club: 1 actions (11.0s)
Day 1 (Saturday): 0 fights, 0 unmatched, 0 claims settled, staking paid 831.90 GP to 11 stakers — 11.2s
  [brain] Marco Gamefarm: 2 actions, 3 dropped (2.5s)
          ✗ 1× crown: unknown bird #3
          ✗ 1× enter: unknown bird #3
          ✗ 1× list_stud: unknown bird #3
  [brain] Batangas Sprint Club: 3 actions, 3 dropped (4.4s)
          ✗ 1× crown: unknown bird #3
          ✗ 1× enter: unknown bird #3
          ✗ 1× list_stud: unknown bird #3
  [brain] Cavite Bloodlines: 0 actions (5.1s)
  [brain] Pulang Bagwis: 3 actions, 7 dropped (7.9s)
          ✗ 5× enter: unknown bird #3
          ✗ 1× crown: unknown bird #3
          ✗ 1× list_stud: unknown bird #3
  [brain] Bagong Laban: 2 actions (8.8s)
  [brain] Sugalan Social Club: 2 actions, 3 dropped (10.3s)
          ✗ 1× crown: unknown bird #3
          ✗ 1× enter: unknown bird #3
          ✗ 1× list_stud: unknown bird #3
  [brain] Cuchillos de Sonora: 0 actions (11.0s)
  [brain] Ilonggo Ironworks: 2 actions, 3 dropped (13.3s)
          ✗ 1× crown: unknown bird #3
          ✗ 1× enter: unknown bird #3
          ✗ 1× list_stud: unknown bird #3
  [brain] Talisay Tari Club: 1 actions, 3 dropped (14.8s)
          ✗ 1× list_stud: unknown bird #3
          ✗ 1× crown: unknown bird #3
          ✗ 1× enter: unknown bird #3
  [brain] Hacienda Verde: 0 actions (15.5s)
Day 2 (Sunday): 0 fights, 0 unmatched, 0 claims settled, staking paid 1760.06 GP to 13 stakers — 15.7s
  [brain] Talisay Tari Club: 2 actions, 4 dropped (3.2s)
          ✗ 2× enter: unknown bird #3
          ✗ 1× crown: unknown bird #3
          ✗ 1× list_stud: unknown bird #3
  [brain] Cavite Bloodlines: 2 actions, 3 dropped (5.9s)
          ✗ 1× list_stud: unknown bird #3
          ✗ 1× crown: unknown bird #3
          ✗ 1× enter: unknown bird #3
  [brain] Bagong Laban: 1 actions (6.8s)
  [brain] Pulang Bagwis: 2 actions (7.7s)
  [brain] Ilonggo Ironworks: 2 actions (8.8s)
  [brain] Hacienda Verde: 1 actions, 3 dropped (11.0s)
          ✗ 1× crown: unknown bird #3
          ✗ 1× enter: unknown bird #3
          ✗ 1× list_stud: unknown bird #3
  [brain] Cuchillos de Sonora: 2 actions, 5 dropped (13.4s)
          ✗ 1× crown: unknown bird #2
          ✗ 1× enter: unknown bird #2
          ✗ 1× enter: unknown bird #1
          ✗ 1× enter: unknown bird #3
          ✗ 1× list_stud: unknown bird #4
  [brain] Marco Gamefarm: 2 actions, 4 dropped (15.3s)
          ✗ 2× enter: unknown bird #3
          ✗ 1× crown: unknown bird #3
          ✗ 1× list_stud: unknown bird #3
  [brain] Batangas Sprint Club: 1 actions (16.2s)
  [brain] Sugalan Social Club: 2 actions, 3 dropped (18.6s)
          ✗ 1× crown: unknown bird #3
          ✗ 1× enter: unknown bird #3
          ✗ 1× list_stud: unknown bird #3
Day 3 (Monday): 0 fights, 0 unmatched, 0 claims settled, staking paid 855.90 GP to 19 stakers — 18.7s
  [brain] Marco Gamefarm: 2 actions, 4 dropped (3.0s)
          ✗ 1× crown: unknown bird #1
          ✗ 1× enter: unknown bird #2
          ✗ 1× enter: unknown bird #3
          ✗ 1× list_stud: unknown bird #4
  [brain] Batangas Sprint Club: 2 actions (3.9s)
  [brain] Bagong Laban: 0 actions (4.5s)
  [brain] Hacienda Verde: 2 actions, 4 dropped (6.4s)
          ✗ 3× enter: unknown bird #3
          ✗ 1× crown: unknown bird #3
  [brain] Pulang Bagwis: 1 actions, 5 dropped (8.6s)
          ✗ 3× enter: unknown bird #10
          ✗ 1× list_stud: unknown bird #10
          ✗ 1× crown: unknown bird #10
  [brain] Talisay Tari Club: 0 actions (9.3s)
  [brain] Cavite Bloodlines: 2 actions, 3 dropped (11.6s)
          ✗ 1× crown: unknown bird #3
          ✗ 1× enter: unknown bird #3
          ✗ 1× list_stud: unknown bird #3
  [brain] Sugalan Social Club: 2 actions (12.7s)
  [brain] Cuchillos de Sonora: 2 actions, 5 dropped (14.8s)
          ✗ 3× enter: unknown bird #3
          ✗ 1× crown: unknown bird #3
          ✗ 1× list_stud: unknown bird #3
  [brain] Ilonggo Ironworks: 2 actions, 3 dropped (16.6s)
          ✗ 2× enter: unknown bird #3
          ✗ 1× crown: unknown bird #3
Day 4 (Tuesday): 0 fights, 0 unmatched, 0 claims settled, staking paid 839.96 GP to 21 stakers — 16.7s
  [brain] Cavite Bloodlines: 1 actions, 12 dropped (7.3s)
          ✗ 12× enter: unknown bird #3
  [brain] Cuchillos de Sonora: 0 actions (8.0s)
  [brain] Talisay Tari Club: 3 actions, 6 dropped (10.8s)
          ✗ 4× enter: unknown bird #3
          ✗ 1× crown: unknown bird #3
          ✗ 1× list_stud: unknown bird #3
  [brain] Sugalan Social Club: 2 actions (11.9s)
  [brain] Bagong Laban: 2 actions, 4 dropped (14.6s)
          ✗ 3× enter: unknown bird #3
          ✗ 1× crown: unknown bird #3
  [brain] Marco Gamefarm: 2 actions, 4 dropped (17.2s)
          ✗ 1× crown: unknown bird #3
          ✗ 1× enter: unknown bird #3
          ✗ 1× enter: unknown bird #2
          ✗ 1× list_stud: unknown bird #1
  [brain] Ilonggo Ironworks: 0 actions (17.8s)
  [brain] Batangas Sprint Club: 2 actions, 11 dropped (24.3s)
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
          ✗ 1× list_stud: unknown bird #12
  [brain] Hacienda Verde: 0 actions (25.3s)
  [brain] Pulang Bagwis: 3 actions, 3 dropped (27.9s)
          ✗ 1× crown: unknown bird #3
          ✗ 1× enter: unknown bird #3
          ✗ 1× list_stud: unknown bird #3
Day 5 (Wednesday): 0 fights, 0 unmatched, 0 claims settled, staking paid 1096.05 GP to 21 stakers — 28.0s
  [brain] Cuchillos de Sonora: 3 actions, 3 dropped (2.8s)
          ✗ 1× crown: unknown bird #3
          ✗ 1× enter: unknown bird #3
          ✗ 1× list_stud: unknown bird #3
  [brain] Talisay Tari Club: 2 actions, 4 dropped (5.1s)
          ✗ 2× enter: unknown bird #3
          ✗ 1× crown: unknown bird #3
          ✗ 1× list_stud: unknown bird #3
  [brain] Sugalan Social Club: 2 actions, 2 dropped (7.3s)
          ✗ 1× crown: unknown bird #3
          ✗ 1× enter: unknown bird #3
  [brain] Pulang Bagwis: 2 actions, 3 dropped (9.3s)
          ✗ 1× crown: unknown bird #3
          ✗ 1× enter: unknown bird #3
          ✗ 1× list_stud: unknown bird #3
  [brain] Bagong Laban: 2 actions, 6 dropped (11.8s)
          ✗ 4× enter: unknown bird #3
          ✗ 1× crown: unknown bird #3
          ✗ 1× list_stud: unknown bird #3
  [brain] Hacienda Verde: 1 actions (12.6s)
  [brain] Ilonggo Ironworks: 0 actions (13.2s)
  [brain] Marco Gamefarm: 2 actions, 4 dropped (15.1s)
          ✗ 2× enter: unknown bird #3
          ✗ 1× crown: unknown bird #3
          ✗ 1× list_stud: unknown bird #3
  [brain] Cavite Bloodlines: 2 actions, 6 dropped (17.9s)
          ✗ 6× enter: unknown bird #3
  [brain] Batangas Sprint Club: 2 actions, 5 dropped (21.2s)
          ✗ 3× enter: unknown bird #3
          ✗ 1× crown: unknown bird #3
          ✗ 1× list_stud: unknown bird #3
Day 6 (Thursday): 0 fights, 0 unmatched, 0 claims settled, staking paid 920.01 GP to 21 stakers — 21.4s
  [brain] Sugalan Social Club: 2 actions, 3 dropped (2.4s)
          ✗ 1× crown: unknown bird #1
          ✗ 1× enter: unknown bird #2
          ✗ 1× enter: unknown bird #3
  [brain] Batangas Sprint Club: 1 actions (3.1s)
  [brain] Ilonggo Ironworks: 1 actions (3.9s)
  [brain] Talisay Tari Club: 2 actions (4.8s)
  [brain] Cavite Bloodlines: 1 actions (5.7s)
  [brain] Bagong Laban: 0 actions (6.4s)
  [brain] Marco Gamefarm: 2 actions, 4 dropped (9.2s)
          ✗ 1× crown: unknown bird #3
          ✗ 1× enter: unknown bird #1
          ✗ 1× enter: unknown bird #2
          ✗ 1× list_stud: unknown bird #4
  [brain] Cuchillos de Sonora: 2 actions, 5 dropped (11.3s)
          ✗ 1× crown: unknown bird #1
          ✗ 1× enter: unknown bird #2
          ✗ 1× enter: unknown bird #3
          ✗ 1× enter: unknown bird #4
          ✗ 1× list_stud: unknown bird #5
  [brain] Hacienda Verde: 0 actions (11.9s)
  [brain] Pulang Bagwis: 1 actions (12.6s)
Day 7 (Friday): 0 fights, 0 unmatched, 0 claims settled, staking paid 840.01 GP to 21 stakers — HATCH FRIDAY (8 hatched) — 12.8s
        wk 1 · 7 days in 2:04 · avg 17.78s/day
  [brain] Marco Gamefarm: 11 actions (6.2s)
  [brain] Ilonggo Ironworks: 0 actions (7.4s)
  [brain] Batangas Sprint Club: 0 actions (8.6s)
  [brain] Hacienda Verde: 11 actions (14.8s)
  [brain] Sugalan Social Club: 6 actions (17.1s)
  [brain] Pulang Bagwis: 1 actions (18.6s)
  [brain] Cuchillos de Sonora: 0 actions (19.7s)
  [brain] Cavite Bloodlines: 0 actions (20.9s)
  [brain] Bagong Laban: 2 actions (22.2s)
  [brain] Talisay Tari Club: 11 actions (26.5s)
Day 8 (Saturday): 76 fights, 0 unmatched, 3 claims settled, staking paid 986.81 GP to 21 stakers — 26.8s
  [brain] Sugalan Social Club: 0 actions (1.5s)
  [brain] Marco Gamefarm: 8 actions (4.6s)
  [brain] Ilonggo Ironworks: 0 actions (5.8s)
  [brain] Batangas Sprint Club: 12 actions (13.1s)
  [brain] Cuchillos de Sonora: 12 actions (20.6s)
  [brain] Bagong Laban: 12 actions (28.1s)
  [brain] Hacienda Verde: 12 actions (35.3s)
  [brain] Talisay Tari Club: 0 actions (36.7s)
  [brain] Pulang Bagwis: 5 actions (40.2s)
  [brain] Cavite Bloodlines: 12 actions (45.0s)
Day 9 (Sunday): 102 fights, 0 unmatched, 4 claims settled, staking paid 941.60 GP to 21 stakers — 45.4s
  [brain] Ilonggo Ironworks: 10 actions (4.4s)
  [brain] Cuchillos de Sonora: 12 actions (9.2s)
  [brain] Talisay Tari Club: 0 actions (10.4s)
  [brain] Marco Gamefarm: 0 actions (11.7s)
  [brain] Bagong Laban: 11 actions (19.4s)
  [brain] Cavite Bloodlines: 3 actions (21.7s)
  [brain] Batangas Sprint Club: 8 actions (27.2s)
  [brain] Hacienda Verde: 12 actions (34.8s)
  [brain] Pulang Bagwis: 11 actions (39.3s)
  [brain] Sugalan Social Club: 6 actions (42.7s)
Day 10 (Monday): 67 fights, 0 unmatched, 2 claims settled, staking paid 931.60 GP to 21 stakers — 43.0s
  [brain] Cavite Bloodlines: 2 actions (2.1s)
  [brain] Batangas Sprint Club: 12 actions (8.6s)
  [brain] Sugalan Social Club: 0 actions (10.0s)
  [brain] Talisay Tari Club: 12 actions (18.5s)
  [brain] Bagong Laban: 15 actions (24.9s)
  [brain] Pulang Bagwis: 0 actions (26.0s)
  [brain] Hacienda Verde: 12 actions (31.9s)
  [brain] Marco Gamefarm: 0 actions (33.2s)
  [brain] Ilonggo Ironworks: 11 actions (38.6s)
  [brain] Cuchillos de Sonora: 15 actions (44.9s)
Day 11 (Tuesday): 78 fights, 0 unmatched, 8 claims settled, staking paid 916.77 GP to 21 stakers — 45.6s
  [brain] Marco Gamefarm: 11 actions (8.3s)
  [brain] Sugalan Social Club: 2 actions (9.7s)
  [brain] Batangas Sprint Club: 0 actions (10.9s)
  [brain] Talisay Tari Club: 12 actions (17.4s)
  [brain] Cavite Bloodlines: 11 actions (25.1s)
  [brain] Cuchillos de Sonora: 13 actions (35.2s)
  [brain] Hacienda Verde: 0 actions (36.5s)
  [brain] Bagong Laban: 13 actions (42.3s)
  [brain] Pulang Bagwis: 0 actions (43.4s)
  [brain] Ilonggo Ironworks: 2 actions (45.1s)
Day 12 (Wednesday): 88 fights, 0 unmatched, 4 claims settled, staking paid 877.58 GP to 21 stakers — 45.5s
  [brain] Pulang Bagwis: 7 actions (4.6s)
  [brain] Batangas Sprint Club: 5 actions (7.5s)
  [brain] Ilonggo Ironworks: 0 actions (9.0s)
  [brain] Cuchillos de Sonora: 8 actions (13.0s)
  [brain] Bagong Laban: 0 actions (14.6s)
  [brain] Hacienda Verde: 12 actions (22.8s)
  [brain] Sugalan Social Club: 0 actions (24.0s)
  [brain] Cavite Bloodlines: 12 actions (29.4s)
  [brain] Talisay Tari Club: 0 actions (30.7s)
  [brain] Marco Gamefarm: 11 actions (38.7s)
Day 13 (Thursday): 45 fights, 2 unmatched, 7 claims settled, staking paid 1052.65 GP to 21 stakers — 39.1s
  [brain] Marco Gamefarm: 11 actions (7.4s)
  [brain] Talisay Tari Club: 12 actions (15.0s)
  [brain] Cuchillos de Sonora: 8 actions (18.2s)
  [brain] Bagong Laban: 0 actions (19.6s)
  [brain] Pulang Bagwis: 8 actions (24.7s)
  [brain] Hacienda Verde: 8 actions (30.1s)
  [brain] Sugalan Social Club: 0 actions (31.4s)
  [brain] Ilonggo Ironworks: 0 actions (32.9s)
  [brain] Cavite Bloodlines: 12 actions (38.1s)
  [brain] Batangas Sprint Club: 9 actions (43.9s)
Day 14 (Friday): 84 fights, 1 unmatched, 3 claims settled, staking paid 858.78 GP to 21 stakers — HATCH FRIDAY (2 hatched) — 44.3s
        wk 2 · 7 days in 4:50 · avg 41.39s/day
  [brain] Ilonggo Ironworks: 7 actions (5.1s)
  [brain] Batangas Sprint Club: 14 actions (10.7s)
  [brain] Hacienda Verde: 0 actions (12.6s)
  [brain] Cuchillos de Sonora: 17 actions (19.5s)
  [brain] Marco Gamefarm: 16 actions (28.3s)
  [brain] Pulang Bagwis: 9 actions (35.3s)
  [brain] Sugalan Social Club: 2 actions (36.8s)
  [brain] Talisay Tari Club: 0 actions (38.3s)
  [brain] Cavite Bloodlines: 0 actions (40.2s)
  [brain] Bagong Laban: 13 actions (46.5s)
Day 15 (Saturday): 118 fights, 0 unmatched, 7 claims settled, staking paid 1016.21 GP to 21 stakers — 46.9s
  [brain] Ilonggo Ironworks: 2 actions (1.8s)
  [brain] Cavite Bloodlines: 0 actions (3.2s)
  [brain] Hacienda Verde: 6 actions (6.7s)
  [brain] Pulang Bagwis: 7 actions (9.9s)
  [brain] Batangas Sprint Club: 0 actions (11.3s)
  [brain] Marco Gamefarm: 0 actions (12.7s)
  [brain] Sugalan Social Club: 0 actions (14.1s)
  [brain] Talisay Tari Club: 11 actions (20.8s)
  [brain] Cuchillos de Sonora: 7 actions (25.9s)
  [brain] Bagong Laban: 0 actions (27.2s)
Day 16 (Sunday): 93 fights, 2 unmatched, 1 claims settled, staking paid 917.41 GP to 21 stakers — 27.6s
  [brain] Cuchillos de Sonora: 0 actions (1.8s)
  [brain] Bagong Laban: 0 actions (3.5s)
  [brain] Sugalan Social Club: 11 actions (10.3s)
  [brain] Ilonggo Ironworks: 1 actions (11.9s)
  [brain] Batangas Sprint Club: 14 actions (17.7s)
  [brain] Hacienda Verde: 0 actions (19.0s)
  [brain] Pulang Bagwis: 7 actions (23.7s)
  [brain] Marco Gamefarm: 0 actions (25.0s)
  [brain] Cavite Bloodlines: 0 actions (26.3s)
  [brain] Talisay Tari Club: 11 actions (33.1s)
Day 17 (Monday): 94 fights, 0 unmatched, 4 claims settled, staking paid 849.00 GP to 21 stakers — 33.5s
  [brain] Cavite Bloodlines: 0 actions (1.6s)
  [brain] Batangas Sprint Club: 11 actions (8.9s)
  [brain] Marco Gamefarm: 0 actions (10.4s)
  [brain] Ilonggo Ironworks: 8 actions (15.9s)
  [brain] Hacienda Verde: 0 actions (17.4s)
  [brain] Cuchillos de Sonora: 0 actions (19.3s)
  [brain] Bagong Laban: 0 actions (20.9s)
  [brain] Talisay Tari Club: 0 actions (22.4s)
  [brain] Sugalan Social Club: 19 actions (28.4s)
  [brain] Pulang Bagwis: 0 actions (29.8s)
Day 18 (Tuesday): 67 fights, 2 unmatched, 4 claims settled, staking paid 1042.78 GP to 21 stakers — 30.1s
  [brain] Cavite Bloodlines: 0 actions (1.7s)
  [brain] Cuchillos de Sonora: 2 actions (4.4s)
  [brain] Pulang Bagwis: 1 actions (6.3s)
  [brain] Hacienda Verde: 0 actions (8.3s)
  [brain] Ilonggo Ironworks: 11 actions (15.1s)
  [brain] Sugalan Social Club: 13 actions (23.4s)
  [brain] Marco Gamefarm: 13 actions (28.9s)
  [brain] Batangas Sprint Club: 0 actions (30.7s)
  [brain] Bagong Laban: 1 actions (33.1s)
  [brain] Talisay Tari Club: 8 actions (37.0s)
Day 19 (Wednesday): 102 fights, 4 unmatched, 9 claims settled, staking paid 868.83 GP to 21 stakers — 37.4s
  [brain] Cavite Bloodlines: 12 actions (4.9s)
  [brain] Talisay Tari Club: 8 actions (8.8s)
  [brain] Marco Gamefarm: 11 actions (13.0s)
  [brain] Sugalan Social Club: 0 actions (14.3s)
  [brain] Batangas Sprint Club: 15 actions (20.6s)
  [brain] Pulang Bagwis: 0 actions (22.0s)
  [brain] Cuchillos de Sonora: 0 actions (24.0s)
  [brain] Bagong Laban: 0 actions (25.8s)
  [brain] Ilonggo Ironworks: 12 actions (31.9s)
  [brain] Hacienda Verde: 0 actions (33.4s)
Day 20 (Thursday): 77 fights, 6 unmatched, 5 claims settled, staking paid 862.38 GP to 21 stakers — 33.8s
  [brain] Cuchillos de Sonora: 0 actions (2.0s)
  [brain] Talisay Tari Club: 0 actions (3.5s)
  [brain] Hacienda Verde: 0 actions (5.0s)
  [brain] Ilonggo Ironworks: 0 actions (6.5s)
  [brain] Cavite Bloodlines: 11 actions (13.3s)
  [brain] Batangas Sprint Club: 8 actions (17.8s)
  [brain] Bagong Laban: 12 actions (25.2s)
  [brain] Pulang Bagwis: 11 actions (32.8s)
  [brain] Marco Gamefarm: 12 actions (40.6s)
  [brain] Sugalan Social Club: 0 actions (41.9s)
Day 21 (Friday): 115 fights, 1 unmatched, 6 claims settled, staking paid 864.19 GP to 21 stakers — HATCH FRIDAY (0 hatched) — 42.3s
        wk 3 · 7 days in 4:12 · avg 35.95s/day
  [brain] Talisay Tari Club: 0 actions (2.3s)
  [brain] Ilonggo Ironworks: 12 actions (7.8s)
  [brain] Bagong Laban: 14 actions (17.7s)
  [brain] Pulang Bagwis: 2 actions (19.8s)
  [brain] Hacienda Verde: 15 actions (26.6s)
  [brain] Batangas Sprint Club: 0 actions (28.7s)
  [brain] Marco Gamefarm: 0 actions (31.4s)
  [brain] Cuchillos de Sonora: 10 actions (37.4s)
  [brain] Sugalan Social Club: 0 actions (39.2s)
  [brain] Cavite Bloodlines: 0 actions (41.4s)
Day 22 (Saturday): 127 fights, 5 unmatched, 9 claims settled, staking paid 866.21 GP to 21 stakers — 41.9s
  [brain] Sugalan Social Club: 10 actions (4.6s)
  [brain] Cavite Bloodlines: 12 actions (13.4s)
  [brain] Batangas Sprint Club: 13 actions (19.4s)
  [brain] Hacienda Verde: 8 actions (23.3s)
  [brain] Bagong Laban: 0 actions (24.9s)
  [brain] Talisay Tari Club: 11 actions (32.6s)
  [brain] Marco Gamefarm: 13 actions (41.6s)
  [brain] Pulang Bagwis: 9 actions (47.2s)
  [brain] Ilonggo Ironworks: 9 actions (53.4s)
  [brain] Cuchillos de Sonora: 0 actions (55.4s)
Day 23 (Sunday): 145 fights, 2 unmatched, 5 claims settled, staking paid 1866.00 GP to 21 stakers — 56.0s
  [brain] Cavite Bloodlines: 18 actions (7.2s)
  [brain] Bagong Laban: 28 actions (16.3s)
  [brain] Pulang Bagwis: 10 actions (20.8s)
  [brain] Talisay Tari Club: 11 actions (28.6s)
  [brain] Marco Gamefarm: 13 actions (34.7s)
  [brain] Ilonggo Ironworks: 13 actions (43.3s)
  [brain] Cuchillos de Sonora: 7 actions (46.7s)
  [brain] Batangas Sprint Club: 0 actions (48.4s)
  [brain] Sugalan Social Club: 0 actions (50.0s)
  [brain] Hacienda Verde: 9 actions (54.1s)
Day 24 (Monday): 98 fights, 0 unmatched, 4 claims settled, staking paid 903.19 GP to 21 stakers — 54.6s
  [brain] Cavite Bloodlines: 0 actions (1.5s)
  [brain] Pulang Bagwis: 11 actions (6.9s)
  [brain] Cuchillos de Sonora: 2 actions (8.7s)
  [brain] Hacienda Verde: 14 actions (14.8s)
  [brain] Marco Gamefarm: 13 actions (23.4s)
  [brain] Bagong Laban: 2 actions (25.3s)
  [brain] Batangas Sprint Club: 9 actions (32.1s)
  [brain] Talisay Tari Club: 0 actions (33.6s)
  [brain] Ilonggo Ironworks: 12 actions (42.2s)
  [brain] Sugalan Social Club: 7 actions (46.9s)
Day 25 (Tuesday): 102 fights, 0 unmatched, 4 claims settled, staking paid 943.21 GP to 21 stakers — 47.3s
  [brain] Cavite Bloodlines: 12 actions (5.0s)
  [brain] Pulang Bagwis: 8 actions (9.7s)
  [brain] Batangas Sprint Club: 14 actions (19.8s)
  [brain] Ilonggo Ironworks: 8 actions (25.7s)
  [brain] Cuchillos de Sonora: 10 actions (29.9s)
  [brain] Marco Gamefarm: 10 actions (36.5s)
  [brain] Hacienda Verde: 11 actions (41.4s)
  [brain] Sugalan Social Club: 0 actions (42.8s)
  [brain] Bagong Laban: 13 actions (48.6s)
  [brain] Talisay Tari Club: 11 actions (53.9s)
Day 26 (Wednesday): 142 fights, 0 unmatched, 5 claims settled, staking paid 864.21 GP to 21 stakers — 54.4s
  [brain] Cavite Bloodlines: 12 actions (7.7s)
  [brain] Cuchillos de Sonora: 8 actions (13.1s)
  [brain] Bagong Laban: 6 actions (16.5s)
  [brain] Ilonggo Ironworks: 12 actions (21.9s)
  [brain] Hacienda Verde: 11 actions (29.4s)
  [brain] Pulang Bagwis: 0 actions (30.7s)
  [brain] Sugalan Social Club: 11 actions (37.2s)
  [brain] Batangas Sprint Club: 14 actions (43.5s)
  [brain] Talisay Tari Club: 0 actions (45.1s)
  [brain] Marco Gamefarm: 14 actions (51.4s)
Day 27 (Thursday): 79 fights, 1 unmatched, 3 claims settled, staking paid 935.21 GP to 21 stakers — 51.8s
  [brain] Cavite Bloodlines: 2 actions (1.8s)
  [brain] Cuchillos de Sonora: 0 actions (3.6s)
  [brain] Pulang Bagwis: 0 actions (5.4s)
  [brain] Marco Gamefarm: 0 actions (7.1s)
  [brain] Sugalan Social Club: 10 actions (13.5s)
  [brain] Talisay Tari Club: 11 actions (18.4s)
  [brain] Bagong Laban: 0 actions (19.9s)
  [brain] Ilonggo Ironworks: 7 actions (23.5s)
  [brain] Batangas Sprint Club: 1 actions (25.2s)
  [brain] Hacienda Verde: 0 actions (27.0s)
Day 28 (Friday): 12 fights, 0 unmatched, 0 claims settled, staking paid 919.99 GP to 21 stakers — HATCH FRIDAY (0 hatched) — 27.6s
        wk 4 · 7 days in 5:34 · avg 47.65s/day

TIMING
  seed + bots      0.0s
  simulation      16:41   (28 day(s), avg 35.75s/day · honest 7% / tick 93%)
  brains          16:31   (35.39s/day · 99% of the run, 280 call(s), 0 failed)
  doctor           0.5s
  total           16:42
  slowest days d23 56.0s · d24 54.6s · d26 54.4s
  per unit     489.25 ms/fight · 672.26 ms/entry

BARN CAREERS (durable actor state — persists across runs)
  bot-7     28 day(s) played · last day 27 · 139 proposed, 17 dropped, 0 failure(s) · 588.2s thinking
  bot-8     28 day(s) played · last day 27 · 141 proposed, 18 dropped, 0 failure(s) · 524.0s thinking
  bot-9     28 day(s) played · last day 27 · 142 proposed, 29 dropped, 0 failure(s) · 410.9s thinking
  bot-marco  28 day(s) played · last day 27 · 180 proposed, 23 dropped, 0 failure(s) · 561.2s thinking
  bot-12    28 day(s) played · last day 27 · 171 proposed, 19 dropped, 0 failure(s) · 536.9s thinking
  bot-13    28 day(s) played · last day 27 · 147 proposed, 7 dropped, 0 failure(s) · 609.3s thinking
  bot-14    28 day(s) played · last day 27 · 110 proposed, 11 dropped, 0 failure(s) · 613.8s thinking
  bot-15    28 day(s) played · last day 27 · 145 proposed, 6 dropped, 0 failure(s) · 531.2s thinking
  bot-16    28 day(s) played · last day 27 · 119 proposed, 18 dropped, 0 failure(s) · 578.6s thinking
  bot-17    28 day(s) played · last day 27 · 150 proposed, 10 dropped, 0 failure(s) · 577.9s thinking

PINTAKASI DOCTOR · data/sim-20260815-0245.db
day 28 · Friday, January 31, 3000 · week 4 · 21 farms · 239 birds

INVARIANTS
  PASS  GP conservation            571,200.00 GP in world = 571,200.00 expected
  PASS  LT conservation            142,335.15 LT held = 142,335.15 LT ledgered
  PASS  no negative balances       staker 0.10 · juice 0.01 · 21 wallets clean
  PASS  pit figures                2046 fights · 2046 mirrored · 0 inversions
  PASS  purses settle              8 completed crown(s), exact to the cent
  PASS  no stranded entries        9 resolved championship(s), every entry settled
  PASS  one card per bird per day  1489 entries across 1489 bird-days · 0 over cap
  PASS  fight counts match the log 1489 settled entries · 3822 fights claimed · 0 mismatched
  PASS  scout book matches the log 681 book lines audited · 0 out of step

CARD HEALTH
  1489 entries · 1463 fought · 26 unmatched (1.7%) · 146 lobbies
  weather timing  353/1235 starred entries ran on the bird's own element day (28.6% vs 20.0% by chance, 1.43×) ✓ entries are being timed

GROUP STAGE
  fights per settled entry  mean 2.57 of 3 · 1489 settled entries
  full cards  972 (65.3%) took all 3 · short 491 (33.0%) fought 1–2 · 26 (1.7%) never fought
  groups  425 dealt · mean 3.50 birds · 4 of one (4 were the lobby's only entry)

LOBBY FILL
  mean 10.20 birds per lobby · 146 lobbies · 4 held a single bird (2.7%)
      1 █                        2.7%
    2-3 ██████                   26.7%
    4-7 █████                    21.9%
   8-15 █████                    20.5%
    16+ ███████                  28.1%
  same-barn-only lobbies 8 · 17 birds stranded with no cross-barn opponent

WORST LOBBY KEYS
  real/nw3/b3                           8 entries, 50.0% unmatched
  real/claimer/b2@90                   10 entries, 20.0% unmatched
  juvenile/maiden/b1                    9 entries, 11.1% unmatched

POPULATION
  eggs 0 · active 151 · retired 88 · 21 farms
  by age  1:22  2:15  3:15  4:99
  supply  hatches 239 · gacha eggs 71 · covers 0
  loss    hardcore 88
  barns   0 of 21 at capacity · 0 expansion(s) bought

FIGHT VOLUME
  wk  0       0  
  wk  1     496  ███████████████
  wk  2     637  ███████████████████
  wk  3     813  ████████████████████████
  wk  4     100  ███  (1 day)

BLOODLINES
  gen   birds   mean grade     stars   home margin
  0       239   B+ ( 331.5)    1.37★      8.6
  · nothing has been bred yet — every bird in the world is a founder

FIGHT ECONOMY BY RUNG
    rung                      fee  entries  share   GP risked   LT minted  LT/100GP
    juvenile/claimer@90        24       22   1.5%         480       69.96     14.57
    juvenile/maiden            30       34   2.3%         700      103.24     14.75
    juvenile/claimer@180       48       41   2.8%       1,664      267.10     16.05
    real/claimer@90            48      119   8.0%       4,640      743.90     16.03
    real/maiden                60       27   1.8%         920      148.26     16.12
    real/nw3                   60       39   2.6%       1,720      286.93     16.68
    juvenile/claimer@270       72       22   1.5%       1,200      201.36     16.78
    real/claimer@180           96       76   5.1%       6,400    1,143.16     17.86
    real/claimer@270          144       38   2.6%       4,128      773.58     18.74
    juvenile/open             150      365  24.5%      45,600    8,687.64     19.05
    real/open                 300      706  47.4%     191,800   40,801.02     21.27

LAND SUPPLY
  circulating 142,335.15 LT · 138,819.00 staked (97.5%) · 3,516.15 idle
  minted      142,335.15 LT over 29 day(s) · 4,908.11 LT per day
    purse_payout     60,000.00 LT   42.2%
    card_settled     53,226.15 LT   37.4%
    buy_land         28,000.00 LT   19.7%
    gacha             1,109.00 LT    0.8%
  burned      0.00 LT (0.0% of issuance) — the sinks
  valuation   at $0.01/LT (pencilled) the world has issued $1,423 of land against $7,140 of GP faucet — $0.20 of LT per $1 of GP
  runway      100B-token target reached in 10,000+ year(s) at this population's rate — scales with farms, not with time

REPLAY
  205/205 sampled fight rows rebuild exactly from their seed

STAKER POOL
  paid out 27,428.50 GP over 28 day(s) · 0.10 waiting · 138,819.00 LT staked
  land_purchase 22,400.00 · gacha 4,728.00 · claim_rake 300.60

CHAMPIONSHIPS
  major     3 run / 0 cancelled · field 30.3 · purse 42,913.21
            paid 47/91 entrants (52%) · biggest take 13.2% of all purse GP · smallest 208.95 GP
            entry fees 14,560.00 GP fund 34% of the purse · the rest is juice (gacha + breed fees) · net to the field 28,353.21 GP
            under the door 0/47 winners (0%) took less purse than their entry fee
  juvenile  5 run / 1 cancelled · field 10.4 · purse 19,094.78
            paid 27/52 entrants (52%) · biggest take 27.3% of all purse GP · smallest 71.18 GP
            entry fees 2,496.00 GP fund 13% of the purse · the rest is juice (gacha + breed fees) · net to the field 16,598.78 GP
            under the door 0/27 winners (0%) took less purse than their entry fee

MECHANIC ADOPTION            farms of 21
  claims placed             21  █████████████████████
  studs listed               0  ░░░░░░░░░░░░░░░░░░░░░  ⚠ NOBODY WALKED THROUGH
  land purchased             1  █░░░░░░░░░░░░░░░░░░░░
  paid gacha rolls          10  ██████████░░░░░░░░░░░
  gacha bundles bought       1  █░░░░░░░░░░░░░░░░░░░░
  barn expanded              0  ░░░░░░░░░░░░░░░░░░░░░  ⚠ NOBODY WALKED THROUGH
  Major entries             19  ███████████████████░░
  juvenile championship     11  ███████████░░░░░░░░░░
  ⚠ 2 door(s) unused: studs listed, barn expanded

DISCOVERY
  age 1    carded 274/1196 at the true best blade (22.9% vs random 20.0%) · 50.9% on or adjacent (random 48.1%) · answer coverage 37.2% · SCOUT 200/445 right (44.9% vs random 20.0%), 68.5% on or adjacent · clear home 122/227 (53.7%, 67.0% adjacent)
  age 2–3  carded 723/2626 at the true best blade (27.5% vs random 20.0%) · 55.8% on or adjacent (random 48.3%) · answer coverage 72.0% · SCOUT 674/1890 right (35.7% vs random 20.0%), 62.7% on or adjacent · clear home 393/898 (43.8%, 67.4% adjacent)
  age 4+   0 card decisions — too few to read
  explored  5/5 blades saw an age-1 entry in the discovery year
  flock shape  median home blade beats its runner-up by 8.6 pts · 43.5% of birds clear the 10-pt bar
  ⚠ only 43.5% of birds have a home blade worth finding — the flock is being bred flat, so there is little for discovery to discover

2 warnings · 0 invariant failures

Done → /Users/plumeria/Repos/pintakasi-bloodlines/data/sim-20260815-0245.db
Run `bun dev:sim` and open http://localhost:3435/admin — it always shows the newest sim.
```

---

## Coach session #1 — day 28 (2026-08-16, overnight)

World: `sim-20260815-0245`. Segment 1 health: 280 calls / 0 failed /
35.39 s/day · 0 invariant failures.

## Scoreboard at day 28

```
  scripted (10): total net worth 388,337 · avg 38,834 · crowns 7
  llm      (10): total net worth 253,887 · avg 25,389 · crowns 0
```

Scripted 1–9, llm 10–19 — same shape as exp1. But Ginto (tamed this
experiment) sits at rank 20 with a real game: 13,958 net worth and a crown
win, versus exp1's three-digit wreck. The scripted side is now ten honest
competitors.

## The v2 preamble: two of three laws took from day 1

- **Law 1 (volume): took.** 794 enter proposals vs exp1-seg1's 487.
  bot-marco — exp1's laggard at 40 — leads the fleet at 111.
- **Law 2 (crowns): took.** 126 crown proposals, 13 real tournament entries
  by day 28. In exp1 the first declaration came on day 58, post-instrument-fix.
  Results so far: 11 eliminated, 2 bumped — declaring, not yet winning.
- **Law 3 (pipeline): did NOT take.** One breed. And this time the stock
  excuse is gone: bot-15, bot-17, bot-9, and bot-marco each hold a retired
  hen AND a stud in their brief. The models under-weight the pipeline when
  volume and crowns are shouting.

Fights still 826 vs 2,814 — the volume law took at the *proposal* level but
scripted rosters are deeper (they breed), so the fleet-level fight gap is
now chiefly a roster-size gap. Which is law 3 again.

## Orders written

| Barns | Creed | Order (gist) |
|---|---|---|
| bot-7, bot-15 | card shark | Keep volume + crowns; when the brief lists a hen and a stud, breed that day, every time space allows. |
| bot-marco, bot-9 | bloodline architect | Card volume is fixed — run your actual trade: you have a hen and stud RIGHT NOW; breed today and every time space allows. |
| bot-8, bot-16 | claim scout | Volume slipped — every healthy bird, every day. Keep claims + crowns; breed when stock lines up. |
| bot-14, bot-12 | talent scout | Fight your pulls — lowest entry counts in the fleet. Keep rolling + crowns; breed when stock lines up. |
| bot-13, bot-17 | operator | Stay the course; add breeding whenever stock lines up and keep a weekly crown declaration out. |

Operational: nine tunes cold, bot-7 refused three cold attempts (its
recurring first-contact wedge) and bound **first try mid-run** once segment
2 was live — the phase-3 finding, now twice confirmed as the reliable path.

## What day 56 must show

1. Breeds per architect at pipeline cadence (≥1/week each), not ~zero.
2. First llm crown WIN (declarations already flowing).
3. Fleet fight volume closing toward scripted as rosters deepen.
