import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Music,
  User,
  Trash2,
  Loader2,
  Search,
  Inbox,
  AlertTriangle,
} from "lucide-react";

const SongItem = ({ song, onDelete }) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  const handleConfirmDelete = async () => {
    setIsDeleting(true);
    await onDelete(song.id);
    // The component will unmount on success, so no need to set states back to false
  };

  const handleCancelDelete = () => {
    setIsConfirmingDelete(false);
  };

  const handleInitialDeleteClick = () => {
    setIsConfirmingDelete(true);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20, transition: { duration: 0.2 } }}
      className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg"
    >
      <div className="flex items-center gap-3 overflow-hidden">
        <div className="flex-shrink-0 w-8 h-8 bg-[#9F2BFE]/20 rounded-full flex items-center justify-center">
          <Music className="w-4 h-4 text-[#9F2BFE]" />
        </div>
        <div className="overflow-hidden">
          <p className="text-sm font-medium text-white truncate">{song.name}</p>
          <p className="flex items-center gap-1.5 text-xs text-gray-400 truncate">
            <User className="w-3 h-3 flex-shrink-0" />{" "}
            {song.artist || "Unknown Artist"}
          </p>
        </div>
      </div>

      <div className="flex-shrink-0 ml-2">
        <AnimatePresence mode="wait" initial={false}>
          {isConfirmingDelete ? (
            <motion.div
              key="confirm"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ duration: 0.2 }}
              className="flex items-center gap-2"
            >
              <button
                onClick={handleCancelDelete}
                className="px-3 py-1.5 text-xs font-semibold text-gray-300 bg-gray-700/80 rounded-md hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-red-600 rounded-md hover:bg-red-700 transition-colors disabled:bg-red-800 disabled:cursor-not-allowed"
              >
                {isDeleting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <AlertTriangle className="w-3 h-3" /> Delete
                  </>
                )}
              </button>
            </motion.div>
          ) : (
            <motion.button
              key="initial"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.2 }}
              onClick={handleInitialDeleteClick}
              className="p-2 rounded-full text-gray-500 hover:bg-red-500/10 hover:text-red-400 transition-colors"
              aria-label={`Delete ${song.name}`}
            >
              <Trash2 className="w-4 h-4" />
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export const SongLibraryModal = ({ songs, onClose, onDelete }) => {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredSongs = Array.isArray(songs)
    ? songs.filter(
        (song) =>
          song.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          song.artist?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : [];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{
          type: "spring",
          stiffness: 300,
          damping: 30,
          duration: 0.3,
        }}
        className="relative w-full max-w-lg max-h-[80vh] bg-[#1e1e1e] border border-gray-700/60 rounded-xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <header className="flex-shrink-0 flex items-center justify-between p-4 border-b border-gray-700/60">
          <div>
            <h2 className="text-lg font-semibold text-white">Song Library</h2>
            <p className="text-sm text-gray-400">
              {Array.isArray(songs) ? songs.length : 0} total songs
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-gray-400 hover:bg-gray-700/50 hover:text-white transition-colors"
            aria-label="Close library"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        {/* Search Bar */}
        <div className="p-4 flex-shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Search songs or artists..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#121212] border border-gray-700 rounded-lg pl-9 pr-4 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#9F2BFE] focus:border-[#9F2BFE] transition-colors"
            />
          </div>
        </div>

        {/* Song List */}
        <div className="overflow-y-auto px-4 pb-4">
          {filteredSongs.length > 0 ? (
            <div className="space-y-2">
              <AnimatePresence>
                {filteredSongs.map((song) => (
                  <SongItem key={song.id} song={song} onDelete={onDelete} />
                ))}
              </AnimatePresence>
              {searchTerm && filteredSongs.length === 0 && (
                <div className="text-center py-10 text-gray-500">
                  <p>No songs match &quot;{searchTerm}&quot;</p>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-16 text-gray-500">
              <Inbox className="w-12 h-12 mx-auto mb-3" />
              <h3 className="font-semibold text-gray-400">
                Your Library is Empty
              </h3>
              <p className="text-sm mt-1">
                Add songs using the "Add Song" tab.
              </p>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};
