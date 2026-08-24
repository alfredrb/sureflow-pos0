import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/data";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { Button } from "@/components/ui/button";
import { TillCheckoutModal, TillCheckinModal } from "@/components/TillCheckModals";
import { Plus, Minus } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { getAdminAccess } from "@/lib/adminAccess";
import { buildRegisterScope, scopeByRegister, scopeRegisters } from "@/lib/cashScope";
import { computeCashTotals } from "@/lib/cashStats";
import usePushToLP from "@/hooks/usePushToLP";
import PushToLPButton from "@/components/cash/PushToLPButton";
import CashTabBar from "@/components/cash/CashTabBar";
import CashDepositsTab from "@/components/cash/CashDepositsTab";
import CashAuditHistoryTab from "@/components/cash/CashAuditHistoryTab";
import CashDiscrepanciesTab from "@/components/cash/CashDiscrepanciesTab";
import CashEmergencyTab from "@/components/cash/CashEmergencyTab";
import CashHistoryTab from "@/components/cash/CashHistoryTab";
import CashExportTab from "@/components/cash/CashExportTab";
import CashQuickReportTab from "@/components/cash/CashQuickReportTab";
import OpenBagsPanel from "@/components/till/OpenBagsPanel";
import {
  CashAdvanceDialog,
  CashPickupDialog,
  ManualAuditDialog,
  CancelAuditDialog,
  CashSlipDialog,
} from "@/components/cash/CashActionDialogs";

