"use client";

import { useState, useRef } from "react";

const AudioCapture = () => {
  const [mode, setMode] = useState("identify"); // "identify" or "add"
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  // Form fields for adding songs
  const [songName, setSongName] = useState("");
  const [artistName, setArtistName] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const fileInputRef = useRef(null);

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
        const response = await fetch("http://localhost:4000/api/identify", {
          method: "POST",
          body: formData,
        });
        const data = await response.json();
        setResult(data);
      } else {
        if (!songName.trim()) {
          setError("Please enter a song name");
          setIsProcessing(false);
          return;
        }
        formData.append("name", songName);
        formData.append("artist", artistName || "Unknown");

        const response = await fetch("http://localhost:4000/api/add-song", {
          method: "POST",
          body: formData,
        });
        const data = await response.json();
        setResult(data);
        setSongName("");
        setArtistName("");
        setSelectedFile(null);
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

  return (
    <div className="min-h-screen bg-white p-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-gray-900 mb-1">
            Audio Recognition
          </h1>
          <p className="text-sm text-gray-600">
            Identify or add songs to the database
          </p>
        </div>

        {/* Mode Toggle */}
        <div className="flex gap-2 mb-8 border-b">
          <button
            onClick={() => {
              setMode("identify");
              setResult(null);
              setError(null);
              setSelectedFile(null);
            }}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              mode === "identify"
                ? "text-gray-900 border-b-2 border-gray-900"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Identify Song
          </button>
          <button
            onClick={() => {
              setMode("add");
              setResult(null);
              setError(null);
            }}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              mode === "add"
                ? "text-gray-900 border-b-2 border-gray-900"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Add Song
          </button>
        </div>

        {/* Add Song Form */}
        {mode === "add" && (
          <div className="space-y-6 mb-8">
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Song Name *
              </label>
              <input
                type="text"
                value={songName}
                onChange={(e) => setSongName(e.target.value)}
                placeholder="Enter song name"
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-gray-900"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Artist Name
              </label>
              <input
                type="text"
                value={artistName}
                onChange={(e) => setArtistName(e.target.value)}
                placeholder="Enter artist name (optional)"
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-gray-900"
              />
            </div>

            {/* File Upload Area */}
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Upload Audio File
              </label>
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                className={`border-2 border-dashed rounded p-8 text-center transition-colors ${
                  isDragging
                    ? "border-gray-900 bg-gray-50"
                    : "border-gray-300 hover:border-gray-400"
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
                    <p className="text-sm text-gray-900 mb-2">
                      {selectedFile.name}
                    </p>
                    <button
                      onClick={() => setSelectedFile(null)}
                      className="text-xs text-gray-500 hover:text-gray-700"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm text-gray-600 mb-3">
                      Drag and drop an audio file here
                    </p>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="text-sm text-gray-900 hover:text-gray-700 underline"
                    >
                      or browse files
                    </button>
                  </div>
                )}
              </div>
            </div>

            {selectedFile && (
              <button
                onClick={handleUploadFile}
                disabled={isProcessing}
                className="w-full bg-gray-900 text-white py-2 px-4 rounded text-sm hover:bg-gray-800 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {isProcessing ? "Processing..." : "Add Song"}
              </button>
            )}
          </div>
        )}

        {/* Recording Controls for Identify Mode */}
        {mode === "identify" && (
          <div className="mb-8">
            <div className="flex flex-col items-center py-8">
              {!isRecording && !isProcessing && (
                <button
                  onClick={startRecording}
                  className="w-16 h-16 bg-gray-900 hover:bg-gray-800 rounded-full flex items-center justify-center"
                >
                  <svg
                    className="w-8 h-8 text-white"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
              )}

              {isRecording && (
                <button
                  onClick={stopRecording}
                  className="w-16 h-16 bg-red-600 hover:bg-red-700 rounded-full flex items-center justify-center"
                >
                  <div className="w-6 h-6 bg-white rounded"></div>
                </button>
              )}

              {isProcessing && (
                <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center">
                  <div className="w-8 h-8 border-2 border-gray-900 border-t-transparent rounded-full animate-spin"></div>
                </div>
              )}

              <p className="mt-4 text-sm text-gray-600">
                {isRecording && "Recording... Click to stop"}
                {isProcessing && "Processing audio..."}
                {!isRecording && !isProcessing && "Click to start recording"}
              </p>
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded text-sm mb-6">
            {error}
          </div>
        )}

        {/* Results Display */}
        {result && (
          <div className="border border-gray-200 rounded p-6">
            {mode === "identify" ? (
              result.success ? (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Match Found
                  </h3>
                  <div className="bg-gray-50 p-4 rounded mb-4">
                    <p className="font-medium text-gray-900">
                      {result.match.name}
                    </p>
                    <p className="text-sm text-gray-600">
                      {result.match.artist}
                    </p>
                    <p className="text-xs text-gray-500 mt-2">
                      Confidence: {result.match.confidence}% ·{" "}
                      {result.match.matches} matches
                    </p>
                  </div>
                  {result.allMatches && result.allMatches.length > 1 && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-2">
                        Other Matches
                      </h4>
                      <div className="space-y-2">
                        {result.allMatches.slice(1).map((match, idx) => (
                          <div key={idx} className="bg-gray-50 p-3 rounded">
                            <p className="text-sm font-medium text-gray-800">
                              {match.name}
                            </p>
                            <p className="text-xs text-gray-600">
                              {match.artist}
                            </p>
                            <p className="text-xs text-gray-500">
                              {match.matches} matches
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center text-gray-600">
                  <p className="text-sm">No matches found</p>
                  <p className="text-xs mt-2 text-gray-500">
                    Try recording longer clip or add the song first.
                  </p>
                </div>
              )
            ) : (
              result.success && (
                <div className="text-center">
                  <div className="text-4xl mb-3">✓</div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    Song Added
                  </h3>
                  <p className="text-sm text-gray-600">
                    {result.fingerprints} fingerprints · {result.chunks} chunks
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
