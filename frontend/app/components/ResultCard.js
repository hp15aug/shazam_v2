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
      className="relative glass-card rounded-xl p-6 w-full overflow-hidden"
    >
      {/* Background Gradient */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 blur-3xl rounded-full -mr-10 -mt-10" />

      <button
        onClick={onClear}
        className="absolute top-3 right-3 p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition-colors z-10"
        aria-label="Clear results"
      >
        <X className="w-4 h-4" />
      </button>

      {isIdentifySuccess && (
        <div className="relative z-10">
          <h3 className="text-xs font-bold uppercase tracking-wider text-primary mb-3">
            Match Found
          </h3>
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center shadow-lg border border-white/5">
              <Music className="w-8 h-8 text-gray-500" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-xl font-bold text-white truncate">
                {result.match.name}
              </h4>
              <p className="text-gray-400 truncate flex items-center gap-1.5 mt-0.5">
                <User className="w-3.5 h-3.5" />
                {result.match.artist}
              </p>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between text-xs text-gray-500">
            <div className="flex items-center gap-1.5">
              <BarChart className="w-3.5 h-3.5" />
              <span>Confidence: <span className="text-green-400 font-medium">{result.match.confidence}%</span></span>
            </div>
            <span>{result.match.matches} fingerprints matched</span>
          </div>
        </div>
      )}

      {isIdentifyFail && (
        <div className="text-center py-4 relative z-10">
          <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-3">
            <Music className="w-6 h-6 text-red-400" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-1">
            No Match Found
          </h3>
          <p className="text-sm text-gray-400">
            We couldn't identify this song. Try recording a longer clip.
          </p>
        </div>
      )}

      {isAddSuccess && (
        <div className="text-center py-4 relative z-10">
          <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-3">
            <CheckCircle className="w-6 h-6 text-green-400" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-1">
            Song Added
          </h3>
          <p className="text-sm text-gray-400">
            Successfully indexed {result.fingerprints} fingerprints.
          </p>
        </div>
      )}
    </motion.div>
  );
};
