const express = require("express");
const cors = require("cors");
const multer = require("multer");
const FFT = require("fft.js");
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const { promisify } = require("util");
const { createClient } = require("@supabase/supabase-js");
const writeFile = promisify(fs.writeFile);
const unlink = promisify(fs.unlink);
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error(
    "❌ Error: SUPABASE_URL and SUPABASE_KEY must be set in environment variables"
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// ============================================================================
// OPTIMIZED CONSTANTS - Lightweight for College Project (~30k fingerprints/song)
// ============================================================================
const SAMPLE_RATE = 44100;
const WINDOW_SIZE = 4096; // FFT size
const HOP_SIZE = 4096; // NO overlap - reduces frames by 2x
const LOWER_LIMIT = 300; // Start above bass rumble
const UPPER_LIMIT = 5000; // Capture vocals, melody, harmonics

// Optimized constellation parameters for ~30k fingerprints
const TARGET_ZONE_SIZE = 3; // Reduced from 5 (fewer pairs)
const FAN_OUT = 3; // Reduced from 5 (fewer pairs per anchor)
const PEAKS_PER_FRAME = 5; // Reduced from 10 (fewer peaks)

// Peak detection parameters
const PEAK_THRESHOLD = 0.5; // Slightly higher threshold
const PEAK_NEIGHBORHOOD = 3;

// Matching parameters
const MIN_MATCHES_THRESHOLD = 8; // Slightly lower for college project
const OFFSET_TOLERANCE = 5;
const BATCH_QUERY_SIZE = 500;

// Hash quantization (more aggressive = fewer unique hashes)
const FREQ_QUANTIZATION = 5; // Increased from 2

// ============================================================================
// SIMPLIFIED PREPROCESSING
// ============================================================================

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

// ============================================================================
// AUDIO CONVERSION
// ============================================================================

async function convertAudioToPCM(audioBuffer) {
  const tempInputPath = path.join(__dirname, `temp_input_${Date.now()}`);
  const tempOutputPath = path.join(__dirname, `temp_output_${Date.now()}.raw`);

  try {
    await writeFile(tempInputPath, audioBuffer);

    return new Promise((resolve, reject) => {
      const ffmpeg = spawn("ffmpeg", [
        "-i",
        tempInputPath,
        "-f",
        "s8",
        "-acodec",
        "pcm_s8",
        "-ar",
        SAMPLE_RATE.toString(),
        "-ac",
        "1",
        tempOutputPath,
      ]);

      let stderrOutput = "";
      ffmpeg.stderr.on("data", (data) => {
        stderrOutput += data.toString();
      });

      ffmpeg.on("close", async (code) => {
        if (code !== 0) {
          console.error("FFmpeg error:", stderrOutput);
          reject(new Error(`ffmpeg exited with code ${code}`));
          return;
        }

        try {
          const pcmData = fs.readFileSync(tempOutputPath);
          await unlink(tempInputPath);
          await unlink(tempOutputPath);
          resolve(Buffer.from(pcmData));
        } catch (err) {
          reject(err);
        }
      });
    });
  } catch (err) {
    throw err;
  }
}

// ============================================================================
// SIMPLIFIED SPECTRAL ANALYSIS (NO OVERLAP)
// ============================================================================

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

// ============================================================================
// OPTIMIZED PEAK DETECTION (FEWER PEAKS)
// ============================================================================

/**
 * Find top spectral peaks (reduced count for efficiency)
 */
function findSpectralPeaks(magnitudes) {
  const peaks = [];

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
 * Extract spectral peaks from spectrogram
 */
function extractSpectralPeaks(spectrogram) {
  const allPeaks = [];

  for (let frameIdx = 0; frameIdx < spectrogram.length; frameIdx++) {
    const peaks = findSpectralPeaks(spectrogram[frameIdx]);
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

// ============================================================================
// OPTIMIZED CONSTELLATION MAPPING (FEWER PAIRS)
// ============================================================================

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

// ============================================================================
// DATABASE OPERATIONS
// ============================================================================

/**
 * Store fingerprints in database with batch inserts
 */
async function storeFingerprintsInDB(fingerprints, songId) {
  const batchSize = 1000;
  const totalBatches = Math.ceil(fingerprints.length / batchSize);

  console.log(
    `  → Storing ${fingerprints.length} fingerprints in ${totalBatches} batches...`
  );

  for (let i = 0; i < fingerprints.length; i += batchSize) {
    const batch = fingerprints.slice(i, i + batchSize);
    const { error } = await supabase.from("fingerprints").insert(
      batch.map((fp) => ({
        hash: fp.hash,
        song_id: songId,
        time: fp.anchorTime,
      }))
    );

    if (error) {
      console.error(
        `  ✗ Error inserting batch ${Math.floor(i / batchSize) + 1}:`,
        error
      );
      throw error;
    }

    // Progress logging
    if ((i / batchSize + 1) % 5 === 0 || i + batchSize >= fingerprints.length) {
      console.log(
        `    Batch ${Math.floor(i / batchSize) + 1}/${totalBatches} inserted`
      );
    }
  }

  console.log(`  ✓ All fingerprints stored successfully`);
}

/**
 * Query database for matching fingerprints in batches
 */
async function queryFingerprintsInBatches(fingerprints) {
  const uniqueHashes = [...new Set(fingerprints.map((fp) => fp.hash))];
  const allResults = new Map();

  console.log(`  → Querying ${uniqueHashes.length} unique hashes...`);

  for (let i = 0; i < uniqueHashes.length; i += BATCH_QUERY_SIZE) {
    const hashBatch = uniqueHashes.slice(i, i + BATCH_QUERY_SIZE);

    const { data, error } = await supabase
      .from("fingerprints")
      .select("song_id, time, hash")
      .in("hash", hashBatch);

    if (error) {
      console.error("  ✗ Error querying fingerprints:", error);
      continue;
    }

    if (data) {
      for (const match of data) {
        if (!allResults.has(match.hash)) {
          allResults.set(match.hash, []);
        }
        allResults.get(match.hash).push({
          songId: match.song_id,
          time: match.time,
        });
      }
    }

    // Progress logging
    if (
      i % (BATCH_QUERY_SIZE * 3) === 0 ||
      i + BATCH_QUERY_SIZE >= uniqueHashes.length
    ) {
      console.log(
        `    Queried ${Math.min(i + BATCH_QUERY_SIZE, uniqueHashes.length)}/${
          uniqueHashes.length
        } hashes`
      );
    }
  }

  const totalMatches = Array.from(allResults.values()).reduce(
    (sum, arr) => sum + arr.length,
    0
  );
  console.log(`  → Found ${totalMatches} matching fingerprints`);

  return allResults;
}

// ============================================================================
// SIMPLIFIED MATCHING ALGORITHM
// ============================================================================

/**
 * Build match map from query fingerprints
 */
function buildMatchMap(queryFingerprints, dbResults) {
  const matchMap = new Map();

  for (const queryFp of queryFingerprints) {
    const matches = dbResults.get(queryFp.hash);
    if (!matches) continue;

    for (const match of matches) {
      const offset = Math.abs(match.time - queryFp.anchorTime);

      if (!matchMap.has(match.songId)) {
        matchMap.set(match.songId, new Map());
      }

      const offsetMap = matchMap.get(match.songId);
      offsetMap.set(offset, (offsetMap.get(offset) || 0) + 1);
    }
  }

  return matchMap;
}

/**
 * Find best match with simplified scoring
 */
function findBestMatch(matchMap, queryLength) {
  const candidateScores = [];

  for (const [songId, offsetMap] of matchMap.entries()) {
    const offsetCounts = Array.from(offsetMap.entries()).sort(
      (a, b) => b[1] - a[1]
    );

    if (offsetCounts.length === 0) continue;

    // Get dominant offset (most frequent)
    const [dominantOffset, dominantCount] = offsetCounts[0];

    // Calculate total matches
    const totalMatches = offsetCounts.reduce(
      (sum, [, count]) => sum + count,
      0
    );

    // Simple confidence calculation
    const confidence = Math.min((dominantCount / queryLength) * 100, 100);

    candidateScores.push({
      songId,
      matches: dominantCount,
      totalMatches,
      confidence,
      offset: dominantOffset,
    });
  }

  // Sort by match count
  candidateScores.sort((a, b) => b.matches - a.matches);

  return candidateScores;
}

// ============================================================================
// COMPLETE FINGERPRINTING PIPELINE
// ============================================================================

/**
 * Generate fingerprints from audio buffer
 */
async function generateFingerprints(audioBuffer) {
  console.log("📊 Starting fingerprint generation...");

  // 1. Simple preprocessing (normalize only)
  console.log("1. Normalizing audio...");
  const normalized = normalizeAudio(new Int8Array(audioBuffer));

  // 2. Perform FFT (no overlap)
  console.log("2. Performing FFT...");
  const spectrogram = performSimplifiedFFT(normalized);

  // 3. Extract spectral peaks
  console.log("3. Extracting spectral peaks...");
  const spectralPeaks = extractSpectralPeaks(spectrogram);

  // 4. Create constellation map
  console.log("4. Creating constellation map...");
  const fingerprints = createConstellationMap(spectralPeaks);

  return { fingerprints, frameCount: spectrogram.length };
}

/**
 * Match audio against database
 */
async function matchAudio(audioBuffer) {
  console.log("🔍 Starting audio matching...");

  // Generate fingerprints from query audio
  const { fingerprints: queryFingerprints, frameCount } =
    await generateFingerprints(audioBuffer);

  if (queryFingerprints.length === 0) {
    return { success: false, message: "No fingerprints generated from audio" };
  }

  // Query database
  console.log("5. Querying database...");
  const dbResults = await queryFingerprintsInBatches(queryFingerprints);

  if (dbResults.size === 0) {
    return { success: false, message: "No matches found in database" };
  }

  // Build match map
  console.log("6. Building match map...");
  const matchMap = buildMatchMap(queryFingerprints, dbResults);

  if (matchMap.size === 0) {
    return { success: false, message: "No songs matched" };
  }

  // Find best matches
  console.log("7. Finding best matches...");
  const candidateScores = findBestMatch(matchMap, frameCount);

  // Filter by minimum threshold
  const validMatches = candidateScores.filter(
    (c) => c.matches >= MIN_MATCHES_THRESHOLD
  );

  if (validMatches.length === 0) {
    return {
      success: false,
      message: `No confident matches (best had ${
        candidateScores[0]?.matches || 0
      } matches, need ${MIN_MATCHES_THRESHOLD})`,
    };
  }

  return { success: true, matches: validMatches };
}

// ============================================================================
// API ENDPOINTS
// ============================================================================

/**
 * Add song to database
 */
app.post("/api/add-song", upload.single("audio"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No audio file was uploaded." });
  }

  const startTime = Date.now();

  try {
    const { name, artist } = req.body;

    console.log(`\n${"=".repeat(60)}`);
    console.log(`🎵 Adding song: "${name}" by ${artist}`);
    console.log(`${"=".repeat(60)}`);

    // Insert song metadata
    const { data: songData, error: songError } = await supabase
      .from("songs")
      .insert([
        {
          name: name || "Unknown",
          artist: artist || "Unknown",
          filename: req.file.originalname,
        },
      ])
      .select()
      .single();

    if (songError) {
      console.error("✗ Error inserting song:", songError);
      throw songError;
    }

    const songId = songData.id;
    console.log(`✓ Song metadata saved (ID: ${songId})\n`);

    // Convert audio
    console.log("🔄 Converting audio to PCM...");
    const pcmData = await convertAudioToPCM(req.file.buffer);
    console.log(`✓ Conversion complete (${pcmData.length} samples)\n`);

    // Generate fingerprints
    const { fingerprints, frameCount } = await generateFingerprints(pcmData);

    // Store in database
    console.log("\n💾 Storing fingerprints in database...");
    await storeFingerprintsInDB(fingerprints, songId);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n✅ Song added successfully in ${elapsed}s`);
    console.log(`   Fingerprints: ${fingerprints.length}`);
    console.log(
      `   Duration estimate: ~${(pcmData.length / SAMPLE_RATE).toFixed(1)}s`
    );
    console.log(`${"=".repeat(60)}\n`);

    res.json({
      success: true,
      songId,
      message: "Song added successfully",
      stats: {
        fingerprints: fingerprints.length,
        frames: frameCount,
        processingTime: elapsed + "s",
        estimatedDuration: (pcmData.length / SAMPLE_RATE).toFixed(1) + "s",
      },
    });
  } catch (error) {
    console.error("\n❌ Error adding song:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Identify audio
 */
app.post("/api/identify", upload.single("audio"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No audio file was uploaded." });
  }

  const startTime = Date.now();

  try {
    console.log(`\n${"=".repeat(60)}`);
    console.log("🎧 Identifying audio...");
    console.log(`${"=".repeat(60)}`);

    // Convert audio
    console.log("🔄 Converting audio to PCM...");
    const pcmData = await convertAudioToPCM(req.file.buffer);
    console.log(`✓ Conversion complete (${pcmData.length} samples)\n`);

    // Match audio
    const matchResult = await matchAudio(pcmData);

    if (!matchResult.success) {
      console.log(`\n❌ ${matchResult.message}`);
      console.log(`${"=".repeat(60)}\n`);
      return res.json(matchResult);
    }

    // Get song metadata
    const topMatchIds = matchResult.matches.slice(0, 5).map((m) => m.songId);
    const { data: songsData } = await supabase
      .from("songs")
      .select("*")
      .in("id", topMatchIds);

    const songMetadataMap = new Map();
    if (songsData) {
      songsData.forEach((song) => songMetadataMap.set(song.id, song));
    }

    const bestMatch = matchResult.matches[0];
    const bestSongData = songMetadataMap.get(bestMatch.songId);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log(`\n✅ Match found in ${elapsed}s!`);
    console.log(`   Song: "${bestSongData?.name}" by ${bestSongData?.artist}`);
    console.log(`   Confidence: ${bestMatch.confidence.toFixed(1)}%`);
    console.log(`   Matches: ${bestMatch.matches}`);
    console.log(`${"=".repeat(60)}\n`);

    res.json({
      success: true,
      match: {
        songId: bestMatch.songId,
        name: bestSongData?.name || "Unknown",
        artist: bestSongData?.artist || "Unknown",
        matches: bestMatch.matches,
        confidence: bestMatch.confidence.toFixed(2),
        processingTime: elapsed + "s",
      },
      alternativeMatches: matchResult.matches.slice(1, 5).map((m) => {
        const metadata = songMetadataMap.get(m.songId);
        return {
          songId: m.songId,
          name: metadata?.name || "Unknown",
          artist: metadata?.artist || "Unknown",
          matches: m.matches,
          confidence: m.confidence.toFixed(2),
        };
      }),
    });
  } catch (error) {
    console.error("\n❌ Error identifying audio:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * List all songs
 */
app.get("/api/songs", async (req, res) => {
  try {
    const { data: songs, error } = await supabase
      .from("songs")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    res.json({ songs: songs || [], count: songs?.length || 0 });
  } catch (error) {
    console.error("Error fetching songs:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Delete song
 */
app.delete("/api/songs/:id", async (req, res) => {
  try {
    const songId = parseInt(req.params.id);

    // Delete fingerprints first
    const { error: fpError } = await supabase
      .from("fingerprints")
      .delete()
      .eq("song_id", songId);

    if (fpError) throw fpError;

    // Delete song
    const { error: songError } = await supabase
      .from("songs")
      .delete()
      .eq("id", songId);

    if (songError) throw songError;

    console.log(`✓ Song ${songId} deleted`);
    res.json({ success: true, message: "Song deleted successfully" });
  } catch (error) {
    console.error("Error deleting song:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get database statistics
 */
app.get("/api/stats", async (req, res) => {
  try {
    const { count: songCount, error: songError } = await supabase
      .from("songs")
      .select("*", { count: "exact", head: true });

    const { count: fingerprintCount, error: fpError } = await supabase
      .from("fingerprints")
      .select("*", { count: "exact", head: true });

    if (songError || fpError) throw songError || fpError;

    const avgFingerprints =
      songCount > 0 ? Math.round(fingerprintCount / songCount) : 0;

    res.json({
      totalSongs: songCount || 0,
      totalFingerprints: fingerprintCount || 0,
      avgFingerprintsPerSong: avgFingerprints,
      systemInfo: {
        mode: "Lightweight (College Project)",
        targetFingerprints: "~30k per song",
        sampleRate: SAMPLE_RATE,
        windowSize: WINDOW_SIZE,
        hopSize: HOP_SIZE,
        overlap: "None (0%)",
        freqRange: `${LOWER_LIMIT}-${UPPER_LIMIT} Hz`,
      },
    });
  } catch (error) {
    console.error("Error fetching stats:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Health check
 */
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    version: "2.1.0-lightweight",
  });
});

// ============================================================================
// SERVER STARTUP
// ============================================================================

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`🚀 Lightweight Audio Fingerprinting Server v2.1`);
  console.log(`   (Optimized for College Projects)`);
  console.log(`${"=".repeat(60)}`);
  console.log(`Server running on: http://localhost:${PORT}`);
  console.log(`Supabase connected: ${supabaseUrl}`);
  console.log(`\n📡 API Endpoints:`);
  console.log(`   POST   /api/add-song    - Add song to database`);
  console.log(`   POST   /api/identify    - Identify audio clip`);
  console.log(`   GET    /api/songs       - List all songs`);
  console.log(`   DELETE /api/songs/:id   - Delete song`);
  console.log(`   GET    /api/stats       - Database statistics`);
  console.log(`   GET    /api/health      - Health check`);
  console.log(`\n🎛️  Optimized Configuration:`);
  console.log(`   Target: ~30k fingerprints per song (10x reduction)`);
  console.log(`   Sample Rate: ${SAMPLE_RATE} Hz`);
  console.log(`   FFT Window: ${WINDOW_SIZE} samples`);
  console.log(`   Hop Size: ${HOP_SIZE} samples (NO overlap)`);
  console.log(`   Frequency Range: ${LOWER_LIMIT}-${UPPER_LIMIT} Hz`);
  console.log(`   Peaks per Frame: ${PEAKS_PER_FRAME} (reduced)`);
  console.log(`   Target Zone: ${TARGET_ZONE_SIZE} frames (reduced)`);
  console.log(`   Fan-out: ${FAN_OUT} pairs (reduced)`);
  console.log(`   Freq Quantization: ${FREQ_QUANTIZATION} Hz`);
  console.log(`${"=".repeat(60)}\n`);
});
