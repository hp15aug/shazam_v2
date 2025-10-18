import { motion } from "framer-motion";
import { Music, User, BarChart, CheckCircle, X } from "lucide-react";

export const ResultCard = ({ result, mode, onClear }) => {
  const isIdentifySuccess = mode === "identify" && result.success;
  const isIdentifyFail = mode === "identify" && !result.success;
  const isAddSuccess = mode === "add" && result.success;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      layout
      className="relative bg-gray-800/50 border border-gray-700/60 rounded-xl p-6 w-full"
    >
      <button
        onClick={onClear}
        className="absolute top-3 right-3 p-1.5 text-gray-500 hover:text-white hover:bg-gray-700/50 rounded-full transition-colors"
        aria-label="Clear results"
      >
        <X className="w-4 h-4" />
      </button>

      {isIdentifySuccess && (
        <div>
          <h3 className="text-lg font-semibold text-white mb-4">Match Found</h3>
          <div className="bg-[#9F2BFE]/10 p-4 rounded-lg">
            <p className="flex items-center gap-2 text-xl font-bold text-white">
              <Music className="w-5 h-5" />
              {result.match.name}
            </p>
            <p className="flex items-center gap-2 mt-1 text-gray-300">
              <User className="w-4 h-4" />
              {result.match.artist}
            </p>
            <p className="flex items-center gap-2 mt-3 text-xs text-gray-400">
              <BarChart className="w-3 h-3" />
              <span>Confidence: {result.match.confidence}%</span>
              <span className="text-gray-600">&middot;</span>
              <span>{result.match.matches} matches</span>
            </p>
          </div>
        </div>
      )}

      {isIdentifyFail && (
        <div className="text-center py-4">
          <h3 className="text-lg font-semibold text-white mb-2">
            No Match Found
          </h3>
          <p className="text-sm text-gray-400">
            Try recording a longer or clearer audio clip.
          </p>
        </div>
      )}

      {isAddSuccess && (
        <div className="text-center py-4">
          <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-white mb-2">
            Song Added Successfully
          </h3>
          <p className="text-sm text-gray-400">
            {result.fingerprints} fingerprints from {result.chunks} audio chunks
            were saved.
          </p>
        </div>
      )}
    </motion.div>
  );
};
