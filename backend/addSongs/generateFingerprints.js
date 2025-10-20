import FFT from "fft.js";

const WINDOW_SIZE = 4096; // FFT size
const HOP_SIZE = 4096; // NO overlap - reduces frames by 2x
const LOWER_LIMIT_HZ = 300; // Start above bass rumble (in Hz)
const UPPER_LIMIT_HZ = 5000; // Capture vocals, melody, harmonics (in Hz)
const TARGET_ZONE_SIZE = 3;
const FAN_OUT = 3;
const PEAKS_PER_FRAME = 5;
const PEAK_THRESHOLD = 0.5;
const PEAK_NEIGHBORHOOD = 3;
const FREQ_QUANTIZATION = 5;
const sampleRate = 44100; // Standardized sample rate
/**
 * Normalize audio amplitude (simplified - no filtering)
 */
function normalizeAudio(signal) {
  let max = 0;
  for (let i = 0; i < signal.length; i++) {
    const abs = Math.abs(signal[i]);
    if (abs > max) max = abs;
  }

  if (max === 0) return signal;

  const factor = 127 / max;
  const normalized = new Int8Array(signal.length);
  for (let i = 0; i < signal.length; i++) {
    normalized[i] = Math.round(signal[i] * factor);
  }

  return normalized;
}

/**
 * Perform FFT on consecutive chunks (no overlap for speed)
 */
function performSimplifiedFFT(audioBuffer) {
  const audio = new Int8Array(audioBuffer);
  const totalSize = audio.length;
  const spectrogram = [];
  const fft = new FFT(WINDOW_SIZE);

  console.log(
    `  → Processing ${totalSize} samples with ${WINDOW_SIZE} window, ${HOP_SIZE} hop (no overlap)`
  );

  // Process consecutive chunks
  for (let start = 0; start + WINDOW_SIZE <= totalSize; start += HOP_SIZE) {
    const input = new Array(WINDOW_SIZE * 2);

    // No windowing for simplicity and speed
    for (let i = 0; i < WINDOW_SIZE; i++) {
      input[i * 2] = audio[start + i];
      input[i * 2 + 1] = 0;
    }

    const output = fft.createComplexArray();
    fft.transform(output, input);

    // Convert to magnitude spectrum (only positive frequencies)
    const magnitudes = new Float32Array(WINDOW_SIZE / 2);
    for (let i = 0; i < WINDOW_SIZE / 2; i++) {
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
 * Extract spectral peaks from spectrogram
 */
function extractSpectralPeaks(spectrogram) {
  const allPeaks = [];

  for (let frameIdx = 0; frameIdx < spectrogram.length; frameIdx++) {
    const peaks = findSpectralPeaks(spectrogram[frameIdx], sampleRate);
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
 * Create hash with aggressive quantization
 */
function hashConstellation(anchorFreq, targetFreq, timeDelta) {
  // Aggressive quantization to reduce unique hashes
  const f1 = Math.floor(anchorFreq / FREQ_QUANTIZATION) * FREQ_QUANTIZATION;
  const f2 = Math.floor(targetFreq / FREQ_QUANTIZATION) * FREQ_QUANTIZATION;

  return `${f1}:${f2}:${timeDelta}`;
}

/**
 * Find top spectral peaks (reduced count for efficiency)
 */
function findSpectralPeaks(magnitudes) {
  const peaks = [];

  const LOWER_LIMIT = Math.floor((LOWER_LIMIT_HZ * WINDOW_SIZE) / sampleRate);
  const UPPER_LIMIT = Math.floor((UPPER_LIMIT_HZ * WINDOW_SIZE) / sampleRate);

  // Calculate dynamic threshold
  let sum = 0;
  let count = 0;
  for (let i = LOWER_LIMIT; i < UPPER_LIMIT && i < magnitudes.length; i++) {
    sum += magnitudes[i];
    count++;
  }
  const avgMagnitude = count > 0 ? sum / count : 0;
  const dynamicThreshold = avgMagnitude * PEAK_THRESHOLD;

  // Find local maxima
  for (
    let i = LOWER_LIMIT + PEAK_NEIGHBORHOOD;
    i < UPPER_LIMIT - PEAK_NEIGHBORHOOD && i < magnitudes.length;
    i++
  ) {
    const mag = magnitudes[i];

    if (mag <= dynamicThreshold) continue;

    // Check if local maximum
    let isLocalMax = true;
    for (let j = i - PEAK_NEIGHBORHOOD; j <= i + PEAK_NEIGHBORHOOD; j++) {
      if (j !== i && j >= 0 && j < magnitudes.length && magnitudes[j] >= mag) {
        isLocalMax = false;
        break;
      }
    }

    if (isLocalMax) {
      peaks.push({ freq: i, mag: mag });
    }
  }

  // Return top N peaks (reduced number)
  peaks.sort((a, b) => b.mag - a.mag);
  return peaks.slice(0, PEAKS_PER_FRAME);
}

/**
 * Create constellation map with reduced pairing
 */
function createConstellationMap(spectralPeaks) {
  const fingerprints = [];

  // For each anchor point
  for (let anchorTime = 0; anchorTime < spectralPeaks.length; anchorTime++) {
    const anchorPeaks = spectralPeaks[anchorTime];

    if (anchorPeaks.length === 0) continue;

    // For each peak in anchor frame
    for (const anchorPeak of anchorPeaks) {
      let pairsCreated = 0;

      // Look ahead in target zone (reduced size)
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

          const hash = hashConstellation(
            anchorPeak.freq,
            targetPeak.freq,
            timeDelta
          );

          fingerprints.push({
            hash: hash,
            anchorTime: anchorTime,
          });

          pairsCreated++;
          if (pairsCreated >= FAN_OUT) break; // Limited fan-out
        }

        if (pairsCreated >= FAN_OUT) break;
      }
    }
  }

  console.log(`  → Created ${fingerprints.length} fingerprints`);
  return fingerprints;
}

export async function generateFingerprints(audioBuffer, sampleRate) {
  console.log("📊 Starting fingerprint generation...");
  console.log(`  → Sample rate: ${sampleRate} Hz`);

  // 1. Simple preprocessing (normalize only)
  console.log("1. Normalizing audio...");
  const normalized = normalizeAudio(new Int8Array(audioBuffer));

  // 2. Perform FFT (no overlap)
  console.log("2. Performing FFT...");
  const spectrogram = performSimplifiedFFT(normalized);

  // 3. Extract spectral peaks
  console.log("3. Extracting spectral peaks...");
  const spectralPeaks = extractSpectralPeaks(spectrogram, sampleRate);

  // 4. Create constellation map
  console.log("4. Creating constellation map...");
  const fingerprints = createConstellationMap(spectralPeaks);

  return { fingerprints, frameCount: spectrogram.length };
}
