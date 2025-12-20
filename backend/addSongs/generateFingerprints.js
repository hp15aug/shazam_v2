import FFT from "fft.js";

// ACCURACY-OPTIMIZED PARAMETERS
const WINDOW_SIZE = 4096; // Keep for frequency resolution
const HOP_SIZE = 1024; // CRITICAL: Add 75% overlap for better time resolution
const LOWER_LIMIT_HZ = 250; // Lower to catch more bass features
const UPPER_LIMIT_HZ = 6000; // Higher to catch more harmonics
const TARGET_ZONE_SIZE = 10; // MUCH larger target zone for more pairs
const FAN_OUT = 15; // MUCH higher fan-out for redundancy
const PEAKS_PER_FRAME = 15; // MORE peaks per frame
const PEAK_THRESHOLD = 0.3; // Lower threshold to catch weaker features
const PEAK_NEIGHBORHOOD = 5; // Larger for more robust peak detection
const FREQ_QUANTIZATION = 3; // Finer quantization for precision
const TIME_QUANTIZATION = 2; // Add time quantization for robustness
const sampleRate = 44100;

// NEW: Multi-scale analysis parameters
const ENABLE_MULTI_SCALE = true;
const ADDITIONAL_WINDOW_SIZES = [2048, 8192]; // Analyze at multiple scales

// NEW: Advanced peak filtering
const ENABLE_HARMONIC_FILTERING = true;
const MIN_PEAK_SEPARATION_HZ = 50; // Minimum frequency separation between peaks

/**
 * Apply Hamming window for better frequency resolution
 */
function applyHammingWindow(signal, windowSize) {
  const windowed = new Float32Array(windowSize);
  for (let i = 0; i < windowSize; i++) {
    const windowValue =
      0.54 - 0.46 * Math.cos((2 * Math.PI * i) / (windowSize - 1));
    windowed[i] = signal[i] * windowValue;
  }
  return windowed;
}

/**
 * Enhanced audio normalization with DC offset removal
 */
function normalizeAudio(signal) {
  // Remove DC offset
  let sum = 0;
  for (let i = 0; i < signal.length; i++) {
    sum += signal[i];
  }
  const dcOffset = sum / signal.length;

  // Find max after DC removal
  let max = 0;
  for (let i = 0; i < signal.length; i++) {
    const value = signal[i] - dcOffset;
    const abs = Math.abs(value);
    if (abs > max) max = abs;
  }

  if (max === 0) return signal;

  // Normalize to use full dynamic range
  const factor = 127 / max;
  const normalized = new Int8Array(signal.length);
  for (let i = 0; i < signal.length; i++) {
    normalized[i] = Math.round((signal[i] - dcOffset) * factor);
  }

  return normalized;
}

/**
 * Enhanced FFT with overlap and windowing
 */
function performEnhancedFFT(audioBuffer, windowSize = WINDOW_SIZE) {
  const audio = new Int8Array(audioBuffer);
  const totalSize = audio.length;
  const spectrogram = [];
  const fft = new FFT(windowSize);

  console.log(
    `  → Processing ${totalSize} samples with ${windowSize} window, ${HOP_SIZE} hop (${Math.round(
      (1 - HOP_SIZE / windowSize) * 100
    )}% overlap)`
  );

  // Process overlapping windows
  for (let start = 0; start + windowSize <= totalSize; start += HOP_SIZE) {
    const input = new Array(windowSize * 2);

    // Extract and window the audio segment
    const segment = new Float32Array(windowSize);
    for (let i = 0; i < windowSize; i++) {
      segment[i] = audio[start + i];
    }

    // Apply Hamming window
    const windowed = applyHammingWindow(segment, windowSize);

    // Prepare for FFT
    for (let i = 0; i < windowSize; i++) {
      input[i * 2] = windowed[i];
      input[i * 2 + 1] = 0;
    }

    const output = fft.createComplexArray();
    fft.transform(output, input);

    // Convert to magnitude spectrum
    const magnitudes = new Float32Array(windowSize / 2);
    for (let i = 0; i < windowSize / 2; i++) {
      const real = output[i * 2];
      const imag = output[i * 2 + 1];
      magnitudes[i] = Math.sqrt(real * real + imag * imag);
    }

    spectrogram.push(magnitudes);
  }

  console.log(`  → Generated ${spectrogram.length} spectral frames`);
  return spectrogram;
}

/**
 * Perform FFT at multiple scales (window sizes)
 */
function performMultiScaleFFT(audioBuffer) {
  const results = [];

  // Primary scale
  results.push({
    scale: WINDOW_SIZE,
    data: performEnhancedFFT(audioBuffer, WINDOW_SIZE),
  });

  // Additional scales
  for (const size of ADDITIONAL_WINDOW_SIZES) {
    results.push({
      scale: size,
      data: performEnhancedFFT(audioBuffer, size),
    });
  }

  return results;
}

