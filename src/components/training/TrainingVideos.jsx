import React, { useState } from "react";
import { PlayCircle, Video } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

// Default tutorial topics. Replace `embedUrl` with a YouTube/Vimeo embed URL
// (e.g. https://www.youtube.com/embed/VIDEO_ID) to surface the player in the modal.
const VIDEOS = [
  { title: "Getting Started at the POS", duration: "4:20", desc: "A walkthrough of logging in, selecting a register, and completing Start of Day.", embedUrl: "" },
  { title: "Ringing Sales & Taking Payments", duration: "6:15", desc: "How to ring items, apply quantity, and process cash, card, and gift card payments.", embedUrl: "" },
  { title: "Returns, Exchanges & CS Mode", duration: "5:40", desc: "Processing returns and exchanges, and selling gift cards in Customer Service Mode.", embedUrl: "" },
  { title: "Cash Management & End of Shift", duration: "3:55", desc: "Requesting pickups and advances, handling cash limits, and logging out properly.", embedUrl: "" },
];

const THUMBS = ["from-blue-500 to-indigo-600", "from-emerald-500 to-teal-600", "from-amber-500 to-orange-600", "from-violet-500 to-fuchsia-600"];

export default function TrainingVideos() {
  const [active, setActive] = useState(null);
  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900 mb-1 flex items-center gap-2"><Video className="w-5 h-5 text-blue-600" /> Video Tutorials</h2>
      <p className="text-gray-500 text-sm mb-4">Short walkthroughs covering core POS operations. Click a video to watch.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {VIDEOS.map((v, i) => (
          <button key={v.title} onClick={() => setActive(v)} className="text-left bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm hover:shadow-md hover:border-blue-200 transition-all">
            <div className={`relative aspect-video bg-gradient-to-br ${THUMBS[i % THUMBS.length]} flex items-center justify-center`}>
              <PlayCircle className="w-10 h-10 text-white/90" />
              <span className="absolute bottom-2 right-2 text-[10px] font-medium text-white/90 bg-black/30 px-1.5 py-0.5 rounded">{v.duration}</span>
            </div>
            <div className="p-3">
              <p className="font-semibold text-gray-900 text-sm leading-snug">{v.title}</p>
              <p className="text-gray-500 text-xs leading-relaxed mt-1 line-clamp-2">{v.desc}</p>
            </div>
          </button>
        ))}
      </div>

      <Dialog open={!!active} onOpenChange={open => !open && setActive(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{active?.title}</DialogTitle>
            <DialogDescription>{active?.desc}</DialogDescription>
          </DialogHeader>
          {active?.embedUrl ? (
            <div className="aspect-video w-full rounded-lg overflow-hidden border border-gray-100">
              <iframe src={active.embedUrl} title={active?.title} className="w-full h-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
            </div>
          ) : (
            <div className="aspect-video w-full rounded-lg border border-dashed border-gray-200 bg-gray-50 flex flex-col items-center justify-center text-center p-6">
              <Video className="w-8 h-8 text-gray-300 mb-2" />
              <p className="text-sm font-medium text-gray-600">No video source configured</p>
              <p className="text-xs text-gray-400 mt-1 max-w-sm">Add a YouTube or Vimeo embed URL for this tutorial to display the video player here.</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}