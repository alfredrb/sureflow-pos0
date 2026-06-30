import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";

export default function GiftCardSeller({ operator, onAddToCart, onClose }) {
  const [amount, setAmount] = useState("50");
  const [loading, setLoading] = useState(false);
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
      const cardData = {
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
      };

      await base44.entities.GiftCard.create(cardData);

      if (onAddToCart) {
        onAddToCart({
          sku: cardNumber,
          name: `Gift Card - $${parseFloat(amount).toFixed(2)}`,
          price: parseFloat(amount),
          qty: 1,
          total: parseFloat(amount),
          tax_rate: 0,
          giftcard_number: cardNumber,
          is_giftcard: true
        });
      }

      toast({ title: "Gift Card Added", description: `${cardNumber} — $${amount}` });
      onClose();
    } catch (e) {
      toast({ title: "Error", description: "Failed to create gift card", variant: "destructive" });
    }
    setLoading(false);
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="bg-[#111638] border-amber-500/10 text-white max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-300">
            <CreditCard className="w-4 h-4" /> Sell Gift Card
          </DialogTitle>
        </DialogHeader>

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
            {loading ? "Creating..." : "Add Gift Card to Cart"}
          </Button>

          <Button
            onClick={onClose}
            variant="outline"
            className="w-full border-blue-500/20 text-blue-300 hover:bg-blue-500/10"
          >
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}