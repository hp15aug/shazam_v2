import { motion } from "framer-motion";
import { HelpCircle } from "lucide-react";
import Link from "next/link";

export const HowItWorksButton = () => (
    <Link href="/how-it-works">
        <motion.button
            className="
        fixed top-6 left-6 z-50 flex items-center gap-2.5 h-11 pl-4 pr-5 
        glass-button rounded-full text-sm font-medium text-gray-300 
        hover:text-white hover:bg-white/10
        focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50
      "
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
        >
            <HelpCircle className="w-4 h-4" />
            <span className="hidden sm:inline">How it works</span>
        </motion.button>
    </Link>
);
