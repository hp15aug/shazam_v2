"use client";

import { useState, useRef, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ModeToggle } from "./ModeToggle";
import { IdentifyView } from "./IdentifyView";
import { AddSongView } from "./AddSongView";
import { ResultCard } from "./ResultCard";
import { LibraryButton } from "./LibraryButton";
import { HowItWorksButton } from "./HowItWorksButton";
import { SongLibraryModal } from "./SongLibraryModal";
import LogConsole from "./LogConsole";
import { AlertTriangle, X } from "lucide-react";

import { API_BASE_URL } from "../lib/config";
import Footer from "./Footer";

// Main component orchestrating the UI
const AudioCapture = () => {
  const [mode, setMode] = useState("identify"); // "identify" or "add"
  const [status, setStatus] = useState("idle"); // "idle", "recording", "processing"
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const [stats, setStats] = useState({ song_count: 0 });
  const [library, setLibrary] = useState([]);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  useEffect(() => {
    fetchLibraryData();
  }, []);

  const fetchLibraryData = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/songs`);
      if (!response.ok) {
        throw new Error("Failed to fetch library data");
      }
      const data = await response.json();

      // Correctly set the library from `data.songs` and stats from `data.count`
      setLibrary(data.songs || []);
      setStats({ song_count: data.count || 0 });
    } catch (err) {
      console.error("Error fetching library data:", err);
      setLibrary([]); // Fallback to an empty array on error
      setError("Could not connect to the library database.");
    }
  };

  // Resets state when switching modes or clearing results
  const resetState = () => {
    setResult(null);
    setError(null);
    setStatus("idle");
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state === "recording"
    ) {
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
        endpoint = `${API_BASE_URL}/api/identify`;
      } else {
        if (!metadata.songName) {
          setError("Song name is required.");
          setStatus("idle");
          return;
        }
        formData.append("name", metadata.songName);
        formData.append("artist", metadata.artistName || "Unknown Artist");
        endpoint = `${API_BASE_URL}/api/add-song`;
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

      if (mode === "add" && data.success) {
        await fetchLibraryData();
      }
    } catch (err) {
      setError(
        "Failed to process audio. Please ensure the backend server is running."
      );
      console.error(err);
    } finally {
      setStatus("idle");
    }
  };

  const handleDeleteSong = async (songId) => {
    const originalLibrary = [...library];
    setLibrary(library.filter((song) => song.id !== songId));

    try {
      const response = await fetch(`${API_BASE_URL}/api/songs/${songId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error("Failed to delete the song.");
      }
      // Update the count locally for better performance
      setStats((prevStats) => ({ song_count: prevStats.song_count - 1 }));
    } catch (err) {
      console.error("Error deleting song:", err);
      setLibrary(originalLibrary);
      setError("Could not delete the song. Please try again.");
    }
  };

  return (
    <div className="flex flex-col items-center w-full">
      <HowItWorksButton />
      <LibraryButton
        songCount={stats.song_count}
        onClick={() => setIsLibraryOpen(true)}
      />

      <header className="text-center mb-10">
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-white mb-3 bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
          Apollo
        </h1>
        <p className="text-gray-400 text-sm sm:text-base max-w-xs mx-auto">
          Identify music or expand the library.
        </p>
      </header>

      <div className="w-full glass-card rounded-2xl p-6 sm:p-8 mb-8">
        <ModeToggle mode={mode} onModeChange={handleModeChange} />

        <div className="mt-8 relative min-h-[200px]">
          <AnimatePresence mode="wait">
            {mode === "identify" ? (
              <motion.div
                key="identify"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
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
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
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
      </div>

      <div className="w-full space-y-4">
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="glass border border-red-500/30 text-red-200 p-4 rounded-xl flex items-start gap-3"
            >
              <AlertTriangle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
              <div className="flex-1 text-sm">{error}</div>
              <button
                onClick={() => setError(null)}
                className="text-red-400 hover:text-red-200 transition-colors"
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

      <div className="mt-8 w-full">
        <LogConsole />
      </div>

      <AnimatePresence>
        {isLibraryOpen && (
          <SongLibraryModal
            songs={library}
            onClose={() => setIsLibraryOpen(false)}
            onDelete={handleDeleteSong}
          />
        )}
      </AnimatePresence>

      <Footer />
    </div>
  );
};

export default AudioCapture;
