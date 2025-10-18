"use client";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, Square, Loader2 } from "lucide-react";

const statusText = {
  idle: "Tap to identify a song",
  recording: "Recording... Tap to stop",
  processing: "Analyzing audio...",
};

export const IdentifyView = ({ status, onStart, onStop }) => (
  <div className="flex flex-col items-center justify-center text-center py-8">
    <motion.button
      onClick={status === "recording" ? onStop : onStart}
      disabled={status === "processing"}
      className="w-24 h-24 sm:w-28 sm:h-28 rounded-full flex items-center justify-center transition-colors duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#9F2BFE] focus-visible:ring-offset-[#121212] disabled:cursor-not-allowed"
      style={{
        backgroundImage:
          status === "recording"
            ? "radial-gradient(circle, #DC2626 50%, transparent 70%)"
            : "radial-gradient(circle, #9F2BFE 50%, transparent 70%)",
        backgroundSize: "150% 150%",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
      whileTap={{ scale: 0.95 }}
      aria-label={status === "recording" ? "Stop recording" : "Start recording"}
    >
      <div className="w-20 h-20 sm:w-24 sm:h-24 bg-[#1e1e1e] rounded-full flex items-center justify-center relative">
        {/* Pulsing animation */}
        {status !== "processing" && (
          <motion.div
            className="absolute inset-0 rounded-full"
            animate={{
              scale: status === "recording" ? [1, 1.2, 1] : [1, 1.05, 1],
              opacity: status === "recording" ? [0.5, 0, 0.5] : [0.3, 0, 0.3],
              boxShadow: `0 0 0px ${
                status === "recording" ? "#DC2626" : "#9F2BFE"
              }`,
            }}
            transition={{
              repeat: Infinity,
              duration: 2,
              ease: "easeInOut",
            }}
          />
        )}

        <AnimatePresence mode="wait">
          {status === "idle" && (
            <motion.div key="mic" transition={{ duration: 0.2 }}>
              <Mic className="w-8 h-8 sm:w-10 sm:h-10 text-[#9F2BFE]" />
            </motion.div>
          )}
          {status === "recording" && (
            <motion.div key="square" transition={{ duration: 0.2 }}>
              <Square
                className="w-8 h-8 sm:w-10 sm:h-10 text-red-500"
                fill="currentColor"
              />
            </motion.div>
          )}
          {status === "processing" && (
            <motion.div key="loader" transition={{ duration: 0.2 }}>
              <Loader2 className="w-8 h-8 sm:w-10 sm:h-10 text-gray-400 animate-spin" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.button>
    <p className="mt-6 text-gray-400 transition-colors duration-300">
      {statusText[status]}
    </p>
  </div>
);
