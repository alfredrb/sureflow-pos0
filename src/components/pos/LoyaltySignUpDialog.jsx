import React, { useState, useEffect } from "react";
import { base44 } from "@/api/data";
import { UserPlus, CreditCard, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { keyPhoneOnPinpad, canKeyPhoneOnPinpad, confirmLoyaltyConsentOnPinpad, formatPhone } from "@/lib/loyaltyPinpad";

function genLoyaltyId() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 8; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return "LY-" + s;
}

const EMPTY = { name: "", phone: "", email: "", address_street: "", address_city: "", address_state: "", address_zip: "" };

export default function LoyaltySignUpDialog({ open, onClose, operator, onCreated, pinpadContext, toast }) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState(null);
  const [padBusy, setPadBusy] = useState(false);
  const [phoneFromPad, setPhoneFromPad] = useState(false);
  const padAvailable = canKeyPhoneOnPinpad(pinpadContext);

  useEffect(() => {
    if (open) { setCreated(null); setForm(EMPTY); setPhoneFromPad(false); }
  }, [open]);

  // The customer keys and confirms their own number rather than reading it aloud.
  const askPhoneOnPinpad = async () => {
    setPadBusy(true);
    const phone = await keyPhoneOnPinpad(pinpadContext);
    setPadBusy(false);
    if (!phone) { toast?.({ title: "No number entered on the pinpad" }); return; }
    setForm(f => ({ ...f, phone }));
    setPhoneFromPad(true);
  };

  const submit = async () => {
    if (!form.name.trim()) { toast?.({ title: "Name required", variant: "destructive" }); return; }
    setSaving(true);
    // Consent is asked on the pad when one is fitted. A declined answer stops the
    // enrolment; a lane with no pad enrols exactly as before with no consent stamp.
    let consent = { asked: false, agreed: false };
    if (padAvailable) {
      setPadBusy(true);
      consent = await confirmLoyaltyConsentOnPinpad(pinpadContext);
      setPadBusy(false);
      if (consent.asked && !consent.agreed) {
        setSaving(false);
        toast?.({ title: "Sign Up Declined", description: "The customer declined on the pinpad.", variant: "destructive" });
        return;
      }
    }
    try {
      const loyalty_id = genLoyaltyId();
      const member = await base44.entities.LoyaltyMember.create({
        ...form,
        loyalty_id,
        rewards_balance: 0,
        lifetime_points: 0,
        status: "active",
        enrolled_date: new Date().toISOString(),
        enrolled_by_operator_id: operator?.operator_id || "",
        enrolled_by_operator_name: operator?.full_name || "",
        enrolled_at_register: sessionStorage.getItem("pos_register_num") || "",
        consent_on_pinpad: consent.agreed,
        ...(consent.agreed ? { consent_at: new Date().toISOString() } : {}),
        phone_from_pinpad: phoneFromPad,
      });
      setCreated(member);
      onCreated?.(member);
      toast?.({ title: "Loyalty Member Enrolled", description: `ID: ${loyalty_id}` });
    } catch (e) {
      toast?.({ title: "Failed to enroll member", variant: "destructive" });
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-[#111638] border-sky-500/20 text-white max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-sky-400 text-sm flex items-center gap-2"><UserPlus className="w-4 h-4" /> Loyalty Sign Up</DialogTitle>
        </DialogHeader>
        {created ? (
          <div className="space-y-3">
            <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 text-center space-y-1">
              <p className="text-green-400 text-xs uppercase tracking-wider font-bold">Member Enrolled</p>
              <p className="text-white font-medium">{created.name}</p>
              <p className="font-mono text-lg font-bold text-green-300">{created.loyalty_id}</p>
              {created.consent_on_pinpad && (
                <p className="text-green-300/80 text-xs flex items-center justify-center gap-1"><Check className="w-3 h-3" /> Customer agreed on the pinpad</p>
              )}
              <p className="text-blue-300/50 text-xs">Present this ID at checkout to earn &amp; redeem rewards.</p>
            </div>
            <Button onClick={onClose} className="w-full bg-sky-600 hover:bg-sky-500 text-white">Done</Button>
          </div>
        ) : (
          <div className="space-y-3">
            {padBusy && (
              <div className="bg-sky-500/10 border border-sky-500/30 rounded-lg p-3 text-center">
                <p className="text-sky-300 text-xs font-bold">Waiting on the customer at the pinpad…</p>
              </div>
            )}
            <div>
              <Label>Name *</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="bg-[#0a0e27] border-sky-500/20 text-white" autoFocus data-softkeyboard />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Phone</Label><Input value={form.phone} onChange={e => { setForm(f => ({ ...f, phone: e.target.value })); setPhoneFromPad(false); }} className="bg-[#0a0e27] border-sky-500/20 text-white" data-softkeyboard /></div>
              <div><Label>Email</Label><Input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className="bg-[#0a0e27] border-sky-500/20 text-white" data-softkeyboard /></div>
            </div>
            {padAvailable && (
              <Button onClick={askPhoneOnPinpad} disabled={padBusy || saving} variant="outline" className="w-full border-sky-500/20 text-sky-300 hover:bg-sky-500/10">
                <CreditCard className="w-4 h-4 mr-1" /> Customer Keys Phone on Pinpad
              </Button>
            )}
            {phoneFromPad && (
              <p className="text-green-300 text-xs flex items-center gap-1"><Check className="w-3 h-3" /> {formatPhone(form.phone)} confirmed by the customer</p>
            )}
            <div>
              <Label>Address</Label>
              <Input value={form.address_street} onChange={e => setForm(f => ({ ...f, address_street: e.target.value }))} placeholder="Street" className="bg-[#0a0e27] border-sky-500/20 text-white" data-softkeyboard />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Input value={form.address_city} onChange={e => setForm(f => ({ ...f, address_city: e.target.value }))} placeholder="City" className="bg-[#0a0e27] border-sky-500/20 text-white" data-softkeyboard />
              <Input value={form.address_state} onChange={e => setForm(f => ({ ...f, address_state: e.target.value }))} placeholder="State" className="bg-[#0a0e27] border-sky-500/20 text-white" data-softkeyboard />
              <Input value={form.address_zip} onChange={e => setForm(f => ({ ...f, address_zip: e.target.value }))} placeholder="ZIP" className="bg-[#0a0e27] border-sky-500/20 text-white" data-softkeyboard />
            </div>
            <Button onClick={submit} disabled={saving || padBusy} className="w-full bg-sky-600 hover:bg-sky-500 text-white">
              {saving ? "Enrolling..." : padAvailable ? "Enroll — Customer Confirms on Pinpad" : "Enroll Member"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}