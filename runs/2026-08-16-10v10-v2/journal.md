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

---

## Segment 2 — days 29–56 (verbatim sim log; two host-reap interruptions, two clean resumes)

```
$ bun run scripts/simulate.ts "28" --keep "--seed=1" "--brain=qwen3:30b-a3b" "--llm=bot-7,bot-15,bot-marco,bot-9,bot-8,bot-16,bot-14,bot-12,bot-13,bot-17" --actors
Brain: qwen3:30b-a3b plays 10 stable(s) — bot-7, bot-15, bot-marco, bot-9, bot-8, bot-16, bot-14, bot-12, bot-13, bot-17

  [brain] Sugalan Social Club: 2 actions (13.2s)
  [brain] Pulang Bagwis: 10 actions (18.6s)
  [brain] Bagong Laban: 0 actions (19.9s)
  [brain] Cavite Bloodlines: 0 actions (21.2s)
  [brain] Batangas Sprint Club: 0 actions (22.5s)
  [brain] Marco Gamefarm: 9 actions (27.5s)
  [brain] Hacienda Verde: 0 actions (28.7s)
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"18uksx5w1lx7ggn29j8k1aycq4dl00\"}"
  [brain] Cuchillos de Sonora: 0 actions (30.1s)
  [brain] Ilonggo Ironworks: 7 actions (34.2s)
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"18uksx5w1lx7ggn29j8k1aycq4dl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"18uksx5w1lx7ggn29j8k1aycq4dl00\"}"
[bot-brain] bot-7 proposed nothing: Actor failed to start (18uksx5w1lx7ggn29j8k1aycq4dl00): "no_envoys"
Day 29 (Saturday): 16 fights, 1 unmatched, 2 claims settled, staking paid 1799.21 GP to 21 stakers — 2:01
  [brain] Marco Gamefarm: 8 actions (4.2s)
  [brain] Bagong Laban: 0 actions (5.5s)
  [brain] Hacienda Verde: 6 actions (8.1s)
  [brain] Batangas Sprint Club: 7 actions (11.2s)
  [brain] Cavite Bloodlines: 10 actions (14.8s)
  [brain] Cuchillos de Sonora: 0 actions (16.1s)
  [brain] Sugalan Social Club: 8 actions (19.0s)
  [brain] Pulang Bagwis: 11 actions (25.1s)
  [brain] Ilonggo Ironworks: 0 actions (26.5s)
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"18uksx5w1lx7ggn29j8k1aycq4dl00\"}"
Day 30 (Sunday): 31 fights, 2 unmatched, 2 claims settled, staking paid 987.57 GP to 21 stakers — 48.0s
  [brain] Sugalan Social Club: 8 actions (4.8s)
  [brain] Talisay Tari Club: 7 actions (8.9s)
  [brain] Ilonggo Ironworks: 0 actions (10.1s)
  [brain] Hacienda Verde: 0 actions (11.2s)
  [brain] Marco Gamefarm: 10 actions (15.5s)
  [brain] Cavite Bloodlines: 17 actions (23.8s)
  [brain] Bagong Laban: 2 actions (25.3s)
  [brain] Batangas Sprint Club: 2 actions (26.8s)
  [brain] Cuchillos de Sonora: 10 actions (32.4s)
  [brain] Pulang Bagwis: 9 actions (35.6s)
Day 31 (Monday): 37 fights, 1 unmatched, 3 claims settled, staking paid 1041.02 GP to 21 stakers — 35.9s
  [brain] Ilonggo Ironworks: 7 actions (4.4s)
  [brain] Talisay Tari Club: 1 actions (5.8s)
  [brain] Bagong Laban: 0 actions (7.0s)
  [brain] Marco Gamefarm: 7 actions (9.7s)
  [brain] Cuchillos de Sonora: 0 actions (11.0s)
  [brain] Sugalan Social Club: 5 actions (13.3s)
  [brain] Cavite Bloodlines: 1 actions (14.5s)
  [brain] Hacienda Verde: 7 actions (18.4s)
  [brain] Batangas Sprint Club: 1 actions (19.7s)
  [brain] Pulang Bagwis: 0 actions (20.8s)
Day 32 (Tuesday): 17 fights, 4 unmatched, 4 claims settled, staking paid 890.00 GP to 21 stakers — 21.0s
  [brain] Marco Gamefarm: 12 actions (4.3s)
  [brain] Cavite Bloodlines: 12 actions (8.6s)
  [brain] Batangas Sprint Club: 8 actions (13.2s)
  [brain] Sugalan Social Club: 0 actions (14.1s)
  [brain] Talisay Tari Club: 0 actions (15.3s)
  [brain] Pulang Bagwis: 0 actions (16.5s)
  [brain] Ilonggo Ironworks: 8 actions (19.6s)
  [brain] Bagong Laban: 0 actions (20.8s)
  [brain] Cuchillos de Sonora: 0 actions (21.9s)
  [brain] Hacienda Verde: 11 actions (28.3s)
Day 33 (Wednesday): 21 fights, 5 unmatched, 1 claims settled, staking paid 955.59 GP to 21 stakers — 28.7s
  [brain] Ilonggo Ironworks: 7 actions (4.4s)
  [brain] Talisay Tari Club: 7 actions (8.1s)
  [brain] Bagong Laban: 7 actions (11.9s)
  [brain] Batangas Sprint Club: 0 actions (13.1s)
  [brain] Cavite Bloodlines: 8 actions (17.2s)
  [brain] Hacienda Verde: 0 actions (18.4s)
  [brain] Marco Gamefarm: 0 actions (19.7s)
  [brain] Cuchillos de Sonora: 7 actions (22.9s)
  [brain] Sugalan Social Club: 1 actions (24.0s)
  [brain] Pulang Bagwis: 9 actions (28.9s)
Day 34 (Thursday): 22 fights, 1 unmatched, 0 claims settled, staking paid 856.01 GP to 21 stakers — 29.1s
  [brain] Sugalan Social Club: 0 actions (1.2s)
  [brain] Batangas Sprint Club: 1 actions (2.7s)
  [brain] Ilonggo Ironworks: 0 actions (4.2s)
  [brain] Marco Gamefarm: 7 actions (7.6s)
  [brain] Hacienda Verde: 6 actions (10.7s)
  [brain] Bagong Laban: 6 actions (14.3s)
  [brain] Cuchillos de Sonora: 0 actions (15.7s)
  [brain] Talisay Tari Club: 8 actions (20.4s)
  [brain] Pulang Bagwis: 0 actions (21.6s)
  [brain] Cavite Bloodlines: 6 actions (25.3s)
Day 35 (Friday): 11 fights, 1 unmatched, 3 claims settled, staking paid 986.82 GP to 21 stakers — HATCH FRIDAY (0 hatched) — 25.6s
        wk 5 · 7 days in 5:09 · avg 44.14s/day
  [brain] Cavite Bloodlines: 8 actions (4.3s)
  [brain] Sugalan Social Club: 10 actions (9.4s)
  [brain] Bagong Laban: 7 actions (13.1s)
  [brain] Pulang Bagwis: 7 actions (17.2s)
  [brain] Marco Gamefarm: 0 actions (18.4s)
  [brain] Cuchillos de Sonora: 6 actions (22.4s)
  [brain] Hacienda Verde: 0 actions (23.6s)
  [brain] Batangas Sprint Club: 14 actions (28.9s)
  [brain] Ilonggo Ironworks: 21 actions (36.4s)
  [brain] Talisay Tari Club: 9 actions (42.0s)
Day 36 (Saturday): 52 fights, 4 unmatched, 0 claims settled, staking paid 1263.97 GP to 21 stakers — 42.4s
  [brain] Batangas Sprint Club: 7 actions (4.8s)
  [brain] Cavite Bloodlines: 9 actions (10.3s)
  [brain] Ilonggo Ironworks: 2 actions (12.0s)
  [brain] Pulang Bagwis: 10 actions (17.9s)
  [brain] Sugalan Social Club: 8 actions (22.5s)
  [brain] Marco Gamefarm: 7 actions (26.6s)
  [brain] Talisay Tari Club: 0 actions (28.0s)
  [brain] Hacienda Verde: 0 actions (29.5s)
  [brain] Cuchillos de Sonora: 10 actions (35.8s)
  [brain] Bagong Laban: 5 actions (39.7s)
Day 37 (Sunday): 15 fights, 2 unmatched, 1 claims settled, staking paid 1113.83 GP to 21 stakers — 40.0s
  [brain] Cavite Bloodlines: 9 actions (3.4s)
  [brain] Marco Gamefarm: 12 actions (8.0s)
  [brain] Cuchillos de Sonora: 12 actions (12.6s)
  [brain] Bagong Laban: 0 actions (14.1s)
  [brain] Ilonggo Ironworks: 0 actions (15.7s)
  [brain] Batangas Sprint Club: 8 actions (18.9s)
  [brain] Sugalan Social Club: 0 actions (19.9s)
  [brain] Pulang Bagwis: 0 actions (21.3s)
  [brain] Talisay Tari Club: 9 actions (27.1s)
  [brain] Hacienda Verde: 0 actions (28.6s)
Day 38 (Monday): 30 fights, 7 unmatched, 1 claims settled, staking paid 981.38 GP to 21 stakers — 28.9s
  [brain] Talisay Tari Club: 8 actions (5.5s)
  [brain] Cavite Bloodlines: 7 actions (8.3s)
  [brain] Sugalan Social Club: 2 actions (9.8s)
  [brain] Ilonggo Ironworks: 2 actions (11.6s)
  [brain] Batangas Sprint Club: 9 actions (17.7s)
  [brain] Hacienda Verde: 0 actions (19.2s)
  [brain] Pulang Bagwis: 0 actions (20.9s)
  [brain] Bagong Laban: 9 actions (24.9s)
  [brain] Cuchillos de Sonora: 13 actions (29.5s)
  [brain] Marco Gamefarm: 11 actions (33.4s)
Day 39 (Tuesday): 26 fights, 0 unmatched, 4 claims settled, staking paid 1078.41 GP to 21 stakers — 33.7s
  [brain] Pulang Bagwis: 11 actions (4.3s)
  [brain] Talisay Tari Club: 0 actions (5.9s)
  [brain] Sugalan Social Club: 2 actions (7.5s)
  [brain] Marco Gamefarm: 5 actions (10.0s)
  [brain] Cuchillos de Sonora: 7 actions (14.5s)
  [brain] Bagong Laban: 7 actions (19.1s)
error: script "simulate" was terminated by signal SIGTERM (Polite quit request)
$ bun run scripts/simulate.ts "17" --keep "--seed=1" "--brain=qwen3:30b-a3b" "--llm=bot-7,bot-15,bot-marco,bot-9,bot-8,bot-16,bot-14,bot-12,bot-13,bot-17" --actors
Brain: qwen3:30b-a3b plays 10 stable(s) — bot-7, bot-15, bot-marco, bot-9, bot-8, bot-16, bot-14, bot-12, bot-13, bot-17

  [brain] Ilonggo Ironworks: 10 actions (15.0s)
  [brain] Bagong Laban: 6 actions (18.7s)
  [brain] Pulang Bagwis: 9 actions (23.8s)
  [brain] Hacienda Verde: 6 actions (26.3s)
  [brain] Batangas Sprint Club: 0 actions (27.5s)
  [brain] Marco Gamefarm: 9 actions (32.1s)
  [brain] Cavite Bloodlines: 7 actions (34.4s)
  [brain] Sugalan Social Club: 0 actions (35.3s)
  [brain] Talisay Tari Club: 14 actions (39.7s)
  [brain] Cuchillos de Sonora: 6 actions (43.2s)
Day 40 (Wednesday): 43 fights, 2 unmatched, 1 claims settled, staking paid 921.80 GP to 21 stakers — 43.6s
  [brain] Hacienda Verde: 6 actions (3.6s)
  [brain] Cuchillos de Sonora: 7 actions (7.6s)
  [brain] Talisay Tari Club: 1 actions (9.0s)
  [brain] Batangas Sprint Club: 8 actions (13.7s)
  [brain] Bagong Laban: 8 actions (16.8s)
  [brain] Ilonggo Ironworks: 0 actions (17.9s)
  [brain] Sugalan Social Club: 1 actions (18.9s)
  [brain] Cavite Bloodlines: 3 actions (20.3s)
  [brain] Marco Gamefarm: 0 actions (21.3s)
  [brain] Pulang Bagwis: 7 actions (25.2s)
Day 41 (Thursday): 11 fights, 2 unmatched, 0 claims settled, staking paid 999.98 GP to 21 stakers — 25.4s
  [brain] Cuchillos de Sonora: 0 actions (1.4s)
  [brain] Bagong Laban: 0 actions (2.6s)
  [brain] Marco Gamefarm: 0 actions (3.6s)
  [brain] Pulang Bagwis: 9 actions (7.1s)
  [brain] Hacienda Verde: 7 actions (9.7s)
  [brain] Cavite Bloodlines: 0 actions (10.6s)
  [brain] Sugalan Social Club: 0 actions (11.6s)
  [brain] Talisay Tari Club: 7 actions (15.5s)
  [brain] Ilonggo Ironworks: 0 actions (16.6s)
  [brain] Batangas Sprint Club: 7 actions (19.2s)
Day 42 (Friday): 12 fights, 2 unmatched, 1 claims settled, staking paid 1009.81 GP to 21 stakers — HATCH FRIDAY (3 hatched) — 19.6s
        wk 6 · 3 days in 1:29 · avg 29.54s/day
  [brain] Talisay Tari Club: 8 actions (4.5s)
  [brain] Cuchillos de Sonora: 9 actions (7.7s)
  [brain] Pulang Bagwis: 0 actions (8.9s)
  [brain] Batangas Sprint Club: 8 actions (13.2s)
  [brain] Marco Gamefarm: 7 actions (16.9s)
  [brain] Cavite Bloodlines: 0 actions (17.9s)
  [brain] Sugalan Social Club: 0 actions (18.8s)
  [brain] Hacienda Verde: 9 actions (23.3s)
  [brain] Bagong Laban: 0 actions (24.8s)
  [brain] Ilonggo Ironworks: 0 actions (25.9s)
Day 43 (Saturday): 55 fights, 1 unmatched, 3 claims settled, staking paid 1789.38 GP to 21 stakers — 26.5s
  [brain] Batangas Sprint Club: 0 actions (1.5s)
  [brain] Marco Gamefarm: 0 actions (2.7s)
  [brain] Talisay Tari Club: 0 actions (3.9s)
  [brain] Sugalan Social Club: 8 actions (7.8s)
  [brain] Bagong Laban: 5 actions (11.0s)
  [brain] Cuchillos de Sonora: 6 actions (14.4s)
  [brain] Hacienda Verde: 0 actions (15.5s)
  [brain] Cavite Bloodlines: 6 actions (18.0s)
  [brain] Ilonggo Ironworks: 0 actions (19.1s)
  [brain] Pulang Bagwis: 7 actions (21.8s)
Day 44 (Sunday): 52 fights, 0 unmatched, 3 claims settled, staking paid 1040.19 GP to 21 stakers — 22.2s
  [brain] Cavite Bloodlines: 2 actions (1.5s)
  [brain] Talisay Tari Club: 7 actions (4.2s)
  [brain] Batangas Sprint Club: 0 actions (5.3s)
  [brain] Marco Gamefarm: 9 actions (8.9s)
  [brain] Sugalan Social Club: 8 actions (11.5s)
  [brain] Hacienda Verde: 10 actions (15.0s)
  [brain] Cuchillos de Sonora: 9 actions (19.3s)
  [brain] Bagong Laban: 7 actions (22.2s)
  [brain] Ilonggo Ironworks: 8 actions (26.7s)
  [brain] Pulang Bagwis: 0 actions (28.1s)
Day 45 (Monday): 52 fights, 2 unmatched, 4 claims settled, staking paid 1154.03 GP to 21 stakers — 28.5s
  [brain] Batangas Sprint Club: 0 actions (1.5s)
  [brain] Ilonggo Ironworks: 6 actions (4.7s)
  [brain] Bagong Laban: 8 actions (9.5s)
  [brain] Sugalan Social Club: 0 actions (10.4s)
  [brain] Cuchillos de Sonora: 2 actions (12.5s)
  [brain] Hacienda Verde: 0 actions (14.0s)
  [brain] Talisay Tari Club: 7 actions (17.8s)
  [brain] Cavite Bloodlines: 9 actions (21.5s)
  [brain] Marco Gamefarm: 8 actions (24.9s)
  [brain] Pulang Bagwis: 8 actions (28.4s)
Day 46 (Tuesday): 58 fights, 2 unmatched, 4 claims settled, staking paid 959.21 GP to 21 stakers — 28.8s
  [brain] Talisay Tari Club: 7 actions (4.7s)
  [brain] Cuchillos de Sonora: 9 actions (10.7s)
  [brain] Pulang Bagwis: 10 actions (14.4s)
  [brain] Hacienda Verde: 0 actions (15.8s)
  [brain] Marco Gamefarm: 9 actions (19.5s)
  [brain] Ilonggo Ironworks: 0 actions (20.8s)
  [brain] Batangas Sprint Club: 16 actions (27.1s)
  [brain] Cavite Bloodlines: 0 actions (28.3s)
  [brain] Sugalan Social Club: 0 actions (29.6s)
  [brain] Bagong Laban: 9 actions (34.6s)
Day 47 (Wednesday): 60 fights, 1 unmatched, 4 claims settled, staking paid 898.77 GP to 21 stakers — 35.1s
  [brain] Marco Gamefarm: 0 actions (1.4s)
  [brain] Ilonggo Ironworks: 7 actions (4.6s)
  [brain] Cavite Bloodlines: 7 actions (8.9s)
  [brain] Batangas Sprint Club: 10 actions (12.5s)
  [brain] Hacienda Verde: 8 actions (17.4s)
  [brain] Bagong Laban: 7 actions (22.3s)
  [brain] Sugalan Social Club: 8 actions (25.2s)
  [brain] Talisay Tari Club: 0 actions (26.6s)
  [brain] Cuchillos de Sonora: 0 actions (28.3s)
  [brain] Pulang Bagwis: 0 actions (29.9s)
Day 48 (Thursday): 17 fights, 8 unmatched, 1 claims settled, staking paid 837.41 GP to 21 stakers — 30.2s
  [brain] Batangas Sprint Club: 6 actions (3.7s)
  [brain] Sugalan Social Club: 0 actions (4.8s)
  [brain] Cavite Bloodlines: 0 actions (6.2s)
  [brain] Talisay Tari Club: 7 actions (10.9s)
  [brain] Cuchillos de Sonora: 8 actions (15.8s)
  [brain] Pulang Bagwis: 0 actions (17.4s)
  [brain] Marco Gamefarm: 8 actions (22.2s)
  [brain] Bagong Laban: 0 actions (23.7s)
  [brain] Ilonggo Ironworks: 0 actions (25.5s)
  [brain] Hacienda Verde: 9 actions (30.6s)
Day 49 (Friday): 61 fights, 8 unmatched, 4 claims settled, staking paid 855.19 GP to 21 stakers — HATCH FRIDAY (7 hatched) — 31.1s
        wk 7 · 7 days in 3:22 · avg 28.93s/day
  [brain] Ilonggo Ironworks: 8 actions (5.4s)
  [brain] Pulang Bagwis: 0 actions (7.2s)
  [brain] Batangas Sprint Club: 5 actions (10.5s)
error: script "simulate" was terminated by signal SIGTERM (Polite quit request)
$ bun run scripts/simulate.ts "7" --keep "--seed=1" "--brain=qwen3:30b-a3b" "--llm=bot-7,bot-15,bot-marco,bot-9,bot-8,bot-16,bot-14,bot-12,bot-13,bot-17" --actors
Brain: qwen3:30b-a3b plays 10 stable(s) — bot-7, bot-15, bot-marco, bot-9, bot-8, bot-16, bot-14, bot-12, bot-13, bot-17

  [brain] Marco Gamefarm: 0 actions (0.6s)
  [brain] Ilonggo Ironworks: 0 actions (0.8s)
  [brain] Hacienda Verde: 6 actions (3.2s)
  [brain] Pulang Bagwis: 8 actions (7.3s)
  [brain] Sugalan Social Club: 7 actions (11.3s)
  [brain] Cavite Bloodlines: 1 actions (12.6s)
  [brain] Bagong Laban: 0 actions (14.5s)
  [brain] Talisay Tari Club: 8 actions (18.4s)
  [brain] Batangas Sprint Club: 2 actions (19.8s)
  [brain] Cuchillos de Sonora: 7 actions (24.2s)
Day 50 (Saturday): 101 fights, 1 unmatched, 4 claims settled, staking paid 1281.98 GP to 21 stakers — 25.0s
  [brain] Batangas Sprint Club: 0 actions (1.6s)
  [brain] Pulang Bagwis: 6 actions (4.4s)
  [brain] Talisay Tari Club: 7 actions (8.9s)
  [brain] Hacienda Verde: 0 actions (10.2s)
  [brain] Ilonggo Ironworks: 0 actions (11.8s)
  [brain] Cavite Bloodlines: 7 actions (15.7s)
  [brain] Cuchillos de Sonora: 0 actions (17.1s)
  [brain] Marco Gamefarm: 7 actions (21.5s)
  [brain] Bagong Laban: 0 actions (23.0s)
  [brain] Sugalan Social Club: 0 actions (24.1s)
Day 51 (Sunday): 82 fights, 2 unmatched, 6 claims settled, staking paid 1607.45 GP to 21 stakers — 24.7s
  [brain] Talisay Tari Club: 8 actions (3.6s)
  [brain] Cavite Bloodlines: 6 actions (6.4s)
  [brain] Marco Gamefarm: 11 actions (10.4s)
  [brain] Cuchillos de Sonora: 0 actions (11.9s)
  [brain] Sugalan Social Club: 0 actions (12.9s)
  [brain] Ilonggo Ironworks: 7 actions (17.2s)
  [brain] Pulang Bagwis: 0 actions (18.5s)
  [brain] Bagong Laban: 0 actions (20.2s)
  [brain] Hacienda Verde: 7 actions (24.3s)
  [brain] Batangas Sprint Club: 0 actions (25.4s)
Day 52 (Monday): 76 fights, 2 unmatched, 4 claims settled, staking paid 994.78 GP to 21 stakers — 25.9s
  [brain] Marco Gamefarm: 0 actions (1.4s)
  [brain] Cavite Bloodlines: 9 actions (5.8s)
  [brain] Pulang Bagwis: 0 actions (7.2s)
  [brain] Ilonggo Ironworks: 7 actions (11.8s)
  [brain] Hacienda Verde: 0 actions (13.1s)
  [brain] Bagong Laban: 8 actions (16.6s)
  [brain] Talisay Tari Club: 7 actions (19.8s)
  [brain] Sugalan Social Club: 8 actions (22.4s)
  [brain] Batangas Sprint Club: 6 actions (26.3s)
  [brain] Cuchillos de Sonora: 0 actions (27.9s)
Day 53 (Tuesday): 87 fights, 1 unmatched, 3 claims settled, staking paid 951.21 GP to 21 stakers — 28.4s
  [brain] Batangas Sprint Club: 0 actions (1.6s)
  [brain] Bagong Laban: 9 actions (7.2s)
  [brain] Ilonggo Ironworks: 7 actions (12.2s)
  [brain] Hacienda Verde: 0 actions (13.7s)
  [brain] Marco Gamefarm: 0 actions (15.3s)
  [brain] Pulang Bagwis: 1 actions (17.2s)
  [brain] Talisay Tari Club: 8 actions (20.8s)
  [brain] Sugalan Social Club: 7 actions (24.7s)
  [brain] Cavite Bloodlines: 9 actions (29.6s)
  [brain] Cuchillos de Sonora: 0 actions (31.2s)
Day 54 (Wednesday): 93 fights, 0 unmatched, 5 claims settled, staking paid 1064.19 GP to 21 stakers — 31.7s
  [brain] Sugalan Social Club: 0 actions (1.3s)
  [brain] Batangas Sprint Club: 0 actions (2.4s)
  [brain] Cuchillos de Sonora: 0 actions (4.1s)
  [brain] Cavite Bloodlines: 0 actions (5.5s)
  [brain] Pulang Bagwis: 9 actions (9.0s)
  [brain] Talisay Tari Club: 8 actions (13.6s)
  [brain] Marco Gamefarm: 7 actions (16.3s)
  [brain] Hacienda Verde: 0 actions (17.6s)
  [brain] Bagong Laban: 0 actions (19.2s)
  [brain] Ilonggo Ironworks: 0 actions (20.9s)
Day 55 (Thursday): 18 fights, 2 unmatched, 2 claims settled, staking paid 931.59 GP to 21 stakers — 21.3s
  [brain] Hacienda Verde: 8 actions (4.7s)
  [brain] Marco Gamefarm: 6 actions (8.2s)
  [brain] Cuchillos de Sonora: 9 actions (12.1s)
  [brain] Ilonggo Ironworks: 0 actions (13.4s)
  [brain] Bagong Laban: 8 actions (16.9s)
  [brain] Talisay Tari Club: 0 actions (18.2s)
  [brain] Batangas Sprint Club: 7 actions (21.6s)
  [brain] Sugalan Social Club: 0 actions (22.5s)
  [brain] Cavite Bloodlines: 0 actions (23.7s)
  [brain] Pulang Bagwis: 10 actions (27.8s)
Day 56 (Friday): 61 fights, 2 unmatched, 3 claims settled, staking paid 976.22 GP to 21 stakers — HATCH FRIDAY (7 hatched) — 28.3s
        wk 8 · 7 days in 3:05 · avg 26.49s/day

TIMING
  seed + bots      0.0s
  simulation       3:06   (7 day(s), avg 26.55s/day · honest 9% / tick 91%)
  brains           3:02   (26.00s/day · 98% of the run, 70 call(s), 0 failed)
  doctor           0.8s
  total            3:07
  slowest days d54 31.7s · d53 28.4s · d56 28.3s
  per unit     54.08 ms/fight · 69.94 ms/entry

BARN CAREERS (durable actor state — persists across runs)
  bot-7     56 day(s) played · last day 55 · 303 proposed, 17 dropped, 0 failure(s) · 1000.7s thinking
  bot-8     57 day(s) played · last day 55 · 278 proposed, 18 dropped, 0 failure(s) · 1078.4s thinking
  bot-9     56 day(s) played · last day 55 · 295 proposed, 29 dropped, 0 failure(s) · 829.3s thinking
  bot-marco  57 day(s) played · last day 55 · 349 proposed, 23 dropped, 0 failure(s) · 973.4s thinking
  bot-12    57 day(s) played · last day 55 · 303 proposed, 19 dropped, 0 failure(s) · 950.9s thinking
  bot-13    56 day(s) played · last day 55 · 253 proposed, 7 dropped, 0 failure(s) · 1091.9s thinking
  bot-14    57 day(s) played · last day 55 · 203 proposed, 11 dropped, 0 failure(s) · 1065.6s thinking
  bot-15    57 day(s) played · last day 55 · 259 proposed, 6 dropped, 0 failure(s) · 980.5s thinking
  bot-16    58 day(s) played · last day 55 · 270 proposed, 18 dropped, 0 failure(s) · 1130.7s thinking
  bot-17    57 day(s) played · last day 55 · 268 proposed, 10 dropped, 0 failure(s) · 1097.2s thinking

PINTAKASI DOCTOR · data/sim-20260815-0245.db
day 56 · Friday, February 28, 3000 · week 8 · 21 farms · 503 birds

INVARIANTS
  PASS  GP conservation            955,200.00 GP in world = 955,200.00 expected
  PASS  LT conservation            397,351.60 LT held = 397,351.60 LT ledgered
  PASS  no negative balances       staker 0.10 · juice 0.00 · 21 wallets clean
  PASS  pit figures                3436 fights · 3436 mirrored · 0 inversions
  PASS  purses settle              27 completed crown(s), exact to the cent
  PASS  no stranded entries        28 resolved championship(s), every entry settled
  PASS  one card per bird per day  2657 entries across 2657 bird-days · 0 over cap
  PASS  fight counts match the log 2657 settled entries · 6256 fights claimed · 0 mismatched
  PASS  scout book matches the log 1225 book lines audited · 0 out of step

CARD HEALTH
  2657 entries · 2565 fought · 92 unmatched (3.5%) · 380 lobbies
  weather timing  682/2314 starred entries ran on the bird's own element day (29.5% vs 20.0% by chance, 1.47×) ✓ entries are being timed

GROUP STAGE
  fights per settled entry  mean 2.35 of 3 · 2657 settled entries
  full cards  1387 (52.2%) took all 3 · short 1178 (44.3%) fought 1–2 · 92 (3.5%) never fought
  groups  819 dealt · mean 3.24 birds · 28 of one (28 were the lobby's only entry)

LOBBY FILL
  mean 6.99 birds per lobby · 380 lobbies · 28 held a single bird (7.4%)
      1 ██                       7.4%
    2-3 ███████                  30.8%
    4-7 ███████                  28.7%
   8-15 █████                    21.3%
    16+ ███                      11.8%
  same-barn-only lobbies 23 · 50 birds stranded with no cross-barn opponent

WORST LOBBY KEYS
  real/maiden/b2                        9 entries, 55.6% unmatched
  real/nw3/b3                          12 entries, 33.3% unmatched
  real/claimer/b2@90                   15 entries, 26.7% unmatched

POPULATION
  eggs 55 · active 260 · retired 188 · 21 farms
  by age  1:67  2:65  3:58  4:8  5:9  6:5  7:5  8:43
  supply  hatches 448 · gacha eggs 142 · covers 193
  loss    hardcore 188
  barns   0 of 21 at capacity · 1 expansion(s) bought

FIGHT VOLUME
  wk  0       0  
  wk  1     496  ███████████████
  wk  2     637  ███████████████████
  wk  3     813  ████████████████████████
  wk  4     246  ███████
  wk  5     224  ███████
  wk  6     358  ███████████
  wk  7     576  █████████████████
  wk  8      86  ███  (1 day)
  trough wk5 (224) = 27.6% of the wk3 peak (813)
  ⚠ fight volume fell below 50% of peak and never came back past 75% — this is NOT the founder cull, which recovers within ~2 weeks

BLOODLINES
  gen   birds   mean grade     stars   home margin
  0       310   B+ ( 331.7)    1.66★      8.0
  1       193   B+ ( 341.4)    1.84★     11.3
  gen 1 vs gen 0  +9.7 mean stat · +0.2★ · +3.3 pts of home margin

FIGHT ECONOMY BY RUNG
    rung                      fee  entries  share   GP risked   LT minted  LT/100GP
    juvenile/claimer@90        24       52   2.0%         944      134.74     14.27
    juvenile/maiden            30       73   2.7%       1,220      177.47     14.55
    juvenile/claimer@180       48       58   2.2%       2,048      326.58     15.95
    real/claimer@90            48      215   8.1%       7,296    1,153.77     15.81
    real/maiden                60       54   2.0%       1,560      250.67     16.07
    real/nw3                   60       58   2.2%       2,400      396.90     16.54
    juvenile/claimer@270       72       44   1.7%       2,208      372.02     16.85
    real/claimer@180           96      110   4.1%       8,064    1,423.81     17.66
    real/claimer@270          144       91   3.4%       9,504    1,771.58     18.64
    juvenile/open             150      720  27.1%      85,500   16,195.50     18.94
    real/open                 300    1,182  44.5%     298,200   62,973.56     21.12

LAND SUPPLY
  circulating 397,351.60 LT · 397,147.00 staked (99.9%) · 204.60 idle
  minted      404,351.60 LT over 57 day(s) · 7,093.89 LT per day
    purse_payout    261,000.00 LT   64.5%
    card_settled     85,176.60 LT   21.1%
    buy_land         56,000.00 LT   13.8%
    gacha             2,175.00 LT    0.5%
  burned      7,000.00 LT (1.7% of issuance) — the sinks
    stud_listed       6,000.00 LT   85.7%
    barn_expanded     1,000.00 LT   14.3%
  valuation   at $0.01/LT (pencilled) the world has issued $4,044 of land against $11,940 of GP faucet — $0.34 of LT per $1 of GP
  runway      100B-token target reached in 10,000+ year(s) at this population's rate — scales with farms, not with time

REPLAY
  203/203 sampled fight rows rebuild exactly from their seed

STAKER POOL
  paid out 57,655.50 GP over 56 day(s) · 0.10 waiting · 397,147.00 LT staked
  land_purchase 44,800.00 · gacha 9,224.00 · breed 3,088.00 · claim_rake 543.60

CHAMPIONSHIPS
  major     15 run / 0 cancelled · field 13.5 · purse 106,570.82
            paid 103/203 entrants (51%) · biggest take 5.3% of all purse GP · smallest 208.95 GP
            entry fees 32,480.00 GP fund 30% of the purse · the rest is juice (gacha + breed fees) · net to the field 74,090.82 GP
            under the door 0/103 winners (0%) took less purse than their entry fee
  juvenile  12 run / 1 cancelled · field 11.0 · purse 33,101.18
            paid 64/132 entrants (48%) · biggest take 15.7% of all purse GP · smallest 51.18 GP
            entry fees 6,336.00 GP fund 19% of the purse · the rest is juice (gacha + breed fees) · net to the field 26,765.18 GP
            under the door 0/64 winners (0%) took less purse than their entry fee

MECHANIC ADOPTION            farms of 21
  claims placed             21  █████████████████████
  studs listed              11  ███████████░░░░░░░░░░
  land purchased             1  █░░░░░░░░░░░░░░░░░░░░
  paid gacha rolls          10  ██████████░░░░░░░░░░░
  gacha bundles bought       1  █░░░░░░░░░░░░░░░░░░░░
  barn expanded              1  █░░░░░░░░░░░░░░░░░░░░
  Major entries             21  █████████████████████
  juvenile championship     11  ███████████░░░░░░░░░░

DISCOVERY
  age 1    carded 469/2170 at the true best blade (21.6% vs random 20.0%) · 51.8% on or adjacent (random 48.7%) · answer coverage 34.5% · SCOUT 338/749 right (45.1% vs random 20.0%), 68.1% on or adjacent · clear home 205/385 (53.2%, 71.2% adjacent)
  age 2–3  carded 947/3492 at the true best blade (27.1% vs random 20.0%) · 55.7% on or adjacent (random 48.6%) · answer coverage 72.7% · SCOUT 943/2540 right (37.1% vs random 20.0%), 65.5% on or adjacent · clear home 531/1184 (44.8%, 67.9% adjacent)
  age 4+   carded 144/594 at the true best blade (24.2% vs random 20.0%) · 57.2% on or adjacent (random 48.5%) · answer coverage 60.4% · SCOUT 170/359 right (47.4% vs random 20.0%), 73.8% on or adjacent · clear home 115/203 (56.7%, 78.8% adjacent)
  explored  5/5 blades saw an age-1 entry in the discovery year
  flock shape  median home blade beats its runner-up by 9.0 pts · 45.1% of birds clear the 10-pt bar
  breeding  173 bot covers · hens carry +51.0 of their own shape (any bird: +54.5) · the sires chosen reinforce it by +39.0 (an unchosen sire: +2.5) · foals land at +32.5
  broodmare band  73.4% of 79 settled retired hens have ever carried · busiest hen 4 foals
  ✓ the scout beats chance on mature birds with a home — 56.7% vs 20.0%
  ⚠ only 45.1% of birds have a home blade worth finding — the flock is being bred flat, so there is little for discovery to discover

2 warnings · 0 invariant failures

Done → /Users/plumeria/Repos/pintakasi-bloodlines/data/sim-20260815-0245.db
Run `bun dev:sim` and open http://localhost:3435/admin — it always shows the newest sim.
```

