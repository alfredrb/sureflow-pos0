import React, { useState } from "react";
import { Mail, Send, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Ops notification recipients for critical SystemAlert records (relay stopped
// syncing, controller failover). Without this the alerts are recorded but nobody
// is told.
export default function OpsNotificationsCard({ settings, lastDispatch, onSave, onTest, saving, testing }) {
  const [emails, setEmails] = useState(settings?.ops_notification_emails || []);
  const [severity, setSeverity] = useState(settings?.ops_notify_min_severity || "critical");
  const [hours, setHours] = useState(String(settings?.ops_renotify_hours ?? 12));
  const [draft, setDraft] = useState("");

  const addEmail = () => {
    const v = draft.trim();
    if (!v || emails.includes(v)) return;
    setEmails([...emails, v]);
    setDraft("");
  };

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5 space-y-4">
      <div className="flex items-start gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 shrink-0">
          <Mail className="w-4 h-4 text-blue-600" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900">Ops Notifications</p>
          <p className="text-xs text-gray-400 mt-0.5">
            Who gets emailed when a store stops syncing or a controller fails over. Checked every 10 minutes.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        {emails.length === 0 && (
          <p className="text-xs text-amber-600">No recipients — critical alerts are being recorded but not sent to anyone.</p>
        )}
        {emails.map((e) => (
          <div key={e} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
            <span className="text-xs font-mono text-gray-700 truncate">{e}</span>
            <button onClick={() => setEmails(emails.filter((x) => x !== e))} className="text-gray-400 hover:text-red-500">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
        <div className="flex gap-2">
          <Input
            value={draft}
            onChange={(ev) => setDraft(ev.target.value)}
            onKeyDown={(ev) => { if (ev.key === "Enter") { ev.preventDefault(); addEmail(); } }}
            placeholder="ops@company.com"
            className="text-xs"
          />
          <Button variant="outline" size="sm" onClick={addEmail}><Plus className="w-3.5 h-3.5" /></Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-[11px] font-medium text-gray-500 mb-1">Minimum severity</p>
          <Select value={severity} onValueChange={setSeverity}>
            <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="critical">Critical only</SelectItem>
              <SelectItem value="warning">Warning and above</SelectItem>
              <SelectItem value="info">Everything</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <p className="text-[11px] font-medium text-gray-500 mb-1">Remind every (hours)</p>
          <Input value={hours} onChange={(e) => setHours(e.target.value)} className="h-9 text-xs" />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          disabled={saving}
          onClick={() => onSave({
            ops_notification_emails: emails,
            ops_notify_min_severity: severity,
            ops_renotify_hours: Number(hours) || 12,
          })}
        >
          {saving ? "Saving..." : "Save Recipients"}
        </Button>
        <Button variant="outline" size="sm" disabled={testing || emails.length === 0} onClick={onTest}>
          <Send className="w-3.5 h-3.5 mr-1.5" /> {testing ? "Sending..." : "Send Test"}
        </Button>
        {lastDispatch && (
          <span className="text-[11px] text-gray-400">Last dispatch: {new Date(lastDispatch).toLocaleString()}</span>
        )}
      </div>
    </div>
  );
}