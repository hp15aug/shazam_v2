"use client";

import { useState, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ModeToggle } from "./ModeToggle";
import { IdentifyView } from "./IdentifyView";
import { AddSongView } from "./AddSongView";
import { ResultCard } from "./ResultCard";
import { AlertTriangle, X } from "lucide-react";

// Main component orchestrating the UI
const AudioCapture = () => {
  const [mode, setMode] = useState("identify"); // "identify" or "add"
  const [status, setStatus] = useState("idle"); // "idle", "recording", "processing"
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  // Resets state when switching modes or clearing results
  const resetState = () => {
    setResult(null);
    setError(null);
    setStatus("idle");
    if (mediaRecorderRef.current && status === "recording") {
      mediaRecorderRef.current.stream
        .getTracks()
        .forEach((track) => track.stop());
      mediaRecorderRef.current = null;
    }
  };

  const handleModeChange = (newMode) => {
    if (mode === newMode) return;
    setMode(newMode);
    resetState();
  };

  const startRecording = async () => {
    resetState();
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Audio recording is not supported by your browser.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream, {
        mimeType: "audio/webm",
      });
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, {
          type: "audio/webm",
        });
        processAudio(audioBlob);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorderRef.current.start();
      setStatus("recording");
    } catch (err) {
      setError(
        "Microphone access was denied. Please enable it in your browser settings."
      );
      console.error(err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && status === "recording") {
      mediaRecorderRef.current.stop();
      setStatus("processing");
    }
  };

  const processAudio = async (audioBlob, metadata = {}) => {
    setStatus("processing");
    setError(null);
    setResult(null);
    const formData = new FormData();
    formData.append("audio", audioBlob, metadata.fileName || "recording.webm");

    try {
      let endpoint = "";
      if (mode === "identify") {
        endpoint = "http://localhost:4000/api/identify";
      } else {
        if (!metadata.songName) {
          setError("Song name is required.");
          setStatus("idle");
          return;
        }
        formData.append("name", metadata.songName);
        formData.append("artist", metadata.artistName || "Unknown Artist");
        endpoint = "http://localhost:4000/api/add-song";
      }

      const response = await fetch(endpoint, {
        method: "POST",
        body: formData,
      });
      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}`);
      }
      const data = await response.json();
      setResult(data);
    } catch (err) {
      setError(
        "Failed to process audio. Please ensure the backend server is running."
      );
      console.error(err);
    } finally {
      setStatus("idle");
    }
  };

  return (
    <div className="min-h-screen bg-[#121212] text-gray-200 flex flex-col items-center justify-center p-4 sm:p-6 font-sans">
      <main className="w-full max-w-md mx-auto">
        <header className="text-center mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">
            Audio Recognition
          </h1>
          <p className="text-gray-400 mt-2">
            Identify music playing around you or add a new song to our library.
          </p>
        </header>

        <ModeToggle mode={mode} onModeChange={handleModeChange} />

        <div className="mt-8 relative">
          <AnimatePresence mode="wait">
            {mode === "identify" ? (
              <motion.div
                key="identify"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                <IdentifyView
                  status={status}
                  onStart={startRecording}
                  onStop={stopRecording}
                />
              </motion.div>
            ) : (
              <motion.div
                key="add"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                <AddSongView
                  isProcessing={status === "processing"}
                  onSubmit={processAudio}
                  onError={setError}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="mt-8 w-full space-y-4">
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                layout
                className="bg-red-900/50 border border-red-500/30 text-red-300 p-3 rounded-lg flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3">
                  <AlertTriangle className="h-5 w-5 text-red-400" />
                  <span className="text-sm font-medium">{error}</span>
                </div>
                <button
                  onClick={() => setError(null)}
                  className="p-1 rounded-full hover:bg-red-500/20 transition-colors"
                  aria-label="Dismiss error"
                >
                  <X className="h-4 w-4" />
                </button>
              </motion.div>
            )}
            {result && (
              <ResultCard result={result} mode={mode} onClear={resetState} />
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
};

export default AudioCapture;