---

## Coach session #2 — day 56 (2026-08-16, overnight)

World: `sim-20260815-0245`. Segment 2 ran in three pieces: the host reaped
the sim process twice mid-run (SIGTERM at day 39 and day 49); each time the
world resumed from the last committed day with `--keep`, actors' orders
intact in durable state — the statefulness demo, exercised in anger. 0
invariant failures.

## Scoreboard at day 56

```
  scripted (10): total net worth 700,231 · avg 70,023 · crowns 18
  llm      (10): total net worth 488,751 · avg 48,875 · crowns 5
```

## The turn of the story

1. **First llm crowns ever — five of them.** bot-9, bot-8, bot-12, bot-15,
   bot-16 each took a Major. Pulang Bagwis (bot-16) holds rank 10 with a
   crown. In 147 llm-played days before this segment, zero.
2. **The pipeline finally runs.** After session #1's pointed orders the
   architects bred at real cadence: bot-9 17 breeds, bot-marco 16 (from ~0).
   Six of ten barns bred this segment.
3. **The gap is narrowing in ratio terms**: llm/scripted avg = 0.70, vs 0.65
   at day 28 and 0.58 at exp1's day 56. Slope, not parity — but the second
   derivative finally points the right way.
4. **Ginto, tamed, is a real player**: rank 15, 4 crowns, 52k LT — beat five
   llm barns. The scripted side is ten honest competitors now.