export default function AdminCashReconciliation() {
  const [raw, setRaw] = useState({ deposits: [], registers: [], advances: [], pickups: [], robberies: [], audits: [], alerts: [], giftCardCashouts: [], tillCheckouts: [] });
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(null);
  const [advanceDialog, setAdvanceDialog] = useState(false);
  const [advanceForm, setAdvanceForm] = useState({ register_id: "", amount: "", reason: "" });
  const [pickupDialog, setPickupDialog] = useState(false);
  const [pickupForm, setPickupForm] = useState({ register_id: "", amount: "", reason: "" });
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [showCheckinModal, setShowCheckinModal] = useState(false);
  const [activeTab, setActiveTab] = useState("deposits");
  const [printData, setPrintData] = useState(null);
  const [selectedRegister, setSelectedRegister] = useState("all");
  const [auditDialog, setAuditDialog] = useState(false);
  const [auditForm, setAuditForm] = useState({ register_id: "" });
  const [cancelAuditDialog, setCancelAuditDialog] = useState(null);
  const { toast } = useToast();
  const { push, pushedIds, pushingId } = usePushToLP(toast);

  const adminOperator = useMemo(() => JSON.parse(sessionStorage.getItem("admin_operator") || "null"), []);
  const access = useMemo(() => getAdminAccess(adminOperator), [adminOperator]);

  const loadData = async () => {
    try {
      const [depositsData, registersData, advancesData, pickupsData, robberiesData, auditsData, alertsData, logData, tillsData] = await Promise.all([
        base44.entities.EODCashDeposit.list("-report_date"),
        base44.entities.Register.list(),
        base44.entities.CashAdvance.list("-created_date"),
        base44.entities.CashPickup.list("-created_date"),
        base44.entities.Robbery.list("-created_date"),
        base44.entities.CashAudit.list("-audit_date", 200),
        base44.entities.CashLimitAlert.list("-triggered_at", 100),
        base44.entities.RegisterLog.list("-created_date", 500),
        base44.entities.TillCheckout.list("-checkout_date"),
      ]);
      setRaw({
        deposits: depositsData,
        registers: registersData,
        advances: advancesData,
        pickups: pickupsData,
        robberies: robberiesData,
        audits: auditsData,
        alerts: alertsData,
        tillCheckouts: tillsData,
        giftCardCashouts: logData.filter((log) => log.detail && log.detail.includes("Gift card cash out")),
      });
      setLoading(false);
    } catch (e) {
      toast({ title: "Error loading data", variant: "destructive" });
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);
  useRealtimeSync(["CashAdvance", "CashPickup", "CashAudit", "EODCashDeposit", "Robbery", "TillCheckout", "RegisterLog"], loadData, { intervalMs: 15000 });

  // Every figure on this page is money, so nothing leaves the viewer's store scope.
  // Cash records carry only a register reference, so the scope is resolved through
  // the registers this person is allowed to see.
  const scoped = useMemo(() => {
    const registers = scopeRegisters(access, raw.registers);
    const scope = buildRegisterScope(access, raw.registers);
    return {
      registers,
      deposits: scopeByRegister(scope, raw.deposits),
      advances: scopeByRegister(scope, raw.advances),
      pickups: scopeByRegister(scope, raw.pickups),
      robberies: scopeByRegister(scope, raw.robberies),
      audits: scopeByRegister(scope, raw.audits),
      tillCheckouts: scopeByRegister(scope, raw.tillCheckouts),
      giftCardCashouts: scopeByRegister(scope, raw.giftCardCashouts),
    };
  }, [access, raw]);

  const totals = useMemo(() => computeCashTotals(scoped), [scoped]);

  const renderPushBtn = (rec, kind) => (
    <PushToLPButton recordId={rec.id} kind={kind} pushedIds={pushedIds} pushingId={pushingId} onPush={() => push(rec, kind)} />
  );

  const recordCashMove = async (kind) => {
    const form = kind === "advance" ? advanceForm : pickupForm;
    if (!form.register_id || !form.amount) {
      toast({ title: "Please fill in all required fields", variant: "destructive" });
      return;
    }
    try {
      const register = scoped.registers.find((r) => r.id === form.register_id);
      const entity = kind === "advance" ? base44.entities.CashAdvance : base44.entities.CashPickup;
      await entity.create({
        register_id: register?.register_id || "",
        register_name: register?.name || "",
        amount: parseFloat(form.amount),
        reason: form.reason,
        status: "approved",
      });
      setPrintData({
        type: kind,
        registerName: register?.name || "",
        registerId: register?.register_id || "",
        amount: form.amount,
        reason: form.reason,
        date: new Date().toISOString(),
      });
      toast({
        title: kind === "advance" ? "Cash advance recorded" : "Cash pickup recorded",
        description: `$${parseFloat(form.amount).toFixed(2)} ${kind === "advance" ? "to" : "from"} ${register?.name}`,
      });
      if (kind === "advance") { setAdvanceForm({ register_id: "", amount: "", reason: "" }); setAdvanceDialog(false); }
      else { setPickupForm({ register_id: "", amount: "", reason: "" }); setPickupDialog(false); }
      loadData();
    } catch (e) {
      toast({ title: kind === "advance" ? "Error creating advance" : "Error creating pickup", variant: "destructive" });
    }
  };

  const handleManualAudit = async () => {
    if (!auditForm.register_id) {
      toast({ title: "Please select a register", variant: "destructive" });
      return;
    }
    try {
      const register = scoped.registers.find((r) => r.id === auditForm.register_id);
      await base44.entities.CashAudit.create({
        register_id: register?.register_id || "",
        register_name: register?.name || "",
        operator_id: "",
        operator_name: "Manual Audit",
        total_counted: 0,
        expected_amount: 0,
        discrepancy: 0,
        audit_date: new Date().toISOString(),
        notes: "Manual audit initiated by admin",
        status: "pending",
      });
      toast({ title: "Manual audit created", description: `Audit created for ${register?.name}` });
      setAuditForm({ register_id: "" });
      setAuditDialog(false);
      loadData();
    } catch (e) {
      toast({ title: "Error creating audit", variant: "destructive" });
    }
  };

  const handleCancelAudit = async (auditId) => {
    try {
      await base44.entities.CashAudit.update(auditId, { status: "canceled" });
      toast({ title: "Audit canceled", description: "Audit has been marked as canceled" });
      setCancelAuditDialog(null);
      loadData();
    } catch (e) {
      toast({ title: "Error canceling audit", variant: "destructive" });
    }
  };

  if (loading) return <div className="p-6"><div className="animate-spin w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full" /></div>;

  return (
    <div className="p-4 sm:p-6 lg:p-8 w-full">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Cash Reconciliation</h1>
          <p className="text-gray-500 mt-2 text-sm sm:text-base">Track register cash deposits, longs, shorts, advances, and pickups</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={() => setShowCheckoutModal(true)}>Check Out Till</Button>
          <Button variant="outline" onClick={() => setShowCheckinModal(true)}>Check In Till</Button>
          <Button onClick={() => setAuditDialog(true)} className="bg-purple-600 hover:bg-purple-700 flex gap-2">
            <Plus className="w-4 h-4" /> Manual Audit
          </Button>
          <Button onClick={() => setAdvanceDialog(true)} className="bg-blue-600 hover:bg-blue-700 flex gap-2">
            <Plus className="w-4 h-4" /> Cash Advance
          </Button>
          <Button onClick={() => setPickupDialog(true)} className="bg-amber-600 hover:bg-amber-700 flex gap-2">
            <Minus className="w-4 h-4" /> Cash Pickup
          </Button>
        </div>
      </div>

      <CashTabBar
        activeTab={activeTab}
        onChange={setActiveTab}
        counts={{
          bags: scoped.tillCheckouts.filter((t) => t.status === "checked_out").length,
          emergency: scoped.robberies.length,
          audits: totals.pendingAudits,
        }}
      />

      {activeTab === "deposits" && (
        <CashDepositsTab deposits={scoped.deposits} selectedDate={selectedDate} onSelectDate={setSelectedDate} renderPushBtn={renderPushBtn} />
      )}

      {activeTab === "bags" && <OpenBagsPanel tillCheckouts={scoped.tillCheckouts} />}

      {activeTab === "audits" && (
        <CashAuditHistoryTab audits={scoped.audits} renderPushBtn={renderPushBtn} onCancelAudit={setCancelAuditDialog} />
      )}

      {activeTab === "history" && <CashHistoryTab advances={scoped.advances} pickups={scoped.pickups} />}

      {activeTab === "emergency" && <CashEmergencyTab robberies={scoped.robberies} />}

      {activeTab === "discrepancies" && (
        <CashDiscrepanciesTab
          deposits={scoped.deposits}
          tillCheckouts={scoped.tillCheckouts}
          selectedRegister={selectedRegister}
          onSelectRegister={setSelectedRegister}
          renderPushBtn={renderPushBtn}
        />
      )}

      {activeTab === "report" && <CashQuickReportTab records={scoped} totals={totals} onToast={toast} />}

      {activeTab === "export" && (
        <CashExportTab
          deposits={scoped.deposits}
          audits={scoped.audits}
          advances={scoped.advances}
          pickups={scoped.pickups}
          robberies={scoped.robberies}
        />
      )}

      <CashAdvanceDialog
        open={advanceDialog}
        onOpenChange={setAdvanceDialog}
        form={advanceForm}
        setForm={setAdvanceForm}
        registers={scoped.registers}
        onSubmit={() => recordCashMove("advance")}
      />
      <CashPickupDialog
        open={pickupDialog}
        onOpenChange={setPickupDialog}
        form={pickupForm}
        setForm={setPickupForm}
        registers={scoped.registers}
        onSubmit={() => recordCashMove("pickup")}
      />
      <ManualAuditDialog
        open={auditDialog}
        onOpenChange={setAuditDialog}
        form={auditForm}
        setForm={setAuditForm}
        registers={scoped.registers}
        onSubmit={handleManualAudit}
      />
      <CancelAuditDialog audit={cancelAuditDialog} onClose={() => setCancelAuditDialog(null)} onConfirm={handleCancelAudit} />
      <CashSlipDialog printData={printData} onClose={() => setPrintData(null)} />

      <TillCheckoutModal open={showCheckoutModal} onClose={() => setShowCheckoutModal(false)} registers={scoped.registers} onSuccess={loadData} />
      <TillCheckinModal
        open={showCheckinModal}
        onClose={() => setShowCheckinModal(false)}
        registers={scoped.registers}
        tillCheckouts={scoped.tillCheckouts}
        onSuccess={loadData}
      />
    </div>
  );
}