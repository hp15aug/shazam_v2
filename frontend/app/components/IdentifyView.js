"use client";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, Square, Loader2 } from "lucide-react";

const statusText = {
  idle: "Tap to identify",
  recording: "Listening...",
  processing: "Matching...",
};

export const IdentifyView = ({ status, onStart, onStop }) => (
  <div className="flex flex-col items-center justify-center text-center py-6">
    <div className="relative">
      {/* Outer Glow Ring */}
      <motion.div
        className="absolute inset-0 rounded-full bg-primary/20 blur-xl"
        animate={{
          scale: status === "recording" ? [1, 1.5, 1] : 1,
          opacity: status === "recording" ? [0.5, 0.2, 0.5] : 0,
        }}
        transition={{
          repeat: Infinity,
          duration: 2,
          ease: "easeInOut",
        }}
      />

      <motion.button
        onClick={status === "recording" ? onStop : onStart}
        disabled={status === "processing"}
        className={`
          relative z-10 w-32 h-32 rounded-full flex items-center justify-center 
          transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-primary/30
          ${status === "recording"
            ? "bg-red-500/10 border-2 border-red-500/50"
            : "bg-primary/10 border-2 border-primary/50 hover:bg-primary/20 hover:scale-105"
          }
        `}
        whileTap={{ scale: 0.95 }}
      >
        <div
          className={`
          w-24 h-24 rounded-full flex items-center justify-center
          ${status === "recording"
              ? "bg-red-500 text-white shadow-[0_0_30px_rgba(239,68,68,0.4)]"
              : "bg-primary text-white shadow-[0_0_30px_rgba(124,58,237,0.4)]"
            }
        `}
        >
          <AnimatePresence mode="wait">
            {status === "idle" && (
              <motion.div
                key="mic"
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.5, opacity: 0 }}
              >
                <Mic className="w-10 h-10" />
              </motion.div>
            )}
            {status === "recording" && (
              <motion.div
                key="stop"
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.5, opacity: 0 }}
              >
                <Square className="w-8 h-8 fill-current" />
              </motion.div>
            )}
            {status === "processing" && (
              <motion.div
                key="loader"
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.5, opacity: 0 }}
              >
                <Loader2 className="w-10 h-10 animate-spin" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.button>
    </div>

    <motion.p
      key={status}
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-8 text-lg font-medium text-gray-300"
    >
      {statusText[status]}
    </motion.p>
  </div>
);
