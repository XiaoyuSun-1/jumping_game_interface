# Verification — simple neural training and variable difficulty

93 automated tests pass with `node --test`. These cover the six-cell model, one input/output path, deterministic integration, training-only synaptic changes, causal credit after full pattern delivery, interruption and mode changes, isolated new memory with old data preserved, historical 32-cell archive display, current recording completeness, CLI overwrite protection, display-paced drawing, random obstacle spacing, smooth speed progression after ten clears and its ceiling.

Headless Chromium checks exercised desktop and 390 px wide layouts, Experiment → Run → Data, manual jumping, three fast trials, six recorded cells and the disabled organoid option. No page JavaScript errors or horizontal mobile overflow were observed. This validates browser behavior in the cloud machine; it does not make the cloud-local URL available in the user's side preview.

The [learning validation](docs/research/learning-validation.md) reports matched adaptive/random/no-training experiments on eight new seeds, with 200 training trials each and frozen before/after evaluation. Adaptive runs improved in 6/8 seeds; random runs improved in 5/8. No-training evaluations reproduced baseline. Random-gap speed-ramp and fixed-speed results are retained with the report. Performance is capped at 45 seconds and does not establish a reliable adaptive advantage or organoid learning.

No live hardware, cluster connection or physical stimulation was used. The external adapter modules remain separate from the six-cell simulation.
