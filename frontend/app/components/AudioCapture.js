"use client";

import { useState, useRef, useEffect } from "react";
import {
  Music,
  Mic,
  Upload,
  Database,
  Trash2,
  Play,
  Pause,
  X,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

const AudioCapture = () => {
  const [mode, setMode] = useState("identify");
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showDatabase, setShowDatabase] = useState(false);
  const [songs, setSongs] = useState([]);
  const [stats, setStats] = useState(null);
  const [loadingSongs, setLoadingSongs] = useState(false);

  // Audio player state
  const [currentAudio, setCurrentAudio] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);

  // Form fields
  const [songName, setSongName] = useState("");
  const [artistName, setArtistName] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const fileInputRef = useRef(null);
  const audioRef = useRef(null);

  useEffect(() => {
    fetchStats();
  }, []);

  useEffect(() => {
    if (showDatabase) {
      fetchSongs();
    }
  }, [showDatabase]);

  const fetchStats = async () => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/stats`
      );
      const data = await response.json();
      setStats(data);
    } catch (err) {
      console.error("Failed to fetch stats:", err);
    }
  };

  const fetchSongs = async () => {
    setLoadingSongs(true);
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/songs`
      );
      const data = await response.json();
      setSongs(data.songs || []);
    } catch (err) {
      console.error("Failed to fetch songs:", err);
    } finally {
      setLoadingSongs(false);
    }
  };

  const deleteSong = async (songId) => {
    if (!confirm("Are you sure you want to delete this song?")) return;

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/songs/${songId}`,
        {
          method: "DELETE",
        }
      );
      const data = await response.json();

      if (data.success) {
        fetchSongs();
        fetchStats();
        setError(null);
      }
    } catch (err) {
      setError("Failed to delete song");
      console.error(err);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, {
          type: "audio/webm",
        });
        await processAudio(audioBlob);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      setError(null);
      setResult(null);
    } catch (err) {
      setError("Microphone access denied. Please allow microphone access.");
      console.error(err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const processAudio = async (audioBlob, fileName = "recording.webm") => {
    setIsProcessing(true);
    const formData = new FormData();
    formData.append("audio", audioBlob, fileName);

    try {
      if (mode === "identify") {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/identify`,
          {
            method: "POST",
            body: formData,
          }
        );
        const data = await response.json();
        setResult(data);
        setError(null);
      } else {
        if (!songName.trim()) {
          setError("Please enter a song name");
          setIsProcessing(false);
          return;
        }
        formData.append("name", songName);
        formData.append("artist", artistName || "Unknown");

        const response = await fetch(
          `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/add-song`,
          {
            method: "POST",
            body: formData,
          }
        );
        const data = await response.json();
        setResult(data);
        setSongName("");
        setArtistName("");
        setSelectedFile(null);
        setError(null);
        fetchStats();
        if (showDatabase) fetchSongs();
      }
    } catch (err) {
      setError("Failed to process audio. Make sure backend is running.");
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileSelect = (file) => {
    if (file && file.type.startsWith("audio/")) {
      setSelectedFile(file);
      setError(null);

      // Create audio preview
      const url = URL.createObjectURL(file);
      setCurrentAudio({ url, name: file.name });
    } else {
      setError("Please select a valid audio file");
    }
  };

  const handleFileInputChange = (e) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileSelect(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleUploadFile = async () => {
    if (!selectedFile) {
      setError("Please select an audio file");
      return;
    }
    await processAudio(selectedFile, selectedFile.name);
  };

  const togglePlayPause = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleAudioTimeUpdate = () => {
    if (audioRef.current) {
      const progress =
        (audioRef.current.currentTime / audioRef.current.duration) * 100;
      setAudioProgress(progress || 0);
    }
  };

  const handleAudioEnded = () => {
    setIsPlaying(false);
    setAudioProgress(0);
  };

  const clearAudioPreview = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
    }
    setCurrentAudio(null);
    setIsPlaying(false);
    setAudioProgress(0);
    setSelectedFile(null);
  };

  return (
    <div className="min-h-screen bg-black text-gray-100 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Music className="w-8 h-8 text-gray-400" />
            <h1 className="text-3xl font-bold text-white">Audio Recognition</h1>
          </div>
          <p className="text-gray-400">
            Identify songs or add them to your database
          </p>

          {stats && (
            <div className="flex gap-4 mt-4 text-sm">
              <div className="bg-gray-900 px-4 py-2 rounded-lg border border-gray-800">
                <span className="text-gray-400">Songs: </span>
                <span className="text-white font-semibold">
                  {stats.totalSongs}
                </span>
              </div>
              <div className="bg-gray-900 px-4 py-2 rounded-lg border border-gray-800">
                <span className="text-gray-400">Fingerprints: </span>
                <span className="text-white font-semibold">
                  {stats.totalFingerprints}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Mode Toggle */}
        <div className="flex gap-2 mb-8 border-b border-gray-800">
          <button
            onClick={() => {
              setMode("identify");
              setResult(null);
              setError(null);
              setSelectedFile(null);
              clearAudioPreview();
            }}
            className={`px-6 py-3 text-sm font-medium transition-all flex items-center gap-2 ${
              mode === "identify"
                ? "text-white border-b-2 border-white"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            <Mic className="w-4 h-4" />
            Identify Song
          </button>
          <button
            onClick={() => {
              setMode("add");
              setResult(null);
              setError(null);
              clearAudioPreview();
            }}
            className={`px-6 py-3 text-sm font-medium transition-all flex items-center gap-2 ${
              mode === "add"
                ? "text-white border-b-2 border-white"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            <Upload className="w-4 h-4" />
            Add Song
          </button>
          <button
            onClick={() => setShowDatabase(!showDatabase)}
            className={`px-6 py-3 text-sm font-medium transition-all flex items-center gap-2 ${
              showDatabase
                ? "text-white border-b-2 border-white"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            <Database className="w-4 h-4" />
            Database
          </button>
        </div>

        {/* Database View */}
        {showDatabase && (
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 mb-8">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Database className="w-5 h-5" />
              Song Database
            </h3>

            {loadingSongs ? (
              <div className="text-center py-8 text-gray-400">Loading...</div>
            ) : songs.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No songs in database. Add some songs to get started.
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {songs.map((song) => (
                  <div
                    key={song.id}
                    className="bg-black border border-gray-800 rounded-lg p-4 hover:border-gray-700 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h4 className="font-medium text-white">{song.name}</h4>
                        <p className="text-sm text-gray-400">{song.artist}</p>
                        <p className="text-xs text-gray-600 mt-1">
                          ID: {song.id} · Added:{" "}
                          {new Date(song.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <button
                        onClick={() => deleteSong(song.id)}
                        className="p-2 hover:bg-gray-800 rounded-lg transition-colors text-red-400 hover:text-red-300"
                        title="Delete song"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Add Song Form */}
        {mode === "add" && !showDatabase && (
          <div className="space-y-6 mb-8">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Song Name *
              </label>
              <input
                type="text"
                value={songName}
                onChange={(e) => setSongName(e.target.value)}
                placeholder="Enter song name"
                className="w-full px-4 py-3 bg-gray-900 border border-gray-800 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-gray-600"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Artist Name
              </label>
              <input
                type="text"
                value={artistName}
                onChange={(e) => setArtistName(e.target.value)}
                placeholder="Enter artist name (optional)"
                className="w-full px-4 py-3 bg-gray-900 border border-gray-800 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-gray-600"
              />
            </div>

            {/* File Upload Area */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Upload Audio File
              </label>
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-all ${
                  isDragging
                    ? "border-white bg-gray-900"
                    : "border-gray-700 hover:border-gray-600"
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="audio/*"
                  onChange={handleFileInputChange}
                  className="hidden"
                />
                {selectedFile ? (
                  <div>
                    <Music className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                    <p className="text-sm text-white mb-2">
                      {selectedFile.name}
                    </p>
                    <button
                      onClick={() => {
                        setSelectedFile(null);
                        clearAudioPreview();
                      }}
                      className="text-xs text-gray-400 hover:text-gray-300"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <div>
                    <Upload className="w-12 h-12 mx-auto mb-3 text-gray-600" />
                    <p className="text-sm text-gray-400 mb-3">
                      Drag and drop an audio file here
                    </p>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="text-sm text-white hover:text-gray-300 underline"
                    >
                      or browse files
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Audio Player */}
            {currentAudio && (
              <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
                <div className="flex items-center gap-4">
                  <button
                    onClick={togglePlayPause}
                    className="w-10 h-10 bg-white text-black rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors"
                  >
                    {isPlaying ? (
                      <Pause className="w-5 h-5" />
                    ) : (
                      <Play className="w-5 h-5 ml-0.5" />
                    )}
                  </button>
                  <div className="flex-1">
                    <p className="text-sm text-gray-300 mb-1">
                      {currentAudio.name}
                    </p>
                    <div className="w-full bg-gray-800 h-1 rounded-full overflow-hidden">
                      <div
                        className="bg-white h-full transition-all"
                        style={{ width: `${audioProgress}%` }}
                      ></div>
                    </div>
                  </div>
                  <button
                    onClick={clearAudioPreview}
                    className="p-2 hover:bg-gray-800 rounded-lg transition-colors text-gray-400 hover:text-gray-300"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <audio
                  ref={audioRef}
                  src={currentAudio.url}
                  onTimeUpdate={handleAudioTimeUpdate}
                  onEnded={handleAudioEnded}
                  className="hidden"
                />
              </div>
            )}

            {selectedFile && (
              <button
                onClick={handleUploadFile}
                disabled={isProcessing}
                className="w-full bg-white text-black py-3 px-4 rounded-lg font-medium hover:bg-gray-200 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed transition-colors"
              >
                {isProcessing ? "Processing..." : "Add Song"}
              </button>
            )}
          </div>
        )}

        {/* Recording Controls for Identify Mode */}
        {mode === "identify" && !showDatabase && (
          <div className="mb-8">
            <div className="flex flex-col items-center py-12 bg-gray-900 border border-gray-800 rounded-lg">
              {!isRecording && !isProcessing && (
                <button
                  onClick={startRecording}
                  className="w-20 h-20 bg-white hover:bg-gray-200 rounded-full flex items-center justify-center transition-colors shadow-lg"
                >
                  <Mic className="w-10 h-10 text-black" />
                </button>
              )}

              {isRecording && (
                <button
                  onClick={stopRecording}
                  className="w-20 h-20 bg-red-600 hover:bg-red-700 rounded-full flex items-center justify-center transition-colors shadow-lg animate-pulse"
                >
                  <div className="w-8 h-8 bg-white rounded"></div>
                </button>
              )}

              {isProcessing && (
                <div className="w-20 h-20 bg-gray-800 rounded-full flex items-center justify-center">
                  <div className="w-10 h-10 border-3 border-white border-t-transparent rounded-full animate-spin"></div>
                </div>
              )}

              <p className="mt-6 text-sm text-gray-400">
                {isRecording && "Recording... Click to stop"}
                {isProcessing && "Identifying audio..."}
                {!isRecording && !isProcessing && "Click to start recording"}
              </p>
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="bg-red-900/20 border border-red-800 text-red-400 px-4 py-3 rounded-lg text-sm mb-6">
            {error}
          </div>
        )}

        {/* Results Display */}
        {result && !showDatabase && (
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
            {mode === "identify" ? (
              result.success ? (
                <div>
                  <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                    <Music className="w-6 h-6" />
                    Match Found
                  </h3>
                  <div className="bg-black border border-gray-800 p-5 rounded-lg mb-4">
                    <p className="text-xl font-bold text-white mb-1">
                      {result.match.name}
                    </p>
                    <p className="text-sm text-gray-400 mb-3">
                      {result.match.artist}
                    </p>
                    <div className="flex gap-4 text-xs">
                      <span className="bg-gray-900 px-3 py-1 rounded text-gray-300">
                        Confidence: {result.match.confidence}%
                      </span>
                      <span className="bg-gray-900 px-3 py-1 rounded text-gray-300">
                        {result.match.matches} matches
                      </span>
                    </div>
                  </div>
                  {result.allMatches && result.allMatches.length > 1 && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-400 mb-3">
                        Other Possible Matches
                      </h4>
                      <div className="space-y-2">
                        {result.allMatches.slice(1).map((match, idx) => (
                          <div
                            key={idx}
                            className="bg-black border border-gray-800 p-4 rounded-lg"
                          >
                            <p className="text-sm font-medium text-white">
                              {match.name}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              {match.artist} · {match.matches} matches
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center text-gray-400 py-8">
                  <Music className="w-12 h-12 mx-auto mb-3 text-gray-600" />
                  <p className="text-sm mb-2">No matches found</p>
                  <p className="text-xs text-gray-600">
                    Try recording a longer clip or add the song to the database
                    first.
                  </p>
                </div>
              )
            ) : (
              result.success && (
                <div className="text-center py-4">
                  <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg
                      className="w-8 h-8 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">
                    Song Added Successfully
                  </h3>
                  <p className="text-sm text-gray-400">
                    {result.fingerprints} fingerprints generated from{" "}
                    {result.chunks} chunks
                  </p>
                </div>
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AudioCapture;
