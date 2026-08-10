import { useState, useEffect } from "react";
import { base44 } from "@/api/data";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { AlertTriangle, Check, Clock, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";

export default function AdminEmergencyLog() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [acknowledgeDialog, setAcknowledgeDialog] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadAlerts();
  }, []);
  useRealtimeSync("EmergencyAlert", loadAlerts, { intervalMs: 10000 });

  const loadAlerts = async () => {
    try {
      const data = await base44.entities.EmergencyAlert.list("-created_date", 200);
      setAlerts(data);
      setLoading(false);
    } catch (e) {
      toast({ title: "Error loading alerts", variant: "destructive" });
      setLoading(false);
    }
  };

  const acknowledgeAlert = async (alert) => {
    try {
      await base44.entities.EmergencyAlert.update(alert.id, {
        status: "acknowledged",
        acknowledged_by_id: "admin", // In real app, get from auth
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

  const dismissAlert = async (alert) => {
    try {
      await base44.entities.EmergencyAlert.delete(alert.id);
      toast({ title: "Alert dismissed" });
      loadAlerts();
    } catch (e) {
      toast({ title: "Error dismissing alert", variant: "destructive" });
    }
  };

  const activeAlerts = alerts.filter(a => a.status === "active");
  const acknowledgedAlerts = alerts.filter(a => a.status === "acknowledged");

  if (loading) {
    return <div className="p-6"><div className="animate-spin w-8 h-8 border-4 border-red-200 border-t-red-600 rounded-full" /></div>;
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 w-full">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Emergency Alert Log</h1>
          <p className="text-gray-500 mt-2 text-sm sm:text-base">Real-time robbery and emergency alert tracking</p>
        </div>
      </div>

      {/* Active Alerts Section */}
      {activeAlerts.length > 0 && (
        <div className="mb-8 bg-red-50 border border-red-300 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-6 h-6 text-red-600 animate-pulse" />
            <h2 className="text-lg font-bold text-red-700">
              Active Alerts ({activeAlerts.length})
            </h2>
          </div>
          <div className="space-y-3">
            {activeAlerts.map(alert => (
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
                <div className="flex gap-2 flex-shrink-0">
                  <Button
                    onClick={() => dismissAlert(alert)}
                    variant="outline"
                    className="border-gray-300 text-gray-700 hover:bg-gray-50"
                  >
                    <X className="w-4 h-4 mr-1" /> Dismiss
                  </Button>
                  <Button
                    onClick={() => {
                      setSelectedAlert(alert);
                      setAcknowledgeDialog(true);
                    }}
                    className="bg-red-600 hover:bg-red-700 text-white"
                  >
                    <Check className="w-4 h-4 mr-1" /> Acknowledge
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All Alerts History */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-gray-200">
          <h2 className="font-semibold text-gray-900">All Alerts ({alerts.length})</h2>
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
                <th className="text-left px-4 py-3 font-bold text-gray-700 text-xs">Action</th>
              </tr>
            </thead>
            <tbody>
              {alerts.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center py-8 text-gray-500">No emergency alerts</td>
                </tr>
              ) : (
                alerts.map((alert, idx) => (
                  <tr key={alert.id} className={`border-b border-gray-100 ${idx % 2 === 0 ? "bg-white" : "bg-gray-50/30"}`}>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold ${
                        alert.status === "active"
                          ? "bg-red-100 text-red-700"
                          : alert.status === "acknowledged"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-green-100 text-green-700"
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          alert.status === "active" ? "bg-red-600 animate-pulse" :
                          alert.status === "acknowledged" ? "bg-amber-600" :
                          "bg-green-600"
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
                      {alert.status === "active" && (
                        <Button
                          size="sm"
                          onClick={() => {
                            setSelectedAlert(alert);
                            setAcknowledgeDialog(true);
                          }}
                          className="bg-red-600 hover:bg-red-700 text-white text-xs"
                        >
                          Ack
                        </Button>
                      )}
                      {alert.status === "acknowledged" && (
                        <span className="text-amber-600 text-xs font-medium">
                          Ack by {alert.acknowledged_by_name}
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

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
                <p className="text-sm text-gray-600">
                  <span className="font-bold">Register:</span> {selectedAlert.register_id} ({selectedAlert.register_name})
                </p>
                <p className="text-sm text-gray-600">
                  <span className="font-bold">Operator:</span> {selectedAlert.operator_name} ({selectedAlert.operator_id})
                </p>
                <p className="text-sm text-gray-600">
                  <span className="font-bold">Time:</span> {new Date(selectedAlert.timestamp).toLocaleString()}
                </p>
              </div>
              <p className="text-sm text-gray-700">Mark this emergency alert as acknowledged?</p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setAcknowledgeDialog(false)} className="flex-1">Cancel</Button>
                <Button onClick={() => acknowledgeAlert(selectedAlert)} className="flex-1 bg-red-600 hover:bg-red-700 text-white">
                  Acknowledge
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}