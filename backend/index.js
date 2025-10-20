import express from "express";
import cors from "cors";
import multer from "multer";

import { convertAudioToPCM } from "./functions/pcm.js";
import { generateFingerprints } from "./functions/generateFingerprints.js";
import { storeFingerprintsInDB } from "./functions/storeFIngerprints.js";

const app = express();
app.use(cors());
app.use(express.json());

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

import { supabase } from "./lib/db.js";

// ============================================================================
// CONSTANTS
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
const BATCH_QUERY_SIZE = 500;

// Hash quantization (more aggressive = fewer unique hashes)
const FREQ_QUANTIZATION = 5; // Increased from 2

// ============================================================================
// DATABASE OPERATIONS
// ============================================================================

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

const MATCHING_CONFIG = {
  // Offset histogram parameters
  OFFSET_HISTOGRAM_BIN_WIDTH: 2, // Bin width for offset histogram (frames)
  MIN_PEAK_PROMINENCE: 0.3, // Min peak height relative to histogram max (0-1)
  PEAK_DETECTION_NEIGHBORHOOD: 5, // Window for local maxima detection

  // Temporal coherence parameters
  TEMPORAL_WINDOW_SIZE: 10, // Window size for checking temporal consistency
  MIN_TEMPORAL_DENSITY: 0.4, // Min fraction of frames with matches in window
  MAX_TEMPORAL_SCATTER: 3, // Max allowed offset variance in temporal window

  // Minimum thresholds
  MIN_ABSOLUTE_MATCHES: 10, // Minimum fingerprint matches required
  MIN_MATCHES_FOR_CONFIDENCE: 15, // Matches needed for high confidence
  MIN_OFFSET_CONSISTENCY: 0.6, // Min fraction of matches near dominant offset

  // Scoring weights (must sum to 1.0)
  WEIGHT_MATCH_COUNT: 0.35, // Weight for raw match count
  WEIGHT_OFFSET_CLUSTERING: 0.3, // Weight for offset consistency
  WEIGHT_TEMPORAL_COHERENCE: 0.25, // Weight for temporal pattern
  WEIGHT_STATISTICAL_SIGNIFICANCE: 0.1, // Weight for statistical tests

  // Advanced filtering
  ENABLE_TEMPORAL_FILTERING: true, // Enable temporal coherence checking
  ENABLE_OUTLIER_REMOVAL: true, // Remove statistical outliers
  OUTLIER_THRESHOLD: 2.5, // Z-score threshold for outliers

  // Performance vs accuracy tradeoff
  MAX_CANDIDATES_TO_ANALYZE: 20, // Max songs to deeply analyze (higher = slower but more accurate)
  QUICK_REJECT_THRESHOLD: 5, // Quickly reject songs with fewer matches than this
};

/**
 * Calculate mean of an array
 */
function calculateMean(values) {
  if (values.length === 0) return 0;
  return values.reduce((sum, val) => sum + val, 0) / values.length;
}

/**
 * Calculate standard deviation
 */
function calculateStdDev(values, mean = null) {
  if (values.length === 0) return 0;
  const avg = mean !== null ? mean : calculateMean(values);
  const squaredDiffs = values.map((val) => Math.pow(val - avg, 2));
  return Math.sqrt(calculateMean(squaredDiffs));
}

/**
 * Remove statistical outliers using z-score method
 */
function removeOutliers(
  matches,
  threshold = MATCHING_CONFIG.OUTLIER_THRESHOLD
) {
  if (matches.length < 3) return matches;

  const offsets = matches.map((m) => m.offset);
  const mean = calculateMean(offsets);
  const stdDev = calculateStdDev(offsets, mean);

  if (stdDev === 0) return matches; // All values are identical

  return matches.filter((m) => {
    const zScore = Math.abs((m.offset - mean) / stdDev);
    return zScore <= threshold;
  });
}

/**
 * Build histogram with configurable bin width
 */
function buildOffsetHistogram(
  matches,
  binWidth = MATCHING_CONFIG.OFFSET_HISTOGRAM_BIN_WIDTH
) {
  const histogram = new Map();

  for (const match of matches) {
    const bin = Math.floor(match.offset / binWidth) * binWidth;
    histogram.set(bin, (histogram.get(bin) || 0) + 1);
  }

  return histogram;
}

/**
 * Find peaks in histogram using prominence-based detection
 */
