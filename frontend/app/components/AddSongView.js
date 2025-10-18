import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { UploadCloud, FileAudio, X, Loader2 } from "lucide-react";

export const AddSongView = ({ isProcessing, onSubmit, onError }) => {
  const [songName, setSongName] = useState("");
  const [artistName, setArtistName] = useState("");
  const [file, setFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileSelect = (selectedFile) => {
    if (selectedFile && selectedFile.type.startsWith("audio/")) {
      setFile(selectedFile);
      onError(null);
    } else {
      onError("Please select a valid audio file.");
    }
  };

  const handleDragEvents = (e, dragging) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(dragging);
  };

  const handleDrop = (e) => {
    handleDragEvents(e, false);
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) handleFileSelect(droppedFile);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!songName.trim()) {
      onError("Please enter a song name.");
      return;
    }
    if (!file) {
      onError("Please select an audio file.");
      return;
    }
    onSubmit(file, { songName, artistName, fileName: file.name });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <InputField
        label="Song Name"
        value={songName}
        onChange={setSongName}
        placeholder="e.g., Blinding Lights"
        required
      />
      <InputField
        label="Artist Name"
        value={artistName}
        onChange={setArtistName}
        placeholder="e.g., The Weeknd (Optional)"
      />

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Audio File
        </label>
        <div
          onDragEnter={(e) => handleDragEvents(e, true)}
          onDragLeave={(e) => handleDragEvents(e, false)}
          onDragOver={(e) => handleDragEvents(e, true)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`relative flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-lg cursor-pointer transition-all duration-300 ${
            isDragging
              ? "border-[#9F2BFE] bg-[#9F2BFE]/10"
              : "border-gray-600 hover:border-gray-500 bg-gray-800/20"
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            onChange={(e) => handleFileSelect(e.target.files?.[0])}
            className="hidden"
          />
          {file ? (
            <div className="flex flex-col items-center text-center">
              <FileAudio className="w-8 h-8 text-[#9F2BFE] mb-2" />
              <p className="text-sm font-medium text-gray-200 truncate max-w-full">
                {file.name}
              </p>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setFile(null);
                }}
                className="mt-2 text-xs text-gray-400 hover:text-red-400 transition-colors"
              >
                Remove
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center text-center text-gray-400">
              <UploadCloud className="w-8 h-8 mb-2" />
              <p className="font-semibold">
                <span className="text-[#9F2BFE]">Upload a file</span> or drag
                and drop
              </p>
              <p className="text-xs mt-1">MP3, WAV, OGG up to 10MB</p>
            </div>
          )}
        </div>
      </div>

      <motion.button
        type="submit"
        disabled={isProcessing || !file || !songName}
        className="w-full flex justify-center items-center gap-2 bg-[#9F2BFE] text-white font-semibold py-3 px-4 rounded-lg transition-all duration-300 hover:bg-[#8A25E8] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#9F2BFE] focus-visible:ring-offset-[#121212] disabled:bg-gray-600 disabled:cursor-not-allowed"
        whileTap={{ scale: 0.98 }}
      >
        {isProcessing && <Loader2 className="w-5 h-5 animate-spin" />}
        {isProcessing ? "Adding Song..." : "Add Song to Library"}
      </motion.button>
    </form>
  );
};

const InputField = ({
  label,
  value,
  onChange,
  placeholder,
  required = false,
}) => (
  <div>
    <label className="block text-sm font-medium text-gray-300 mb-2">
      {label} {required && <span className="text-red-400">*</span>}
    </label>
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full bg-[#1e1e1e] border border-gray-700 rounded-lg px-4 py-2.5 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#9F2BFE] focus:border-[#9F2BFE] transition-colors"
      required={required}
    />
  </div>
);
