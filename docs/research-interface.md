# Minimal game and editable network

The Run screen contains the game, controls and compact status. Settings and Network are collapsed by default. Explanatory panels, including Why learning can look sudden, have been removed. The simulation has eight cells: input N0, motor N1, and training N2–N7 with plastic mutual connections. Users can add/remove connections while paused and enable Auto connections for structural learning. Previous six-cell saves migrate to the new model while backups and historical recordings remain intact.

# Current interface

Run now includes experiment/session setup, trial count, memory initialization and a configurable per-trial duration (60 s default). Data contains archived connectivity, performance and weight-change maps. Obstacles and jump geometry are fixed; reward and collision punishment last 1 s each; optional empty-jump punishment lasts 0.5 s. The explanation panel has been removed and the connectivity map accepts future adapter-provided channel snapshots. The description below records the prior interface.

# Research interface

Current usage, signal mapping, feedback durations, recording semantics and portability are in the [README](../README.md).

The expanded interface has been simplified. Condition, preparation ID, notes, seed and optional time-limit metadata remain supported by stored/legacy protocols and source code, but are not website controls. Existing archived data remain. The predictive observer and adapter modules are retained for researchers; their interface controls have been removed or replaced with a hardware placeholder.

Trial-specific synaptic changes use recorded network_start and network_end snapshots matched by source/target cell. They differ from the live inspector's change relative to fresh network weights. Missing endpoints stay missing; they are never replaced by zero.
