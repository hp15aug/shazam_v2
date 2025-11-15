import express from "express";
import cors from "cors";
import multer from "multer";

import { convertAudioToPCM } from "./addSongs/pcm.js";
import { generateFingerprints } from "./addSongs/generateFingerprints.js";
import { storeFingerprintsInDB } from "./addSongs/storeFIngerprints.js";
import { matchAudio } from "./identifySongs/matchAudio.js";
import { logStream } from "./utils/logStream.js";

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

// ============================================================================
// LOG STREAM (Server-Sent Events)
// ============================================================================
app.get("/api/logs/stream", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const sendEvent = (entry) => {
    res.write(`data: ${JSON.stringify(entry)}\n\n`);
  };

  logStream.history().forEach(sendEvent);

  logStream.on("log", sendEvent);

  const heartbeat = setInterval(() => {
    res.write(`:heartbeat\n\n`);
  }, 30000);

  req.on("close", () => {
    clearInterval(heartbeat);
    logStream.off("log", sendEvent);
    res.end();
  });
});

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
