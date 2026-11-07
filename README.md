# NeuroRunner

A local research demo: a spiking neural network controls a ball jumping over columns. Plain HTML, JavaScript and Node.js 22 or later; no package installation or cloud service is required.

## Run locally

Run `node server.mjs`, then open http://127.0.0.1:4173. Tests: `node --test`.

- **Experiment:** optional experiment ID, trial count, Continue current memory or Refresh network. Refresh resets the simulated network and training selector and preserves recordings. Website trials have no gameplay time limit.
- **Run:** Start/Pause, cancellable Run faster, New session and Step 50 ms. Manual control uses Space or a click while running. Research settings and neuron editing are collapsed. The raster shows six named cells: one input, one output and four training cells.
- **Data:** session/trial performance, per-cell activity and actual beginning/end/delta connection weights. Download recording JSON for full data or filtered performance CSV for analysis. The only plastic connection is N0 → N1; fixed training connections remain visible.
The website has three tabs: Experiment → Run → Data. Settings, activity and connection details are collapsed. Hardware modules remain in source for future use; the website makes no hardware requests.

## Model and signals

The game uses **one encoder and one decoder**. N0 receives obstacle time-to-contact as a 0–80 Hz pulse rate. N1 emits spikes; its rate over a 100 ms window triggers a jump above 20 Hz. No command means no jump, and the game prevents jumping while airborne. Four additional cells (N2–N5) deliver between-trial training; they are not extra action outputs.

The six cells use the same simple leaky integrate-and-fire defaults, with 1 ms neural integration, 120 Hz game physics and drawing on each browser animation frame. There is no random recurrent wiring, spontaneous noise, adaptation or hidden predictive observer. The initial N0 → N1 weight is seeded in [3, 4) model mV. Training cells connect as N2 → N0, N3 → N1, N4 → N1 and N5 → N0, with fixed model weights. Technical cell editing remains under Advanced.

After a collision, a selected pair of training cells receives model pulses 5 ms apart, repeated every 100 ms for **300 ms**. Only N0 → N1 changes, using local pair STDP during training (default connection learning rate 0.5). There is no training during play or after clears. An optional scripted trial time limit is treated as successful survival: preceding training receives credit, but no new perturbation is delivered. Stopped, manual and external trials do not train.

The separate software selector uses subsequent trial survival time to estimate pattern values, with learning rate 0.3 and eligibility decay 0.3. A selected pattern becomes eligible only after full delivery. Advanced settings offer adaptive selection, matched random pairs, and a no-training control. This is inspired by the paper's separation of input/output/training, not a replication of its organoid or 5/20-episode criterion. Model: `simple-lif-v1`; protocol: `paired-training-v1`.

**Difficulty:** every 10 cleared obstacles within a trial raises the speed target by 10% of the base speed. Speed ramps at 5% of base per second, capped at 500 px/s, and resets each trial. Edge-to-edge gaps vary uniformly from 550–1,150 px; widths and heights also vary. Random courses are seeded per trial for reproducible comparisons. Advanced settings can disable the speed ramp for a fixed-speed control. The ramp measures task progress, not proof of learning.

See [learning experiments](docs/research/learning-validation.md) for measured outcomes and limitations. The software can improve on this simulated task, but improvement is not reliable for every seed, and no organoid learning is established. Model voltages are not physical stimulation settings. [Historical notes](docs/legacy-research-notes.md) describe earlier protocols.

## Recordings and memory

Browser memory stores learned parameters; IndexedDB stores trial recordings. Refresh replaces model memory, not archived data. It uses fixed demo seed 42; scripts can choose a seed. Reload restores learned parameters and selector values with fresh transient state, cleared temporal credit and a new session identity. The replacement uses a new memory key; old 32-cell memory and archived recordings are preserved, not reinterpreted. Storage is browser/origin-local, not account- or cluster-synced. Back up JSON before clearing browser data.

Each trial includes experiment/session identity, session trial index, settings, start/end network snapshots, pulses, neural bins, sampled voltages, actions, phases, outcomes, generated obstacles, speed changes, training selections/probabilities, and credited preceding patterns. Historical records can still contain observer data. `complete` means gameplay closed, including stopped games; `recording_complete` means capture closed. End weights include delivered training; interrupted training is marked and earns no future credit. Neural rates use actual bin durations. Session means include stopped trials, are descriptive, and do not demonstrate learning.

The memory buffer retains 20 trials. Fast runs save every trial before eviction and pause on archive failure. JSON falls back to retained trials if the archive cannot be read and marks `archive_available: false`. Browser storage can be lost or evicted; this is not a laboratory data repository.

## Run without a browser

```sh
node scripts/run-session.mjs --experiment pilot-01 --trials 10 --seed 42 --output pilot-01.jsonl
```

One full trial recording per JSONL line, using the same engine and feedback. Output must be a new path; existing files are not overwritten. Ctrl+C / SIGTERM closes the current capture where possible. Trials can continue indefinitely; for a bounded scripted evaluation, add `--max-seconds 15`. That optional limit is recorded and is not a website setting.

The runner works on a worker with Node.js 22+. JHU cluster access, scheduler submission, shared storage and hardware connectivity are not configured or tested. Give each worker its own seed/output path. Browser memory is not shared with the runner.

## Compare learning conditions

For a longer learning run, choose 200 trials and Fast in the interface. For a reproducible comparison with separate before/after evaluation courses:

```sh
node scripts/learning-experiment.mjs --output results/learning-ramp.json
node scripts/learning-experiment.mjs --fixed-speed --output results/learning-fixed.json
```

Create `results/` first. Defaults: eight seeds, 200 training trials per condition, 10 evaluation trials before and after, 45-second trial cap. Evaluations freeze weights and disable training. Adaptive, random and no-training conditions start from matched weights and use matching evaluation courses. JSON includes per-seed outcomes; the cap must be considered when interpreting survival. Output paths must be new. No-training should reproduce its baseline exactly.

## GitHub and version control

Repository: https://github.com/XiaoyuSun-1/jumping_game_interface

Clone with `git clone https://github.com/XiaoyuSun-1/jumping_game_interface.git`. The GitHub repository starts from this code snapshot and retains its own version history; the supplied bundle also preserves earlier local/Sites commits.

Git history is preserved. The source ZIP supports review; the supplied Git bundle also contains commits:

```sh
git clone neurorunner-history.bundle neurorunner
cd neurorunner
git remote rename origin bundle
git remote add origin https://github.com/XiaoyuSun-1/jumping_game_interface.git
git push -u origin HEAD:main
```

If using the bundle, merge with the existing GitHub history before pushing; never force-push over it. The Sites publishing remote is not a GitHub repository. Keep recordings and credentials out of Git; `.gitignore` excludes results, JSONL and environment files. No open-source license has been assigned. `.openai/hosting.json` configures only the hosted demo and is unnecessary for local/cluster execution.
