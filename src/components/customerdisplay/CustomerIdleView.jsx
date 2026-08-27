import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

// The between-customers rotation. Each slide holds for its own display_seconds and
// crossfades into the next, so the screen reads as signage rather than as a web page.
// A store with no slides configured gets a plain branded welcome instead of a blank panel.
export default function CustomerIdleView({ slides = [], storeName }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (slides.length === 0) return;
    // Clamp on the way in: a slide removed by an admin mid-rotation must not leave the
    // index pointing past the end of the list.
    const safe = index % slides.length;
    const hold = Math.max(2, Number(slides[safe]?.display_seconds) || 8) * 1000;
    const t = setTimeout(() => setIndex((i) => (i + 1) % slides.length), hold);
    return () => clearTimeout(t);
  }, [index, slides]);

  if (slides.length === 0) {
    return (
      <div className="h-full w-full bg-[#0a0e27] flex flex-col items-center justify-center text-white">
        <p className="text-blue-300/50 text-3xl uppercase tracking-[0.4em] font-heading mb-6">Welcome</p>
        <p className="text-6xl font-light text-center px-16">{storeName || "Thanks for shopping with us"}</p>
      </div>
    );
  }

  const slide = slides[index % slides.length];

  return (
    <div className="h-full w-full bg-[#0a0e27] relative overflow-hidden">
      <AnimatePresence mode="wait">
        <motion.div
          key={slide.id || index}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.1, ease: "easeInOut" }}
          className="absolute inset-0"
        >
          {slide.image_url && (
            <>
              <img src={slide.image_url} alt="" className="absolute inset-0 w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0a0e27] via-[#0a0e27]/70 to-transparent" />
            </>
          )}
          <div className="relative h-full flex flex-col justify-end p-16 text-white">
            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.25 }}
              className="text-7xl font-bold leading-tight font-heading max-w-5xl"
            >
              {slide.headline}
            </motion.h1>
            {slide.subtext && (
              <motion.p
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.45 }}
                className="text-4xl text-blue-200/80 mt-6 max-w-4xl font-light"
              >
                {slide.subtext}
              </motion.p>
            )}
          </div>
        </motion.div>
      </AnimatePresence>

      {slides.length > 1 && (
        <div className="absolute bottom-8 right-10 flex gap-2">
          {slides.map((s, i) => (
            <div
              key={s.id || i}
              className={`h-1.5 rounded-full transition-all duration-500 ${
                i === index % slides.length ? "w-10 bg-white" : "w-4 bg-white/25"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}