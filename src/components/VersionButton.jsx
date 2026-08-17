import React, { useState, useEffect } from "react";
import { GitBranch } from "lucide-react";
import VersionLogDialog from "@/components/VersionLogDialog";
import { getLatestVersionString } from "@/lib/appVersion";

export default function VersionButton({ collapsed, canManage, adminOperator }) {
  const [open, setOpen] = useState(false);
  const [version, setVersion] = useState("");

  useEffect(() => { getLatestVersionString().then(setVersion).catch(() => {}); }, []);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title={collapsed ? "Version" : ""}
        className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors w-full text-indigo-400 hover:bg-indigo-500/10"
      >
        <GitBranch className="w-4 h-4 flex-shrink-0" />
        {!collapsed && <span>Version</span>}
        {!collapsed && version && <span className="ml-auto text-[10px] text-indigo-300/70 font-mono">v{version}</span>}
      </button>
      <VersionLogDialog open={open} onOpenChange={setOpen} canManage={canManage} adminOperator={adminOperator} />
    </>
  );
}