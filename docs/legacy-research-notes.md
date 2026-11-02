# Historical model notes

These notes describe the earlier interface and feedback protocol. They are retained as history, not current instructions. Feedback durations and website controls have changed; see README.md. Earlier learning comparisons do not validate the current protocol.

# NeuroRunner

## Predictive observer preview

The Predictive model tab exposes the experimental spike-driven sensory/temporal model as an observer alongside the existing game. It does not choose jumps and is not a validated active-inference game controller. The 32-cell LIF controller still controls gameplay. Current-clamp sensory/memory relays and intrinsic normalization remain modeling assumptions.

Every 100 session milliseconds, including feedback phases, the observer receives six explicit binary features: encoded stimulus intensity above .25/.50/.75, airborne, contact and feedback phase. A forced phase-boundary or terminal observation can have a shorter interval. Normal proximity/proprioceptive cues are gated during feedback and when sensory input is off; quiet rest is not labeled feedback. The action tag is whether an accepted jump occurred since the previous observation; blocked requests do not become executed jumps. Contact is sampled before the trial closes. The observer has its own neural clock; inference duration is not game duration. It is disabled for external bridge data.

Physical sensory and transition conductances learn through the same stochastic spike-response circuit tested in the research prototype (experiment commit 8bc9276). Incoming input signals are now six gameplay features instead of the four-feature calibration mixture; development-seed mixture results do not establish game prediction or control learning. Diagnostic surprise and filtering free energy are calculated with the pre-update generative parameters and never fed back as action decisions. The finite normalization circuit approximates the reference model during transients.

The tab shows actual latent/edge spikes, cells, conductances, intrinsic normalization currents, observation rows and recent prediction loss. 'Learn from gameplay' freezes both predictive synapse classes when off; inference continues. Predictor JSON exports its full physical checkpoint plus recent trial records. Existing full recording JSON includes per-trial predictive samples, actual spike events and start/end snapshots. This is prediction data, not evidence of improved gameplay.

Predictive weights and statistics use a separate versioned localStorage key, neurorunner.predictor.v1. Reload restores long-term parameters with fresh fast neural/belief state. A trial boundary clears the predictor's previous-cause belief but retains physical weights, adaptation and neural time; session boundaries retain learning. Clear predictor memory ends the current trial and starts a paused trial while retaining the LIF network; the header Clear memory resets both models. Neither operation deletes the archive. Invalid predictive checkpoints are retained and reported instead of silently overwritten. Abrupt closure can lose the latest autosave interval; exports provide backups.

Plain browser jumping-game / neural-interface experiment. Current controller: 32 heterogeneous LIF cells, 24 excitatory and 8 inhibitory, sparse signed recurrent connections, background noise and adaptation. All data are simulated unless an external adapter is selected. No FinalSpark account or hardware is connected.

## Run and check

Requires Node.js 22+: `node server.mjs`, then open http://127.0.0.1:4173. No dependencies. Tests: `node --test`.

The current feedback experiment is `lif-dishbrain-v2` / `sensory-predictability-v2`. It does **not** implement a formal free-energy or expected-free-energy minimizer. The user selected spikes as the sole controller; no digital active-inference planner selects actions.

## Feedback phases

- PLAY: E0 encodes obstacle proximity with 0–40 Hz model pulses (4–40 Hz when active); E1 encodes grounded/airborne state at 20/4 Hz. E2–E5 motor spikes alone drive the fixed jump decoder. Four cells contribute per conceptual electrode. E6/E7 are context recording pools.
- CLEAR FEEDBACK: normal sensory input is replaced by a time-locked, synchronous 100 Hz pattern on E0/E1 for 100 ms.
- MISS FEEDBACK: game motion stops; pulse timing and E0-versus-E1 selection are randomized at an expected event rate of 5 Hz, default duration 4 s, configurable 0–20 s.
- After miss feedback, the next trial starts immediately. Quiet rest has been removed from the website; old saved rest settings migrate to zero without clearing the network.
- NEXT TRIAL: game resets; network parameters, weights and current neural state persist.

Game time pauses during feedback; session and neural time advance. All motor requests are gated during feedback, and the decoder window is cleared at transitions so evoked spikes cannot directly count as an action. Actual modeled pulses and phase transitions are logged. Sensory input, randomized feedback and background noise use separate random streams. A model pulse is a 7 mV-equivalent input jump scaled by excitability, **not** a hardware amplitude. These patterns are paper-inspired, not an exact laboratory replication or an energy-matched comparison.

Sessions and Run 10 trials use the same phase sequence; batches simulate it faster than wall time and end a game after collision or 15 gameplay seconds. Pause freezes phases; hiding the tab pauses the session. Next trial/New session may explicitly skip a remaining phase, which is marked in the recording.

## Plasticity and model

Weights now follow ordinary local pair-based STDP continuously while plasticity is enabled; outcomes do not multiply synaptic changes by +1/−1. Excitatory weights stay in 0–6 mV; inhibitory weights are fixed and negative. Turning feedback off removes outcome stimulation, not spontaneous local plasticity; freezing plasticity is the independent learning control. Manual mode freezes synapses. This learning rule is a software assumption, not a measured mechanism of DishBrain's learning.

