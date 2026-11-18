# NeuroRunner

A jumping game controlled by an eight-neuron simulation. Run trials, edit the network, and compare saved sessions.

## Run locally

Requires Node.js 22 or newer. No packages to install.

```sh
node server.mjs
```

Open [localhost:4173](http://127.0.0.1:4173).

## Playing and running trials

- **Start** runs or pauses the game. **Fast** runs trials more quickly.
- Choose **Manual** to jump with Space or by clicking the game.
- Under **Simulation**, choose **FinalSpark-trained** to drive jumps from synthetic eight-electrode recordings, or **Learning network** for the original controller.
- In **Settings**, choose the trial count and time limit. The default is 60 seconds per trial. Click **Apply session** after changing the setup.
- **Continue** keeps the learned network. **Refresh** starts a fresh network and keeps past recordings.

## Features

- Eight neurons: one input, one jump output, and six training neurons with learning connections.
- Add or remove connections while paused. Turn on **Auto connections** for automatic rewiring.
- Inspired by the Free Energy Principle, a successful jump earns a 1-second reward. Collisions receive 1 second of punishment; unnecessary jumps receive 0.5 seconds. Unnecessary-jump punishment can be switched off.
- Fixed obstacle shape and jump height, with random obstacle spacing.
- Optional **Adaptive speed** raises speed by 5% after a collision-free completed trial with a clear, and lowers it by 5% after a collision. Speed stays fixed within each trial.
- Live connection maps, weight traces, weight-change heatmaps, and reward/punishment charts.

## Sessions and data

Open **Data → Session** to choose a run. Its trials appear together in the charts, with separate reward, collision, and unnecessary-jump panels.

**CSV** exports the selected session. **All JSON** backs up all available recordings. Your network and recordings are saved in this browser; they are not shared between computers.

## FinalSpark-trained simulation

The browser generates new 100 ms electrode count bins from the fitted spontaneous-activity model. A jump can fire when the summed electrode rate meets the jump threshold, subject to the game's normal jump rules. At 20 Hz this requires two detected spikes across the eight electrodes in the current bin. Game outcomes are scored normally. The sampled activity is independent of obstacle and reward signals, so this source serves as an open-loop baseline for comparison with the learning network.

The bundled model was fitted to 32 recordings from the public human forebrain organoid spike archive collected on the FinalSpark Neuroplatform. Thirteen recordings in separate recording groups were held out. The model reproduces some short-lag activity patterns and tends to generate quieter, more variable recordings than the holdout. Exported trials identify the model version, sampled training profile, and generator seed. [Itatani and Zavaglia, 2026, Zenodo, CC BY 4.0](https://doi.org/10.5281/zenodo.22755004)

The model asset runs in the browser. The [model package](models/finalspark/) includes the fitted Python model, training code, validation results, and commands to regenerate the browser asset.

## Run without the interface

```sh
node scripts/run-session.mjs --trials 10 --max-seconds 60 --output session.jsonl
```

Use a new output filename; existing files are not overwritten.

## Tests

```sh
npm test
```

The learning model is experimental, and higher speed is not always harder for it. See the [validation notes](docs/research/feedback-and-speed-validation.md).

Organoid hardware is not connected. The interface can display adapter-provided channel maps when an integration is available. See the [adapter documentation](docs/hardware-adapter.md).
