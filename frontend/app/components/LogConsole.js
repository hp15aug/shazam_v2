"use client";

import { useEffect, useRef, useState } from "react";
import { API_BASE_URL } from "../lib/config";

const MAX_LOGS = 200;

const statusConfig = {
  connecting: { label: "Connecting…", color: "text-yellow-400" },
  open: { label: "Live", color: "text-green-400" },
  closed: { label: "Disconnected", color: "text-red-400" },
};

const LogConsole = () => {
  const [logs, setLogs] = useState([]);
  const [status, setStatus] = useState("connecting");
  const containerRef = useRef(null);

  useEffect(() => {
    const source = new EventSource(`${API_BASE_URL}/api/logs/stream`, {
      withCredentials: false,
    });

    source.onopen = () => setStatus("open");

    source.onmessage = (event) => {
      if (!event?.data) return;

      try {
        const parsed = JSON.parse(event.data);
        setLogs((prev) => {
          const next = [...prev, parsed];
          if (next.length > MAX_LOGS) next.shift();
          return next;
        });
      } catch {}
    };

    source.onerror = () => {
      if (source.readyState === EventSource.CLOSED) setStatus("closed");
      else setStatus("connecting");
    };

    return () => source.close();
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    containerRef.current.scrollTop = containerRef.current.scrollHeight;
  }, [logs]);

  const statusMeta = statusConfig[status] ?? statusConfig.connecting;

  return (
    <div className="bg-[#0d0d0d] border border-[#1f1f1f] rounded-lg shadow-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#1f1f1f] bg-[#111]">
        <span className="text-sm font-semibold text-gray-300">
          Server Console
        </span>
        <span className={`text-xs font-medium ${statusMeta.color}`}>
          ● {statusMeta.label}
        </span>
      </div>

      {/* Logs */}
      <div
        ref={containerRef}
        className="
          h-64 overflow-y-auto px-4 py-3 
          text-xs font-mono tracking-tight 
          text-gray-200 leading-relaxed
          scrollbar-none [-ms-overflow-style:none] [scrollbar-width:none]
        "
      >
        {logs.length === 0 ? (
          <p className="text-gray-600 italic">› Waiting for log messages…</p>
        ) : (
          logs.map((entry) => (
            <div key={entry.id} className="whitespace-pre-wrap">
              <span className="text-gray-500 mr-2">
                [{new Date(entry.timestamp).toLocaleTimeString()}]
              </span>
              <span
                className={
                  entry.type === "error"
                    ? "text-red-400"
                    : entry.type === "warn"
                    ? "text-yellow-300"
                    : "text-gray-300"
                }
              >
                {entry.message}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default LogConsole;