5. Fight volume still 3.3× scripted (1,424 vs 4,747) — the ceiling on
   further closing; rosters deepen as the breeds mature.

## Orders

- **KEEP** (7): bot-15, bot-marco, bot-9, bot-8, bot-16, bot-12, bot-13 —
  the orders are working; don't talk over a working play.
- **bot-7** (rank 19): "the edge now IS volume plus crowns" — daily entries,
  weekly declaration, breed on stock.
- **bot-14** (rank 16): "fight your pulls every single day — rolls alone
  don't compound."
- **bot-17** (rank 20): "every healthy bird daily, a weekly crown
  declaration, stake what you mint — compounding is the whole game."

Tunes applied mid-run (segment 3 already live) — first-try binds, except
bot-7's customary second attempt.

## What day 91 must show

1. More llm crowns (five barns proved it's reachable; the other five need
   one).
2. The bred generation entering the card — roster depth closing the fight
   gap.
3. The three re-ordered barns moving off the floor.

---

## Segment 3 — days 57–91 (verbatim sim log)

```
$ bun run scripts/simulate.ts "35" --keep "--seed=1" "--brain=qwen3:30b-a3b" "--llm=bot-7,bot-15,bot-marco,bot-9,bot-8,bot-16,bot-14,bot-12,bot-13,bot-17" --actors
Brain: qwen3:30b-a3b plays 10 stable(s) — bot-7, bot-15, bot-marco, bot-9, bot-8, bot-16, bot-14, bot-12, bot-13, bot-17

level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"18uksx5w1lx7ggn29j8k1aycq4dl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"t9as7it2syn2ngq98m5uhkvt0fbl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"pqghl13l9pnak4tgawfbvlbyhjbl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"x0yz4druofyt291a5zpop3y26ral00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"h0v84v2l0xmk5opqxvxlf87svmbl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"1gwvylqwhu4q0boki92tokx1kpcl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"1gkix45vatanemtzic25li6832bl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"xgaka4erghotyt44595rvonfowbl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"pm1veikitjufamnl16tiktpus9bl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"pqkklfzprc772mlczmsrgw33ugbl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"h0v84v2l0xmk5opqxvxlf87svmbl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"1gkix45vatanemtzic25li6832bl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"pqkklfzprc772mlczmsrgw33ugbl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"pqghl13l9pnak4tgawfbvlbyhjbl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"x0yz4druofyt291a5zpop3y26ral00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"t9as7it2syn2ngq98m5uhkvt0fbl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"pm1veikitjufamnl16tiktpus9bl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"xgaka4erghotyt44595rvonfowbl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"18uksx5w1lx7ggn29j8k1aycq4dl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"1gwvylqwhu4q0boki92tokx1kpcl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"h0v84v2l0xmk5opqxvxlf87svmbl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"t9as7it2syn2ngq98m5uhkvt0fbl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"1gkix45vatanemtzic25li6832bl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"pqghl13l9pnak4tgawfbvlbyhjbl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"pqkklfzprc772mlczmsrgw33ugbl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"xgaka4erghotyt44595rvonfowbl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"x0yz4druofyt291a5zpop3y26ral00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"18uksx5w1lx7ggn29j8k1aycq4dl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"pm1veikitjufamnl16tiktpus9bl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"1gwvylqwhu4q0boki92tokx1kpcl00\"}"
[bot-brain] bot-7 proposed nothing: Actor failed to start (18uksx5w1lx7ggn29j8k1aycq4dl00): "no_envoys"
[bot-brain] bot-8 proposed nothing: Actor failed to start (t9as7it2syn2ngq98m5uhkvt0fbl00): "no_envoys"
[bot-brain] bot-9 proposed nothing: Actor failed to start (1gkix45vatanemtzic25li6832bl00): "no_envoys"
[bot-brain] bot-marco proposed nothing: Actor failed to start (pm1veikitjufamnl16tiktpus9bl00): "no_envoys"
[bot-brain] bot-12 proposed nothing: Actor failed to start (x0yz4druofyt291a5zpop3y26ral00): "no_envoys"
[bot-brain] bot-13 proposed nothing: Actor failed to start (h0v84v2l0xmk5opqxvxlf87svmbl00): "no_envoys"
[bot-brain] bot-14 proposed nothing: Actor failed to start (1gwvylqwhu4q0boki92tokx1kpcl00): "no_envoys"
[bot-brain] bot-15 proposed nothing: Actor failed to start (pqghl13l9pnak4tgawfbvlbyhjbl00): "no_envoys"
[bot-brain] bot-16 proposed nothing: Actor failed to start (pqkklfzprc772mlczmsrgw33ugbl00): "no_envoys"
[bot-brain] bot-17 proposed nothing: Actor failed to start (xgaka4erghotyt44595rvonfowbl00): "no_envoys"
Day 57 (Saturday): 109 fights, 1 unmatched, 3 claims settled, staking paid 1968.99 GP to 21 stakers — 2:01
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"18uksx5w1lx7ggn29j8k1aycq4dl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"1gkix45vatanemtzic25li6832bl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"x0yz4druofyt291a5zpop3y26ral00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"pqghl13l9pnak4tgawfbvlbyhjbl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"xgaka4erghotyt44595rvonfowbl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"h0v84v2l0xmk5opqxvxlf87svmbl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"t9as7it2syn2ngq98m5uhkvt0fbl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"pqkklfzprc772mlczmsrgw33ugbl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"pm1veikitjufamnl16tiktpus9bl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"1gwvylqwhu4q0boki92tokx1kpcl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"18uksx5w1lx7ggn29j8k1aycq4dl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"pqghl13l9pnak4tgawfbvlbyhjbl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"x0yz4druofyt291a5zpop3y26ral00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"1gkix45vatanemtzic25li6832bl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"xgaka4erghotyt44595rvonfowbl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"pm1veikitjufamnl16tiktpus9bl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"h0v84v2l0xmk5opqxvxlf87svmbl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"pqkklfzprc772mlczmsrgw33ugbl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"t9as7it2syn2ngq98m5uhkvt0fbl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"1gwvylqwhu4q0boki92tokx1kpcl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"18uksx5w1lx7ggn29j8k1aycq4dl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"x0yz4druofyt291a5zpop3y26ral00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"1gkix45vatanemtzic25li6832bl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"pqghl13l9pnak4tgawfbvlbyhjbl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"xgaka4erghotyt44595rvonfowbl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"pm1veikitjufamnl16tiktpus9bl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"h0v84v2l0xmk5opqxvxlf87svmbl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"pqkklfzprc772mlczmsrgw33ugbl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"t9as7it2syn2ngq98m5uhkvt0fbl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"1gwvylqwhu4q0boki92tokx1kpcl00\"}"
[bot-brain] bot-7 proposed nothing: Actor failed to start (18uksx5w1lx7ggn29j8k1aycq4dl00): "no_envoys"
[bot-brain] bot-8 proposed nothing: Actor failed to start (t9as7it2syn2ngq98m5uhkvt0fbl00): "no_envoys"
[bot-brain] bot-9 proposed nothing: Actor failed to start (1gkix45vatanemtzic25li6832bl00): "no_envoys"
[bot-brain] bot-marco proposed nothing: Actor failed to start (pm1veikitjufamnl16tiktpus9bl00): "no_envoys"
[bot-brain] bot-12 proposed nothing: Actor failed to start (x0yz4druofyt291a5zpop3y26ral00): "no_envoys"
[bot-brain] bot-13 proposed nothing: Actor failed to start (h0v84v2l0xmk5opqxvxlf87svmbl00): "no_envoys"
[bot-brain] bot-14 proposed nothing: Actor failed to start (1gwvylqwhu4q0boki92tokx1kpcl00): "no_envoys"
[bot-brain] bot-15 proposed nothing: Actor failed to start (pqghl13l9pnak4tgawfbvlbyhjbl00): "no_envoys"
[bot-brain] bot-16 proposed nothing: Actor failed to start (pqkklfzprc772mlczmsrgw33ugbl00): "no_envoys"
[bot-brain] bot-17 proposed nothing: Actor failed to start (xgaka4erghotyt44595rvonfowbl00): "no_envoys"
Day 58 (Sunday): 95 fights, 0 unmatched, 5 claims settled, staking paid 1017.01 GP to 21 stakers — 2:01
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"t9as7it2syn2ngq98m5uhkvt0fbl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"1gkix45vatanemtzic25li6832bl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"h0v84v2l0xmk5opqxvxlf87svmbl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"pqghl13l9pnak4tgawfbvlbyhjbl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"pm1veikitjufamnl16tiktpus9bl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"pqkklfzprc772mlczmsrgw33ugbl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"18uksx5w1lx7ggn29j8k1aycq4dl00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"x0yz4druofyt291a5zpop3y26ral00\"}"
  [brain] Talisay Tari Club: 1 actions (1.9s)
  [brain] Ilonggo Ironworks: 9 actions (5.6s)
  [brain] Cuchillos de Sonora: 0 actions (7.2s)
  [brain] Batangas Sprint Club: 12 actions (12.1s)
  [brain] Cavite Bloodlines: 0 actions (13.4s)
  [brain] Hacienda Verde: 0 actions (14.7s)
  [brain] Pulang Bagwis: 7 actions (17.5s)
  [brain] Marco Gamefarm: 9 actions (20.8s)
Day 59 (Monday): 107 fights, 0 unmatched, 6 claims settled, staking paid 1022.39 GP to 21 stakers — 1:01
  [brain] Hacienda Verde: 8 actions (4.7s)
  [brain] Batangas Sprint Club: 2 actions (6.6s)
  [brain] Talisay Tari Club: 9 actions (10.5s)
  [brain] Cuchillos de Sonora: 11 actions (14.7s)
  [brain] Cavite Bloodlines: 11 actions (18.5s)
  [brain] Ilonggo Ironworks: 0 actions (20.1s)
  [brain] Pulang Bagwis: 0 actions (21.8s)
  [brain] Sugalan Social Club: 0 actions (22.9s)
  [brain] Bagong Laban: 2 actions (24.9s)
  [brain] Marco Gamefarm: 8 actions (29.8s)
Day 60 (Tuesday): 122 fights, 0 unmatched, 7 claims settled, staking paid 1162.20 GP to 21 stakers — 30.5s
  [brain] Ilonggo Ironworks: 0 actions (1.6s)
  [brain] Cuchillos de Sonora: 7 actions (5.4s)
  [brain] Batangas Sprint Club: 0 actions (6.7s)
  [brain] Hacienda Verde: 2 actions (8.4s)
  [brain] Cavite Bloodlines: 7 actions (12.4s)
  [brain] Talisay Tari Club: 0 actions (13.7s)
  [brain] Pulang Bagwis: 13 actions (18.2s)
  [brain] Bagong Laban: 6 actions (21.9s)
  [brain] Sugalan Social Club: 0 actions (22.8s)
  [brain] Marco Gamefarm: 17 actions (27.8s)
Day 61 (Wednesday): 101 fights, 0 unmatched, 4 claims settled, staking paid 943.21 GP to 21 stakers — 28.2s
  [brain] Cuchillos de Sonora: 1 actions (1.7s)
  [brain] Marco Gamefarm: 7 actions (5.3s)
  [brain] Ilonggo Ironworks: 8 actions (8.3s)
  [brain] Bagong Laban: 0 actions (9.7s)
  [brain] Batangas Sprint Club: 0 actions (10.9s)
  [brain] Cavite Bloodlines: 11 actions (16.4s)
  [brain] Talisay Tari Club: 11 actions (21.9s)
  [brain] Hacienda Verde: 0 actions (23.1s)
  [brain] Sugalan Social Club: 0 actions (24.0s)
  [brain] Pulang Bagwis: 0 actions (25.2s)
Day 62 (Thursday): 32 fights, 5 unmatched, 0 claims settled, staking paid 935.99 GP to 21 stakers — 25.7s
  [brain] Marco Gamefarm: 6 actions (3.7s)
  [brain] Bagong Laban: 9 actions (8.6s)
  [brain] Pulang Bagwis: 8 actions (11.7s)
  [brain] Ilonggo Ironworks: 6 actions (15.3s)
  [brain] Batangas Sprint Club: 0 actions (16.5s)
  [brain] Sugalan Social Club: 7 actions (19.9s)
  [brain] Hacienda Verde: 7 actions (23.7s)
  [brain] Talisay Tari Club: 10 actions (27.5s)
  [brain] Cavite Bloodlines: 7 actions (31.7s)
  [brain] Cuchillos de Sonora: 0 actions (33.0s)
Day 63 (Friday): 76 fights, 1 unmatched, 5 claims settled, staking paid 962.01 GP to 21 stakers — HATCH FRIDAY (7 hatched) — 33.7s
        wk 9 · 7 days in 7:01 · avg 60.16s/day
  [brain] Bagong Laban: 0 actions (2.1s)
  [brain] Marco Gamefarm: 1 actions (3.9s)
  [brain] Pulang Bagwis: 0 actions (5.6s)
  [brain] Cavite Bloodlines: 10 actions (11.9s)
  [brain] Batangas Sprint Club: 0 actions (13.3s)
  [brain] Talisay Tari Club: 0 actions (14.9s)
  [brain] Ilonggo Ironworks: 7 actions (19.4s)
  [brain] Hacienda Verde: 0 actions (21.1s)
  [brain] Sugalan Social Club: 6 actions (23.4s)
  [brain] Cuchillos de Sonora: 21 actions (29.5s)
Day 64 (Saturday): 118 fights, 0 unmatched, 11 claims settled, staking paid 1383.39 GP to 21 stakers — 30.3s
  [brain] Talisay Tari Club: 6 actions (3.8s)
  [brain] Cavite Bloodlines: 3 actions (6.3s)
  [brain] Hacienda Verde: 7 actions (9.0s)
  [brain] Batangas Sprint Club: 6 actions (12.6s)
  [brain] Marco Gamefarm: 1 actions (14.1s)
  [brain] Sugalan Social Club: 7 actions (16.5s)
  [brain] Cuchillos de Sonora: 8 actions (21.4s)
  [brain] Pulang Bagwis: 0 actions (22.8s)
  [brain] Bagong Laban: 0 actions (24.4s)
  [brain] Ilonggo Ironworks: 7 actions (28.5s)
Day 65 (Sunday): 148 fights, 4 unmatched, 8 claims settled, staking paid 1228.80 GP to 21 stakers — 29.1s
  [brain] Marco Gamefarm: 0 actions (1.4s)
  [brain] Sugalan Social Club: 6 actions (4.3s)
  [brain] Talisay Tari Club: 9 actions (10.1s)
  [brain] Cavite Bloodlines: 8 actions (14.5s)
  [brain] Hacienda Verde: 7 actions (18.8s)
  [brain] Batangas Sprint Club: 7 actions (21.2s)
  [brain] Cuchillos de Sonora: 12 actions (27.3s)
  [brain] Ilonggo Ironworks: 12 actions (31.2s)
  [brain] Bagong Laban: 6 actions (35.1s)
  [brain] Pulang Bagwis: 7 actions (39.2s)
Day 66 (Monday): 106 fights, 3 unmatched, 2 claims settled, staking paid 1511.22 GP to 21 stakers — 40.5s
  [brain] Marco Gamefarm: 12 actions (5.9s)
  [brain] Sugalan Social Club: 0 actions (6.9s)
  [brain] Ilonggo Ironworks: 2 actions (8.9s)
  [brain] Cuchillos de Sonora: 7 actions (13.7s)
  [brain] Hacienda Verde: 0 actions (15.1s)
  [brain] Pulang Bagwis: 7 actions (18.7s)
  [brain] Bagong Laban: 0 actions (20.6s)
  [brain] Talisay Tari Club: 0 actions (22.2s)
  [brain] Batangas Sprint Club: 0 actions (23.6s)
  [brain] Cavite Bloodlines: 6 actions (27.2s)
Day 67 (Tuesday): 119 fights, 0 unmatched, 4 claims settled, staking paid 999.16 GP to 21 stakers — 27.8s
  [brain] Cavite Bloodlines: 15 actions (5.6s)
  [brain] Pulang Bagwis: 0 actions (6.9s)
  [brain] Cuchillos de Sonora: 0 actions (8.8s)
  [brain] Talisay Tari Club: 10 actions (13.6s)
  [brain] Batangas Sprint Club: 7 actions (17.8s)
  [brain] Marco Gamefarm: 6 actions (21.9s)
  [brain] Ilonggo Ironworks: 0 actions (23.1s)
  [brain] Sugalan Social Club: 7 actions (25.7s)
  [brain] Bagong Laban: 7 actions (30.4s)
  [brain] Hacienda Verde: 0 actions (31.7s)
Day 68 (Wednesday): 110 fights, 0 unmatched, 4 claims settled, staking paid 978.84 GP to 21 stakers — 32.2s
  [brain] Batangas Sprint Club: 9 actions (4.8s)
  [brain] Cuchillos de Sonora: 14 actions (13.1s)
  [brain] Sugalan Social Club: 0 actions (14.3s)
  [brain] Marco Gamefarm: 0 actions (16.0s)
  [brain] Ilonggo Ironworks: 2 actions (17.8s)
  [brain] Talisay Tari Club: 11 actions (24.3s)
  [brain] Pulang Bagwis: 7 actions (29.0s)
  [brain] Cavite Bloodlines: 0 actions (30.7s)
  [brain] Hacienda Verde: 1 actions (32.2s)
  [brain] Bagong Laban: 6 actions (36.0s)
Day 69 (Thursday): 17 fights, 9 unmatched, 3 claims settled, staking paid 1021.40 GP to 21 stakers — 36.7s
  [brain] Cuchillos de Sonora: 0 actions (2.0s)
  [brain] Batangas Sprint Club: 0 actions (3.3s)
  [brain] Sugalan Social Club: 2 actions (4.7s)
  [brain] Cavite Bloodlines: 6 actions (8.0s)
  [brain] Ilonggo Ironworks: 6 actions (11.6s)
  [brain] Bagong Laban: 0 actions (13.6s)
  [brain] Hacienda Verde: 0 actions (15.4s)
  [brain] Talisay Tari Club: 9 actions (20.8s)
  [brain] Marco Gamefarm: 0 actions (22.5s)
  [brain] Pulang Bagwis: 8 actions (27.7s)
Day 70 (Friday): 70 fights, 3 unmatched, 3 claims settled, staking paid 900.57 GP to 21 stakers — HATCH FRIDAY (8 hatched) — 28.3s
        wk 10 · 7 days in 3:45 · avg 32.15s/day
  [brain] Ilonggo Ironworks: 6 actions (2.9s)
  [brain] Hacienda Verde: 0 actions (4.0s)
  [brain] Marco Gamefarm: 7 actions (7.3s)
  [brain] Talisay Tari Club: 2 actions (9.1s)
  [brain] Cavite Bloodlines: 3 actions (11.7s)
  [brain] Batangas Sprint Club: 5 actions (14.3s)
  [brain] Bagong Laban: 6 actions (18.8s)
  [brain] Pulang Bagwis: 9 actions (24.3s)
  [brain] Sugalan Social Club: 7 actions (27.0s)
  [brain] Cuchillos de Sonora: 13 actions (31.6s)
Day 71 (Saturday): 143 fights, 0 unmatched, 4 claims settled, staking paid 1436.61 GP to 21 stakers — 32.5s
  [brain] Ilonggo Ironworks: 0 actions (1.5s)
  [brain] Marco Gamefarm: 2 actions (3.2s)
  [brain] Cavite Bloodlines: 3 actions (5.9s)
  [brain] Pulang Bagwis: 0 actions (7.7s)
  [brain] Batangas Sprint Club: 12 actions (13.3s)
  [brain] Talisay Tari Club: 1 actions (15.0s)
  [brain] Hacienda Verde: 6 actions (18.1s)
  [brain] Sugalan Social Club: 5 actions (20.8s)
  [brain] Cuchillos de Sonora: 7 actions (24.4s)
  [brain] Bagong Laban: 6 actions (28.1s)
Day 72 (Sunday): 100 fights, 2 unmatched, 4 claims settled, staking paid 1302.42 GP to 21 stakers — 28.8s
  [brain] Cuchillos de Sonora: 13 actions (4.9s)
  [brain] Marco Gamefarm: 2 actions (7.3s)
  [brain] Batangas Sprint Club: 16 actions (12.4s)
  [brain] Sugalan Social Club: 6 actions (15.0s)
  [brain] Talisay Tari Club: 9 actions (19.1s)
  [brain] Bagong Laban: 1 actions (21.2s)
  [brain] Ilonggo Ironworks: 0 actions (23.0s)
  [brain] Pulang Bagwis: 0 actions (25.2s)
  [brain] Hacienda Verde: 11 actions (29.5s)
  [brain] Cavite Bloodlines: 0 actions (31.8s)
Day 73 (Monday): 111 fights, 2 unmatched, 8 claims settled, staking paid 1349.59 GP to 21 stakers — 32.5s
  [brain] Cuchillos de Sonora: 7 actions (4.9s)
  [brain] Pulang Bagwis: 13 actions (9.8s)
  [brain] Batangas Sprint Club: 14 actions (14.6s)
  [brain] Hacienda Verde: 0 actions (16.5s)
  [brain] Talisay Tari Club: 10 actions (23.7s)
  [brain] Cavite Bloodlines: 0 actions (26.2s)
  [brain] Marco Gamefarm: 0 actions (28.1s)
  [brain] Bagong Laban: 2 actions (31.0s)
  [brain] Ilonggo Ironworks: 9 actions (36.3s)
  [brain] Sugalan Social Club: 0 actions (37.8s)
Day 74 (Tuesday): 126 fights, 3 unmatched, 7 claims settled, staking paid 1075.81 GP to 21 stakers — 39.0s
  [brain] Batangas Sprint Club: 6 actions (3.6s)
  [brain] Bagong Laban: 8 actions (8.0s)
  [brain] Marco Gamefarm: 5 actions (10.8s)
  [brain] Pulang Bagwis: 2 actions (12.9s)
  [brain] Cavite Bloodlines: 2 actions (15.1s)
  [brain] Ilonggo Ironworks: 2 actions (17.2s)
  [brain] Cuchillos de Sonora: 6 actions (20.1s)
  [brain] Talisay Tari Club: 9 actions (25.5s)
  [brain] Hacienda Verde: 0 actions (27.2s)
  [brain] Sugalan Social Club: 7 actions (29.9s)
Day 75 (Wednesday): 105 fights, 2 unmatched, 5 claims settled, staking paid 1009.16 GP to 21 stakers — 30.4s
  [brain] Sugalan Social Club: 6 actions (2.4s)
  [brain] Bagong Laban: 5 actions (6.6s)
  [brain] Ilonggo Ironworks: 0 actions (8.0s)
  [brain] Batangas Sprint Club: 0 actions (9.8s)
  [brain] Pulang Bagwis: 0 actions (11.3s)
  [brain] Cavite Bloodlines: 4 actions (14.4s)
  [brain] Cuchillos de Sonora: 14 actions (21.7s)
  [brain] Hacienda Verde: 7 actions (24.9s)
  [brain] Talisay Tari Club: 9 actions (30.6s)
  [brain] Marco Gamefarm: 5 actions (33.9s)
Day 76 (Thursday): 17 fights, 4 unmatched, 1 claims settled, staking paid 1033.83 GP to 21 stakers — 34.5s
  [brain] Batangas Sprint Club: 0 actions (1.8s)
  [brain] Talisay Tari Club: 0 actions (3.3s)
  [brain] Pulang Bagwis: 0 actions (4.8s)
  [brain] Marco Gamefarm: 6 actions (8.1s)
  [brain] Cavite Bloodlines: 0 actions (10.3s)
  [brain] Bagong Laban: 2 actions (12.7s)
  [brain] Cuchillos de Sonora: 12 actions (17.8s)
  [brain] Sugalan Social Club: 6 actions (21.4s)
  [brain] Ilonggo Ironworks: 7 actions (24.7s)
  [brain] Hacienda Verde: 9 actions (28.3s)
Day 77 (Friday): 65 fights, 4 unmatched, 2 claims settled, staking paid 931.59 GP to 21 stakers — HATCH FRIDAY (7 hatched) — 29.1s
        wk 11 · 7 days in 3:47 · avg 32.40s/day
  [brain] Pulang Bagwis: 13 actions (7.2s)
  [brain] Bagong Laban: 18 actions (14.4s)
  [brain] Cuchillos de Sonora: 10 actions (20.7s)
  [brain] Talisay Tari Club: 2 actions (22.5s)
  [brain] Hacienda Verde: 11 actions (27.0s)
  [brain] Marco Gamefarm: 3 actions (29.6s)
  [brain] Ilonggo Ironworks: 0 actions (31.5s)
  [brain] Batangas Sprint Club: 6 actions (34.4s)
  [brain] Cavite Bloodlines: 0 actions (36.6s)
  [brain] Sugalan Social Club: 0 actions (38.1s)
Day 78 (Saturday): 145 fights, 1 unmatched, 6 claims settled, staking paid 1870.43 GP to 21 stakers — 39.2s
  [brain] Talisay Tari Club: 8 actions (3.5s)
  [brain] Batangas Sprint Club: 0 actions (4.6s)
  [brain] Ilonggo Ironworks: 6 actions (8.8s)
  [brain] Cavite Bloodlines: 3 actions (11.5s)
  [brain] Sugalan Social Club: 5 actions (14.1s)
  [brain] Marco Gamefarm: 8 actions (19.7s)
  [brain] Pulang Bagwis: 6 actions (23.0s)
  [brain] Hacienda Verde: 0 actions (25.2s)
  [brain] Cuchillos de Sonora: 11 actions (30.4s)
  [brain] Bagong Laban: 0 actions (32.7s)
Day 79 (Sunday): 145 fights, 1 unmatched, 9 claims settled, staking paid 1448.18 GP to 21 stakers — 33.5s
  [brain] Ilonggo Ironworks: 0 actions (2.0s)
  [brain] Talisay Tari Club: 8 actions (7.3s)
  [brain] Hacienda Verde: 1 actions (9.5s)
  [brain] Bagong Laban: 5 actions (13.7s)
  [brain] Cavite Bloodlines: 7 actions (18.0s)
  [brain] Pulang Bagwis: 10 actions (22.5s)
  [brain] Batangas Sprint Club: 13 actions (26.6s)
  [brain] Sugalan Social Club: 0 actions (28.0s)
  [brain] Cuchillos de Sonora: 8 actions (33.8s)
  [brain] Marco Gamefarm: 15 actions (40.9s)
Day 80 (Monday): 161 fights, 2 unmatched, 7 claims settled, staking paid 1257.99 GP to 21 stakers — 41.8s
  [brain] Marco Gamefarm: 6 actions (4.3s)
  [brain] Pulang Bagwis: 10 actions (9.3s)
  [brain] Ilonggo Ironworks: 2 actions (11.3s)
  [brain] Sugalan Social Club: 0 actions (12.4s)
  [brain] Bagong Laban: 6 actions (16.2s)
  [brain] Cavite Bloodlines: 4 actions (19.5s)
  [brain] Cuchillos de Sonora: 0 actions (21.7s)
  [brain] Hacienda Verde: 6 actions (26.1s)
  [brain] Batangas Sprint Club: 6 actions (30.1s)
  [brain] Talisay Tari Club: 10 actions (35.8s)
Day 81 (Tuesday): 145 fights, 2 unmatched, 6 claims settled, staking paid 1087.39 GP to 21 stakers — 36.4s
  [brain] Bagong Laban: 15 actions (6.2s)
  [brain] Talisay Tari Club: 0 actions (7.9s)
  [brain] Ilonggo Ironworks: 6 actions (12.0s)
  [brain] Cuchillos de Sonora: 2 actions (14.7s)
  [brain] Marco Gamefarm: 0 actions (17.2s)
  [brain] Batangas Sprint Club: 0 actions (18.7s)
  [brain] Sugalan Social Club: 2 actions (20.3s)
  [brain] Hacienda Verde: 7 actions (23.8s)
  [brain] Cavite Bloodlines: 9 actions (28.8s)
  [brain] Pulang Bagwis: 8 actions (34.0s)
Day 82 (Wednesday): 124 fights, 0 unmatched, 8 claims settled, staking paid 1058.00 GP to 21 stakers — 34.7s
  [brain] Marco Gamefarm: 1 actions (2.4s)
  [brain] Talisay Tari Club: 8 actions (7.4s)
  [brain] Pulang Bagwis: 2 actions (9.5s)
  [brain] Ilonggo Ironworks: 9 actions (13.4s)
  [brain] Batangas Sprint Club: 2 actions (15.2s)
  [brain] Sugalan Social Club: 6 actions (18.8s)
  [brain] Cavite Bloodlines: 17 actions (26.0s)
  [brain] Hacienda Verde: 0 actions (27.6s)
  [brain] Cuchillos de Sonora: 0 actions (29.7s)
  [brain] Bagong Laban: 5 actions (34.1s)
Day 83 (Thursday): 42 fights, 5 unmatched, 2 claims settled, staking paid 991.22 GP to 21 stakers — 34.7s
  [brain] Cuchillos de Sonora: 0 actions (2.3s)
  [brain] Talisay Tari Club: 7 actions (6.5s)
  [brain] Cavite Bloodlines: 0 actions (9.1s)
  [brain] Batangas Sprint Club: 0 actions (10.7s)
  [brain] Bagong Laban: 5 actions (14.5s)
  [brain] Pulang Bagwis: 0 actions (16.4s)
  [brain] Hacienda Verde: 7 actions (20.1s)
  [brain] Sugalan Social Club: 7 actions (23.2s)
  [brain] Ilonggo Ironworks: 0 actions (24.6s)
  [brain] Marco Gamefarm: 6 actions (28.6s)
Day 84 (Friday): 94 fights, 2 unmatched, 5 claims settled, staking paid 1027.80 GP to 21 stakers — HATCH FRIDAY (8 hatched) — 29.4s
        wk 12 · 7 days in 4:10 · avg 35.73s/day
  [brain] Cavite Bloodlines: 0 actions (2.0s)
  [brain] Ilonggo Ironworks: 0 actions (3.7s)
  [brain] Bagong Laban: 0 actions (6.1s)
  [brain] Talisay Tari Club: 0 actions (7.9s)
  [brain] Pulang Bagwis: 9 actions (13.8s)
  [brain] Marco Gamefarm: 1 actions (16.4s)
  [brain] Batangas Sprint Club: 0 actions (18.1s)
  [brain] Hacienda Verde: 6 actions (21.4s)
  [brain] Cuchillos de Sonora: 0 actions (23.4s)
  [brain] Sugalan Social Club: 0 actions (25.0s)
Day 85 (Saturday): 159 fights, 1 unmatched, 4 claims settled, staking paid 1562.81 GP to 21 stakers — 26.0s
  [brain] Batangas Sprint Club: 8 actions (5.1s)
  [brain] Cuchillos de Sonora: 9 actions (11.2s)
  [brain] Marco Gamefarm: 6 actions (14.7s)
  [brain] Bagong Laban: 10 actions (18.9s)
  [brain] Pulang Bagwis: 2 actions (21.0s)
  [brain] Sugalan Social Club: 11 actions (24.8s)
  [brain] Cavite Bloodlines: 0 actions (26.9s)
  [brain] Talisay Tari Club: 9 actions (30.7s)
  [brain] Ilonggo Ironworks: 6 actions (34.8s)
  [brain] Hacienda Verde: 17 actions (41.8s)
Day 86 (Sunday): 174 fights, 0 unmatched, 6 claims settled, staking paid 1385.18 GP to 21 stakers — 42.9s
  [brain] Sugalan Social Club: 0 actions (2.1s)
  [brain] Hacienda Verde: 0 actions (3.9s)
  [brain] Marco Gamefarm: 6 actions (8.0s)
  [brain] Bagong Laban: 5 actions (11.7s)
  [brain] Cavite Bloodlines: 0 actions (14.0s)
  [brain] Pulang Bagwis: 12 actions (22.0s)
  [brain] Talisay Tari Club: 2 actions (23.9s)
  [brain] Ilonggo Ironworks: 11 actions (28.5s)
  [brain] Batangas Sprint Club: 2 actions (30.5s)
  [brain] Cuchillos de Sonora: 0 actions (32.9s)
Day 87 (Monday): 145 fights, 0 unmatched, 8 claims settled, staking paid 1350.41 GP to 21 stakers — 33.8s
  [brain] Talisay Tari Club: 9 actions (5.5s)
  [brain] Marco Gamefarm: 6 actions (10.7s)
  [brain] Pulang Bagwis: 9 actions (14.9s)
  [brain] Batangas Sprint Club: 0 actions (16.8s)
  [brain] Cavite Bloodlines: 20 actions (29.3s)
  [brain] Sugalan Social Club: 0 actions (30.7s)
  [brain] Hacienda Verde: 6 actions (35.2s)
  [brain] Cuchillos de Sonora: 7 actions (40.1s)
  [brain] Bagong Laban: 7 actions (43.7s)
  [brain] Ilonggo Ironworks: 7 actions (49.6s)
Day 88 (Tuesday): 198 fights, 0 unmatched, 9 claims settled, staking paid 1128.20 GP to 21 stakers — 50.5s
  [brain] Hacienda Verde: 0 actions (2.2s)
  [brain] Batangas Sprint Club: 2 actions (4.1s)
  [brain] Cuchillos de Sonora: 10 actions (10.9s)
  [brain] Cavite Bloodlines: 6 actions (15.2s)
  [brain] Talisay Tari Club: 6 actions (18.8s)
  [brain] Ilonggo Ironworks: 7 actions (24.6s)
  [brain] Pulang Bagwis: 1 actions (27.0s)
  [brain] Sugalan Social Club: 0 actions (28.9s)
  [brain] Bagong Laban: 0 actions (31.2s)
  [brain] Marco Gamefarm: 7 actions (36.8s)
Day 89 (Wednesday): 184 fights, 3 unmatched, 8 claims settled, staking paid 1139.00 GP to 21 stakers — 37.6s
  [brain] Ilonggo Ironworks: 7 actions (5.2s)
  [brain] Cuchillos de Sonora: 11 actions (11.6s)
  [brain] Cavite Bloodlines: 0 actions (13.9s)
  [brain] Talisay Tari Club: 8 actions (19.1s)
  [brain] Batangas Sprint Club: 6 actions (22.8s)
  [brain] Pulang Bagwis: 0 actions (24.6s)
  [brain] Bagong Laban: 8 actions (28.6s)
  [brain] Sugalan Social Club: 0 actions (30.0s)
  [brain] Marco Gamefarm: 6 actions (34.8s)
  [brain] Hacienda Verde: 5 actions (38.8s)
Day 90 (Thursday): 67 fights, 0 unmatched, 3 claims settled, staking paid 1024.98 GP to 21 stakers — 39.6s
  [brain] Ilonggo Ironworks: 0 actions (2.1s)
  [brain] Marco Gamefarm: 9 actions (7.4s)
  [brain] Pulang Bagwis: 7 actions (12.0s)
  [brain] Sugalan Social Club: 6 actions (14.7s)
  [brain] Cuchillos de Sonora: 1 actions (17.2s)
  [brain] Talisay Tari Club: 0 actions (18.9s)
  [brain] Hacienda Verde: 0 actions (21.0s)
  [brain] Cavite Bloodlines: 6 actions (25.8s)
  [brain] Bagong Laban: 0 actions (28.3s)
  [brain] Batangas Sprint Club: 0 actions (30.1s)
Day 91 (Friday): 140 fights, 2 unmatched, 6 claims settled, staking paid 986.77 GP to 21 stakers — HATCH FRIDAY (7 hatched) — 31.0s
        wk 13 · 7 days in 4:21 · avg 37.35s/day

TIMING
  seed + bots      0.0s
  simulation      23:05   (35 day(s), avg 39.57s/day · honest 10% / tick 90%)
  brains          22:40   (38.84s/day · 98% of the run, 350 call(s), 20 failed)
  doctor           1.7s
  total           23:07
  slowest days d57 2:01 · d58 2:01 · d59 1:01
  per unit     178.42 ms/fight · 233.19 ms/entry

BARN CAREERS (durable actor state — persists across runs)
  bot-7     89 day(s) played · last day 90 · 496 proposed, 17 dropped, 0 failure(s) · 1527.9s thinking
  bot-8     90 day(s) played · last day 90 · 500 proposed, 18 dropped, 0 failure(s) · 1682.6s thinking
  bot-9     89 day(s) played · last day 90 · 463 proposed, 29 dropped, 0 failure(s) · 1417.7s thinking
  bot-marco  90 day(s) played · last day 90 · 523 proposed, 23 dropped, 0 failure(s) · 1516.5s thinking
  bot-12    90 day(s) played · last day 90 · 444 proposed, 19 dropped, 0 failure(s) · 1437.9s thinking
  bot-13    89 day(s) played · last day 90 · 384 proposed, 7 dropped, 0 failure(s) · 1781.9s thinking
  bot-14    90 day(s) played · last day 90 · 319 proposed, 11 dropped, 0 failure(s) · 1730.9s thinking
  bot-15    90 day(s) played · last day 90 · 403 proposed, 6 dropped, 0 failure(s) · 1537.8s thinking
  bot-16    91 day(s) played · last day 90 · 440 proposed, 18 dropped, 0 failure(s) · 1728.3s thinking
  bot-17    90 day(s) played · last day 90 · 424 proposed, 10 dropped, 0 failure(s) · 1755.4s thinking

PINTAKASI DOCTOR · data/sim-20260815-0245.db
day 91 · Friday, April 4, 3000 · week 13 · 21 farms · 1051 birds

INVARIANTS
  PASS  GP conservation            1,443,200.00 GP in world = 1,443,200.00 expected
  PASS  LT conservation            773,777.96 LT held = 773,777.96 LT ledgered
  PASS  no negative balances       staker 0.15 · juice 0.00 · 21 wallets clean
  PASS  pit figures                7762 fights · 7762 mirrored · 0 inversions
  PASS  purses settle              52 completed crown(s), exact to the cent
  PASS  no stranded entries        53 resolved championship(s), every entry settled
  PASS  one card per bird per day  5939 entries across 5939 bird-days · 0 over cap
  PASS  fight counts match the log 5939 settled entries · 14096 fights claimed · 0 mismatched
  PASS  scout book matches the log 2662 book lines audited · 0 out of step

CARD HEALTH
  5939 entries · 5785 fought · 154 unmatched (2.6%) · 749 lobbies
  weather timing  1554/5557 starred entries ran on the bird's own element day (28.0% vs 20.0% by chance, 1.40×) ✓ entries are being timed

GROUP STAGE
  fights per settled entry  mean 2.37 of 3 · 5939 settled entries
  full cards  3060 (51.5%) took all 3 · short 2725 (45.9%) fought 1–2 · 154 (2.6%) never fought
  groups  1784 dealt · mean 3.33 birds · 39 of one (39 were the lobby's only entry)

LOBBY FILL
  mean 7.93 birds per lobby · 749 lobbies · 39 held a single bird (5.2%)
      1 █                        5.2%
    2-3 ██████                   25.0%
    4-7 ███████                  27.5%
   8-15 ███████                  29.0%
    16+ ███                      13.4%
  same-barn-only lobbies 41 · 90 birds stranded with no cross-barn opponent

WORST LOBBY KEYS
  real/claimer/b2@270                  16 entries, 31.3% unmatched
  real/maiden/b2                       18 entries, 27.8% unmatched
  juvenile/maiden/b2                   14 entries, 21.4% unmatched

POPULATION
  eggs 119 · active 443 · retired 489 · 21 farms
  by age  1:125  2:124  3:94  4:28  5:27  6:20  7:11  8:14
  supply  hatches 932 · gacha eggs 223 · covers 660
  loss    hardcore 427 · age 62
  barns   0 of 21 at capacity · 3 expansion(s) bought

FIGHT VOLUME
  wk  0       0  
  wk  1     496  ███████████
  wk  2     637  ██████████████
  wk  3     813  ██████████████████
  wk  4     246  █████
  wk  5     224  █████
  wk  6     358  ████████
  wk  7     576  ████████████
  wk  8     681  ███████████████
  wk  9     766  █████████████████
  wk 10     760  ████████████████
  wk 11     908  ████████████████████
  wk 12    1108  ████████████████████████
  wk 13     189  ████  (1 day)
  trough wk5 (224) = 27.6% of the wk3 peak (813) — EXPECTED: the age-3 founder flock is culled by the hardcore
  Majors before the first bred generation reaches fighting age, then volume
  recovers. Reference: wk3/4/5/6/7 = 1092/397/145/498/871 fights (20 farms, 91 days).

BLOODLINES
  gen   birds   mean grade     stars   home margin
  0       391   B+ ( 331.4)    1.86★      7.7
  1       506   B+ ( 347.5)    2.07★     13.2
  2       154   B+ ( 350.4)    2.35★     17.4
  gen 2 vs gen 0  +19.0 mean stat · +0.5★ · +9.6 pts of home margin

FIGHT ECONOMY BY RUNG
    rung                      fee  entries  share   GP risked   LT minted  LT/100GP
    juvenile/claimer@90        24      146   2.5%       2,800      402.74     14.38
    juvenile/maiden            30      160   2.7%       3,080      451.26     14.65
    juvenile/claimer@180       48      138   2.3%       5,152      820.95     15.93
    real/claimer@90            48      533   9.0%      19,232    3,056.93     15.90
    real/maiden                60      120   2.0%       4,280      691.32     16.15
    real/nw3                   60      177   3.0%       7,000    1,143.24     16.33
    juvenile/claimer@270       72      104   1.8%       5,184      871.81     16.82
    real/claimer@180           96      251   4.2%      17,920    3,155.58     17.61
    real/claimer@270          144      190   3.2%      18,816    3,494.10     18.57
    juvenile/open             150    1,724  29.0%     206,800   39,156.68     18.93
    real/open                 300    2,396  40.3%     604,600  127,628.35     21.11

LAND SUPPLY
  circulating 773,777.96 LT · 771,329.00 staked (99.7%) · 2,448.96 idle
  minted      791,377.96 LT over 92 day(s) · 8,601.93 LT per day
    purse_payout    516,000.00 LT   65.2%
    card_settled    180,872.96 LT   22.9%
    buy_land         91,000.00 LT   11.5%
    gacha             3,505.00 LT    0.4%
  burned      17,600.00 LT (2.2% of issuance) — the sinks
    stud_listed      14,600.00 LT   83.0%
    barn_expanded     3,000.00 LT   17.0%
  valuation   at $0.01/LT (pencilled) the world has issued $7,914 of land against $18,040 of GP faucet — $0.44 of LT per $1 of GP
  runway      100B-token target reached in 10,000+ year(s) at this population's rate — scales with farms, not with time

REPLAY
  202/202 sampled fight rows rebuild exactly from their seed

STAKER POOL
  paid out 99,148.05 GP over 91 day(s) · 0.15 waiting · 771,329.00 LT staked
  land_purchase 72,800.00 · gacha 14,728.00 · breed 10,560.00 · claim_rake 1,060.20

CHAMPIONSHIPS
  major     30 run / 0 cancelled · field 15.2 · purse 217,708.42
            paid 230/457 entrants (50%) · biggest take 2.6% of all purse GP · smallest 135.95 GP
            entry fees 73,120.00 GP fund 34% of the purse · the rest is juice (gacha + breed fees) · net to the field 144,588.42 GP
            under the door 18/230 winners (8%) took less purse than their entry fee
  juvenile  22 run / 1 cancelled · field 14.0 · purse 57,995.58
            paid 155/309 entrants (50%) · biggest take 9.0% of all purse GP · smallest 51.18 GP
            entry fees 14,832.00 GP fund 26% of the purse · the rest is juice (gacha + breed fees) · net to the field 43,163.58 GP
            under the door 0/155 winners (0%) took less purse than their entry fee

MECHANIC ADOPTION            farms of 21
  claims placed             21  █████████████████████
  studs listed              11  ███████████░░░░░░░░░░
  land purchased             1  █░░░░░░░░░░░░░░░░░░░░
  paid gacha rolls          10  ██████████░░░░░░░░░░░
  gacha bundles bought       1  █░░░░░░░░░░░░░░░░░░░░
  barn expanded              3  ███░░░░░░░░░░░░░░░░░░
  Major entries             21  █████████████████████
  juvenile championship     11  ███████████░░░░░░░░░░

DISCOVERY
  age 1    carded 1175/5332 at the true best blade (22.0% vs random 20.0%) · 50.0% on or adjacent (random 48.1%) · answer coverage 32.6% · SCOUT 855/1739 right (49.2% vs random 20.0%), 70.7% on or adjacent · clear home 512/924 (55.4%, 74.0% adjacent)
  age 2–3  carded 2167/7888 at the true best blade (27.5% vs random 20.0%) · 55.2% on or adjacent (random 48.2%) · answer coverage 78.9% · SCOUT 2559/6222 right (41.1% vs random 20.0%), 68.0% on or adjacent · clear home 1652/3163 (52.2%, 72.9% adjacent)
  age 4+   carded 253/876 at the true best blade (28.9% vs random 20.0%) · 57.0% on or adjacent (random 48.5%) · answer coverage 67.5% · SCOUT 309/591 right (52.3% vs random 20.0%), 72.9% on or adjacent · clear home 219/330 (66.4%, 83.0% adjacent)
  explored  5/5 blades saw an age-1 entry in the discovery year
  flock shape  median home blade beats its runner-up by 10.9 pts · 54.0% of birds clear the 10-pt bar
  breeding  621 bot covers · hens carry +54.0 of their own shape (any bird: +69.0) · the sires chosen reinforce it by +42.5 (an unchosen sire: +0.5) · foals land at +57.5
  broodmare band  67.6% of 222 settled retired hens have ever carried · busiest hen 9 foals
  ✓ the scout beats chance on mature birds with a home — 66.4% vs 20.0%
  ⚠ only 67.6% of the 222 settled retired hens have ever carried — the breeding loop is leaving broodmare capacity idle

1 warning · 0 invariant failures

Done → /Users/plumeria/Repos/pintakasi-bloodlines/data/sim-20260815-0245.db
Run `bun dev:sim` and open http://localhost:3435/admin — it always shows the newest sim.
```

