import React, { useState } from "react";
import { ShoppingCart, Headphones, ShieldCheck, ShieldAlert, Wrench, BookOpen } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ROLE_GUIDES } from "@/lib/roleTrainingGuides";

const ICONS = { ShoppingCart, Headphones, ShieldCheck, ShieldAlert, Wrench };
const ROLE_ORDER = ["manager", "csm", "loss_prevention", "cashier", "technician"];

export default function RoleTrainingGuides() {
  const [active, setActive] = useState("manager");
  const guide = ROLE_GUIDES[active];
  const ActiveIcon = ICONS[guide.icon] || BookOpen;

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900 mb-1 flex items-center gap-2"><BookOpen className="w-5 h-5 text-blue-600" /> Role-Specific Training Guides</h2>
      <p className="text-gray-500 text-sm mb-4">Onboarding and job guides by role. Select a role to view its training guide.</p>

      <div className="flex flex-wrap gap-2 mb-4">
        {ROLE_ORDER.map((r) => {
          const Icon = ICONS[ROLE_GUIDES[r].icon] || BookOpen;
          const isActive = r === active;
          return (
            <button
              key={r}
              onClick={() => setActive(r)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${isActive ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"}`}
            >
              <Icon className="w-4 h-4" />
              {ROLE_GUIDES[r].label}
            </button>
          );
        })}
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-4 sm:px-6 py-3 bg-gray-50 border-b border-gray-100 flex items-center gap-2">
          <ActiveIcon className="w-5 h-5 text-blue-600" />
          <span className="font-semibold text-gray-900 text-sm">{guide.label} — Training Guide</span>
        </div>
        <Accordion type="single" collapsible defaultValue={guide.sections[0]?.title} className="w-full">
          {guide.sections.map((s) => (
            <AccordionItem key={s.title} value={s.title} className="border-b border-gray-100 last:border-0">
              <AccordionTrigger className="px-4 sm:px-6 py-4 hover:no-underline hover:bg-gray-50">
                <span className="font-medium text-gray-900 text-sm text-left">{s.title}</span>
              </AccordionTrigger>
              <AccordionContent className="px-4 sm:px-6 pb-4 pt-1 text-gray-600 text-sm leading-relaxed">
                <div className="pl-1">{s.body}</div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </div>
  );
}