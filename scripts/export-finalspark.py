"""Convert the fitted NumPy model to a static browser asset."""

import argparse
import json
from pathlib import Path

import numpy as np


parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("model", type=Path)
parser.add_argument("output", type=Path)
args = parser.parse_args()

with np.load(args.model, allow_pickle=False) as model:
    if (model["version"].item(), model["bin_seconds"].item(), model["state_edges"].tolist()) != (
        1, 0.1, [1, 2, 4, 8]
    ):
        raise ValueError("Expected the v1 FinalSpark 100 ms model.")
    profiles = []
    for index, name in enumerate(model["profiles"]):
        patterns = model[f"patterns_{index}"]
        weights = model[f"weights_{index}"]
        if (
            patterns.ndim != 2
            or patterns.shape[1] != 8
            or not np.issubdtype(patterns.dtype, np.integer)
            or np.any((patterns < 0) | (patterns > 100))
            or weights.shape != (6, len(patterns))
            or not np.issubdtype(weights.dtype, np.integer)
            or np.any(weights < 0)
            or np.any(weights.sum(axis=1) == 0)
        ):
            raise ValueError(f"Invalid patterns or weights for {name}.")
        profiles.append({"name": str(name), "patterns": patterns.tolist(), "weights": weights.tolist()})

args.output.write_text(
    json.dumps(profiles, separators=(",", ":")) + "\n", encoding="utf-8", newline="\n"
)
