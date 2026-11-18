"""Fit and sample an eight-electrode count model of spontaneous activity."""

import argparse
import csv
import hashlib
import io
import json
from pathlib import Path
from zipfile import ZipFile

import numpy as np


BINS_PER_SECOND = 10
ELECTRODES = 8
STATE_EDGES = (1, 2, 4, 8)
SOURCE_URL = "https://doi.org/10.5281/zenodo.22755004"
ARCHIVE_MD5 = "0ca4215ca670bfcd7d66eb7da378fac9"
SPLIT_SEED = 42
EVALUATION_SEED = 2026
REPEATS_PER_HOLDOUT_RECORDING = 16


def seconds_to_bins(seconds):
    bins = seconds * BINS_PER_SECOND
    if not np.isfinite(bins) or bins <= 0 or not float(bins).is_integer():
        raise ValueError("Duration must be a positive multiple of 0.1 seconds.")
    return int(bins)


def bin_spikes(channels, seconds):
    size = seconds_to_bins(seconds)
    if len(channels) != ELECTRODES:
        raise ValueError("Expected eight electrode channels.")
    counts = np.zeros((size, ELECTRODES), dtype=np.int32)
    for electrode, spikes in enumerate(channels):
        times = np.asarray(spikes)
        if times.ndim != 1 or not np.all(np.isfinite(times) & (times >= 0) & (times < seconds)):
            raise ValueError(f"Invalid timestamps on electrode {electrode + 1}.")
        indices = np.minimum((times * BINS_PER_SECOND).astype(np.int64), size - 1)
        counts[:, electrode] = np.bincount(indices, minlength=size)
    return counts


def load_recordings(archive):
    import h5py

    payload = archive.read_bytes()
    if hashlib.md5(payload, usedforsecurity=False).hexdigest() != ARCHIVE_MD5:
        raise ValueError("Expected the public Indiv_organoids.zip with the Zenodo checksum.")
    recordings = {}
    with ZipFile(io.BytesIO(payload)) as files:
        for member in sorted(files.namelist()):
            with h5py.File(io.BytesIO(files.read(member)), "r") as source:
                metadata = source["metadata"]
                group = int(metadata["fs_id"][0, 0])
                specimen = int(metadata["org_id"][0, 0])
                name = f"fs{group}-org{specimen}"
                if name != Path(member).stem or name in recordings:
                    raise ValueError(f"Unexpected recording identifier in {member}.")
                seconds = float(metadata["recording_duration"][0, 0])
                channels = []
                for reference in source["spike_times"][()].ravel():
                    dataset = source[reference]
                    times = [] if dataset.attrs.get("MATLAB_empty", 0) else dataset[()].ravel()
                    channels.append(times)
                recordings[name] = (group, bin_spikes(channels, seconds))
    return recordings, hashlib.sha256(payload).hexdigest()


def fit_profile(counts):
    patterns, codes, marginal = np.unique(counts, axis=0, return_inverse=True, return_counts=True)
    states = np.searchsorted(STATE_EDGES, counts[:-1].sum(axis=1), side="right")
    size = len(patterns)
    transitions = np.bincount(
        states * size + codes[1:], minlength=(len(STATE_EDGES) + 1) * size
    ).reshape(-1, size)
    transitions[transitions.sum(axis=1) == 0] = marginal
    return patterns, np.vstack((marginal, transitions))


def sample(profile, bins, rng, *, independent=False):
    patterns, weights = profile
    draws = rng.random(bins)
    cumulative = np.cumsum(weights, axis=1)
    cdf = cumulative / cumulative[:, -1:]
    if independent:
        return patterns[np.searchsorted(cdf[0], draws, side="right")]

    candidates = np.array([np.searchsorted(row, draws, side="right") for row in cdf])
    next_row = 1 + np.searchsorted(STATE_EDGES, patterns.sum(axis=1), side="right")
    codes = np.empty(bins, dtype=np.int64)
    row = 0
    for index in range(bins):
        codes[index] = candidates[row, index]
        row = next_row[codes[index]]
    return patterns[codes]


def save_model(path, profiles):
    arrays = {
        "version": np.array(1),
        "bin_seconds": np.array(1 / BINS_PER_SECOND),
        "state_edges": np.array(STATE_EDGES),
        "profiles": np.array(list(profiles)),
    }
    for index, (patterns, weights) in enumerate(profiles.values()):
        arrays[f"patterns_{index}"] = patterns
        arrays[f"weights_{index}"] = weights
    np.savez_compressed(path, **arrays)


def simulate(model_path, output_path, seconds, seed):
    bins = seconds_to_bins(seconds)
    rng = np.random.default_rng(seed)
    with np.load(model_path, allow_pickle=False) as model:
        if (
            model["version"].item() != 1
            or model["bin_seconds"].item() != 1 / BINS_PER_SECOND
            or not np.array_equal(model["state_edges"], STATE_EDGES)
        ):
            raise ValueError("Incompatible model format.")
        index = rng.integers(len(model["profiles"]))
        profile_name = model["profiles"][index]
        counts = sample((model[f"patterns_{index}"], model[f"weights_{index}"]), bins, rng)
    with output_path.open("w", newline="", encoding="utf-8") as output:
        writer = csv.writer(output)
        writer.writerow(["time_s", *(f"electrode_{i + 1}" for i in range(ELECTRODES))])
        writer.writerows((f"{i / BINS_PER_SECOND:.1f}", *row) for i, row in enumerate(counts))
    print(f"Generated {bins} bins with seed {seed}, training profile {profile_name}.")


