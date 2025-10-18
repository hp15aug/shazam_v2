import { motion } from "framer-motion";
import { Library } from "lucide-react";

export const LibraryButton = ({ songCount, onClick }) => (
  <motion.button
    onClick={onClick}
    className="fixed top-4 right-4 sm:top-6 sm:right-6 flex items-center gap-2 h-10 px-4 bg-gray-800/80 border border-gray-700/60 rounded-full text-sm font-medium text-gray-300 backdrop-blur-sm transition-colors hover:bg-gray-700/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#9F2BFE] focus-visible:ring-offset-[#121212]"
    initial={{ opacity: 0, y: -20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: 0.2 }}
  >
    <Library className="w-4 h-4" />
    <span className="hidden sm:inline">Library</span>
    <span className="flex items-center justify-center min-w-[20px] h-5 px-1.5 bg-[#9F2BFE] text-white text-xs font-bold rounded-full">
      {songCount}
    </span>
  </motion.button>
);
