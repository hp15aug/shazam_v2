export function buildEnhancedMatchMap(queryFingerprints, dbResults) {
  console.log(`  → Building enhanced match map...`);

  const matchMap = new Map(); // songId -> array of match objects

  for (const queryFp of queryFingerprints) {
    const dbMatches = dbResults.get(queryFp.hash);
    if (!dbMatches) continue;

    for (const dbMatch of dbMatches) {
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
