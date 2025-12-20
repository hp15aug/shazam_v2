"use client";

import { useEffect, useRef, useState } from "react";
import { API_BASE_URL } from "../lib/config";
import { Terminal, Wifi, WifiOff, Maximize2, Minimize2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const MAX_LOGS = 200;

const LogConsole = () => {
  const [logs, setLogs] = useState([]);
  const [status, setStatus] = useState("connecting");
  const [isExpanded, setIsExpanded] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    let source;
    let retryTimeout;

    const connect = () => {
      source = new EventSource(`${API_BASE_URL}/api/logs/stream`, {
        withCredentials: false,
      });

      source.onopen = () => setStatus("open");

      source.onmessage = (event) => {
        if (!event?.data) return;
        if (event.data === ":heartbeat") return;

        try {
          const parsed = JSON.parse(event.data);
          setLogs((prev) => {
            const next = [...prev, parsed];
            if (next.length > MAX_LOGS) next.shift();
            return next;
          });
        } catch { }
      };

      source.onerror = () => {
        setStatus("closed");
        source.close();
        // Retry connection after 3 seconds
        retryTimeout = setTimeout(connect, 3000);
      };
    };

    connect();

    return () => {
      if (source) source.close();
      if (retryTimeout) clearTimeout(retryTimeout);
    };
  }, []);

  useEffect(() => {
    if (isExpanded && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs, isExpanded]);

  const getLogStyle = (entry) => {
    const msg = entry.message.toLowerCase();

    // Special handling for the module warning
    if (msg.includes("module type") || msg.includes("commonjs")) {
      return "text-yellow-500/80";
    }

    if (entry.type === "error" || msg.includes("error") || msg.includes("fail") || msg.includes("✗")) {
      return "text-red-400";
    }
    if (entry.type === "warn" || msg.includes("warn")) {
      return "text-yellow-400";
    }
    if (msg.includes("success") || msg.includes("✓") || msg.includes("connected")) {
      return "text-green-400";
    }
    if (msg.includes("querying") || msg.includes("processing")) {
      return "text-blue-400";
    }

    return "text-gray-300";
  };

  return (
    <div className="w-full max-w-2xl mx-auto mt-8 relative z-10">
      <motion.div
        layout
        className={`
          bg-[#09090b] border border-white/10 rounded-xl overflow-hidden shadow-2xl
          ${isExpanded ? "h-80" : "h-10"}
          transition-all duration-500 ease-in-out
        `}
      >
        {/* Header / Toolbar */}
        <div
          className="h-10 bg-[#121214] border-b border-white/5 flex items-center justify-between px-4 cursor-pointer hover:bg-[#1a1a1c] transition-colors"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center gap-4">
            {/* Mac-style window controls */}
            <div className="flex gap-1.5 group">
              <div className="w-3 h-3 rounded-full bg-[#FF5F56] group-hover:bg-[#ff5f56]/80 transition-colors" />
              <div className="w-3 h-3 rounded-full bg-[#FFBD2E] group-hover:bg-[#ffbd2e]/80 transition-colors" />
              <div className="w-3 h-3 rounded-full bg-[#27C93F] group-hover:bg-[#27c93f]/80 transition-colors" />
            </div>

            <div className="flex items-center gap-2 ml-2">
              <Terminal className="w-3.5 h-3.5 text-gray-500" />
              <span className="text-xs font-medium text-gray-400 font-mono">
                backend-server — node
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-black/20 border border-white/5">
              <div className={`w-1.5 h-1.5 rounded-full ${status === "open" ? "bg-green-500 animate-pulse" : "bg-red-500"}`} />
              <span className={`text-[10px] font-medium ${status === "open" ? "text-green-500" : "text-red-500"}`}>
                {status === "open" ? "ONLINE" : "OFFLINE"}
              </span>
            </div>
            {isExpanded ? <Minimize2 className="w-3.5 h-3.5 text-gray-600" /> : <Maximize2 className="w-3.5 h-3.5 text-gray-600" />}
          </div>
        </div>

        {/* Terminal Content */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="h-[calc(100%-2.5rem)] bg-[#09090b]"
            >
              <div
                ref={containerRef}
                className="
                  h-full overflow-y-auto p-4
                  font-mono text-[11px] leading-relaxed
                  scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent
                "
              >
                {logs.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-gray-600 gap-2">
                    <div className="w-4 h-4 border-2 border-gray-600 border-t-transparent rounded-full animate-spin" />
                    <span>Waiting for logs...</span>
                  </div>
                ) : (
                  <div className="space-y-0.5">
                    {logs.map((entry) => (
                      <div key={entry.id} className="flex gap-3 hover:bg-white/5 px-2 -mx-2 rounded py-0.5 transition-colors">
                        <span className="text-gray-600 shrink-0 select-none w-16 text-right">
                          {new Date(entry.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                        <span className={`${getLogStyle(entry)} break-all whitespace-pre-wrap`}>
                          {entry.message}
                        </span>
                      </div>
                    ))}
                    {/* Cursor effect */}
                    <div className="flex gap-3 px-2 -mx-2 py-0.5">
                      <span className="w-16" />
                      <span className="w-2 h-4 bg-gray-500/50 animate-pulse" />
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

export default LogConsole;
