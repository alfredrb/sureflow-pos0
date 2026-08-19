import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/data";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { ShieldAlert, RefreshCw, LayoutDashboard, Scale, FolderSearch, Sparkles, FileText, ListTodo, TrendingDown, Shield, Database, ChevronLeft, ChevronRight, AlertTriangle, Clock, RotateCcw, PackageX, ScanLine, BarChart3, Utensils, Archive, Hash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import moment from "moment";
import LossOverviewPanel from "@/components/lossprevention/LossOverviewPanel";
import ShortsLongsPanel from "@/components/lossprevention/ShortsLongsPanel";
import InvestigationsPanel from "@/components/lossprevention/InvestigationsPanel";
import AISuggestionsPanel from "@/components/lossprevention/AISuggestionsPanel";
import DocumentsPanel from "@/components/lossprevention/DocumentsPanel";
import TasksPanel from "@/components/lossprevention/TasksPanel";
import InvestigationDetailDialog from "@/components/lossprevention/InvestigationDetailDialog";
import StolenItemsTrendChart from "@/components/lossprevention/StolenItemsTrendChart";
import MerchandiseProtectionPanel from "@/components/lossprevention/MerchandiseProtectionPanel";
import DataViewerPanel from "@/components/lossprevention/DataViewerPanel";
import HighRiskEventsPanel from "@/components/lossprevention/HighRiskEventsPanel";
import TimeTheftPanel from "@/components/lossprevention/TimeTheftPanel";
import NoReceiptWorkbenchTab from "@/components/lossprevention/NoReceiptWorkbenchTab";
import ClaimsAuditPanel from "@/components/lossprevention/ClaimsAuditPanel";
import SerializedInventoryPanel from "@/components/lossprevention/SerializedInventoryPanel";
import ShrinkageReportPanel from "@/components/lossprevention/ShrinkageReportPanel";
import MealExceptionsPanel from "@/components/lossprevention/MealExceptionsPanel";
import EvidenceLockerPanel from "@/components/lossprevention/EvidenceLockerPanel";
import ActionCodeAuditPanel from "@/components/lossprevention/ActionCodeAuditPanel";