function findHistogramPeaks(histogram) {
  const sortedBins = Array.from(histogram.entries()).sort(
    (a, b) => a[0] - b[0]
  ); // Sort by offset bin

  if (sortedBins.length === 0) return [];

  const maxCount = Math.max(...sortedBins.map(([, count]) => count));
  const minPeakHeight = maxCount * MATCHING_CONFIG.MIN_PEAK_PROMINENCE;
  const peaks = [];

  for (let i = 0; i < sortedBins.length; i++) {
    const [bin, count] = sortedBins[i];

    if (count < minPeakHeight) continue;

    // Check if this is a local maximum
    let isLocalMax = true;
    const neighborhood = MATCHING_CONFIG.PEAK_DETECTION_NEIGHBORHOOD;

    for (
      let j = Math.max(0, i - neighborhood);
      j <= Math.min(sortedBins.length - 1, i + neighborhood);
      j++
    ) {
      if (j !== i && sortedBins[j][1] >= count) {
        isLocalMax = false;
        break;
      }
    }

    if (isLocalMax) {
      peaks.push({
        offset: bin,
        count: count,
        prominence: count / maxCount,
      });
    }
  }

  // Sort peaks by count (descending)
  peaks.sort((a, b) => b.count - a.count);
  return peaks;
}

/**
 * Calculate temporal coherence score
 * Checks if matches are spread consistently across time
 */
function calculateTemporalCoherence(matches) {
  if (matches.length < MATCHING_CONFIG.TEMPORAL_WINDOW_SIZE) {
    return 0.5; // Neutral score for insufficient data
  }

  // Sort matches by query time
  const sortedMatches = [...matches].sort((a, b) => a.queryTime - a.queryTime);

  let coherenceScore = 0;
  let windowCount = 0;
  const windowSize = MATCHING_CONFIG.TEMPORAL_WINDOW_SIZE;

  // Sliding window analysis
  for (let i = 0; i <= sortedMatches.length - windowSize; i++) {
    const window = sortedMatches.slice(i, i + windowSize);
    const offsets = window.map((m) => m.offset);

    const mean = calculateMean(offsets);
    const stdDev = calculateStdDev(offsets, mean);

    // Lower standard deviation = more coherent
    const windowScore = Math.max(
      0,
      1 - stdDev / MATCHING_CONFIG.MAX_TEMPORAL_SCATTER
    );
    coherenceScore += windowScore;
    windowCount++;
  }

  return windowCount > 0 ? coherenceScore / windowCount : 0.5;
}

/**
 * Calculate temporal density (how many query frames have matches)
 */
function calculateTemporalDensity(matches, queryLength) {
  if (matches.length === 0 || queryLength === 0) return 0;

  const uniqueQueryTimes = new Set(matches.map((m) => m.queryTime));
  return uniqueQueryTimes.size / queryLength;
}

/**
 * Calculate offset consistency score
 */
function calculateOffsetConsistency(matches, dominantOffset, tolerance = 3) {
  if (matches.length === 0) return 0;

  const consistentMatches = matches.filter(
    (m) => Math.abs(m.offset - dominantOffset) <= tolerance
  );

  return consistentMatches.length / matches.length;
}

/**
 * Calculate statistical significance (distinguishes from random noise)
 */
function calculateStatisticalSignificance(
  matchCount,
  totalPossibleMatches,
  queryLength
) {
  // Expected random matches (very rough heuristic)
  const expectedRandom = Math.max(1, queryLength * 0.001); // 0.1% false positive rate

  // How many standard deviations above random?
  const stdDevRandom = Math.sqrt(expectedRandom);
  const zScore = (matchCount - expectedRandom) / Math.max(stdDevRandom, 1);

  // Convert z-score to 0-1 score (sigmoid)
  return 1 / (1 + Math.exp(-zScore / 2));
}

/**
 * Build enhanced match map with temporal information
 * REPLACES: buildMatchMap()
 */
function buildEnhancedMatchMap(queryFingerprints, dbResults) {
  console.log(`  → Building enhanced match map...`);

  const matchMap = new Map(); // songId -> array of match objects

  for (const queryFp of queryFingerprints) {
    const dbMatches = dbResults.get(queryFp.hash);
    if (!dbMatches) continue;

    for (const dbMatch of dbMatches) {
      // CRITICAL FIX: Use signed offset (not Math.abs)
      // Positive offset = query appears later in the song
      // Negative offset = query appears earlier in the song
      const timeOffset = dbMatch.time - queryFp.anchorTime;

      if (!matchMap.has(dbMatch.songId)) {
        matchMap.set(dbMatch.songId, []);
      }

      matchMap.get(dbMatch.songId).push({
        queryTime: queryFp.anchorTime, // Time in query
        dbTime: dbMatch.time, // Time in database song
        offset: timeOffset, // Signed time offset
        hash: queryFp.hash, // For debugging
      });
    }
  }

  console.log(`  → Found ${matchMap.size} candidate songs`);
  return matchMap;
}

/**
 * Analyze a single candidate song with deep scoring
 */
