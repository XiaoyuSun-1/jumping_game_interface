# Single-input, single-output learning experiment

Run date: 2026-11-07. Model `simple-lif-v1`, protocol `paired-training-v1`. This is a software experiment, not an organoid experiment.

## What changed

One sensory neuron encodes obstacle time-to-contact; one motor neuron produces the jump command. No command means no jump. Four additional training cells allow paired stimulation between trials. Only the sensory-to-motor connection is plastic. Random recurrent connectivity, background noise, adaptation and the hidden predictive observer have been removed from the active game.

After each 10 clears within a trial, the target speed increases by 10% of base speed. Actual speed ramps at 5% of base per second to a 500 px/s ceiling. Each trial begins at the base 290 px/s. Gaps are drawn uniformly from 550–1,150 px edge-to-edge; obstacle width, height and initial position vary. Separate seeded trial RNG streams allow the same course to be compared across conditions.

## Method

- Validation seeds: 211, 419, 811, 1597, 3203, 6421, 12853, 25717. These were not used in the tuning pilots below.
- Each seed/condition starts with the same untrained weight. The weight is initialized in [3,4) model mV; other cell parameters are shared.
- Conditions: adaptive pair selection, uniform random selection from the same six pairs, and no training.
- 200 training trials per condition, with a 45-second survival cap. Training uses 300 ms paired pulses, local pair STDP at connection learning rate 0.5, and selector value/eligibility parameters 0.3/0.3.
- Training is delivered after collisions. Reaching the survival cap credits prior training but delivers no new perturbation. A cap is therefore a task objective in training, and right-censoring in evaluation.
- Ten evaluation courses per seed, before and after training, use a distinct course seed (seed + 10000). Before/after and all conditions use identical evaluation courses. Training and plasticity are disabled during evaluation; weights are verified unchanged.
- A second complete comparison disables speed ramping while retaining random spacing. Random sequences and initial weights are matched.
- The benchmark uses the existing HeadlessEngine, which skips event serialization only. Tests verify equal network dynamics, selector state and trial transitions against Engine.

The 8 seeds are independent software initializations, not biological replicates. The 10 evaluations within a seed are not independent learned networks. This is a descriptive validation, not a significance claim.

## Results with randomized spacing and speed ramp

| Condition | Mean survival before | Mean survival after | Mean clears after | Seeds improved |
|---|---:|---:|---:|---:|
| Adaptive | 2.50 s | 34.37 s | 11.25 | 6 / 8 |
| Random pairs | 2.50 s | 29.07 s | 9.36 | 5 / 8 |
| No training | 2.50 s | 2.50 s | 0.00 | 0 / 8 |

All baselines had zero clears. Successful evaluation runs reached the 45-second cap and crossed the first speed increase, reaching 319 px/s. Tests separately cover later speed increases and the 500 px/s ceiling; these experiments do not establish successful learned play at that ceiling.

With fixed speed, mean before/after survival and the improved-seed counts were the same at the recorded precision. Mean clears after training were 10.86 for adaptive, 9.05 for random and 0 for no training. Equal survival does not establish equivalent performance at longer uncapped durations; many runs are censored at 45 seconds.

**Interpretation:** the simulated network can acquire a useful jump timing through training and retain it with plasticity disabled. It does not learn reliably for every seed. Random stimulation also works frequently; this small comparison does not establish a robust advantage of the adaptive selector. It establishes neither biological realism nor organoid learning.

Raw per-seed and per-evaluation data:
- [Ramp enabled](results/2026-11-07-ramp.json)
- [Fixed speed](results/2026-11-07-fixed.json)

## Failed pilots and tuning

The initial single-path version used a stronger initial weight in [6,7), connection learning rate 0.12 and training after every completed trial. Across seeds 1–12, 80 training trials and 20 evaluations capped at 15 seconds, neither adaptive nor random training improved any seed: mean survival fell from 2.32 to 2.19 seconds; no-training stayed at 2.32 seconds.

A diagnostic weight sweep showed the task was solvable, but that initial connection caused premature jumps. A weaker initialization, larger learning step, and no perturbation after reaching the survival cap were then explored on seeds 101, 239, 503, 887, 1237, 2017, 3571, 4861, 6841, 7919, 9011, 104729. At 80 trials with learning rate 0.12, only one of twelve seeds improved. At 200 trials with learning rate 0.5, eleven of twelve improved under both adaptive and random selection. Those pilot results informed the model choices; they are not held-out validation. Randomized spacing and speed ramping were added before the final new-seed comparisons above.

This is a deliberately small, hand-designed learning substrate. Choosing an initially weak connection is a modeling decision, not a measured property of organoid neurons. Broader initial weights, different geometry, noise, longer horizons and more seeds remain useful future stress tests.

## Reproduce

From the repository root, with Node.js 22 or later:

```sh
mkdir -p results
node scripts/learning-experiment.mjs --output results/new-ramp.json
node scripts/learning-experiment.mjs --fixed-speed --output results/new-fixed.json
```

Output files must not already exist. The defaults reproduce the final validation settings. The JSON contains individual trial outcomes, capped status, end speed, initial/final weight, training-pattern counts and selector values. Screenshots and interactive browser checks validate the interface separately; they are not evidence of learning.
