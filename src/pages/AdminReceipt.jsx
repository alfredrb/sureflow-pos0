import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Save, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";

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
        const defaults = { store_name: "My Store", store_address: "", store_phone: "", header_line_1: "", header_line_2: "", footer_line_1: "Thank you!", footer_line_2: "", show_operator_name: true, show_date_time: true, show_register_id: true, show_tax_breakdown: true, show_barcode: false };
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
    <div className="p-6 lg:p-8 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Receipt Customizer</h1>
          <p className="text-gray-500 text-sm mt-1">Configure receipt header, footer, and display options</p>
        </div>
        <Button onClick={save} className="bg-blue-600 hover:bg-blue-700"><Save className="w-4 h-4 mr-2" /> Save</Button>
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
            {[
              { key: "show_operator_name", label: "Show Operator Name" },
              { key: "show_date_time", label: "Show Date & Time" },
              { key: "show_register_id", label: "Show Register ID" },
              { key: "show_tax_breakdown", label: "Show Tax Breakdown" },
              { key: "show_barcode", label: "Show Barcode" },
            ].map(opt => (
              <div key={opt.key} className="flex items-center justify-between">
                <label className="text-sm text-gray-700">{opt.label}</label>
                <Switch checked={config[opt.key]} onCheckedChange={v => setConfig({ ...config, [opt.key]: v })} />
              </div>
            ))}
          </div>
        </div>

        {/* Preview */}
        <div className="lg:sticky lg:top-8 self-start">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h2 className="font-semibold text-gray-900 mb-4">Receipt Preview</h2>
            <div className="bg-gray-50 rounded-xl p-6 font-mono text-xs leading-relaxed max-w-[300px] mx-auto border border-gray-200">
              <div className="text-center space-y-0.5 mb-3">
                <p className="font-bold text-sm">{config.store_name || "Store Name"}</p>
                {config.store_address && <p>{config.store_address}</p>}
                {config.store_phone && <p>{config.store_phone}</p>}
                {config.header_line_1 && <p className="mt-1">{config.header_line_1}</p>}
                {config.header_line_2 && <p>{config.header_line_2}</p>}
              </div>
              <div className="border-t border-dashed border-gray-300 my-2" />
              {config.show_date_time && <p>Date: {new Date().toLocaleDateString()} {new Date().toLocaleTimeString()}</p>}
              {config.show_register_id && <p>Register: REG-001</p>}
              {config.show_operator_name && <p>Cashier: John Smith</p>}
              <div className="border-t border-dashed border-gray-300 my-2" />
              <div className="space-y-0.5">
                <div className="flex justify-between"><span>Milk 1 Gal x1</span><span>$4.99</span></div>
                <div className="flex justify-between"><span>White Bread x2</span><span>$6.98</span></div>
                <div className="flex justify-between"><span>Cola 2L x1</span><span>$2.99</span></div>
              </div>
              <div className="border-t border-dashed border-gray-300 my-2" />
              <div className="flex justify-between"><span>Subtotal</span><span>$14.96</span></div>
              {config.show_tax_breakdown && <div className="flex justify-between"><span>Tax</span><span>$0.25</span></div>}
              <div className="flex justify-between font-bold"><span>TOTAL</span><span>$15.21</span></div>
              <div className="border-t border-dashed border-gray-300 my-2" />
              <div className="flex justify-between"><span>Cash Tendered</span><span>$20.00</span></div>
              <div className="flex justify-between font-bold"><span>Change</span><span>$4.79</span></div>
              {(config.footer_line_1 || config.footer_line_2) && (
                <>
                  <div className="border-t border-dashed border-gray-300 my-2" />
                  <div className="text-center">
                    {config.footer_line_1 && <p>{config.footer_line_1}</p>}
                    {config.footer_line_2 && <p>{config.footer_line_2}</p>}
                  </div>
                </>
              )}
              {config.show_barcode && (
                <div className="text-center mt-3"><div className="inline-block bg-gray-300 h-8 w-32 rounded" /><p className="mt-1 text-[10px]">||||| ||||| |||||</p></div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}