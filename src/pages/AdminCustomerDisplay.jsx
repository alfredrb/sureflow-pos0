import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/data";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { Plus, Pencil, Trash2, MonitorPlay, GripVertical, EyeOff } from "lucide-react";
import SlideForm from "@/components/customerdisplay/SlideForm";
import { logAuditEvent } from "@/lib/auditLogger";
import { getAdminAccess } from "@/lib/adminAccess";

// Idle-screen content for the lanes' customer-facing monitors. Store-scoped, so each store
// runs its own rotation; a slide saved with no store shows chain-wide.
export default function AdminCustomerDisplay() {
  const [slides, setSlides] = useState([]);
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  // Scoped the same way the Registers page is: a store admin manages their own store's
  // rotation, HQ sees every slide.
  const adminOperator = useMemo(() => JSON.parse(sessionStorage.getItem("admin_operator") || "null"), []);
  const access = useMemo(() => getAdminAccess(adminOperator), [adminOperator]);
  const storeId = access.storeScope === "all" ? "" : (access.storeScope[0] || "");

  const load = async () => {
    const all = await base44.entities.CustomerDisplay.list("sort_order");
    setSlides(storeId ? (all || []).filter(s => !s.store_id || s.store_id === storeId) : all || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [storeId]);

  const save = async (data) => {
    if (editing?.id) {
      await base44.entities.CustomerDisplay.update(editing.id, data);
      logAuditEvent({
        action: "Updated Customer Display Slide",
        category: "configuration",
        description: `Edited the customer monitor idle slide "${data.headline}".`,
        page: "/admin/customer-display",
      });
    } else {
      await base44.entities.CustomerDisplay.create(data);
      logAuditEvent({
        action: "Created Customer Display Slide",
        category: "configuration",
        description: `Added the customer monitor idle slide "${data.headline}".`,
        page: "/admin/customer-display",
      });
    }
    setEditing(null);
    load();
    toast({ title: "Slide Saved", description: "The lanes pick this up on their next idle cycle." });
  };

  const remove = async (slide) => {
    await base44.entities.CustomerDisplay.delete(slide.id);
    logAuditEvent({
      action: "Deleted Customer Display Slide",
      category: "configuration",
      description: `Removed the customer monitor idle slide "${slide.headline}".`,
      page: "/admin/customer-display",
    });
    load();
  };

  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="mb-6 flex items-start justify-between gap-6">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            <MonitorPlay className="h-6 w-6 text-cyan-600" />
            Customer Display
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">
            What the customer-facing monitors show between customers. During a sale the screen switches to the live
            itemized cart on its own, and after payment it shows the thank-you summary — this rotation is only the
            idle state.
          </p>
        </div>
        <Button onClick={() => setEditing({})}>
          <Plus className="mr-2 h-4 w-4" /> New Slide
        </Button>
      </div>

      {loading ? (
        <div className="py-20 text-center text-gray-400">Loading...</div>
      ) : slides.length === 0 ? (
        <Card className="p-12 text-center">
          <MonitorPlay className="mx-auto mb-3 h-10 w-10 text-gray-300" />
          <p className="font-medium text-gray-700">No idle slides yet</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-gray-500">
            With no slides, a customer monitor shows a plain branded welcome between customers. Add slides to run
            promotions on the rotation instead.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {slides.map(slide => (
            <Card key={slide.id} className="flex items-center gap-4 p-4">
              <GripVertical className="h-5 w-5 shrink-0 text-gray-300" />
              {slide.image_url ? (
                <img src={slide.image_url} alt="" className="h-16 w-28 shrink-0 rounded-lg object-cover" />
              ) : (
                <div className="flex h-16 w-28 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-xs text-gray-400">
                  No image
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate font-semibold text-gray-900">{slide.headline}</p>
                  {slide.active === false && (
                    <span className="flex items-center gap-1 rounded bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-500">
                      <EyeOff className="h-3 w-3" /> Inactive
                    </span>
                  )}
                </div>
                {slide.subtext && <p className="truncate text-sm text-gray-500">{slide.subtext}</p>}
                <p className="mt-1 text-xs text-gray-400">
                  Holds {slide.display_seconds || 8}s · order {slide.sort_order || 0}
                  {slide.store_id ? ` · store ${slide.store_id}` : " · all stores"}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button variant="ghost" size="icon" onClick={() => setEditing(slide)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => remove(slide)}>
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <SlideForm
        open={!!editing}
        slide={editing?.id ? editing : null}
        storeId={storeId}
        onClose={() => setEditing(null)}
        onSave={save}
      />
    </div>
  );
}