At 1 ms resolution, voltage leaks toward rest + bias × excitability − adaptation, then receives signed synaptic impulses, background and sensory/feedback impulses. Threshold crossings emit spikes, reset voltage and enforce refractoriness. Defaults: rest −65 mV, reset −68 mV, thresholds −51 to −48 mV, leak constants 18–30 ms, refractory periods 2–5 ms, bias 9–13 mV equivalent, background 12 Hz × 5 mV per cell, adaptation +1.5 mV/spike with 200 ms decay. STDP pre/post traces decay over 20 ms, A+ 0.02 and A− 0.021; the inspector also retains a 1000 ms diagnostic eligibility trace. It is not used as a signed game reward. These are not fitted organoid parameters.

Open Neuron parameters and synaptic weights to inspect voltages, per-cell parameters, spike counts and all connections touching any selected cell. Pause to edit threshold, leak constant, refractory period or bias. Validation rejects invalid edits atomically.

## Learning evidence — not a validated learner

The original outcome-STDP controller failed its earlier comparison. The revised feedback model also does not establish sustained task learning. In a prespecified seed-42 comparison with 5,000 trials per condition:

| Condition | First 1,000: mean clears | Last 1,000: mean clears |
|---|---:|---:|
| Frozen weights | 0.395 | 0.385 |
| Local STDP | 1.048 | 1.042 |

First/last 100-trial averages were 0.46/0.46 frozen and 0.97/1.18 with plasticity. The narrow last-100 increase should not be advertised as a sustained learning curve. Full summaries: parent workspace `output/feedback-benchmark-5000.jsonl`. Reproduce with `node scripts/feedback-benchmark.mjs 42 5000`; the headless harness omits logging only and is tested against normal dynamics.

Random action request sanity checks on seed42 and 5,000 trials averaged 0.183, 0.2908 and 0.4818 clears for Poisson request rates 0.5, 1 and 2 Hz. Always jumping scored zero under this seed's initial obstacle timing. These are not matched-rate, held-out or multi-seed controls.

More trials cannot substitute for a validated learning mechanism. Local STDP changes correlations without explicitly optimizing jump timing, sensory prediction or expected free energy. Multiple seeds, held-out evaluation, matched-action-rate and yoked-feedback controls, and an explicitly derived predictive learning rule remain necessary before claiming cue-dependent learning. Changing weight values alone is not evidence of useful learning.

## Memory, recordings and performance

New session and mode changes preserve weights. Only Clear memory reinitializes the network; the seed field applies to that next explicit reset. Existing legacy weights are retained and tagged rather than silently erased. Long-term parameters/weights/settings/history save locally about once per second and on pause/transitions/page exit. Reload starts a paused trial with saved weights and parameters; transient voltages, spike traces and adaptation start fresh. Memory is browser/origin-local, not account-synced; simultaneous tabs use the latest save. Invalid/unavailable storage is reported.

Download recordings JSON reads the separate IndexedDB archive. Per-trial data include model/protocol versions, origin, settings, actual pulses, phase transitions, spike bins, actions, parameter changes, outcomes, game and phase durations, distance, clears/jumps and start/end network snapshots. Simulated bins contain 32 per-cell counts and sampled voltages, normally every 50 ms; partial bins state their actual duration. These are not raw 1 ms voltage waveforms or extracellular recordings. External data contain electrode counts only.

Clearing learning memory does not delete the recording archive. Export recent JSON includes the last 20 in-memory recordings independently of the 30,000-event display ring. Recordings checkpoint locally; abrupt closure can lose the latest uncommitted data and browser storage can be evicted. Download backups. No replay was added.

Performance shows the latest 500 available rows and offers full performance CSV. JSON exports include performance fields. Distance is the game's simulated scale (actual px / 30), not physical distance. Older unknown distances are null/—. Rolling averages separate model/protocol, controller mode, feedback and plasticity conditions; other settings can still differ. Results are observations, not proof of learning.

## External bridge

The bridge remains a generic interface contract, not a FinalSpark SDK implementation. POSTs include request/session IDs, gameplay time, session time, phase, remaining phase duration, 50 ms response-bin size and packets. Return matching request_id and exactly eight integer counts in 0–100. Requests use HTTPS except localhost, one pending call and 2 s timeout. CORS must allow the page origin. Credentials stay on the adapter server. Hardware translation needs access, actual channel assignment, artifact suppression, time synchronization, approved stimulation and a hardware cleanup path. Never directly translate model input voltages into physical stimulation.

## References and design

- DishBrain (2022): https://doi.org/10.1016/j.neuron.2022.09.001
- Cortical Labs follow-up (2025), sensory/motor and feedback methods: https://doi.org/10.34133/cbsystems.0336
- LIF dynamics: https://neuronaldynamics.epfl.ch/online/Ch1.S3.html
- Historical reward-modulated STDP reference (previous controller, not the current rule): https://izhikevich.org/publications/dastdp.htm
- FinalSpark platform / current SDK: https://doi.org/10.3389/frai.2024.1376042 ; https://finalspark-np.github.io/np-docs/np_core/doc_v2.html

The full reviewed design is in the parent workspace `output/free-energy-feedback-design.md`. The implemented branch is a DishBrain-inspired feedback experiment. A formal active-inference controller remains a distinct, unimplemented alternative.
