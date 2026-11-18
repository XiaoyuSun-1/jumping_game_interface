# FinalSpark spontaneous activity model

This stochastic model generates detected spike counts for eight electrode channels. Each row of its output covers a 100 ms interval. The same fitted distributions power **FinalSpark-trained** in NeuroRunner.

## Generate a recording

From the repository root, with Python 3.12 and NumPy installed:

```sh
python -m pip install numpy==2.3.5
python models/finalspark/simulator.py simulate models/finalspark/model.npz synthetic.csv --seconds 60 --seed 19
```

The fitted model works offline. [Example output](example.csv) shows 60 seconds of simulated counts. Each column corresponds to the electrode's position within a source recording. The browser and Python use the same fitted distributions and different random number generators.

## Rebuild from the public recordings

Download [Indiv_organoids.zip](https://zenodo.org/records/22755004/files/Indiv_organoids.zip?download=1) to the repository root. The training script verifies the published MD5 and reads the archive directly.

```sh
python -m pip install numpy==2.3.5 h5py==3.15.1
python models/finalspark/simulator.py train Indiv_organoids.zip results/finalspark
python -m unittest discover -s models/finalspark -v
python scripts/export-finalspark.py results/finalspark/model.npz dist/finalspark-model.json
```

The training code bins the raw spike timestamps using the recorded duration in each file. The model samples a recording profile and then generates eight-electrode count vectors conditioned on the previous bin's total activity. Five activity levels determine the transition distributions. These distributions stay fixed within each synthetic recording.

## Data and validation

The release contains 45 spontaneous forebrain organoid recordings collected on the FinalSpark Neuroplatform. Training used 32 recordings with 518,369 detected spikes. The holdout used 13 recordings from five distinct `fs` recording groups. [Itatani and Zavaglia, 2026, Zenodo, CC BY 4.0](https://doi.org/10.5281/zenodo.22755004)

| Median per recording | Held-out | Simulation | Independent-bin baseline |
| --- | ---: | ---: | ---: |
| Autocorrelation at 100 ms | 0.595 | 0.556 | −0.001 |
| Detected spikes per second across electrodes | 15.67 | 10.37 | 10.28 |
| Bins with at least two active electrodes | 19.7% | 8.6% | 8.4% |
| One-second count variance divided by mean | 12.13 | 55.70 | 14.27 |

The simulator reproduces some short-term clustering. It tends to generate quieter traces, with less simultaneous electrode activity and greater one-second count variability. Validation covers one within-dataset split and spontaneous recordings. [Split, archive checksum, and full metrics](validation.json)