/**
 * Filter out harmonics to reduce false positives
 */
function filterHarmonics(peaks) {
  if (!ENABLE_HARMONIC_FILTERING || peaks.length <= 1) return peaks;

  const filtered = [];
  const minSeparation = Math.floor(
    (MIN_PEAK_SEPARATION_HZ * WINDOW_SIZE) / sampleRate
  );

  for (let i = 0; i < peaks.length; i++) {
    let isHarmonic = false;

    // Check if this peak is a harmonic of a stronger peak
    for (let j = 0; j < i; j++) {
      const freqRatio = peaks[i].freq / peaks[j].freq;
      const isNearInteger = Math.abs(freqRatio - Math.round(freqRatio)) < 0.1;
      const tooClose = Math.abs(peaks[i].freq - peaks[j].freq) < minSeparation;

      if ((isNearInteger && peaks[j].mag > peaks[i].mag) || tooClose) {
        isHarmonic = true;
        break;
      }
    }

    if (!isHarmonic) {
      filtered.push(peaks[i]);
    }
  }

  return filtered;
}

/**
 * Enhanced spectral peak detection with adaptive thresholding
 */
function findSpectralPeaks(magnitudes, windowSize = WINDOW_SIZE) {
  const peaks = [];

  const LOWER_LIMIT = Math.floor((LOWER_LIMIT_HZ * windowSize) / sampleRate);
  const UPPER_LIMIT = Math.floor((UPPER_LIMIT_HZ * windowSize) / sampleRate);

  // Calculate percentile-based threshold (more robust than mean)
  const relevantMagnitudes = [];
  for (let i = LOWER_LIMIT; i < UPPER_LIMIT && i < magnitudes.length; i++) {
    relevantMagnitudes.push(magnitudes[i]);
  }
  relevantMagnitudes.sort((a, b) => a - b);

  const percentileIdx = Math.floor(relevantMagnitudes.length * 0.85); // 85th percentile
  const percentileValue = relevantMagnitudes[percentileIdx] || 0;
  const dynamicThreshold = percentileValue * PEAK_THRESHOLD;

  // Find local maxima with stricter criteria
  for (
    let i = LOWER_LIMIT + PEAK_NEIGHBORHOOD;
    i < UPPER_LIMIT - PEAK_NEIGHBORHOOD && i < magnitudes.length;
    i++
  ) {
    const mag = magnitudes[i];

    if (mag <= dynamicThreshold) continue;

    // Check if local maximum in larger neighborhood
    let isLocalMax = true;
    let prominenceSum = 0;

    for (let j = i - PEAK_NEIGHBORHOOD; j <= i + PEAK_NEIGHBORHOOD; j++) {
      if (j !== i && j >= 0 && j < magnitudes.length) {
        if (magnitudes[j] >= mag) {
          isLocalMax = false;
          break;
        }
        prominenceSum += mag - magnitudes[j];
      }
    }

    if (isLocalMax) {
      // Calculate peak prominence for quality scoring
      const prominence = prominenceSum / (2 * PEAK_NEIGHBORHOOD);
      peaks.push({
        freq: i,
        mag: mag,
        prominence: prominence,
      });
    }
  }

  // Sort by magnitude first, then by prominence
  peaks.sort((a, b) => {
    const magDiff = b.mag - a.mag;
    if (Math.abs(magDiff) > 0.01) return magDiff;
    return b.prominence - a.prominence;
  });

  // Filter harmonics before limiting count
  const filtered = filterHarmonics(peaks);

  return filtered.slice(0, PEAKS_PER_FRAME);
}

/**
 * Extract peaks from all spectrograms
 */
function extractSpectralPeaks(spectrograms) {
  const allPeaks = [];

  // Use primary spectrogram (largest window) for main timeline
  // But we could fuse peaks from multiple scales here if we wanted to be fancy
  // For now, we'll just process the primary scale for simplicity in the timeline structure
  // and maybe use other scales for feature augmentation later
  const primarySpectro = spectrograms[0];

  for (let frameIdx = 0; frameIdx < primarySpectro.data.length; frameIdx++) {
    const peaks = findSpectralPeaks(
      primarySpectro.data[frameIdx],
      primarySpectro.scale
    );
    allPeaks.push(peaks);
  }

  const totalPeaks = allPeaks.reduce((sum, peaks) => sum + peaks.length, 0);
  console.log(
    `  → Extracted ${totalPeaks} peaks (avg ${(
      totalPeaks / allPeaks.length
    ).toFixed(1)} per frame)`
  );

  return allPeaks;
}

/**
 * Create robust hashes by fuzzing the values
 */
