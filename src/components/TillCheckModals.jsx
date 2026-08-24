import { Button } from "@/components/ui/button";
import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import { openCashDrawer } from "@/lib/relayClient";
import AdminSlipPrintButton from "@/components/admin/AdminSlipPrintButton";
import { adminPrintCashSlip } from "@/lib/adminPrint";
import { logAuditEvent } from "@/lib/auditLogger";
import BagNumberField from "@/components/till/BagNumberField";
import TillCountInputs from "@/components/till/TillCountInputs";
import ForceCheckinPrompt from "@/components/till/ForceCheckinPrompt";

// Pop the selected register's drawer so the till can be loaded / pulled. Silent on failure.
const popRegisterDrawer = (register) =>
  openCashDrawer(register?.printer_ip || "").catch(() => {});

const bagKey = (v) => (v ?? "").toString().trim();

export function TillCheckoutModal({ open, onClose, registers, onSuccess }) {
  const { toast } = useToast();
  const [selectedRegister, setSelectedRegister] = useState("");
  const [bagNumber, setBagNumber] = useState("");

  const reset = () => {
    setSelectedRegister("");
    setBagNumber("");
  };

  return open ? (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <h2 className="text-xl font-bold mb-4">Check Out Till</h2>

        <BagNumberField
          value={bagNumber}
          onChange={setBagNumber}
          hint="Assigned to this till. The same number must be keyed when the bag comes back."
        />

        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">Select Register</label>
          <select
            value={selectedRegister}
            onChange={(e) => setSelectedRegister(e.target.value)}
            className="w-full border border-gray-300 rounded-md p-2"
          >
            <option value="">-- Select Register --</option>
            {registers.map(reg => (
              <option key={reg.id} value={reg.id}>{reg.name}</option>
            ))}
          </select>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
          <h3 className="font-semibold text-blue-900 mb-2">Standard Till Contents ($250)</h3>
          <div className="text-sm text-blue-900 space-y-1">
            <p>• 5 × $20 = $100</p>
            <p>• 5 × $10 = $50</p>
            <p>• 10 × $5 = $50</p>
            <p>• 40 × $1 = $40</p>
            <p>• 2 Rolls of Quarters = $10</p>
            <p>• 1 Roll of Dimes = $5</p>
            <p>• 1 Roll of Nickels = $2</p>
            <p>• 2 Rolls of Pennies = $1</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              onClose();
              reset();
            }}
            className="flex-1"
          >
            Cancel
          </Button>
          <AdminSlipPrintButton
            className="flex-1"
            slip={{
              title: "TILL CHECK-OUT SLIP",
              kind: "checkout",
              amount: 250,
              reason: `BAG ${bagKey(bagNumber) || "—"} · STANDARD $250 TILL FLOAT`,
              registerId: registers.find(r => r.id === selectedRegister)?.register_id,
              registerName: registers.find(r => r.id === selectedRegister)?.name,
            }}
          />
          <Button
            onClick={async () => {
              if (!selectedRegister) {
                toast({ title: "Please select a register", variant: "destructive" });
                return;
              }
              const bag = bagKey(bagNumber);
              if (!bag) {
                toast({ title: "Enter a bag number", description: "Use 0 for a loose till with no bag.", variant: "destructive" });
                return;
              }
              try {
                const user = await base44.auth.me();
                const register = registers.find(r => r.id === selectedRegister);

                // Clear any previous checked-in till for this register
                const existingCheckIns = await base44.entities.TillCheckout.filter({
                  register_id: selectedRegister,
                  status: "checked_in"
                });
                for (const till of existingCheckIns) {
                  await base44.entities.TillCheckout.delete(till.id);
                }

                await base44.entities.TillCheckout.create({
                  register_id: selectedRegister,
                  register_name: register?.name,
                  bag_number: bag,
                  operator_id: user.id,
                  operator_name: user.full_name,
                  checkout_date: new Date().toISOString(),
                  status: "checked_out",
                  checkout_bills: { twenty: 5, ten: 5, five: 10, one: 40 },
                  checkout_coins: { quarters_rolls: 2, dimes_rolls: 1, nickels_rolls: 1, pennies_rolls: 2 },
                  checkout_total: 250
                });

                await base44.entities.RegisterLog.create({
                  event_type: "register_change",
                  operator_id: user.id,
                  operator_name: user.full_name,
                  register_id: selectedRegister,
                  register_name: register?.name,
                  detail: `Till checked out: bag ${bag}, $250 initial float`
                });

                logAuditEvent({
                  action: `Till checked out — bag ${bag}`,
                  category: "register",
                  description: `Bag ${bag} checked out to ${register?.name || selectedRegister} with the standard $250 float by ${user.full_name}.`,
                  page: "/admin/cash-reconciliation",
                  actor: { operator_id: user.id, full_name: user.full_name },
                  changes: [{ field: "bag_number", from: "", to: bag }],
                });

                popRegisterDrawer(register);

                adminPrintCashSlip({
                  title: "TILL CHECK-OUT SLIP",
                  kind: "checkout",
                  amount: 250,
                  reason: `BAG ${bag} · STANDARD $250 TILL FLOAT`,
                  registerId: register?.register_id,
                  registerName: register?.name,
                  operatorName: user.full_name,
                }).catch(() => {});

                toast({ title: "Till checked out successfully", description: `Bag ${bag}` });
                onClose();
                reset();
                onSuccess();
              } catch (e) {
                toast({ title: "Error checking out till", variant: "destructive" });
              }
            }}
            className="flex-1 bg-green-600 hover:bg-green-700"
          >
            Check Out
          </Button>
        </div>
      </div>
    </div>
  ) : null;
}

