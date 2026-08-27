import React from "react";
import { Card } from "@/components/ui/card";
import { MonitorPlay } from "lucide-react";
import SetupStepDetail from "@/components/infrastructure/SetupStepDetail";
import CodeBlock from "@/components/techdocs/CodeBlock";
import { CUSTOMER_MONITOR_STEP, CUSTOMER_WINDOW_SNIPPET } from "@/lib/laneCustomerMonitor";

// Customer-facing second monitor — the pole-display alternative that needs no protocol work.
export default function CustomerMonitorReference() {
  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900">
          <MonitorPlay className="h-5 w-5 text-cyan-600" />
          Customer Monitor
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-gray-600">
          A second screen facing the customer, showing the live itemized sale, an idle promotion rotation between
          customers and a thank-you summary after payment. It exists as the practical alternative to the 2×20 pole
          displays: a monitor is a second video output and a second browser window, so there is no proprietary serial
          or HID protocol to capture first.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-gray-600">
          It does <strong>not</strong> retire the poles. Pole work continues as the reserve path — the serial IBM
          chain pole in particular — and a lane can be fitted with a pole, a monitor, or both, because the monitor is
          configured in its own section on the register rather than as another pole profile.
        </p>
      </Card>

      <SetupStepDetail step={CUSTOMER_MONITOR_STEP} />

      <Card className="p-6">
        <h3 className="mb-2 text-sm font-semibold text-gray-900">Kiosk launcher — the second window</h3>
        <p className="mb-3 text-xs leading-relaxed text-gray-500">
          Added to <span className="font-mono">sureflow-kiosk</span> inside the lane image. The customer window needs
          its own <span className="font-mono">--user-data-dir</span>: two <span className="font-mono">--kiosk</span>{" "}
          windows sharing one Chromium profile means the second silently refuses to open, which looks exactly like the
          launcher never ran.
        </p>
        <CodeBlock code={CUSTOMER_WINDOW_SNIPPET} />
      </Card>
    </div>
  );
}