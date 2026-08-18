import React from "react";
import { GraduationCap } from "lucide-react";
import TrainingChecklist from "@/components/training/TrainingChecklist";
import TrainingVideos from "@/components/training/TrainingVideos";
import TrainingGuideContent from "@/components/TrainingGuideContent";
import RoleTrainingGuides from "@/components/RoleTrainingGuides";

export default function EmployeeTrainingCenter() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 w-full max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-2"><GraduationCap className="w-7 h-7 text-blue-600" /> Employee Training Center</h1>
        <p className="text-gray-500 text-sm mt-1">Guides, videos, and checklists to help new employees learn POS operations and company policy.</p>
      </div>
      <TrainingChecklist />
      <TrainingVideos />
      <TrainingGuideContent />
      <RoleTrainingGuides />
    </div>
  );
}