import React from "react";
import { Rocket, LogIn, Sunrise, ShoppingCart, CreditCard, LogOut, Keyboard, RotateCcw, ArrowLeftRight, Headphones, Receipt, Wallet, GraduationCap, Siren, Moon, AlertCircle } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const quickStart = [
  { icon: LogIn, title: "1. Log In", text: "Enter your Operator ID and PIN on the POS login screen, then select your assigned register. You can only be logged into one register at a time." },
  { icon: Sunrise, title: "2. Start of Day", text: "Complete the SOD Protocol — count and confirm your starting till balance. No sales are permitted until SOD is complete." },
  { icon: ShoppingCart, title: "3. Ring Up Items", text: "Tap items from the function grid or open the Item List (Item List tab) to search by name or SKU. Use the Quantity key to change amounts." },
  { icon: CreditCard, title: "4. Take Payment", text: "Press PAY, choose the payment method (Cash, Credit, Debit, Check, Store Credit, or Gift Card), enter the tendered amount, and complete the sale." },
  { icon: LogOut, title: "5. Log Out", text: "Tap the Log Out icon when your shift ends. Always clear your cart and complete any open transaction before logging out." },
];

const reference = [
  { value: "sod", icon: Sunrise, title: "SOD Protocol (Start of Day)", body: "Each register must complete the Start of Day protocol before any transactions. Count the starting cash in the drawer, enter the amount in the SOD modal, and confirm. This starting balance is used for reconciliation, cash audits, and robbery calculations throughout the day." },
  { value: "function-keys", icon: Keyboard, title: "Function Keys", body: "The 3×3 function grid changes based on the selected section tab. Common keys: Void Item (removes the last scanned item), Void Transaction (clears the whole cart), Subtotal, Quantity, No Sale (opens drawer), Tax Exempt, Discount Item/Total, and Cash Management. Keys marked MGR or CSM require supervisor authorization — enter a CSM/Manager PIN or send a remote override request." },
  { value: "returns", icon: RotateCcw, title: "Returns & Refunds", body: "Switch to the Returns tab (if enabled on your register). Locate the original transaction, select the items being returned, and process the refund to the original payment method. Return-period overrides require a CSM/Manager PIN and are logged." },
  { value: "exchanges", icon: ArrowLeftRight, title: "Exchanges", body: "Use the Exchange tab to return items and add replacement items in the same transaction. The register calculates the difference — whether the customer owes more or is due a refund." },
  { value: "cs-mode", icon: Headphones, title: "Customer Service Mode", body: "CS Mode is used for gift card sales and other customer service tasks. Gift cards can be generated and added to the cart, then purchased like any other item. Gift cards are non-refundable." },
  { value: "tax-exempt", icon: Receipt, title: "Tax Exempt Sales", body: "Press the Tax Exempt function key and enter the Tax Exempt ID issued to the customer. The register verifies the ID against the database and displays the business/individual for confirmation. Once confirmed, tax is removed for the entire transaction and the sale is recorded against that Tax Exempt ID. A banner shows the active exemption until the sale completes." },
  { value: "gift-cards", icon: Wallet, title: "Gift Cards", body: "Sell new gift cards from CS Mode. To redeem a gift card as payment, choose Gift Card at the payment screen, enter the card number and amount to charge. The balance is deducted in real time. Cards with a $0 balance are auto-purged after 30 days." },
  { value: "cash-mgmt", icon: Wallet, title: "Cash Management (Pickups & Advances)", body: "Use the Cash Management function to request cash pickups (removing excess cash) or advances (adding cash to the drawer). Each request is logged and requires admin approval. Watch for cash limit alerts when the drawer exceeds the configured limit." },
  { value: "training", icon: GraduationCap, title: "Training Mode", body: "Training Mode lets you practice sales without affecting real data — no transactions, stock changes, or logs are recorded. Enable it from the Help menu with a CSM/Manager PIN. An orange banner confirms training mode is active. Exit it the same way." },
  { value: "emergency", icon: Siren, title: "Robbery & Emergencies", body: "If a robbery occurs, press Report Robbery in the Help menu. The register calculates the stolen amount from SOD, sales, and cash movements, then logs the incident and pauses the register for security. Administrators are notified immediately." },
  { value: "eod", icon: Moon, title: "End of Day", body: "End of Day reconciliation is handled by administrators. At midnight, the system consolidates the day's transactions, refunds, cash audits, and robbery reports into an EOD report. Always log out at the end of your shift so your drawer can be reconciled." },
];

export default function TrainingGuideContent() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4"><Rocket className="w-5 h-5 text-blue-500" /> Quick Start Guide</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {quickStart.map(({ icon: Icon, title, text }) => (
            <div key={title} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
              <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center mb-3">
                <Icon className="w-5 h-5 text-blue-600" />
              </div>
              <p className="font-semibold text-gray-900 text-sm mb-1">{title}</p>
              <p className="text-gray-500 text-xs leading-relaxed">{text}</p>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Reference Documentation</h2>
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
          <Accordion type="single" collapsible className="w-full">
            {reference.map(({ value, icon: Icon, title, body }) => (
              <AccordionItem key={value} value={value} className="border-b border-gray-100 last:border-0">
                <AccordionTrigger className="px-4 sm:px-6 py-4 hover:no-underline hover:bg-gray-50">
                  <div className="flex items-center gap-3 text-left">
                    <Icon className="w-5 h-5 text-blue-500 flex-shrink-0" />
                    <span className="font-medium text-gray-900 text-sm">{title}</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 sm:px-6 pb-4 pt-1 text-gray-600 text-sm leading-relaxed">
                  <div className="pl-8">{body}</div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
        <p className="text-blue-800 text-sm">Need hands-on practice? Use <span className="font-semibold">Training Mode</span> from the POS Help menu to run practice transactions without affecting live sales or inventory.</p>
      </div>
    </div>
  );
}