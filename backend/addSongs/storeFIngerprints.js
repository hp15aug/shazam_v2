import { supabase } from "../lib/db.js";

export async function storeFingerprintsInDB(fingerprints, songId) {
  const batchSize = 1000;
  const concurrencyLimit = 5; // Number of parallel requests
  const totalBatches = Math.ceil(fingerprints.length / batchSize);

  console.log(
    `→ Storing ${fingerprints.length} fingerprints in ${totalBatches} batches (Parallel: ${concurrencyLimit})...`
  );

  const batches = [];
  for (let i = 0; i < fingerprints.length; i += batchSize) {
    batches.push(fingerprints.slice(i, i + batchSize));
  }

  // Process batches with concurrency limit
  for (let i = 0; i < batches.length; i += concurrencyLimit) {
    const chunk = batches.slice(i, i + concurrencyLimit);

    await Promise.all(
      chunk.map(async (batch, idx) => {
        const { error } = await supabase.from("fingerprints").insert(
          batch.map((fp) => ({
            hash: fp.hash,
            song_id: songId,
            time: fp.anchorTime,
          }))
        );

        if (error) {
          console.error(`✗ Error inserting batch:`, error);
          throw error;
        }
      })
    );

    console.log(
      `   Processed ${Math.min(i + concurrencyLimit, totalBatches)}/${totalBatches} batches`
    );
  }

  console.log("✓ All fingerprints stored successfully");
}
