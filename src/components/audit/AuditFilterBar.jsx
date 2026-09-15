import React from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CATEGORY_META } from "@/components/audit/AuditCategoryBadge";

export default function AuditFilterBar({ search, onSearch, category, onCategory, actor, onActor, actors, fromDate, onFromDate, toDate, onToDate }) {
  return (
    <div className="flex flex-col flex-wrap gap-2 sm:flex-row">
      <div className="relative min-w-[200px] max-w-md flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <Input placeholder="Search action, description, actor, page..." value={search} onChange={(e) => onSearch(e.target.value)} className="pl-9" />
      </div>
      <Select value={category} onValueChange={onCategory}>
        <SelectTrigger className="sm:w-44"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Categories</SelectItem>
          {Object.entries(CATEGORY_META).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={actor} onValueChange={onActor}>
        <SelectTrigger className="sm:w-44"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Actors</SelectItem>
          {actors.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
        </SelectContent>
      </Select>
      <Input type="date" value={fromDate} onChange={(e) => onFromDate(e.target.value)} className="sm:w-40" />
      <Input type="date" value={toDate} onChange={(e) => onToDate(e.target.value)} className="sm:w-40" />
    </div>
  );
}