export default function AdminLossPrevention() {
  const [logs, setLogs] = useState([]);
  const [txns, setTxns] = useState([]);
  const [audits, setAudits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(7);
  const [fromDate, setFromDate] = useState(moment().subtract(6, "days").format("YYYY-MM-DD"));
  const [toDate, setToDate] = useState(moment().format("YYYY-MM-DD"));
  const [tab, setTab] = useState("overview");
  const [investigation, setInvestigation] = useState(null);
  const [invRefresh, setInvRefresh] = useState(0);
  const [disabledEvents, setDisabledEvents] = useState([]);
  const [settingsRecId, setSettingsRecId] = useState(null);
  const tabRef = useRef(null);
  const { toast } = useToast();

  const scrollTabs = (dir) => {
    const el = tabRef.current; if (!el) return;
    el.scrollBy({ left: dir * 240, behavior: "smooth" });
  };

  const toggleCategory = async (cat) => {
    const next = disabledEvents.includes(cat) ? disabledEvents.filter(c => c !== cat) : [...disabledEvents, cat];
    setDisabledEvents(next);
    try {
      if (settingsRecId) {
        await base44.entities.StoreSettings.update(settingsRecId, { lp_disabled_events: next });
      } else {
        const created = await base44.entities.StoreSettings.create({ store_name: "Supermart", lp_disabled_events: next });
        setSettingsRecId(created.id);
      }
    } catch (e) {
      toast({ title: "Could not save setting", variant: "destructive" });
    }
  };

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [logData, txnData, auditData] = await Promise.all([
        base44.entities.RegisterLog.list("-created_date", 500),
        base44.entities.Transaction.list("-created_date", 500),
        base44.entities.CashAudit.list("-audit_date", 300),
      ]);
      setLogs(logData);
      setTxns(txnData);
      setAudits(auditData);
      try {
        const settings = await base44.entities.StoreSettings.list("-created_date", 1);
        const s = settings[0];
        if (s) {
          setSettingsRecId(s.id);
          setDisabledEvents(Array.isArray(s.lp_disabled_events) ? s.lp_disabled_events : []);
        } else {
          setDisabledEvents([]);
        }
      } catch (_) {}
    } catch (e) {
      if (!silent) toast({ title: "Error", description: "Failed to load data", variant: "destructive" });
    }
    if (!silent) setLoading(false);
  };

  useEffect(() => { load(); }, []);
  useRealtimeSync("RegisterLog", load, { intervalMs: 30000 });

  const setQuickRange = (n) => {
    setDays(n);
    setFromDate(moment().subtract(n - 1, "days").format("YYYY-MM-DD"));
    setToDate(moment().format("YYYY-MM-DD"));
  };

  const startInvestigation = (partial) => setInvestigation({ __new: true, ...partial });
  const openInvestigation = (inv) => setInvestigation(inv);
  const onInvestigationSaved = () => { setInvestigation(null); setInvRefresh(r => r + 1); };
  const onInvestigationAdded = () => setInvRefresh(r => r + 1);

  if (loading) return (
    <div className="flex items-center justify-center h-full p-10">
      <div className="w-8 h-8 border-4 border-amber-200 border-t-amber-600 rounded-full animate-spin" />
    </div>
  );

  const TABS = [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "events", label: "High-Risk Events", icon: AlertTriangle },
    { id: "actioncodes", label: "Action Codes", icon: Hash },
    { id: "shorts", label: "Shorts & Longs", icon: Scale },
    { id: "investigations", label: "Investigations", icon: FolderSearch },
    { id: "theft", label: "Theft Trends", icon: TrendingDown },
    { id: "shrinkage", label: "Shrinkage", icon: BarChart3 },
    { id: "ai", label: "AI Suggestions", icon: Sparkles },
    { id: "documents", label: "Documents", icon: FileText },
    { id: "evidence", label: "Evidence Locker", icon: Archive },
    { id: "tasks", label: "Tasks", icon: ListTodo },
    { id: "time", label: "Time Theft", icon: Clock },
    { id: "noreturns", label: "No-Receipt Returns", icon: RotateCcw },
    { id: "claims", label: "Claims Audit", icon: PackageX },
    { id: "serialized", label: "Serialized Inventory", icon: ScanLine },
    { id: "mpp", label: "Merch Protection", icon: Shield },
    { id: "meals", label: "Meal Exceptions", icon: Utensils },
    { id: "data", label: "Data Viewer", icon: Database },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8 w-full space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-2"><ShieldAlert className="w-7 h-7 text-amber-600" /> Loss Prevention Workbench</h1>
          <p className="text-gray-500 text-sm mt-1">Investigate shorts, longs, voids, overrides, and refunds — and track open cases.</p>
        </div>
        <Button variant="outline" onClick={() => load(true)}><RefreshCw className="w-4 h-4 mr-2" /> Refresh</Button>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4 flex flex-col sm:flex-row sm:items-end gap-3">
        <div className="flex-1 grid grid-cols-2 sm:grid-cols-2 gap-3">
          <div><Label>From</Label><Input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} /></div>
          <div><Label>To</Label><Input type="date" value={toDate} onChange={e => setToDate(e.target.value)} /></div>
        </div>
        <div className="flex gap-2">
          {[1, 7, 30].map(n => (
            <Button key={n} variant={days === n ? "default" : "outline"} size="sm" onClick={() => setQuickRange(n)} className={days === n ? "bg-amber-600 hover:bg-amber-500" : ""}>{n === 1 ? "Today" : `${n} days`}</Button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-1 border-b border-gray-200">
        <button onClick={() => scrollTabs(-1)} className="p-1.5 rounded-md text-gray-400 hover:text-amber-600 hover:bg-amber-50 flex-shrink-0" title="Scroll tabs left"><ChevronLeft className="w-5 h-5" /></button>
        <div ref={tabRef} className="flex gap-1 overflow-x-auto scrollbar-hide flex-1">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors ${tab === t.id ? "border-amber-600 text-amber-700" : "border-transparent text-gray-500 hover:text-gray-800"}`}
            >
              <t.icon className="w-4 h-4" /> {t.label}
            </button>
          ))}
        </div>
        <button onClick={() => scrollTabs(1)} className="p-1.5 rounded-md text-gray-400 hover:text-amber-600 hover:bg-amber-50 flex-shrink-0" title="Scroll tabs right"><ChevronRight className="w-5 h-5" /></button>
      </div>

      {tab === "overview" && <LossOverviewPanel logs={logs} txns={txns} fromDate={fromDate} toDate={toDate} onStartInvestigation={startInvestigation} disabledEvents={disabledEvents} />}
      {tab === "events" && <HighRiskEventsPanel logs={logs} txns={txns} fromDate={fromDate} toDate={toDate} onStartInvestigation={startInvestigation} disabledEvents={disabledEvents} onToggleCategory={toggleCategory} />}
      {tab === "actioncodes" && <ActionCodeAuditPanel logs={logs} fromDate={fromDate} toDate={toDate} onStartInvestigation={startInvestigation} />}
      {tab === "shorts" && <ShortsLongsPanel audits={audits} fromDate={fromDate} toDate={toDate} onStartInvestigation={startInvestigation} />}
      {tab === "investigations" && <InvestigationsPanel refreshKey={invRefresh} onOpenInvestigation={openInvestigation} onNewInvestigation={() => startInvestigation({})} />}
      {tab === "theft" && <StolenItemsTrendChart rangeDays={30} />}
      {tab === "shrinkage" && <ShrinkageReportPanel fromDate={fromDate} toDate={toDate} />}
      {tab === "ai" && <AISuggestionsPanel logs={logs} txns={txns} audits={audits} fromDate={fromDate} toDate={toDate} onStartInvestigation={startInvestigation} />}
      {tab === "documents" && <DocumentsPanel logs={logs} audits={audits} />}
      {tab === "evidence" && <EvidenceLockerPanel />}
      {tab === "tasks" && <TasksPanel />}
      {tab === "time" && <TimeTheftPanel fromDate={fromDate} toDate={toDate} onStartInvestigation={startInvestigation} />}
      {tab === "noreturns" && <NoReceiptWorkbenchTab txns={txns} fromDate={fromDate} toDate={toDate} onStartInvestigation={startInvestigation} />}
      {tab === "claims" && <ClaimsAuditPanel fromDate={fromDate} toDate={toDate} />}
      {tab === "serialized" && <SerializedInventoryPanel fromDate={fromDate} toDate={toDate} />}
      {tab === "mpp" && <MerchandiseProtectionPanel />}
      {tab === "meals" && <MealExceptionsPanel fromDate={fromDate} toDate={toDate} onStartInvestigation={startInvestigation} />}
      {tab === "data" && <DataViewerPanel onAdded={onInvestigationAdded} />}

      <InvestigationDetailDialog value={investigation} onClose={() => setInvestigation(null)} onSaved={onInvestigationSaved} logs={logs} txns={txns} audits={audits} />
    </div>
  );
}