---

## Postmortem #2 — day 91 (2026-08-16, overnight)

World: `sim-20260815-0245` · 91 days · 0 invariant failures · segment 2
survived two host SIGTERMs with clean `--keep` resumes.

## Final scoreboard

```
  scripted (10): total net worth 1,211,754 · avg 121,175 · crowns 42
  llm      (10): total net worth   699,045 · avg  69,905 · crowns 6
```

## Exp1 → exp2, like for like

| Measure | Exp1 | Exp2 |
|---|---|---|
| llm avg net worth | 61,343 | **69,905** (+14%) |
| llm/scripted ratio | 0.48 | **0.58** |
| llm crowns won | 0 | **6** (six different barns) |
| llm breeds (91d) | 2 | **~95** (pipeline real from seg2 on) |
| First crown declaration | day 58 (after mid-run fix) | day ≤28 (sighted from day 1) |

The lessons carried over worked exactly as designed: crown-sighted briefs
produced declarations from week 2 and six championships; the three-law
preamble + one pointed coach session produced a real breeding pipeline.
Coached barns: bot-14 (rank 16→13, won a crown after its sharpened order),
bot-7 (19→16); bot-17 stayed at the floor (20→19) — orders lift most barns,
not all.

Ginto, tamed: rank 17 with 4 crowns and 80k LT — an honest competitor.

## The remaining gap has a mechanical name: roster depth × brief visibility

- Fights: llm 1,784 vs scripted 11,960. The llm side *stalled* in segment 3
  (~1 fight/barn-day) while scripted exploded.
- Why: **bot-kevin holds 71 active birds; bot-15 holds 13.** Ninety-one days
  of scripted breeding compounds into a deep roster; the llm pipeline
  started at day 29.
- And the instrument caps it twice: **the brief lists only 12 fighters**
  (`LIMITS.fighters`), so "enter every healthy bird" is structurally capped
  at 12 — and the reply budget (`num_predict`) sizes to ~10 actions. A deep
  llm roster would be *invisible and unenterable* beyond the caps.

## Exp3 changes (the carry-forward)

1. **Raise the brief's fighter window** (12 → 24) and the reply budget to
   match — remove the structural volume ceiling before asking for volume.
2. **Preamble sharpened**: law 1 becomes literal ("15 healthy birds means 15
   entries"); law 3 gets a cadence ("at least one breed every week from the
   first week stock exists").
3. Everything else held: same split, seed, model, segments, coach cadence.
