# Simple Neural Training Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Replace the old neuron/protocol experience with an understandable six-cell simulation and between-trial training.
**Architecture:** Explicit LIF network plus a separate seeded training-pattern selector; engine owns trial phase and credit boundaries. UI explains roles and exposes advanced controls without mixing physical and simulated signals.
**Tech Stack:** Existing plain browser JavaScript, Node.js 22+, node:test; no dependencies.
**Spec:** docs/superpowers/specs/2026-11-07-simple-neural-training-design.md

## Global Constraints
- Preserve archives and existing manual/external provenance.
- Six cells; 1 ms neural integration, 120 Hz physics, browser-paced drawing.
- 300 ms training, paired training pulses 5 ms apart repeated every 100 ms; model-only amplitude.
- Credit only subsequent natural neural trials and only fully delivered patterns.
- New memory key, atomic validation, no forced migration of old weights.

## Review Focus
- Aborted training must not earn future credit (Task 2).
- Reload/new sessions must not credit an unrelated old action (Task 3).
- Manual and external modes must not issue simulated training (Task 2).
- Historical 32-cell recordings must remain readable (Task 3).
- UI must render every display frame without redrawing all neural data (Task 3).

### Task 1: Network and pattern selector
Files: dist/network.js, dist/training.js, tests/network.test.js, tests/training.test.js.
Interfaces: SpikingNetwork.train(pair,durationMs), advance(ms,options), snapshot(); TrainingSelector.observe(seconds), choose(mode), delivered(index), resetCredit(), snapshot(), static restore(state).
- [x] Write tests for six roles, deterministic counts, training-only plasticity, pulse routing, weighted causal selection and invalid state.
- [x] Run targeted tests and confirm failures before implementation.
- [x] Implement explicit wiring, simple membrane dynamics and standalone selector.
- [x] Run node --test tests/network.test.js tests/training.test.js. Expected: all pass.

### Task 2: Engine integration and recording
Files: dist/engine.js, tests/dishbrain.test.js, tests/engine.test.js, tests/recording.test.js, tests/predictive.test.js.
Interfaces: trainingMode and trainingSeconds settings; training phase; model_version simple-lif-v1 and feedback_protocol paired-training-v1; record.training and training_state_start/end.
- [x] Replace obsolete protocol assertions with tests for uninterrupted clears, terminal training, manual/external exclusion, skipped delivery, final weights, and six-cell capture.
- [x] Run targeted tests and confirm failures.
- [x] Integrate selector and remove active predictive observer; keep standalone observer modules/tests.
- [x] Run targeted engine/recording/CLI tests. Expected: all pass.

### Task 3: Memory, understandable UI and validation
Files: dist/memory.js, dist/app.js, dist/index.html, dist/inspector.js, dist/style.css, README.md, VERIFICATION.md, tests/memory.test.js, tests/app.test.js.
- [x] Add tests for new-key isolation, selector persistence with cleared credit, malformed state rejection, role explanation and disabled external option.
- [x] Implement storage validation and simple role/training summary; preserve older archive rendering.
- [x] Run node --test. Expected: all tests pass.
- [x] Run bounded multitrial CLI simulation and verify records; verify HTTP assets; check diff.
- [x] Attempt independent review; reviewer could not run because its account usage limit was reached. Complete self-review, fix mode-switch provenance regression, and report this limitation.

Pre-flight: Task 2 consumes Task 1's six-channel counts and selector delivery API; Task 3 consumes Task 2's versioned snapshots. Keep external eight-channel wire format, with explicit new simulated channel roles. Prior frame-rate changes remain in the working tree.

## Subsequent user steering and measured implementation choices

The user requested one encoder and one decoder, plus gradual speed increases after 10 clears and varied random gaps. Final layout is one input, one output and four training cells. Difficulty ramps +10% of base every 10 clears, at +5% of base per second, capped at 500 px/s; gaps are 550–1,150 px. Trial RNG streams are independent for matched courses.

Initial high-weight/default-rate pilot failed. Diagnostics established a learnable weight range. The final model initializes the single plastic connection in [3,4), with connection learning rate 0.5; successful capped trials receive credit without further perturbation. These are explicitly software modeling choices. Held-out seeds and random/no-training controls are reported separately in docs/research/learning-validation.md.

Validation: 93/93 tests passed; desktop/mobile Chromium flow passed. Final learning comparisons and raw data are in docs/research/learning-validation.md. No commit or publication was requested; changes are left reviewable in the working tree.
