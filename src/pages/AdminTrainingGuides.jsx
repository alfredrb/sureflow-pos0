import React from "react";
import { BookOpen } from "lucide-react";
import TrainingGuideContent from "@/components/TrainingGuideContent";

export default function AdminTrainingGuides() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 w-full space-y-8">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-2"><BookOpen className="w-7 h-7 text-blue-600" /> Training Tutorials</h1>
        <p className="text-gray-500 text-sm mt-1">Reference documentation and quick-start guides for cashiers learning the POS system.</p>
      </div>
      <TrainingGuideContent />
    </div>
  );
}