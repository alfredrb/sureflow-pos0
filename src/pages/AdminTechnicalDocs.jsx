import React, { useState } from "react";
import { Link } from "react-router-dom";
import { BookOpen } from "lucide-react";
import TechDocsNav from "@/components/techdocs/TechDocsNav";
import TechDocsSearchResults from "@/components/techdocs/TechDocsSearchResults";
import { searchDocumentation } from "@/lib/techDocSearchIndex";
import DocumentLibrary from "@/components/techdocs/DocumentLibrary";
import PinpadReference from "@/components/techdocs/PinpadReference";
import PoleDisplayReference from "@/components/techdocs/PoleDisplayReference";
import CustomerMonitorReference from "@/components/techdocs/CustomerMonitorReference";
import BootStatusReference from "@/components/techdocs/BootStatusReference";
import TerminalPortMap from "@/components/infrastructure/TerminalPortMap";
import PXEControllerGuide from "@/components/infrastructure/PXEControllerGuide";
import HardwareLibraryPanel from "@/components/infrastructure/HardwareLibraryPanel";
import HardwareFleetGuide from "@/components/infrastructure/HardwareFleetGuide";
import RelayDeploymentReference from "@/components/techdocs/RelayDeploymentReference";
import CheckReaderReference from "@/components/techdocs/CheckReaderReference";
import CheckStationDiagnostics from "@/components/techdocs/CheckStationDiagnostics";
import LaneSerialBridgeReference from "@/components/techdocs/LaneSerialBridgeReference";
import LanePrinterBridgeReference from "@/components/techdocs/LanePrinterBridgeReference";
import LaneDrawerBridgeReference from "@/components/techdocs/LaneDrawerBridgeReference";
import CheckDualSideInvestigation from "@/components/techdocs/CheckDualSideInvestigation";
import RelayUpdateWalkthrough from "@/components/techdocs/RelayUpdateWalkthrough";
import ScannerSuffixReference from "@/components/techdocs/ScannerSuffixReference";
import IBMScancodeReference from "@/components/techdocs/IBMScancodeReference";
import KeyturnMsrReference from "@/components/techdocs/KeyturnMsrReference";
import StoreHAClusterReference from "@/components/techdocs/StoreHAClusterReference";
import LaneMaintenanceReference from "@/components/techdocs/LaneMaintenanceReference";
import ControllerInstallerReference from "@/components/techdocs/ControllerInstallerReference";
import CloudUpdateReference from "@/components/techdocs/CloudUpdateReference";
import ControllerMenuReference from "@/components/techdocs/ControllerMenuReference";
import DebianControllerBuildGuide from "@/components/techdocs/DebianControllerBuildGuide";

export default function AdminTechnicalDocs() {
  const [active, setActive] = useState("hardware");
  const [query, setQuery] = useState("");

  const searching = !!query.trim();
  // Per-section hit counts, so the nav shows where the answers are while the results
  // themselves are read on the right.
  const matchCounts = (searchDocumentation(query) || []).reduce((acc, h) => {
    acc[h.sectionId] = (acc[h.sectionId] || 0) + 1;
    return acc;
  }, {});

  const openSection = (id) => {
    setActive(id);
    setQuery("");
  };

  return (
    <div className="w-full p-4 sm:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900 sm:text-3xl">
          <BookOpen className="h-7 w-7 text-blue-600" /> Technical Documentation
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Build a store from the four <span className="font-medium text-gray-700">Build &amp; Deploy</span> sections — the
          installer wizard now carries the files the deeper sections describe, so those are kept for troubleshooting. Live
          health and per-store checklists are on the{" "}
          <Link to="/admin/hardware" className="text-blue-600 hover:underline">Infrastructure Command Center</Link>.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
        <TechDocsNav active={active} onSelect={openSection} query={query} onQueryChange={setQuery} matchCounts={matchCounts} />

        {searching && (
          <div className="min-w-0">
            <TechDocsSearchResults query={query} onOpenSection={openSection} />
          </div>
        )}

        <div className={`min-w-0 space-y-4 ${searching ? "hidden" : ""}`}>
          {active === "hardware" && <HardwareFleetGuide />}
          {active === "ports" && (
            <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
              <TerminalPortMap />
            </div>
          )}
          {active === "debianbuild" && <DebianControllerBuildGuide />}
          {active === "installer" && <ControllerInstallerReference />}
          {active === "documents" && <DocumentLibrary />}
          {active === "controllermenu" && <ControllerMenuReference />}
          {active === "pxe" && <PXEControllerGuide />}
          {active === "hacluster" && <StoreHAClusterReference />}
          {active === "maintenance" && <LaneMaintenanceReference />}
          {active === "relay" && <RelayDeploymentReference />}
          {active === "cloudupdate" && <CloudUpdateReference />}
          {active === "relayupdate" && <RelayUpdateWalkthrough />}
          {active === "check" && <CheckReaderReference />}
          {active === "check" && <CheckStationDiagnostics />}
          {active === "check" && <CheckDualSideInvestigation />}
          {active === "printerbridge" && <LanePrinterBridgeReference />}
          {active === "drawerbridge" && <LaneDrawerBridgeReference />}
          {active === "pinpad" && <PinpadReference />}
          {active === "poledisplay" && <PoleDisplayReference />}
          {active === "customermonitor" && <CustomerMonitorReference />}
          {active === "bootstatus" && <BootStatusReference />}
          {active === "bridge" && <LaneSerialBridgeReference />}
          {active === "scanner" && <ScannerSuffixReference />}
          {active === "keyboard" && <IBMScancodeReference />}
          {active === "keyturnmsr" && <KeyturnMsrReference />}
          {active === "library" && <HardwareLibraryPanel />}
        </div>
      </div>
    </div>
  );
}