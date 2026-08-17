import { useState, useEffect } from "react";
import { base44 } from "@/api/data";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { AlertTriangle, Check, Clock, X, Archive, RotateCcw, Trash2, ShieldAlert, Loader2, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";

const ARCHIVE_DAYS = 30;

export default function AdminEmergencyLog() {
  const [alerts, setAlerts] = useState([]);
  const [operators, setOperators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [acknowledgeDialog, setAcknowledgeDialog] = useState(false);
  const [removeDialog, setRemoveDialog] = useState(false);
  const [overridePin, setOverridePin] = useState("");
  const [overrideError, setOverrideError] = useState("");
  const [overrideLoading, setOverrideLoading] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const { toast } = useToast();

  const loadAlerts = async () => {
    try {
      let data = await base44.entities.EmergencyAlert.list("-created_date", 200);
      // Auto-archive alerts older than 30 days
      const cutoff = new Date(Date.now() - ARCHIVE_DAYS * 86400000);
      const toArchive = (data || []).filter(a => !a.archived && a.timestamp && new Date(a.timestamp) < cutoff);
      if (toArchive.length > 0) {
        await base44.entities.EmergencyAlert.bulkUpdate(
          toArchive.map(a => ({
            id: a.id,
            archived: true,
            archived_at: new Date().toISOString(),
            archived_by_name: "System",
            archived_automatically: true,
          }))
        );
        data = await base44.entities.EmergencyAlert.list("-created_date", 200);
      }
      setAlerts(data);
      setLoading(false);
    } catch (e) {
      toast({ title: "Error loading alerts", variant: "destructive" });
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAlerts();
    base44.entities.Operator.list().then(ops => setOperators(ops || [])).catch(() => {});
  }, []);
  useRealtimeSync("EmergencyAlert", loadAlerts, { intervalMs: 10000 });

  const acknowledgeAlert = async (alert) => {
    try {
      await base44.entities.EmergencyAlert.update(alert.id, {
        status: "acknowledged",
        acknowledged_by_id: "admin",
        acknowledged_by_name: "Admin",
        acknowledged_at: new Date().toISOString()
      });
      toast({ title: "Alert acknowledged" });
      setAcknowledgeDialog(false);
      setSelectedAlert(null);
      loadAlerts();
    } catch (e) {
      toast({ title: "Error acknowledging alert", variant: "destructive" });
    }
  };

  const archiveAlert = async (alert) => {
    try {
      await base44.entities.EmergencyAlert.update(alert.id, {
        archived: true,
        archived_at: new Date().toISOString(),
        archived_by_name: "Admin",
        archived_automatically: false,
      });
      toast({ title: "Alert archived" });
      loadAlerts();
    } catch (e) {
      toast({ title: "Error archiving alert", variant: "destructive" });
    }
  };

  const restoreAlert = async (alert) => {
    try {
      await base44.entities.EmergencyAlert.update(alert.id, {
        archived: false,
        archived_at: "",
        archived_by_name: "",
        archived_automatically: false,
      });
      toast({ title: "Alert restored" });
      loadAlerts();
    } catch (e) {
      toast({ title: "Error restoring alert", variant: "destructive" });
    }
  };

  const openRemove = (alert) => {
    setSelectedAlert(alert);
    setOverridePin("");
    setOverrideError("");
    setRemoveDialog(true);
  };

  const handleRemove = async () => {
    setOverrideError("");
    setOverrideLoading(true);
    try {
      const sup = operators.find(o => o.pin === overridePin && (o.role === "manager" || o.role === "csm") && o.status === "active");
      if (!sup) {
        setOverrideError("Invalid PIN — Manager or CSM authorization required");
        setOverrideLoading(false);
        return;
      }
      await base44.entities.EmergencyAlert.delete(selectedAlert.id);
      toast({ title: "Alert removed", description: `Authorized by ${sup.full_name}` });
      setRemoveDialog(false);
      setSelectedAlert(null);
      setOverridePin("");
      loadAlerts();
    } catch (e) {
      setOverrideError("Removal failed — try again");
    }
    setOverrideLoading(false);
  };

  const activeAlerts = alerts.filter(a => !a.archived && a.status === "active");
  const acknowledgedAlerts = alerts.filter(a => !a.archived && a.status === "acknowledged");
  const liveAlerts = alerts.filter(a => !a.archived);
  const archivedAlerts = alerts.filter(a => a.archived);

  if (loading) {
    return <div className="p-6"><div className="animate-spin w-8 h-8 border-4 border-red-200 border-t-red-600 rounded-full" /></div>;
  }

  const renderAlertCard = (alert) => (
    <div
      key={alert.id}
      className="bg-white rounded-lg border border-red-200 p-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-100 text-red-700 text-xs font-bold">
            <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse" />
            ROBBERY
          </span>
        </div>
        <p className="font-semibold text-gray-900">
          Register <span className="text-red-600 font-bold">{alert.register_id}</span> ({alert.register_name})
        </p>
        <p className="text-sm text-gray-600 mt-1">
          Operator: <span className="font-medium">{alert.operator_name}</span> ({alert.operator_id}) · Role: {alert.operator_role}
        </p>
        <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {new Date(alert.timestamp).toLocaleString()}
        </p>
      </div>
      <div className="flex gap-2 flex-shrink-0 flex-wrap">
        {alert.status === "active" && (
          <Button
            onClick={() => { setSelectedAlert(alert); setAcknowledgeDialog(true); }}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            <Check className="w-4 h-4 mr-1" /> Acknowledge
          </Button>
        )}
        <Button
          onClick={() => archiveAlert(alert)}
          variant="outline"
          className="border-gray-300 text-gray-700 hover:bg-gray-50"
        >
          <Archive className="w-4 h-4 mr-1" /> Archive
        </Button>
        <Button
          onClick={() => openRemove(alert)}
          variant="outline"
          className="border-red-200 text-red-600 hover:bg-red-50"
        >
          <Trash2 className="w-4 h-4 mr-1" /> Remove
        </Button>
      </div>
    </div>
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8 w-full">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Emergency Alert Log</h1>
          <p className="text-gray-500 mt-2 text-sm sm:text-base">Real-time robbery and emergency alert tracking</p>
        </div>
        {archivedAlerts.length > 0 && (
          <Button variant="outline" onClick={() => setShowArchived(s => !s)} className="gap-1.5">
            {showArchived ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            <Archive className="w-4 h-4" />
            Archived ({archivedAlerts.length})
          </Button>
        )}
      </div>

      {/* Active Alerts Section */}
      {activeAlerts.length > 0 && (
        <div className="mb-8 bg-red-50 border border-red-300 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-6 h-6 text-red-600 animate-pulse" />
            <h2 className="text-lg font-bold text-red-700">Active Alerts ({activeAlerts.length})</h2>
          </div>
          <div className="space-y-3">
            {activeAlerts.map(renderAlertCard)}
          </div>
        </div>
      )}

      {/* All Alerts History */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-gray-200">
          <h2 className="font-semibold text-gray-900">All Alerts ({liveAlerts.length})</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-bold text-gray-700 text-xs">Status</th>
                <th className="text-left px-4 py-3 font-bold text-gray-700 text-xs">Type</th>
                <th className="text-left px-4 py-3 font-bold text-gray-700 text-xs">Register</th>
                <th className="text-left px-4 py-3 font-bold text-gray-700 text-xs">Operator</th>
                <th className="text-left px-4 py-3 font-bold text-gray-700 text-xs">Timestamp</th>
                <th className="text-left px-4 py-3 font-bold text-gray-700 text-xs">Actions</th>
              </tr>
            </thead>
            <tbody>
              {liveAlerts.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center py-8 text-gray-500">No emergency alerts</td>
                </tr>
              ) : (
                liveAlerts.map((alert, idx) => (
                  <tr key={alert.id} className={`border-b border-gray-100 ${idx % 2 === 0 ? "bg-white" : "bg-gray-50/30"}`}>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold ${
                        alert.status === "active" ? "bg-red-100 text-red-700" :
                        alert.status === "acknowledged" ? "bg-amber-100 text-amber-700" :
                        "bg-green-100 text-green-700"
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          alert.status === "active" ? "bg-red-600 animate-pulse" :
                          alert.status === "acknowledged" ? "bg-amber-600" : "bg-green-600"
                        }`} />
                        {alert.status.charAt(0).toUpperCase() + alert.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-red-50 text-red-700 text-xs font-bold">
                        <AlertTriangle className="w-3 h-3" />
                        {alert.alert_type.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-gray-900 font-medium">{alert.register_id}</div>
                      <div className="text-gray-500 text-xs">{alert.register_name}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-gray-900 font-medium">{alert.operator_name}</div>
                      <div className="text-gray-500 text-xs">{alert.operator_id} · {alert.operator_role}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs font-mono">
                      {new Date(alert.timestamp).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {alert.status === "active" && (
                          <Button size="sm" onClick={() => { setSelectedAlert(alert); setAcknowledgeDialog(true); }} className="bg-red-600 hover:bg-red-700 text-white text-xs h-7">Ack</Button>
                        )}
                        <Button size="sm" variant="outline" onClick={() => archiveAlert(alert)} className="text-xs h-7 gap-1">
                          <Archive className="w-3 h-3" /> Archive
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => openRemove(alert)} className="border-red-200 text-red-600 hover:bg-red-50 text-xs h-7 gap-1">
                          <Trash2 className="w-3 h-3" /> Remove
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Archived Section */}
      {showArchived && archivedAlerts.length > 0 && (
        <div className="mt-6 bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
          <div className="p-4 sm:p-6 border-b border-gray-200 flex items-center gap-2">
            <Archive className="w-5 h-5 text-gray-500" />
            <h2 className="font-semibold text-gray-700">Archived Alerts ({archivedAlerts.length})</h2>
            <span className="text-xs text-gray-400 ml-auto">Auto-archived after {ARCHIVE_DAYS} days</span>
          </div>
          <div className="divide-y divide-gray-100">
            {archivedAlerts.map(alert => (
              <div key={alert.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between bg-white/60">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-50 text-red-700 text-xs font-bold">
                      <AlertTriangle className="w-3 h-3" /> {alert.alert_type.toUpperCase()}
                    </span>
                    <span className="text-xs text-gray-400">Archived {alert.archived_at ? new Date(alert.archived_at).toLocaleDateString() : ""} by {alert.archived_by_name || "—"}</span>
                  </div>
                  <p className="text-sm font-medium text-gray-900">{alert.register_id} ({alert.register_name}) · {alert.operator_name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{new Date(alert.timestamp).toLocaleString()}</p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <Button size="sm" variant="outline" onClick={() => restoreAlert(alert)} className="gap-1 text-xs h-7">
                    <RotateCcw className="w-3 h-3" /> Restore
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => openRemove(alert)} className="border-red-200 text-red-600 hover:bg-red-50 gap-1 text-xs h-7">
                    <Trash2 className="w-3 h-3" /> Remove
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Acknowledge Dialog */}
      <Dialog open={acknowledgeDialog} onOpenChange={setAcknowledgeDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-700">
              <Check className="w-5 h-5" /> Acknowledge Alert
            </DialogTitle>
          </DialogHeader>
          {selectedAlert && (
            <div className="space-y-4">
              <div className="bg-red-50 rounded-lg p-3 space-y-2">
                <p className="text-sm text-gray-600"><span className="font-bold">Register:</span> {selectedAlert.register_id} ({selectedAlert.register_name})</p>
                <p className="text-sm text-gray-600"><span className="font-bold">Operator:</span> {selectedAlert.operator_name} ({selectedAlert.operator_id})</p>
                <p className="text-sm text-gray-600"><span className="font-bold">Time:</span> {new Date(selectedAlert.timestamp).toLocaleString()}</p>
              </div>
              <p className="text-sm text-gray-700">Mark this emergency alert as acknowledged?</p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setAcknowledgeDialog(false)} className="flex-1">Cancel</Button>
                <Button onClick={() => acknowledgeAlert(selectedAlert)} className="flex-1 bg-red-600 hover:bg-red-700 text-white">Acknowledge</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Remove Dialog — Manager Override */}
      <Dialog open={removeDialog} onOpenChange={setRemoveDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-700">
              <ShieldAlert className="w-5 h-5" /> Remove Alert
            </DialogTitle>
            <DialogDescription>
              Permanently deletes this emergency alert from the log. Requires Manager or CSM authorization.
            </DialogDescription>
          </DialogHeader>
          {selectedAlert && (
            <div className="space-y-4">
              <div className="bg-red-50 rounded-lg p-3 space-y-1">
                <p className="text-sm text-gray-600"><span className="font-bold">Register:</span> {selectedAlert.register_id} ({selectedAlert.register_name})</p>
                <p className="text-sm text-gray-600"><span className="font-bold">Operator:</span> {selectedAlert.operator_name} ({selectedAlert.operator_id})</p>
                <p className="text-sm text-gray-600"><span className="font-bold">Time:</span> {new Date(selectedAlert.timestamp).toLocaleString()}</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Manager / CSM PIN</label>
                <Input
                  type="password"
                  value={overridePin}
                  onChange={e => { setOverridePin(e.target.value); setOverrideError(""); }}
                  placeholder="Enter PIN"
                  autoFocus
                />
              </div>
              {overrideError && <p className="text-red-600 text-xs">{overrideError}</p>}
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setRemoveDialog(false)} className="flex-1" disabled={overrideLoading}>Cancel</Button>
                <Button onClick={handleRemove} className="flex-1 bg-red-600 hover:bg-red-700 text-white" disabled={overrideLoading || !overridePin}>
                  {overrideLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
                  Confirm Remove
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}