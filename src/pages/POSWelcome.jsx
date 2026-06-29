import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Monitor } from "lucide-react";

export default function POSWelcome() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0e27] flex flex-col items-center justify-center relative overflow-hidden">
      {/* Scanline effect */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.03) 2px, rgba(0,0,0,0.03) 4px)"
      }} />

      {/* Glow accent */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-500/5 rounded-full blur-3xl" />

      <div className="relative z-10 text-center space-y-8">
        <div className="flex items-center justify-center gap-3 mb-4">
          <div className="w-16 h-16 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/30">
            <Monitor className="w-9 h-9 text-white" />
          </div>
        </div>

        <div>
          <h1 className="text-5xl font-bold text-white tracking-tight font-heading">
            SurePOS
          </h1>
          <p className="text-blue-300/60 text-sm mt-2 tracking-[0.3em] uppercase">
            Point of Sale System
          </p>
        </div>

        <div className="text-blue-200/40 font-mono text-lg">
          {time.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
        </div>
        <div className="text-blue-100/80 font-mono text-4xl tracking-widest">
          {time.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
        </div>

        <Link
          to="/pos/login"
          className="inline-block mt-8 px-12 py-4 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-lg rounded-lg transition-all duration-200 shadow-lg shadow-blue-600/25 hover:shadow-blue-500/40 hover:-translate-y-0.5"
        >
          Start Terminal
        </Link>

        <p className="text-blue-300/30 text-xs mt-6">
          v4.2.1 — Terminal Ready
        </p>
      </div>
    </div>
  );
}