import React, { useState, useEffect } from "react";
import { base44 } from "@/api/data";
import { logAuditEvent } from "@/lib/auditLogger";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, Check, AlertTriangle } from "lucide-react";
import { buildPxelinuxConfig, buildDnsmasqEntry, buildPeripheralRules, buildXorgConfig, buildImagePackages, matchedProfiles, pxeConfigFileName, bootImageLabel, isPxeRegister } from "@/lib/pxeBootstrap";

function CodeBlock({ title, path, code }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-200">
        <div>
          <p className="text-sm font-medium text-gray-800">{title}</p>
          {path && <p className="text-xs text-gray-400 font-mono">{path}</p>}
        </div>
        <Button variant="outline" size="sm" onClick={copy}>
          {copied ? <Check className="w-3 h-3 mr-1 text-emerald-600" /> : <Copy className="w-3 h-3 mr-1" />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <pre className="p-3 text-xs font-mono text-gray-700 whitespace-pre-wrap bg-white overflow-x-auto">{code}</pre>
    </div>
  );
}

export default function PXEBootstrapDialog({ register, open, onOpenChange }) {
  const [controllerIp, setControllerIp] = useState("10.0.30.10");
  const [relayUrl, setRelayUrl] = useState("");
  const [profiles, setProfiles] = useState([]);

  useEffect(() => {
    if (!open || !register) return;
    let cancelled = false;
    (async () => {
      const all = await base44.entities.HardwareLibrary.list();
      if (cancelled) return;
      const active = all.filter(p => p.active !== false);
      setProfiles(active);
      // The relay usually sits on the backend VLAN, not on the PXE controller, so
      // the terminal's boot entry has to point at the store's registered relay URL.
      if (register.store_id) {
        const stores = await base44.entities.Store.filter({ store_number: register.store_id });
        if (!cancelled && stores[0]?.relay_url) setRelayUrl(stores[0].relay_url);
      }
      const matched = matchedProfiles(register, active);
      logAuditEvent({
        action: "Generated PXE Bootstrap Artifacts",
        category: "register",
        description: `Generated PXE boot entry, DHCP reservation and peripheral rules for ${register.name} (${register.register_id}) using driver profiles: ${matched.map(p => p.model).join(", ") || "none matched"}.`,
        page: "/admin/registers",
      });
    })();
    return () => { cancelled = true; };
  }, [open, register?.id]);

  if (!register) return null;
  const matched = matchedProfiles(register, profiles);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>PXE Bootstrap — {register.name} ({register.register_id})</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pb-4">
          <div className="text-sm text-gray-600 bg-gray-50 border border-gray-100 rounded-xl p-3 space-y-1">
            <div className="flex justify-between"><span className="text-gray-400">Boot image</span><span>{bootImageLabel(register)}</span></div>
            <div className="flex justify-between"><span className="text-gray-400">MAC identity</span><span className="font-mono text-xs">{register.mac_address || "unset"}</span></div>
            <div className="flex justify-between"><span className="text-gray-400">Terminal</span><span>{register.terminal_model || "—"}</span></div>
            <div className="flex justify-between"><span className="text-gray-400">Keyboard</span><span>{register.keyboard_model || "—"}</span></div>
            <div className="flex justify-between"><span className="text-gray-400">Scanner</span><span>{register.scanner_model || "—"} ({register.scanner_interface || "usb_hid"})</span></div>
          </div>

          {!register.mac_address && (
            <div className="flex items-start gap-2 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-3">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <p>No MAC address set on this register — the controller can't pin a boot file to this terminal until you add one.</p>
            </div>
          )}

          {!isPxeRegister(register) && (
            <div className="text-sm text-gray-600 bg-blue-50 border border-blue-100 rounded-xl p-3">
              This register is set to boot from local disk. Choose a PXE boot profile on the register to serve it a diskless image.
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Store Controller IP</label>
              <Input value={controllerIp} onChange={e => setControllerIp(e.target.value)} className="font-mono text-sm" />
              <p className="text-xs text-gray-400 mt-1">Serves the kernel and NFS root on the PXE VLAN.</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Relay URL</label>
              <Input
                value={relayUrl}
                onChange={e => setRelayUrl(e.target.value)}
                placeholder={`http://${controllerIp}:3000`}
                className="font-mono text-sm"
              />
              <p className="text-xs text-gray-400 mt-1">
                {relayUrl ? "From this store's registered relay." : "Blank = same host as the controller."}
              </p>
            </div>
          </div>

          <div className="border border-gray-100 bg-gray-50 rounded-xl p-3">
            <p className="text-xs uppercase tracking-wide text-gray-400 mb-2">Driver profiles applied</p>
            {matched.length ? (
              <div className="flex flex-wrap gap-2">
                {matched.map(p => (
                  <span key={p.id} className="text-xs px-2 py-1 rounded-md bg-white border border-gray-200 text-gray-700">
                    {p.model} <span className="text-gray-400">· {p.device_type}</span>
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">No profiles in the Hardware Driver Library match this register's models — the boot entry falls back to image defaults.</p>
            )}
          </div>

          <CodeBlock title="PXE boot entry" path={`/srv/tftp/${pxeConfigFileName(register)}`} code={buildPxelinuxConfig(register, controllerIp, profiles, relayUrl)} />
          <CodeBlock title="DHCP reservation (PXE VLAN)" path="/etc/dnsmasq.d/sureflow-pxe.conf" code={buildDnsmasqEntry(register)} />
          <CodeBlock title="Peripheral rules" path="/etc/udev/rules.d/70-sureflow.rules" code={buildPeripheralRules(register, profiles)} />
          <CodeBlock title="Xorg input config" path="/etc/X11/xorg.conf.d/90-sureflow-input.conf" code={buildXorgConfig(register, profiles)} />
          <CodeBlock title="Image packages" path="build-image.sh (peripheral packages)" code={buildImagePackages(register, profiles)} />
        </div>
      </DialogContent>
    </Dialog>
  );
}