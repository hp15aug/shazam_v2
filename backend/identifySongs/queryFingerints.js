import { supabase } from "../lib/db.js";

const BATCH_QUERY_SIZE = 300;

export async function queryFingerprintsInBatches(fingerprints) {
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
