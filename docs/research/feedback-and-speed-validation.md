# Feedback and speed checks — 2026-11-07

Model: simple-lif-v3. Protocol: paired-training-v5. Software checks only; no organoid connection or stimulation.

## Why unnecessary jumps persisted

With N0 → N1 at its 12 mV ceiling, the old reverse-pair punishment left the weight at 12 mV. Sensory N0 spikes immediately drove N1 during training, producing a causal spike pair that canceled the intended depression. A 30-trial check at seed 42 produced 41 unnecessary jumps in the last ten trials with punishment, compared with 46 without it.

The feedback protocol now gates N0 → N1 transmission during paired stimulation, so the imposed spike order can drive STDP. Gameplay continues to use actual motor spikes. Reward learning is scaled to 0.2 × the configured learning rate; unnecessary-jump punishment to 2 ×, capped at 1. This prevents the longer positive feedback period from dominating the shorter penalty. Neither change uses obstacle position to force or suppress an action. Freeze, feedback-off, no-training, manual and external controls retain their exclusions.

## Matched-course behavioral checks

Each condition starts at the saturated 12 mV weight, runs 30 trials capped at 20 s, and uses matching seeded courses. Entries are counts in the last ten trials. Other settings use defaults, including automatic rewiring off. These runs start from the same deliberately problematic controller, not an untrained population.

| Seed | Penalty on: unnecessary | Penalty on: clears | Penalty off: unnecessary | Penalty off: clears |
|---|---:|---:|---:|---:|
| 42 | 0 | 27 | 46 | 44 |
| 7 | 0 | 11 | 48 | 46 |
| 211 | 3 | 0 | 50 | 45 |
| 419 | 2 | 0 | 50 | 49 |

Punishment reduces wasteful actions in these checks. It does not establish reliable useful learning: seeds 211 and 419 had zero clears in the final ten punished trials. Suppressing unnecessary movement alone is not task success. Arbitrary user-edited wiring and other neuron settings remain additional conditions to evaluate.

The seed-42 comparison is a regression test in tests/feedback-difficulty.test.js; the same loop can be rerun with the other seeds. It also verifies that useful clears remain in that configuration.

## Speed is an experimental parameter

The optional Adaptive speed setting changes speed only at trial boundaries: +5% after a capped collision-free trial with at least one clear, −5% after collision, bounded to 150–500 px/s. Stops and caps with no clear do not promote speed. Switching the option while paused cannot change the current trial's flight or speed. New sessions begin at the configured base speed. The option defaults off for fixed comparisons.

Faster speed changes obstacle arrival intervals and horizontal jump travel. The encoder itself uses time-to-contact, so its temporal look-ahead is unchanged. Thus higher speed is not known to be monotonically harder for the model or for an organoid.

A frozen seed-42 controller with N0 → N1 set to 4.8 mV was evaluated for ten matched-course trials at each speed, with a 20 s cap, plasticity and feedback disabled, training selection set to none, and unnecessary-jump punishment off. All conditions used identical fixed neuron parameters and topology. Timed reward periods remain part of gameplay.

| Speed px/s | Trials reaching cap / 10 | Clears | Unnecessary jumps |
|---|---:|---:|---:|
| 150 | 7 | 20 | 0 |
| 200 | 10 | 35 | 0 |
| 290 | 10 | 49 | 0 |
| 400 | 10 | 60 | 0 |
| 500 | 10 | 70 | 0 |

This particular sweep does not support a monotonic speed/difficulty interpretation. Report actual speed, success, clears, and unnecessary-jump rate together. Use frozen fixed-speed evaluations to compare learned controllers. Adaptive speed is a task staircase to evaluate, not an organoid ability score. The published [organoid study](https://doi.org/10.1016/j.celrep.2026.116984) uses cartpole and does not validate this jumping-game speed scale.

## Recorded evidence and plots

JSON and CSV contain trial speed, planned next speed, reward count and unnecessary-jump punishment count. Network weights are sampled every 250 ms and at phase boundaries. Traces plot recorded samples with gaps for absent edges; the delta matrix includes added and removed connections. External hardware counts are never substituted with simulated weights. Reward/punishment plots show actual period counts, separately from unused-jump actions when punishment is disabled.
