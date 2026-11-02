# Simplify the research demo

Keep the plain one-page application. Main views: Experiment, Run, Data; Hardware becomes a placeholder. Remove the predictive observer view and redundant exports from the interface; retain existing recording data and model modules. Archive data must survive network refresh.

1. Change configured miss feedback to 1 s and clear feedback to 0.5 s; version the protocol, migrate browser defaults without erasing weights, and test actual pulse/phase durations.
2. Keep experiment ID, trial count and Continue / Refresh network. New website sessions have no gameplay time limit. Preserve optional limits in the engine for scripted evaluations and legacy protocols. Accelerated execution must remain cancellable even if a trial never ends.
3. Draw a ball and rectangular columns with existing collision bounds. Show a 32-cell raster and explanatory labels; move fixed decoder and neuron editing parameters into collapsed research settings. Preserve spike control and local STDP. The binary sensory encoder is a separate explicit choice pending the user's response.
4. Put recording JSON and performance CSV in Data. Show trial outcomes, neural counts and actual beginning/end/delta weights per connection; do not invent a single weight per neuron. Remove physical distance from the main interface, retaining old raw metrics for compatibility.
5. Update integration tests, document local and headless execution, prepare a portable Git/source bundle and GitHub instructions. No cluster access or repository publication is implied without a destination. Verify, review, then update the existing private Site.
