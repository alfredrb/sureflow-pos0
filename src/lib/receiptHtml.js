// Renders the 4690-style receipt tokens as printable HTML (browser fallback
// used when the relay/printer is unreachable).
import { buildReceiptTokens } from "@/lib/receiptFormat";

const esc = (s) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function buildReceiptHtml(payload) {
  const tokens = buildReceiptTokens(payload);

  const body = tokens
    .map((t) => {
      if (t.type === "blank") return `<div class="blank"></div>`;
      if (t.type === "big") return `<div class="big">${esc(t.text)}</div>`;
      if (t.type === "center") return `<div class="center">${esc(t.text)}</div>`;
      if (t.type === "barcode")
        return t.text ? `<div class="center"><svg id="barcode"></svg></div>` : "";
      return `<pre class="row">${esc(t.text)}</pre>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html><head><style>
  body { width: 80mm; margin: 0; padding: 6mm 4mm; font-family: "Courier New", monospace; font-size: 12px; }
  .row { margin: 0; font-family: inherit; font-size: 12px; white-space: pre; letter-spacing: 0; }
  .center { text-align: center; font-size: 12px; }
  .big { text-align: center; font-weight: bold; font-size: 20px; letter-spacing: 1px; margin: 4px 0; }
  .blank { height: 10px; }
</style></head>
<body>${body}
<script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"><\/script>
<script>
  try { JsBarcode("#barcode", "${esc(payload.transaction_id)}", { format: "CODE128", width: 2, height: 45, displayValue: true, fontSize: 12, margin: 0 }); } catch (e) {}
<\/script>
</body></html>`;
}