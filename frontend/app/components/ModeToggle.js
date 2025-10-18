import { motion } from "framer-motion";

export const ModeToggle = ({ mode, onModeChange }) => (
  <div className="flex justify-center">
    <div className="flex items-center space-x-2 bg-[#1e1e1e]/80 border border-gray-700/60 rounded-full p-1.5">
      <ToggleButton
        label="Identify"
        isActive={mode === "identify"}
        onClick={() => onModeChange("identify")}
      />
      <ToggleButton
        label="Add Song"
        isActive={mode === "add"}
        onClick={() => onModeChange("add")}
      />
    </div>
  </div>
);

const ToggleButton = ({ label, isActive, onClick }) => (
  <button
    onClick={onClick}
    className={`relative px-4 sm:px-6 py-2 text-sm font-semibold rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#9F2BFE] focus-visible:ring-offset-[#121212] ${
      isActive ? "text-white" : "text-gray-400 hover:text-white"
    }`}
  >
    {isActive && (
      <motion.div
        layoutId="activePill"
        className="absolute inset-0 bg-[#9F2BFE] rounded-full"
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
      />
    )}
    <span className="relative z-10">{label}</span>
  </button>
);
