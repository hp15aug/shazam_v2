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

//Constants
const UPPER_LIMIT = 300;
const LOWER_LIMIT = 40;
const RANGE = [40, 80, 120, 180, UPPER_LIMIT + 1];
const FUZ_FACTOR = 2;
const CHUNK_SIZE = 4096;

// Helper function to get frequency range index
function getIndex(freq) {
  let i = 0;
  while (RANGE[i] < freq) i++;
  return i;
}

// Hash function
function hash(p1, p2, p3, p4) {
  return (
    (p4 - (p4 % FUZ_FACTOR)) * 100000000 +
    (p3 - (p3 % FUZ_FACTOR)) * 100000 +
    (p2 - (p2 % FUZ_FACTOR)) * 100 +
    (p1 - (p1 % FUZ_FACTOR))
  );
}

// Convert audio file to raw PCM using ffmpeg
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
        "s8", // 8-bit signed PCM
        "-acodec",
        "pcm_s8",
        "-ar",
        "44100", // 44.1kHz sample rate
        "-ac",
        "1", // mono
        tempOutputPath,
      ]);

      ffmpeg.stderr.on("data", (data) => {
        console.log(`ffmpeg: ${data}`);
      });

      ffmpeg.on("close", async (code) => {
        if (code !== 0) {
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

// Perform FFT analysis on audio chunks
function makeSpectrum(audioBuffer) {
  const audio = new Int8Array(audioBuffer);
  const totalSize = audio.length;
  const amountPossible = Math.floor(totalSize / CHUNK_SIZE);

  const results = [];
  const fft = new FFT(CHUNK_SIZE);

  for (let times = 0; times < amountPossible; times++) {
    const input = new Array(CHUNK_SIZE * 2); // FFT.js needs real and imaginary parts

    for (let i = 0; i < CHUNK_SIZE; i++) {
      input[i * 2] = audio[times * CHUNK_SIZE + i]; // real
      input[i * 2 + 1] = 0; // imaginary
    }

    const output = fft.createComplexArray();
    fft.transform(output, input);

    // Convert to magnitude array
    const magnitudes = [];
    for (let i = 0; i < CHUNK_SIZE; i++) {
      const real = output[i * 2];
      const imag = output[i * 2 + 1];
      magnitudes.push(Math.sqrt(real * real + imag * imag));
    }

    results.push(magnitudes);
  }

  return results;
}

// Determine key points and create fingerprints
async function determineKeyPoints(results, songId, isMatching) {
  const points = [];
  const matchMap = new Map();

  for (let t = 0; t < results.length; t++) {
    const highscores = [0, 0, 0, 0, 0];
    const keyPoints = [0, 0, 0, 0, 0];

    // Find highest magnitude in each frequency range
    for (let freq = LOWER_LIMIT; freq < UPPER_LIMIT - 1; freq++) {
      const mag = Math.log(results[t][freq] + 1);
      const index = getIndex(freq);

      if (mag > highscores[index]) {
        highscores[index] = mag;
        keyPoints[index] = freq;
      }
    }

    const h = hash(keyPoints[0], keyPoints[1], keyPoints[2], keyPoints[3]);

    if (isMatching) {
      // Matching mode: find songs with this hash from database
      const { data: fingerprints, error } = await supabase
        .from("fingerprints")
        .select("song_id, time")
        .eq("hash", h.toString());

      if (error) {
        console.error("Error querying fingerprints:", error);
      } else if (fingerprints && fingerprints.length > 0) {
        for (const dataPoint of fingerprints) {
          const offset = Math.abs(dataPoint.time - t);

          if (!matchMap.has(dataPoint.song_id)) {
            matchMap.set(dataPoint.song_id, new Map());
          }

          const tmpMap = matchMap.get(dataPoint.song_id);
          const count = tmpMap.get(offset) || 0;
          tmpMap.set(offset, count + 1);
        }
      }
    } else {
      // Indexing mode: store hash -> (songId, time) mapping
      // We'll collect all fingerprints and batch insert them later
      points.push({ hash: h.toString(), songId, time: t });
    }
  }

  return { points, matchMap };
}

// Store fingerprints in database (batch insert)
async function storeFingerprintsInDB(fingerprints) {
  const batchSize = 1000;
  const totalBatches = Math.ceil(fingerprints.length / batchSize);

  console.log(
    `Storing ${fingerprints.length} fingerprints in ${totalBatches} batches...`
  );

  for (let i = 0; i < fingerprints.length; i += batchSize) {
    const batch = fingerprints.slice(i, i + batchSize);
    const { error } = await supabase.from("fingerprints").insert(
      batch.map((fp) => ({
        hash: fp.hash,
        song_id: fp.songId,
        time: fp.time,
      }))
    );

    if (error) {
      console.error(
        `Error inserting batch ${Math.floor(i / batchSize) + 1}:`,
        error
      );
      throw error;
    }
    console.log(
      `✓ Batch ${Math.floor(i / batchSize) + 1}/${totalBatches} inserted`
    );
  }
}

// Find best matching song
function findBestMatch(matchMap) {
  let bestCount = 0;
  let bestSong = -1;
  const matchDetails = [];

  for (const [songId, offsetMap] of matchMap.entries()) {
    let bestCountForSong = 0;
    let bestOffset = 0;

    for (const [offset, count] of offsetMap.entries()) {
      if (count > bestCountForSong) {
        bestCountForSong = count;
        bestOffset = offset;
      }
    }

    matchDetails.push({
      songId,
      matches: bestCountForSong,
      offset: bestOffset,
    });

    if (bestCountForSong > bestCount) {
      bestCount = bestCountForSong;
      bestSong = songId;
    }
  }

  // Sort by match count
  matchDetails.sort((a, b) => b.matches - a.matches);

  return { bestSong, bestCount, matchDetails };
}

// API endpoint to add a song to the database
app.post("/api/add-song", upload.single("audio"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No audio file was uploaded." });
  }

  try {
    const { name, artist } = req.body;

    console.log(`Adding song: ${name} by ${artist}`);

    // Insert song metadata into database
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
      console.error("Error inserting song:", songError);
      throw songError;
    }

    const songId = songData.id;
    console.log(`✓ Song inserted with ID: ${songId}`);

    // Convert audio to PCM
    const pcmData = await convertAudioToPCM(req.file.buffer);

    // Generate spectrum
    const results = makeSpectrum(pcmData);

    // Create fingerprints
    const { points } = await determineKeyPoints(results, songId, false);

    // Store fingerprints in database
    await storeFingerprintsInDB(points);

    console.log(
      `✓ Song ${songId} added successfully with ${points.length} fingerprints`
    );

    res.json({
      success: true,
      songId,
      message: `Song added successfully`,
      fingerprints: points.length,
      chunks: results.length,
    });
  } catch (error) {
    console.error("Error adding song:", error);
    res.status(500).json({ error: error.message });
  }
});

// API endpoint to identify audio
app.post("/api/identify", upload.single("audio"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No audio file was uploaded." });
  }

  try {
    console.log("Audio file received, processing...");

    // Convert audio to PCM
    const pcmData = await convertAudioToPCM(req.file.buffer);

    // Generate spectrum
    const results = makeSpectrum(pcmData);

    // Match against database
    const { matchMap } = await determineKeyPoints(results, -1, true);

    if (matchMap.size === 0) {
      return res.json({
        success: false,
        message: "No matches found",
      });
    }

    // Find best match
    const { bestSong, bestCount, matchDetails } = findBestMatch(matchMap);

    if (bestSong === -1) {
      return res.json({
        success: false,
        message: "No matches found",
      });
    }

    // Get song metadata from database
    const { data: songData, error } = await supabase
      .from("songs")
      .select("*")
      .eq("id", bestSong)
      .single();

    if (error) {
      console.error("Error fetching song metadata:", error);
      throw error;
    }

    console.log(`✓ Match found: Song ${bestSong} with ${bestCount} matches`);

    // Get metadata for all top matches
    const topMatchIds = matchDetails.slice(0, 5).map((d) => d.songId);
    const { data: allSongsData } = await supabase
      .from("songs")
      .select("*")
      .in("id", topMatchIds);

    const songMetadataMap = new Map();
    if (allSongsData) {
      allSongsData.forEach((song) => songMetadataMap.set(song.id, song));
    }

    res.json({
      success: true,
      match: {
        songId: bestSong,
        name: songData.name,
        artist: songData.artist,
        matches: bestCount,
        confidence: Math.min((bestCount / results.length) * 100, 100).toFixed(
          2
        ),
      },
      allMatches: matchDetails.slice(0, 5).map((detail) => {
        const metadata = songMetadataMap.get(detail.songId);
        return {
          songId: detail.songId,
          name: metadata?.name || "Unknown",
          artist: metadata?.artist || "Unknown",
          matches: detail.matches,
        };
      }),
    });
  } catch (error) {
    console.error("Error identifying audio:", error);
    res.status(500).json({ error: error.message });
  }
});

