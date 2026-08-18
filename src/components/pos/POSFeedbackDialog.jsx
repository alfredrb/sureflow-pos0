import React, { useState } from "react";
import { MessageSquare, Send } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { base44 } from "@/api/data";
import { useToast } from "@/components/ui/use-toast";

const CATEGORIES = [
  { value: "bug", label: "Bug / Error" },
  { value: "hardware", label: "Hardware Issue" },
  { value: "general", label: "General Feedback" },
  { value: "feature_request", label: "Feature Request" },
  { value: "other", label: "Other" },
];

// Operator-facing feedback form rendered from the POS Help menu. Records a
// POSFeedback entry (any authenticated operator can create; admin-only read).
export default function POSFeedbackDialog({ open, onClose, operator }) {
  const [category, setCategory] = useState("general");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [severity, setSeverity] = useState("medium");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const reset = () => { setCategory("general"); setSubject(""); setMessage(""); setSeverity("medium"); };

  const submit = async () => {
    if (!subject.trim() || !message.trim()) { toast({ title: "Subject and message are required", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const registerId = sessionStorage.getItem("pos_register_num") || "REG-001";
      const registerName = sessionStorage.getItem("pos_register_name") || registerId;
      await base44.entities.POSFeedback.create({
        operator_id: operator?.operator_id || "",
        operator_name: operator?.full_name || operator?.operator_id || "",
        operator_role: operator?.role || "",
        register_id: registerId,
        register_name: registerName,
        category, subject: subject.trim(), message: message.trim(), severity,
        status: "new",
      });
      toast({ title: "Feedback submitted", description: "Thank you — an admin will review your feedback." });
      reset();
      onClose();
    } catch {
      toast({ title: "Could not submit feedback", variant: "destructive" });
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><MessageSquare className="w-5 h-5 text-blue-600" /> Submit Feedback</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Subject</Label>
            <Input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Brief summary" />
          </div>
          <div>
            <Label>Severity</Label>
            <Select value={severity} onValueChange={setSeverity}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="high">High</SelectItem><SelectItem value="critical">Critical</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Message</Label>
            <Textarea value={message} onChange={e => setMessage(e.target.value)} placeholder="Describe the issue or your feedback in detail..." rows={5} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={submit} disabled={saving} className="bg-blue-600 hover:bg-blue-500">{saving ? "Submitting..." : <><Send className="w-4 h-4 mr-1.5" /> Submit</>}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}