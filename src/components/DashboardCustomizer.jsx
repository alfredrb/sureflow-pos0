import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { SlidersHorizontal } from "lucide-react";

const METRIC_GROUPS = [
  { id: "sales", label: "Sales & Revenue" },
  { id: "inventory", label: "Inventory" },
  { id: "loss", label: "Loss Prevention" },
  { id: "system", label: "System & Hardware" },
  { id: "loyalty", label: "Loyalty & Gift Cards" },
];

const GRAPH_GROUPS = [
  { id: "sales", label: "Sales & Staffing" },
  { id: "loss", label: "Loss Prevention" },
  { id: "inventory", label: "Inventory" },
];

export default function DashboardCustomizer({ open, onClose, config, onChange, onReset }) {
  const toggle = (section, id) => {
    onChange({ ...config, [section]: { ...config[section], [id]: !config[section][id] } });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><SlidersHorizontal className="w-4 h-4" /> Customize Dashboard</DialogTitle>
          <DialogDescription>Choose which metrics and graphs appear for your profile. Changes save automatically.</DialogDescription>
        </DialogHeader>
        <div className="space-y-5 max-h-[60vh] overflow-y-auto pr-1">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Metric Cards</p>
            <div className="space-y-2">
              {METRIC_GROUPS.map((g) => (
                <label key={g.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 cursor-pointer hover:bg-gray-100">
                  <span className="text-sm text-gray-700">{g.label}</span>
                  <input type="checkbox" checked={!!config.metrics[g.id]} onChange={() => toggle("metrics", g.id)} className="w-4 h-4" />
                </label>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Graph Groups</p>
            <div className="space-y-2">
              {GRAPH_GROUPS.map((g) => (
                <label key={g.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 cursor-pointer hover:bg-gray-100">
                  <span className="text-sm text-gray-700">{g.label}</span>
                  <input type="checkbox" checked={!!config.graphs[g.id]} onChange={() => toggle("graphs", g.id)} className="w-4 h-4" />
                </label>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onReset}>Reset to Role Default</Button>
          <Button onClick={onClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}