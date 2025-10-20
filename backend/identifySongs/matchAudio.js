import { generateFingerprints } from "../addSongs/generateFingerprints.js";
import { queryFingerprintsInBatches } from "./queryFingerints.js";
import { buildEnhancedMatchMap } from "./buildEnhancedMatchMap.js";
import { findBestMatchRobust } from "./findBestMatchRobust.js";

const MIN_MATCHES_THRESHOLD = 8;

export async function matchAudio(audioBuffer) {
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
