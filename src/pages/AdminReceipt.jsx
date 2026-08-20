import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Save, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";
import ReceiptPreview4690 from "@/components/receipt/ReceiptPreview4690";

export default function AdminReceipt() {
  const [config, setConfig] = useState(null);
  const [configId, setConfigId] = useState(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    (async () => {
      const configs = await base44.entities.ReceiptConfig.list();
      if (configs.length > 0) { setConfig(configs[0]); setConfigId(configs[0].id); }
      else {
        const defaults = { store_name: "My Store", store_address: "", store_phone: "", header_line_1: "", header_line_2: "", footer_line_1: "Thank you!", footer_line_2: "", show_operator_name: true, show_date_time: true, show_register_id: true, show_tax_breakdown: true, show_barcode: false, transaction_code_format: "barcode", show_discounts: true };
        setConfig(defaults);
      }
      setLoading(false);
    })();
  }, []);

  const save = async () => {
    try {
      const data = { ...config }; delete data.id; delete data.created_date; delete data.updated_date; delete data.created_by_id;
      if (configId) await base44.entities.ReceiptConfig.update(configId, data);
      else { const created = await base44.entities.ReceiptConfig.create(data); setConfigId(created.id); }
      toast({ title: "Receipt settings saved" });
    } catch (e) {
      toast({ title: "Error saving", variant: "destructive" });
    }
  };

  if (loading || !config) return <div className="flex items-center justify-center h-full"><div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" /></div>;

  return (
    <div className="p-4 sm:p-6 lg:p-8 w-full">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Receipt Customizer</h1>
          <p className="text-gray-500 text-sm mt-1">Configure receipt header, footer, and display options</p>
        </div>
        <Button onClick={save} className="bg-blue-600 hover:bg-blue-700 w-full sm:w-auto"><Save className="w-4 h-4 mr-2" /> Save</Button>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Form */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
            <h2 className="font-semibold text-gray-900">Store Information</h2>
            <div><label className="text-sm font-medium text-gray-700 mb-1 block">Store Name</label><Input value={config.store_name} onChange={e => setConfig({ ...config, store_name: e.target.value })} /></div>
            <div><label className="text-sm font-medium text-gray-700 mb-1 block">Address</label><Input value={config.store_address} onChange={e => setConfig({ ...config, store_address: e.target.value })} /></div>
            <div><label className="text-sm font-medium text-gray-700 mb-1 block">Phone</label><Input value={config.store_phone} onChange={e => setConfig({ ...config, store_phone: e.target.value })} /></div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
            <h2 className="font-semibold text-gray-900">Header & Footer</h2>
            <div><label className="text-sm font-medium text-gray-700 mb-1 block">Header Line 1</label><Input value={config.header_line_1} onChange={e => setConfig({ ...config, header_line_1: e.target.value })} /></div>
            <div><label className="text-sm font-medium text-gray-700 mb-1 block">Header Line 2</label><Input value={config.header_line_2} onChange={e => setConfig({ ...config, header_line_2: e.target.value })} /></div>
            <div><label className="text-sm font-medium text-gray-700 mb-1 block">Footer Line 1</label><Input value={config.footer_line_1} onChange={e => setConfig({ ...config, footer_line_1: e.target.value })} /></div>
            <div><label className="text-sm font-medium text-gray-700 mb-1 block">Footer Line 2</label><Input value={config.footer_line_2} onChange={e => setConfig({ ...config, footer_line_2: e.target.value })} /></div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
            <h2 className="font-semibold text-gray-900">Display Options</h2>
            <p className="text-xs text-gray-500 -mt-2">The receipt layout always prints the ST# / OP# / REG# identity line, the tax line, and the date, so only the transaction barcode is optional.</p>
            {[
              { key: "show_barcode", label: "Show Transaction Barcode" },
            ].map(opt => (
              <div key={opt.key} className="flex items-center justify-between">
                <label className="text-sm text-gray-700">{opt.label}</label>
                <Switch checked={config[opt.key]} onCheckedChange={v => setConfig({ ...config, [opt.key]: v })} />
              </div>
            ))}

            <div className={config.show_barcode === false ? "opacity-40 pointer-events-none" : ""}>
              <label className="text-sm text-gray-700 block mb-1">Transaction Code Format</label>
              <p className="text-xs text-gray-500 mb-2">Both formats scan on the lane's 2D imager. QR holds up better on creased or photographed receipts; CODE128 matches legacy slips.</p>
              <div className="flex gap-2">
                {[
                  { v: "barcode", label: "Barcode (CODE128)" },
                  { v: "qr", label: "QR Code" },
                ].map(o => (
                  <button
                    key={o.v}
                    onClick={() => setConfig({ ...config, transaction_code_format: o.v })}
                    className={`flex-1 text-xs font-medium px-3 py-2 rounded-lg border transition-colors ${
                      (config.transaction_code_format || "barcode") === o.v
                        ? "bg-blue-600 border-blue-600 text-white"
                        : "bg-white border-gray-200 text-gray-600 hover:border-gray-300"
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Preview */}
        <div className="lg:sticky lg:top-8 self-start">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h2 className="font-semibold text-gray-900 mb-1">Receipt Preview</h2>
            <p className="text-xs text-gray-500 mb-4">Fixed-column layout (42 chars, 80mm paper) — matches the printed receipt exactly. Toggle a scenario to preview it.</p>
            <ReceiptPreview4690 config={config} />
          </div>
        </div>
      </div>
    </div>
  );
}