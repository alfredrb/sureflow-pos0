// Renders the 4690-style receipt tokens as printable HTML (browser fallback
// used when the relay/printer is unreachable).
import { buildReceiptTokens } from "@/lib/receiptFormat";

const esc = (s) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function buildReceiptHtml(payload) {
  const tokens = buildReceiptTokens(payload);
  // The code token carries its own value and format so notice slips (suspends,
  // voids) print theirs the same way sale receipts do.
  const codeToken = tokens.find((t) => t.type === "barcode" && t.text);
  const codeValue = codeToken?.text || "";
  const isQr = codeToken?.format === "qr";

  const body = tokens
    .map((t) => {
      if (t.type === "blank") return `<div class="blank"></div>`;
      if (t.type === "big") return `<div class="big">${esc(t.text)}</div>`;
      if (t.type === "center") return `<div class="center">${esc(t.text)}</div>`;
      if (t.type === "barcode") {
        if (!t.text) return "";
        return t.format === "qr"
          ? `<div class="center"><div id="qrcode"></div><div>${esc(t.text)}</div></div>`
          : `<div class="center"><svg id="barcode"></svg></div>`;
      }
      return `<pre class="row">${esc(t.text)}</pre>`;
    })
    .join("");

  const codeScript = isQr
    ? `<script src="https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js"><\/script>
<script>
  try { new QRCode(document.getElementById("qrcode"), { text: "${esc(codeValue)}", width: 120, height: 120, correctLevel: QRCode.CorrectLevel.M }); } catch (e) {}
<\/script>`
    : `<script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"><\/script>
<script>
  try { JsBarcode("#barcode", "${esc(codeValue)}", { format: "CODE128", width: 2, height: 45, displayValue: true, fontSize: 12, margin: 0 }); } catch (e) {}
<\/script>`;

  return `<!DOCTYPE html>
<html><head><style>
  body { width: 80mm; margin: 0; padding: 6mm 4mm; font-family: "Courier New", monospace; font-size: 12px; }
  .row { margin: 0; font-family: inherit; font-size: 12px; white-space: pre; letter-spacing: 0; }
  .center { text-align: center; font-size: 12px; }
  .big { text-align: center; font-weight: bold; font-size: 20px; letter-spacing: 1px; margin: 4px 0; }
  .blank { height: 10px; }
  #qrcode { display: inline-block; margin: 4px 0; }
  #qrcode img, #qrcode canvas { display: block; margin: 0 auto; }
</style></head>
<body>${body}
${codeScript}
</body></html>`;
}