// API endpoint to list all songs in database
app.get("/api/songs", async (req, res) => {
  try {
    const { data: songs, error } = await supabase
      .from("songs")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    res.json({ songs: songs || [], count: songs?.length || 0 });
  } catch (error) {
    console.error("Error fetching songs:", error);
    res.status(500).json({ error: error.message });
  }
});

// API endpoint to delete a song
app.delete("/api/songs/:id", async (req, res) => {
  try {
    const songId = parseInt(req.params.id);

    // Delete fingerprints first (foreign key constraint)
    const { error: fpError } = await supabase
      .from("fingerprints")
      .delete()
      .eq("song_id", songId);

    if (fpError) {
      throw fpError;
    }

    // Delete song
    const { error: songError } = await supabase
      .from("songs")
      .delete()
      .eq("id", songId);

    if (songError) {
      throw songError;
    }

    res.json({ success: true, message: "Song deleted successfully" });
  } catch (error) {
    console.error("Error deleting song:", error);
    res.status(500).json({ error: error.message });
  }
});

// API endpoint to get database stats
app.get("/api/stats", async (req, res) => {
  try {
    const { count: songCount, error: songError } = await supabase
      .from("songs")
      .select("*", { count: "exact", head: true });

    const { count: fingerprintCount, error: fpError } = await supabase
      .from("fingerprints")
      .select("*", { count: "exact", head: true });

    if (songError || fpError) {
      throw songError || fpError;
    }

    res.json({
      totalSongs: songCount || 0,
      totalFingerprints: fingerprintCount || 0,
    });
  } catch (error) {
    console.error("Error fetching stats:", error);
    res.status(500).json({ error: error.message });
  }
});

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
  console.log(`📊 Available endpoints:`);
  console.log(`   POST   /api/add-song       - Add a song to the database`);
  console.log(`   POST   /api/identify       - Identify an audio clip`);
  console.log(`   GET    /api/songs          - List all songs`);
  console.log(`   DELETE /api/songs/:id      - Delete a song`);
  console.log(`   GET    /api/stats          - Get database statistics`);
  console.log(`\n✅ Connected to Supabase: ${supabaseUrl}`);
});
