import { motion } from "framer-motion";
import { Library } from "lucide-react";

export const LibraryButton = ({ songCount, onClick }) => (
  <motion.button
    onClick={onClick}
    className="
      fixed top-6 right-6 z-50 flex items-center gap-2.5 h-11 pl-4 pr-5 
      glass-button rounded-full text-sm font-medium text-gray-300 
      hover:text-white hover:bg-white/10
      focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50
    "
    initial={{ opacity: 0, y: -20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: 0.2 }}
  >
    <Library className="w-4 h-4" />
    <span className="hidden sm:inline">Library</span>
    {songCount > 0 && (
      <span className="flex items-center justify-center min-w-[20px] h-5 px-1.5 bg-primary text-white text-[10px] font-bold rounded-full shadow-lg shadow-primary/20">
        {songCount}
      </span>
    )}
  </motion.button>
);
