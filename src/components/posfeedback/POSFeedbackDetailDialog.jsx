import React, { useState, useEffect } from "react";
import { MessageSquare, Wrench, Link2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { base44 } from "@/api/data";
import { useToast } from "@/components/ui/use-toast";
import moment from "moment";

const CATEGORY_LABEL = { bug: "Bug", hardware: "Hardware", general: "General", feature_request: "Feature Request", other: "Other" };
const SEVERITY_BADGE = { low: "bg-gray-100 text-gray-600", medium: "bg-blue-100 text-blue-700", high: "bg-amber-100 text-amber-700", critical: "bg-red-100 text-red-700" };
const STATUS_BADGE = { new: "bg-amber-100 text-amber-700", reviewed: "bg-blue-100 text-blue-700", resolved: "bg-emerald-100 text-emerald-700" };

// Admin viewer for a single POSFeedback record. Supports status review notes
// and converting the feedback into a MaintenanceLog entry (linked back).
export default function POSFeedbackDetailDialog({ feedback, onClose, onUpdated }) {
  const [status, setStatus] = useState("new");
  const [reviewNote, setReviewNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [showMaint, setShowMaint] = useState(false);
  const [maint, setMaint] = useState({ log_type: "hardware_repair", title: "", description: "", service_date: moment().format("YYYY-MM-DD"), status: "scheduled", register_id: "", technician_name: "", replaced_device: "none", new_model: "", new_serial: "" });
  const [creating, setCreating] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (feedback) {
      setStatus(feedback.status || "new");
      setReviewNote(feedback.review_note || "");
      setShowMaint(false);
      setMaint({
        log_type: feedback.category === "hardware" ? "hardware_repair" : "register_service",
        title: feedback.subject || "",
        description: feedback.message || "",
        service_date: moment().format("YYYY-MM-DD"),
        status: "scheduled",
        register_id: feedback.register_id || "",
        technician_name: "",
        replaced_device: "none",
        new_model: "",
        new_serial: "",
      });
    }
  }, [feedback]);

  const saveReview = async () => {
    setSaving(true);
    try {
      await base44.entities.POSFeedback.update(feedback.id, { status, review_note: reviewNote, reviewed_by: feedback.reviewed_by || "Admin", reviewed_at: new Date().toISOString() });
      toast({ title: "Feedback updated" });
      onUpdated();
    } catch { toast({ title: "Failed to update", variant: "destructive" }); }
    setSaving(false);
  };

  const createMaintenance = async () => {
    if (!maint.title.trim() || !maint.service_date) { toast({ title: "Title and service date required", variant: "destructive" }); return; }
    setCreating(true);
    try {
      const created = await base44.entities.MaintenanceLog.create({ ...maint, updated_by: "Admin", updated_at: new Date().toISOString() });
      await base44.entities.POSFeedback.update(feedback.id, { converted_to_maintenance: true, maintenance_log_id: created.id, status: "reviewed", review_note: (reviewNote ? reviewNote + "\n" : "") + "Converted to Maintenance Log." });
      toast({ title: "Maintenance log created & feedback linked" });
      setShowMaint(false);
      onUpdated();
    } catch { toast({ title: "Failed to create maintenance log", variant: "destructive" }); }
    setCreating(false);
  };

  if (!feedback) return null;
  return (
    <Dialog open={!!feedback} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><MessageSquare className="w-5 h-5 text-blue-600" /> {feedback.subject}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-wrap gap-2 mb-3">
          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{CATEGORY_LABEL[feedback.category] || feedback.category}</span>
          <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${SEVERITY_BADGE[feedback.severity] || ""}`}>{feedback.severity}</span>
          <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${STATUS_BADGE[feedback.status] || ""}`}>{feedback.status}</span>
          {feedback.converted_to_maintenance && <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 inline-flex items-center gap-0.5"><Link2 className="w-2.5 h-2.5" /> Maintenance</span>}
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div><span className="text-gray-400 text-xs">Operator</span><p className="text-gray-800">{feedback.operator_name || "—"}{feedback.operator_id ? ` (${feedback.operator_id})` : ""}</p></div>
          <div><span className="text-gray-400 text-xs">Register</span><p className="text-gray-800">{feedback.register_name || feedback.register_id || "—"}</p></div>
          <div><span className="text-gray-400 text-xs">Submitted</span><p className="text-gray-800">{moment(feedback.created_date).format("MMM D, YYYY h:mm A")}</p></div>
        </div>

        <div>
          <span className="text-gray-400 text-xs">Message</span>
          <p className="text-gray-700 text-sm whitespace-pre-wrap mt-1 bg-gray-50 rounded-lg p-3 border border-gray-100">{feedback.message}</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div><Label>Update Status</Label>
            <Select value={status} onValueChange={setStatus}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
              <SelectItem value="new">New</SelectItem><SelectItem value="reviewed">Reviewed</SelectItem><SelectItem value="resolved">Resolved</SelectItem>
            </SelectContent></Select>
          </div>
          <div><Label>Review Note</Label><Input value={reviewNote} onChange={e => setReviewNote(e.target.value)} placeholder="Add a note" /></div>
        </div>
        <div className="flex justify-end">
          <Button onClick={saveReview} disabled={saving} size="sm">{saving ? "Saving..." : "Save Review"}</Button>
        </div>

        <div className="border-t border-gray-100 pt-4">
          {!showMaint ? (
            <Button onClick={() => setShowMaint(true)} variant="outline" className="w-full border-amber-300 text-amber-700 hover:bg-amber-50"><Wrench className="w-4 h-4 mr-2" /> {feedback.converted_to_maintenance ? "Add Another Maintenance Log" : "Add to Maintenance Log"}</Button>
          ) : (
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-gray-800 flex items-center gap-1.5"><Wrench className="w-4 h-4 text-amber-600" /> New Maintenance Log Entry</h4>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Log Type</Label>
                  <Select value={maint.log_type} onValueChange={v => setMaint({ ...maint, log_type: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
                    <SelectItem value="hardware_repair">Hardware Repair</SelectItem><SelectItem value="software_update">Software Update</SelectItem><SelectItem value="register_service">Register Service</SelectItem><SelectItem value="preventive">Preventive</SelectItem><SelectItem value="other">Other</SelectItem>
                  </SelectContent></Select>
                </div>
                <div><Label>Register</Label><Input value={maint.register_id} onChange={e => setMaint({ ...maint, register_id: e.target.value })} /></div>
                <div className="col-span-2"><Label>Title</Label><Input value={maint.title} onChange={e => setMaint({ ...maint, title: e.target.value })} /></div>
                <div className="col-span-2"><Label>Description</Label><Textarea value={maint.description} onChange={e => setMaint({ ...maint, description: e.target.value })} rows={3} /></div>
                <div><Label>Service Date</Label><Input type="date" value={maint.service_date} onChange={e => setMaint({ ...maint, service_date: e.target.value })} /></div>
                <div><Label>Status</Label>
                  <Select value={maint.status} onValueChange={v => setMaint({ ...maint, status: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
                    <SelectItem value="scheduled">Scheduled</SelectItem><SelectItem value="in_progress">In Progress</SelectItem><SelectItem value="completed">Completed</SelectItem>
                  </SelectContent></Select>
                </div>
                <div><Label>Technician</Label><Input value={maint.technician_name} onChange={e => setMaint({ ...maint, technician_name: e.target.value })} placeholder="Assigned tech" /></div>
                <div><Label>Replaced Device</Label>
                  <Select value={maint.replaced_device} onValueChange={v => setMaint({ ...maint, replaced_device: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
                    <SelectItem value="none">None</SelectItem><SelectItem value="printer">Printer</SelectItem><SelectItem value="scanner">Scanner</SelectItem><SelectItem value="cash_drawer">Cash Drawer</SelectItem><SelectItem value="terminal">Terminal</SelectItem>
                  </SelectContent></Select>
                </div>
                <div><Label>New Model</Label><Input value={maint.new_model} onChange={e => setMaint({ ...maint, new_model: e.target.value })} /></div>
                <div><Label>New Serial</Label><Input value={maint.new_serial} onChange={e => setMaint({ ...maint, new_serial: e.target.value })} /></div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setShowMaint(false)}>Cancel</Button>
                <Button onClick={createMaintenance} disabled={creating} className="bg-amber-600 hover:bg-amber-500">{creating ? "Creating..." : "Create & Link"}</Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}