import { Input } from "@/components/ui/input";

// Bag number sits at the top of both till modals — it is the identifier that ties
// the cash leaving the safe to the cash coming back.
export default function BagNumberField({ value, onChange, label = "Bag Number", hint }) {
  return (
    <div className="mb-4">
      <label className="block text-sm font-medium mb-2">{label}</label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="e.g. 14"
        className="font-mono text-lg"
      />
      {hint && <p className="text-xs text-gray-500 mt-1">{hint}</p>}
    </div>
  );
}