import React, { useState } from "react";
import { Link } from "react-router-dom";
import { BookOpen, Cpu, Plug, Server, Boxes, HardDrive, FileText, PenLine, Tv, Usb, Printer, Rocket, ScanLine, KeyRound, Archive, Layers, MoonStar, Wand2, GitBranch } from "lucide-react";
import PinpadReference from "@/components/techdocs/PinpadReference";
import PoleDisplayReference from "@/components/techdocs/PoleDisplayReference";
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

const SECTIONS = [
  { id: "hardware", label: "Fleet Hardware", icon: Cpu, blurb: "Terminals, keyboard, pole displays, scanners, printing and lane validation." },
  { id: "ports", label: "Terminal Ports", icon: Plug, blurb: "Rear-panel port maps and wiring tables per terminal model." },
  { id: "installer", label: "Controller Installer", icon: Wand2, blurb: "Guided whiptail build of a store controller, with this store's answer sheet." },
  { id: "pxe", label: "PXE Controller", icon: Server, blurb: "Diskless boot controller: DHCP/TFTP, NFS roots, kiosk image and boot profiles." },
  { id: "hacluster", label: "Controller Redundancy", icon: Layers, blurb: "Dual controller pair: PXE + NFS + relay on both boxes, DRBD mirror, floating VIP and automatic promotion." },
  { id: "maintenance", label: "Nightly Maintenance", icon: MoonStar, blurb: "Midnight lane reboot and update window: staggered batches, busy-lane deferral, and the relay poller." },
  { id: "relay", label: "Relay Deployment", icon: HardDrive, blurb: "Local Relay VM build: OS, networking, app, printing and telemetry." },
  { id: "cloudupdate", label: "Cloud-Pushed Updates", icon: GitBranch, blurb: "Pinned git ref checked out by the controller itself during its maintenance window, health-gated with automatic rollback." },
  { id: "relayupdate", label: "Relay Feature Update", icon: Rocket, blurb: "Step-by-step upgrade of an existing relay: new modules, routes, lane bridges and verification." },
  { id: "check", label: "Cheque Station", icon: FileText, blurb: "MICR reading, endorsement franking, relay cheque routes and hardware diagnostics." },
  { id: "pinpad", label: "Customer Pinpad", icon: PenLine, blurb: "Ingenico signature capture, customer prompts, cart mirror, rating and relay pinpad routes." },
  { id: "poledisplay", label: "Pole Display", icon: Tv, blurb: "Customer line display: item/total mirror, amount due, change, and the relay pole module (DM-D110 via the printer)." },
  { id: "bridge", label: "Lane Serial Bridge", icon: Usb, blurb: "USB pinpads and poles published as TCP ports on the lane so the relay can drive them." },
  { id: "printerbridge", label: "USB Printer Bridge", icon: Printer, blurb: "Single-cable lane: the USB receipt printer published on the lane's IP, with the printer's Ethernet live as fallback." },
  { id: "drawerbridge", label: "USB Drawer Bridge", icon: Archive, blurb: "Reserved contingency: a native USB cash drawer published on the lane, if the SDL drawer variant is ever discontinued." },
  { id: "scanner", label: "Barcode Scanner", icon: ScanLine, blurb: "Auto-Enter suffix programming so a scan rings the item up without a key press." },
  { id: "keyboard", label: "POS Keyboard Scan Codes", icon: BookOpen, blurb: "Official IBM GC30-3623 scan-code tables for the ANPOS keyboard family, mapped to the remapper workflow." },
  { id: "keyturnmsr", label: "Keyturn & MSR", icon: KeyRound, blurb: "The barrel lock (SOD gating, no scancode) and the magstripe reader — why neither belongs in the key remapper." },
  { id: "library", label: "Driver Library", icon: Boxes, blurb: "Per-model driver profiles applied to the diskless image at build time." },
];

export default function AdminTechnicalDocs() {
  const [active, setActive] = useState("hardware");

  return (
    <div className="p-4 sm:p-6 lg:p-8 w-full">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-2">
          <BookOpen className="w-7 h-7 text-blue-600" /> Technical Documentation
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Engineering reference for the SureFlow estate — lane hardware, diskless boot, and store relay infrastructure.
          Live health and per-store checklists live on the{" "}
          <Link to="/admin/hardware" className="text-blue-600 hover:underline">Infrastructure Command Center</Link>.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">
        <nav className="space-y-1.5 lg:sticky lg:top-6 lg:self-start">
          {SECTIONS.map((s) => {
            const Icon = s.icon;
            const isActive = active === s.id;
            return (
              <button
                key={s.id}
                onClick={() => setActive(s.id)}
                className={`w-full text-left p-3 rounded-xl border transition-colors ${
                  isActive ? "bg-blue-50 border-blue-200" : "bg-white border-gray-100 hover:border-gray-200"
                }`}
              >
                <span className="flex items-center gap-2">
                  <Icon className={`w-4 h-4 ${isActive ? "text-blue-600" : "text-gray-400"}`} />
                  <span className={`text-sm font-semibold ${isActive ? "text-blue-700" : "text-gray-800"}`}>{s.label}</span>
                </span>
                <span className="block text-[11px] text-gray-400 mt-1 leading-snug">{s.blurb}</span>
              </button>
            );
          })}
        </nav>

        <div className="space-y-4 min-w-0">
          {active === "hardware" && <HardwareFleetGuide />}
          {active === "ports" && (
            <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
              <TerminalPortMap />
            </div>
          )}
          {active === "installer" && <ControllerInstallerReference />}
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