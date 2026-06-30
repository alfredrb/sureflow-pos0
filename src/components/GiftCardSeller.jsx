import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { CreditCard, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import JsBarcode from "jsbarcode";

export default function GiftCardSeller({ operator, onGiftCardCreated, onClose }) {
  const [amount, setAmount] = useState("50");
  const [loading, setLoading] = useState(false);
  const [generatedCard, setGeneratedCard] = useState(null);
  const { toast } = useToast();

  const generateGiftCardNumber = () => {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `GC-${timestamp}${random}`.substring(0, 20);
  };

  const handleCreateGiftCard = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      toast({ title: "Invalid Amount", description: "Enter a valid amount", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const cardNumber = generateGiftCardNumber();
      const card = await base44.entities.GiftCard.create({
        card_number: cardNumber,
        original_amount: parseFloat(amount),
        balance: parseFloat(amount),
        purchase_date: new Date().toISOString(),
        purchased_by_operator_id: operator?.operator_id || "",
        purchased_by_operator_name: operator?.full_name || "",
        register_id: sessionStorage.getItem("pos_register_num") || "REG-001",
        status: "active",
        transactions: [
          {
            transaction_id: `GC-SALE-${Date.now()}`,
            amount: parseFloat(amount),
            transaction_date: new Date().toISOString(),
            operator_id: operator?.operator_id || "",
            operator_name: operator?.full_name || "",
            register_id: sessionStorage.getItem("pos_register_num") || "REG-001",
            type: "sale",
            remaining_balance: parseFloat(amount)
          }
        ]
      });

      setGeneratedCard({
        cardNumber,
        amount: parseFloat(amount),
        purchasedBy: operator?.full_name || "Unknown",
        date: new Date().toLocaleString()
      });

      toast({ title: "Gift Card Created", description: `${cardNumber} — $${amount}` });
      if (onGiftCardCreated) onGiftCardCreated(card);
    } catch (e) {
      toast({ title: "Error", description: "Failed to create gift card", variant: "destructive" });
    }
    setLoading(false);
  };

  const handlePrint = () => {
    if (!generatedCard) return;
    const printWindow = window.open("", "", "width=400,height=600");
    printWindow.document.write(`
      <html>
      <head>
        <style>
          body { font-family: monospace; padding: 20px; text-align: center; }
          .card { border: 2px solid #000; padding: 20px; border-radius: 10px; }
          .title { font-size: 24px; font-weight: bold; margin-bottom: 20px; }
          .number { font-size: 18px; letter-spacing: 2px; font-weight: bold; margin: 20px 0; }
          .amount { font-size: 32px; font-weight: bold; color: green; margin: 20px 0; }
          .barcode { margin: 20px 0; }
          .meta { font-size: 12px; color: #666; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="title">GIFT CARD</div>
          <div class="number">${generatedCard.cardNumber}</div>
          <div class="amount">$${generatedCard.amount.toFixed(2)}</div>
          <svg id="barcode" style="margin: 20px 0;"></svg>
          <div class="meta">
            <p>Sold by: ${generatedCard.purchasedBy}</p>
            <p>Date: ${generatedCard.date}</p>
            <p>Do not fold or bend</p>
          </div>
        </div>
        <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"><\/script>
        <script>
          JsBarcode("#barcode", "${generatedCard.cardNumber}", { format: "CODE128", width: 2, height: 80 });
        <\/script>
      </body>
      </html>
    `);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 250);
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="bg-[#111638] border-amber-500/10 text-white max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-300">
            <CreditCard className="w-4 h-4" /> Sell Gift Card
          </DialogTitle>
        </DialogHeader>

        {!generatedCard ? (
          <div className="space-y-4">
            <div>
              <label className="text-blue-300/60 text-[10px] mb-1 block uppercase tracking-wider">Gift Card Amount</label>
              <div className="grid grid-cols-3 gap-2">
                {[25, 50, 100].map(val => (
                  <button
                    key={val}
                    onClick={() => setAmount(String(val))}
                    className={`py-2 rounded-lg font-bold transition-colors ${amount === String(val) ? "bg-amber-600 text-white" : "bg-[#0a0e27] border border-amber-500/20 text-amber-300 hover:border-amber-500/50"}`}
                  >
                    ${val}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-blue-300/60 text-[10px] mb-1 block uppercase tracking-wider">Custom Amount</label>
              <Input
                type="number"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                step="0.01"
                min="0"
                className="bg-[#0a0e27] border-amber-500/20 text-white text-xl h-12 text-center"
                placeholder="0.00"
              />
            </div>

            <Button
              onClick={handleCreateGiftCard}
              disabled={loading || !amount}
              className="w-full bg-amber-600 hover:bg-amber-500 text-white font-bold"
            >
              {loading ? "Creating..." : "Create & Print Gift Card"}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-[#0a0e27] border border-amber-500/30 rounded-lg p-6 text-center space-y-4">
              <p className="text-amber-300 font-bold text-lg">Gift Card Created</p>
              <div className="text-2xl font-bold text-white font-mono break-all">{generatedCard.cardNumber}</div>
              <div className="text-3xl font-bold text-green-400">${generatedCard.amount.toFixed(2)}</div>
              <div className="text-xs text-blue-300/60">Sold by: {generatedCard.purchasedBy}</div>
              <div className="text-xs text-blue-300/60">{generatedCard.date}</div>
            </div>

            <div className="flex gap-2">
              <Button onClick={onClose} variant="outline" className="flex-1 border-blue-500/20 text-blue-300 hover:bg-blue-500/10 text-xs">
                Done
              </Button>
              <Button onClick={handlePrint} className="flex-1 bg-amber-600 hover:bg-amber-500 text-white flex items-center justify-center gap-2">
                <Printer className="w-3 h-3" /> Print
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}