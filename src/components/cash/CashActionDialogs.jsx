import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import CashSlipReceipt from "@/components/CashSlipReceipt";
import DenominationInputs from "@/components/cash/DenominationInputs";
import { billsTotal } from "@/lib/denominations";

const RegisterSelect = ({ value, onChange, registers, ring }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-2">Register</label>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 ${ring} focus:border-transparent bg-white`}
    >
      <option value="">Select a register</option>
      {registers.length > 0 ? (
        registers.map((reg) => <option key={reg.id} value={reg.id}>{reg.name}</option>)
      ) : (
        <option disabled>No registers available</option>
      )}
    </select>
  </div>
);

const AmountReason = ({ form, setForm, placeholder }) => (
  <>
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">Amount</label>
      <div className="relative">
        <span className="absolute left-3 top-2.5 text-gray-500">$</span>
        <Input
          type="number"
          step="0.01"
          min="0"
          placeholder="0.00"
          value={form.amount}
          onChange={(e) => setForm({ ...form, amount: e.target.value })}
          className="pl-7"
        />
      </div>
    </div>
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">Reason</label>
      <Input placeholder={placeholder} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
    </div>
  </>
);

// Keying bill counts auto-fills the amount so the slip, the record and the vault agree.
const onBillsChange = (form, setForm) => (bills) => {
  const total = billsTotal(bills);
  setForm({ ...form, bills, amount: total > 0 ? String(total) : form.amount });
};

export function CashAdvanceDialog({ open, onOpenChange, form, setForm, registers, onSubmit }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Record Cash Advance</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <RegisterSelect value={form.register_id} onChange={(v) => setForm({ ...form, register_id: v })} registers={registers} ring="focus:ring-blue-500" />
          <DenominationInputs bills={form.bills || {}} onChange={onBillsChange(form, setForm)} />
          <AmountReason form={form} setForm={setForm} placeholder="e.g., Low cash float, unexpected spike" />
          <div className="flex gap-2 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">Cancel</Button>
            <Button onClick={onSubmit} className="flex-1 bg-blue-600 hover:bg-blue-700">Record &amp; Print</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function CashPickupDialog({ open, onOpenChange, form, setForm, registers, onSubmit }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Record Cash Pickup</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <RegisterSelect value={form.register_id} onChange={(v) => setForm({ ...form, register_id: v })} registers={registers} ring="focus:ring-amber-500" />
          <DenominationInputs bills={form.bills || {}} onChange={onBillsChange(form, setForm)} />
          <AmountReason form={form} setForm={setForm} placeholder="e.g., Excess cash, daily deposit" />
          <div className="flex gap-2 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">Cancel</Button>
            <Button onClick={onSubmit} className="flex-1 bg-amber-600 hover:bg-amber-700">Record &amp; Print</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function ManualAuditDialog({ open, onOpenChange, form, setForm, registers, onSubmit }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Create Manual Audit</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <RegisterSelect value={form.register_id} onChange={(v) => setForm({ ...form, register_id: v })} registers={registers} ring="focus:ring-purple-500" />
            <p className="text-xs text-gray-500 mt-2">Cash count will be entered in the POS Cash Management system</p>
          </div>
          <div className="flex gap-2 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">Cancel</Button>
            <Button onClick={onSubmit} className="flex-1 bg-purple-600 hover:bg-purple-700">Create Audit</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function CancelAuditDialog({ audit, onClose, onConfirm }) {
  return (
    <Dialog open={!!audit} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle className="text-red-600">Confirm Audit Cancellation</DialogTitle></DialogHeader>
        {audit && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Are you sure you want to cancel the audit for <span className="font-bold">{audit.register_name}</span>? This action cannot be undone.
            </p>
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
              The audit status will be changed to "Canceled" and it will appear in the audit history log.
            </div>
            <div className="flex gap-2 pt-4">
              <Button variant="outline" onClick={onClose} className="flex-1">Keep Audit</Button>
              <Button onClick={() => onConfirm(audit.id)} className="flex-1 bg-red-600 hover:bg-red-700">Confirm Cancel</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function CashSlipDialog({ printData, onClose }) {
  if (!printData) return null;
  const isAdvance = printData.type === "advance";
  return (
    <Dialog open={!!printData} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Print Cash {isAdvance ? "Advance" : "Pickup"} Slip</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="bg-gray-50 rounded-lg p-4 space-y-2 font-mono text-sm">
            <div className="text-center font-bold border-b pb-2">CASH {isAdvance ? "ADVANCE" : "PICKUP"} SLIP</div>
            <div className="space-y-1">
              <div>Type: {isAdvance ? "ADVANCE" : "PICKUP"}</div>
              <div>Register: {printData.registerId}</div>
              <div>Name: {printData.registerName}</div>
            </div>
            <div className="border-t border-b py-2 text-center">
              <div className="text-2xl font-bold">${parseFloat(printData.amount).toFixed(2)}</div>
            </div>
            {(printData.denominations || []).length > 0 && (
              <div className="text-xs border-b pb-2">
                <div>Notes:</div>
                {printData.denominations.map((d, i) => (
                  <div key={i} className="text-right tabular-nums">
                    {d.qty} x {d.label || `$${Number(d.value).toFixed(2)}`} = ${(Number(d.qty) * Number(d.value)).toFixed(2)}
                  </div>
                ))}
              </div>
            )}
            <div className="space-y-1 text-xs">
              <div>Date: {new Date(printData.date).toLocaleString()}</div>
              {printData.reason && <div>Reason: {printData.reason}</div>}
            </div>
            <div className="text-center text-xs border-t pt-2 text-gray-600">FOR AUDITOR CONFIRMATION</div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} className="flex-1">Close</Button>
            <CashSlipReceipt
              type={printData.type}
              registerName={printData.registerName}
              registerId={printData.registerId}
              amount={printData.amount}
              reason={printData.reason}
              date={printData.date}
              denominations={printData.denominations}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}