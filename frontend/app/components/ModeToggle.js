import { motion } from "framer-motion";

export const ModeToggle = ({ mode, onModeChange }) => (
  <div className="flex justify-center">
    <div className="flex items-center p-1 bg-black/20 backdrop-blur-md rounded-full border border-white/5">
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
    className={`
      relative px-6 py-2.5 text-sm font-medium rounded-full transition-all duration-300
      focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50
      ${isActive ? "text-white" : "text-gray-400 hover:text-white hover:bg-white/5"}
    `}
  >
    {isActive && (
      <motion.div
        layoutId="activePill"
        className="absolute inset-0 bg-primary shadow-lg shadow-primary/25 rounded-full"
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
      />
    )}
    <span className="relative z-10">{label}</span>
  </button>
);
