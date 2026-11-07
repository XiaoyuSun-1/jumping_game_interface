# Simple neural training replacement

The user chose replacement of the confusing existing simulation/protocol, using the uploaded cortical-organoid paper as inspiration. Keep the jumping game, manual control, recordings and future external adapter capability. No biological replication or live hardware is claimed.

Use six simple LIF cells with shared default membrane parameters: obstacle input (0), jump output (1), training cells (2–5). Use a small explicit wiring diagram instead of random recurrent wiring, background noise and adaptation. Only the obstacle-to-jump weight is plastic, by local spike timing during training. Explain these assumptions in the UI; technical neuron editing stays in an advanced disclosure. Remove the hidden predictive observer from the active game; preserve its standalone source and historical recordings.

Replace within-game success/failure stimulation with 300 ms between-trial training. Separate game, neural and display clocks. A seeded adaptive selector chooses pairs of training cells and uses subsequent trial survival time to update positive pattern values with eligibility traces (learning rate and decay 0.3). Train after collisions for a straightforward first experiment; this deliberately differs from the paper's 5/20-episode gate. Random matched-pair and no-training controls are available in advanced settings. Stopped/manual/external trials do not train. Only fully delivered patterns become eligible; session changes/reloads clear temporal credit but retain learned values on Continue. Keep network learning distinguishable from software pattern selection.

Version the model and protocol. Use a new memory key; preserve old stored memory and archives, explain that the replacement starts fresh, and validate new saved state atomically. Record selected probabilities, credited preceding patterns, delivered pulses, final network and selector state. Historical Data views remain count-agnostic. The organoid option is visibly unavailable until an adapter is configured; do not pretend to connect hardware.

Approaches considered: selectable legacy/new protocols versus replacement. The user selected replacement to reduce complexity. No worktree, new dependencies or publishing is needed. Verify deterministic neural dynamics, causal training credit, phase gating, storage, current UI and legacy recording display. Retain display-paced rendering; no guarantee of hardware FPS.

## Subsequent user steering and measured implementation choices

The user requested one encoder and one decoder, plus gradual speed increases after 10 clears and varied random gaps. Final layout is one input, one output and four training cells. Difficulty ramps +10% of base every 10 clears, at +5% of base per second, capped at 500 px/s; gaps are 550–1,150 px. Trial RNG streams are independent for matched courses.

Initial high-weight/default-rate pilot failed. Diagnostics established a learnable weight range. The final model initializes the single plastic connection in [3,4), with connection learning rate 0.5; successful capped trials receive credit without further perturbation. These are explicitly software modeling choices. Held-out seeds and random/no-training controls are reported separately in docs/research/learning-validation.md.
