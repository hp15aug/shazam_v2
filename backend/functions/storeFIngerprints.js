import { supabase } from "../lib/db.js";

export async function storeFingerprintsInDB(fingerprints, songId) {
  const batchSize = 1000;
  const totalBatches = Math.ceil(fingerprints.length / batchSize);

  console.log(
    `→ Storing ${fingerprints.length} fingerprints in ${totalBatches} batches...`
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
        `✗ Error inserting batch ${Math.floor(i / batchSize) + 1}:`,
        error
      );
      throw error;
    }

    if ((i / batchSize + 1) % 5 === 0 || i + batchSize >= fingerprints.length) {
      console.log(
        `   Batch ${Math.floor(i / batchSize) + 1}/${totalBatches} inserted`
      );
    }
  }

  console.log("✓ All fingerprints stored successfully");
}
