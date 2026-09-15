import React, { useState } from "react";
import { Printer, Gauge, Wallet, Eye, CreditCard, Monitor } from "lucide-react";
import TechDiagCard from "@/components/pos/tech/TechDiagCard";
import TechDiagTile from "@/components/pos/tech/TechDiagTile";
import { printTestSlip } from "@/lib/testSlip";
import { readPrinterHealth } from "@/lib/printerHealth";
import { readDrawerState } from "@/lib/drawerStatus";
import { kickDrawer } from "@/lib/drawerKick";
import { pinpadDisplay, pinpadClear, poleShow, poleIdle } from "@/lib/relayClient";

// Every test here drives the REAL peripheral through the store relay, the same path
// a sale uses. That is the point of a technician panel: a browser print dialog proves
// nothing about the receipt station, and a toast saying "kick sent" proves nothing
// about the drawer solenoid.
export default function PeripheralDiagCard({ register, operator, writeLog }) {
  const [busy, setBusy] = useState(null);
  const [res, setRes] = useState({});

  const run = async (key, fn) => {
    setBusy(key);
    setRes((p) => ({ ...p, [key]: { status: null, detail: "" } }));
    try {
      const detail = await fn();
      setRes((p) => ({ ...p, [key]: { status: "pass", detail } }));
    } catch (e) {
      setRes((p) => ({ ...p, [key]: { status: "fail", detail: e.message || "failed" } }));
    }
    setBusy(null);
  };

  const at = (k) => res[k] || {};

  const testSlip = () => run("slip", async () => {
    await printTestSlip(register?.register_id, operator);
    writeLog?.("no_sale", `Printer test slip by technician ${operator?.full_name || ""}`);
    return `Test pattern sent to ${register?.printer_ip || "relay default printer"}`;
  });

  const printerHealth = () => run("health", async () => {
    const h = await readPrinterHealth();
    if (!h) throw new Error("Printer did not answer the status probe");
    const flags = [h.online ? "online" : "OFFLINE", h.error ? "ERROR" : "no errors",
      h.paper_out ? "PAPER OUT" : h.paper_low ? "paper low" : "paper ok"];
    return flags.join(" · ");
  });

  const drawerKick = () => run("kick", async () => {
    const ok = await kickDrawer("manual");
    if (!ok) throw new Error("Relay could not fire the drawer");
    writeLog?.("no_sale", `Cash drawer kick test by technician ${operator?.full_name || ""}`);
    return `Kick sent via ${register?.drawer_transport === "usb_direct" ? "lane drawer bridge" : "printer DK port"}`;
  });

  const drawerSense = () => run("sense", async () => {
    const state = await readDrawerState();
    if (state === "unknown") throw new Error("Printer did not report the drawer sense line");
    return `Drawer is currently ${state.toUpperCase()}`;
  });

  const pinpadTest = () => run("pinpad", async () => {
    if (!register?.pinpad_model) throw new Error("No pinpad fitted on this lane");
    const payload = { pinpad_ip: register.pinpad_ip || "", profile: register.pinpad_model, title: "PINPAD TEST OK" };
    await pinpadDisplay(payload);
    await new Promise((r) => setTimeout(r, 1500));
    await pinpadClear(payload);
    return `${register.pinpad_model} accepted a screen write at ${register.pinpad_ip || "—"}`;
  });

  const poleTest = () => run("pole", async () => {
    if (!register?.pole_display_model) throw new Error("No pole display fitted on this lane");
    const payload = { profile: register.pole_display_model, pole_ip: register.pole_display_ip || register.ip_address || "" };
    await poleShow({ ...payload, lines: ["*** POLE TEST ***", "ALL 20 COLS OK 1234"] });
    await new Promise((r) => setTimeout(r, 2000));
    await poleIdle(payload);
    return `${register.pole_display_model} drew both 2x20 lines`;
  });

  return (
    <TechDiagCard icon={Monitor} title="Peripheral Diagnostics" hint="live via store relay">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        <TechDiagTile icon={Printer} label="Print Test Slip" onClick={testSlip} busy={busy === "slip"} {...at("slip")} />
        <TechDiagTile icon={Gauge} label="Printer Health" onClick={printerHealth} busy={busy === "health"} {...at("health")} />
        <TechDiagTile icon={Wallet} label="Drawer Kick" onClick={drawerKick} busy={busy === "kick"} {...at("kick")} />
        <TechDiagTile icon={Eye} label="Drawer Sense" onClick={drawerSense} busy={busy === "sense"} {...at("sense")} />
        <TechDiagTile icon={CreditCard} label="Pinpad Write" onClick={pinpadTest} busy={busy === "pinpad"}
          disabled={!register?.pinpad_model} {...at("pinpad")} />
        <TechDiagTile icon={Monitor} label="Pole Display" onClick={poleTest} busy={busy === "pole"}
          disabled={!register?.pole_display_model} {...at("pole")} />
      </div>
    </TechDiagCard>
  );
}