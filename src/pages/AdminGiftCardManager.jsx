import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { CreditCard, DollarSign, TrendingDown, Calendar, Trash2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/components/ui/use-toast";

// Purge gift cards with $0 balance that haven't been touched in 30 days
const AUTO_DELETE_DAYS = 30;
async function purgeZeroBalanceCards(cards) {
  const now = Date.now();
  const stale = cards.filter(c => (c.balance || 0) === 0);
  const toPurge = stale.filter(c => {
    const ref = c.updated_date ? new Date(c.updated_date) : new Date(c.purchase_date);
    return (now - ref.getTime()) > AUTO_DELETE_DAYS * 24 * 60 * 60 * 1000;
  });
  if (toPurge.length > 0) {
    await base44.entities.GiftCard.deleteMany({ id: { $in: toPurge.map(c => c.id) } });
  }
  return toPurge.length;
}

export default function AdminGiftCardManager() {
  const [giftCards, setGiftCards] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ active: 0, totalBalance: 0, totalSold: 0 });
  const { toast } = useToast();

  useEffect(() => {
    loadGiftCards();
  }, []);

  const loadGiftCards = async () => {
    try {
      setLoading(true);
      let cards = await base44.entities.GiftCard.list('-purchase_date', 100);

      // Auto-purge $0-balance cards older than 30 days, then re-fetch the clean list
      const purgedCount = await purgeZeroBalanceCards(cards);
      if (purgedCount > 0) {
        toast({ title: "Auto-cleanup", description: `${purgedCount} empty gift card${purgedCount !== 1 ? "s" : ""} purged (30+ days at $0 balance).` });
        cards = await base44.entities.GiftCard.list('-purchase_date', 100);
      }

      setGiftCards(cards);
      setFiltered(cards);

      // Calculate stats
      const active = cards.filter(c => c.status === "active").length;
      const totalBalance = cards.reduce((sum, c) => sum + (c.balance || 0), 0);
      const totalSold = cards.reduce((sum, c) => sum + (c.original_amount || 0), 0);
      setStats({ active, totalBalance, totalSold });
    } catch (e) {
      toast({ title: "Error", description: "Failed to load gift cards", variant: "destructive" });
    }
    setLoading(false);
  };

  const deleteCard = async (card) => {
    try {
      await base44.entities.GiftCard.delete(card.id);
      toast({ title: "Deleted", description: `Card ${card.card_number} removed.` });
      await loadGiftCards();
    } catch (e) {
      toast({ title: "Error", description: "Failed to delete card", variant: "destructive" });
    }
  };

  const handleSearch = (val) => {
    setSearch(val);
    if (val.trim() === "") setFiltered(giftCards);
    else setFiltered(giftCards.filter(c => c.card_number.includes(val) || c.purchased_by_operator_name?.includes(val)));
  };

  const toggleStatus = async (card) => {
    try {
      const newStatus = card.status === "active" ? "inactive" : "active";
      await base44.entities.GiftCard.update(card.id, { status: newStatus });
      toast({ title: "Updated", description: `Card ${newStatus}` });
      await loadGiftCards();
    } catch (e) {
      toast({ title: "Error", description: "Failed to update card", variant: "destructive" });
    }
  };

  if (loading) return <div className="p-6 text-center">Loading...</div>;

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 w-full">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Gift Card Manager</h1>
        <p className="text-gray-500 text-sm mt-1">Manage and track gift card inventory</p>
        <p className="text-gray-400 text-xs mt-1 flex items-center gap-1.5">
          <Trash2 className="w-3 h-3" />
          Cards at $0 balance are auto-purged after {AUTO_DELETE_DAYS} days of inactivity.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-gray-200 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-gray-600 text-sm font-medium">Active Cards</p>
            <CreditCard className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-gray-900">{stats.active}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-gray-600 text-sm font-medium">Outstanding Balance</p>
            <DollarSign className="w-4 h-4 text-green-500" />
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-gray-900">${stats.totalBalance.toFixed(2)}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-gray-600 text-sm font-medium">Total Sold</p>
            <TrendingDown className="w-4 h-4 text-purple-500" />
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-gray-900">${stats.totalSold.toFixed(2)}</p>
        </div>
      </div>

      {/* Search */}
      <div className="flex gap-2">
        <Input
          placeholder="Search card number or operator..."
          value={search}
          onChange={e => handleSearch(e.target.value)}
          className="w-full sm:max-w-xs"
        />
      </div>

      {/* Cards Table */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden overflow-x-auto">
        <table className="w-full min-w-[700px]">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Card Number</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Balance</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Original</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Sold By</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Date</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Status</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan="7" className="px-4 py-8 text-center text-gray-500 text-sm">No gift cards found</td>
              </tr>
            ) : (
              filtered.map(card => (
                <tr key={card.id} className="border-b border-gray-200 hover:bg-gray-50 transition">
                  <td className="px-4 py-3 text-sm font-mono text-gray-900">{card.card_number}</td>
                  <td className="px-4 py-3 text-sm font-bold text-green-600">${card.balance.toFixed(2)}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">${card.original_amount.toFixed(2)}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{card.purchased_by_operator_name || "—"}</td>
                  <td className="px-4 py-3 text-sm text-gray-500 flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {new Date(card.purchase_date).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${card.status === "active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"}`}>
                      {card.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <div className="flex items-center gap-2">
                      <Button
                        onClick={() => toggleStatus(card)}
                        variant="outline"
                        size="sm"
                        className={card.status === "active" ? "text-red-600 border-red-200 hover:bg-red-50" : "text-green-600 border-green-200 hover:bg-green-50"}
                      >
                        {card.status === "active" ? "Deactivate" : "Activate"}
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="sm" className="text-red-600 border-red-200 hover:bg-red-50 gap-1">
                            <Trash2 className="w-3.5 h-3.5" /> Delete
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle className="flex items-center gap-2">
                              <ShieldAlert className="w-5 h-5 text-red-600" /> Delete gift card?
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              This permanently removes card <span className="font-mono font-semibold text-gray-900">{card.card_number}</span> from the system. This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-red-600 hover:bg-red-700"
                              onClick={() => deleteCard(card)}
                            >
                              Delete Card
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}