function createRobustHashes(anchorFreq, targetFreq, timeDelta) {
  const hashes = [];

  // Base quantization
  const f1 = Math.floor(anchorFreq / FREQ_QUANTIZATION);
  const f2 = Math.floor(targetFreq / FREQ_QUANTIZATION);
  const t = Math.floor(timeDelta / TIME_QUANTIZATION);

  // Generate main hash
  hashes.push(`${f1 * FREQ_QUANTIZATION}:${f2 * FREQ_QUANTIZATION}:${t * TIME_QUANTIZATION}`);

  // Generate fuzzy variants for robustness (neighbors in freq/time)
  // This increases database size but significantly improves match rate in noise
  const variants = [
    [0, 0, 1], // Time shift +1
    [0, 0, -1], // Time shift -1
    [0, 1, 0], // Freq2 shift +1
    [0, -1, 0], // Freq2 shift -1
    [1, 0, 0], // Freq1 shift +1
    [-1, 0, 0], // Freq1 shift -1
  ];

  for (const [df1, df2, dt] of variants) {
    hashes.push(
      `${(f1 + df1) * FREQ_QUANTIZATION}:${(f2 + df2) * FREQ_QUANTIZATION}:${(t + dt) * TIME_QUANTIZATION
      }`
    );
  }

  return hashes;
}

/**
 * Enhanced constellation map with intelligent pairing and robust hashing
 */
function createConstellationMap(spectralPeaks) {
  const fingerprints = [];
  const hashSet = new Set(); // Prevent exact duplicates

  console.log(
    `  → Creating constellation with target zone ${TARGET_ZONE_SIZE}, fan-out ${FAN_OUT}`
  );

  // For each anchor point
  for (let anchorTime = 0; anchorTime < spectralPeaks.length; anchorTime++) {
    const anchorPeaks = spectralPeaks[anchorTime];

    if (anchorPeaks.length === 0) continue;

    // For each peak in anchor frame
    for (const anchorPeak of anchorPeaks) {
      const pairs = [];

      // Look ahead in target zone
      const targetZoneEnd = Math.min(
        anchorTime + TARGET_ZONE_SIZE + 1,
        spectralPeaks.length
      );

      for (
        let targetTime = anchorTime + 1;
        targetTime < targetZoneEnd;
        targetTime++
      ) {
        const targetPeaks = spectralPeaks[targetTime];

        // Pair with peaks in target frame
        for (const targetPeak of targetPeaks) {
          const timeDelta = targetTime - anchorTime;

          // Calculate pairing quality score
          const freqDiff = Math.abs(targetPeak.freq - anchorPeak.freq);
          const magnitudeProduct = anchorPeak.mag * targetPeak.mag;
          const pairQuality = magnitudeProduct / (1 + freqDiff * 0.01);

          pairs.push({
            targetPeak,
            timeDelta,
            quality: pairQuality,
          });
        }
      }

      // Sort pairs by quality and take top FAN_OUT
      pairs.sort((a, b) => b.quality - a.quality);
      const topPairs = pairs.slice(0, FAN_OUT);

      // Create fingerprints from top pairs
      for (const pair of topPairs) {
        // Generate robust variant hashes for noise tolerance
        const variantHashes = createRobustHashes(
          anchorPeak.freq,
          pair.targetPeak.freq,
          pair.timeDelta
        );

        for (const hash of variantHashes) {
          if (!hashSet.has(hash)) {
            fingerprints.push({
              hash: hash,
              anchorTime: anchorTime,
            });
            hashSet.add(hash);
          }
        }
      }
    }
  }

  console.log(
    `  → Created ${fingerprints.length} fingerprints (${hashSet.size} unique)`
  );
  return fingerprints;
}

/**
 * Main fingerprint generation with all enhancements
 */
export async function generateFingerprints(audioBuffer, sampleRate) {
  console.log("📊 Starting ACCURACY-OPTIMIZED fingerprint generation...");
  console.log(`  → Sample rate: ${sampleRate} Hz`);

  // 1. Enhanced preprocessing
  console.log("1. Normalizing audio with DC offset removal...");
  const normalized = normalizeAudio(new Int8Array(audioBuffer));

  // 2. Multi-scale FFT analysis
  console.log("2. Performing multi-scale FFT analysis...");
  const spectrograms = ENABLE_MULTI_SCALE
    ? performMultiScaleFFT(normalized)
    : [{ scale: WINDOW_SIZE, data: performEnhancedFFT(normalized) }];

  // 3. Extract spectral peaks with advanced filtering
  console.log("3. Extracting spectral peaks with harmonic filtering...");
  const spectralPeaks = extractSpectralPeaks(spectrograms);

  // 4. Create enhanced constellation map
  console.log("4. Creating enhanced constellation map with robust hashing...");
  const fingerprints = createConstellationMap(spectralPeaks);

  const frameCount = spectrograms[0].data.length;

  console.log(
    `✅ Generated ${fingerprints.length} total fingerprints from ${frameCount} frames`
  );
  console.log(
    `   → Avg ${(fingerprints.length / frameCount).toFixed(
      1
    )} fingerprints per frame`
  );

  return { fingerprints, frameCount };
}
