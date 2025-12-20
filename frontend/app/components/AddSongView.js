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
    <form onSubmit={handleSubmit} className="space-y-5">
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

      <div className="space-y-2">
        <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider">
          Audio File
        </label>
        <div
          onDragEnter={(e) => handleDragEvents(e, true)}
          onDragLeave={(e) => handleDragEvents(e, false)}
          onDragOver={(e) => handleDragEvents(e, true)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`
            relative flex flex-col items-center justify-center p-6 
            border-2 border-dashed rounded-xl cursor-pointer transition-all duration-300
            ${isDragging
              ? "border-primary bg-primary/10"
              : "border-white/10 hover:border-white/20 hover:bg-white/5"
            }
          `}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            onChange={(e) => handleFileSelect(e.target.files?.[0])}
            className="hidden"
          />
          {file ? (
            <div className="flex flex-col items-center text-center w-full">
              <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center mb-3">
                <FileAudio className="w-6 h-6 text-primary" />
              </div>
              <p className="text-sm font-medium text-white truncate max-w-full px-4">
                {file.name}
              </p>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setFile(null);
                }}
                className="mt-2 text-xs text-red-400 hover:text-red-300 transition-colors"
              >
                Remove file
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center text-center text-gray-400">
              <UploadCloud className="w-8 h-8 mb-3 text-gray-500" />
              <p className="text-sm font-medium text-gray-300">
                Click to upload or drag and drop
              </p>
              <p className="text-xs text-gray-500 mt-1">MP3, WAV, OGG</p>
            </div>
          )}
        </div>
      </div>

      <motion.button
        type="submit"
        disabled={isProcessing || !file || !songName}
        className="
          w-full flex justify-center items-center gap-2 
          bg-primary text-white font-semibold py-3.5 px-4 rounded-xl 
          transition-all duration-300 hover:bg-primary/90 
          focus:outline-none focus:ring-2 focus:ring-primary/50
          disabled:bg-white/5 disabled:text-gray-500 disabled:cursor-not-allowed
          shadow-lg shadow-primary/20
        "
        whileTap={{ scale: 0.98 }}
      >
        {isProcessing && <Loader2 className="w-5 h-5 animate-spin" />}
        {isProcessing ? "Adding Song..." : "Add to Library"}
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
  <div className="space-y-2">
    <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider">
      {label} {required && <span className="text-primary">*</span>}
    </label>
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="
        w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 
        text-sm text-white placeholder-gray-500 
        focus:outline-none focus:border-primary/50 focus:bg-white/10 
        transition-all duration-200
      "
      required={required}
    />
  </div>
);
