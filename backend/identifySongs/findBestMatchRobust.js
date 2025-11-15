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
  const sortedMatches = [...matches].sort((a, b) => a.queryTime - b.queryTime);

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

export function findBestMatchRobust(matchMap, queryLength) {
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
