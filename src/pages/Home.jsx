import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Monitor, Settings, ShoppingCart, Users, Package, Receipt, Keyboard, Network, Percent, Calendar, Lock, Store, Loader2, Clock } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import SelfTimeClock from "@/components/SelfTimeClock";

export default function Home() {
  const [shiftLookupOpen, setShiftLookupOpen] = useState(false);
  const [pin, setPin] = useState("");
  const [currentOperator, setCurrentOperator] = useState(null);
  const [currentShift, setCurrentShift] = useState(null);
  const [operators, setOperators] = useState([]);
  const [swapOpen, setSwapOpen] = useState(false);
  const [selectedSwapOperator, setSelectedSwapOperator] = useState("");
  const [swapReason, setSwapReason] = useState("");
  const [incomingSwapRequests, setIncomingSwapRequests] = useState([]);
  const { toast } = useToast();
  const navigate = useNavigate();
  const [vendorLoginOpen, setVendorLoginOpen] = useState(false);
  const [vendorId, setVendorId] = useState("");
  const [vendorPin, setVendorPin] = useState("");
  const [vendorLoading, setVendorLoading] = useState(false);
  const [timeClockOpen, setTimeClockOpen] = useState(false);
  const [storeName, setStoreName] = useState("Supermart");

  const handleVendorLogin = async () => {
    if (!vendorId.trim() || !vendorPin.trim()) {
      toast({ title: "Enter your Vendor ID and PIN", variant: "destructive" });
      return;
    }
    setVendorLoading(true);
    try {
      const ops = await base44.entities.Operator.filter({ operator_id: vendorId.trim(), pin: vendorPin.trim(), status: "active" });
      const vendor = ops.find(o => o.role === "vendor");
      if (!vendor) {
        toast({ title: "Access Denied", description: "Invalid Vendor ID or PIN", variant: "destructive" });
        setVendorPin("");
      } else {
        sessionStorage.setItem("admin_operator", JSON.stringify(vendor));
        toast({ title: "Welcome", description: `Logged in as ${vendor.full_name}` });
        setVendorLoginOpen(false);
        setVendorId(""); setVendorPin("");
        navigate("/vendor-dashboard");
      }
    } catch (e) {
      toast({ title: "Login failed", variant: "destructive" });
    }
    setVendorLoading(false);
  };

  useEffect(() => {
    base44.entities.Operator.list().then(setOperators).catch(() => {});
  }, []);

  useEffect(() => {
    base44.entities.StoreSettings.list().then(settings => {
      if (settings && settings.length > 0 && settings[0].store_name) {
        setStoreName(settings[0].store_name);
      }
    }).catch(() => {});
  }, []);

  const loadIncomingSwapRequests = async (operatorId) => {
    try {
      const requests = await base44.entities.ShiftSwapRequest.filter({ 
        target_operator_id: operatorId,
        status: "pending"
      });
      setIncomingSwapRequests(requests);
    } catch (e) {
      // silently fail
    }
  };

  const handleShiftLookup = async () => {
    if (!pin) {
      toast({ title: "Please enter your PIN", variant: "destructive" });
      return;
    }

    try {
      const foundOperator = operators.find(op => op.pin === pin);
      if (!foundOperator) {
        toast({ title: "Invalid PIN", variant: "destructive" });
        setPin("");
        return;
      }

      const today = new Date().toISOString().split('T')[0];
      const shifts = await base44.entities.Shift.filter({ 
        operator_id: foundOperator.operator_id,
        date: today
      });

      setCurrentOperator(foundOperator);
      setCurrentShift(shifts[0] || null);
      setPin("");
      await loadIncomingSwapRequests(foundOperator.operator_id);
    } catch (e) {
      toast({ title: "Error looking up shift", variant: "destructive" });
    }
  };

  const handleShiftSwapRequest = async () => {
    if (!selectedSwapOperator || !currentShift) return;

    try {
      await base44.entities.ShiftSwapRequest.create({
        requester_operator_id: currentOperator.operator_id,
        requester_operator_name: currentOperator.full_name,
        target_operator_id: selectedSwapOperator,
        target_operator_name: operators.find(op => op.operator_id === selectedSwapOperator)?.full_name || "",
        shift_id: currentShift.id,
        shift_date: currentShift.date,
        reason: swapReason,
        status: "pending"
      });

      toast({ title: "Shift swap request submitted", description: "Awaiting approval" });
      setSwapOpen(false);
      setCurrentOperator(null);
      setCurrentShift(null);
      setSelectedSwapOperator("");
      setSwapReason("");
    } catch (e) {
      toast({ title: "Error creating swap request", variant: "destructive" });
    }
  };

  const handleApproveSwap = async (request) => {
    try {
      // Update shift to new operator
      await base44.entities.Shift.update(request.shift_id, {
        operator_id: request.requester_operator_id,
        operator_name: request.requester_operator_name
      });

      // Mark swap as approved
      await base44.entities.ShiftSwapRequest.update(request.id, {
        status: "approved",
        approved_at: new Date().toISOString(),
        approved_by_admin: false
      });

      toast({ title: "Shift swap approved", description: "The schedule has been updated" });
      await loadIncomingSwapRequests(currentOperator.operator_id);
    } catch (e) {
      toast({ title: "Error approving swap", variant: "destructive" });
    }
  };

  const handleDeclineSwap = async (request) => {
    try {
      await base44.entities.ShiftSwapRequest.update(request.id, {
        status: "rejected"
      });

      toast({ title: "Shift swap declined" });
      await loadIncomingSwapRequests(currentOperator.operator_id);
    } catch (e) {
      toast({ title: "Error declining swap", variant: "destructive" });
    }
  };

  return (
    <div className="h-screen w-full bg-gradient-to-br from-slate-900 via-[#0a0e27] to-slate-900 flex flex-col items-center justify-center p-6 mx-auto overflow-auto">
      <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-blue-600/30">
        <Monitor className="w-7 h-7 text-white" />
      </div>
      <h1 className="text-4xl font-bold text-white mb-2">{storeName}</h1>
      <p className="text-blue-300/50 text-sm mb-12">Point of Sale Management System</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-lg">
        <Link to="/pos"
          className="flex items-center gap-4 bg-blue-600 hover:bg-blue-500 text-white p-5 rounded-2xl transition-all hover:-translate-y-0.5 shadow-lg shadow-blue-600/20">
          <ShoppingCart className="w-6 h-6" />
          <div>
            <p className="font-semibold">POS Terminal</p>
            <p className="text-blue-200 text-xs">Open the register</p>
          </div>
        </Link>
        <Link to="/admin"
          className="flex items-center gap-4 bg-white/5 hover:bg-white/10 border border-white/10 text-white p-5 rounded-2xl transition-all hover:-translate-y-0.5">
          <Settings className="w-6 h-6 text-blue-400" />
          <div>
            <p className="font-semibold">Admin Dashboard</p>
            <p className="text-blue-300/50 text-xs">Manage your system</p>
          </div>
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6 w-full max-w-lg">
        <button
          onClick={() => setShiftLookupOpen(true)}
          className="flex items-center gap-4 bg-emerald-600 hover:bg-emerald-500 text-white p-5 rounded-2xl transition-all hover:-translate-y-0.5 shadow-lg shadow-emerald-600/20">
          <Calendar className="w-6 h-6" />
          <div>
            <p className="font-semibold">Shift Lookup</p>
            <p className="text-emerald-200 text-xs">Check your schedule</p>
          </div>
        </button>
        <button
          onClick={() => setTimeClockOpen(true)}
          className="flex items-center gap-4 bg-amber-600 hover:bg-amber-500 text-white p-5 rounded-2xl transition-all hover:-translate-y-0.5 shadow-lg shadow-amber-600/20">
          <Clock className="w-6 h-6" />
          <div>
            <p className="font-semibold">Time Clock</p>
            <p className="text-amber-200 text-xs">Clock in / out & breaks</p>
          </div>
        </button>
        <button
          onClick={() => setVendorLoginOpen(true)}
          className="flex items-center gap-4 bg-teal-600 hover:bg-teal-500 text-white p-5 rounded-2xl transition-all hover:-translate-y-0.5 shadow-lg shadow-teal-600/20">
          <Store className="w-6 h-6" />
          <div>
            <p className="font-semibold">Vendor Dashboard</p>
            <p className="text-teal-200 text-xs">Vendor company portal</p>
          </div>
        </button>
      </div>

      {/* Shift Lookup Modal */}
      <Dialog open={shiftLookupOpen} onOpenChange={setShiftLookupOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="w-5 h-5" /> Shift Lookup
            </DialogTitle>
          </DialogHeader>

          {!currentOperator ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Enter Your PIN</label>
                <Input
                  type="password"
                  placeholder="****"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleShiftLookup()}
                  maxLength="4"
                />
              </div>
              <Button onClick={handleShiftLookup} className="w-full bg-blue-600 hover:bg-blue-700">
                Look Up Shift
              </Button>
            </div>
          ) : (
            <div className="space-y-4 max-h-96 overflow-y-auto">
              <div className="bg-blue-50 rounded-lg p-4">
                <p className="text-sm font-medium text-gray-700">Operator: {currentOperator.full_name}</p>
                {currentShift ? (
                  <>
                    <p className="text-xs text-gray-600 mt-2">Shift Date: {currentShift.date}</p>
                    <p className="text-xs text-gray-600">Time: {currentShift.start_time} - {currentShift.end_time}</p>
                    <p className="text-xs text-gray-600">Register: {currentShift.register_name}</p>
                    {currentShift.status && (
                      <p className="text-xs font-semibold mt-2 text-blue-600">Status: {currentShift.status}</p>
                    )}
                  </>
                ) : (
                  <p className="text-xs text-gray-600 mt-2">No shifts scheduled for today</p>
                )}
              </div>

              {incomingSwapRequests.length > 0 && (
                <div className="space-y-2 border-t pt-3">
                  <p className="text-xs font-semibold text-gray-700">Pending Swap Requests:</p>
                  {incomingSwapRequests.map(req => (
                    <div key={req.id} className="bg-amber-50 border border-amber-200 rounded p-2">
                      <p className="text-xs font-medium text-gray-900">{req.requester_operator_name}</p>
                      <p className="text-xs text-gray-600">Date: {req.shift_date}</p>
                      {req.reason && <p className="text-xs text-gray-500 italic">{req.reason}</p>}
                      <div className="flex gap-1 mt-2">
                        <Button 
                          onClick={() => handleApproveSwap(req)}
                          size="sm"
                          className="flex-1 h-7 text-xs bg-emerald-600 hover:bg-emerald-700">
                          Accept
                        </Button>
                        <Button 
                          onClick={() => handleDeclineSwap(req)}
                          size="sm"
                          variant="outline"
                          className="flex-1 h-7 text-xs">
                          Decline
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {currentShift && (
                <Button 
                  onClick={() => setSwapOpen(true)}
                  className="w-full bg-amber-600 hover:bg-amber-700">
                  Request Shift Swap
                </Button>
              )}

              <Button 
                onClick={() => {
                  setCurrentOperator(null);
                  setCurrentShift(null);
                  setIncomingSwapRequests([]);
                }}
                variant="outline"
                className="w-full">
                Close
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Shift Swap Modal */}
      <Dialog open={swapOpen} onOpenChange={setSwapOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Request Shift Swap</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Swap With Operator</label>
              <select
                value={selectedSwapOperator}
                onChange={(e) => setSelectedSwapOperator(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
                <option value="">Select an operator</option>
                {operators
                  .filter(op => op.operator_id !== currentOperator?.operator_id)
                  .map(op => (
                    <option key={op.operator_id} value={op.operator_id}>
                      {op.full_name}
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Reason (optional)</label>
              <Input
                placeholder="e.g., Family emergency, illness"
                value={swapReason}
                onChange={(e) => setSwapReason(e.target.value)}
              />
            </div>

            <div className="flex gap-2">
              <Button 
                onClick={() => setSwapOpen(false)}
                variant="outline"
                className="flex-1">
                Cancel
              </Button>
              <Button 
                onClick={handleShiftSwapRequest}
                disabled={!selectedSwapOperator}
                className="flex-1 bg-amber-600 hover:bg-amber-700">
                Send Request
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Self-Service Time Clock Modal */}
      <SelfTimeClock open={timeClockOpen} onOpenChange={setTimeClockOpen} operators={operators} />

      {/* Vendor Login Modal */}
      <Dialog open={vendorLoginOpen} onOpenChange={setVendorLoginOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Store className="w-5 h-5 text-teal-600" /> Vendor Login</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Vendor Operator ID</label>
              <Input value={vendorId} onChange={e => setVendorId(e.target.value)} placeholder="Enter your vendor operator ID" autoFocus />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">PIN</label>
              <Input type="password" value={vendorPin} onChange={e => setVendorPin(e.target.value)} placeholder="Enter your PIN" onKeyDown={e => e.key === "Enter" && handleVendorLogin()} />
            </div>
            <Button onClick={handleVendorLogin} disabled={vendorLoading} className="w-full bg-teal-600 hover:bg-teal-700">
              {vendorLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {vendorLoading ? "Signing in..." : "Sign In"}
            </Button>
            <p className="text-center text-xs text-gray-400">Vendor access is limited to your company's inventory and sales insights.</p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}