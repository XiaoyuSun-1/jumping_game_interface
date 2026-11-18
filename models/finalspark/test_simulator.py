import unittest

import numpy as np

import simulator


class SimulatorTests(unittest.TestCase):
    def test_binning_keeps_silent_bins_and_electrodes(self):
        counts = simulator.bin_spikes([[0, 0.09, 0.1], [0.29]] + [[]] * 6, 0.4)
        np.testing.assert_array_equal(counts[:, :2], [[2, 0], [1, 0], [0, 1], [0, 0]])
        self.assertEqual(counts.shape, (4, 8))
        self.assertEqual(counts.sum(), 4)
        with self.assertRaises(ValueError):
            simulator.bin_spikes([[0.4]] + [[]] * 7, 0.4)

    def test_model_learns_alternation_and_replays_seed(self):
        counts = np.zeros((100, 8), dtype=int)
        counts[1::2, [0, 3]] = [5, 3]
        profile = simulator.fit_profile(counts)
        generated = simulator.sample(profile, 41, np.random.default_rng(9))
        np.testing.assert_array_equal(
            generated, simulator.sample(profile, 41, np.random.default_rng(9))
        )
        self.assertEqual(generated.shape, (41, 8))
        np.testing.assert_array_equal(generated[1:] + generated[:-1], np.tile(counts[1], (40, 1)))
        independent = simulator.sample(profile, 41, np.random.default_rng(9), independent=True)
        self.assertTrue(np.any(independent[1:, 0] == independent[:-1, 0]))


if __name__ == "__main__":
    unittest.main()