function analyzeCandidateSong(songId, matches, queryLength) {
  // Quick reject for very weak candidates
  if (matches.length < MATCHING_CONFIG.QUICK_REJECT_THRESHOLD) {
    return null;
  }

  // Step 1: Remove outliers if enabled
  let cleanedMatches = matches;
  if (MATCHING_CONFIG.ENABLE_OUTLIER_REMOVAL && matches.length >= 10) {
    cleanedMatches = removeOutliers(matches);
    if (cleanedMatches.length < MATCHING_CONFIG.MIN_ABSOLUTE_MATCHES) {
      return null; // Too many outliers removed
    }
  }

  // Step 2: Build offset histogram and find peaks
  const histogram = buildOffsetHistogram(cleanedMatches);
  const peaks = findHistogramPeaks(histogram);

  if (peaks.length === 0) {
    return null; // No clear offset peak
  }

  const dominantPeak = peaks[0];
  const dominantOffset = dominantPeak.offset;
  const peakMatches = dominantPeak.count;

  // Step 3: Filter matches near dominant offset
  const tolerance = MATCHING_CONFIG.OFFSET_HISTOGRAM_BIN_WIDTH * 2;
  const consistentMatches = cleanedMatches.filter(
    (m) => Math.abs(m.offset - dominantOffset) <= tolerance
  );

  if (consistentMatches.length < MATCHING_CONFIG.MIN_ABSOLUTE_MATCHES) {
    return null;
  }

  // Step 4: Calculate temporal coherence (if enabled)
  let temporalCoherence = 0.5;
  if (MATCHING_CONFIG.ENABLE_TEMPORAL_FILTERING) {
    temporalCoherence = calculateTemporalCoherence(consistentMatches);
  }

  // Step 5: Calculate temporal density
  const temporalDensity = calculateTemporalDensity(
    consistentMatches,
    queryLength
  );

  // Step 6: Calculate offset consistency
  const offsetConsistency = calculateOffsetConsistency(
    cleanedMatches,
    dominantOffset
  );

  // Step 7: Calculate statistical significance
  const statSignificance = calculateStatisticalSignificance(
    consistentMatches.length,
    matches.length,
    queryLength
  );

  // Step 8: Normalize individual scores (0-1 range)
  const normalizedMatchScore = Math.min(
    consistentMatches.length / MATCHING_CONFIG.MIN_MATCHES_FOR_CONFIDENCE,
    1
  );
  const offsetClusteringScore = offsetConsistency;
  const temporalScore = temporalCoherence * temporalDensity; // Combined temporal metric
  const significanceScore = statSignificance;

  // Step 9: Calculate weighted composite score
  const compositeScore =
    MATCHING_CONFIG.WEIGHT_MATCH_COUNT * normalizedMatchScore +
    MATCHING_CONFIG.WEIGHT_OFFSET_CLUSTERING * offsetClusteringScore +
    MATCHING_CONFIG.WEIGHT_TEMPORAL_COHERENCE * temporalScore +
    MATCHING_CONFIG.WEIGHT_STATISTICAL_SIGNIFICANCE * significanceScore;

  // Step 10: Calculate confidence percentage (legacy compatibility)
  const confidence = Math.min(compositeScore * 100, 100);

  return {
    songId,
    matches: consistentMatches.length,
    totalMatches: matches.length,
    confidence: confidence,
    offset: dominantOffset,

    // Detailed scoring breakdown (for debugging/tuning)
    scoring: {
      compositeScore,
      matchCountScore: normalizedMatchScore,
      offsetConsistency: offsetClusteringScore,
      temporalCoherence: temporalCoherence,
      temporalDensity: temporalDensity,
      statisticalSignificance: significanceScore,
      peakProminence: dominantPeak.prominence,
      numPeaks: peaks.length,
      outliersRemoved: matches.length - cleanedMatches.length,
    },
  };
}

/**
 * Find best match using robust multi-metric scoring
 * REPLACES: findBestMatch()
 */
function findBestMatchRobust(matchMap, queryLength) {
  console.log(
    `  → Analyzing ${matchMap.size} candidates with robust scoring...`
  );

  const candidateScores = [];

  // Sort candidates by raw match count for prioritization
  const sortedCandidates = Array.from(matchMap.entries())
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, MATCHING_CONFIG.MAX_CANDIDATES_TO_ANALYZE); // Limit deep analysis

  let analyzedCount = 0;
  for (const [songId, matches] of sortedCandidates) {
    const analysis = analyzeCandidateSong(songId, matches, queryLength);

    if (analysis !== null) {
      candidateScores.push(analysis);
      analyzedCount++;
    }
  }

  console.log(`  → Analyzed ${analyzedCount} candidates in detail`);

  // Sort by composite score (confidence)
  candidateScores.sort((a, b) => b.confidence - a.confidence);

  return candidateScores;
}

// ============================================================================
// COMPLETE FINGERPRINTING PIPELINE
// ============================================================================

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
  const matchMap = buildEnhancedMatchMap(queryFingerprints, dbResults);

  if (matchMap.size === 0) {
    return { success: false, message: "No songs matched" };
  }

  // Find best matches
  console.log("7. Finding best matches...");
  const candidateScores = findBestMatchRobust(matchMap, frameCount);
  // const candidateScores = findBestMatch(matchMap, frameCount);

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
  console.log(`Server running on: http://localhost:${PORT}`);
  console.log(`Supabase connected: ${supabase ? "✓" : "✗"}`);
});
