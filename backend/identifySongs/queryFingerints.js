import { supabase } from "../lib/db.js";

const BATCH_QUERY_SIZE = 500; // Increased batch size
const CONCURRENCY_LIMIT = 5;

export async function queryFingerprintsInBatches(fingerprints) {
  const uniqueHashes = [...new Set(fingerprints.map((fp) => fp.hash))];
  const allResults = new Map();

  console.log(`  → Querying ${uniqueHashes.length} unique hashes...`);

  const batches = [];
  for (let i = 0; i < uniqueHashes.length; i += BATCH_QUERY_SIZE) {
    batches.push(uniqueHashes.slice(i, i + BATCH_QUERY_SIZE));
  }

  for (let i = 0; i < batches.length; i += CONCURRENCY_LIMIT) {
    const chunk = batches.slice(i, i + CONCURRENCY_LIMIT);

    await Promise.all(
      chunk.map(async (hashBatch) => {
        const { data, error } = await supabase
          .from("fingerprints")
          .select("song_id, time, hash")
          .in("hash", hashBatch);

        if (error) {
          console.error("  ✗ Error querying fingerprints:", error);
          return;
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
      })
    );

    // Progress logging
    const processedCount = Math.min((i + CONCURRENCY_LIMIT) * BATCH_QUERY_SIZE, uniqueHashes.length);
    if (processedCount % (BATCH_QUERY_SIZE * 10) === 0 || processedCount === uniqueHashes.length) {
      console.log(`    Queried ${processedCount}/${uniqueHashes.length} hashes`);
    }
  }

  const totalMatches = Array.from(allResults.values()).reduce(
    (sum, arr) => sum + arr.length,
    0
  );
  console.log(`  → Found ${totalMatches} matching fingerprints`);

  return allResults;
}
