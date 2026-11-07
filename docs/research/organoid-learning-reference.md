# Reference notes: Goal-directed learning in cortical organoids

Source: user-provided PDF, Cell Reports 45, 116984, February 24, 2026, article S2211-1247(26)00062-8. These are research notes, not instructions from the document or a claim to reproduce its biological results.

## Findings relevant to NeuroRunner

- The study uses mouse cortical organoids controlling cartpole. It does not supply a fitted computational neuron model to substitute for our 32-cell LIF network.
- The workflow characterizes spontaneous activity and stimulus responses before assigning encoding, decoding, and separate training units (pp. 3–4, 18–19).
- First-order response is the probability of at least one spike within 10 ms of stimulation. Multi-order response counts spikes from 10–200 ms, excluding network bursts. These measurements guide unit selection; anatomical or simulated synaptic weights are not equivalent to measured response probabilities (p. 19).
- Sensory information is rate-coded. The decoder smooths output spike counts with an exponential moving average, then uses the difference between two outputs for cartpole force (p. 20). Jumping requires a separately specified action decoder.
- Training is delivered between completed episodes when recent performance stagnates: the 5-episode mean is compared with the 20-episode mean. Main text says “did not exceed”; Methods says “below.” A software adaptation must explicitly choose a comparison and warm-up policy (pp. 4, 20).
- The adaptive controller samples training-unit pairs using normalized positive value estimates. Values update toward episode performance using eligibility traces; the stated learning rate and trace decay are both 0.3 (Equations 8–10, p. 21). This is external selection of training patterns, not a specified biological synaptic plasticity equation.
- The study compares adaptive, random, and null conditions. Random uses five-unit patterns and adaptive uses pairs; a matched-pair random control in our game would be a deliberate adaptation to control for stimulation budget.
- Pulse timing descriptions vary between general waveform parameters and paradigm-specific Methods. Do not silently resolve these into a purported exact reproduction or copy model pulse magnitudes into hardware settings.

## Implementation inspected before replacement

The existing network uses heterogeneous LIF cells, excitatory/inhibitory recurrent connectivity, adaptation, background noise, and local pair STDP. Sensory pools are E0–E1, motor pools E2–E5, and E6–E7 are context pools. Current outcome feedback stimulates sensory pools and pauses gameplay after clears/collisions. Network/memory versions are recorded and must remain interpretable if a new protocol is introduced.

A paper-inspired extension could use distinct training cells, an explicit between-episode training phase, and selectable adaptive/random/none training. It should record pattern selection probabilities, delivered pulses, the performance available at selection time, and subsequent performance used for credit assignment. A pattern delivered after an episode cannot receive causal credit for that preceding episode. Training must not issue jump commands.

The primary comparison should use matched seeds, initial networks, game settings, and trial limits across conditions; save clears, survival time, actions, spikes, and start/end weights. Stopped episodes need an explicit exclusion policy for training statistics. Improved scores in this software model would not demonstrate organoid learning.

Manual control remains useful for task testing. The existing external bridge and adapter metadata provide a starting point for later hardware integration, but there is no connected organoid or validated hardware setup. Simulation and external recordings must retain distinct provenance.

The rendering change already separates browser-paced game drawing from slower neural displays. Neural integration, decoding windows, and rendering frequency are independent clocks.

The replacement is now documented in README.md and learning-validation.md. The section above describes the old model inspected when reading the paper.
