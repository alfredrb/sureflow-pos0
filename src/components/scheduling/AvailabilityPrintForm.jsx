import React from "react";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// Opens a printable blank availability form an employee can fill out by hand
// before a manager enters their availability into the system.
export default function AvailabilityPrintFormButton({ operatorName }) {
  const openForm = () => {
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Employee Availability Form</title>
<style>
  @page { margin: 16mm; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #111827; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  .sub { color: #6b7280; font-size: 13px; margin-bottom: 18px; }
  .section { border: 1px solid #d1d5db; border-radius: 8px; padding: 12px 14px; margin-bottom: 14px; }
  .section h2 { font-size: 14px; margin: 0 0 10px; color: #374151; }
  .row { display: flex; gap: 10px; margin-bottom: 8px; align-items: center; font-size: 13px; }
  .row label { width: 90px; color: #6b7280; }
  .line { flex: 1; border-bottom: 1px solid #9ca3af; height: 18px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th, td { border: 1px solid #d1d5db; padding: 7px 8px; text-align: left; }
  th { background: #f9fafb; font-weight: 600; }
  .box { width: 16px; height: 16px; border: 1.5px solid #6b7280; border-radius: 3px; display: inline-block; vertical-align: middle; margin-right: 4px; }
  .sig { margin-top: 6px; }
  .foot { color: #9ca3af; font-size: 11px; margin-top: 16px; }
</style></head><body>
<h1>Employee Availability Form</h1>
<div class="sub">Please fill this out and return it to your manager. Your availability will be used to build the weekly schedule.</div>

<div class="section">
  <h2>Employee Information</h2>
  <div class="row"><label>Name:</label><div class="line">${operatorName ? operatorName : ""}</div></div>
  <div class="row"><label>Operator ID:</label><div class="line"></div></div>
  <div class="row"><label>Department:</label><div class="line"></div></div>
  <div class="row"><label>Date:</label><div class="line"></div></div>
</div>

<div class="section">
  <h2>Weekly Max Hours</h2>
  <div class="row"><label>Max hours/week I can work:</label><div class="line"></div></div>
</div>

<div class="section">
  <h2>Weekly Availability</h2>
  <p style="font-size:12px;color:#6b7280;margin:0 0 8px;">Check "Available" for each day you can work, and write your preferred start–end times.</p>
  <table>
    <thead><tr><th>Day</th><th style="width:90px;">Available?</th><th>Start time</th><th>End time</th></tr></thead>
    <tbody>
      ${DAY_NAMES.map(d => `<tr><td>${d}</td><td><span class="box"></span> Yes &nbsp;&nbsp; <span class="box"></span> No</td><td></td><td></td></tr>`).join("")}
    </tbody>
  </table>
</div>

<div class="section">
  <h2>Specific Dates Unavailable (vacation, etc.)</h2>
  <div class="row"><label>Date(s):</label><div class="line"></div></div>
  <div class="row"><label>Reason:</label><div class="line"></div></div>
</div>

<div class="section">
  <h2>Notes / Preferences</h2>
  <div style="border-bottom:1px solid #9ca3af;height:54px;"></div>
</div>

<div class="section">
  <h2>Signatures</h2>
  <div class="row"><label>Employee:</label><div class="line"></div></div>
  <div class="row sig"><label>Manager:</label><div class="line"></div></div>
</div>

<div class="foot">Manager: once received, enter the employee's availability in the Availability tab to enable AI scheduling.</div>
<script>window.onload = () => { window.print(); };</script>
</body></html>`;
    const w = window.open("", "_blank");
    if (!w) { alert("Please allow popups to print the availability form."); return; }
    w.document.write(html);
    w.document.close();
  };

  return (
    <Button onClick={openForm} variant="outline" className="border-gray-300">
      <Printer className="w-4 h-4 mr-2" /> Printable Form
    </Button>
  );
}