export function TillCheckinModal({ open, onClose, registers, tillCheckouts, onSuccess }) {
  const { toast } = useToast();
  const [selectedRegister, setSelectedRegister] = useState("");
  const [bagNumber, setBagNumber] = useState("");
  const [forcePrompt, setForcePrompt] = useState(null);
  const [checkinBills, setCheckinBills] = useState({ hundred: 0, twenty: 0, ten: 0, five: 0, one: 0 });
  const [checkinCoins, setCheckinCoins] = useState({ quarters_rolls: 0, dimes_rolls: 0, nickels_rolls: 0, pennies_rolls: 0 });

  const billTotal = ((checkinBills.hundred || 0) * 100) + (checkinBills.twenty * 20) + (checkinBills.ten * 10) + (checkinBills.five * 5) + (checkinBills.one * 1);
  const coinTotal = (checkinCoins.quarters_rolls * 10) + (checkinCoins.dimes_rolls * 5) + (checkinCoins.nickels_rolls * 2) + (checkinCoins.pennies_rolls * 0.50);
  const checkinTotal = billTotal + coinTotal;
  const discrepancy = checkinTotal - 250;

  const openCheckout = tillCheckouts?.find(t => t.register_id === selectedRegister && t.status === "checked_out");

  const reset = () => {
    setSelectedRegister("");
    setBagNumber("");
    setForcePrompt(null);
    setCheckinBills({ hundred: 0, twenty: 0, ten: 0, five: 0, one: 0 });
    setCheckinCoins({ quarters_rolls: 0, dimes_rolls: 0, nickels_rolls: 0, pennies_rolls: 0 });
  };

  // One commit path for both a matching check-in and a manager-forced one, so the
  // record, the log and the slip always tell the same story.
  const commitCheckin = async (override = null) => {
    try {
      const user = await base44.auth.me();
      const register = registers.find(r => r.id === selectedRegister);
      const keyed = bagKey(bagNumber);
      const expected = bagKey(openCheckout?.bag_number);

      if (openCheckout) {
        await base44.entities.TillCheckout.update(openCheckout.id, {
          status: "checked_in",
          checkin_date: new Date().toISOString(),
          checkin_operator_id: user.id,
          checkin_operator_name: user.full_name,
          checkin_bills: checkinBills,
          checkin_coins: checkinCoins,
          checkin_total: checkinTotal,
          discrepancy: discrepancy,
          bag_number: keyed,
          expected_bag_number: expected,
          forced: !!override,
          force_manager_id: override?.manager?.operator_id || "",
          force_manager_name: override?.manager?.full_name || "",
          force_reason: override?.reason || "",
        });
      }

      const forcedNote = override
        ? ` — FORCED: expected bag ${expected || "—"}, authorized by ${override.manager.full_name} (${override.reason})`
        : "";

      await base44.entities.RegisterLog.create({
        event_type: "register_change",
        operator_id: user.id,
        operator_name: user.full_name,
        register_id: selectedRegister,
        register_name: register?.name,
        detail: `Till checked in: bag ${keyed}, $${checkinTotal.toFixed(2)} (Discrepancy: ${discrepancy >= 0 ? '+' : ''}$${discrepancy.toFixed(2)})${forcedNote}`
      });

      logAuditEvent({
        action: override ? `Till force checked in — bag ${keyed}` : `Till checked in — bag ${keyed}`,
        category: "register",
        description: override
          ? `Bag ${keyed} checked in against ${register?.name || selectedRegister} which expected bag ${expected || "—"}. Override authorized by ${override.manager.full_name} (${override.manager.operator_id}): ${override.reason}. Returned by ${user.full_name}, counted $${checkinTotal.toFixed(2)}, discrepancy ${discrepancy >= 0 ? "+" : ""}$${discrepancy.toFixed(2)}.`
          : `Bag ${keyed} checked in at ${register?.name || selectedRegister} by ${user.full_name}. Counted $${checkinTotal.toFixed(2)}, discrepancy ${discrepancy >= 0 ? "+" : ""}$${discrepancy.toFixed(2)}. Pulled by ${openCheckout?.operator_name || "—"}.`,
        page: "/admin/cash-reconciliation",
        actor: { operator_id: user.id, full_name: user.full_name },
        changes: [
          { field: "bag_number", from: expected, to: keyed },
          { field: "checkin_total", from: "250.00", to: checkinTotal.toFixed(2) },
        ],
      });

      popRegisterDrawer(register);

      adminPrintCashSlip({
        title: override ? "TILL CHECK-IN SLIP (FORCED)" : "TILL CHECK-IN SLIP",
        kind: "checkin",
        amount: checkinTotal,
        reason: `BAG ${keyed}${override ? ` (EXPECTED ${expected || "—"} · FORCED BY ${override.manager.full_name})` : ""} · DISCREPANCY ${discrepancy >= 0 ? "+" : "-"}$${Math.abs(discrepancy).toFixed(2)}`,
        registerId: register?.register_id,
        registerName: register?.name,
        operatorName: user.full_name,
      }).catch(() => {});

      toast({
        title: override ? "Till force checked in" : "Till checked in successfully",
        description: `Bag ${keyed}`,
      });
      onClose();
      reset();
      onSuccess();
    } catch (e) {
      toast({ title: "Error checking in till", variant: "destructive" });
    }
  };

  const handleCheckin = () => {
    if (!selectedRegister) {
      toast({ title: "Please select a register", variant: "destructive" });
      return;
    }
    const keyed = bagKey(bagNumber);
    if (!keyed) {
      toast({ title: "Enter the bag number being returned", variant: "destructive" });
      return;
    }
    const expected = bagKey(openCheckout?.bag_number);
    // Mismatch (including an open checkout that never recorded a bag) needs a manager.
    if (keyed !== expected) {
      setForcePrompt({ expected, keyed });
      return;
    }
    commitCheckin();
  };

  return open ? (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">Check In Till</h2>

        <BagNumberField
          value={bagNumber}
          onChange={setBagNumber}
          label="Bag Number Returned"
          hint="Must match the bag this register was checked out with."
        />

        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">Select Register</label>
          <select
            value={selectedRegister}
            onChange={(e) => setSelectedRegister(e.target.value)}
            className="w-full border border-gray-300 rounded-md p-2"
          >
            <option value="">-- Select Register --</option>
            {registers.map(reg => (
              <option key={reg.id} value={reg.id}>{reg.name}</option>
            ))}
          </select>
        </div>

        {selectedRegister && (
          <>
            {!openCheckout && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 text-sm text-amber-800">
                No open till check-out found for this register.
              </div>
            )}

            <TillCountInputs
              bills={checkinBills}
              coins={checkinCoins}
              onBills={setCheckinBills}
              onCoins={setCheckinCoins}
            />

            <div className="bg-gray-50 rounded-lg p-3 mb-4 text-sm">
              <p className="text-gray-700">Bills Total: <span className="font-semibold">${billTotal.toFixed(2)}</span></p>
              <p className="text-gray-700">Coins Total: <span className="font-semibold">${coinTotal.toFixed(2)}</span></p>
              <p className="text-gray-700 border-t border-gray-300 pt-2 mt-2">Check-In Total: <span className="font-semibold">${checkinTotal.toFixed(2)}</span></p>
              <p className={`font-semibold ${discrepancy < 0 ? 'text-red-600' : 'text-green-600'}`}>
                Discrepancy: ${discrepancy.toFixed(2)}
              </p>
            </div>
          </>
        )}

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              onClose();
              reset();
            }}
            className="flex-1"
          >
            Cancel
          </Button>
          <AdminSlipPrintButton
            className="flex-1"
            slip={{
              title: "TILL CHECK-IN SLIP",
              kind: "checkin",
              amount: checkinTotal,
              reason: `BAG ${bagKey(bagNumber) || "—"} · DISCREPANCY ${discrepancy >= 0 ? "+" : "-"}$${Math.abs(discrepancy).toFixed(2)}`,
              registerId: registers.find(r => r.id === selectedRegister)?.register_id,
              registerName: registers.find(r => r.id === selectedRegister)?.name,
            }}
          />
          <Button onClick={handleCheckin} className="flex-1 bg-green-600 hover:bg-green-700">
            Check In
          </Button>
        </div>
      </div>

      <ForceCheckinPrompt
        open={!!forcePrompt}
        expectedBag={forcePrompt?.expected}
        keyedBag={forcePrompt?.keyed}
        onCancel={() => setForcePrompt(null)}
        onConfirm={(override) => {
          setForcePrompt(null);
          commitCheckin(override);
        }}
      />
    </div>
  ) : null;
}