def activity_metrics(counts):
    total = counts.sum(axis=1)
    by_second = total[: len(total) // BINS_PER_SECOND * BINS_PER_SECOND]
    by_second = by_second.reshape(-1, BINS_PER_SECOND).sum(axis=1)

    def fano(values):
        mean = values.mean()
        return float(values.var() / mean) if mean else 0.0

    def autocorrelation(lag):
        centered = total - total.mean()
        variance_sum = np.sum(centered**2)
        return float(np.sum(centered[:-lag] * centered[lag:]) / variance_sum) if variance_sum else 0.0

    return {
        "spikes_per_second": float(total.mean() * BINS_PER_SECOND),
        "silent_bin_fraction": float(np.mean(total == 0)),
        "multi_electrode_fraction": float(np.mean((counts > 0).sum(axis=1) >= 2)),
        "high_activity_fraction": float(np.mean(total >= STATE_EDGES[-1])),
        "fano_100ms": fano(total),
        "fano_1s": fano(by_second),
        "autocorrelation_100ms": autocorrelation(1),
        "autocorrelation_1s": autocorrelation(BINS_PER_SECOND),
    }


def distribution_distance(actual, generated):
    """Empirical 1-D Wasserstein distance, integrating the gap between CDFs."""
    points = np.sort(np.concatenate((actual, generated)))
    actual_cdf = np.searchsorted(np.sort(actual), points[:-1], side="right") / len(actual)
    generated_cdf = np.searchsorted(np.sort(generated), points[:-1], side="right") / len(generated)
    return float(np.sum(np.diff(points) * np.abs(actual_cdf - generated_cdf)))


def train(archive, output_dir):
    recordings, source_hash = load_recordings(archive)
    groups = sorted({group for group, _ in recordings.values()})
    holdout = set(np.random.default_rng(SPLIT_SEED).permutation(groups)[:5].tolist())
    profiles = {
        name: fit_profile(counts)
        for name, (group, counts) in recordings.items()
        if group not in holdout
    }
    rows = []
    source_inventory = {}
    rng = np.random.default_rng(EVALUATION_SEED)
    profile_names = list(profiles)
    for name, (group, counts) in recordings.items():
        seconds = len(counts) / BINS_PER_SECOND
        is_holdout = group in holdout
        source_inventory[name] = {
            "group": group,
            "split": "holdout" if is_holdout else "train",
            "duration_s": seconds,
            "spikes": int(counts.sum()),
        }
        if not is_holdout:
            continue
        rows.append(
            dict(source="holdout", recording=name, duration_s=seconds, **activity_metrics(counts))
        )
        for repeat in range(REPEATS_PER_HOLDOUT_RECORDING):
            profile_name = rng.choice(profile_names)
            seed = int(rng.integers(2**32))
            for method in ("markov", "independent"):
                generated = sample(
                    profiles[profile_name],
                    len(counts),
                    np.random.default_rng(seed),
                    independent=method == "independent",
                )
                rows.append(
                    dict(
                        source=method,
                        recording=name,
                        duration_s=seconds,
                        repeat=repeat,
                        profile=profile_name,
                        seed=seed,
                        **activity_metrics(generated),
                    )
                )

    metrics = list(activity_metrics(next(iter(recordings.values()))[1]))
    comparison = {}
    for metric in metrics:
        values = {
            method: [row[metric] for row in rows if row["source"] == method]
            for method in ("holdout", "markov", "independent")
        }
        comparison[metric] = {
            "medians": {method: float(np.median(samples)) for method, samples in values.items()},
            "distance_to_holdout": {
                method: distribution_distance(values["holdout"], values[method])
                for method in ("markov", "independent")
            },
        }
    summary = {
        "source": SOURCE_URL,
        "archive": "Indiv_organoids.zip",
        "archive_md5": ARCHIVE_MD5,
        "archive_sha256": source_hash,
        "numpy_version": np.__version__,
        "bin_seconds": 1 / BINS_PER_SECOND,
        "state_edges": STATE_EDGES,
        "split_seed": SPLIT_SEED,
        "training_groups": sorted(set(groups) - holdout),
        "holdout_groups": sorted(holdout),
        "evaluation_seed": EVALUATION_SEED,
        "repeats_per_holdout_recording": REPEATS_PER_HOLDOUT_RECORDING,
        "recordings": source_inventory,
        "comparison": comparison,
    }
    output_dir.mkdir(parents=True, exist_ok=True)
    save_model(output_dir / "model.npz", profiles)
    with (output_dir / "validation_metrics.csv").open("w", newline="", encoding="utf-8") as output:
        fields = ["source", "recording", "duration_s", "repeat", "profile", "seed", *metrics]
        writer = csv.DictWriter(output, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)
    (output_dir / "validation.json").write_text(
        json.dumps(summary, indent=2, allow_nan=False) + "\n", encoding="utf-8"
    )
    print(f"Fitted {len(profiles)} training profiles and evaluated {len(recordings) - len(profiles)} holdout recordings.")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    training = commands.add_parser("train")
    training.add_argument("archive", type=Path)
    training.add_argument("output_dir", type=Path)
    generation = commands.add_parser("simulate")
    generation.add_argument("model", type=Path)
    generation.add_argument("output", type=Path)
    generation.add_argument("--seconds", type=float, default=60)
    generation.add_argument("--seed", type=int, default=19)
    args = parser.parse_args()
    if args.command == "train":
        train(args.archive, args.output_dir)
    else:
        simulate(args.model, args.output, args.seconds, args.seed)


if __name__ == "__main__":
    main()
