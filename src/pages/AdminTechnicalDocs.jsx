import React, { useState } from "react";
import { Link } from "react-router-dom";
import { BookOpen, Cpu, Plug, Server, Boxes, HardDrive, FileText, PenLine, Tv, Usb, Printer } from "lucide-react";
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
import CheckDualSideInvestigation from "@/components/techdocs/CheckDualSideInvestigation";

const SECTIONS = [
  { id: "hardware", label: "Fleet Hardware", icon: Cpu, blurb: "Terminals, keyboard, pole displays, scanners, printing and lane validation." },
  { id: "ports", label: "Terminal Ports", icon: Plug, blurb: "Rear-panel port maps and wiring tables per terminal model." },
  { id: "pxe", label: "PXE Controller", icon: Server, blurb: "Diskless boot controller: DHCP/TFTP, NFS roots, kiosk image and boot profiles." },
  { id: "relay", label: "Relay Deployment", icon: HardDrive, blurb: "Local Relay VM build: OS, networking, app, printing and telemetry." },
  { id: "check", label: "Cheque Station", icon: FileText, blurb: "MICR reading, endorsement franking, relay cheque routes and hardware diagnostics." },
  { id: "pinpad", label: "Customer Pinpad", icon: PenLine, blurb: "Ingenico signature capture, customer prompts, cart mirror, rating and relay pinpad routes." },
  { id: "poledisplay", label: "Pole Display", icon: Tv, blurb: "Customer line display: item/total mirror, amount due, change, and the relay pole module (DM-D110 via the printer)." },
  { id: "bridge", label: "Lane Serial Bridge", icon: Usb, blurb: "USB pinpads and poles published as TCP ports on the lane so the relay can drive them." },
  { id: "printerbridge", label: "USB Printer Bridge", icon: Printer, blurb: "Single-cable lane: the USB receipt printer published on the lane's IP, with the printer's Ethernet live as fallback." },
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
          {active === "pxe" && <PXEControllerGuide />}
          {active === "relay" && <RelayDeploymentReference />}
          {active === "check" && <CheckReaderReference />}
          {active === "check" && <CheckStationDiagnostics />}
          {active === "check" && <CheckDualSideInvestigation />}
          {active === "printerbridge" && <LanePrinterBridgeReference />}
          {active === "pinpad" && <PinpadReference />}
          {active === "poledisplay" && <PoleDisplayReference />}
          {active === "bridge" && <LaneSerialBridgeReference />}
          {active === "library" && <HardwareLibraryPanel />}
        </div>
      </div>
    </div>
  );
}