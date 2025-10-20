// convertAudioToPCM.js
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { promisify } from "util";
import { fileURLToPath } from "url";

// Convert __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const writeFile = promisify(fs.writeFile);
const unlink = promisify(fs.unlink);

// Define a default sample rate (can be customized)
const SAMPLE_RATE = 44100;

/**
 * Converts an uploaded audio buffer into standardized PCM format
 * using FFmpeg for downstream fingerprint extraction.
 */
export async function convertAudioToPCM(audioBuffer) {
  const tempInputPath = path.join(__dirname, `temp_input_${Date.now()}`);
  const tempOutputPath = path.join(__dirname, `temp_output_${Date.now()}.raw`);

  try {
    await writeFile(tempInputPath, audioBuffer);

    return new Promise((resolve, reject) => {
      const ffmpeg = spawn("ffmpeg", [
        "-i",
        tempInputPath, // Input file
        "-f",
        "s8", // Output format: signed 8-bit PCM
        "-acodec",
        "pcm_s8", // Audio codec
        "-ar",
        SAMPLE_RATE.toString(), // Sampling rate (e.g., 44100 Hz)
        "-ac",
        "1", // Mono channel
        tempOutputPath, // Output file path
      ]);

      let stderrOutput = "";
      ffmpeg.stderr.on("data", (data) => {
        stderrOutput += data.toString();
      });

      ffmpeg.on("close", async (code) => {
        if (code !== 0) {
          console.error("❌ FFmpeg conversion failed:\n", stderrOutput);
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
    console.error("❌ Audio conversion error:", err);
    throw err;
  }
}
