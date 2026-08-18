import React, { useMemo } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { Sparkles, FolderSearch } from "lucide-react";
import moment from "moment";
import { TYPE_LABEL, SEVERITY_BADGE } from "@/components/lossprevention/InvestigationsPanel";

const COLUMNS = [
  { id: "open", title: "Open", accent: "border-t-amber-500", dot: "bg-amber-500" },
  { id: "in_progress", title: "In Progress", accent: "border-t-blue-500", dot: "bg-blue-500" },
  { id: "closed", title: "Closed", accent: "border-t-emerald-500", dot: "bg-emerald-500" },
];

// Kanban workboard for active (non-archived) investigations. Dragging a card
// across columns calls onMoveStatus(invId, newStatus) to persist the change.
export default function InvestigationKanbanBoard({ items, search, onOpenInvestigation, onMoveStatus, movingId }) {
  const active = useMemo(
    () => items.filter(i => !i.archived && (i.status === "open" || i.status === "in_progress" || i.status === "closed")),
    [items]
  );
  const q = (search || "").trim().toLowerCase();
  const filtered = q
    ? active.filter(i => (i.title || "").toLowerCase().includes(q) || (i.operator_name || "").toLowerCase().includes(q))
    : active;

  const byCol = {
    open: filtered.filter(i => i.status === "open"),
    in_progress: filtered.filter(i => i.status === "in_progress"),
    closed: filtered.filter(i => i.status === "closed"),
  };

  const onDragEnd = (res) => {
    const { destination, source, draggableId } = res;
    if (!destination || destination.droppableId === source.droppableId) return;
    onMoveStatus(draggableId, destination.droppableId);
  };

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {COLUMNS.map(col => (
          <Droppable droppableId={col.id} key={col.id}>
            {(provided, snapshot) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className={`bg-gray-50/70 border border-gray-100 rounded-2xl border-t-4 ${col.accent} flex flex-col min-h-[320px] ${snapshot.isDraggingOver ? "ring-2 ring-amber-200" : ""}`}
              >
                <div className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${col.dot}`} />
                    <h3 className="text-sm font-semibold text-gray-800">{col.title}</h3>
                  </div>
                  <span className="text-xs font-medium text-gray-400 bg-white px-2 py-0.5 rounded-full">{byCol[col.id].length}</span>
                </div>
                <div className="flex-1 px-2 pb-2 space-y-2 overflow-y-auto max-h-[60vh]">
                  {byCol[col.id].map((inv, idx) => (
                    <Draggable draggableId={inv.id} index={idx} key={inv.id}>
                      {(prov, snap) => (
                        <div
                          ref={prov.innerRef}
                          {...prov.draggableProps}
                          {...prov.dragHandleProps}
                          onClick={() => onOpenInvestigation(inv)}
                          className={`bg-white border border-gray-100 rounded-xl p-3 shadow-sm hover:shadow-md hover:border-amber-200 cursor-pointer transition-all ${snap.isDragging ? "shadow-lg ring-2 ring-amber-300" : ""} ${movingId === inv.id ? "opacity-50" : ""}`}
                        >
                          <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
                            <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600">{TYPE_LABEL[inv.type] || inv.type}</span>
                            <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full ${SEVERITY_BADGE[inv.severity] || "bg-gray-100 text-gray-600"}`}>{inv.severity}</span>
                            {inv.ai_generated && <span className="text-[9px] font-medium px-1 py-0.5 rounded-full bg-violet-100 text-violet-700 inline-flex items-center gap-0.5"><Sparkles className="w-2 h-2" /> AI</span>}
                          </div>
                          <p className="text-sm font-semibold text-gray-900 leading-snug line-clamp-2">{inv.title}</p>
                          <div className="flex items-center justify-between mt-2 text-[11px] text-gray-400">
                            <span className="truncate">{inv.operator_name || "No operator"}</span>
                            {inv.amount_impact ? <span className="font-semibold text-gray-700">${Number(inv.amount_impact).toFixed(0)}</span> : null}
                          </div>
                          <div className="flex items-center justify-between mt-1 text-[10px] text-gray-400">
                            <span className="truncate text-blue-600">{inv.assigned_to ? `Assigned: ${inv.assigned_to}` : ""}</span>
                            <span>{moment(inv.created_date).format("M/D")}</span>
                          </div>
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                  {byCol[col.id].length === 0 && !snapshot.isDraggingOver && (
                    <div className="text-center text-xs text-gray-300 py-10 flex flex-col items-center gap-1">
                      <FolderSearch className="w-5 h-5 text-gray-200" />
                      <span>Drop cases here</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </Droppable>
        ))}
      </div>
    </DragDropContext>
  );
}