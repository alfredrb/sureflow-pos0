import { Button } from "@/components/ui/button";
import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";

export function TillCheckoutModal({ open, onClose, registers, onSuccess }) {
  const { toast } = useToast();
  const [selectedRegister, setSelectedRegister] = useState("");

  return open ? (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <h2 className="text-xl font-bold mb-4">Check Out Till</h2>
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
              setSelectedRegister("");
            }}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            onClick={async () => {
              if (!selectedRegister) {
                toast({ title: "Please select a register", variant: "destructive" });
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
                  detail: `Till checked out: $250 initial float`
                });

                toast({ title: "Till checked out successfully" });
                onClose();
                setSelectedRegister("");
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
  const [checkinBills, setCheckinBills] = useState({ twenty: 0, ten: 0, five: 0, one: 0 });
  const [checkinCoins, setCheckinCoins] = useState({ quarters_rolls: 0, dimes_rolls: 0, nickels_rolls: 0, pennies_rolls: 0 });

  const billTotal = (checkinBills.twenty * 20) + (checkinBills.ten * 10) + (checkinBills.five * 5) + (checkinBills.one * 1);
  const coinTotal = (checkinCoins.quarters_rolls * 10) + (checkinCoins.dimes_rolls * 5) + (checkinCoins.nickels_rolls * 2) + (checkinCoins.pennies_rolls * 0.50);
  const checkinTotal = billTotal + coinTotal;
  const discrepancy = checkinTotal - 250;

  return open ? (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">Check In Till</h2>
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
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <h3 className="font-semibold mb-3 text-gray-800">Bills Returned</h3>
                <div className="space-y-2">
                  <div>
                    <label className="text-sm text-gray-600">$20 Bills</label>
                    <input
                      type="number"
                      min="0"
                      value={checkinBills.twenty}
                      onChange={(e) => setCheckinBills({...checkinBills, twenty: parseInt(e.target.value) || 0})}
                      className="w-full border border-gray-300 rounded-md p-2"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-600">$10 Bills</label>
                    <input
                      type="number"
                      min="0"
                      value={checkinBills.ten}
                      onChange={(e) => setCheckinBills({...checkinBills, ten: parseInt(e.target.value) || 0})}
                      className="w-full border border-gray-300 rounded-md p-2"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-600">$5 Bills</label>
                    <input
                      type="number"
                      min="0"
                      value={checkinBills.five}
                      onChange={(e) => setCheckinBills({...checkinBills, five: parseInt(e.target.value) || 0})}
                      className="w-full border border-gray-300 rounded-md p-2"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-600">$1 Bills</label>
                    <input
                      type="number"
                      min="0"
                      value={checkinBills.one}
                      onChange={(e) => setCheckinBills({...checkinBills, one: parseInt(e.target.value) || 0})}
                      className="w-full border border-gray-300 rounded-md p-2"
                    />
                  </div>
                </div>
              </div>
              <div>
                <h3 className="font-semibold mb-3 text-gray-800">Coin Rolls Returned</h3>
                <div className="space-y-2">
                  <div>
                    <label className="text-sm text-gray-600">Quarter Rolls</label>
                    <input
                      type="number"
                      min="0"
                      value={checkinCoins.quarters_rolls}
                      onChange={(e) => setCheckinCoins({...checkinCoins, quarters_rolls: parseInt(e.target.value) || 0})}
                      className="w-full border border-gray-300 rounded-md p-2"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-600">Dime Rolls</label>
                    <input
                      type="number"
                      min="0"
                      value={checkinCoins.dimes_rolls}
                      onChange={(e) => setCheckinCoins({...checkinCoins, dimes_rolls: parseInt(e.target.value) || 0})}
                      className="w-full border border-gray-300 rounded-md p-2"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-600">Nickel Rolls</label>
                    <input
                      type="number"
                      min="0"
                      value={checkinCoins.nickels_rolls}
                      onChange={(e) => setCheckinCoins({...checkinCoins, nickels_rolls: parseInt(e.target.value) || 0})}
                      className="w-full border border-gray-300 rounded-md p-2"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-600">Penny Rolls</label>
                    <input
                      type="number"
                      min="0"
                      value={checkinCoins.pennies_rolls}
                      onChange={(e) => setCheckinCoins({...checkinCoins, pennies_rolls: parseInt(e.target.value) || 0})}
                      className="w-full border border-gray-300 rounded-md p-2"
                    />
                  </div>
                </div>
              </div>
            </div>

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
              setSelectedRegister("");
              setCheckinBills({ twenty: 0, ten: 0, five: 0, one: 0 });
              setCheckinCoins({ quarters_rolls: 0, dimes_rolls: 0, nickels_rolls: 0, pennies_rolls: 0 });
            }}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            onClick={async () => {
              if (!selectedRegister) {
                toast({ title: "Please select a register", variant: "destructive" });
                return;
              }
              try {
                const user = await base44.auth.me();
                const register = registers.find(r => r.id === selectedRegister);

                // Find matching checkout
                const checkout = tillCheckouts.find(t => t.register_id === selectedRegister && t.status === "checked_out");
                
                if (checkout) {
                  await base44.entities.TillCheckout.update(checkout.id, {
                    status: "checked_in",
                    checkin_date: new Date().toISOString(),
                    checkin_bills: checkinBills,
                    checkin_coins: checkinCoins,
                    checkin_total: checkinTotal,
                    discrepancy: discrepancy
                  });
                }

                await base44.entities.RegisterLog.create({
                  event_type: "register_change",
                  operator_id: user.id,
                  operator_name: user.full_name,
                  register_id: selectedRegister,
                  register_name: register?.name,
                  detail: `Till checked in: $${checkinTotal.toFixed(2)} (Discrepancy: ${discrepancy >= 0 ? '+' : ''}$${discrepancy.toFixed(2)})`
                });

                toast({ title: "Till checked in successfully" });
                onClose();
                setSelectedRegister("");
                setCheckinBills({ twenty: 0, ten: 0, five: 0, one: 0 });
                setCheckinCoins({ quarters_rolls: 0, dimes_rolls: 0, nickels_rolls: 0, pennies_rolls: 0 });
                onSuccess();
              } catch (e) {
                toast({ title: "Error checking in till", variant: "destructive" });
              }
            }}
            className="flex-1 bg-green-600 hover:bg-green-700"
          >
            Check In
          </Button>
        </div>
      </div>
    </div>
  ) : null;
}