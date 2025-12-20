"use client";

import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { useRef, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Mic, Activity, Database, CheckCircle } from "lucide-react";

const steps = [
    {
        id: 1,
        title: "Listen",
        description: "The app captures a short audio clip from your microphone.",
        icon: Mic,
        color: "text-blue-400",
        bg: "bg-blue-500/10",
        border: "border-blue-500/20",
    },
    {
        id: 2,
        title: "Fingerprint",
        description: "We analyze the audio to create a unique digital fingerprint based on frequencies.",
        icon: Activity,
        color: "text-purple-400",
        bg: "bg-purple-500/10",
        border: "border-purple-500/20",
    },
    {
        id: 3,
        title: "Match",
        description: "The fingerprint is compared against our database of known songs.",
        icon: Database,
        color: "text-pink-400",
        bg: "bg-pink-500/10",
        border: "border-pink-500/20",
    },
    {
        id: 4,
        title: "Identify",
        description: "If a match is found, we return the song details instantly.",
        icon: CheckCircle,
        color: "text-green-400",
        bg: "bg-green-500/10",
        border: "border-green-500/20",
    },
];

export default function HowItWorks() {
    const containerRef = useRef(null);
    const [width, setWidth] = useState(0);

    useEffect(() => {
        if (containerRef.current) {
            setWidth(containerRef.current.scrollWidth - containerRef.current.offsetWidth);
        }
    }, []);

    return (
        <div className="min-h-screen bg-[#0a0a0a] text-white overflow-hidden flex flex-col">
            {/* Header */}
            <header className="p-6 flex items-center">
                <Link href="/">
                    <button className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors">
                        <ArrowLeft className="w-5 h-5" />
                        <span className="font-medium">Back to Home</span>
                    </button>
                </Link>
            </header>

            {/* Main Content */}
            <main className="flex-1 flex flex-col items-center justify-center p-6">
                <div className="text-center mb-12">
                    <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-500">
                        How Apollo Works
                    </h1>
                    <p className="text-gray-400 max-w-md mx-auto">
                        Drag the cards to explore the magic behind our audio recognition technology.
                    </p>
                </div>

                {/* Carousel */}
                <div className="w-full max-w-5xl overflow-hidden cursor-grab active:cursor-grabbing">
                    <motion.div
                        ref={containerRef}
                        drag="x"
                        dragConstraints={{ right: 0, left: -width }}
                        className="flex gap-6 px-4 md:px-0"
                    >
                        {steps.map((step) => (
                            <motion.div
                                key={step.id}
                                className={`
                  min-w-[280px] md:min-w-[320px] h-[400px] 
                  rounded-2xl p-8 flex flex-col justify-between
                  border ${step.border} ${step.bg} backdrop-blur-sm
                  transition-colors duration-300
                `}
                                whileHover={{ scale: 1.02 }}
                            >
                                <div>
                                    <div className={`w-14 h-14 rounded-full ${step.bg} flex items-center justify-center mb-6 border ${step.border}`}>
                                        <step.icon className={`w-7 h-7 ${step.color}`} />
                                    </div>
                                    <h2 className="text-2xl font-bold mb-3">{step.title}</h2>
                                    <p className="text-gray-400 leading-relaxed">
                                        {step.description}
                                    </p>
                                </div>

                                <div className="text-8xl font-bold text-white/5 select-none">
                                    0{step.id}
                                </div>
                            </motion.div>
                        ))}
                    </motion.div>
                </div>
            </main>
        </div>
    );
}
