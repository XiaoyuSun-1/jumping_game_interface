# NeuroRunner

A local research demo: a spiking neural network controls a ball jumping over columns. Plain HTML, JavaScript and Node.js 22 or later; no package installation or cloud service is required.

## Run locally

Run `node server.mjs`, then open http://127.0.0.1:4173. Tests: `node --test`.

- **Experiment:** optional experiment ID, trial count, Continue current memory or Refresh network. Refresh resets all simulated networks and preserves recordings. Website trials have no gameplay time limit.
- **Run:** Start/Pause, cancellable Run faster, New session and Step 50 ms. Manual control uses Space or a click while running. Research settings and neuron editing are collapsed. The raster shows all 32 cells; each E0–E7 pool contains four cells.
- **Data:** session/trial performance, per-cell activity and actual beginning/end/delta connection weights. Download recording JSON for full data or filtered performance CSV for analysis. Neurons have multiple incoming/outgoing weights, not one weight each.
The website has three tabs: Experiment → Run → Data. Settings, activity and connection details are collapsed. Hardware modules remain in source for future use; the website makes no hardware requests.

## Model and signals

32 heterogeneous leaky integrate-and-fire cells (24 excitatory, 8 inhibitory), sparse recurrent connections, noise, adaptation and local pair STDP. E0 receives proximity as a pulse rate; E1 receives grounded/airborne input. E2–E5 spikes drive a fixed rate-threshold jump decoder. E6–E7 are context recording pools. Neurons integrate at 1 ms; sensory encoding updates every 50 ms. This is not currently a per-frame binary obstacle stream.

After a clear, predictable synchronous sensory feedback lasts **0.5 s**; after collision, randomized sensory feedback lasts **1 s**. Both enter E0–E1; normal sensory encoding and motor decisions are gated during feedback. No extra rest. This is protocol `sensory-predictability-v3`; old records keep their original labels. Saved weights survive the timing migration.

Reward means the success feedback pattern, not a signed reward multiplier in the learning rule. This demo does not establish useful task learning, organoid learning or formal free-energy minimization. The predictive observer remains internal for recording compatibility; it has no interface tab or motor authority. Model voltages are not physical stimulation settings. [Historical notes](docs/legacy-research-notes.md) describe earlier protocols, not current controls or validation.

## Recordings and memory

Browser memory stores learned parameters; IndexedDB stores trial recordings. Refresh replaces model memory, not archived data. It uses fixed demo seed 42; scripts can choose a seed. Reload restores learned parameters with fresh transient state and a new session identity. Storage is browser/origin-local, not account- or cluster-synced. Back up JSON before clearing browser data.

Each trial includes experiment/session identity, session trial index, settings, start/end network snapshots, pulses, neural bins, sampled voltages, actions, phases, outcomes and optional observer data. `complete` means gameplay closed, including stopped games; `recording_complete` means capture closed. End weights include captured feedback; skipped feedback is marked. Neural rates use actual bin durations. Session means include stopped trials, are descriptive, and do not demonstrate learning.

The memory buffer retains 20 trials. Fast runs save every trial before eviction and pause on archive failure. JSON falls back to retained trials if the archive cannot be read and marks `archive_available: false`. Browser storage can be lost or evicted; this is not a laboratory data repository.

## Run without a browser

```sh
node scripts/run-session.mjs --experiment pilot-01 --trials 10 --seed 42 --output pilot-01.jsonl
```

One full trial recording per JSONL line, using the same engine and feedback. Output must be a new path; existing files are not overwritten. Ctrl+C / SIGTERM closes the current capture where possible. Trials can continue indefinitely; for a bounded scripted evaluation, add `--max-seconds 15`. That optional limit is recorded and is not a website setting.

The runner works on a worker with Node.js 22+. JHU cluster access, scheduler submission, shared storage and hardware connectivity are not configured or tested. Give each worker its own seed/output path. Browser memory is not shared with the runner.

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
