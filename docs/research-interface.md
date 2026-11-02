# Research interface

Current usage, signal mapping, feedback durations, recording semantics and portability are in the [README](../README.md).

The expanded interface has been simplified. Condition, preparation ID, notes, seed and optional time-limit metadata remain supported by stored/legacy protocols and source code, but are not website controls. Existing archived data remain. The predictive observer and adapter modules are retained for researchers; their interface controls have been removed or replaced with a hardware placeholder.

Trial-specific synaptic changes use recorded network_start and network_end snapshots matched by source/target cell. They differ from the live inspector's change relative to fresh network weights. Missing endpoints stay missing; they are never replaced by zero.
