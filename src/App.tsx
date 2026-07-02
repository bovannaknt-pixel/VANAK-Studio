/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { ShopData, Watch, Sale, Income, Expense, CapitalTransaction, Supplier, ClosedPeriod, StockTakeSession, StockTakeItem } from "./types";
import { fetchShopData, saveShopData, resetShopData } from "./utils/api";
import { translations, Language } from "./utils/lang";
import LoginScreen from "./components/LoginScreen";
import AIChatSection from "./components/AIChatSection";
import QRScannerModal from "./components/QRScannerModal";
import ScanWatchCode from "./components/ScanWatchCode";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from "recharts";
import {
  Watch as WatchIcon,
  TrendingUp,
  TrendingDown,
  Activity,
  DollarSign,
  Layers,
  Search,
  Zap,
  Plus,
  Trash2,
  Printer,
  FileText,
  Edit2,
  Check,
  X,
  Sparkles,
  RefreshCw,
  LogOut,
  AlertTriangle,
  History,
  FileSpreadsheet,
  Wallet,
  Coins,
  Sun,
  Moon,
  Languages,
  Copy,
  Laptop,
  ExternalLink,
  Target,
  Calendar,
  Download,
  Database,
  Mail,
  Phone,
  Truck,
  QrCode,
  Bell,
  BellRing,
  PieChart as PieIcon,
  Users,
  Eye,
  EyeOff,
  Wifi,
  WifiOff,
  ClipboardList,
  CalendarCheck,
  Lock,
  Settings,
  UploadCloud,
  Columns,
  Maximize2,
  ChevronDown,
  ChevronUp,
  Pencil
} from "lucide-react";
import * as XLSX from "xlsx";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, "+")
    .replace(/_/g, "/");

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [userRole, setUserRole] = useState<"owner" | "staff">("owner");
  const [userName, setUserName] = useState<string>("Kunthy");
  const [language, setLanguage] = useState<Language>("kh");
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [showInstallModal, setShowInstallModal] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [installDeviceTab, setInstallDeviceTab] = useState<"pc" | "android" | "ios">("pc");

  // Push Notification States
  const [pushSupported, setPushSupported] = useState<boolean>(false);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>("default");
  const [isPushSubscribed, setIsPushSubscribed] = useState<boolean>(false);
  const [subscribing, setSubscribing] = useState<boolean>(false);

  // Synchronous Sync and Network Status States
  const [isOnline, setIsOnline] = useState<boolean>(typeof window !== "undefined" ? navigator.onLine : true);
  const [syncState, setSyncState] = useState<"synced" | "syncing" | "offline" | "error">(
    typeof window !== "undefined" && navigator.onLine ? "synced" : "offline"
  );

  useEffect(() => {
    if (typeof window !== "undefined") {
      const handleOnline = () => {
        setIsOnline(true);
        setSyncState("syncing");
        loadData();
      };
      const handleOffline = () => {
        setIsOnline(false);
        setSyncState("offline");
      };
      window.addEventListener("online", handleOnline);
      window.addEventListener("offline", handleOffline);
      return () => {
        window.removeEventListener("online", handleOnline);
        window.removeEventListener("offline", handleOffline);
      };
    }
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const isSupported = "serviceWorker" in navigator && "PushManager" in window;
      setPushSupported(isSupported);
      if ("Notification" in window) {
        setNotificationPermission(Notification.permission);
      }
      
      // Check if registration already has a push subscription
      if (isSupported) {
        navigator.serviceWorker.ready.then(async (reg) => {
          try {
            const sub = await reg.pushManager.getSubscription();
            setIsPushSubscribed(!!sub);
          } catch (err) {
            console.error("Error checking push subscription:", err);
          }
        });
      }
    }
  }, []);

  const handleSubscribePush = async () => {
    if (!pushSupported) {
      setStatusMsg({
        type: "error",
        text: language === "kh" 
          ? "កម្មវិធីរុករករបស់អ្នកមិនគាំទ្រ Push Notifications ទេ" 
          : "Your browser does not support push notifications"
      });
      return;
    }

    setSubscribing(true);
    try {
      // 1. Request Permission
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      
      if (permission !== "granted") {
        setStatusMsg({
          type: "error",
          text: language === "kh" 
            ? "ការអនុញ្ញាតជូនដំណឹងត្រូវបានបដិសេធ" 
            : "Notification permission denied"
        });
        setSubscribing(false);
        return;
      }

      // 2. Get registration and public VAPID key
      const reg = await navigator.serviceWorker.ready;
      const res = await fetch("/api/notifications/vapid-public-key");
      if (!res.ok) {
        throw new Error("Failed to fetch public VAPID key from server");
      }
      const { publicKey } = await res.json();
      
      if (!publicKey) {
        throw new Error("Server did not return a valid public VAPID key");
      }

      // 3. Subscribe
      const convertedVapidKey = urlBase64ToUint8Array(publicKey);
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedVapidKey
      });

      // 4. Send subscription to server
      const saveRes = await fetch("/api/notifications/subscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(subscription)
      });

      if (!saveRes.ok) {
        throw new Error("Server failed to save subscription");
      }

      setIsPushSubscribed(true);
      setStatusMsg({
        type: "success",
        text: language === "kh" 
          ? "🎉 បានបើកការជូនដំណឹងពីស្តុកទាប (< ៥ គ្រឿង) ជោគជ័យ!" 
          : "🎉 Low stock alerts enabled successfully (< 5 units)!"
      });
    } catch (err: any) {
      console.error("Notification setup error:", err);
      setStatusMsg({
        type: "error",
        text: language === "kh" 
          ? `បរាជ័យក្នុងការដំឡើង៖ ${err.message || "បញ្ហាបច្ចេកទេស"}` 
          : `Failed to enable alerts: ${err.message || "Unknown error"}`
      });
    } finally {
      setSubscribing(false);
    }
  };

  const handleTestNotifications = async () => {
    try {
      const res = await fetch("/api/notifications/test", {
        method: "POST"
      });
      if (!res.ok) {
        throw new Error("Failed to trigger test notification");
      }
      setStatusMsg({
        type: "success",
        text: language === "kh" 
          ? "🔔 សារសាកល្បងត្រូវបានផ្ញើ! សូមពិនិត្យមើលឧបករណ៍របស់អ្នក។" 
          : "🔔 Test notification sent! Please look at your device."
      });
    } catch (err: any) {
      console.error("Test notification error:", err);
      setStatusMsg({
        type: "error",
        text: language === "kh" 
          ? "មិនអាចផ្ញើសារសាកល្បងបានទេ (សូមប្រាកដថាអ្នកបានបើកការជូនដំណឹងជាមុនសិន)" 
          : "Failed to send test notifications (make sure alerts are enabled first)"
      });
    }
  };

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      console.log("'beforeinstallprompt' event was fired and deferred.");
    };
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleNativeInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User response to install prompt: ${outcome}`);
    if (outcome === "accepted") {
      setDeferredPrompt(null);
      setShowInstallModal(false);
    }
  };

  const t = translations[language];
  const currentAppUrl = (() => {
    if (typeof window === "undefined" || !window.location || !window.location.origin) {
      return "https://ais-pre-6oqzo3hi3dofmji35h4bc7-1030644106677.asia-southeast1.run.app";
    }
    return window.location.origin;
  })();

  const [shopData, setShopData] = useState<ShopData>({
    watches: [],
    sales: [],
    incomes: [],
    expenses: [],
    capitalTransactions: [],
    suppliers: [],
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<"dashboard" | "watches" | "sales" | "transactions" | "capital" | "ai" | "suppliers" | "accounts" | "audit" | "closings" | "settings">("dashboard");
  const [dashboardTimeRange, setDashboardTimeRange] = useState<"7_days" | "this_month" | "all_time">("all_time");

  // Filter/Search states
  const [watchSearch, setWatchSearch] = useState("");
  const [stockCountSearch, setStockCountSearch] = useState("");
  const [watchFilterCategory, setWatchFilterCategory] = useState("all");
  const [salesChannelFilter, setSalesChannelFilter] = useState<"all" | "online" | "instore">("all");
  const [salesPaymentMethodFilter, setSalesPaymentMethodFilter] = useState<string>("all");
  const [salesPaymentStatusFilter, setSalesPaymentStatusFilter] = useState<string>("all");
  const [showSalesAdvancedOpts, setShowSalesAdvancedOpts] = useState<boolean>(false);
  const [auditSearch, setAuditSearch] = useState("");
  const [auditActionFilter, setAuditActionFilter] = useState("all");

  // Watch Form State
  const [watchId, setWatchId] = useState("");
  const [watchBrand, setWatchBrand] = useState("");
  const [watchModel, setWatchModel] = useState("");
  const [watchCategory, setWatchCategory] = useState("Watch Quartz");
  const [watchColor, setWatchColor] = useState("");
  const [watchCostPrice, setWatchCostPrice] = useState<number | "">("");
  const [watchSellPrice, setWatchSellPrice] = useState<number | "">("");
  const [watchStock, setWatchStock] = useState<number | "">("");
  const [watchOldStock, setWatchOldStock] = useState<number | "">("");
  const [watchNewStock, setWatchNewStock] = useState<number | "">("");

  // Synchronize old/new stock into watchStock
  useEffect(() => {
    const oldVal = watchOldStock === "" ? 0 : Number(watchOldStock);
    const newVal = watchNewStock === "" ? 0 : Number(watchNewStock);
    setWatchStock(oldVal + newVal);
  }, [watchOldStock, watchNewStock]);

  // Synchronize exchangeRate in shopData into rateInput state
  useEffect(() => {
    if (shopData.exchangeRate) {
      setRateInput(String(shopData.exchangeRate));
    }
  }, [shopData.exchangeRate]);
  const [watchSupplierId, setWatchSupplierId] = useState("");
  const [watchLowStockThreshold, setWatchLowStockThreshold] = useState<number | "">(5);
  const [editingWatchId, setEditingWatchId] = useState<string | null>(null);

  // Color Breakdown state for Add/Edit Watch Form
  const [colorBreakdowns, setColorBreakdowns] = useState<{ color: string; oldStock: number; newStock: number }[]>([]);
  // Input fields for adding a color breakdown entry
  const [breakdownColorInput, setBreakdownColorInput] = useState("");
  const [breakdownOldStockInput, setBreakdownOldStockInput] = useState<number | "">("");
  const [breakdownNewStockInput, setBreakdownNewStockInput] = useState<number | "">("");

  // Intelligent Auto-Stock Entry State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isImportParsing, setIsImportParsing] = useState(false);
  const [importParseError, setImportParseError] = useState("");
  const [importParsingStep, setImportParsingStep] = useState("");
  const [importedWatches, setImportedWatches] = useState<any[]>([]);
  const [importDragActive, setImportDragActive] = useState(false);

  // Supplier Form State
  const [supId, setSupId] = useState("");
  const [supName, setSupName] = useState("");
  const [supContact, setSupContact] = useState("");
  const [supPhone, setSupPhone] = useState("");
  const [supEmail, setSupEmail] = useState("");
  const [supNotes, setSupNotes] = useState("");
  const [editingSupId, setEditingSupId] = useState<string | null>(null);
  const [supSearch, setSupSearch] = useState("");

  // Monthly Stock Take State
  const [activeWatchSubTab, setActiveWatchSubTab] = useState<"list" | "stocktake">("list");
  const [stockTakeMonth, setStockTakeMonth] = useState<string>(() => {
    const today = new Date();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    return `${today.getFullYear()}-${mm}`;
  });
  const [physicalCounts, setPhysicalCounts] = useState<Record<string, number>>({});
  const [stockTakeNotes, setStockTakeNotes] = useState("");
  const [selectedStockTakeId, setSelectedStockTakeId] = useState<string | null>(null);

  // Sale Form State
  const [selectedWatchId, setSelectedWatchId] = useState("");
  const [saleQuantity, setSaleQuantity] = useState<number | "">(1);
  const [customSellPrice, setCustomSellPrice] = useState<number | "">("");
  const [customSellPriceKHR, setCustomSellPriceKHR] = useState<number | "">("");
  const [paymentCurrency, setPaymentCurrency] = useState<"USD" | "KHR">("USD");
  const [sellPaymentMethod, setSellPaymentMethod] = useState<"cash" | "aba" | "acleda" | "cod">("cash");
  const [isSalePaid, setIsSalePaid] = useState<boolean>(true);
  const [codCarrier, setCodCarrier] = useState("");
  const [codSettlement, setCodSettlement] = useState<"cash" | "aba" | "acleda" | "split">("cash");
  const [codNotes, setCodNotes] = useState("");
  const [receivedCashAmount, setReceivedCashAmount] = useState<number | "">("");
  const [receivedCashUSD, setReceivedCashUSD] = useState<number | "">("");
  const [receivedCashKHR, setReceivedCashKHR] = useState<number | "">("");
  const [receivedABA, setReceivedABA] = useState<number | "">("");
  const [receivedAcleda, setReceivedAcleda] = useState<number | "">("");
  const [saleWatchSearchQuery, setSaleWatchSearchQuery] = useState("");
  const [saleWatchColor, setSaleWatchColor] = useState("");
  const [saleCustomerPhone, setSaleCustomerPhone] = useState("");
  const [saleCustomerLocation, setSaleCustomerLocation] = useState("");
  const [saleChannel, setSaleChannel] = useState<"instore" | "online">("instore");
  const [saleError, setSaleError] = useState("");
  const [saleDiscountPercent, setSaleDiscountPercent] = useState<number | "">("");
  const [saleStockType, setSaleStockType] = useState<"auto" | "old" | "new">("auto");
  const [rateInput, setRateInput] = useState<string>("4100");
  const [showAdvancedSaleOpts, setShowAdvancedSaleOpts] = useState(false);

  // Edit Sale Form State
  const [editingSale, setEditingSale] = useState<Sale | null>(null);
  const [editSaleDate, setEditSaleDate] = useState("");
  const [editSaleColor, setEditSaleColor] = useState("");
  const [editSaleQuantity, setEditSaleQuantity] = useState<number | "">("");
  const [editSaleSellPrice, setEditSaleSellPrice] = useState<number | "">("");
  const [editSaleDiscountPercent, setEditSaleDiscountPercent] = useState<number | "">("");
  const [editSalePaymentMethod, setEditSalePaymentMethod] = useState<"cash" | "aba" | "acleda" | "cod">("cash");
  const [editSalePaymentCurrency, setEditSalePaymentCurrency] = useState<"USD" | "KHR">("USD");
  const [editSaleIsPaid, setEditSaleIsPaid] = useState(true);
  const [editSaleSaleChannel, setEditSaleSaleChannel] = useState<"instore" | "online">("instore");
  const [editSaleCustomerPhone, setEditSaleCustomerPhone] = useState("");
  const [editSaleCustomerLocation, setEditSaleCustomerLocation] = useState("");
  const [editSaleError, setEditSaleError] = useState("");

  // Quick Sale Mode State
  const [quickSaleMode, setQuickSaleMode] = useState<boolean>(() => {
    return localStorage.getItem("kunthy_quick_sale_mode") === "true";
  });
  const [quickSaleSearch, setQuickSaleSearch] = useState("");

  // QR Scanner Modals State
  const [isQRModalOpenForSale, setIsQRModalOpenForSale] = useState(false);
  const [isQRModalOpenForWatchForm, setIsQRModalOpenForWatchForm] = useState(false);
  const [watchFormScanTime, setWatchFormScanTime] = useState<number>(0);
  const [isQRModalOpenForWatchSearch, setIsQRModalOpenForWatchSearch] = useState(false);

  // Bulk Restock State
  const [bulkRestockQtys, setBulkRestockQtys] = useState<Record<string, number>>({});

  // Other Income Form State
  const [incomeAmount, setIncomeAmount] = useState<number | "">("");
  const [incomeCategory, setIncomeCategory] = useState("");
  const [incomeDesc, setIncomeDesc] = useState("");
  const [incomeCurrency, setIncomeCurrency] = useState<"USD" | "KHR">("USD");

  // Expense Form State
  const [expenseAmount, setExpenseAmount] = useState<number | "">("");
  const [expenseCategory, setExpenseCategory] = useState<"rent" | "shipping" | "staff" | "marketing" | "other">("other");
  const [expenseDesc, setExpenseDesc] = useState("");
  const [expenseDate, setExpenseDate] = useState<string>(() => new Date().toISOString().split("T")[0]);
  const [expensePaymentMethod, setExpensePaymentMethod] = useState<string>("ABA Bank");
  const [expenseSearchQuery, setExpenseSearchQuery] = useState<string>("");
  const [expenseCategoryFilter, setExpenseCategoryFilter] = useState<string>("all");
  const [isExpenseRecurring, setIsExpenseRecurring] = useState<boolean>(false);
  const [expenseRecurringInterval, setExpenseRecurringInterval] = useState<"weekly" | "monthly" | "yearly">("monthly");
  const [expenseFutureCount, setExpenseFutureCount] = useState<number>(6);
  const [expenseStatusFilter, setExpenseStatusFilter] = useState<"all" | "paid" | "placeholder">("all");
  const [expenseCurrency, setExpenseCurrency] = useState<"USD" | "KHR">("USD");

  // Automated Supplier Reorder States
  const [isReorderModalOpen, setIsReorderModalOpen] = useState(false);
  const [reorderSelectedWatch, setReorderSelectedWatch] = useState<Watch | null>(null);
  const [reorderEmailSubject, setReorderEmailSubject] = useState("");
  const [reorderEmailBody, setReorderEmailBody] = useState("");
  const [reorderEmailRecipient, setReorderEmailRecipient] = useState("");
  const [autoPromptWatch, setAutoPromptWatch] = useState<Watch | null>(null);
  const [dismissedWatchPrompts, setDismissedWatchPrompts] = useState<Record<string, number>>({});

  // Capital Form State
  const [capitalType, setCapitalType] = useState<"initial" | "add" | "withdraw">("add");
  const [capitalAmount, setCapitalAmount] = useState<number | "">("");
  const [capitalDesc, setCapitalDesc] = useState("");

  // Message / Notification success banner
  const [statusMsg, setStatusMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Daily Sales Goal State
  const [dailySalesGoal, setDailySalesGoal] = useState<number>(() => {
    const saved = localStorage.getItem("kunthy_daily_sales_goal");
    return saved ? Number(saved) : 1000;
  });

  // Monthly Sales Goal State
  const [monthlySalesGoal, setMonthlySalesGoal] = useState<number>(() => {
    const saved = localStorage.getItem("kunthy_monthly_sales_goal");
    return saved ? Number(saved) : 30000;
  });

  // Expense Budget Limit Input State
  const [budgetLimitInput, setBudgetLimitInput] = useState<number | "">("");
  const [selectedInvoice, setSelectedInvoice] = useState<Sale | null>(null);
  const [showSlowStockDetails, setShowSlowStockDetails] = useState(false);

  // General System Settings Input States
  const [settingsShopName, setSettingsShopName] = useState("");
  const [settingsShopPhone, setSettingsShopPhone] = useState("");
  const [settingsDefaultSalesChannel, setSettingsDefaultSalesChannel] = useState<"instore" | "online">("instore");
  const [settingsEnableCod, setSettingsEnableCod] = useState(true);
  const [settingsCodCarrierDefault, setSettingsCodCarrierDefault] = useState("");
  const [settingsTaxPercent, setSettingsTaxPercent] = useState<number | "">("");

  // Sync general settings states when shopData loads
  useEffect(() => {
    if (shopData?.settings) {
      setSettingsShopName(shopData.settings.shopName || "");
      setSettingsShopPhone(shopData.settings.shopPhone || "");
      setSettingsDefaultSalesChannel(shopData.settings.defaultSalesChannel || "instore");
      setSettingsEnableCod(shopData.settings.enableCod !== false);
      setSettingsCodCarrierDefault(shopData.settings.codCarrierDefault || "");
      setSettingsTaxPercent(shopData.settings.taxPercent !== undefined ? shopData.settings.taxPercent : "");
    }
  }, [shopData]);

  // Periodic Low Stock Reorder Suggester Effect (triggers every 30 seconds)
  useEffect(() => {
    if (userRole !== "owner") return;

    const runReorderCheck = () => {
      // Find all watches below custom or default low stock threshold
      const lowWatches = shopData.watches.filter((w) => {
        const threshold = w.lowStockThreshold !== undefined ? w.lowStockThreshold : 5;
        if (w.stock >= threshold) return false;

        // Check if we already dismissed or auto-prompted this watch in the last 15 minutes (900000 ms)
        const lastDismissed = dismissedWatchPrompts[w.id] || 0;
        if (Date.now() - lastDismissed < 900000) return false;

        return true;
      });

      if (lowWatches.length > 0) {
        // Pick the watch with the lowest stock relative to its threshold
        const chosenWatch = lowWatches.sort((a, b) => {
          const gapA = (a.lowStockThreshold !== undefined ? a.lowStockThreshold : 5) - a.stock;
          const gapB = (b.lowStockThreshold !== undefined ? b.lowStockThreshold : 5) - b.stock;
          return gapB - gapA; // highest gap first
        })[0];

        setAutoPromptWatch(chosenWatch);
      }
    };

    // Run initial scan after 5 seconds
    const initialTimeout = setTimeout(runReorderCheck, 5000);

    const interval = setInterval(runReorderCheck, 30000); // scan every 30 seconds

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
    };
  }, [shopData.watches, dismissedWatchPrompts, userRole]);

  const handleOpenReorderModal = (watch: Watch) => {
    setReorderSelectedWatch(watch);
    const supplier = (shopData.suppliers || []).find((s) => s.id === watch.supplierId);
    const emailRecipient = supplier?.email || "";
    setReorderEmailRecipient(emailRecipient);

    const subject = `Order Request: ${watch.brand} ${watch.model} - SKU: ${watch.id}`;
    
    const body = `Dear ${supplier?.contactName || supplier?.name || "Supplier Partner"},

I am writing from Kunthy Watch Store to request a restock order for:
- Brand: ${watch.brand}
- Model: ${watch.model}
- SKU / ID: ${watch.id}
- Color: ${watch.color}

Our current stock level is down to ${watch.stock} units, which has fallen below our defined threshold of ${watch.lowStockThreshold !== undefined ? watch.lowStockThreshold : 5} units.

Could you please quote pricing and availability for a restock quantity of 10 units?

Best regards,
Store Owner
Kunthy Watch Store
Phone: ${shopData.settings?.shopPhone || ""}`;

    setReorderEmailSubject(subject);
    setReorderEmailBody(body);
    setIsReorderModalOpen(true);
  };

  // Data Backup States
  const [lastBackupDate, setLastBackupDate] = useState<string>(() => {
    return localStorage.getItem("kunthy_last_backup_date") || "";
  });
  const [showBackupPrompt, setShowBackupPrompt] = useState(false);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [isSaleFormCollapsed, setIsSaleFormCollapsed] = useState(false);
  const [showUpdateBanner, setShowUpdateBanner] = useState<boolean>(true);

  // Book/Period Closings State
  const [closingPeriodType, setClosingPeriodType] = useState<"month" | "year">("month");
  const [closingYear, setClosingYear] = useState<number>(() => new Date().getFullYear());
  const [closingMonth, setClosingMonth] = useState<number>(() => new Date().getMonth() + 1);
  const [closingNotes, setClosingNotes] = useState<string>("");
  const [viewingClosedPeriod, setViewingClosedPeriod] = useState<ClosedPeriod | null>(null);

  // User Accounts Form State
  const [newAccUsername, setNewAccUsername] = useState("");
  const [newAccPassword, setNewAccPassword] = useState("");
  const [newAccName, setNewAccName] = useState("");
  const [newAccRole, setNewAccRole] = useState<'owner' | 'staff'>("staff");
  const [editingAccId, setEditingAccId] = useState<string | null>(null);
  const [revealedPasswords, setRevealedPasswords] = useState<Record<string, boolean>>({});

  // Check login and theme on mount
  useEffect(() => {
    const savedLogin = localStorage.getItem("chrono_is_logged_in");
    if (savedLogin === "true") {
      setIsLoggedIn(true);
      const role = localStorage.getItem("chrono_user_role") as "owner" | "staff" || "owner";
      const name = localStorage.getItem("chrono_user_name") || "Kunthy";
      setUserRole(role);
      setUserName(name);
      if (role === "staff") {
        setActiveTab("watches");
      }
    }
    const savedLang = localStorage.getItem("kunthy_lang") as Language || "kh";
    setLanguage(savedLang);
    const savedTheme = localStorage.getItem("kunthy_theme") as "dark" | "light" || "dark";
    setTheme(savedTheme);
  }, []);

  // Fetch shop data
  useEffect(() => {
    if (isLoggedIn) {
      loadData();
    }
  }, [isLoggedIn]);

  // Sync budgetLimitInput when shopData loads or updates
  useEffect(() => {
    if (shopData && shopData.expenseBudgetLimit !== undefined) {
      setBudgetLimitInput(shopData.expenseBudgetLimit);
    }
  }, [shopData]);

  // Auto-fill saleWatchColor when selectedWatchId changes
  useEffect(() => {
    if (selectedWatchId) {
      const w = shopData.watches.find((wt) => wt.id === selectedWatchId);
      if (w) {
        setSaleWatchColor(w.color || "");
      }
    } else {
      setSaleWatchColor("");
    }
  }, [selectedWatchId, shopData.watches]);

  // Check for weekly backup recommendation
  useEffect(() => {
    if (isLoggedIn) {
      const lastBackupStr = localStorage.getItem("kunthy_last_backup_date");
      if (!lastBackupStr) {
        // Never backed up, show prompt after a short delay so layout is loaded
        const timer = setTimeout(() => setShowBackupPrompt(true), 2500);
        return () => clearTimeout(timer);
      } else {
        const lastDate = new Date(lastBackupStr);
        const diffTime = Math.abs(new Date().getTime() - lastDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays >= 7) {
          const timer = setTimeout(() => setShowBackupPrompt(true), 2500);
          return () => clearTimeout(timer);
        }
      }
    } else {
      setShowBackupPrompt(false);
    }
  }, [isLoggedIn]);

  const loadData = async (force: boolean = false) => {
    setLoading(true);
    setSyncState("syncing");

    // 1. Instantly read from local offline cache
    const cachedStr = localStorage.getItem("kunthy_shop_data_cache");
    let cachedData: ShopData | null = null;
    if (cachedStr && !force) {
      try {
        cachedData = JSON.parse(cachedStr);
        if (cachedData) {
          setShopData(cachedData);
        }
      } catch (e) {
        console.error("Failed to parse cached data:", e);
      }
    }

    try {
      // 2. Pull the latest from server
      const serverData = await fetchShopData();
      if (serverData) {
        if (force) {
          setShopData(serverData);
          localStorage.setItem("kunthy_shop_data_cache", JSON.stringify(serverData));
          setSyncState("synced");
          showNotice(
            "success",
            language === "kh"
              ? "🔄 បានទាញយកទិន្នន័យចុងក្រោយបំផុតពី Cloud មកជំនួសជោគជ័យ!"
              : "🔄 Fresh cloud state successfully pulled and cached!"
          );
          return;
        }
        // Compare timestamps
        if (!cachedData || !cachedData.lastUpdated || (serverData.lastUpdated && serverData.lastUpdated >= cachedData.lastUpdated)) {
          // Server has newer (or equal) version or local cache is empty
          setShopData(serverData);
          localStorage.setItem("kunthy_shop_data_cache", JSON.stringify(serverData));
          setSyncState("synced");
        } else if (cachedData && cachedData.lastUpdated && (!serverData.lastUpdated || cachedData.lastUpdated > serverData.lastUpdated)) {
          // Local cache has newer modifications made during offline edit
          await saveShopData(cachedData);
          setSyncState("synced");
          showNotice(
            "success",
            language === "kh"
              ? "🔄 ទិន្នន័យក្រៅប្រព័ន្ធត្រូវបានសមកាលកម្មទៅកាន់ម៉ាស៊ីនបម្រើដោយជោគជ័យ!"
              : "🔄 Offline data successfully synced to the cloud!"
          );
        } else {
          setSyncState("synced");
        }
      } else {
        setSyncState("synced");
      }
    } catch (err) {
      console.warn("Server connection failed during loadData. Running in offline mode...", err);
      setSyncState("offline");
      if (!cachedData) {
        showNotice(
          "error",
          language === "kh"
            ? "មិនអាចទាញយកទិន្នន័យពីម៉ាស៊ីនបម្រើបានទេ!"
            : "Unable to load data from server!"
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLoginSuccess = (role: "owner" | "staff", name: string) => {
    setIsLoggedIn(true);
    setUserRole(role);
    setUserName(name);
    if (role === "staff") {
      setActiveTab("watches");
    } else {
      setActiveTab("dashboard");
    }
    localStorage.setItem("chrono_is_logged_in", "true");
    localStorage.setItem("chrono_user_role", role);
    localStorage.setItem("chrono_user_name", name);
    const msg = language === "kh"
      ? `សូមស្វាគមន៍មកកាន់ប្រព័ន្ធគ្រប់គ្រងហាងលក់នាឡិកាដៃ! គណនី៖ ${name} (${role === "owner" ? "ម្ចាស់ហាង" : "បុគ្គលិក"})`
      : `Welcome back! Account: ${name} (${role === "owner" ? "Owner" : "Staff"})`;
    showNotice("success", msg);
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    localStorage.removeItem("chrono_is_logged_in");
    localStorage.removeItem("chrono_user_role");
    localStorage.removeItem("chrono_user_name");
  };

  const toggleLanguage = () => {
    const nextLang: Language = language === "kh" ? "en" : "kh";
    setLanguage(nextLang);
    localStorage.setItem("kunthy_lang", nextLang);
  };

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    localStorage.setItem("kunthy_theme", nextTheme);
  };

  const handleExportSalesToCSV = () => {
    if (shopData.sales.length === 0) {
      showNotice("error", language === "kh" ? "គ្មានទិន្នន័យសម្រាប់នាំចេញទេ!" : "No sales data available for export!");
      return;
    }

    // Headers
    const headers = [
      language === "kh" ? "កាលបរិច្ឆេទ" : "Date",
      language === "kh" ? "កូដលក់" : "Sale ID",
      language === "kh" ? "កូដនាឡិកា" : "Watch ID",
      language === "kh" ? "ម៉ាក" : "Brand",
      language === "kh" ? "ម៉ូដែល" : "Model",
      language === "kh" ? "ពណ៌" : "Color",
      language === "kh" ? "បរិមាណ" : "Quantity",
      language === "kh" ? "តម្លៃដើម ($)" : "Cost Price ($)",
      language === "kh" ? "តម្លៃលក់ ($)" : "Sell Price ($)",
      language === "kh" ? "សរុបប្រាក់លក់ ($)" : "Total Amount ($)",
      language === "kh" ? "ប្រាក់ចំណេញ ($)" : "Profit ($)"
    ];

    // Rows
    const csvRows = shopData.sales.slice().reverse().map((sale) => {
      return [
        sale.date,
        `"${sale.id}"`,
        `"${sale.watchId}"`,
        `"${sale.watchBrand.replace(/"/g, '""')}"`,
        `"${sale.watchModel.replace(/"/g, '""')}"`,
        `"${sale.watchColor.replace(/"/g, '""')}"`,
        sale.quantity,
        sale.costPrice,
        sale.sellPrice,
        sale.totalAmount,
        sale.profit
      ].join(",");
    });

    // Combine headers and rows with UTF-8 BOM
    const csvContent = "\uFEFF" + [headers.join(","), ...csvRows].join("\n");

    // Trigger download
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Kunthy_Watch_Store_Sales_Export_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showNotice("success", language === "kh" ? "នាំចេញរបាយការណ៍លក់ជា CSV ជោគជ័យ!" : "Sales report exported to CSV successfully!");
  };

  const triggerDataBackup = () => {
    try {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(shopData, null, 2));
      const downloadAnchor = document.createElement("a");
      downloadAnchor.setAttribute("href", dataStr);
      const dateStr = new Date().toISOString().split("T")[0];
      downloadAnchor.setAttribute("download", `Kunthy_Watch_Store_Backup_${dateStr}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();

      // update states & localStorage
      const nowStr = new Date().toISOString();
      setLastBackupDate(nowStr);
      localStorage.setItem("kunthy_last_backup_date", nowStr);
      setShowBackupPrompt(false);

      showNotice(
        "success",
        language === "kh"
          ? "បានទាញយកទិន្នន័យបម្រុងទុក (JSON) ជោគជ័យ!"
          : "Full JSON backup snapshot downloaded successfully!"
      );
    } catch (error) {
      showNotice(
        "error",
        language === "kh"
          ? "មានបញ្ហាបច្ចេកទេសក្នុងទាញយកបម្រុងទុក!"
          : "Technical fault downloading database snapshot!"
      );
    }
  };

  const handleRestoreBackupFile = (file: File) => {
    if (!file) return;
    
    const extension = file.name.split(".").pop()?.toLowerCase();
    if (extension !== "json") {
      showNotice(
        "error",
        language === "kh"
          ? "ប្រភេទឯកសារមិនត្រឹមត្រូវ! សូមជ្រើសរើសឯកសារប្រភេទ .json"
          : "Invalid file type! Please select a .json file format."
      );
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const fileContent = e.target?.result as string;
        const parsedData = JSON.parse(fileContent);

        if (!parsedData || typeof parsedData !== "object") {
          throw new Error("Invalid structure");
        }

        if (!Array.isArray(parsedData.watches) || !Array.isArray(parsedData.sales)) {
          throw new Error("Missing watches or sales arrays");
        }

        const messageKh = "តើអ្នកពិតជាចង់សង្គ្រោះទិន្នន័យពីឯកសារ Backup នេះមែនទេ? ទិន្នន័យបច្ចុប្បន្ននឹងត្រូវជំនួសដោយទិន្នន័យថ្មីនេះ។";
        const messageEn = "Are you sure you want to restore the database from this backup file? All current data will be overwritten with this new data.";
        
        if (window.confirm(language === "kh" ? messageKh : messageEn)) {
          const logDetails = language === "kh"
            ? `បានសង្គ្រោះទិន្នន័យពីឯកសារបម្រុងទុក (កាលបរិច្ឆេទឯកសារ៖ ${parsedData.lastUpdated ? new Date(parsedData.lastUpdated).toLocaleString() : "មិនស្គាល់"})`
            : `Restored entire database from backup file (file date: ${parsedData.lastUpdated ? new Date(parsedData.lastUpdated).toLocaleString() : "unknown"})`;

          await persistData(parsedData, "RESTORE_BACKUP", logDetails);
          setIsBackupModalOpen(false);
          showNotice(
            "success",
            language === "kh"
              ? "បានសង្គ្រោះទិន្នន័យពីឯកសារបម្រុងទុកដោយជោគជ័យ!"
              : "Successfully restored all database tables from JSON backup file!"
          );
        }
      } catch (err: any) {
        showNotice(
          "error",
          language === "kh"
            ? "ឯកសារ Backup មិនត្រឹមត្រូវ ឬខូចទ្រង់ទ្រាយ!"
            : "Invalid or corrupted JSON backup file format!"
        );
      }
    };
    reader.onerror = () => {
      showNotice(
        "error",
        language === "kh"
          ? "មិនអាចអានឯកសារបានឡើយ!"
          : "Failed to read the backup file!"
      );
    };
    reader.readAsText(file);
  };

  const showNotice = (type: "success" | "error", text: string) => {
    setStatusMsg({ type, text });
    setTimeout(() => {
      setStatusMsg(null);
    }, 4500);
  };

  const handleUpdateExchangeRate = async (newRate: number) => {
    if (isNaN(newRate) || newRate <= 0) return;
    const oldRate = shopData.exchangeRate || 4100;
    if (newRate === oldRate) return;
    
    const updatedData = {
      ...shopData,
      exchangeRate: newRate
    };
    
    const logDetails = language === "kh" 
      ? `បានកែប្រែអត្រាដូរប្រាក់ពី 1$ = ${oldRate.toLocaleString()}៛ ទៅ 1$ = ${newRate.toLocaleString()}៛`
      : `Updated exchange rate from 1$ = ${oldRate.toLocaleString()} KHR to 1$ = ${newRate.toLocaleString()} KHR`;
      
    await persistData(updatedData, "UPDATE_EXCHANGE_RATE", logDetails);
    showNotice("success", language === "kh" ? "បានធ្វើបច្ចុប្បន្នភាពអត្រាដូរប្រាក់ជោគជ័យ!" : "Exchange rate updated successfully!");
  };

  const addAuditLog = (action: string, details: string, dataObj: ShopData = shopData): ShopData => {
    const newLog = {
      id: "LOG-" + Date.now().toString().slice(-6) + "-" + Math.random().toString(36).slice(2, 5),
      action,
      details,
      user: userName || "Unknown User",
      timestamp: new Date().toISOString(),
    };
    return {
      ...dataObj,
      auditLogs: [newLog, ...(dataObj.auditLogs || [])].slice(0, 500)
    };
  };

  const persistData = async (newData: ShopData, logAction?: string, logDetails?: string) => {
    let finalData = newData;
    if (logAction && logDetails) {
      finalData = addAuditLog(logAction, logDetails, newData);
    }

    // 1. Inject timestamp for tracking/synchronization
    const updatedWithTime = {
      ...finalData,
      lastUpdated: Date.now()
    };
    
    // 2. Persist to React memory state and browser localStorage instantly
    setShopData(updatedWithTime);
    localStorage.setItem("kunthy_shop_data_cache", JSON.stringify(updatedWithTime));
    setSyncState("syncing");

    // 3. Trigger background sync to server/database
    try {
      await saveShopData(updatedWithTime);
      setSyncState("synced");
    } catch (err) {
      console.warn("Background cloud backup failed. Stored offline locally.", err);
      setSyncState("offline");
    }
  };

  const handleForceUpdateApp = async () => {
    if (window.confirm(language === "kh" 
      ? "តើអ្នកចង់បង្ខំសម្អាត Cache និងធ្វើបច្ចុប្បន្នភាព App ទៅកាន់កំណែថ្មីចុងក្រោយបំផុតមែនទេ?" 
      : "Are you sure you want to force clear cache and update the app to the absolute latest version?"
    )) {
      try {
        // Unregister service workers
        if ("serviceWorker" in navigator) {
          const registrations = await navigator.serviceWorker.getRegistrations();
          for (let registration of registrations) {
            await registration.unregister();
          }
        }
        // Clear all caches
        if ("caches" in window) {
          const cacheNames = await caches.keys();
          for (let cacheName of cacheNames) {
            await caches.delete(cacheName);
          }
        }
        showNotice("success", language === "kh" 
          ? "🔄 កំពុងសម្អាត និងទាញយកកំណែថ្មីបំផុត..." 
          : "🔄 Clearing and pulling the newest version..."
        );
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      } catch (err) {
        console.error("Failed to force update PWA:", err);
        window.location.reload();
      }
    }
  };

  const handleResetData = async () => {
    if (window.confirm("តើអ្នកពិតជាចង់សម្អាត និងកំណត់ទិន្នន័យហាងឡើងវិញទាំងអស់មែនទេ?")) {
      try {
        const resetData = await resetShopData();
        const updated = { ...resetData, lastUpdated: Date.now() };
        setShopData(updated);
        localStorage.setItem("kunthy_shop_data_cache", JSON.stringify(updated));
        setSyncState("synced");
        showNotice("success", "ទិន្នន័យហាងទាំងអស់ត្រូវបានកំណត់ឡើងវិញដោយជោគជ័យ!");
      } catch (err) {
        console.warn("Server reset failed, performing offline fallback reset...", err);
        const localReset = {
          watches: [],
          sales: [],
          incomes: [],
          expenses: [],
          capitalTransactions: [],
          suppliers: [],
          lastUpdated: Date.now()
        };
        setShopData(localReset);
        localStorage.setItem("kunthy_shop_data_cache", JSON.stringify(localReset));
        setSyncState("offline");
        showNotice("success", "ទិន្នន័យត្រូវបានកំណត់ឡើងវិញនៅក្នុងកម្មវិធីរុករករបស់អ្នក (ក្រៅបណ្តាញ)!");
      }
    }
  };

  // --- Handlers for STOCK (Watches) ---
  const handleAddOrUpdateWatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!watchId || !watchBrand || !watchModel || watchCostPrice === "" || watchSellPrice === "") {
      showNotice("error", language === "kh" ? "សូមបំពេញព័ត៌មាននាឡិកាឱ្យបានគ្រប់ជ្រុងជ្រោយ (លើកលែងតែពណ៌)!" : "Please fill out all required fields (Color is optional)!");
      return;
    }

    const costNum = Number(watchCostPrice);
    const sellNum = Number(watchSellPrice);

    let finalColor = (watchColor || "").trim() || (language === "kh" ? "ទូទៅ" : "General");
    let oldStockNum = watchOldStock === "" ? 0 : Number(watchOldStock);
    let newStockNum = watchNewStock === "" ? 0 : Number(watchNewStock);
    let stockNum = oldStockNum + newStockNum;
    let compiledBreakdown: { color: string; qty: number; oldQty?: number; newQty?: number }[] | undefined = undefined;

    if (colorBreakdowns.length > 0) {
      oldStockNum = colorBreakdowns.reduce((acc, cb) => acc + Number(cb.oldStock || 0), 0);
      newStockNum = colorBreakdowns.reduce((acc, cb) => acc + Number(cb.newStock || 0), 0);
      stockNum = oldStockNum + newStockNum;
      finalColor = Array.from(new Set(colorBreakdowns.map(cb => cb.color.trim()).filter(Boolean))).join(", ") || (language === "kh" ? "ទូទៅ" : "General");
      compiledBreakdown = colorBreakdowns.map(cb => ({
        color: cb.color.trim(),
        qty: Number(cb.oldStock || 0) + Number(cb.newStock || 0),
        oldQty: Number(cb.oldStock || 0),
        newQty: Number(cb.newStock || 0)
      }));
    }

    if (costNum < 0 || sellNum < 0 || stockNum < 0) {
      showNotice("error", "តម្លៃ និងចំនួនស្តុកមិនអាចតូចជាង ០ បានទេ!");
      return;
    }

    if (editingWatchId) {
      // Editing watch mode
      // Check if user changed ID and if that new ID already exists
      if (watchId.trim() !== editingWatchId && shopData.watches.some((w) => w.id === watchId.trim())) {
        showNotice("error", "លេខកូដនាឡិកា (ID) ថ្មីនេះមានរួចហើយ! សូមប្រើប្រាស់លេខកូដផ្សេង!");
        return;
      }

      const existingWatch = shopData.watches.find((w) => w.id === editingWatchId);
      const existingStock = existingWatch ? existingWatch.stock : 0;
      const addedStock = stockNum - existingStock;

      const thresholdNum = watchLowStockThreshold === "" ? 5 : Number(watchLowStockThreshold);

      const updatedWatches = shopData.watches.map((w) =>
        w.id === editingWatchId
          ? {
              ...w,
              id: watchId.trim(),
              brand: watchBrand,
              model: watchModel,
              category: watchCategory,
              color: finalColor,
              costPrice: costNum,
              sellPrice: sellNum,
              stock: stockNum,
              oldStock: oldStockNum,
              newStock: newStockNum,
              supplierId: watchSupplierId,
              lowStockThreshold: thresholdNum,
              colorBreakdown: compiledBreakdown
            }
          : w
      );

      // Cascade watch ID and name update to sales
      const updatedSales = (shopData.sales || []).map((s) =>
        s.watchId === editingWatchId
          ? {
              ...s,
              watchId: watchId.trim(),
              watchBrand: watchBrand,
              watchModel: watchModel,
              watchColor: finalColor
            }
          : s
      );

      // Cascade watch ID update to linked sale incomes description
      const updatedIncomes = (shopData.incomes || []).map((inc) => {
        if (inc.source === "sale" && inc.description?.includes(`(កូដ: ${editingWatchId})`)) {
          return {
            ...inc,
            description: inc.description.replace(`(កូដ: ${editingWatchId})`, `(កូដ: ${watchId.trim()})`)
          };
        }
        return inc;
      });

      let nextCapitalTransactions = shopData.capitalTransactions || [];
      if (addedStock > 0) {
        const depositAmount = addedStock * costNum;
        const desc = language === "kh"
          ? `ប្រាក់ដើមកត់ត្រាពេលបន្ថែមស្តុក៖ ${watchBrand} ${watchModel} (+${addedStock} គ្រឿង)`
          : `Capital deposit from adding stock: ${watchBrand} ${watchModel} (+${addedStock} units)`;

        const newTransaction: CapitalTransaction = {
          id: "CAP-" + Date.now().toString().slice(-6) + Math.random().toString().slice(2, 4),
          type: "add",
          amount: depositAmount,
          description: desc,
          date: new Date().toISOString().split("T")[0],
        };
        nextCapitalTransactions = [...nextCapitalTransactions, newTransaction];
      }

      await persistData({
        ...shopData,
        watches: updatedWatches,
        sales: updatedSales,
        incomes: updatedIncomes,
        capitalTransactions: nextCapitalTransactions
      });
      showNotice("success", `ការកែប្រែនាឡិកាលេខកូដ ${watchId} បានជោគជ័យ!`);
      setEditingWatchId(null);
    } else {
      // Check duplicate ID
      if (shopData.watches.some((w) => w.id === watchId.trim())) {
        showNotice("error", "លេខកូដនាឡិកា (ID) នេះមានរួចហើយ! សូមប្រើប្រាស់លេខកូដផ្សេង!");
        return;
      }
      const thresholdNum = watchLowStockThreshold === "" ? 5 : Number(watchLowStockThreshold);
      const newWatch: Watch = {
        id: watchId.trim(),
        brand: watchBrand,
        model: watchModel,
        category: watchCategory,
        color: finalColor,
        costPrice: costNum,
        sellPrice: sellNum,
        stock: stockNum,
        oldStock: oldStockNum,
        newStock: newStockNum,
        supplierId: watchSupplierId || undefined,
        lowStockThreshold: thresholdNum,
        colorBreakdown: compiledBreakdown
      };

      let nextCapitalTransactions = shopData.capitalTransactions || [];
      if (stockNum > 0) {
        const depositAmount = stockNum * costNum;
        const desc = language === "kh"
          ? `ប្រាក់ដើមដំបូងកត់ត្រាពេលបញ្ចូលស្តុក៖ ${watchBrand} ${watchModel} (+${stockNum} គ្រឿង)`
          : `Initial capital deposit for stocking: ${watchBrand} ${watchModel} (+${stockNum} units)`;

        const newTransaction: CapitalTransaction = {
          id: "CAP-" + Date.now().toString().slice(-6) + Math.random().toString().slice(2, 4),
          type: "add",
          amount: depositAmount,
          description: desc,
          date: new Date().toISOString().split("T")[0],
        };
        nextCapitalTransactions = [...nextCapitalTransactions, newTransaction];
      }

      await persistData({
        ...shopData,
        watches: [...shopData.watches, newWatch],
        capitalTransactions: nextCapitalTransactions,
      });
      showNotice("success", `បានបន្ថែមនាឡិកាថ្មី ${watchBrand} ${watchModel} ទៅក្នុងស្តុក!`);
    }

    // Reset Form
    setWatchId("");
    setWatchBrand("");
    setWatchModel("");
    setWatchCategory("Watch Quartz");
    setWatchColor("");
    setWatchCostPrice("");
    setWatchSellPrice("");
    setWatchStock("");
    setWatchOldStock("");
    setWatchNewStock("");
    setWatchSupplierId("");
    setWatchLowStockThreshold(5);
    setColorBreakdowns([]);
  };

  const handleEditWatch = (w: Watch) => {
    setEditingWatchId(w.id);
    setWatchId(w.id);
    setWatchBrand(w.brand);
    setWatchModel(w.model);
    setWatchCategory(w.category || "Watch Quartz");
    setWatchColor(w.color);
    setWatchCostPrice(w.costPrice);
    setWatchSellPrice(w.sellPrice);
    setWatchStock(w.stock);
    setWatchOldStock(w.oldStock !== undefined ? w.oldStock : w.stock);
    setWatchNewStock(w.newStock !== undefined ? w.newStock : 0);
    setWatchSupplierId(w.supplierId || "");
    setWatchLowStockThreshold(w.lowStockThreshold !== undefined ? w.lowStockThreshold : 5);
    
    if (w.colorBreakdown) {
      setColorBreakdowns(
        w.colorBreakdown.map((cb) => ({
          color: cb.color,
          oldStock: cb.oldQty !== undefined ? cb.oldQty : cb.qty,
          newStock: cb.newQty !== undefined ? cb.newQty : 0,
        }))
      );
    } else {
      if (w.color) {
        setColorBreakdowns([
          {
            color: w.color,
            oldStock: w.oldStock !== undefined ? w.oldStock : w.stock,
            newStock: w.newStock !== undefined ? w.newStock : 0,
          },
        ]);
      } else {
        setColorBreakdowns([]);
      }
    }
  };

  const handleDeleteWatch = async (id: string) => {
    if (window.confirm(`តើអ្នកពិតជាចង់លុបនាឡិកាកូដ ${id} ចេញពីស្តុកមែនទេ?`)) {
      const filtered = shopData.watches.filter((w) => w.id !== id);
      await persistData({ ...shopData, watches: filtered });
      showNotice("success", "បានលុបនាឡិកាចេញពីបន្ទះស្តុក!");
    }
  };

  const handleCancelEditWatch = () => {
    setEditingWatchId(null);
    setWatchId("");
    setWatchBrand("");
    setWatchModel("");
    setWatchCategory("Watch Quartz");
    setWatchColor("");
    setWatchCostPrice("");
    setWatchSellPrice("");
    setWatchStock("");
    setWatchOldStock("");
    setWatchNewStock("");
    setWatchSupplierId("");
    setColorBreakdowns([]);
  };

  // --- Handlers for AI Auto-Stock Import ---
  const handleAutoStockFileUpload = async (file: File) => {
    if (!file) return;
    setIsImportParsing(true);
    setImportParseError("");
    setImportParsingStep(language === "kh" ? "កំពុងអានឯកសារ..." : "Reading file...");
    
    try {
      const extension = file.name.split(".").pop()?.toLowerCase();
      
      if (extension === "pdf") {
        setImportParsingStep(language === "kh" ? "កំពុងបំប្លែង PDF..." : "Processing PDF...");
        const reader = new FileReader();
        reader.onload = async (e) => {
          try {
            const result = e.target?.result as string;
            const base64Data = result.split(",")[1];
            
            setImportParsingStep(language === "kh" ? "កំពុងផ្ញើទៅកាន់ AI របស់ Google ដើម្បីវិភាគ..." : "Gemini AI is analyzing invoice layout & columns...");
            
            const response = await fetch("/api/gemini/parse-stock", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ fileBase64: base64Data, mimeType: file.type })
            });
            
            if (!response.ok) {
              const errData = await response.json();
              throw new Error(errData.error || "Failed to parse PDF");
            }
            
            const data = await response.json();
            if (data.success) {
              setImportedWatches(data.watches || []);
              setIsImportModalOpen(true);
            } else {
              throw new Error("AI could not extract structured data");
            }
          } catch (err: any) {
            setImportParseError(err.message || "Error parsing file");
          } finally {
            setIsImportParsing(false);
          }
        };
        reader.onerror = () => {
          setImportParseError("Failed to read file contents");
          setIsImportParsing(false);
        };
        reader.readAsDataURL(file);
        
      } else if (["xlsx", "xls", "csv"].includes(extension || "")) {
        setImportParsingStep(language === "kh" ? "កំពុងអានតារាង Excel/CSV..." : "Reading Excel/CSV sheets...");
        const reader = new FileReader();
        reader.onload = async (e) => {
          try {
            const dataResult = e.target?.result;
            const workbook = XLSX.read(dataResult, { type: "array" });
            let fullText = "";
            
            workbook.SheetNames.forEach((sheetName) => {
              const worksheet = workbook.Sheets[sheetName];
              const csv = XLSX.utils.sheet_to_csv(worksheet);
              fullText += `Sheet: ${sheetName}\n${csv}\n\n`;
            });
            
            setImportParsingStep(language === "kh" ? "កំពុងបញ្ជូនតារាងទៅកាន់ AI ដើម្បីវិភាគ..." : "Gemini AI is analyzing layout & rows...");
            
            const response = await fetch("/api/gemini/parse-stock", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ text: fullText })
            });
            
            if (!response.ok) {
              const errData = await response.json();
              throw new Error(errData.error || "Failed to parse Excel");
            }
            
            const data = await response.json();
            if (data.success) {
              setImportedWatches(data.watches || []);
              setIsImportModalOpen(true);
            } else {
              throw new Error("AI could not extract structured data");
            }
          } catch (err: any) {
            setImportParseError(err.message || "Error parsing Excel");
          } finally {
            setIsImportParsing(false);
          }
        };
        reader.onerror = () => {
          setImportParseError("Failed to read file");
          setIsImportParsing(false);
        };
        reader.readAsArrayBuffer(file);
        
      } else {
        throw new Error(language === "kh" ? "ប្រភេទឯកសារមិនគាំទ្រទេ! សូមប្រើប្រាស់ PDF, Excel ឬ CSV។" : "Unsupported file type! Please upload PDF, Excel, or CSV.");
      }
      
    } catch (err: any) {
      setImportParseError(err.message || "Unknown error");
      setIsImportParsing(false);
    }
  };

  const handleUpdateImportedWatchField = (index: number, field: string, value: any) => {
    const updated = [...importedWatches];
    updated[index] = {
      ...updated[index],
      [field]: value
    };
    setImportedWatches(updated);
  };

  const handleDeleteImportedWatch = (index: number) => {
    const updated = importedWatches.filter((_, i) => i !== index);
    setImportedWatches(updated);
  };

  const handleConfirmImportStock = async () => {
    if (importedWatches.length === 0) {
      showNotice("error", language === "kh" ? "គ្មានទិន្នន័យនាឡិកាត្រូវបញ្ចូលទេ!" : "No watches to import!");
      return;
    }

    let nextWatches = [...shopData.watches];
    let nextCapitalTransactions = shopData.capitalTransactions || [];
    let addedCount = 0;
    let updatedCount = 0;
    let totalCostAmount = 0;
    const descParts: string[] = [];

    for (const impWatch of importedWatches) {
      const cleanId = (impWatch.id || "").trim();
      const cleanBrand = (impWatch.brand || "").trim();
      const cleanModel = (impWatch.model || "").trim();
      if (!cleanId || !cleanBrand || !cleanModel) continue;

      const costPrice = Number(impWatch.costPrice) || 0;
      const sellPrice = Number(impWatch.sellPrice) || 0;
      const stockQty = Number(impWatch.stock) || 0;

      // Check if duplicate exists
      const existingIdx = nextWatches.findIndex((w) => w.id === cleanId);

      if (existingIdx >= 0) {
        // Increment stock
        const currentWatch = nextWatches[existingIdx];
        const prevStock = currentWatch.stock || 0;
        
        nextWatches[existingIdx] = {
          ...currentWatch,
          costPrice: costPrice > 0 ? costPrice : currentWatch.costPrice,
          sellPrice: sellPrice > 0 ? sellPrice : currentWatch.sellPrice,
          stock: prevStock + stockQty,
          oldStock: prevStock,
          newStock: stockQty
        };
        updatedCount++;
        totalCostAmount += (stockQty * (costPrice > 0 ? costPrice : currentWatch.costPrice));
        descParts.push(`${cleanBrand} ${cleanModel} (+${stockQty} គ្រឿង)`);
      } else {
        // Create new watch
        const newW: Watch = {
          id: cleanId,
          brand: cleanBrand,
          model: cleanModel,
          category: impWatch.category || "Watch Quartz",
          color: impWatch.color || "ទូទៅ",
          costPrice: costPrice,
          sellPrice: sellPrice,
          stock: stockQty,
          oldStock: 0,
          newStock: stockQty
        };
        nextWatches.push(newW);
        addedCount++;
        totalCostAmount += (stockQty * costPrice);
        descParts.push(`${cleanBrand} ${cleanModel} (ថ្មី, ${stockQty} គ្រឿង)`);
      }
    }

    // Add unified CapitalTransaction if total cost is greater than 0
    if (totalCostAmount > 0) {
      const summaryText = descParts.slice(0, 3).join(", ") + (descParts.length > 3 ? ` និងផ្សេងទៀត...` : "");
      const desc = language === "kh"
        ? `ប្រាក់ដើមកត់ត្រាពេលបញ្ចូលស្តុក Auto (AI)：+$${totalCostAmount.toLocaleString()} សម្រាប់ [${summaryText}]`
        : `Capital deposit from AI Auto-Stock: +$${totalCostAmount.toLocaleString()} for [${summaryText}]`;

      const newTransaction: CapitalTransaction = {
        id: "CAP-AI-" + Date.now().toString().slice(-4) + Math.random().toString().slice(2, 4),
        type: "add",
        amount: totalCostAmount,
        description: desc,
        date: new Date().toISOString().split("T")[0],
      };
      nextCapitalTransactions = [...nextCapitalTransactions, newTransaction];
    }

    await persistData({
      ...shopData,
      watches: nextWatches,
      capitalTransactions: nextCapitalTransactions
    });

    const successMsg = language === "kh"
      ? `ជោគជ័យ! បញ្ចូលស្តុកថ្មីបាន ${addedCount} គ្រឿង និងបន្ថែមស្តុកចាស់បាន ${updatedCount} គ្រឿង។`
      : `Success! Imported ${addedCount} new watches and restocked ${updatedCount} existing watches.`;
    
    showNotice("success", successMsg);
    setIsImportModalOpen(false);
    setImportedWatches([]);
  };

  // --- Handlers for MONTHLY STOCK TAKE ---
  const handleInitializePhysicalCounts = (mode: "system" | "zero") => {
    const counts: Record<string, number> = {};
    shopData.watches.forEach((w) => {
      counts[w.id] = mode === "system" ? (w.stock || 0) : 0;
    });
    setPhysicalCounts(counts);
    showNotice(
      "success",
      language === "kh"
        ? `បានកំណត់ចំនួនលំនាំដើម (${mode === "system" ? "ស្មើនឹងស្តុកក្នុងប្រព័ន្ធ" : "ស្មើនឹង ០"}) សម្រាប់នាឡិកាទាំង ${shopData.watches.length} ប្រភេទ!`
        : `Default counts initialized (${mode === "system" ? "system stock" : "zero"}) for all ${shopData.watches.length} watches!`
    );
  };

  const handleCompleteStockTake = async () => {
    if (shopData.watches.length === 0) {
      showNotice("error", language === "kh" ? "មិនមាននាឡិកាក្នុងស្តុកដើម្បីរាប់ទេ!" : "No watches in inventory to count!");
      return;
    }

    const finalizedCounts = { ...physicalCounts };
    shopData.watches.forEach((w) => {
      if (finalizedCounts[w.id] === undefined) {
        finalizedCounts[w.id] = w.stock || 0;
      }
    });

    const items: StockTakeItem[] = [];
    let totalSystemStock = 0;
    let totalPhysicalStock = 0;
    let totalDiscrepancies = 0;
    let totalValueDifference = 0;

    const updatedWatches = shopData.watches.map((w) => {
      const pStock = finalizedCounts[w.id];
      const difference = pStock - (w.stock || 0);
      const valueDiff = difference * (w.costPrice || 0);

      totalSystemStock += (w.stock || 0);
      totalPhysicalStock += pStock;
      
      if (difference !== 0) {
        totalDiscrepancies++;
        totalValueDifference += valueDiff;
      }

      items.push({
        watchId: w.id,
        brand: w.brand,
        model: w.model,
        color: w.color,
        systemStock: w.stock || 0,
        physicalStock: pStock,
        difference,
        costPrice: w.costPrice || 0,
        valueDifference: valueDiff,
      });

      return {
        ...w,
        stock: pStock,
        oldStock: 0,
        newStock: pStock,
      };
    });

    const newSession: StockTakeSession = {
      id: "ST-" + Date.now().toString().slice(-6),
      periodKey: stockTakeMonth,
      dateCounted: new Date().toISOString().split("T")[0],
      countedBy: userName || "Unknown User",
      items,
      totalSystemStock,
      totalPhysicalStock,
      totalDiscrepancies,
      totalValueDifference,
      status: 'completed',
      notes: stockTakeNotes.trim() || undefined
    };

    const nextStockTakes = [newSession, ...(shopData.stockTakes || [])];

    const logDetails = language === "kh"
      ? `បានបញ្ចប់ការរាប់ស្តុកប្រចាំខែ ${stockTakeMonth}៖ ស្តុកក្នុងប្រព័ន្ធសរុប ${totalSystemStock} គ្រឿង, ចំនួនរាប់ជាក់ស្តែង ${totalPhysicalStock} គ្រឿង, ភាពលម្អៀង ${totalPhysicalStock - totalSystemStock} គ្រឿង (ផលប៉ះពាល់៖ $${totalValueDifference.toLocaleString()})`
      : `Completed monthly stock take for ${stockTakeMonth}: Total system stock ${totalSystemStock}, counted physical stock ${totalPhysicalStock}, diff ${totalPhysicalStock - totalSystemStock} units (impact: $${totalValueDifference.toLocaleString()})`;

    await persistData(
      {
        ...shopData,
        watches: updatedWatches,
        stockTakes: nextStockTakes,
      },
      "STOCK_TAKE",
      logDetails
    );

    showNotice(
      "success",
      language === "kh"
        ? `បានផ្ទៀងផ្ទាត់ និងសម្រួលស្តុកប្រចាំខែ ${stockTakeMonth} រួចរាល់! បានរកឃើញភាពលម្អៀងចំនួន ${totalDiscrepancies} មុខនាឡិកា។`
        : `Monthly stock take for ${stockTakeMonth} finalized! Discrepancies resolved for ${totalDiscrepancies} watch models.`
    );

    setPhysicalCounts({});
    setStockTakeNotes("");
  };

  const handleDeleteStockTake = async (id: string) => {
    if (!window.confirm(language === "kh" ? "តើអ្នកចង់លុបប្រវត្តិនៃការរាប់ស្តុកនេះចេញពីប្រព័ន្ធមែនទេ?" : "Are you sure you want to delete this stock take record?")) {
      return;
    }

    const nextStockTakes = (shopData.stockTakes || []).filter((s) => s.id !== id);
    await persistData(
      {
        ...shopData,
        stockTakes: nextStockTakes,
      },
      "DELETE_STOCK_TAKE",
      `Deleted stock take record ${id}`
    );

    showNotice("success", language === "kh" ? "បានលុបប្រវត្តិនៃការរាប់ស្តុកជោគជ័យ!" : "Stock take record deleted successfully!");
    if (selectedStockTakeId === id) {
      setSelectedStockTakeId(null);
    }
  };

  // --- Handlers for SUPPLIERS ---
  const handleAddOrUpdateSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supId || !supName) {
      showNotice("error", language === "kh" ? "សូមបំពេញកូដ និងឈ្មោះអ្នកផ្គត់ផ្គង់!" : "Please fill supplier Code and Name!");
      return;
    }

    const currentSuppliers = shopData.suppliers || [];

    if (editingSupId) {
      const updatedS = currentSuppliers.map((s) =>
        s.id === editingSupId
          ? { id: supId, name: supName, contactName: supContact, phone: supPhone, email: supEmail, notes: supNotes }
          : s
      );
      let updatedWatches = shopData.watches;
      if (editingSupId !== supId) {
        updatedWatches = shopData.watches.map((w) =>
          w.supplierId === editingSupId ? { ...w, supplierId: supId } : w
        );
      }

      await persistData({ ...shopData, suppliers: updatedS, watches: updatedWatches });
      showNotice("success", language === "kh" ? `កែប្រែព័ត៌មានអ្នកផ្គត់ផ្គង់ ${supName} ជោគជ័យ!` : `Supplier updated successfully!`);
      setEditingSupId(null);
    } else {
      if (currentSuppliers.some((s) => s.id === supId)) {
        showNotice("error", language === "kh" ? "កូដអ្នកផ្គត់ផ្គង់នេះមានរួចហើយ!" : "This Supplier Code already exists!");
        return;
      }
      const newS: Supplier = {
        id: supId,
        name: supName,
        contactName: supContact,
        phone: supPhone,
        email: supEmail,
        notes: supNotes
      };
      await persistData({
        ...shopData,
        suppliers: [...currentSuppliers, newS]
      });
      showNotice("success", language === "kh" ? `បានបន្ថែមអ្នកផ្គត់ផ្គង់ ${supName} ថ្មី!` : `Supplier added successfully!`);
    }

    setSupId("");
    setSupName("");
    setSupContact("");
    setSupPhone("");
    setSupEmail("");
    setSupNotes("");
  };

  const handleEditSupplier = (s: Supplier) => {
    setEditingSupId(s.id);
    setSupId(s.id);
    setSupName(s.name);
    setSupContact(s.contactName || "");
    setSupPhone(s.phone || "");
    setSupEmail(s.email || "");
    setSupNotes(s.notes || "");
  };

  const handleDeleteSupplier = async (id: string) => {
    if (window.confirm(language === "kh" ? `តើអ្នកពិតជាចង់លុបអ្នកផ្គត់ផ្គង់នេះមែនទេ?` : `Are you sure you want to delete this supplier?`)) {
      const currentSuppliers = shopData.suppliers || [];
      const filtered = currentSuppliers.filter((s) => s.id !== id);
      const updatedWatches = shopData.watches.map((w) => 
        w.supplierId === id ? { ...w, supplierId: undefined } : w
      );

      await persistData({ ...shopData, suppliers: filtered, watches: updatedWatches });
      showNotice("success", language === "kh" ? "បានលុបអ្នកផ្គត់ផ្គង់!" : "Supplier deleted successfully!");
    }
  };

  const handleCancelEditSupplier = () => {
    setEditingSupId(null);
    setSupId("");
    setSupName("");
    setSupContact("");
    setSupPhone("");
    setSupEmail("");
    setSupNotes("");
  };

  const getUserAccounts = (): any[] => {
    if (shopData.users && shopData.users.length > 0) {
      return shopData.users;
    }
    return [
      { id: "USER-1", username: "kunthy", password: "123", name: "Kunthy", role: "owner" },
      { id: "USER-2", username: "admin", password: "123", name: "Admin", role: "owner" },
      { id: "USER-3", username: "pich", password: "123", name: "Pich", role: "staff" }
    ];
  };

  const handleAddOrUpdateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccUsername.trim() || !newAccPassword.trim() || !newAccName.trim()) {
      showNotice("error", language === "kh" ? "សូមបំពេញព័ត៌មានឱ្យបានគ្រប់គ្រាន់!" : "Please fill in all fields!");
      return;
    }

    const currentUsers = getUserAccounts();
    const newUserObj = {
      id: editingAccId || "USER-" + Date.now().toString().slice(-6),
      username: newAccUsername.trim().toLowerCase(),
      password: newAccPassword.trim(),
      name: newAccName.trim(),
      role: newAccRole,
    };

    let updatedUsers = [];
    if (editingAccId) {
      updatedUsers = currentUsers.map((u) => u.id === editingAccId ? newUserObj : u);
      showNotice("success", language === "kh" ? "បានធ្វើបច្ចុប្បន្នភាពគណនីជោគជ័យ!" : "Account updated successfully!");
    } else {
      if (currentUsers.some((u) => u.username.toLowerCase() === newUserObj.username)) {
        showNotice("error", language === "kh" ? "ឈ្មោះគណនី (Username) នេះមានរួចមកហើយ!" : "Username already exists!");
        return;
      }
      updatedUsers = [...currentUsers, newUserObj];
      showNotice("success", language === "kh" ? "បានបង្កើតគណនីថ្មីជោគជ័យ!" : "New account created successfully!");
    }

    const newShopData = {
      ...shopData,
      users: updatedUsers,
    };

    setShopData(newShopData);
    await persistData(newShopData);

    // Reset Form
    setNewAccUsername("");
    setNewAccPassword("");
    setNewAccName("");
    setNewAccRole("staff");
    setEditingAccId(null);
  };

  const handleEditAccount = (u: any) => {
    setEditingAccId(u.id);
    setNewAccUsername(u.username);
    setNewAccPassword(u.password || "");
    setNewAccName(u.name);
    setNewAccRole(u.role);
  };

  const handleDeleteAccount = async (id: string) => {
    if (window.confirm(language === "kh" ? "តើអ្នកពិតជាចង់លុបគណនីនេះមែនទេ?" : "Are you sure you want to delete this account?")) {
      const currentUsers = getUserAccounts();
      const filtered = currentUsers.filter((u) => u.id !== id);
      const newShopData = {
        ...shopData,
        users: filtered,
      };
      setShopData(newShopData);
      await persistData(newShopData);
      showNotice("success", language === "kh" ? "លុបគណនីជោគជ័យ!" : "Account deleted successfully!");
    }
  };

  const handleCancelEditAccount = () => {
    setEditingAccId(null);
    setNewAccUsername("");
    setNewAccPassword("");
    setNewAccName("");
    setNewAccRole("staff");
  };

  // --- Handlers for Month & Year Book Closings ---
  const handleClosePeriod = async () => {
    const periodKey = closingPeriodType === "month"
      ? `${closingYear}-${String(closingMonth).padStart(2, "0")}`
      : `${closingYear}`;

    // Check if already closed
    const currentClosings = shopData.closings || [];
    if (currentClosings.some(c => c.periodKey === periodKey && c.type === closingPeriodType)) {
      showNotice(
        "error",
        language === "kh"
          ? `បញ្ជីសម្រាប់ ${periodKey} ត្រូវបានបិទរួចរាល់ហើយ! សូមលុបបញ្ជីចាស់ចេញសិន ប្រសិនបើចង់បិទឡើងវិញ។`
          : `Period ${periodKey} is already closed! Delete the existing closing first to re-close.`
      );
      return;
    }

    // Filter Sales, Incomes, Expenses in this period
    const periodSales = shopData.sales.filter(s => s.date.startsWith(periodKey));
    const periodIncomes = shopData.incomes.filter(i => i.date.startsWith(periodKey));
    const periodExpenses = shopData.expenses.filter(e => e.date.startsWith(periodKey) && e.status !== "placeholder");

    // Calculations
    const salesCount = periodSales.reduce((sum, s) => sum + s.quantity, 0);
    const totalSales = periodSales.reduce((sum, s) => sum + s.totalAmount, 0);
    const totalCOGS = periodSales.reduce((sum, s) => sum + (s.costPrice * s.quantity), 0);
    const grossProfit = totalSales - totalCOGS;
    const otherIncome = periodIncomes.reduce((sum, i) => sum + i.amount, 0);
    const totalExpenses = periodExpenses.reduce((sum, e) => sum + e.amount, 0);
    const netProfit = grossProfit + otherIncome - totalExpenses;

    // Remaining Stock valuation
    const inventoryCount = shopData.watches.reduce((sum, w) => sum + w.stock, 0);
    const inventoryValue = shopData.watches.reduce((sum, w) => sum + (w.costPrice * w.stock), 0);

    const newClosing: ClosedPeriod = {
      id: "CLOSE-" + Date.now().toString().slice(-6),
      type: closingPeriodType,
      periodKey,
      salesCount,
      totalSales,
      totalCOGS,
      grossProfit,
      otherIncome,
      totalExpenses,
      netProfit,
      inventoryCount,
      inventoryValue,
      closedAt: new Date().toISOString().split("T")[0] + " " + new Date().toTimeString().split(" ")[0],
      closedBy: userName || "Kunthy",
      notes: closingNotes.trim() || undefined
    };

    const updatedClosings = [...currentClosings, newClosing];
    const logDetails = language === "kh"
      ? `បានបិទបញ្ជីគណនេយ្យចុងគ្រា (${closingPeriodType === "month" ? "ខែ" : "ឆ្នាំ"}) សម្រាប់ ${periodKey}។ ទឹកប្រាក់លក់សរុប៖ $${totalSales.toLocaleString()} ប្រាក់ចំណេញសុទ្ធ៖ $${netProfit.toLocaleString()}`
      : `Closed accounting books for ${closingPeriodType} ${periodKey}. Total Sales: $${totalSales.toLocaleString()} Net Profit: $${netProfit.toLocaleString()}`;

    const updatedData = {
      ...shopData,
      closings: updatedClosings
    };

    setShopData(updatedData);
    await persistData(updatedData, "CLOSE_PERIOD", logDetails);

    // Reset notes
    setClosingNotes("");
    showNotice(
      "success",
      language === "kh"
        ? `បានបិទបញ្ជីសម្រាប់ ${periodKey} ដោយជោគជ័យ និងរក្សាទុកក្នុងកំណត់ត្រាប្រព័ន្ធ!`
        : `Successfully closed period ${periodKey} and secured in the ledger!`
    );
  };

  const handleDeleteClosedPeriod = async (id: string, periodKey: string) => {
    if (window.confirm(
      language === "kh"
        ? `តើអ្នកពិតជាចង់លុបចោលការបិទបញ្ជីសម្រាប់ ${periodKey} នេះមែនទេ? សកម្មភាពនេះនឹងបើកបញ្ជីសម្រាប់កែប្រែឡើងវិញ។`
        : `Are you sure you want to delete and re-open the closing record for ${periodKey}?`
    )) {
      const currentClosings = shopData.closings || [];
      const filtered = currentClosings.filter(c => c.id !== id);

      const logDetails = language === "kh"
        ? `បានលុបចោលកំណត់ត្រាបិទបញ្ជីចុងគ្រា និងបើកបញ្ជីសម្រាប់ ${periodKey} ឡើងវិញ។`
        : `Deleted closed books registry and re-opened period ${periodKey}.`;

      const updatedData = {
        ...shopData,
        closings: filtered
      };

      setShopData(updatedData);
      await persistData(updatedData, "REOPEN_PERIOD", logDetails);

      showNotice(
        "success",
        language === "kh"
          ? `បានលុប និងបើកបញ្ជីសម្រាប់ ${periodKey} ឡើងវិញជោគជ័យ!`
          : `Deleted closed registry and re-opened ${periodKey} successfully!`
      );
    }
  };

  // --- Handlers for QR Scanner ---
  const handleScanQRForSale = (scannedId: string) => {
    setIsQRModalOpenForSale(false);
    const w = shopData.watches.find((wt) => wt.id === scannedId);
    if (w) {
      if (w.stock > 0) {
        setSelectedWatchId(w.id);
        setCustomSellPrice(w.sellPrice);
        showNotice("success", language === "kh" 
          ? `បានស្កេន និងជ្រើសរើស៖ ${w.brand} - ${w.model} ជោគជ័យ!` 
          : `Scanned and selected: ${w.brand} - ${w.model} successfully!`
        );
      } else {
        showNotice("error", language === "kh" 
          ? `នាឡិកា "${w.brand} - ${w.model}" អស់ពីស្តុកហើយ!` 
          : `Watch "${w.brand} - ${w.model}" is out of stock!`
        );
      }
    } else {
      showNotice("error", language === "kh"
        ? `មិនស្គាល់លេខកូដនាឡិកា៖ ${scannedId} ឡើយ!`
        : `Unknown watch ID scanned: ${scannedId}`
      );
    }
  };

  const handleScanQRForWatchForm = (scannedId: string) => {
    setIsQRModalOpenForWatchForm(false);
    setWatchId(scannedId);
    setWatchFormScanTime(Date.now());
    const exists = shopData.watches.find((w) => w.id === scannedId);
    if (exists) {
      showNotice("success", language === "kh"
        ? `បានស្កេនកូដ៖ ${scannedId} (នាឡិកានេះមានស្រាប់ក្នុងស្តុក!)`
        : `Scanned ID: ${scannedId} (This watch already exists in stock!)`
      );
      handleEditWatch(exists);
    } else {
      showNotice("success", language === "kh"
        ? `បានស្កេនកូដ៖ ${scannedId} (ត្រៀមចុះឈ្មោះនាឡិកាថ្មី)`
        : `Scanned ID: ${scannedId} (Ready to add as a new item)`
      );
    }
  };

  const handleScanQRForWatchSearch = (scannedId: string) => {
    setIsQRModalOpenForWatchSearch(false);
    setWatchSearch(scannedId);
    showNotice("success", language === "kh"
      ? `កំពុងស្វែងរកលេខកូដ៖ ${scannedId}`
      : `Searching for scanned ID: ${scannedId}`
    );
  };

  const handleBulkRestockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const itemsToRestock = Object.entries(bulkRestockQtys)
      .map(([watchId, qty]) => {
        const watch = shopData.watches.find((w) => w.id === watchId);
        return { watch, qty: Number(qty) || 0 };
      })
      .filter((item): item is { watch: Watch; qty: number } => !!item.watch && item.qty > 0);

    if (itemsToRestock.length === 0) {
      showNotice("error", language === "kh" ? "សូមបញ្ចូលចំនួននាឡិកាសម្រាប់បំពេញស្តុក!" : "Please specify restock quantities!");
      return;
    }

    let totalCost = 0;
    const descParts: string[] = [];

    const updatedWatches = shopData.watches.map((w) => {
      const match = itemsToRestock.find((item) => item.watch.id === w.id);
      if (match) {
        const itemCost = match.qty * w.costPrice;
        totalCost += itemCost;
        descParts.push(`${w.brand} ${w.model} (+${match.qty}pcs)`);
        const currentOldStock = w.oldStock !== undefined ? w.oldStock : w.stock;
        const currentNewStock = w.newStock !== undefined ? w.newStock : 0;
        return {
          ...w,
          stock: w.stock + match.qty,
          oldStock: currentOldStock,
          newStock: currentNewStock + match.qty
        };
      }
      return w;
    });

    let nextCapitalTransactions = shopData.capitalTransactions || [];
    if (totalCost > 0) {
      const description = language === "kh"
        ? `ទិញបំពេញស្តុកច្រើនមុខ៖ ${descParts.join(", ")}`
        : `Bulk restock purchase: ${descParts.join(", ")}`;

      const newTransaction: CapitalTransaction = {
        id: "CAP-" + Date.now().toString().slice(-6),
        type: "add",
        amount: totalCost,
        description: description,
        date: new Date().toISOString().split("T")[0],
      };
      nextCapitalTransactions = [...nextCapitalTransactions, newTransaction];
    }

    await persistData({
      ...shopData,
      watches: updatedWatches,
      capitalTransactions: nextCapitalTransactions,
    });

    setBulkRestockQtys({});
    showNotice(
      "success",
      language === "kh"
        ? `បានចាក់បំពេញស្តុកនាឡិកា ${itemsToRestock.length} មុខជោគជ័យ! សរុប $${totalCost.toLocaleString()}`
        : `Successfully restocked ${itemsToRestock.length} items in bulk! Total cost: $${totalCost.toLocaleString()}`
    );
  };

  // --- Handlers for SALES (ការលក់) ---
  const handleQuickSale = async (watchIdToSell: string) => {
    setSaleError("");

    const tWatch = shopData.watches.find((w) => w.id === watchIdToSell);
    if (!tWatch) {
      showNotice("error", language === "kh" ? "រកមិនឃើញនាឡិកានោះទេ!" : "Watch not found!");
      return;
    }

    if (tWatch.stock <= 0) {
      showNotice("error", language === "kh" ? `នាឡិកានេះអស់ពីស្តុកហើយ!` : `This watch is out of stock!`);
      return;
    }

    const qty = 1;
    const finalSellPrice = tWatch.sellPrice;

    // Calculations
    const totalAmount = finalSellPrice * qty;
    const profit = (finalSellPrice - tWatch.costPrice) * qty;

    const newSale: Sale = {
      id: "SALE-" + Date.now().toString().slice(-6) + Math.floor(Math.random() * 10),
      watchId: tWatch.id,
      watchBrand: tWatch.brand,
      watchModel: tWatch.model,
      watchColor: tWatch.color,
      quantity: qty,
      sellPrice: finalSellPrice,
      costPrice: tWatch.costPrice,
      totalAmount,
      profit,
      date: new Date().toISOString().split("T")[0],
      saleChannel,
    };

    // Update Watch Stock
    const updatedWatches = shopData.watches.map((w) => {
      if (w.id === tWatch.id) {
        const oldStockVal = w.oldStock !== undefined ? w.oldStock : w.stock;
        const newStockVal = w.newStock !== undefined ? w.newStock : 0;
        let finalNewStock = newStockVal;
        let finalOldStock = oldStockVal;
        
        if (newStockVal >= qty) {
          finalNewStock = newStockVal - qty;
        } else {
          finalNewStock = 0;
          finalOldStock = Math.max(0, oldStockVal - (qty - newStockVal));
        }

        return {
          ...w,
          stock: w.stock - qty,
          oldStock: finalOldStock,
          newStock: finalNewStock
        };
      }
      return w;
    });

    // Record under Incomes as a dynamic transaction linked to sales
    const newIncome: Income = {
      id: "INC-S-" + Date.now().toString().slice(-6) + Math.floor(Math.random() * 10),
      amount: totalAmount,
      source: "sale",
      category: saleChannel === "online" ? "លក់ Online" : "លក់នាឡិកា",
      date: newSale.date,
      description: `លក់នាឡិកា ${tWatch.brand} ${tWatch.model} ចំនួន ${qty} គ្រឿង (កូដ: ${tWatch.id}) - ${saleChannel === "online" ? "លក់ Online" : "លក់នៅហាង"}`,
    };

    const newShopData = {
      ...shopData,
      watches: updatedWatches,
      sales: [...shopData.sales, newSale],
      incomes: [...shopData.incomes, newIncome],
    };

    const logDetails = language === "kh"
      ? `លក់លឿន (Quick Sale): ${tWatch.brand} ${tWatch.model} ចំនួន ${qty} គ្រឿង សរុបទឹកប្រាក់៖ $${totalAmount.toLocaleString()}`
      : `Quick Sale: ${qty} pcs of ${tWatch.brand} ${tWatch.model} for $${totalAmount.toLocaleString()}`;

    await persistData(newShopData, "QUICK_SALE", logDetails);
    setSelectedInvoice(newSale);
    showNotice(
      "success", 
      language === "kh" 
        ? `បានលក់លឿនជោគជ័យ! ${tWatch.brand} ${tWatch.model} សរុបទឹកប្រាក់៖ $${totalAmount.toLocaleString()}។ វិក្កយបត្រត្រូវបានបង្ហាញ!` 
        : `Quick sale completed! Sold 1 unit of ${tWatch.brand} ${tWatch.model} for $${totalAmount.toLocaleString()}. Invoice displayed!`
    );
  };

  const handleUSDPriceChange = (val: string) => {
    if (val === "") {
      setCustomSellPrice("");
      setCustomSellPriceKHR("");
    } else {
      const numUsd = Number(val);
      setCustomSellPrice(numUsd);
      setCustomSellPriceKHR(Math.round(numUsd * (shopData.exchangeRate || 4100)));
    }
  };

  const handleKHRPriceChange = (val: string) => {
    if (val === "") {
      setCustomSellPrice("");
      setCustomSellPriceKHR("");
    } else {
      const numKhr = Number(val);
      setCustomSellPriceKHR(numKhr);
      setCustomSellPrice(Number((numKhr / (shopData.exchangeRate || 4100)).toFixed(2)));
    }
  };

  const handleAddNewSale = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaleError("");

    if (!selectedWatchId) {
      setSaleError("សូមជ្រើសរើសនាឡិកាសម្រាប់លក់!");
      return;
    }

    const tWatch = shopData.watches.find((w) => w.id === selectedWatchId);
    if (!tWatch) {
      setSaleError("រកមិនឃើញនាឡិកាដែលបានជ្រើសរើសទេ!");
      return;
    }

    const qty = Number(saleQuantity);
    if (isNaN(qty) || qty <= 0) {
      setSaleError("បរិមាណលក់ត្រូវតែធំជាង ០!");
      return;
    }

    const oldStockVal = tWatch.oldStock !== undefined ? tWatch.oldStock : tWatch.stock;
    const newStockVal = tWatch.newStock !== undefined ? tWatch.newStock : 0;

    if (saleStockType === "old" && qty > oldStockVal) {
      setSaleError(`ស្តុកចាស់មិនគ្រប់គ្រាន់ទេ! ក្នុងស្តុកចាស់សល់ត្រឹមតែ ${oldStockVal} គ្រឿងប៉ុណ្ណោះ។`);
      return;
    }
    if (saleStockType === "new" && qty > newStockVal) {
      setSaleError(`ស្តុកថ្មីមិនគ្រប់គ្រាន់ទេ! ក្នុងស្តុកថ្មីសល់ត្រឹមតែ ${newStockVal} គ្រឿងប៉ុណ្ណោះ។`);
      return;
    }
    if (qty > tWatch.stock) {
      setSaleError(`ស្តុកសរុបមិនគ្រប់គ្រាន់ទេ! ក្នុងស្តុកសរុបសល់ត្រឹមតែ ${tWatch.stock} គ្រឿងប៉ុណ្ណោះ។`);
      return;
    }

    const finalSellPrice = customSellPrice !== "" ? Number(customSellPrice) : tWatch.sellPrice;
    if (isNaN(finalSellPrice) || finalSellPrice < 0) {
      setSaleError("តម្លៃលក់មិនត្រឹមត្រូវទេ!");
      return;
    }

    const discountPct = saleDiscountPercent !== "" ? Number(saleDiscountPercent) : 0;
    if (isNaN(discountPct) || discountPct < 0 || discountPct > 100) {
      setSaleError("ភាគរយបញ្ចុះតម្លៃត្រូវតែនៅចន្លោះពី ០ ដល់ ១០០%!");
      return;
    }

    // Calculations
    const baseAmount = finalSellPrice * qty;
    const discountAmount = baseAmount * (discountPct / 100);
    const totalAmount = baseAmount - discountAmount;
    const profit = totalAmount - (tWatch.costPrice * qty);

    const rate = shopData.exchangeRate || 4100;
    let rCashUSD = 0;
    let rCashKHR = 0;
    let rABA = 0;
    let rAcleda = 0;
    let changeUSD = 0;
    let changeKHR = 0;

    if (sellPaymentMethod === "cash") {
      const enteredAmt = receivedCashAmount !== "" ? Number(receivedCashAmount) : 0;
      if (paymentCurrency === "USD") {
        rCashUSD = enteredAmt > 0 ? enteredAmt : totalAmount;
        changeUSD = Math.max(0, rCashUSD - totalAmount);
        changeKHR = Math.round(changeUSD * rate);
      } else {
        rCashKHR = enteredAmt > 0 ? enteredAmt : Math.round(totalAmount * rate);
        const totalRecUSD = rCashKHR / rate;
        changeUSD = Math.max(0, totalRecUSD - totalAmount);
        changeKHR = Math.round(changeUSD * rate);
      }
    } else if (sellPaymentMethod === "aba") {
      rABA = totalAmount;
    } else if (sellPaymentMethod === "acleda") {
      rAcleda = totalAmount;
    } else if (sellPaymentMethod === "cod") {
      if (codSettlement === "cash") {
        if (paymentCurrency === "USD") {
          rCashUSD = totalAmount;
        } else {
          rCashKHR = Math.round(totalAmount * rate);
        }
      } else if (codSettlement === "aba") {
        rABA = totalAmount;
      } else if (codSettlement === "acleda") {
        rAcleda = totalAmount;
      } else if (codSettlement === "split") {
        rCashUSD = totalAmount / 2;
        rABA = totalAmount / 2;
      }
    }

    const payMethod = sellPaymentMethod;

    const newSale: Sale = {
      id: "SALE-" + Date.now().toString().slice(-6),
      watchId: tWatch.id,
      watchBrand: tWatch.brand,
      watchModel: tWatch.model,
      watchColor: (saleWatchColor || tWatch.color || "").trim() || (language === "kh" ? "ទូទៅ" : "General"),
      quantity: qty,
      sellPrice: finalSellPrice,
      costPrice: tWatch.costPrice,
      totalAmount,
      profit,
      date: new Date().toISOString().split("T")[0],
      saleChannel,
      discountPercent: discountPct,
      discountAmount,
      deductedStockType: saleStockType,
      paymentCurrency,
      exchangeRateUsed: rate,
      paymentMethod: payMethod,
      receivedCashUSD: rCashUSD,
      receivedCashKHR: rCashKHR,
      receivedABA: rABA,
      receivedAcleda: rAcleda,
      changeUSD: changeUSD,
      changeKHR: changeKHR,
      codCarrier: payMethod === "cod" ? codCarrier : undefined,
      codSettlement: payMethod === "cod" ? codSettlement : undefined,
      codNotes: payMethod === "cod" ? codNotes : undefined,
      isPaid: isSalePaid,
      paymentStatus: isSalePaid ? "Paid" : "Unpaid",
      customerPhone: saleCustomerPhone.trim() || undefined,
      customerLocation: saleCustomerLocation.trim() || undefined,
    };

    // Update Watch Stock
    const updatedWatches = shopData.watches.map((w) => {
      if (w.id === tWatch.id) {
        let finalNewStock = newStockVal;
        let finalOldStock = oldStockVal;
        
        if (saleStockType === "old") {
          finalOldStock = Math.max(0, oldStockVal - qty);
        } else if (saleStockType === "new") {
          finalNewStock = Math.max(0, newStockVal - qty);
        } else {
          if (newStockVal >= qty) {
            finalNewStock = newStockVal - qty;
          } else {
            finalNewStock = 0;
            finalOldStock = Math.max(0, oldStockVal - (qty - newStockVal));
          }
        }

        let finalColorBreakdown = w.colorBreakdown;
        if (finalColorBreakdown && finalColorBreakdown.length > 0) {
          finalColorBreakdown = finalColorBreakdown.map((cb) => {
            const isMatch = cb.color.trim().toLowerCase() === (saleWatchColor || "").trim().toLowerCase();
            if (isMatch) {
              let finalCbNew = cb.newQty !== undefined ? cb.newQty : 0;
              let finalCbOld = cb.oldQty !== undefined ? cb.oldQty : cb.qty;
              
              if (saleStockType === "old") {
                finalCbOld = Math.max(0, finalCbOld - qty);
              } else if (saleStockType === "new") {
                finalCbNew = Math.max(0, finalCbNew - qty);
              } else {
                if (finalCbNew >= qty) {
                  finalCbNew = finalCbNew - qty;
                } else {
                  const diffToDeduct = qty - finalCbNew;
                  finalCbNew = 0;
                  finalCbOld = Math.max(0, finalCbOld - diffToDeduct);
                }
              }
              return {
                ...cb,
                qty: finalCbOld + finalCbNew,
                oldQty: finalCbOld,
                newQty: finalCbNew
              };
            }
            return cb;
          });
        }

        return {
          ...w,
          stock: w.stock - qty,
          oldStock: finalOldStock,
          newStock: finalNewStock,
          colorBreakdown: finalColorBreakdown
        };
      }
      return w;
    });

    // Record under Incomes as a dynamic transaction linked to sales
    const newIncome: Income = {
      id: "INC-S-" + Date.now().toString().slice(-6),
      amount: totalAmount,
      source: "sale",
      category: saleChannel === "online" ? "លក់ Online" : "លក់នាឡិកា",
      date: newSale.date,
      description: `លក់នាឡិកា ${tWatch.brand} ${tWatch.model} ចំនួន ${qty} គ្រឿង (កូដ: ${tWatch.id})` + 
        (discountPct > 0 ? ` [បញ្ចុះតម្លៃ ${discountPct}% (-$${discountAmount.toLocaleString()})]` : "") +
        ` [ទូទាត់៖ ${payMethod === 'cash' ? 'លុយសុទ្ធ' : payMethod === 'aba' ? 'ABA' : payMethod === 'acleda' ? 'ACLEDA' : 'បង់ល្បាយ'}]` +
        ` - ${saleChannel === "online" ? "លក់ Online" : "លក់នៅហាង"}`,
    };

    const newShopData = {
      ...shopData,
      watches: updatedWatches,
      sales: [...shopData.sales, newSale],
      incomes: [...shopData.incomes, newIncome],
    };

    const logDetails = language === "kh"
      ? `បានលក់នាឡិកា ${tWatch.brand} ${tWatch.model} ចំនួន ${qty} គ្រឿង សរុបទឹកប្រាក់៖ $${totalAmount.toLocaleString()} (ទូទាត់តាម៖ ${payMethod.toUpperCase()} / អត្រាដូរប្រាក់ 1$ = ${rate.toLocaleString()}៛)`
      : `Sold ${qty} pcs of ${tWatch.brand} ${tWatch.model} for $${totalAmount.toLocaleString()} (Paid via: ${payMethod.toUpperCase()} @ 1$ = ${rate.toLocaleString()} KHR)`;

    await persistData(newShopData, "SALE", logDetails);
    setSelectedInvoice(newSale);
    showNotice("success", `បានលក់ជោគជ័យ! សរុបទឹកប្រាក់៖ $${totalAmount.toLocaleString()} លក់កាត់ស្តុក ${qty} គ្រឿង។ វិក្កយបត្រត្រូវបានបង្ហាញ!`);

    // Reset Form
    setSelectedWatchId("");
    setSaleWatchColor("");
    setSaleQuantity(1);
    setCustomSellPrice("");
    setCustomSellPriceKHR("");
    setSaleDiscountPercent("");
    setSaleStockType("auto");
    setReceivedCashUSD("");
    setReceivedCashKHR("");
    setReceivedABA("");
    setReceivedAcleda("");
    setReceivedCashAmount("");
    setCodCarrier("");
    setCodSettlement("cash");
    setCodNotes("");
    setSellPaymentMethod("cash");
    setIsSalePaid(true);
    setSaleCustomerPhone("");
    setSaleCustomerLocation("");
  };

  const handleToggleSalePaymentStatus = async (saleId: string) => {
    const updatedSales = (shopData.sales || []).map((s) => {
      if (s.id === saleId) {
        const currentPaidStatus = s.isPaid !== false; // if undefined or true, it is paid
        const nextPaid = !currentPaidStatus;
        return {
          ...s,
          isPaid: nextPaid,
          paymentStatus: (nextPaid ? "Paid" : "Unpaid") as "Paid" | "Unpaid"
        };
      }
      return s;
    });

    const targetSale = shopData.sales.find((s) => s.id === saleId);
    const logDetails = language === "kh"
      ? `បានកែប្រែស្ថានភាពទូទាត់ការលក់កូដ ${saleId} ទៅជា ${targetSale?.isPaid ? "មិនទាន់បង់" : "បានបង់"}`
      : `Toggled payment status of sale ${saleId}`;

    const newShopData = {
      ...shopData,
      watches: shopData.watches,
      sales: updatedSales,
      incomes: shopData.incomes,
    };
    await persistData(newShopData, "SALE_STATUS", logDetails);
    showNotice("success", language === "kh" ? "បានធ្វើបច្ចុប្បន្នភាពស្ថានភាពទូទាត់ជោគជ័យ!" : "Updated payment status successfully!");
  };

  const handleDeleteSale = async (saleId: string) => {
    const saleToUndo = shopData.sales.find((s) => s.id === saleId);
    if (!saleToUndo) return;

    if (window.confirm(`តើអ្នកចង់លុបកំណត់ត្រាការលក់កូដ ${saleId} នេះមែនទេ? (ស្តុកនាឡិកានឹងត្រូវបានបូកត្រឡប់ចូលស្តុកវិញ)`)) {
      // Restore watch stock
      const updatedWatches = shopData.watches.map((w) => {
        if (w.id === saleToUndo.watchId) {
          const oldStockVal = w.oldStock !== undefined ? w.oldStock : w.stock;
          const newStockVal = w.newStock !== undefined ? w.newStock : 0;
          return {
            ...w,
            stock: w.stock + saleToUndo.quantity,
            oldStock: oldStockVal,
            newStock: newStockVal + saleToUndo.quantity
          };
        }
        return w;
      });

      // Filter out sale
      const remainingSales = shopData.sales.filter((s) => s.id !== saleId);

      // Filter out income generated from this sale (INC-S-*** contains description with sale details)
      const remainingIncomes = shopData.incomes.filter(
        (inc) => !(inc.source === "sale" && inc.description?.includes(`(កូដ: ${saleToUndo.watchId})`))
      );

      const logDetails = language === "kh"
        ? `បានលុបការលក់នាឡិកា ${saleToUndo.watchBrand} ${saleToUndo.watchModel} (កូដលក់: ${saleId}) ចំនួន ${saleToUndo.quantity} គ្រឿង សរុប $${saleToUndo.totalAmount.toLocaleString()} (ស្តុកត្រូវបានបូកត្រឡប់វិញ)`
        : `Deleted sale ${saleId} of ${saleToUndo.quantity} pcs of ${saleToUndo.watchBrand} ${saleToUndo.watchModel} for $${saleToUndo.totalAmount.toLocaleString()} (Stock returned)`;

      await persistData({
        ...shopData,
        watches: updatedWatches,
        sales: remainingSales,
        incomes: remainingIncomes,
      }, "DELETE_SALE", logDetails);

      showNotice("success", "បានលុបកំណត់ត្រាការលក់ និងបូកស្តុកត្រឡប់ទៅវិញរួចរាល់!");
    }
  };

  const handleClearMonthlySales = async () => {
    const confirmMsg = language === "kh"
      ? "⚠️ តើអ្នកពិតជាចង់សម្អាត និងលុបកំណត់ត្រាការលក់ និងចំណូលពីការលក់ទាំងអស់មែនទេ? សកម្មភាពនេះមិនអាចត្រឡប់ថយក្រោយវិញបានឡើយ!"
      : "⚠️ Are you sure you want to clear all sales records and sales revenue income? This action cannot be undone!";
    
    if (window.confirm(confirmMsg)) {
      const updatedIncomes = shopData.incomes.filter(inc => inc.source !== "sale");
      
      const newShopData = {
        ...shopData,
        sales: [],
        incomes: updatedIncomes,
      };

      const logDetails = language === "kh"
        ? "បានសម្អាតកំណត់ត្រាការលក់ និងចំណូលពីការលក់ទាំងអស់ដើម្បីចាប់ផ្ដើមលក់សម្រាប់ខែថ្មី"
        : "Cleared all sales records and sales income to start a new month";

      await persistData(newShopData, "CLEAR_SALES", logDetails);
      showNotice("success", language === "kh"
        ? "បានសម្អាតទិន្នន័យលក់ចេញរួចរាល់សម្រាប់ចាប់ផ្ដើមខែថ្មី!"
        : "Successfully cleared all sales records for the new month!"
      );
    }
  };

  const handleStartEditSale = (sale: Sale) => {
    setEditingSale(sale);
    setEditSaleDate(sale.date);
    setEditSaleColor(sale.watchColor || "");
    setEditSaleQuantity(sale.quantity);
    setEditSaleSellPrice(sale.sellPrice);
    setEditSaleDiscountPercent(sale.discountPercent || 0);
    setEditSalePaymentMethod(sale.paymentMethod || "cash");
    setEditSalePaymentCurrency(sale.paymentCurrency || "USD");
    setEditSaleIsPaid(sale.isPaid !== false);
    setEditSaleSaleChannel(sale.saleChannel || "instore");
    setEditSaleCustomerPhone(sale.customerPhone || "");
    setEditSaleCustomerLocation(sale.customerLocation || "");
    setEditSaleError("");
  };

  const handleUpdateSale = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditSaleError("");

    if (!editingSale) return;

    const originalSale = editingSale;
    const watch = shopData.watches.find((w) => w.id === originalSale.watchId);
    if (!watch) {
      setEditSaleError(language === "kh" ? "រកមិនឃើញនាឡិកាសម្រាប់លក់នេះទេ!" : "Watch associated with this sale not found!");
      return;
    }

    const newQty = Number(editSaleQuantity);
    if (isNaN(newQty) || newQty <= 0) {
      setEditSaleError(language === "kh" ? "បរិមាណលក់ត្រូវតែធំជាង ០!" : "Quantity must be greater than 0!");
      return;
    }

    // Check stock adjustment
    const stockDiff = newQty - originalSale.quantity;
    if (stockDiff > 0 && watch.stock < stockDiff) {
      setEditSaleError(
        language === "kh" 
          ? `ស្តុកមិនគ្រប់គ្រាន់ទេ! ក្នុងស្តុកសល់ត្រឹមតែ ${watch.stock} គ្រឿង តែត្រូវការដកបន្ថែម ${stockDiff} គ្រឿង។` 
          : `Insufficient stock! Remaining stock is ${watch.stock} but needs ${stockDiff} more.`
      );
      return;
    }

    const newSellPrice = Number(editSaleSellPrice);
    if (isNaN(newSellPrice) || newSellPrice < 0) {
      setEditSaleError(language === "kh" ? "តម្លៃលក់មិនត្រឹមត្រូវទេ!" : "Invalid selling price!");
      return;
    }

    const newDiscountPct = Number(editSaleDiscountPercent || 0);
    if (isNaN(newDiscountPct) || newDiscountPct < 0 || newDiscountPct > 100) {
      setEditSaleError(language === "kh" ? "ភាគរយបញ្ចុះតម្លៃត្រូវតែនៅចន្លោះពី ០ ដល់ ១០០%!" : "Discount must be between 0 and 100%!");
      return;
    }

    // Calculations
    const baseAmount = newSellPrice * newQty;
    const discountAmount = baseAmount * (newDiscountPct / 100);
    const totalAmount = baseAmount - discountAmount;
    const profit = totalAmount - (watch.costPrice * newQty);

    const rate = shopData.exchangeRate || 4100;
    let rCashUSD = 0;
    let rCashKHR = 0;
    let rABA = 0;
    let rAcleda = 0;
    let changeUSD = 0;
    let changeKHR = 0;

    if (editSalePaymentMethod === "cash") {
      if (editSalePaymentCurrency === "USD") {
        rCashUSD = totalAmount;
      } else {
        rCashKHR = Math.round(totalAmount * rate);
      }
    } else if (editSalePaymentMethod === "aba") {
      rABA = totalAmount;
    } else if (editSalePaymentMethod === "acleda") {
      rAcleda = totalAmount;
    } else if (editSalePaymentMethod === "cod") {
      rCashUSD = totalAmount;
    }

    // Create updated sale
    const updatedSale: Sale = {
      ...originalSale,
      watchColor: (editSaleColor || "").trim() || (language === "kh" ? "ទូទៅ" : "General"),
      quantity: newQty,
      sellPrice: newSellPrice,
      totalAmount,
      profit,
      date: editSaleDate || new Date().toISOString().split("T")[0],
      saleChannel: editSaleSaleChannel,
      discountPercent: newDiscountPct,
      discountAmount,
      paymentCurrency: editSalePaymentCurrency,
      paymentMethod: editSalePaymentMethod,
      receivedCashUSD: rCashUSD,
      receivedCashKHR: rCashKHR,
      receivedABA: rABA,
      receivedAcleda: rAcleda,
      changeUSD,
      changeKHR,
      isPaid: editSaleIsPaid,
      paymentStatus: editSaleIsPaid ? "Paid" : "Unpaid",
      customerPhone: editSaleCustomerPhone.trim() || undefined,
      customerLocation: editSaleCustomerLocation.trim() || undefined,
    };

    // Update Watch Stock (adding back originalQty, subtracting newQty)
    const updatedWatches = shopData.watches.map((w) => {
      if (w.id === watch.id) {
        const oldStockVal = w.oldStock !== undefined ? w.oldStock : w.stock;
        const newStockVal = w.newStock !== undefined ? w.newStock : 0;
        
        let finalNewStock = newStockVal;
        let finalOldStock = oldStockVal;

        // Restore original qty to stock takes/stock counters, then deduct new qty
        const netDeduction = newQty - originalSale.quantity;
        const nextStock = w.stock - netDeduction;

        // Maintain old/new stocks if applicable
        if (originalSale.deductedStockType === "old") {
          finalOldStock = Math.max(0, oldStockVal - netDeduction);
        } else if (originalSale.deductedStockType === "new") {
          finalNewStock = Math.max(0, newStockVal - netDeduction);
        } else {
          // auto
          if (newStockVal >= netDeduction) {
            finalNewStock = newStockVal - netDeduction;
          } else {
            finalNewStock = 0;
            finalOldStock = Math.max(0, oldStockVal - (netDeduction - newStockVal));
          }
        }

        let finalColorBreakdown = w.colorBreakdown;
        if (finalColorBreakdown && finalColorBreakdown.length > 0) {
          // 1. Revert original sold quantity from old color
          finalColorBreakdown = finalColorBreakdown.map((cb) => {
            const isOrigMatch = cb.color.trim().toLowerCase() === (originalSale.watchColor || "").trim().toLowerCase();
            if (isOrigMatch) {
              let finalCbNew = cb.newQty !== undefined ? cb.newQty : 0;
              let finalCbOld = cb.oldQty !== undefined ? cb.oldQty : cb.qty;
              
              if (originalSale.deductedStockType === "old") {
                finalCbOld = finalCbOld + originalSale.quantity;
              } else if (originalSale.deductedStockType === "new") {
                finalCbNew = finalCbNew + originalSale.quantity;
              } else {
                finalCbNew = finalCbNew + originalSale.quantity;
              }
              return {
                ...cb,
                qty: finalCbOld + finalCbNew,
                oldQty: finalCbOld,
                newQty: finalCbNew
              };
            }
            return cb;
          });

          // 2. Deduct new sold quantity from new color
          finalColorBreakdown = finalColorBreakdown.map((cb) => {
            const isNewMatch = cb.color.trim().toLowerCase() === (updatedSale.watchColor || "").trim().toLowerCase();
            if (isNewMatch) {
              let finalCbNew = cb.newQty !== undefined ? cb.newQty : 0;
              let finalCbOld = cb.oldQty !== undefined ? cb.oldQty : cb.qty;
              
              if (originalSale.deductedStockType === "old") {
                finalCbOld = Math.max(0, finalCbOld - newQty);
              } else if (originalSale.deductedStockType === "new") {
                finalCbNew = Math.max(0, finalCbNew - newQty);
              } else {
                if (finalCbNew >= newQty) {
                  finalCbNew = finalCbNew - newQty;
                } else {
                  const diffToDeduct = newQty - finalCbNew;
                  finalCbNew = 0;
                  finalCbOld = Math.max(0, finalCbOld - diffToDeduct);
                }
              }
              return {
                ...cb,
                qty: finalCbOld + finalCbNew,
                oldQty: finalCbOld,
                newQty: finalCbNew
              };
            }
            return cb;
          });
        }

        return {
          ...w,
          stock: nextStock,
          oldStock: finalOldStock,
          newStock: finalNewStock,
          colorBreakdown: finalColorBreakdown
        };
      }
      return w;
    });

    // Update Sales list
    const updatedSales = shopData.sales.map((s) => (s.id === originalSale.id ? updatedSale : s));

    // Update Income: find matching income
    const updatedIncomes = shopData.incomes.map((inc) => {
      const isAssociatedIncome = 
        inc.source === "sale" && 
        (inc.description?.includes(`(កូដ: ${watch.id})`) || inc.description?.includes(originalSale.id)) &&
        (inc.date === originalSale.date || inc.amount === originalSale.totalAmount);

      if (isAssociatedIncome) {
        return {
          ...inc,
          amount: totalAmount,
          date: updatedSale.date,
          category: editSaleSaleChannel === "online" ? "លក់ Online" : "លក់នាឡិកា",
          description: `លក់នាឡិកា ${watch.brand} ${watch.model} ចំនួន ${newQty} គ្រឿង (កូដ: ${watch.id})` + 
            (newDiscountPct > 0 ? ` [បញ្ចុះតម្លៃ ${newDiscountPct}% (-$${discountAmount.toLocaleString()})]` : "") +
            ` [ទូទាត់៖ ${editSalePaymentMethod === 'cash' ? 'លុយសុទ្ធ' : editSalePaymentMethod === 'aba' ? 'ABA' : editSalePaymentMethod === 'acleda' ? 'ACLEDA' : 'បង់ល្បាយ'}]` +
            ` - ${editSaleSaleChannel === "online" ? "លក់ Online" : "លក់នៅហាង"}`,
        };
      }
      return inc;
    });

    const logDetails = language === "kh"
      ? `បានកែប្រែការលក់កូដ ${originalSale.id} (នាឡិកា ${watch.brand} ${watch.model}) ទៅជា៖ ចំនួន ${newQty} គ្រឿង សរុប $${totalAmount.toLocaleString()}`
      : `Edited sale ${originalSale.id} (${watch.brand} ${watch.model}) to: ${newQty} pcs, total $${totalAmount.toLocaleString()}`;

    const newShopData = {
      ...shopData,
      watches: updatedWatches,
      sales: updatedSales,
      incomes: updatedIncomes,
    };

    await persistData(newShopData, "EDIT_SALE", logDetails);
    showNotice(
      "success", 
      language === "kh" 
        ? "បានកែប្រែព័ត៌មានការលក់ជោគជ័យ!" 
        : "Successfully updated sale details!"
    );
    setEditingSale(null);
  };

  // --- Handlers for OTHER INCOMES & EXPENSES (ចំណូល​ / ចំណាយ) ---
  const handleAddOtherIncome = async (e: React.FormEvent) => {
    e.preventDefault();
    if (incomeAmount === "" || !incomeCategory) {
      showNotice("error", "សូមបញ្ចូលទឹកប្រាក់ និងប្រភពចំណូលផ្សេងៗ!");
      return;
    }

    const inputAmt = Number(incomeAmount);
    if (inputAmt <= 0) {
      showNotice("error", "ទឹកប្រាក់ត្រូវតែធំជាង ០!");
      return;
    }

    const rate = shopData.exchangeRate || 4100;
    const amtUSD = incomeCurrency === "KHR" ? Number((inputAmt / rate).toFixed(2)) : inputAmt;

    const newIncome: Income = {
      id: "INC-O-" + Date.now().toString().slice(-6),
      amount: amtUSD,
      source: "other",
      category: incomeCategory,
      date: new Date().toISOString().split("T")[0],
      description: incomeDesc,
      currency: incomeCurrency,
      originalAmount: inputAmt,
      exchangeRateUsed: rate,
    };

    await persistData({
      ...shopData,
      incomes: [...shopData.incomes, newIncome],
    });

    const successMessage = incomeCurrency === "KHR"
      ? `បានកត់ត្រាចំណូលបន្ថែមចំនួន ៛${inputAmt.toLocaleString()} (≈ $${amtUSD.toLocaleString()}) ចូលក្នុងបញ្ជី!`
      : `បានកត់ត្រាចំណូលបន្ថែមចំនួន $${inputAmt.toLocaleString()} ចូលក្នុងបញ្ជី!`;

    showNotice("success", successMessage);
    setIncomeAmount("");
    setIncomeCategory("");
    setIncomeDesc("");
  };

  const handleDeleteIncome = async (id: string) => {
    if (window.confirm("តើអ្នកពិតជាចង់លុបកំណត់ត្រាចំណូលនេះមែនទេ?")) {
      const remaining = shopData.incomes.filter((inc) => inc.id !== id);
      await persistData({ ...shopData, incomes: remaining });
      showNotice("success", "បានលុបកំណត់ត្រាចំណូល!");
    }
  };

  const addIntervalToDate = (dateStr: string, interval: "weekly" | "monthly" | "yearly", step: number): string => {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) {
      return dateStr;
    }
    if (interval === "weekly") {
      d.setDate(d.getDate() + 7 * step);
    } else if (interval === "monthly") {
      d.setMonth(d.getMonth() + step);
    } else if (interval === "yearly") {
      d.setFullYear(d.getFullYear() + step);
    }
    return d.toISOString().split("T")[0];
  };

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (expenseAmount === "") {
      showNotice("error", "សូមបញ្ចូលទឹកប្រាក់សម្រាប់ចំណាយ!");
      return;
    }

    const inputAmt = Number(expenseAmount);
    if (inputAmt <= 0) {
      showNotice("error", "ទឹកប្រាក់ត្រូវតែធំជាង ០!");
      return;
    }

    const rate = shopData.exchangeRate || 4100;
    const amtUSD = expenseCurrency === "KHR" ? Number((inputAmt / rate).toFixed(2)) : inputAmt;

    const newExpense: Expense = {
      id: "EXP-" + Date.now().toString().slice(-6),
      amount: amtUSD,
      category: expenseCategory,
      description: expenseDesc || getExpenseCategoryName(expenseCategory),
      date: expenseDate || new Date().toISOString().split("T")[0],
      paymentMethod: expensePaymentMethod,
      status: "paid",
      currency: expenseCurrency,
      originalAmount: inputAmt,
      exchangeRateUsed: rate,
    };

    const generatedPlaceholders: Expense[] = [];
    if (isExpenseRecurring) {
      newExpense.isRecurring = true;
      newExpense.recurringInterval = expenseRecurringInterval;

      // Generate future placeholders
      const futureCount = Number(expenseFutureCount) || 6;
      for (let i = 1; i <= futureCount; i++) {
        const nextDate = addIntervalToDate(newExpense.date, expenseRecurringInterval, i);
        const placeholderDesc = language === "kh"
          ? `${newExpense.description} (គ្រោងទុក ${i}/${futureCount})`
          : `${newExpense.description} (Placeholder ${i}/${futureCount})`;
        
        generatedPlaceholders.push({
          id: `EXP-P-${Date.now().toString().slice(-6)}-${i}`,
          amount: amtUSD,
          category: expenseCategory,
          description: placeholderDesc,
          date: nextDate,
          paymentMethod: expensePaymentMethod,
          isRecurring: true,
          recurringInterval: expenseRecurringInterval,
          parentId: newExpense.id,
          status: "placeholder",
          currency: expenseCurrency,
          originalAmount: inputAmt,
          exchangeRateUsed: rate,
        });
      }
    }

    await persistData({
      ...shopData,
      expenses: [...shopData.expenses, newExpense, ...generatedPlaceholders],
    });

    const successMsg = isExpenseRecurring
      ? (language === "kh"
          ? `បានកត់ត្រាចំណាយ និងបង្កើតទិន្នន័យគ្រោងទុកចំនួន ${expenseFutureCount} ទៀតរួចរាល់!`
          : `Recorded expense and created ${expenseFutureCount} future placeholders!`)
      : (expenseCurrency === "KHR"
          ? (language === "kh"
              ? `បានកត់ត្រាចំណាយចំនួន ៛${inputAmt.toLocaleString()} (≈ $${amtUSD.toLocaleString()}) ចូលក្នុងបញ្ជី!`
              : `Recorded expense of ៛${inputAmt.toLocaleString()} (≈ $${amtUSD.toLocaleString()}) into log!`)
          : (language === "kh"
              ? `បានកត់ត្រាចំណាយចំនួន $${inputAmt.toLocaleString()} ចូលក្នុងបញ្ជី!`
              : `Recorded expense of $${inputAmt.toLocaleString()} into log!`));

    showNotice("success", successMsg);
    setExpenseAmount("");
    setExpenseDesc("");
    setExpenseDate(new Date().toISOString().split("T")[0]);
    setExpensePaymentMethod("ABA");
    setIsExpenseRecurring(false);
    setExpenseRecurringInterval("monthly");
    setExpenseFutureCount(6);
  };

  const handleConfirmPlaceholderExpense = async (id: string) => {
    const expToUpdate = shopData.expenses.find((exp) => exp.id === id);
    if (!expToUpdate) return;

    const confirmMsg = language === "kh"
      ? `តើអ្នកចង់បញ្ជាក់ការទូទាត់ចំណាយចំនួន $${expToUpdate.amount} សម្រាប់ "${expToUpdate.description}" នៅថ្ងៃនេះមែនទេ?`
      : `Do you want to confirm the payment of $${expToUpdate.amount} for "${expToUpdate.description}" today?`;

    if (window.confirm(confirmMsg)) {
      const updatedExpenses = shopData.expenses.map((exp) => {
        if (exp.id === id) {
          return {
            ...exp,
            status: "paid" as const,
            date: new Date().toISOString().split("T")[0], // Change payment date to today!
          };
        }
        return exp;
      });

      await persistData({
        ...shopData,
        expenses: updatedExpenses,
      });

      showNotice("success", language === "kh" 
        ? "បានបញ្ជាក់ការបង់ប្រាក់ចំណាយដោយជោគជ័យ!" 
        : "Expense payment confirmed successfully!"
      );
    }
  };

  const handleDeleteExpense = async (id: string) => {
    if (window.confirm("តើអ្នកពិតជាចង់លុបកំណត់ត្រាចំណាយនេះមែនទេ?")) {
      const remaining = shopData.expenses.filter((exp) => exp.id !== id);
      await persistData({ ...shopData, expenses: remaining });
      showNotice("success", "បានលុបកំណត់ត្រាចំណាយ!");
    }
  };

  const handleUpdateBudgetLimit = async (e: React.FormEvent) => {
    e.preventDefault();
    const limitNum = budgetLimitInput === "" ? 0 : Number(budgetLimitInput);
    if (limitNum < 0) {
      showNotice("error", language === "kh" ? "ដែនថវិកាកំណត់ចំណាយមិនអាចតូចជាង ០ ទេ!" : "Budget limit cannot be less than 0!");
      return;
    }

    await persistData({
      ...shopData,
      expenseBudgetLimit: limitNum,
    });

    showNotice(
      "success",
      language === "kh"
        ? `បានកំណត់ដែនថវិកាចំណាយចំនួន $${limitNum.toLocaleString()} ដោយជោគជ័យ!`
        : `Successfully set monthly expense budget limit to $${limitNum.toLocaleString()}!`
    );
  };

  // --- Handlers for CAPITAL (ប្រាក់ដើម) ---
  const handleAddCapitalTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (capitalAmount === "") {
      showNotice("error", "សូមបញ្ចូលទឹកប្រាក់ប្រតិបត្តិការ!");
      return;
    }

    const amt = Number(capitalAmount);
    if (amt <= 0) {
      showNotice("error", "ទឹកប្រាក់ប្រតិបត្តិការត្រូវតែធំជាង ០!");
      return;
    }

    const newTransaction: CapitalTransaction = {
      id: "CAP-" + Date.now().toString().slice(-6),
      type: capitalType,
      amount: amt,
      description: capitalDesc || (capitalType === "initial" ? "ប្រាក់ដើមដំបូង" : capitalType === "add" ? "ប្រាក់បន្ថែម" : "ប្រាក់ដក"),
      date: new Date().toISOString().split("T")[0],
    };

    await persistData({
      ...shopData,
      capitalTransactions: [...shopData.capitalTransactions, newTransaction],
    });

    showNotice("success", "ប្រតិបត្តិការប្រាក់ដើមត្រូវបានកត់ត្រាជោគជ័យ!");
    setCapitalAmount("");
    setCapitalDesc("");
  };

  const handleDeleteCapitalTransaction = async (id: string) => {
    if (window.confirm("តើអ្នកចង់លុបប្រតិបត្តិការប្រាក់ដើមនេះមែនទេ?")) {
      const remaining = shopData.capitalTransactions.filter((cap) => cap.id !== id);
      await persistData({ ...shopData, capitalTransactions: remaining });
      showNotice("success", "បានលុបប្រតិបត្តិការប្រាក់ដើម!");
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const updatedSettings = {
        shopName: settingsShopName,
        shopPhone: settingsShopPhone,
        defaultSalesChannel: settingsDefaultSalesChannel,
        enableCod: settingsEnableCod,
        codCarrierDefault: settingsCodCarrierDefault,
        taxPercent: settingsTaxPercent !== "" ? Number(settingsTaxPercent) : undefined,
      };

      const newShopData = {
        ...shopData,
        settings: updatedSettings,
      };

      const logDetails = language === "kh"
        ? `បានធ្វើបច្ចុប្បន្នភាពការកំណត់ប្រព័ន្ធរបស់ហាង (ឈ្មោះហាង៖ ${settingsShopName || "—"}, លេខទូរស័ព្ទ៖ ${settingsShopPhone || "—"})`
        : `Updated general system settings (Shop: ${settingsShopName || "—"}, Phone: ${settingsShopPhone || "—"})`;

      await persistData(newShopData, "UPDATE_SETTINGS", logDetails);
      showNotice("success", language === "kh" ? "💾 រក្សាទុកការកំណត់ប្រព័ន្ធបានជោគជ័យ!" : "💾 System settings successfully saved!");
    } catch (err: any) {
      showNotice("error", language === "kh" ? `កំហុសក្នុងការរក្សាទុក៖ ${err.message}` : `Save failed: ${err.message}`);
    }
  };

  // Helper translators
  const getExpenseCategoryName = (cat: string) => {
    switch (cat) {
      case "rent":
        return language === "kh" ? "ថ្លៃជួលទីតាំង/ហាង" : "Rent Fee";
      case "shipping":
        return language === "kh" ? "ថ្លៃដឹកជញ្ជូន" : "Shipping/Courier";
      case "electricity":
        return language === "kh" ? "ថ្លៃទឹកភ្លើង / ថ្លៃភ្លើង" : "Electricity/Utilities";
      case "staff":
        return language === "kh" ? "ថ្លៃបុគ្គលិក" : "Staff Wages";
      case "marketing":
        return language === "kh" ? "ចំណាយលើទីផ្សារ (Marketing)" : "Marketing";
      default:
        return language === "kh" ? "ចំណាយផ្សេងៗ" : "Other Expenses";
    }
  };

  const getCapitalTypeName = (type: string) => {
    switch (type) {
      case "initial":
        return language === "kh" ? "ប្រាក់ដើមដំបូង" : "Initial Capital";
      case "add":
        return language === "kh" ? "ប្រាក់ដើមបន្ថែម" : "Capital Addition";
      default:
        return language === "kh" ? "ប្រាក់ដើមដកចេញ" : "Capital Withdrawal";
    }
  };

  // --- Calculations for reports ---
  const totalStockNum = shopData.watches.reduce((acc, w) => acc + w.stock, 0);
  const totalSalesNum = shopData.sales.reduce((acc, s) => acc + s.totalAmount, 0);
  const totalSalesProfit = shopData.sales.reduce((acc, s) => acc + s.profit, 0);

  // Filtered sales list for the Sales tab table
  const displayedSales = shopData.sales.filter((sale) => {
    // 1. Channel Filter
    if (salesChannelFilter !== "all") {
      const isOnline = sale.saleChannel === "online";
      if (salesChannelFilter === "online" && !isOnline) return false;
      if (salesChannelFilter === "instore" && isOnline) return false;
    }

    // 2. Payment Method Filter
    if (salesPaymentMethodFilter !== "all") {
      if (sale.paymentMethod !== salesPaymentMethodFilter) return false;
    }

    // 3. Payment Status Filter
    if (salesPaymentStatusFilter !== "all") {
      const isPaid = sale.isPaid !== false;
      if (salesPaymentStatusFilter === "paid" && !isPaid) return false;
      if (salesPaymentStatusFilter === "unpaid" && isPaid) return false;
    }

    return true;
  });

  const displayedSalesProfit = displayedSales.reduce((acc, s) => acc + s.profit, 0);

  // Other Incomes is dynamic - total of incomes with source other OR source sale
  const totalOtherIncomeNum = shopData.incomes
    .filter((inc) => inc.source !== "sale")
    .reduce((acc, inc) => acc + inc.amount, 0);

  const totalExpenseNum = shopData.expenses
    .filter((exp) => exp.status !== "placeholder")
    .reduce((acc, exp) => acc + exp.amount, 0);

  // Net Profit formula: ប្រាក់ចំណេញសុទ្ធ = ផលបូកចំណេញការលក់ទាំងអស់ + ចំណូលផ្សេងៗទាំងអស់ - ចំណាយទាំងអស់
  const netProfitNum = totalSalesProfit + totalOtherIncomeNum - totalExpenseNum;

  // Dynamic timeframe filter helper for Dashboard components
  const { sevenDaysAgoStr, startOfThisMonthStr, todayStr } = (() => {
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(today.getDate() - 7);
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().split("T")[0];
    const startOfThisMonthStr = `${todayStr.substring(0, 7)}-01`;
    return { sevenDaysAgoStr, startOfThisMonthStr, todayStr };
  })();

  const filterByTimeRange = (dateStr: string) => {
    if (!dateStr) return false;
    if (dashboardTimeRange === "7_days") {
      return dateStr >= sevenDaysAgoStr;
    }
    if (dashboardTimeRange === "this_month") {
      return dateStr >= startOfThisMonthStr;
    }
    return true; // all_time
  };

  const filteredSalesNum = shopData.sales.filter((s) => filterByTimeRange(s.date)).reduce((acc, s) => acc + s.totalAmount, 0);
  const filteredOnlineSalesNum = shopData.sales.filter((s) => s.saleChannel === "online" && filterByTimeRange(s.date)).reduce((acc, s) => acc + s.totalAmount, 0);
  const filteredInstoreSalesNum = shopData.sales.filter((s) => s.saleChannel !== "online" && filterByTimeRange(s.date)).reduce((acc, s) => acc + s.totalAmount, 0);
  const filteredSalesProfit = shopData.sales.filter((s) => filterByTimeRange(s.date)).reduce((acc, s) => acc + s.profit, 0);
  const filteredOnlineSalesProfit = shopData.sales.filter((s) => s.saleChannel === "online" && filterByTimeRange(s.date)).reduce((acc, s) => acc + s.profit, 0);
  const filteredInstoreSalesProfit = shopData.sales.filter((s) => s.saleChannel !== "online" && filterByTimeRange(s.date)).reduce((acc, s) => acc + s.profit, 0);
  const filteredOtherIncomeNum = shopData.incomes
    .filter((inc) => inc.source !== "sale" && filterByTimeRange(inc.date))
    .reduce((acc, inc) => acc + inc.amount, 0);
  const filteredExpenseNum = shopData.expenses
    .filter((e) => e.status !== "placeholder" && filterByTimeRange(e.date))
    .reduce((acc, exp) => acc + exp.amount, 0);
  const filteredNetProfitNum = filteredSalesProfit + filteredOtherIncomeNum - filteredExpenseNum;

  // Payment Method Breakdown of active time range
  const cashSalesTotal = shopData.sales
    .filter((s) => filterByTimeRange(s.date) && s.isPaid !== false)
    .reduce((sum, s) => {
      if (s.paymentMethod === "cash" || !s.paymentMethod) {
        return sum + s.totalAmount;
      }
      if (s.paymentMethod === "cod" && s.codSettlement === "cash") {
        return sum + s.totalAmount;
      }
      if (s.paymentMethod === "cod" && s.codSettlement === "split") {
        return sum + (s.totalAmount / 2);
      }
      return sum;
    }, 0);

  const abaSalesTotal = shopData.sales
    .filter((s) => filterByTimeRange(s.date) && s.isPaid !== false)
    .reduce((sum, s) => {
      if (s.paymentMethod === "aba") {
        return sum + s.totalAmount;
      }
      if (s.paymentMethod === "cod" && s.codSettlement === "aba") {
        return sum + s.totalAmount;
      }
      if (s.paymentMethod === "cod" && s.codSettlement === "split") {
        return sum + (s.totalAmount / 2);
      }
      return sum;
    }, 0);

  const acledaSalesTotal = shopData.sales
    .filter((s) => filterByTimeRange(s.date) && s.isPaid !== false)
    .reduce((sum, s) => {
      if (s.paymentMethod === "acleda") {
        return sum + s.totalAmount;
      }
      if (s.paymentMethod === "cod" && s.codSettlement === "acleda") {
        return sum + s.totalAmount;
      }
      return sum;
    }, 0);

  // Daily Sales Calculations
  const todayDateStr = new Date().toISOString().split("T")[0];
  const todayRevenueNum = shopData.sales
    .filter((s) => s.date === todayDateStr)
    .reduce((acc, s) => acc + s.totalAmount, 0);
  const goalProgressPercent = dailySalesGoal > 0 ? Math.min(100, Math.round((todayRevenueNum / dailySalesGoal) * 100)) : 0;

  // Monthly Sales Calculations
  const currentMonthStr = todayDateStr.substring(0, 7); // "YYYY-MM"
  const monthRevenueNum = shopData.sales
    .filter((s) => s.date && s.date.startsWith(currentMonthStr))
    .reduce((acc, s) => acc + s.totalAmount, 0);
  const monthlyGoalProgressPercent = monthlySalesGoal > 0 ? Math.min(100, Math.round((monthRevenueNum / monthlySalesGoal) * 100)) : 0;

  const khmerMonths = [
    "មករា", "កុម្ភៈ", "មីនា", "មេសា", "ឧសភា", "មិថុនា",
    "កក្កដា", "សីហា", "កញ្ញា", "តុលា", "វិច្ឆិកា", "ធ្នូ"
  ];
  const englishMonths = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  const currentMonthName = language === "kh"
    ? `${khmerMonths[new Date().getMonth()]} ${new Date().getFullYear()}`
    : `${englishMonths[new Date().getMonth()]} ${new Date().getFullYear()}`;

  // Simple Moving Average (SMA) 30-Day Sales & 7-Day Revenue Forecasting Calculations
  const forecastData = React.useMemo(() => {
    const dates: string[] = [];
    const today = new Date();
    // Generate dates from 29 days ago until today
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(today.getDate() - i);
      dates.push(d.toISOString().split("T")[0]);
    }

    // Map each date to 0
    const salesByDate: Record<string, number> = {};
    dates.forEach((d) => {
      salesByDate[d] = 0;
    });

    // Populate actual sales
    shopData.sales.forEach((s) => {
      if (s.date && salesByDate[s.date] !== undefined) {
        salesByDate[s.date] += s.totalAmount;
      }
    });

    // Compute metrics
    const dailyRevenueArray = dates.map((d) => ({
      date: d,
      revenue: salesByDate[d] || 0,
    }));

    const totalRevenueLast30Days = dailyRevenueArray.reduce((acc, item) => acc + item.revenue, 0);
    const averageDailySales = totalRevenueLast30Days / 30;
    const forecasted7DaysRevenue = averageDailySales * 7;

    // Calculate sales velocity trend (is it growing or shrinking?)
    // Compare first 15 days vs last 15 days of the 30 days
    const firstHalfRevenue = dailyRevenueArray.slice(0, 15).reduce((acc, item) => acc + item.revenue, 0);
    const secondHalfRevenue = dailyRevenueArray.slice(15, 30).reduce((acc, item) => acc + item.revenue, 0);
    
    let trendDirection: "up" | "down" | "flat" = "flat";
    let trendPercentage = 0;
    if (firstHalfRevenue > 0) {
      trendPercentage = Math.round(((secondHalfRevenue - firstHalfRevenue) / firstHalfRevenue) * 100);
      if (trendPercentage > 5) {
        trendDirection = "up";
      } else if (trendPercentage < -5) {
        trendDirection = "down";
      }
    } else if (secondHalfRevenue > 0) {
      trendDirection = "up";
      trendPercentage = 100;
    }

    return {
      dailyRevenueArray,
      totalRevenueLast30Days,
      averageDailySales,
      forecasted7DaysRevenue,
      trendDirection,
      trendPercentage: Math.abs(trendPercentage)
    };
  }, [shopData.sales]);

  // Capital calculation: Current Capital = Initial + Add - Withdraw
  const currentCapitalNum = shopData.capitalTransactions.reduce((acc, trans) => {
    if (trans.type === "initial" || trans.type === "add") {
      return acc + trans.amount;
    } else if (trans.type === "withdraw") {
      return acc - trans.amount;
    }
    return acc;
  }, 0);

  // Filter watches table
  const filteredWatches = shopData.watches.filter((w) => {
    const q = watchSearch.toLowerCase();
    const matchesSearch = (
      w.id.toLowerCase().includes(q) ||
      w.brand.toLowerCase().includes(q) ||
      w.model.toLowerCase().includes(q) ||
      w.color.toLowerCase().includes(q)
    );
    const matchesCategory = watchFilterCategory === "all" || w.category === watchFilterCategory;
    return matchesSearch && matchesCategory;
  });

  const totalOldStockUnits = shopData.watches.reduce((acc, w) => acc + (w.oldStock !== undefined ? w.oldStock : w.stock), 0);
  const totalNewStockUnits = shopData.watches.reduce((acc, w) => acc + (w.newStock !== undefined ? w.newStock : 0), 0);
  const totalStockUnits = shopData.watches.reduce((acc, w) => acc + w.stock, 0);

  const totalOldStockValue = shopData.watches.reduce((acc, w) => acc + ((w.oldStock !== undefined ? w.oldStock : w.stock) * w.costPrice), 0);
  const totalNewStockValue = shopData.watches.reduce((acc, w) => acc + ((w.newStock !== undefined ? w.newStock : 0) * w.costPrice), 0);
  const totalStockValue = shopData.watches.reduce((acc, w) => acc + (w.stock * w.costPrice), 0);

  const lowStockWatches = shopData.watches.filter((w) => w.stock < (w.lowStockThreshold !== undefined ? w.lowStockThreshold : 5));

  const lowStockBrandAnalysis = (() => {
    // 1. Calculate how many units were sold in the last 30 days of each watch ID
    const salesIn30Days: Record<string, number> = {};
    
    // Find boundary of 30 days ago
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split("T")[0];

    shopData.sales.forEach((s) => {
      if (s.date >= thirtyDaysAgoStr) {
        salesIn30Days[s.watchId] = (salesIn30Days[s.watchId] || 0) + s.quantity;
      }
    });

    // 2. Group the watches having stock < 5 by brand
    const grouped: Record<string, typeof lowStockWatches> = {};
    lowStockWatches.forEach((w) => {
      const b = w.brand || "Other";
      if (!grouped[b]) {
        grouped[b] = [];
      }
      grouped[b].push(w);
    });

    // 3. Construct elements with velocities and reorder suggestions
    const brandGroups = Object.keys(grouped).map((brandName) => {
      const items = grouped[brandName].map((w) => {
        const unitsSold30 = salesIn30Days[w.id] || 0;
        // Weekly velocity = units sold in 30 days / 4.28
        const weeklyVelocity = Number((unitsSold30 / 4.28).toFixed(2));
        
        // Suggest reorder quantity to cover 4 weeks (1 month) of current velocity, or minimum of 5 if velocity is tiny
        // If weeklyVelocity * 4 is greater than current stock, suggested is the gap. Otherwise 5 units standard.
        const suggestedReorder = Math.max(5, Math.ceil(weeklyVelocity * 4) - w.stock);

        return {
          ...w,
          weeklyVelocity,
          suggestedReorder,
          unitsSold30
        };
      });

      return {
        brand: brandName,
        items
      };
    });

    return brandGroups;
  })();

  // 30-Day Sales Velocity Brand-Level Restock Planner
  const restockPlanningData = React.useMemo(() => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split("T")[0];

    const brandSales30: Record<string, number> = {};
    shopData.sales.forEach((s) => {
      if (s.date >= thirtyDaysAgoStr) {
        const b = s.watchBrand || "Other";
        brandSales30[b] = (brandSales30[b] || 0) + s.quantity;
      }
    });

    const allBrands = Array.from(new Set(shopData.watches.map(w => w.brand || "Other"))) as string[];
    const brandVelocityData = allBrands.map((brand) => {
      const unitsSold = brandSales30[brand] || 0;
      const weeklyVelocity = Number((unitsSold / 4.28).toFixed(2));
      
      const brandWatches = shopData.watches.filter(w => w.brand === brand);
      
      const watchesWithRestockPriority = brandWatches.map(w => {
        const watchSales30 = shopData.sales
          .filter(s => s.watchId === w.id && s.date >= thirtyDaysAgoStr)
          .reduce((sum, s) => sum + s.quantity, 0);
        const watchWeeklyVelocity = Number((watchSales30 / 4.28).toFixed(2));
        const supplier = (shopData.suppliers || []).find(sup => sup.id === w.supplierId);
        
        let priority: 'Critical' | 'High' | 'Medium' | 'Normal' = 'Normal';
        let priorityScore = 0;
        
        const threshold = w.lowStockThreshold !== undefined ? w.lowStockThreshold : 5;
        if (w.stock === 0) {
          if (watchSales30 > 0) {
            priority = 'Critical';
            priorityScore = 100 + watchSales30;
          } else {
            priority = 'High';
            priorityScore = 80;
          }
        } else if (w.stock < threshold) {
          priority = watchSales30 > 0 ? 'High' : 'Medium';
          priorityScore = 50 + watchSales30 - w.stock;
        } else {
          priority = 'Normal';
          priorityScore = watchSales30 - w.stock;
        }

        return {
          ...w,
          sales30: watchSales30,
          weeklyVelocity: watchWeeklyVelocity,
          supplier,
          priority,
          priorityScore
        };
      }).sort((a, b) => b.priorityScore - a.priorityScore);

      const totalStock = brandWatches.reduce((sum, w) => sum + w.stock, 0);
      const lowStockCount = brandWatches.filter(w => w.stock < (w.lowStockThreshold !== undefined ? w.lowStockThreshold : 5)).length;
      const outOfStockCount = brandWatches.filter(w => w.stock === 0).length;

      return {
        brand,
        unitsSold,
        weeklyVelocity,
        totalStock,
        lowStockCount,
        outOfStockCount,
        priorityWatches: watchesWithRestockPriority.slice(0, 3)
      };
    });

    return brandVelocityData
      .sort((a, b) => b.unitsSold - a.unitsSold || b.weeklyVelocity - a.weeklyVelocity)
      .slice(0, 5);
  }, [shopData.sales, shopData.watches, shopData.suppliers]);

  const lowStockMailtoUrl = (() => {
    if (lowStockWatches.length === 0) return "";
    
    const subject = encodeURIComponent("Kunthy Watch Store - Low Stock Alert & Reorder Recommender");
    
    let text = `Dear Store Manager,\n\nThis is an automated low stock warning report for Kunthy Watch Store.\nGenerated on: ${new Date().toLocaleString()}\n\nWe have identified ${lowStockWatches.length} items that are low in stock (less than 5 units left) and require reordering. Below are the suggestions based on recent 30-day sales velocity:\n\n`;
    
    lowStockBrandAnalysis.forEach((group) => {
      text += `===============================================\n`;
      text += `BRAND: ${group.brand.toUpperCase()}\n`;
      text += `===============================================\n`;
      group.items.forEach((item) => {
        text += `- Model: ${item.model} (${item.color})\n`;
        text += `  SKU/ID: ${item.id}\n`;
        text += `  Current Stock: ${item.stock} units left\n`;
        text += `  Recent 30d Sales: ${item.unitsSold30} sold\n`;
        text += `  Est. Weekly Velocity: ${item.weeklyVelocity} units/week\n`;
        text += `  👉 SUGGESTED REORDER QTY: ${item.suggestedReorder} units\n\n`;
      });
    });
    
    text += `\nPlease log into the dashboard to update restocks or plan inventory orders with suppliers.\n\nBest regards,\nChrono AI Inventory System`;
    
    return `mailto:timechrono.tc@gmail.com?subject=${subject}&body=${encodeURIComponent(text)}`;
  })();

  // Group sales by date chronologically for the Sales Trend chart
  const salesTrendData = (() => {
    const revenueByDate: Record<string, number> = {};
    shopData.sales
      .filter((s) => filterByTimeRange(s.date))
      .forEach((sale) => {
        const d = sale.date; // assuming ISO date string or YYYY-MM-DD
        revenueByDate[d] = (revenueByDate[d] || 0) + sale.totalAmount;
      });

    const sortedDates = Object.keys(revenueByDate).sort();
    return sortedDates.map((dateStr) => {
      const parts = dateStr.split("-");
      // Format to DD/MM for brevity on the x-axis tick, fallback if invalid
      const shortDate = parts.length === 3 ? `${parts[2]}/${parts[1]}` : dateStr;
      return {
        date: shortDate,
        fullDate: dateStr,
        "Revenue": revenueByDate[dateStr],
      };
    });
  })();

  // Calculate daily sales vs goal for the past 7 days
  const past7DaysGoalData = (() => {
    const list = [];
    const today = new Date();
    
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(today.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];
      
      const daySales = shopData.sales.filter((s) => s.date === dateStr);
      const dayRevenue = daySales.reduce((acc, s) => acc + s.totalAmount, 0);
      
      const parts = dateStr.split("-");
      const shortLabel = parts.length === 3 ? `${parts[2]}/${parts[1]}` : dateStr;
      
      list.push({
        date: shortLabel,
        fullDate: dateStr,
        "Revenue": dayRevenue,
        "Goal": dailySalesGoal,
      });
    }
    return list;
  })();

  // Expense statistics by category for the Pie Chart
  const expensePieData = (() => {
    const periodExpenses = shopData.expenses.filter((e) => filterByTimeRange(e.date));
    const rentSum = periodExpenses.filter((e) => e.category === "rent").reduce((acc, e) => acc + e.amount, 0);
    const shippingSum = periodExpenses.filter((e) => e.category === "shipping").reduce((acc, e) => acc + e.amount, 0);
    const staffSum = periodExpenses.filter((e) => e.category === "staff").reduce((acc, e) => acc + e.amount, 0);
    const marketingSum = periodExpenses.filter((e) => e.category === "marketing").reduce((acc, e) => acc + e.amount, 0);
    const otherSum = periodExpenses.filter((e) => e.category === "other").reduce((acc, e) => acc + e.amount, 0);

    const data = [
      {
        name: language === "kh" ? "ថ្លៃជួលផ្ទះ/ហាង" : "Rent & Utilities",
        value: rentSum,
        category: "rent",
        color: "#f59e0b", // Amber
      },
      {
        name: language === "kh" ? "សេវាដឹកជញ្ជូន" : "Shipping & Delivery",
        value: shippingSum,
        category: "shipping",
        color: "#06b6d4", // Cyan
      },
      {
        name: language === "kh" ? "ប្រាក់ខែបុគ្គលិក" : "Staff Salaries",
        value: staffSum,
        category: "staff",
        color: "#8b5cf6", // Purple
      },
      {
        name: language === "kh" ? "ចំណាយលើទីផ្សារ" : "Marketing Expenses",
        value: marketingSum,
        category: "marketing",
        color: "#e11d48", // Rose Red
      },
      {
        name: language === "kh" ? "ចំណាយផ្សេងៗ" : "Other Expenses",
        value: otherSum,
        category: "other",
        color: "#ec4899", // Pink
      },
    ];

    // Only return categories that have a value > 0, or all categories if all are 0
    const filtered = data.filter((item) => item.value > 0);
    return filtered.length > 0 ? filtered : data;
  })();

  // Dynamic Theme Styling Tokens
  const sBg = theme === "dark" ? "bg-slate-950 text-slate-100" : "bg-zinc-50 text-zinc-900";
  const sCard = theme === "dark" ? "bg-slate-900 border-slate-800" : "bg-white border-zinc-200 shadow-sm text-zinc-900";
  const sTextMuted = theme === "dark" ? "text-slate-400" : "text-zinc-500";
  const sTextMain = theme === "dark" ? "text-slate-100" : "text-zinc-800";
  const sBorder = theme === "dark" ? "border-slate-800" : "border-zinc-200";
  const sInput = theme === "dark" ? "bg-slate-950 border-slate-800 placeholder-slate-600 focus:border-amber-500 text-slate-100" : "bg-white border-zinc-300 placeholder-zinc-400 focus:border-amber-500 text-zinc-900";
  const sTableHead = theme === "dark" ? "bg-slate-950 text-slate-400 border-slate-800" : "bg-zinc-100 text-zinc-600 border-zinc-200";
  const sRowEven = theme === "dark" ? "bg-slate-900/40" : "bg-zinc-50/50";
  const sTabsBg = theme === "dark" ? "bg-slate-900 border-slate-800" : "bg-zinc-100 border-zinc-200 shadow-inner";
  const sHeaderBg = theme === "dark" ? "border-slate-800 bg-slate-900/80" : "border-zinc-200 bg-white/95 shadow-sm";
  const sModalBg = theme === "dark" ? "bg-slate-900 text-slate-100 border-slate-800" : "bg-white text-zinc-900 border-zinc-200";

  if (!isLoggedIn) {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className={`min-h-screen ${sBg} flex flex-col font-sans transition-colors duration-200`}>
      
      {/* Header Container */}
      <header className={`border-b ${sBorder} ${sHeaderBg} backdrop-blur-md sticky top-0 z-50 px-4 md:px-8 py-4 flex flex-col md:flex-row items-center justify-between gap-4 transition-colors duration-200`}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500 shadow-md shrink-0">
            <WatchIcon size={22} />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-serif font-bold tracking-wider text-amber-500 flex items-center gap-2">
              {t.appName}
              <span className={`text-[10px] uppercase font-sans px-2.5 py-0.5 rounded-full font-bold border transition-all ${
                userRole === "owner" 
                  ? "bg-amber-500/15 border-amber-500/30 text-amber-500" 
                  : "bg-blue-500/15 border-blue-500/30 text-blue-500"
              }`}>
                {userRole === "owner" ? t.ownerLabel : t.staffLabel}
              </span>
            </h1>
            <p className={`text-xs ${sTextMuted} font-light`}>
              {t.appSubtitle} | <span className="font-semibold">{userRole === "owner" ? t.ownerNameLabel : t.adminNameLabel}</span>
            </p>
          </div>
        </div>

        {/* Top Header Buttons */}
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto justify-end">
          {/* Synchronous Offline/Online and Sync Status Badge */}
          <div
            title={
              syncState === "synced"
                ? language === "kh" ? "ទិន្នន័យត្រូវបានរក្សាទុកមានសុវត្ថិភាពទូទាំង Cloud" : "Data perfectly synced with Cloud"
                : syncState === "syncing"
                ? language === "kh" ? "កំពុងរក្សាទុកទិន្នន័យឡើងទៅ Cloud..." : "Syncing details with Cloud..."
                : language === "kh" ? "ទិន្នន័យត្រូវបានរក្សាទុកក្រៅបណ្តាញក្នុងកម្មវិធីរុករក" : "Saved locally on offline browser storage"
            }
            className={`px-3 py-2 rounded-xl border flex items-center gap-1.5 text-[11px] font-bold select-none transition-all ${
              syncState === "synced"
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-500"
                : syncState === "syncing"
                ? "bg-sky-500/10 border-sky-500/30 text-sky-500 animate-pulse"
                : "bg-amber-500/10 border-amber-500/30 text-amber-500 animate-pulse"
            }`}
          >
            {syncState === "synced" ? (
              <>
                <Wifi size={13} className="shrink-0" />
                <span>
                  {language === "kh" ? "បានសមកាលកម្ម" : "Synced (Online)"}
                </span>
              </>
            ) : syncState === "syncing" ? (
              <>
                <RefreshCw size={13} className="animate-spin shrink-0" />
                <span>
                  {language === "kh" ? "កំពុងសមកាលកម្ម..." : "Syncing..."}
                </span>
              </>
            ) : (
              <>
                <WifiOff size={13} className="shrink-0" />
                <span>
                  {language === "kh" ? "រក្សាទុកដោយក្រៅប្រព័ន្ធ" : "Saved Offline"}
                </span>
              </>
            )}
          </div>

          {/* Exchange Rate Badge */}
          <div className={`px-3 py-2 rounded-xl border flex items-center gap-1.5 text-xs font-semibold select-none ${
            theme === "dark" 
              ? "bg-slate-800 border-slate-700 text-slate-300" 
              : "bg-white border-zinc-200 text-zinc-700"
          }`}>
            <span className="text-amber-500 font-bold">1$ =</span>
            <input
              type="number"
              value={rateInput}
              onChange={(e) => setRateInput(e.target.value)}
              onBlur={() => {
                const val = Number(rateInput);
                if (!isNaN(val) && val > 0) {
                  handleUpdateExchangeRate(val);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const val = Number(rateInput);
                  if (!isNaN(val) && val > 0) {
                    handleUpdateExchangeRate(val);
                  }
                  e.currentTarget.blur();
                }
              }}
              title={language === "kh" ? "កែប្រែអត្រាដូរប្រាក់ (រៀល/$)" : "Edit exchange rate (KHR/$)"}
              className="w-12 text-center bg-transparent focus:outline-none focus:border-b focus:border-amber-500 font-mono text-[11px] font-bold p-0 border-0 text-slate-100"
            />
            <span className="text-[11px] text-slate-400 font-medium">៛</span>
          </div>

          {/* Language picker */}
          <button
            onClick={toggleLanguage}
            title={language === "kh" ? "English" : "ភាសាខ្មែរ"}
            className={`px-3 py-2 rounded-xl border flex items-center gap-1.5 transition-all text-xs cursor-pointer font-semibold ${
              theme === "dark" 
                ? "bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300" 
                : "bg-white hover:bg-zinc-100 border-zinc-200 text-zinc-700"
            }`}
          >
            <Languages size={13} className="text-amber-550 mr-0.5" />
            <span>{language === "kh" ? "🇰🇭 KH" : "🇬🇧 EN"}</span>
          </button>

          {/* Dark/Light style switch */}
          <button
            onClick={toggleTheme}
            title={theme === "dark" ? "Light Mode" : "Dark Mode"}
            className={`p-2 rounded-xl border transition-all cursor-pointer ${
              theme === "dark" 
                ? "bg-slate-800 hover:bg-slate-700 border-slate-700 text-amber-400" 
                : "bg-white hover:bg-zinc-100 border-zinc-200 text-zinc-500"
            }`}
          >
            {theme === "dark" ? <Sun size={15} /> : <Moon size={15} className="text-slate-700" />}
          </button>

          <button
            onClick={loadData}
            title={language === "kh" ? "ទាញទិន្នន័យម្តងទៀត" : "Pull fresh state"}
            className={`p-2 rounded-xl border transition-all cursor-pointer ${
              theme === "dark" 
                ? "bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-400" 
                : "bg-white hover:bg-zinc-100 border-zinc-200 text-zinc-500"
            }`}
          >
            <RefreshCw size={15} />
          </button>

          {/* Force clear PWA cache and update app button */}
          <button
            onClick={handleForceUpdateApp}
            title={language === "kh" ? "សម្អាត Cache & អាប់ដេត App" : "Force Clear Cache & Update App"}
            className={`p-2 rounded-xl border transition-all cursor-pointer flex items-center justify-center ${
              theme === "dark" 
                ? "bg-slate-800 hover:bg-slate-700 border-slate-700 text-amber-500 hover:text-amber-400" 
                : "bg-white hover:bg-zinc-100 border-zinc-200 text-amber-600 hover:text-amber-700"
            }`}
          >
            <Sparkles size={15} />
          </button>

          {/* Backup data snapshot button */}
          <button
            id="header-backup-data-btn"
            onClick={() => setIsBackupModalOpen(true)}
            title={language === "kh" ? "ទាញយកទិន្នន័យបម្រុងទុក (JSON)" : "Download Backup Snapshot (JSON)"}
            className={`p-2 rounded-xl border transition-all cursor-pointer flex items-center justify-center ${
              theme === "dark" 
                ? "bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-400 hover:text-amber-500" 
                : "bg-white hover:bg-zinc-100 border-zinc-200 text-zinc-500 hover:text-amber-600"
            }`}
          >
            <Download size={15} />
          </button>
          
          {/* Reset button - Only show to Owner Kunthy */}
          {userRole === "owner" && (
            <button
              onClick={handleResetData}
              className={`px-3.5 py-2 text-xs font-semibold rounded-xl border transition-all cursor-pointer ${
                theme === "dark"
                  ? "bg-red-500/10 hover:bg-red-500/20 text-red-400 border-red-500/20"
                  : "bg-red-50 hover:bg-red-100 text-red-650 border-red-200"
              }`}
            >
              {language === "kh" ? "កំណត់ឡើងវិញ" : "Reset Data"}
            </button>
          )}

          <div className={`h-6 w-[1.5px] ${theme === "dark" ? "bg-slate-800" : "bg-zinc-200"}`} />

          <button
            onClick={handleLogout}
            className={`px-4 py-2 text-xs font-semibold rounded-xl border flex items-center gap-1.5 transition-all cursor-pointer ${
              theme === "dark" 
                ? "bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300"
                : "bg-zinc-800 hover:bg-zinc-900 border-zinc-750 text-white shadow"
            }`}
          >
            <LogOut size={13} />
            {t.logoutBtn}
          </button>
        </div>
      </header>

      {/* Main Status Msg Alert Banner */}
      {statusMsg && (
        <div className="absolute top-20 right-4 md:right-8 z-50 animate-bounce">
          <div className={`p-4 rounded-xl shadow-2xl border flex items-center gap-3 max-w-sm ${
            statusMsg.type === "success" 
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
              : "bg-red-500/10 border-red-500/30 text-red-300"
          }`}>
            <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${statusMsg.type === "success" ? "bg-emerald-500 anim-ping" : "bg-red-500"}`} />
            <p className="text-sm font-sans tracking-wide leading-relaxed">{statusMsg.text}</p>
          </div>
        </div>
      )}

      {/* Primary Area Grid */}
      <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full space-y-8">
        
        {/* Statistics Widgets Row - Visually grouped and partitioned into 3 columns using dashed sewing lines (ជួរដេរ) */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-slate-900/40 p-6 rounded-2xl border border-slate-800 shadow-xl">
          
          {/* Group 1: Capital & Stock Valuation */}
          <div className="space-y-4 md:pr-6 md:border-r md:border-dashed md:border-slate-800 border-b border-dashed border-slate-800 pb-6 md:pb-0">
            <h4 className="text-[10px] font-extrabold text-amber-500 uppercase tracking-widest flex items-center gap-1.5 font-sans">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
              {language === "kh" ? "ផ្នែកដើមទុន និងតម្លៃស្តុក" : "Capital & Stock Value"}
            </h4>
            <div className="grid grid-cols-1 gap-4">
              {/* Card: Current Capital - Only for Owner Kunthy */}
              {userRole === "owner" ? (
                <div className={`${sCard} border rounded-2xl p-4 flex items-start justify-between relative overflow-hidden transition-all hover:scale-[1.01]`}>
                  <div className="absolute bottom-[-10px] right-[-10px] opacity-[0.03] dark:opacity-[0.05] text-slate-500 dark:text-slate-150">
                    <Wallet size={70} />
                  </div>
                  <div className="space-y-1 z-10 w-full">
                    <span className={`text-[11px] ${sTextMuted} font-semibold uppercase tracking-wider block`}>{t.currentCapital}</span>
                    <p className="text-base font-bold font-mono text-amber-500">
                      ${currentCapitalNum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    <span className="text-[9px] text-emerald-500 font-medium">Verified Core Registry</span>
                  </div>
                  <div className="w-9 h-9 rounded-xl bg-amber-500/15 flex items-center justify-center text-amber-500 shrink-0">
                    <Wallet size={16} />
                  </div>
                </div>
              ) : (
                <div className={`${sCard} border rounded-2xl p-4 flex flex-col items-center justify-center relative overflow-hidden text-center opacity-70 border-dashed border-zinc-200 dark:border-slate-800`}>
                  <span className="text-xs text-red-400 font-sans font-semibold mb-1">
                    {t.pichRestrictedText}
                  </span>
                  <span className="text-[9px] text-slate-500 font-medium">{language === "kh" ? "សិទ្ធិបុគ្គលិក" : "Staff level authorization"}</span>
                </div>
              )}

              {/* Card: Combined Stock Value - Only for Owner Kunthy, displays Old + New Stock Values next to Current Capital */}
              {userRole === "owner" ? (
                <div className={`${sCard} border rounded-2xl p-4 flex items-start justify-between relative overflow-hidden transition-all hover:scale-[1.01] bg-gradient-to-br from-emerald-500/5 to-transparent`}>
                  <div className="absolute bottom-[-10px] right-[-10px] opacity-[0.03] dark:opacity-[0.05] text-slate-500 dark:text-slate-150">
                    <DollarSign size={70} />
                  </div>
                  <div className="space-y-1 z-10 w-full">
                    <span className={`text-[11px] ${sTextMuted} font-semibold uppercase tracking-wider block`}>
                      {language === "kh" ? "លុយថ្លៃដើមស្តុកសរុប" : "Combined Stock Value"}
                    </span>
                    <p className="text-base font-bold font-mono text-emerald-500">
                      ${totalStockValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    <div className="flex gap-2 text-[9px] text-slate-400 font-sans mt-0.5">
                      <span>ចាស់: <span className="text-slate-100 font-semibold font-mono">${totalOldStockValue.toLocaleString()}</span></span>
                      <span>|</span>
                      <span>ថ្មី: <span className="text-emerald-400 font-bold font-mono">${totalNewStockValue.toLocaleString()}</span></span>
                    </div>
                  </div>
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/15 flex items-center justify-center text-emerald-500 shrink-0">
                    <DollarSign size={16} />
                  </div>
                </div>
              ) : (
                <div className={`${sCard} border rounded-2xl p-4 flex flex-col items-center justify-center relative overflow-hidden text-center opacity-70 border-dashed border-zinc-200 dark:border-slate-800`}>
                  <span className="text-xs text-red-400 font-sans font-semibold mb-1">
                    {t.pichRestrictedText}
                  </span>
                  <span className="text-[9px] text-slate-500 font-medium">{language === "kh" ? "សិទ្ធិបុគ្គលិក" : "Staff level authorization"}</span>
                </div>
              )}
            </div>
          </div>

          {/* Group 2: Stock Volume & Total Sales */}
          <div className="space-y-4 md:px-6 md:border-r md:border-dashed md:border-slate-800 border-b border-dashed border-slate-800 pb-6 md:pb-0">
            <h4 className="text-[10px] font-extrabold text-blue-400 uppercase tracking-widest flex items-center gap-1.5 font-sans">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse"></span>
              {language === "kh" ? "ផ្នែកចលនាស្តុក និងការលក់" : "Stock Volume & Sales Flow"}
            </h4>
            <div className="grid grid-cols-1 gap-4">
              {/* Card: Remaining Stock - Both Owner Kunthy & Admin Pich */}
              <div className={`${sCard} border rounded-2xl p-4 flex items-start justify-between relative overflow-hidden transition-all hover:scale-[1.01]`}>
                <div className="absolute bottom-[-10px] right-[-10px] opacity-[0.03] dark:opacity-[0.05] text-slate-500 dark:text-slate-150">
                  <Layers size={70} />
                </div>
                <div className="space-y-1 z-10">
                  <span className={`text-[11px] ${sTextMuted} font-semibold uppercase tracking-wider block`}>{t.remainingStock}</span>
                  <p className="text-base font-bold font-mono text-blue-500 dark:text-blue-400">
                    {totalStockNum.toLocaleString()} <span className="text-xs text-slate-500 font-light">{language === "kh" ? "គ្រឿង" : "units"}</span>
                  </p>
                  {lowStockWatches.length > 0 ? (
                    <span className="text-[9px] text-red-500 dark:text-red-400 font-sans flex items-center gap-0.5 font-semibold">
                      <AlertTriangle size={10} /> {lowStockWatches.length} {language === "kh" ? "មុខជិតអស់ស្តុក" : "items low stock"}
                    </span>
                  ) : (
                    <span className="text-[9px] text-emerald-500 font-medium">{language === "kh" ? "ស្តុកមានគ្រប់គ្រាន់" : "Stock safe & stable"}</span>
                  )}
                </div>
                <div className="w-9 h-9 rounded-xl bg-blue-500/15 flex items-center justify-center text-blue-500">
                  <Layers size={16} />
                </div>
              </div>

              {/* Card: Total Sales Revenue - Both Owner & Pich */}
              <div className={`${sCard} border rounded-2xl p-4 flex items-start justify-between relative overflow-hidden transition-all hover:scale-[1.01]`}>
                <div className="absolute bottom-[-10px] right-[-10px] opacity-[0.03] dark:opacity-[0.05] text-slate-500 dark:text-slate-150">
                  <TrendingUp size={70} />
                </div>
                <div className="space-y-1 z-10">
                  <span className={`text-[11px] ${sTextMuted} font-semibold uppercase tracking-wider block`}>{t.totalSales}</span>
                  <p className="text-base font-bold font-mono text-emerald-500">
                    ${totalSalesNum.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </p>
                  <span className={`text-[9px] ${sTextMuted}`}>
                    {language === "kh" ? `ទិន្នន័យពី ${shopData.sales.length} វិក្កយបត្រ` : `Total ${shopData.sales.length} orders`}
                  </span>
                </div>
                <div className="w-9 h-9 rounded-xl bg-emerald-500/15 flex items-center justify-center text-emerald-400">
                  <TrendingUp size={16} />
                </div>
              </div>
            </div>
          </div>

          {/* Group 3: Business Profitability & Expenses */}
          <div className="space-y-4 md:pl-6">
            <h4 className="text-[10px] font-extrabold text-emerald-400 uppercase tracking-widest flex items-center gap-1.5 font-sans">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              {language === "kh" ? "ផ្នែកចំណេញ និងចំណាយ" : "Profit & Expenditures"}
            </h4>
            <div className="grid grid-cols-1 gap-4">
              {/* Card: Net Profit or Restricted Card */}
              {userRole === "owner" ? (
                <div className={`${sCard} border rounded-2xl p-4 flex items-start justify-between relative overflow-hidden transition-all hover:scale-[1.01] bg-gradient-to-br from-amber-500/5 to-transparent`}>
                  <div className="absolute bottom-[-10px] right-[-10px] opacity-[0.03] dark:opacity-[0.05] text-slate-500 dark:text-slate-150">
                    <Coins size={70} />
                  </div>
                  <div className="space-y-1 z-10">
                    <span className={`text-[11px] ${sTextMuted} font-semibold uppercase tracking-wider block`}>{t.netProfit}</span>
                    <p className={`text-base font-bold font-mono ${netProfitNum >= 0 ? "text-amber-500" : "text-red-500"}`}>
                      ${netProfitNum.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </p>
                    <span className="text-[9px] text-amber-500 font-sans block leading-none font-medium">
                      {language === "kh" ? "ប្រាក់ដកចំណាយរួចសរុប" : "Revenue minus total costs"}
                    </span>
                  </div>
                  <div className="w-9 h-9 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-500">
                    <Coins size={16} />
                  </div>
                </div>
              ) : (
                <div className={`${sCard} border rounded-2xl p-4 flex flex-col items-center justify-center relative overflow-hidden text-center opacity-70 border-dashed border-zinc-200 dark:border-slate-800`}>
                  <span className="text-xs text-red-400 font-sans font-semibold mb-1">
                    {t.pichRestrictedText}
                  </span>
                  <span className="text-[9px] text-slate-500 font-medium">{language === "kh" ? "សិទ្ធិបុគ្គលិក" : "Staff level authorization"}</span>
                </div>
              )}

              {/* Card: Total Expenses - Operational Costs */}
              <div className={`${sCard} border rounded-2xl p-4 flex items-start justify-between relative overflow-hidden transition-all hover:scale-[1.01]`}>
                <div className="absolute bottom-[-10px] right-[-10px] opacity-[0.03] dark:opacity-[0.05] text-rose-500/10 dark:text-rose-400/10">
                  <TrendingDown size={70} />
                </div>
                <div className="space-y-1 z-10">
                  <span className={`text-[11px] ${sTextMuted} font-semibold uppercase tracking-wider block`}>{t.totalExpense}</span>
                  <p className="text-base font-bold font-mono text-rose-500">
                    ${totalExpenseNum.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </p>
                  <span className="text-[9px] text-rose-500 font-sans block leading-none font-medium">
                    {language === "kh" ? "ចំណាយសរុបទាំងអស់" : "Total store cost outflow"}
                  </span>
                </div>
                <div className="w-9 h-9 rounded-xl bg-rose-500/15 flex items-center justify-center text-rose-500">
                  <TrendingDown size={16} />
                </div>
              </div>
            </div>
          </div>

        </section>

        {/* Tab Controls */}
        <div className={`flex border-b ${sBorder} gap-1 overflow-x-auto pb-px scrollbar-thin`}>
          {[
            { id: "dashboard", label: t.dashboardTab, icon: FileSpreadsheet, show: userRole === "owner" },
            { id: "watches", label: t.watchesTab, icon: WatchIcon, show: true },
            { id: "sales", label: t.salesTab, icon: TrendingUp, show: true },
            { id: "transactions", label: t.transactionsTab, icon: DollarSign, show: true },
            { id: "capital", label: t.capitalTab, icon: Wallet, show: userRole === "owner" },
            { id: "suppliers", label: t.suppliersTab, icon: Truck, show: userRole === "owner" },
            { id: "closings", label: language === "kh" ? "បិទបញ្ជីចុងខែ/ឆ្នាំ" : "Period Closing", icon: CalendarCheck, show: userRole === "owner" },
            { id: "accounts", label: language === "kh" ? "គ្រប់គ្រងគណនី" : "User Accounts", icon: Users, show: userRole === "owner" },
            { id: "settings", label: language === "kh" ? "ការកំណត់ប្រព័ន្ធ" : "System Settings", icon: Settings, show: userRole === "owner" },
            { id: "audit", label: language === "kh" ? "កំណត់ហេតុប្រព័ន្ធ" : "Audit Ledger", icon: ClipboardList, show: true },
            { id: "ai", label: t.aiChatTab, icon: Sparkles, badge: "LIVE", show: true },
          ]
            .filter((tab) => tab.show)
            .map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  id={`tab-${tab.id}`}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 px-5 py-3.5 text-xs font-bold tracking-wide border-b-2 whitespace-nowrap transition-all cursor-pointer ${
                    active
                      ? "border-amber-500 text-amber-500 bg-amber-500/5"
                      : `border-transparent ${sTextMuted} hover:text-amber-500/80 hover:bg-slate-500/5`
                  }`}
                >
                  <Icon size={14} className={active ? "text-amber-400" : sTextMuted} />
                  <span>{tab.label}</span>
                  {tab.badge && (
                    <span className="text-[9px] font-bold tracking-wider px-1.5 py-0.5 bg-amber-500 text-slate-950 rounded-full animate-pulse ml-0.5 font-sans">
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
        </div>

        {/* LOADING INDICATOR */}
        {loading && activeTab !== "ai" && (
          <div className="flex flex-col items-center justify-center py-24 space-y-4">
            <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-xs text-slate-400 font-light">កំពុងពន្លា និងទាញយកទិន្នន័យពីម៉ាស៊ីនបម្រើ...</span>
          </div>
        )}

        {/* TAB CONTENTS */}
        {!loading && (
          <div className="mt-6">
            
            {/* 1. DASHBOARD VIEW */}
            {activeTab === "dashboard" && (
              <div className="space-y-6">
                
                {/* Time Range Selector */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-lg">
                  <div className="space-y-0.5">
                    <h4 className="text-xs font-extrabold text-amber-500 uppercase tracking-widest font-sans">
                      {language === "kh" ? "ជម្រើសកាលវិភាគរបាយការណ៍" : "Reporting Timeframe"}
                    </h4>
                    <p className={`text-[11px] ${sTextMuted}`}>
                      {language === "kh" 
                        ? "ផ្លាស់ប្តូរ និងត្រងទិន្នន័យក្រាហ្វិក និងតារាងសង្ខេបហិរញ្ញវត្ថុ" 
                        : "Filter financial snapshot and visualization charts dynamically."}
                    </p>
                  </div>
                  <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-850 gap-1 self-start sm:self-auto">
                    {(
                      [
                        { id: "7_days", labelKh: "៧ ថ្ងៃចុងក្រោយ", labelEn: "Last 7 Days" },
                        { id: "this_month", labelKh: "ខែនេះ", labelEn: "This Month" },
                        { id: "all_time", labelKh: "គ្រប់ពេល", labelEn: "All Time" },
                      ] as const
                    ).map((range) => {
                      const active = dashboardTimeRange === range.id;
                      return (
                        <button
                          key={range.id}
                          id={`time-range-btn-${range.id}`}
                          onClick={() => setDashboardTimeRange(range.id)}
                          className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all whitespace-nowrap cursor-pointer ${
                            active
                              ? "bg-amber-500 text-slate-950 font-bold shadow-md"
                              : "text-slate-400 hover:text-slate-100 dark:hover:bg-slate-900 hover:bg-zinc-105"
                          }`}
                        >
                          {language === "kh" ? range.labelKh : range.labelEn}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* STAGNANT & LOW-MOVING STOCK SUMMARY ALERT */}
                {(() => {
                  const rate = shopData.exchangeRate || 4100;
                  // Low-moving / stagnant stock: watches with stock > 0 that have 0 sales
                  const slowMovingWatches = (shopData.watches || []).filter((w) => {
                    if (w.stock <= 0) return false;
                    const hasSales = (shopData.sales || []).some((s) => s.watchId === w.id);
                    return !hasSales;
                  });

                  const totalSlowCostValue = slowMovingWatches.reduce((sum, w) => sum + w.costPrice * w.stock, 0);
                  const totalSlowRetailValue = slowMovingWatches.reduce((sum, w) => sum + w.sellPrice * w.stock, 0);
                  const totalSlowQuantity = slowMovingWatches.reduce((sum, w) => sum + w.stock, 0);
                  const totalInventoryCost = (shopData.watches || []).reduce((sum, w) => sum + w.costPrice * w.stock, 0);
                  const stagnantPercentage = totalInventoryCost > 0 ? (totalSlowCostValue / totalInventoryCost) * 100 : 0;

                  return (
                    <div className={`${sCard} border rounded-2xl p-6 shadow-xl space-y-4 bg-gradient-to-br from-amber-500/[0.02] to-slate-900 border-amber-500/20`}>
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b dark:border-slate-800 border-zinc-200 pb-3">
                        <div className="flex items-center gap-2">
                          <AlertTriangle size={18} className="text-amber-500 animate-bounce" />
                          <div className="space-y-0.5">
                            <h3 className="text-sm font-bold text-slate-100 font-serif">
                              {language === "kh" ? "សេចក្តីសង្ខេបស្តុកគាំង ឬលក់យឺត" : "Stagnant & Slow-Moving Stock Alert"}
                            </h3>
                            <p className="text-[10px] text-slate-400 font-sans">
                              {language === "kh" 
                                ? "នាឡិកាដែលមានក្នុងស្តុក ប៉ុន្តែមិនទាន់មានការលក់ចេញសោះ (គិតត្រឹមពេលបច្ចុប្បន្ន)" 
                                : "Watches with positive stock but have zero sales recorded in the system."}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[10px] bg-amber-500/10 text-amber-500 border border-amber-500/20 font-extrabold px-2.5 py-1 rounded font-mono">
                            {stagnantPercentage.toFixed(1)}% {language === "kh" ? "នៃទុនស្តុក" : "of Inventory Capital"}
                          </span>
                        </div>
                      </div>

                      {slowMovingWatches.length === 0 ? (
                        <div className="flex items-center gap-3 p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-xl text-xs text-emerald-400 font-sans">
                          <span className="text-base">✓</span>
                          <span>{language === "kh" ? "មិនមានទំនិញគាំងស្តុក ឬលក់យឺតទេ! ស្តុករបស់អ្នកមានចលនាបានល្អប្រសើរណាស់។" : "No stagnant or slow-moving stock detected! Your inventory flow is excellent."}</span>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {/* Metrics Grid */}
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
                            {/* Cost Value Locked */}
                            <div className="p-4 bg-slate-950/60 border border-slate-850 rounded-xl space-y-1 shadow-inner relative overflow-hidden group">
                              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                                {language === "kh" ? "ទុនគាំងសរុប (តម្លៃដើម)" : "Stagnant Capital (Cost)"}
                              </span>
                              <div className="flex items-baseline gap-2">
                                <span className="text-lg font-extrabold font-mono text-rose-400">${totalSlowCostValue.toLocaleString()}</span>
                                <span className="text-[10px] font-mono text-slate-500">≈ ៛{(totalSlowCostValue * rate).toLocaleString()}</span>
                              </div>
                              <div className="text-[9px] text-slate-500">
                                {language === "kh" ? "ដើមទុនដែលជាប់គាំងក្នុងស្តុក" : "Capital locked in stagnant stock"}
                              </div>
                            </div>

                            {/* Retail Value */}
                            <div className="p-4 bg-slate-950/60 border border-slate-850 rounded-xl space-y-1 shadow-inner relative overflow-hidden group">
                              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                                {language === "kh" ? "តម្លៃលក់រាយរំពឹងទុក" : "Expected Retail Value"}
                              </span>
                              <div className="flex items-baseline gap-2">
                                <span className="text-lg font-extrabold font-mono text-amber-500">${totalSlowRetailValue.toLocaleString()}</span>
                                <span className="text-[10px] font-mono text-slate-500">≈ ៛{(totalSlowRetailValue * rate).toLocaleString()}</span>
                              </div>
                              <div className="text-[9px] text-slate-500">
                                {language === "kh" ? "តម្លៃរាយសរុបបើលក់អស់" : "Potential retail revenue if cleared"}
                              </div>
                            </div>

                            {/* Qty Stagnant */}
                            <div className="p-4 bg-slate-950/60 border border-slate-850 rounded-xl space-y-1 shadow-inner relative overflow-hidden group">
                              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                                {language === "kh" ? "ចំនួនគ្រឿងគាំងសរុប" : "Total Inactive Units"}
                              </span>
                              <div className="flex items-baseline gap-2">
                                <span className="text-lg font-extrabold font-mono text-slate-200">{totalSlowQuantity}</span>
                                <span className="text-[10px] font-sans text-slate-400">{language === "kh" ? "គ្រឿង" : "units"}</span>
                              </div>
                              <div className="text-[9px] text-slate-500">
                                {language === "kh" ? `${slowMovingWatches.length} ម៉ូដែលផ្សេងគ្នា` : `${slowMovingWatches.length} unique watch models`}
                              </div>
                            </div>
                          </div>

                          {/* Progress Bar of locked capital */}
                          <div className="bg-slate-950/50 p-3 rounded-xl border border-slate-850 space-y-1.5">
                            <div className="flex justify-between items-center text-[10px] font-medium text-slate-400">
                              <span>{language === "kh" ? "សមាមាត្រទុនស្តុកគាំងធៀបនឹងស្តុកសរុប" : "Ratio of Stagnant Capital to Total Stock"}</span>
                              <span className="font-bold font-mono text-amber-500">{stagnantPercentage.toFixed(1)}%</span>
                            </div>
                            <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-gradient-to-r from-amber-500 to-rose-500 transition-all duration-500"
                                style={{ width: `${Math.min(stagnantPercentage, 100)}%` }}
                              />
                            </div>
                          </div>

                          {/* Interactive Toggle for Details */}
                          <div className="pt-1">
                            <button
                              type="button"
                              onClick={() => setShowSlowStockDetails(!showSlowStockDetails)}
                              className="w-full flex items-center justify-center gap-1.5 py-2 px-4 rounded-xl bg-slate-950 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 text-xs text-slate-300 transition-all cursor-pointer font-sans font-semibold"
                            >
                              <span>
                                {showSlowStockDetails 
                                  ? (language === "kh" ? "លាក់បញ្ជីលម្អិត" : "Hide Detailed List") 
                                  : (language === "kh" ? "បង្ហាញបញ្ជីលម្អិតនាឡិកាគាំងស្តុក" : "Show Inactive Watches Details")}
                              </span>
                              {showSlowStockDetails ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </button>
                          </div>

                          {/* Detailed List table */}
                          {showSlowStockDetails && (
                            <div className="bg-slate-950/40 border border-slate-850 rounded-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                              <div className="overflow-x-auto max-h-60 overflow-y-auto">
                                <table className="w-full text-left text-xs border-collapse">
                                  <thead>
                                    <tr className="bg-slate-950/80 border-b border-slate-850 text-slate-400 font-semibold uppercase tracking-wider text-[9px]">
                                      <th className="p-3">{language === "kh" ? "ម៉ាក & ម៉ូដែល" : "Brand & Model"}</th>
                                      <th className="p-3 text-center">{language === "kh" ? "ពណ៌" : "Color"}</th>
                                      <th className="p-3 text-center">{language === "kh" ? "ចំនួនក្នុងស្តុក" : "Stock"}</th>
                                      {userRole === "owner" && (
                                        <>
                                          <th className="p-3 text-right">{language === "kh" ? "តម្លៃដើម" : "Cost Price"}</th>
                                          <th className="p-3 text-right">{language === "kh" ? "ទុនគាំង" : "Capital Locked"}</th>
                                        </>
                                      )}
                                      <th className="p-3 text-right">{language === "kh" ? "តម្លៃលក់រាយ" : "Retail Price"}</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-900/60">
                                    {slowMovingWatches.map((w) => (
                                      <tr key={w.id} className="hover:bg-slate-900/30 transition-colors">
                                        <td className="p-3">
                                          <div className="font-bold text-slate-200">{w.brand} - {w.model}</div>
                                          <div className="text-[9px] text-slate-500 font-mono">SKU: {w.id}</div>
                                        </td>
                                        <td className="p-3 text-center text-slate-300 font-medium">{w.color || "—"}</td>
                                        <td className="p-3 text-center">
                                          <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-500 font-bold font-mono">
                                            {w.stock}
                                          </span>
                                        </td>
                                        {userRole === "owner" && (
                                          <>
                                            <td className="p-3 text-right text-slate-400 font-mono">${w.costPrice.toLocaleString()}</td>
                                            <td className="p-3 text-right text-rose-400 font-bold font-mono">${(w.costPrice * w.stock).toLocaleString()}</td>
                                          </>
                                        )}
                                        <td className="p-3 text-right text-amber-500 font-bold font-mono">${w.sellPrice.toLocaleString()}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* AI Restock & Supplier Reorder Center */}
                {userRole === "owner" && (
                  <div className={`${sCard} border rounded-2xl p-6 shadow-xl space-y-4 bg-gradient-to-br from-amber-500/[0.03] to-slate-900`}>
                    <div className="flex items-center justify-between border-b dark:border-slate-800 border-zinc-200 pb-3">
                      <div className="flex items-center gap-2">
                        <Sparkles size={18} className="text-amber-500 animate-pulse" />
                        <h3 className="text-sm font-bold text-slate-100 font-serif">
                          {language === "kh" ? "មជ្ឈមណ្ឌលបញ្ជាទិញស្តុកស្វ័យប្រវត្តិ" : "Chrono AI Automated Reorder Center"}
                        </h3>
                      </div>
                      <span className="text-[10px] bg-amber-500/10 text-amber-500 border border-amber-500/20 font-extrabold px-2 py-0.5 rounded font-mono">
                        {language === "kh" ? "ជំនួយការឆ្លាតវៃ" : "AI ASSISTANT"}
                      </span>
                    </div>

                    <p className={`text-xs ${sTextMuted} leading-relaxed`}>
                      {language === "kh"
                        ? "ប្រព័ន្ធតាមដានកម្រិតស្តុកនាឡិកានីមួយៗប្រៀបធៀបទៅនឹងកម្រិតកំណត់ផ្ទាល់ខ្លួនរបស់អ្នក។ ចុច 'រៀបចំអ៊ីមែលបញ្ជាទិញ' ដើម្បីផ្ញើលិខិតបញ្ជាទិញទៅអ្នកផ្គត់ផ្គង់ភ្លាមៗ។"
                        : "Monitors stock levels against your specific thresholds. Click 'Draft Email Order' to prepare a restock letter directly for the linked supplier."}
                    </p>

                    {(() => {
                      const lowWatches = shopData.watches.filter(
                        (w) => w.stock < (w.lowStockThreshold !== undefined ? w.lowStockThreshold : 5)
                      );

                      if (lowWatches.length === 0) {
                        return (
                          <div className="flex items-center gap-3 p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-xl text-xs text-emerald-400 font-sans">
                            <span className="text-base">✓</span>
                            <span>{language === "kh" ? "ស្តុកនាឡិកាទាំងអស់ស្ថិតក្នុងស្ថានភាពល្អប្រសើរ! មិនមានតម្រូវការបញ្ជាទិញបន្ថែមទេ។" : "All watch stocks are healthy! No reorders needed at this time."}</span>
                          </div>
                        );
                      }

                      return (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-1">
                          {lowWatches.map((w) => {
                            const threshold = w.lowStockThreshold !== undefined ? w.lowStockThreshold : 5;
                            const supplier = (shopData.suppliers || []).find((s) => s.id === w.supplierId);
                            return (
                              <div
                                key={w.id}
                                className="p-4 bg-slate-950/40 border dark:border-slate-850 border-zinc-200 rounded-xl flex flex-col justify-between space-y-3 shadow-inner hover:border-amber-500/20 transition-all"
                              >
                                <div className="space-y-1">
                                  <div className="flex justify-between items-start gap-1">
                                    <h4 className="text-xs font-bold text-slate-100 font-sans truncate pr-1">
                                      {w.brand} - {w.model}
                                    </h4>
                                    <span className="text-[10px] px-1.5 py-0.5 bg-rose-500/10 text-rose-400 rounded font-bold font-mono shrink-0">
                                      {w.stock} / {threshold} left
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono">
                                    <span>SKU: {w.id}</span>
                                    <span>•</span>
                                    <span>Color: {w.color}</span>
                                  </div>
                                  <div className="text-[10px] text-slate-500 font-sans truncate">
                                    {language === "kh" ? "អ្នកផ្គត់ផ្គង់៖" : "Supplier:"}{" "}
                                    <span className="text-slate-300 font-semibold">
                                      {supplier ? `${supplier.name} (${supplier.email || "No email"})` : "-- មិនទាន់ភ្ជាប់ --"}
                                    </span>
                                  </div>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => handleOpenReorderModal(w)}
                                  className="w-full bg-slate-800 hover:bg-slate-700 text-amber-500 font-bold py-1.5 px-3 rounded-lg text-[10px] flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-slate-700/50"
                                >
                                  <Mail size={12} />
                                  {language === "kh" ? "រៀបចំអ៊ីមែលបញ្ជាទិញ" : "Draft Email Order"}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* Goals Grid (Daily & Monthly Targets & AI Forecast) */}
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                    
                    {/* Daily Sales Goal Tracking Card */}
                    <div className={`${sCard} border rounded-2xl p-6 shadow-xl space-y-6 bg-gradient-to-r from-amber-500/5 to-transparent relative overflow-hidden flex flex-col justify-between`}>
                      <div className="absolute right-[-15px] top-[-10px] opacity-[0.03] dark:opacity-[0.05]">
                        <Target size={120} className="text-amber-500" />
                      </div>
                      
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 dark:border-slate-800 pb-4">
                        <div className="space-y-1 z-10 font-sans">
                          <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2 font-serif">
                            <Target size={18} className="text-amber-500" />
                            {language === "kh" ? "គោលដៅលក់ប្រចាំថ្ងៃ" : "Daily Sales Goal Tracking"}
                          </h3>
                          <p className={`text-xs ${sTextMuted}`}>
                            {language === "kh" 
                              ? "កំណត់និងតាមដានចំណូលលក់យោងតាមថ្ងៃនេះ បើធៀបនឹងគោលដៅចំណូលលក់របស់ហាង។" 
                              : "Set and track daily sales revenue compared against the store's objective."}
                          </p>
                        </div>

                        {/* Input to set Daily Sales Goal */}
                        <div className="flex items-center gap-2 z-10 font-sans">
                          <span className="text-xs font-semibold text-slate-300">
                            {language === "kh" ? "កំណត់គោលដៅ ($):" : "Set Goal ($):"}
                          </span>
                          <input
                            id="daily-sales-goal-input"
                            type="number"
                            min="1"
                            value={dailySalesGoal}
                            onChange={(e) => {
                              const val = Math.max(1, Number(e.target.value));
                              setDailySalesGoal(val);
                              localStorage.setItem("kunthy_daily_sales_goal", val.toString());
                            }}
                            className={`w-28 ${sInput} rounded-lg py-1.5 px-3 text-xs focus:outline-none transition-all font-mono font-bold text-right`}
                            placeholder="1000"
                          />
                        </div>
                      </div>

                      {/* Goal calculations and progress bar */}
                      <div className="space-y-4 font-sans">
                        {/* Hero Section: Today's Sales Revenue */}
                        <div className="bg-slate-950/40 rounded-xl p-4 border border-slate-850/60 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                          <div className="space-y-0.5">
                            <span className={`text-[11px] ${sTextMuted} uppercase tracking-wider font-semibold block`}>
                              {language === "kh" ? "ចំណូលលក់ថ្ងៃនេះ" : "Today's Sales"}
                            </span>
                            <div className="text-2xl font-bold font-mono text-emerald-400">
                              ${todayRevenueNum.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </div>
                          </div>
                          <div className="px-3 py-1 bg-slate-900/80 border border-slate-800 rounded-lg text-right font-sans shrink-0">
                            <span className={`text-[10px] ${sTextMuted} block`}>
                              {language === "kh" ? "កាលបរិច្ឆេទ" : "Date"}
                            </span>
                            <span className="text-xs font-mono font-medium text-slate-300">
                              {todayDateStr}
                            </span>
                          </div>
                        </div>

                        {/* Secondary Section: Goal & Completion Side-by-side */}
                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-slate-950/30 rounded-xl p-3.5 border border-slate-850/50 flex flex-col justify-between space-y-1">
                            <span className={`text-[11px] ${sTextMuted} uppercase tracking-wider font-semibold block`}>
                              {language === "kh" ? "គោលដៅចំណូលលក់" : "Revenue Target"}
                            </span>
                            <span className="text-lg font-bold font-mono text-slate-100">
                              ${dailySalesGoal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </span>
                          </div>

                          <div className="bg-slate-950/30 rounded-xl p-3.5 border border-slate-850/50 flex flex-col justify-between space-y-1">
                            <span className={`text-[11px] ${sTextMuted} uppercase tracking-wider font-semibold block`}>
                              {language === "kh" ? "កម្រិតសម្រេចបាន" : "Completion Rate"}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className={`text-lg font-mono font-bold ${goalProgressPercent >= 100 ? "text-emerald-400" : "text-amber-500"}`}>
                                {goalProgressPercent}%
                              </span>
                              {goalProgressPercent >= 100 && (
                                <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded-md font-bold animate-pulse font-sans">
                                  {language === "kh" ? "សម្រេច!" : "Reached!"}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Progress bar container */}
                      <div className="space-y-2">
                        <div className="flex flex-col gap-1 text-xs font-sans">
                          <div className="flex justify-between items-center">
                            <span className="font-sans text-slate-400">
                              {language === "kh" ? "ស្ថានភាពវឌ្ឍនភាព:" : "Progress Status:"}
                            </span>
                          </div>
                          <div className="font-sans text-slate-300 font-bold">
                            {todayRevenueNum >= dailySalesGoal ? (
                              <span className="text-emerald-400">
                                {language === "kh" 
                                  ? "🎉 ជោគជ័យ! អ្នកបានសម្រេចគោលដៅលក់ប្រចាំថ្ងៃហើយ!" 
                                  : "🎉 Perfect status! You have fully hit today's revenue target!"}
                              </span>
                            ) : (
                              <span className="text-amber-400">
                                {language === "kh" 
                                  ? `ខ្វះចំនួន $${(dailySalesGoal - todayRevenueNum).toLocaleString(undefined, { minimumFractionDigits: 2 })} ទៀតដើម្បីសម្រេច។ តស៊ូឡើង! 💪`
                                  : `Need $${(dailySalesGoal - todayRevenueNum).toLocaleString(undefined, { minimumFractionDigits: 2 })} more to reach the target. Keep going! 💪`}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Real Progress Bar */}
                        <div className="h-4 bg-slate-950 rounded-full overflow-hidden border border-slate-850 p-[2px]">
                          <div 
                            className={`h-full rounded-full transition-all duration-1000 ease-out ${
                              goalProgressPercent >= 100 
                                ? "bg-gradient-to-r from-emerald-500 to-teal-400 shadow-[0_0_10px_rgba(16,185,129,0.3)]" 
                                : "bg-gradient-to-r from-amber-500 to-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.2)]"
                            }`}
                            style={{ width: `${Math.min(100, goalProgressPercent)}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Monthly Sales Goal Tracking Card */}
                    <div className={`${sCard} border rounded-2xl p-6 shadow-xl space-y-6 bg-gradient-to-r from-emerald-500/5 to-transparent relative overflow-hidden flex flex-col justify-between`}>
                      <div className="absolute right-[-15px] top-[-10px] opacity-[0.03] dark:opacity-[0.05]">
                        <Calendar size={120} className="text-emerald-500" />
                      </div>
                      
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 dark:border-slate-800 pb-4">
                        <div className="space-y-1 z-10 font-sans">
                          <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2 font-serif">
                            <Calendar size={18} className="text-emerald-400" />
                            {language === "kh" ? "គោលដៅចំណូលប្រចាំខែ" : "Monthly Revenue Goal"}
                          </h3>
                          <p className={`text-xs ${sTextMuted}`}>
                            {language === "kh" 
                              ? "កំណត់និងតាមដានចំណូលលក់សរុបប្រចាំខែនេះ បើធៀបនឹងគោលដៅចំណូលលក់ប្រចាំខែរបស់ហាង។" 
                              : "Set and track monthly sales revenue compared against the monthly target."}
                          </p>
                        </div>

                        {/* Input to set Monthly Sales Goal */}
                        <div className="flex items-center gap-2 z-10 font-sans">
                          <span className="text-xs font-semibold text-slate-300">
                            {language === "kh" ? "កំណត់គោលដៅ ($):" : "Set Goal ($):"}
                          </span>
                          <input
                            id="monthly-sales-goal-input"
                            type="number"
                            min="1"
                            value={monthlySalesGoal}
                            onChange={(e) => {
                              const val = Math.max(1, Number(e.target.value));
                              setMonthlySalesGoal(val);
                              localStorage.setItem("kunthy_monthly_sales_goal", val.toString());
                            }}
                            className={`w-28 ${sInput} rounded-lg py-1.5 px-3 text-xs focus:outline-none transition-all font-mono font-bold text-right`}
                            placeholder="30000"
                          />
                        </div>
                      </div>

                      {/* Goal calculations and progress bar */}
                      <div className="space-y-4 font-sans">
                        {/* Hero Section: Month's Sales Revenue */}
                        <div className="bg-slate-950/40 rounded-xl p-4 border border-slate-850/60 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                          <div className="space-y-0.5">
                            <span className={`text-[11px] ${sTextMuted} uppercase tracking-wider font-semibold block`}>
                              {language === "kh" ? "ចំណូលលក់ខែនេះ" : "Month's Sales"}
                            </span>
                            <div className="text-2xl font-bold font-mono text-emerald-400">
                              ${monthRevenueNum.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </div>
                          </div>
                          <div className="px-3 py-1 bg-slate-900/80 border border-slate-800 rounded-lg text-right font-sans shrink-0">
                            <span className={`text-[10px] ${sTextMuted} block`}>
                              {language === "kh" ? "ខែ" : "Month"}
                            </span>
                            <span className="text-xs font-mono font-medium text-slate-300">
                              {currentMonthName}
                            </span>
                          </div>
                        </div>

                        {/* Secondary Section: Goal & Completion Side-by-side */}
                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-slate-950/30 rounded-xl p-3.5 border border-slate-850/50 flex flex-col justify-between space-y-1">
                            <span className={`text-[11px] ${sTextMuted} uppercase tracking-wider font-semibold block`}>
                              {language === "kh" ? "គោលដៅប្រចាំខែ" : "Monthly Target"}
                            </span>
                            <span className="text-lg font-bold font-mono text-slate-100">
                              ${monthlySalesGoal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </span>
                          </div>

                          <div className="bg-slate-950/30 rounded-xl p-3.5 border border-slate-850/50 flex flex-col justify-between space-y-1">
                            <span className={`text-[11px] ${sTextMuted} uppercase tracking-wider font-semibold block`}>
                              {language === "kh" ? "កម្រិតសម្រេចបាន" : "Completion Rate"}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className={`text-lg font-mono font-bold ${monthlyGoalProgressPercent >= 100 ? "text-emerald-400" : "text-amber-500"}`}>
                                {monthlyGoalProgressPercent}%
                              </span>
                              {monthlyGoalProgressPercent >= 100 && (
                                <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded-md font-bold animate-pulse font-sans">
                                  {language === "kh" ? "សម្រេច!" : "Reached!"}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Progress bar container */}
                      <div className="space-y-2">
                        <div className="flex flex-col gap-1 text-xs font-sans">
                          <div className="flex justify-between items-center">
                            <span className="font-sans text-slate-400">
                              {language === "kh" ? "ស្ថានភាពវឌ្ឍនភាព:" : "Progress Status:"}
                            </span>
                          </div>
                          <div className="font-sans text-slate-300 font-bold">
                            {monthRevenueNum >= monthlySalesGoal ? (
                              <span className="text-emerald-400">
                                {language === "kh" 
                                  ? "🎉 អបអរសាទរ! បានសម្រេចគោលដៅចំណូលប្រចាំខែហើយ!" 
                                  : "🎉 Amazing! You have fully hit this month's revenue target!"}
                              </span>
                            ) : (
                              <span className="text-amber-400">
                                {language === "kh" 
                                  ? `ខ្វះចំនួន $${(monthlySalesGoal - monthRevenueNum).toLocaleString(undefined, { minimumFractionDigits: 2 })} ទៀតដើម្បីសម្រេច។`
                                  : `Need $${(monthlySalesGoal - monthRevenueNum).toLocaleString(undefined, { minimumFractionDigits: 2 })} more.`}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Real Progress Bar */}
                        <div className="h-4 bg-slate-950 rounded-full overflow-hidden border border-slate-850 p-[2px]">
                          <div 
                            className={`h-full rounded-full transition-all duration-1000 ease-out ${
                              monthlyGoalProgressPercent >= 100 
                                ? "bg-gradient-to-r from-emerald-500 to-teal-400 shadow-[0_0_10px_rgba(16,185,129,0.3)]" 
                                : "bg-gradient-to-r from-amber-500 to-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.2)]"
                            }`}
                            style={{ width: `${Math.min(100, monthlyGoalProgressPercent)}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* 🔮 AI Sales Forecasting Widget (Simple Moving Average) */}
                    <div className={`${sCard} border rounded-2xl p-6 shadow-xl space-y-6 bg-gradient-to-r from-violet-500/5 to-transparent relative overflow-hidden flex flex-col justify-between`}>
                      <div className="absolute right-[-15px] top-[-10px] opacity-[0.03] dark:opacity-[0.05]">
                        <Sparkles size={120} className="text-violet-500" />
                      </div>

                      <div className="flex items-center justify-between border-b border-zinc-200 dark:border-slate-800 pb-4">
                        <div className="space-y-1 z-10 font-sans">
                          <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2 font-serif">
                            <Sparkles size={18} className="text-violet-400 animate-pulse" />
                            {language === "kh" ? "ការព្យាករណ៍ចំណូលឆ្លាតវៃ" : "AI Sales Revenue Forecast"}
                          </h3>
                          <p className={`text-xs ${sTextMuted}`}>
                            {language === "kh"
                              ? "ស្វែងយល់ពីចំណូលព្យាករណ៍ ៧ ថ្ងៃបន្ទាប់ ផ្អែកលើមធ្យមភាគការលក់លម្អិត ៣០ ថ្ងៃចុងក្រោយ។"
                              : "Projected next 7-day revenue based on 30-day Simple Moving Average (SMA)."}
                          </p>
                        </div>

                        {/* Trend direction indicator badge */}
                        <div className="z-10 shrink-0 font-sans">
                          {forecastData.trendDirection === "up" ? (
                            <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-1 rounded-full font-bold">
                              <TrendingUp size={12} />
                              {language === "kh" ? `កើនឡើង +${forecastData.trendPercentage}%` : `Up +${forecastData.trendPercentage}%`}
                            </span>
                          ) : forecastData.trendDirection === "down" ? (
                            <span className="inline-flex items-center gap-1 text-[10px] bg-rose-500/10 text-rose-400 px-2 py-1 rounded-full font-bold">
                              <TrendingDown size={12} />
                              {language === "kh" ? `ថយចុះ -${forecastData.trendPercentage}%` : `Down -${forecastData.trendPercentage}%`}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] bg-slate-500/10 text-slate-400 px-2 py-1 rounded-full font-bold">
                              <Activity size={12} />
                              {language === "kh" ? "ថេរ / ស្មើគ្នា" : "Stable / Flat"}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Forecast stats list */}
                      <div className="space-y-4 font-sans z-10">
                        {/* Hero Section: Projected Next 7 Days */}
                        <div className="bg-slate-950/40 rounded-xl p-4 border border-slate-850/60 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                          <div className="space-y-0.5">
                            <span className={`text-[11px] ${sTextMuted} uppercase tracking-wider font-semibold block`}>
                              {language === "kh" ? "ការព្យាករណ៍ ៧ ថ្ងៃបន្ទាប់" : "Projected Next 7d"}
                            </span>
                            <div className="text-2xl font-bold font-mono text-emerald-400">
                              ${forecastData.forecasted7DaysRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </div>
                          </div>
                          <div className="px-3 py-1 bg-slate-900/80 border border-slate-800 rounded-lg text-right font-sans shrink-0">
                            <span className={`text-[10px] ${sTextMuted} block`}>
                              {language === "kh" ? "សប្តាហ៍បន្ទាប់" : "Next Week"}
                            </span>
                            <span className="text-xs font-mono font-medium text-slate-300">
                              7 Days
                            </span>
                          </div>
                        </div>

                        {/* Secondary Section: SMA and 30-Day Sales side-by-side */}
                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-slate-950/30 rounded-xl p-3.5 border border-slate-850/50 flex flex-col justify-between space-y-1">
                            <span className={`text-[11px] ${sTextMuted} uppercase tracking-wider font-semibold block`}>
                              {language === "kh" ? "មធ្យមភាគប្រចាំថ្ងៃ" : "Daily SMA (30d)"}
                            </span>
                            <span className="text-lg font-bold font-mono text-violet-400">
                              ${forecastData.averageDailySales.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </span>
                          </div>

                          <div className="bg-slate-950/30 rounded-xl p-3.5 border border-slate-850/50 flex flex-col justify-between space-y-1">
                            <span className={`text-[11px] ${sTextMuted} uppercase tracking-wider font-semibold block`}>
                              {language === "kh" ? "ចំណូលលក់ ៣០ ថ្ងៃមុន" : "Total Sales (Past 30d)"}
                            </span>
                            <span className="text-lg font-bold font-mono text-slate-100">
                              ${forecastData.totalRevenueLast30Days.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Explanation description */}
                      <div className="space-y-2 z-10">
                        <div className="p-3.5 bg-violet-500/5 border border-violet-500/10 rounded-xl text-xs text-slate-300 font-sans flex items-start gap-2">
                          <span className="text-sm mt-0.5">💡</span>
                          <p className="text-[11px] leading-relaxed text-slate-400 font-sans">
                            {language === "kh"
                              ? `ដោយសារការលក់ជាមធ្យមប្រចាំថ្ងៃក្នុងរយៈពេល ៣០ ថ្ងៃចុងក្រោយគឺ $${forecastData.averageDailySales.toLocaleString(undefined, { maximumFractionDigits: 2 })} ប្រព័ន្ធស្វ័យប្រវត្តិនឹងព្យាករណ៍ថាចំណូលលក់ក្នុងសប្តាហ៍ក្រោយគឺប្រហែល $${forecastData.forecasted7DaysRevenue.toLocaleString(undefined, { maximumFractionDigits: 2 })}។`
                              : `With an average daily sales volume of $${forecastData.averageDailySales.toLocaleString(undefined, { maximumFractionDigits: 2 })} over the past 30 days, we forecast your next 7-day sales demand to generate around $${forecastData.forecasted7DaysRevenue.toLocaleString(undefined, { maximumFractionDigits: 2 })} in revenue.`}
                          </p>
                        </div>
                      </div>
                    </div>

                  </div>

                {/* Browser Push Notifications Card */}
                <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-amber-500/[0.03] rounded-2xl border border-slate-800 p-6 shadow-xl relative overflow-hidden">
                  <div className="absolute right-[-10px] top-[-10px] opacity-[0.03] dark:opacity-[0.05] pointer-events-none">
                    <BellRing size={130} className="text-amber-500" />
                  </div>

                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="space-y-2 max-w-xl">
                      <div className="flex items-center gap-2">
                        <span className="flex h-2.5 w-2.5 relative">
                          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isPushSubscribed ? 'bg-emerald-400' : 'bg-amber-400'} opacity-75`}></span>
                          <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isPushSubscribed ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                        </span>
                        <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2 font-serif">
                          {isPushSubscribed ? <BellRing size={18} className="text-emerald-400" /> : <Bell size={18} className="text-amber-500" />}
                          {language === "kh" ? "ប្រព័ន្ធជូនដំណឹងស្តុកទាបលើកម្មវិធីរុករក (Browser Push Stock Alerts)" : "Browser Low Stock Push Alerts"}
                        </h3>
                      </div>
                      <p className={`text-xs ${sTextMuted} font-sans leading-relaxed`}>
                        {language === "kh" 
                          ? "បើកការជូនដំណឹងពីស្តុកទាប (< ៥ គ្រឿង) លើឧបករណ៍របស់អ្នក ដើម្បីទទួលបានសារព្រមានភ្លាមៗ ទោះបីជាអ្នកមិនបានបើកមើល Dashboard នេះក៏ដោយ។ សារជូនដំណឹងដំណើរការទាំងលើទូរស័ព្ទ និងកុំព្យូទ័រ។" 
                          : "Enable real-time push alerts on this device to receive automatic warnings whenever watch inventory levels drop below 5 units, even when this dashboard is completely closed."}
                      </p>
                      
                      <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] font-sans">
                        <div className="flex items-center gap-1.5 text-slate-400">
                          <span>⚙️ {language === "kh" ? "សេវាកម្ម៖" : "Support:"}</span>
                          <strong className={pushSupported ? "text-emerald-400" : "text-amber-500"}>
                            {pushSupported 
                              ? (language === "kh" ? "គាំទ្រពេញលេញ" : "Fully Supported") 
                              : (language === "kh" ? "មិនគាំទ្រ (សូមជ្រើសរើស Chrome/Edge on Mobile/PC)" : "Not Supported (Please use Chrome/Edge/Safari)")}
                          </strong>
                        </div>
                        <div className="flex items-center gap-1.5 text-slate-400">
                          <span>🔔 {language === "kh" ? "ស្ថានភាព៖" : "Permission Status:"}</span>
                          <strong className={
                            notificationPermission === "granted" ? "text-emerald-400" : 
                            notificationPermission === "denied" ? "text-rose-400" : "text-amber-500"
                          }>
                            {notificationPermission === "granted" ? (language === "kh" ? "អនុញ្ញាតរួចរាល់" : "Granted") :
                             notificationPermission === "denied" ? (language === "kh" ? "បានបដិសេធ" : "Denied") :
                             (language === "kh" ? "មិនទាន់បានកំណត់" : "Not Configured")}
                          </strong>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row md:flex-col lg:flex-row items-stretch sm:items-center gap-3 shrink-0">
                      <button
                        onClick={handleSubscribePush}
                        disabled={subscribing || !pushSupported}
                        className={`px-4 py-2.5 text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer ${
                          isPushSubscribed 
                            ? "bg-slate-800 hover:bg-slate-750 text-slate-300 border border-slate-700" 
                            : "bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold"
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        {subscribing ? (
                          <>
                            <RefreshCw size={14} className="animate-spin" />
                            {language === "kh" ? "កំពុងដំឡើង..." : "Setting up..."}
                          </>
                        ) : isPushSubscribed ? (
                          <>
                            <span>✅</span>
                            {language === "kh" ? "បានបើកដំណើរការរួច" : "Alerts Enabled"}
                          </>
                        ) : (
                          <>
                            <Bell size={14} />
                            {language === "kh" ? "បើកការជូនដំណឹង" : "Enable Alerts"}
                          </>
                        )}
                      </button>

                      {isPushSubscribed && (
                        <button
                          onClick={handleTestNotifications}
                          className="px-4 py-2.5 text-xs font-bold rounded-xl border border-dashed border-amber-500/30 hover:border-amber-500/60 bg-amber-500/5 hover:bg-amber-500/10 text-amber-500 transition-all flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <Sparkles size={14} />
                          {language === "kh" ? "តេស្តផ្ញើសារសាកល្បង" : "Send Test Alert"}
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Visual grid overview */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  
                  {/* Left: Summary table */}
                  <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 space-y-4 shadow-xl">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-800 pb-3 gap-2">
                      <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2 font-serif">
                        <FileSpreadsheet size={16} className="text-amber-500" />
                        សេចក្តីសង្ខេបរបាយការណ៍ហិរញ្ញវត្ថុ
                      </h3>
                      <span className="text-xs bg-slate-800 border border-slate-700 text-slate-300 font-sans px-2.5 py-1 rounded-lg">
                        Owner: <strong>Kunthy</strong>
                      </span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-slate-800 text-slate-400">
                            <th className="py-2.5 font-medium">ប្រភេទរបាយការណ៍</th>
                            <th className="py-2.5 font-medium text-right">ចំនួន/ទឹកប្រាក់</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-850">
                          <tr>
                            <td className="py-3 text-slate-300 font-sans">ប្រាក់ដើមសរុប (Capital Funded)</td>
                            <td className="py-3 text-right font-mono text-slate-200">
                              ${currentCapitalNum.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                          <tr>
                            <td className="py-3 text-slate-300 font-sans">ចំនួននាឡិកាសរុបក្នុងស្តុក</td>
                            <td className="py-3 text-right font-mono text-blue-400">
                              {totalStockNum} គ្រឿង
                            </td>
                          </tr>
                          <tr>
                            <td className="py-3 text-slate-300 font-sans">ចំណូលពីការលក់-សរុប (Sales Income)</td>
                            <td className="py-3 text-right font-mono text-emerald-400">
                              +${filteredSalesNum.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                          <tr className="bg-slate-900/30">
                            <td className="py-2 pl-6 text-slate-400 font-sans text-[11px] flex items-center gap-1.5">
                              🏪 {language === "kh" ? "លក់នៅហាង (In-Store Sales)" : "In-store Sales"}
                            </td>
                            <td className="py-2 text-right font-mono text-emerald-500/80 text-[11px]">
                              +${filteredInstoreSalesNum.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                          <tr className="bg-slate-900/30 font-sans">
                            <td className="py-2 pl-6 text-slate-400 font-sans text-[11px] flex items-center gap-1.5">
                              🌐 {language === "kh" ? "លក់ Online (Online Sales)" : "Online Sales"}
                            </td>
                            <td className="py-2 text-right font-mono text-emerald-500/80 text-[11px]">
                              +${filteredOnlineSalesNum.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                          <tr>
                            <td className="py-3 text-slate-300 font-sans font-medium text-amber-500/90 flex items-center gap-1.5">
                              💰 {language === "kh" ? "ប្រាក់ចំណេញសរុបពីការលក់" : "Total Sales Profit"}
                            </td>
                            <td className="py-3 text-right font-mono text-amber-400 font-medium">
                              +${filteredSalesProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                          <tr className="bg-slate-900/30">
                            <td className="py-2 pl-6 text-slate-400 font-sans text-[11px] flex items-center gap-1.5">
                              🏪 {language === "kh" ? "ចំណេញលក់នៅហាង (In-Store Profit)" : "In-store Profit"}
                            </td>
                            <td className="py-2 text-right font-mono text-amber-500/70 text-[11px]">
                              +${filteredInstoreSalesProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                          <tr className="bg-slate-900/30">
                            <td className="py-2 pl-6 text-slate-400 font-sans text-[11px] flex items-center gap-1.5">
                              🌐 {language === "kh" ? "ចំណេញលក់ Online (Online Profit)" : "Online Profit"}
                            </td>
                            <td className="py-2 text-right font-mono text-amber-500/70 text-[11px]">
                              +${filteredOnlineSalesProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                          <tr>
                            <td className="py-3 text-slate-300 font-sans">ចំណូលផ្សេងៗបន្ថែម</td>
                            <td className="py-3 text-right font-mono text-emerald-400">
                              +${filteredOtherIncomeNum.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                          <tr>
                            <td className="py-3 text-slate-300 font-semibold text-amber-400">ចំណូលក្នុងបញ្ជីសរុប</td>
                            <td className="py-3 text-right font-mono font-semibold text-amber-400">
                              +${(filteredSalesNum + filteredOtherIncomeNum).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                          <tr>
                            <td className="py-3 text-slate-300 font-sans">ចំណាយអាជីវកម្មសរុប</td>
                            <td className="py-3 text-right font-mono text-rose-400">
                              -${filteredExpenseNum.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                          <tr className="border-t border-slate-800 bg-slate-950/40">
                            <td className="py-4.5 px-2 text-slate-200 font-semibold">ប្រាក់ចំណេញសុទ្ធអាជីវកម្ម</td>
                            <td className={`py-4.5 px-2 text-right font-mono font-bold text-sm ${filteredNetProfitNum >= 0 ? "text-amber-400" : "text-rose-400"}`}>
                              ${filteredNetProfitNum.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Right: Low Stock Alert and Reorder Planning panel */}
                  <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 space-y-4 shadow-xl flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                        <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2 font-serif">
                          <AlertTriangle size={16} className="text-amber-500 animate-pulse" />
                          {language === "kh" ? "របាយការណ៍ និងការបំពេញស្តុកទាប" : "Low Stock Alert & Reordering"}
                        </h3>
                        {lowStockWatches.length > 0 && (
                          <a
                            id="send-low-stock-email-btn"
                            href={lowStockMailtoUrl}
                            className="text-[10px] bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-2 py-1 rounded-lg flex items-center gap-1 cursor-pointer transition-all hover:scale-[1.02]"
                            title={language === "kh" ? "ផ្ញើអ៊ីមែលរបាយការណ៍ជូនម្ចាស់ហាង" : "Send warning report to Owner"}
                          >
                            <Mail size={11} className="shrink-0" />
                            {language === "kh" ? "ផ្ញើអ៊ីមែល" : "Email Owner"}
                          </a>
                        )}
                      </div>

                      {lowStockWatches.length === 0 ? (
                        <div className="text-center py-12 space-y-2">
                          <Check className="mx-auto text-emerald-500 stroke-[2]" size={36} />
                          <p className="text-sm text-slate-300 font-medium">
                            {language === "kh" ? "ស្តុកទាំងអស់កំពុងមានសុវត្ថិភាព!" : "All stocks are perfectly safe!"}
                          </p>
                          <p className="text-xs text-slate-500 font-sans">
                            {language === "kh" ? "មិនមាននាឡិកាក្រោម ៥ គ្រឿងក្នុងស្តុកទេ។" : "No watches are under 5 units currently."}
                          </p>
                        </div>
                      ) : (
                        <div className="mt-4 space-y-4 max-h-[290px] overflow-y-auto pr-1">
                          {lowStockBrandAnalysis.map((group) => (
                            <div key={group.brand} className="space-y-1.5 border-l-2 border-slate-700 pl-3.5 pt-0.5">
                              <span className="text-[10px] font-bold text-amber-500 uppercase tracking-widest font-sans flex items-center gap-1.5">
                                🏢 {group.brand}
                              </span>
                              <div className="space-y-2">
                                {group.items.map((item) => (
                                  <div 
                                    key={item.id} 
                                    className="p-2.5 bg-slate-950/45 rounded-xl border border-red-500/10 flex flex-col justify-between text-xs font-sans gap-2"
                                  >
                                    <div className="flex items-start justify-between gap-1">
                                      <div className="min-w-0">
                                        <p className="font-semibold text-slate-200 truncate">{item.model}</p>
                                        <p className="text-[9px] text-slate-500 truncate">ID: {item.id} | {item.color}</p>
                                      </div>
                                      <div className="text-right shrink-0">
                                        <div className="px-2 py-0.5 rounded bg-red-500/10 border border-red-500/20 text-red-400 font-mono text-[10px] font-bold">
                                          {item.stock} {language === "kh" ? "គ្រឿង" : "left"}
                                        </div>
                                      </div>
                                    </div>
                                    
                                    <div className="flex items-center justify-between border-t border-slate-900 pt-1.5 text-[10px]">
                                      <div className="text-slate-400">
                                        📈 {language === "kh" ? "ល្បឿនលក់៖" : "Velocity:"}{" "}
                                        <span className="font-mono text-emerald-400 font-semibold" title={`${item.unitsSold30} units sold in past 30 days`}>
                                          {item.weeklyVelocity} {language === "kh" ? "គ្រឿង/សប្តាហ៍" : "u/wk"}
                                        </span>
                                      </div>
                                      <div className="text-slate-300 font-medium">
                                        📦 {language === "kh" ? "សំណើទិញបន្ថែម៖" : "Suggest reorder:"}{" "}
                                        <span className="text-amber-400 font-bold font-mono pl-0.5">
                                          +{item.suggestedReorder}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="p-3 bg-amber-500/5 border border-amber-500/20 rounded-xl text-[11px] text-slate-400 font-sans mt-2 flex items-center justify-between gap-1.5">
                      <span>
                        💡 {language === "kh" 
                          ? "ល្បឿនលក់ត្រូវបានគណនាពីការលក់ ៣០ ថ្ងៃចុងក្រោយ ដើម្បីស្នើចំនួនបញ្ជាទិញបន្ថែមសមស្រប។" 
                          : "Velocity is estimated based on 30-day sales demand to optimize smart reorder recommendations."}
                      </span>
                    </div>
                  </div>

              </div>

              {/* Charts Section */}
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                
                {/* Sales Trend Line Chart Section */}
                <div className={`${sCard} border rounded-2xl p-6 shadow-xl space-y-4`}>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b pb-3 border-zinc-250 dark:border-slate-800 gap-2">
                    <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2 font-serif">
                      <TrendingUp size={16} className="text-amber-500 font-bold" />
                      {language === "kh" ? "ក្រាហ្វិករបាយការណ៍និន្នាការនៃការលក់" : "Sales Revenue Trend Chart"}
                    </h3>
                    <span className={`text-[10px] ${sTextMuted} font-sans`}>
                      {language === "kh" ? "សរុបចំណូលលក់គិតតាមថ្ងៃនីមួយៗ" : "Daily Accumulated Sales Revenue ($)"}
                    </span>
                  </div>

                  {salesTrendData.length === 0 ? (
                    <div className={`py-12 text-center ${sTextMuted} text-xs font-sans`}>
                      {language === "kh" ? "មិនទាន់មានទិន្នន័យលក់ ដើម្បីបង្ហាញក្រាហ្វិកនៅឡើយទេ។" : "No sales transactions recorded yet to display the chart."}
                    </div>
                  ) : (
                    <div className="h-[280px] w-full font-sans pt-2">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart
                          data={salesTrendData}
                          margin={{ top: 10, right: 25, left: -10, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke={theme === "dark" ? "#1e293b" : "#e4e4e7"} vertical={false} />
                          <XAxis 
                            dataKey="date" 
                            stroke={theme === "dark" ? "#94a3b8" : "#71717a"} 
                            fontSize={10}
                            tickLine={false}
                            axisLine={false}
                            dy={10}
                          />
                          <YAxis 
                            stroke={theme === "dark" ? "#94a3b8" : "#71717a"} 
                            fontSize={10}
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(v) => `$${v.toLocaleString()}`}
                            dx={-5}
                          />
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: theme === "dark" ? "#0f172a" : "#ffffff", 
                              borderColor: theme === "dark" ? "#334155" : "#e4e4e7",
                              borderRadius: "12px", 
                              color: theme === "dark" ? "#f1f5f9" : "#0f172a",
                              fontSize: "11px",
                              boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)"
                            }}
                            labelFormatter={(label, items) => {
                              const originalItem = items?.[0]?.payload;
                              return originalItem ? `${language === "kh" ? "កាលបរិច្ឆេទ: " : "Date: "}${originalItem.fullDate}` : label;
                            }}
                          />
                          <Line 
                            type="monotone" 
                            dataKey="Revenue" 
                            name={language === "kh" ? "ចំណូលលក់" : "Sales Revenue"}
                            stroke="#f59e0b" 
                            strokeWidth={3} 
                            dot={{ stroke: theme === "dark" ? "#0f172a" : "#ffffff", strokeWidth: 1.5, r: 4.5, fill: "#f59e0b" }} 
                            activeDot={{ r: 7, stroke: theme === "dark" ? "#0f172a" : "#ffffff", strokeWidth: 2, fill: "#d97706" }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>

                {/* 7-Day Performance vs Goal Chart Section */}
                <div className={`${sCard} border rounded-2xl p-6 shadow-xl space-y-4`}>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b pb-3 border-zinc-250 dark:border-slate-800 gap-2">
                    <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2 font-serif">
                      <Target size={16} className="text-emerald-500 font-bold" />
                      {language === "kh" ? "សកម្មភាពលក់ធៀបនឹងគោលដៅ (៧ ថ្ងៃចុងក្រោយ)" : "7-Day Sales vs Daily Goal"}
                    </h3>
                    <span className={`text-[10px] ${sTextMuted} font-sans`}>
                      {language === "kh" ? "ចំណូលសរុបប្រឆាំងនឹងគោលដៅកំណត់" : "Daily Revenue contrasted with your Objective"}
                    </span>
                  </div>

                  <div className="h-[280px] w-full font-sans pt-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={past7DaysGoalData}
                        margin={{ top: 10, right: 10, left: -10, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke={theme === "dark" ? "#1e293b" : "#e4e4e7"} vertical={false} />
                        <XAxis 
                          dataKey="date" 
                          stroke={theme === "dark" ? "#94a3b8" : "#71717a"} 
                          fontSize={10}
                          tickLine={false}
                          axisLine={false}
                          dy={10}
                        />
                        <YAxis 
                          stroke={theme === "dark" ? "#94a3b8" : "#71717a"} 
                          fontSize={10}
                          tickLine={false}
                          axisLine={false}
                          tickFormatter={(v) => `$${v.toLocaleString()}`}
                          dx={-5}
                        />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: theme === "dark" ? "#0f172a" : "#ffffff", 
                            borderColor: theme === "dark" ? "#334155" : "#e4e4e7",
                            borderRadius: "12px", 
                            color: theme === "dark" ? "#f1f5f9" : "#0f172a",
                            fontSize: "11px",
                            boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)"
                          }}
                          labelFormatter={(label, items) => {
                            const originalItem = items?.[0]?.payload;
                            return originalItem ? `${language === "kh" ? "កាលបរិច្ឆេទ: " : "Date: "}${originalItem.fullDate}` : label;
                          }}
                        />
                        <Legend iconSize={10} wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
                        <Bar 
                          dataKey="Revenue" 
                          name={language === "kh" ? "ចំណូលលក់ជាក់ស្តែង" : "Actual Revenue"} 
                          fill="#10b981" 
                          radius={[4, 4, 0, 0]} 
                        />
                        <Bar 
                          dataKey="Goal" 
                          name={language === "kh" ? "គោលដៅកំណត់" : "Target Goal"} 
                          fill={theme === "dark" ? "#3b82f6" : "#2563eb"} 
                          radius={[4, 4, 0, 0]} 
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Expenses by Category Section */}
                <div className={`${sCard} border rounded-2xl p-6 shadow-xl space-y-4`}>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b pb-3 border-zinc-250 dark:border-slate-800 gap-2">
                    <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2 font-serif">
                      <PieIcon size={16} className="text-rose-450 font-bold" />
                      {language === "kh" ? "ប្រភេទចំណាយអាជីវកម្ម" : "Expenses by Category"}
                    </h3>
                    <span className={`text-[10px] ${sTextMuted} font-sans`}>
                      {language === "kh" ? "ការបែងចែកចំណាយសរុប" : "Distribution of Store Expenses"}
                    </span>
                  </div>

                  {totalExpenseNum === 0 ? (
                    <div className={`py-12 text-center ${sTextMuted} text-xs font-sans flex flex-col items-center justify-center h-[280px]`}>
                      <span className="text-emerald-500 text-3xl mb-2">🎉</span>
                      {language === "kh" ? "មិនទាន់មានទិន្នន័យចំណាយ ដើម្បីបង្ហាញក្រាហ្វិកនៅឡើយទេ។" : "No business expenses recorded yet to display."}
                    </div>
                  ) : (
                    <div className="flex flex-col justify-between h-[280px] font-sans pb-2">
                      <div className="h-[160px] w-full pt-1 relative">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Tooltip
                              contentStyle={{
                                backgroundColor: theme === "dark" ? "#0f172a" : "#ffffff",
                                borderColor: theme === "dark" ? "#334155" : "#e4e4e7",
                                borderRadius: "12px",
                                color: theme === "dark" ? "#f1f5f9" : "#0f172a",
                                fontSize: "11px",
                                boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)"
                              }}
                              formatter={(value: any) => [`$${Number(value).toLocaleString()}`, language === "kh" ? "ចំនួនចំណាយ" : "Amount Spent"]}
                            />
                            <Pie
                              data={expensePieData}
                              cx="50%"
                              cy="50%"
                              innerRadius={36}
                              outerRadius={65}
                              paddingAngle={3}
                              dataKey="value"
                            >
                              {expensePieData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
                          <span className={`text-[10px] ${sTextMuted} uppercase`}>
                            {language === "kh" ? "ចំណាយ" : "Expenses"}
                          </span>
                          <span className="block text-xs font-bold font-mono">
                            ${totalExpenseNum.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </span>
                        </div>
                      </div>

                      {/* Customized custom category list under the chart */}
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px] pt-1">
                        {expensePieData.map((entry, index) => {
                          const percentage = totalExpenseNum > 0 ? Math.round((entry.value / totalExpenseNum) * 100) : 0;
                          return (
                            <div key={index} className="flex items-center justify-between font-sans border-b border-dashed border-zinc-200 dark:border-slate-800/60 pb-1">
                              <div className="flex items-center gap-1.5 min-w-0 pr-1">
                                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
                                <span className="truncate text-slate-300 font-medium" title={entry.name}>
                                  {entry.name}
                                </span>
                              </div>
                              <div className="text-right shrink-0 font-mono font-semibold">
                                <span className={theme === "dark" ? "text-slate-100" : "text-zinc-800"}>
                                  ${entry.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                </span>
                                <span className="text-[10px] text-slate-500 pl-1">
                                  ({percentage}%)
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                    </div>
                  )}
                </div>

              </div>

              {/* Bottom Sales Records preview (Only show to Owner) */}
              <div className={`${sCard} border rounded-2xl p-6 shadow-xl space-y-4`}>
                <div className="flex items-center justify-between border-b border-zinc-250 dark:border-slate-800 pb-3">
                  <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2 font-serif">
                    <TrendingUp size={16} className="text-amber-500" />
                    {language === "kh" ? "ប្រតិបត្តិការលក់នាឡិកាដៃថ្មីៗ" : "Recent Sales Performance"}
                  </h3>
                  <span className={`text-[10px] ${sTextMuted} font-sans`}>{language === "kh" ? "បង្ហាញ ១០ បញ្ជីចុងក្រោយ" : "Showing last 10 entries"}</span>
                </div>

                {shopData.sales.length === 0 ? (
                  <div className={`py-12 text-center ${sTextMuted} text-xs font-sans`}>
                    {language === "kh" ? "មិនទាន់មានការលក់នាឡិកាត្រូវបានកត់ត្រានៅឡើយទេ។" : "No watch sales recorded yet."}
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-slate-800">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead className={sTableHead}>
                        <tr className="border-b border-zinc-200 dark:border-slate-800">
                          <th className="p-3 font-medium">{language === "kh" ? "វិក្កយបត្រ" : "Invoice"}</th>
                          <th className="p-3 font-medium">{language === "kh" ? "កាលបរិច្ឆេទ" : "Date"}</th>
                          <th className="p-3 font-medium">{language === "kh" ? "នាឡិកា" : "Watch Spec"}</th>
                          <th className="p-3 font-medium text-center">{language === "kh" ? "ចំនួន" : "Qty"}</th>
                          <th className="p-3 font-medium text-right">{language === "kh" ? "តម្លៃលក់" : "Sell Price"}</th>
                          <th className="p-3 font-medium text-right">{language === "kh" ? "សរុប" : "Total Paid"}</th>
                          <th className="p-3 font-medium text-center">{language === "kh" ? "បើកវិក្កយបត្រ" : "View"}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-250 dark:divide-slate-800">
                        {shopData.sales.slice().reverse().slice(0, 10).map((sale) => (
                          <tr key={sale.id} className="hover:bg-slate-500/5">
                            <td className="p-3 font-mono font-semibold text-slate-400">{sale.id}</td>
                            <td className="p-3 text-slate-500 font-mono text-[10px]">{sale.date}</td>
                            <td className="p-3 font-semibold text-slate-200">
                              {sale.watchBrand} {sale.watchModel} {sale.watchColor && `(${sale.watchColor})`}
                            </td>
                            <td className="p-3 text-center text-slate-500 font-medium">{sale.quantity}</td>
                            <td className="p-3 text-right font-mono text-slate-400">${sale.sellPrice.toLocaleString()}</td>
                            <td className="p-3 text-right font-mono text-emerald-500 font-bold">${sale.totalAmount.toLocaleString()}</td>
                            <td className="p-3 text-center">
                              <button
                                onClick={() => setSelectedInvoice(sale)}
                                className="px-2 py-1 bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-slate-350 text-[10px] rounded transition-all font-sans cursor-pointer inline-flex items-center gap-1 border border-slate-700/40"
                              >
                                <FileText size={10} />
                                <span>{language === "kh" ? "វិក្កយបត្រ" : "Invoice"}</span>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 2. WATCHES (STOCK MANAGEMENT) VIEW */}
          {activeTab === "watches" && (
            <div className="space-y-6">
              
              {/* Sub Tab Navigation */}
              <div className="flex bg-slate-900/80 p-1 border border-slate-800 rounded-xl w-fit font-sans">
                <button
                  type="button"
                  onClick={() => {
                    setActiveWatchSubTab("list");
                    setSelectedStockTakeId(null);
                  }}
                  className={`px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-2 ${
                    activeWatchSubTab === "list"
                      ? "bg-amber-500 text-slate-950 shadow"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <WatchIcon size={14} />
                  <span>{language === "kh" ? "បញ្ជីនាឡិកា និងស្តុក" : "Watch Inventory List"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveWatchSubTab("stocktake")}
                  className={`px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-2 ${
                    activeWatchSubTab === "stocktake"
                      ? "bg-amber-500 text-slate-950 shadow"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <ClipboardList size={14} />
                  <span>{language === "kh" ? "ផ្ទៀងផ្ទាត់ និងរាប់ស្តុកប្រចាំខែ" : "Monthly Stock Count Audit"}</span>
                </button>
              </div>

              {activeWatchSubTab === "list" ? (
                <>
                  {/* Detailed Inventory Capital & Valuation Channel (កូន Channel លម្អិតលុយស្តុក) */}
                  {(() => {
                const isOwner = userRole === "owner";
                const totalEstCostValue = shopData.watches.reduce((acc, w) => acc + ((w.stock || 0) * (w.costPrice || 0)), 0);
                const totalEstRetailValue = shopData.watches.reduce((acc, w) => acc + ((w.stock || 0) * (w.sellPrice || 0)), 0);
                const displayValue = isOwner ? totalEstCostValue : totalEstRetailValue;
                
                // Let's compute percentages for the progress bar / indicators
                const oldPercent = totalStockValue > 0 ? (totalOldStockValue / totalStockValue) * 100 : 0;
                const newPercent = totalStockValue > 0 ? (totalNewStockValue / totalStockValue) * 100 : 0;

                const lowStockCount = shopData.watches.filter((w) => w.stock < (w.lowStockThreshold !== undefined ? w.lowStockThreshold : 5)).length;

                return (
                  <div className={`${sCard} border rounded-2xl p-5 shadow-lg relative overflow-hidden transition-all duration-200 hover:shadow-xl bg-gradient-to-br from-indigo-500/[0.02] via-transparent to-emerald-500/[0.01]`}>
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b dark:border-slate-800/80 border-zinc-200/85 pb-4 mb-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500 border border-amber-500/20 backdrop-blur-sm">
                          <Coins size={16} />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-slate-100 font-serif tracking-wide">
                            {language === "kh" ? "ឆានែលលម្អិត៖ ដើមទុន-លុយស្តុកចាស់ និងស្តុកថ្មី" : "Detailed Channel: Old & New Stock Valuation"}
                          </h4>
                          <p className="text-[10px] text-slate-400 font-sans">
                            {language === "kh" ? "ការវិភាគលម្អិតអំពីតម្លៃដើមទុនសរុបក្នុងឃ្លាំងនាឡិកា" : "Granular capital split of currently held stock"}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2.5">
                        <span className="text-[10px] px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 font-mono font-bold uppercase tracking-wider">
                          {isOwner ? (language === "kh" ? "កម្រិត៖ ម្ចាស់ហាង" : "Role: Owner") : (language === "kh" ? "កម្រិត៖ បុគ្គលិក" : "Role: Staff")}
                        </span>
                        {lowStockCount > 0 && (
                          <span className="text-[10px] px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 font-sans font-medium flex items-center gap-1">
                            <AlertTriangle size={11} className="stroke-[2.5]" />
                            {lowStockCount} {language === "kh" ? "ជិតអស់ស្តុក" : "Low Stock"}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Columns Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                      
                      {/* Column 1: Old Stock Section */}
                      <div className="p-4 bg-slate-950/45 dark:bg-slate-950/65 rounded-xl border border-slate-800/60 flex flex-col justify-between space-y-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 text-slate-400 text-xs">
                            <span className="inline-block w-2 w-2 h-2 rounded bg-amber-500"></span>
                            <span className="font-sans font-semibold uppercase text-[10px] tracking-wider text-amber-500">
                              {language === "kh" ? "ស្តុកចាស់" : "Old Stock"}
                            </span>
                          </div>
                          {isOwner ? (
                            <p className="text-lg md:text-xl font-black font-mono text-slate-100">
                              ${totalOldStockValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </p>
                          ) : (
                            <p className="text-lg md:text-xl font-bold font-sans text-slate-400">
                              🔒 {language === "kh" ? "លាក់តម្លៃដើម" : "Cost Hidden"}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center justify-between text-[11px] font-sans border-t dark:border-slate-900 border-zinc-200/50 pt-2 text-slate-400">
                          <span>{language === "kh" ? "ចំនួនសរុប៖" : "Total Units:"}</span>
                          <span className="font-bold text-amber-500 font-mono text-xs">{totalOldStockUnits} {language === "kh" ? "គ្រឿង" : "pcs"}</span>
                        </div>
                        {isOwner && totalStockValue > 0 && (
                          <div className="space-y-1 mt-1">
                            <div className="w-full bg-slate-900 rounded-full h-1 relative overflow-hidden">
                              <div className="bg-amber-500 h-1 rounded-full" style={{ width: `${oldPercent}%` }}></div>
                            </div>
                            <div className="flex justify-between text-[9px] font-mono text-slate-500">
                              <span>{language === "kh" ? "ចំណែកដើមទុន" : "Capital Share"}</span>
                              <span>{oldPercent.toFixed(1)}%</span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Column 2: New Stock Section */}
                      <div className="p-4 bg-slate-950/45 dark:bg-slate-950/65 rounded-xl border border-slate-800/60 flex flex-col justify-between space-y-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 text-slate-400 text-xs">
                            <span className="inline-block w-2 w-2 h-2 rounded bg-emerald-500"></span>
                            <span className="font-sans font-semibold uppercase text-[10px] tracking-wider text-emerald-450">
                              {language === "kh" ? "ស្តុកថ្មី" : "New Stock"}
                            </span>
                          </div>
                          {isOwner ? (
                            <p className="text-lg md:text-xl font-black font-mono text-emerald-450 dark:text-emerald-400">
                              ${totalNewStockValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </p>
                          ) : (
                            <p className="text-lg md:text-xl font-bold font-sans text-slate-400">
                              🔒 {language === "kh" ? "លាក់តម្លៃដើម" : "Cost Hidden"}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center justify-between text-[11px] font-sans border-t dark:border-slate-900 border-zinc-200/50 pt-2 text-slate-400">
                          <span>{language === "kh" ? "ចំនួនសរុប៖" : "Total Units:"}</span>
                          <span className="font-bold text-emerald-450 font-mono text-xs">{totalNewStockUnits} {language === "kh" ? "គ្រឿង" : "pcs"}</span>
                        </div>
                        {isOwner && totalStockValue > 0 && (
                          <div className="space-y-1 mt-1">
                            <div className="w-full bg-slate-900 rounded-full h-1 relative overflow-hidden">
                              <div className="bg-emerald-500 h-1 rounded-full" style={{ width: `${newPercent}%` }}></div>
                            </div>
                            <div className="flex justify-between text-[9px] font-mono text-slate-500">
                              <span>{language === "kh" ? "ចំណែកដើមទុន" : "Capital Share"}</span>
                              <span>{newPercent.toFixed(1)}%</span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Column 3: Combined Valuation & Unique SKUs Summary */}
                      <div className="p-4 bg-gradient-to-br from-amber-500/[0.02] to-amber-500/[0.04] dark:from-amber-500/[0.01] dark:to-transparent rounded-xl border border-amber-500/15 flex flex-col justify-between space-y-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 text-slate-400 text-xs">
                            <span className="inline-block w-2 w-2 h-2 rounded bg-blue-500"></span>
                            <span className="font-sans font-semibold uppercase text-[10px] tracking-wider text-amber-500">
                              {isOwner 
                                ? (language === "kh" ? "តម្លៃដើមទុនរួមគ្នា" : "Combined Total Capital") 
                                : (language === "kh" ? "តម្លៃលក់រាយសរុប" : "Total Est Retail Value")}
                            </span>
                          </div>
                          <p className="text-lg md:text-xl font-extrabold font-mono text-amber-500">
                            ${displayValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </p>
                        </div>
                        
                        <div className="space-y-2 pt-1">
                          <div className="flex justify-between text-[11px] font-sans border-t dark:border-slate-900/60 border-zinc-200/50 pt-2 text-slate-400">
                            <span>{language === "kh" ? "ចំនួនស្តុករួម៖" : "Total Inventory:"}</span>
                            <span className="font-bold text-slate-200 font-mono text-xs">{totalStockUnits} {language === "kh" ? "គ្រឿង" : "pcs"}</span>
                          </div>
                          <div className="flex justify-between text-[11px] font-sans text-slate-400">
                            <span>{language === "kh" ? "ចំនួនម៉ូដែល៖" : "Total SKUs:"}</span>
                            <span className="font-semibold text-slate-300 font-mono text-xs">{shopData.watches.length} {language === "kh" ? "ប្រភេទ" : "SKUs"}</span>
                          </div>
                        </div>
                      </div>

                    </div>
                  </div>
                );
              })()}
              
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Watch Form Input (Left panel, 1 col) - Only for Owner Kunthy */}
                {userRole === "owner" ? (
                  <div className="lg:col-span-1 space-y-6 flex flex-col h-fit">
                    <div className={`${sCard} border rounded-2xl p-6 shadow-xl`}>
                      <h3 className="text-sm font-bold text-amber-500 mb-5 pb-3 border-b dark:border-slate-800 border-zinc-200 flex items-center gap-2 font-serif">
                        <Plus size={16} />
                        {editingWatchId ? "កែប្រែព័ត៌មាននាឡិកា" : "បន្ថែមនាឡិកាថ្មីក្នុងស្តុក"}
                      </h3>



                    <form onSubmit={handleAddOrUpdateWatch} className="space-y-4 font-sans">
                      <ScanWatchCode
                        watchId={watchId}
                        setWatchId={setWatchId}
                        watches={shopData.watches}
                        editingWatchId={editingWatchId}
                        language={language}
                        onScanClick={() => setIsQRModalOpenForWatchForm(true)}
                        lastScanTime={watchFormScanTime}
                      />

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className={`block ${sTextMuted} text-xs font-semibold tracking-wider mb-1.5 uppercase`}>
                            ម៉ាក (Brand) *
                          </label>
                          <input
                            id="watch-brand"
                            type="text"
                            required
                            value={watchBrand}
                            onChange={(e) => setWatchBrand(e.target.value)}
                            placeholder="ឧ. Rolex"
                            className={`w-full ${sInput} focus:border-amber-500 rounded-lg py-2.5 px-3.5 text-xs focus:outline-none transition-all`}
                          />
                        </div>
                        <div>
                          <label className={`block ${sTextMuted} text-xs font-semibold tracking-wider mb-1.5 uppercase`}>
                            ម៉ូដែល (Model) *
                          </label>
                          <input
                            id="watch-model"
                            type="text"
                            required
                            value={watchModel}
                            onChange={(e) => setWatchModel(e.target.value)}
                            placeholder="ឧ. Submariner"
                            className={`w-full ${sInput} focus:border-amber-500 rounded-lg py-2.5 px-3.5 text-xs focus:outline-none transition-all`}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className={`block ${sTextMuted} text-xs font-semibold tracking-wider mb-1.5 uppercase`}>
                            ប្រភេទនាឡិកា (Category) *
                          </label>
                          <select
                            id="watch-category"
                            required
                            value={watchCategory}
                            onChange={(e) => setWatchCategory(e.target.value)}
                            className={`w-full ${sInput} focus:border-amber-500 rounded-lg py-2.5 px-3.5 text-xs focus:outline-none transition-all cursor-pointer`}
                          >
                            <option value="Watch Quartz">Watch Quartz</option>
                            <option value="Automatic Watch">Automatic Watch</option>
                            <option value="Digital Watch">Digital Watch</option>
                            <option value="Watch Sport">Watch Sport</option>
                            <option value="Smart Watch">Smart Watch</option>
                          </select>
                        </div>
                        <div>
                          <label className={`block ${sTextMuted} text-xs font-semibold tracking-wider mb-1.5 uppercase`}>
                            {language === "kh" ? "ពណ៌នាឡិកា" : "Watch Color"}
                          </label>
                          <input
                            id="watch-color"
                            type="text"
                            value={watchColor}
                            onChange={(e) => setWatchColor(e.target.value)}
                            placeholder="ឧ. Gold / Blue, Black"
                            className={`w-full ${sInput} focus:border-amber-500 rounded-lg py-2.5 px-3.5 text-xs focus:outline-none transition-all`}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className={`block ${sTextMuted} text-xs font-semibold tracking-wider mb-1.5 uppercase`}>
                            តម្លៃដើម $ *
                          </label>
                          <input
                            id="watch-cost"
                            type="number"
                            required
                            value={watchCostPrice}
                            onChange={(e) => setWatchCostPrice(e.target.value !== "" ? Number(e.target.value) : "")}
                            placeholder="ឧ. 8000"
                            className={`w-full ${sInput} focus:border-amber-500 rounded-lg py-2.5 px-3.5 text-xs focus:outline-none transition-all font-mono`}
                          />
                        </div>
                        <div>
                          <label className={`block ${sTextMuted} text-xs font-semibold tracking-wider mb-1.5 uppercase`}>
                            តម្លៃលក់ $ *
                          </label>
                          <input
                            id="watch-sell"
                            type="number"
                            required
                            value={watchSellPrice}
                            onChange={(e) => setWatchSellPrice(e.target.value !== "" ? Number(e.target.value) : "")}
                            placeholder="ឧ. 11000"
                            className={`w-full ${sInput} focus:border-amber-500 rounded-lg py-2.5 px-3.5 text-xs focus:outline-none transition-all font-mono`}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className={`block ${sTextMuted} text-xs font-semibold tracking-wider mb-1.5 uppercase`}>
                            {language === "kh" ? "ស្តុកចាស់ (Old Stock) *" : "Old Stock *"}
                          </label>
                          <input
                            id="watch-old-stock"
                            type="number"
                            value={watchOldStock}
                            onChange={(e) => setWatchOldStock(e.target.value !== "" ? Number(e.target.value) : "")}
                            placeholder="ឧ. 10"
                            className={`w-full ${sInput} focus:border-amber-500 rounded-lg py-2.5 px-3.5 text-xs focus:outline-none transition-all font-mono`}
                          />
                        </div>
                        <div>
                          <label className={`block ${sTextMuted} text-xs font-semibold tracking-wider mb-1.5 uppercase`}>
                            {language === "kh" ? "ស្តុកថ្មី (New Stock) *" : "New Stock *"}
                          </label>
                          <input
                            id="watch-new-stock"
                            type="number"
                            value={watchNewStock}
                            onChange={(e) => setWatchNewStock(e.target.value !== "" ? Number(e.target.value) : "")}
                            placeholder="ឧ. 5"
                            className={`w-full ${sInput} focus:border-amber-500 rounded-lg py-2.5 px-3.5 text-xs focus:outline-none transition-all font-mono`}
                          />
                        </div>
                      </div>

                      <div>
                        <label className={`block ${sTextMuted} text-xs font-semibold tracking-wider mb-1.5 uppercase`}>
                          {language === "kh" ? "ស្តុកសរុបបូកចូលគ្នា (Total Stock)" : "Combined Total Stock"}
                        </label>
                        <input
                          id="watch-stock"
                          type="number"
                          disabled
                          readOnly
                          value={watchStock}
                          className="w-full bg-slate-950/40 dark:border-slate-800 border-zinc-200 text-slate-400 rounded-lg py-2.5 px-3.5 text-xs focus:outline-none font-mono"
                        />
                      </div>

                      <div>
                        <label className={`block ${sTextMuted} text-xs font-semibold tracking-wider mb-1.5 uppercase`}>
                          {language === "kh" ? "អ្នកផ្គត់ផ្គង់ (Supplier)" : "Supplier"}
                        </label>
                        <select
                          id="watch-supplier-id"
                          value={watchSupplierId}
                          onChange={(e) => setWatchSupplierId(e.target.value)}
                          className={`w-full ${sInput} focus:border-amber-500 rounded-lg py-2.5 px-3 px-3.5 text-xs focus:outline-none transition-all cursor-pointer`}
                        >
                          <option value="">{language === "kh" ? "-- គ្មានភ្ជាប់អ្នកផ្គត់ផ្គង់ --" : "-- Unlinked / No Supplier --"}</option>
                          {(shopData.suppliers || []).map((sup) => (
                            <option key={sup.id} value={sup.id}>
                              {sup.name} ({sup.contactName || "Contact N/A"})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className={`block ${sTextMuted} text-xs font-semibold tracking-wider mb-1.5 uppercase`}>
                          {language === "kh" ? "កម្រិតជូនដំណឹងស្តុកទាប (Low Stock Threshold)" : "Low Stock Alert Threshold"}
                        </label>
                        <input
                          id="watch-low-stock-threshold"
                          type="number"
                          min="0"
                          value={watchLowStockThreshold}
                          onChange={(e) => setWatchLowStockThreshold(e.target.value !== "" ? Number(e.target.value) : "")}
                          placeholder="ឧ. 5"
                          className={`w-full ${sInput} focus:border-amber-500 rounded-lg py-2.5 px-3.5 text-xs focus:outline-none transition-all font-mono`}
                        />
                      </div>

                      <div className="flex gap-2.5 pt-2">
                        {editingWatchId && (
                          <button
                            type="button"
                            onClick={handleCancelEditWatch}
                            className={`flex-1 ${theme === "dark" ? "bg-slate-800 hover:bg-slate-700 text-slate-300" : "bg-zinc-200 hover:bg-zinc-300 text-zinc-700"} font-semibold py-2.5 px-4 rounded-lg text-xs cursor-pointer text-center`}
                          >
                            {language === "kh" ? "បោះបង់" : "Cancel"}
                          </button>
                        )}
                        <button
                          type="submit"
                          className="flex-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold py-2.5 px-4 rounded-lg text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                        >
                          {editingWatchId ? (
                            <>
                              <Check size={14} />
                              {language === "kh" ? "រក្សាទុកការកែប្រែ" : "Save Specs"}
                            </>
                          ) : (
                            <>
                              <Plus size={14} />
                              {language === "kh" ? "កត់ត្រាចូលស្តុក" : "Log to Stock"}
                            </>
                          )}
                        </button>
                      </div>
                    </form>
                  </div>

                  {/* Bulk Restock Low-Stock Inventory */}
                  <div className={`${sCard} border rounded-2xl p-6 shadow-xl space-y-4 animate-in fade-in slide-in-from-bottom-3 duration-200`}>
                    <h3 className="text-sm font-bold text-amber-500 pb-3 border-b dark:border-slate-800 border-zinc-200 flex items-center justify-between font-serif">
                      <span className="flex items-center gap-2">
                        <RefreshCw size={16} className="animate-spin-hover" />
                        {language === "kh" ? "ចាក់បំពេញស្តុកច្រើនមុខ" : "Bulk Restock Section"}
                      </span>
                      {Object.keys(bulkRestockQtys).length > 0 && (
                        <button
                          type="button"
                          onClick={() => setBulkRestockQtys({})}
                          className="text-[10px] text-slate-500 hover:text-red-500 font-medium font-sans cursor-pointer animate-pulse"
                        >
                          {language === "kh" ? "សម្អាត" : "Clear all"}
                        </button>
                      )}
                    </h3>

                    <p className={`text-[11px] ${sTextMuted} leading-relaxed font-sans`}>
                      {language === "kh"
                        ? "ជ្រើសរើស និងបញ្ចូលចំនួនដើម្បីបំពេញស្តុកនាឡិកាច្រើនមុខក្នុងពេលតែមួយ។"
                        : "Replenish stock for multiple low-stock items simultaneously in one single transaction."}
                    </p>

                    <form onSubmit={handleBulkRestockSubmit} className="space-y-4 font-sans">
                      {/* List area */}
                      <div className="space-y-2.5 max-h-[280px] overflow-y-auto pr-1">
                        {(() => {
                          const candidateWatches = shopData.watches.filter((w) => {
                            const threshold = w.lowStockThreshold !== undefined ? w.lowStockThreshold : 5;
                            if (w.stock < threshold) return true;
                            if (bulkRestockQtys[w.id] !== undefined) return true;
                            return false;
                          });

                          if (candidateWatches.length === 0) {
                            return (
                              <div className="text-center py-8 text-xs text-slate-500 italic">
                                {language === "kh" ? "គ្មានទំនិញខ្វះស្តុក ឬត្រូវបានជ្រើសរើសទេ" : "No low-stock items or selections"}
                              </div>
                            );
                          }

                          return candidateWatches.map((w) => {
                            const isLowStock = w.stock < (w.lowStockThreshold !== undefined ? w.lowStockThreshold : 5);
                            return (
                              <div
                                key={w.id}
                                className={`flex items-center justify-between gap-1.5 p-2 rounded-lg border ${
                                  isLowStock
                                    ? "dark:bg-red-950/20 bg-red-50/20 border-red-500/20"
                                    : "dark:bg-slate-950/40 bg-zinc-50/40 border-slate-800"
                                }`}
                              >
                                <div className="min-w-0 flex-1">
                                  <div className="font-semibold text-xs text-slate-200 truncate leading-snug">
                                    {w.brand} - {w.model}
                                  </div>
                                  <div className="flex items-center gap-1.5 mt-0.5 text-[10px]">
                                    <span className="font-mono text-slate-400 font-bold bg-slate-950/40 px-1 py-0.5 rounded">
                                      ID: {w.id}
                                    </span>
                                    <span
                                      className={`font-semibold font-sans px-1.5 py-0.5 rounded ${
                                        isLowStock ? "text-red-450 dark:text-red-400 bg-red-500/10" : "text-emerald-500 dark:text-emerald-400 bg-emerald-500/10"
                                      }`}
                                    >
                                      {language === "kh" ? `ស្តុក: ${w.stock} គ្រឿង` : `Stock: ${w.stock} left`}
                                    </span>
                                  </div>
                                </div>

                                <div className="flex items-center gap-1.5 shrink-0">
                                  <div className="relative flex items-center">
                                    <span className="absolute left-2 text-[10px] text-slate-500 font-bold font-mono">
                                      +
                                    </span>
                                    <input
                                      type="number"
                                      min="1"
                                      placeholder="0"
                                      value={bulkRestockQtys[w.id] || ""}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        const numValue = val === "" ? 0 : Math.max(0, parseInt(val, 10));
                                        setBulkRestockQtys({
                                          ...bulkRestockQtys,
                                          [w.id]: numValue,
                                        });
                                      }}
                                      className="w-16 bg-slate-955 dark:bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-lg py-1 pl-4.5 pr-2.5 text-right text-xs font-mono text-slate-100 placeholder-slate-655 focus:outline-none"
                                    />
                                  </div>

                                  {/* Delete option if it's explicitly added */}
                                  {bulkRestockQtys[w.id] !== undefined && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const next = { ...bulkRestockQtys };
                                        delete next[w.id];
                                        setBulkRestockQtys(next);
                                      }}
                                      className="text-slate-500 hover:text-red-500 transition-colors p-1 cursor-pointer"
                                      title={language === "kh" ? "លុប" : "Remove"}
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          });
                        })()}
                      </div>

                      {/* Add other watches to restock candidate list */}
                      {(() => {
                        const addable = shopData.watches.filter(
                          (w) => w.stock >= 5 && bulkRestockQtys[w.id] === undefined
                        );
                        if (addable.length === 0) return null;

                        return (
                          <div className="space-y-1">
                            <label className={`block ${sTextMuted} text-[10px] font-semibold uppercase tracking-wider`}>
                              {language === "kh" ? "បន្ថែមនាឡិកាផ្សេងទៀត" : "Include Other Items"}
                            </label>
                            <select
                              onChange={(e) => {
                                const val = e.target.value;
                                if (val) {
                                  setBulkRestockQtys({
                                    ...bulkRestockQtys,
                                    [val]: 5,
                                  });
                                  e.target.value = "";
                                }
                              }}
                              className="w-full bg-slate-955 dark:bg-slate-950 border border-slate-850 hover:border-slate-800 rounded-lg py-1.5 px-2.5 text-xs text-slate-350 focus:border-amber-500 focus:outline-none transition-all cursor-pointer font-sans"
                            >
                              <option value="">
                                {language === "kh" ? "+ ជ្រើសរើសនាឡិកាក្នុងបញ្ជី..." : "+ Select from stock list..."}
                              </option>
                              {addable.map((w) => (
                                <option key={w.id} value={w.id}>
                                  {w.brand} - {w.model} ({w.color || "N/A"}) [${w.costPrice}]
                                </option>
                              ))}
                            </select>
                          </div>
                        );
                      })()}

                      {/* Total Cost Calculation info */}
                      {(() => {
                        const totalBulkCost = Object.entries(bulkRestockQtys).reduce((acc: number, [watchId, qty]) => {
                          const qVal = Number(qty) || 0;
                          if (qVal <= 0) return acc;
                          const watch = shopData.watches.find((w) => w.id === watchId);
                          return acc + (watch ? qVal * watch.costPrice : 0);
                        }, 0);

                        const totalBulkItems = Object.values(bulkRestockQtys).reduce((sum: number, qty) => sum + (Number(qty) || 0), 0);

                        if (totalBulkItems === 0) return null;

                        return (
                          <div className="dark:bg-slate-950 bg-zinc-50 border border-amber-500/15 rounded-lg p-3 text-xs space-y-1 shadow-sm font-sans">
                            <div className="flex justify-between text-slate-400 font-medium">
                              <span>{language === "kh" ? "សរុបនាឡិកាបន្ថែម៖" : "Total items to replenish:"}</span>
                              <span className="font-semibold text-slate-100 font-mono">+{totalBulkItems} គ្រឿង</span>
                            </div>
                            <div className="flex justify-between border-t border-dashed border-slate-800 pt-1 text-slate-400 font-medium">
                              <span>{language === "kh" ? "ប្រាក់វិនិយោគសរុប៖" : "Total estimated cost:"}</span>
                              <span className="font-bold text-amber-500 font-mono">${totalBulkCost.toLocaleString()}</span>
                            </div>
                          </div>
                        );
                      })()}

                      {/* Submit Button */}
                      <button
                        type="submit"
                        className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold py-2.5 px-4 rounded-lg text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-md"
                      >
                        <Check size={14} />
                        {language === "kh" ? "រក្សាទុកការបំពេញស្តុក" : "Save Bulk Stock Update"}
                      </button>
                    </form>
                  </div>

                </div>
              ) : null}

                {/* Watch List Display (Right panel) - Expand to Full 3 cols for Staff Pich */}
                <div className={`${userRole === "owner" ? "lg:col-span-2" : "lg:col-span-3"} ${sCard} border rounded-2xl p-6 shadow-xl space-y-4`}>
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b dark:border-slate-800 border-zinc-200 pb-3">
                    <div className="flex flex-col gap-1">
                      <h3 className="text-sm font-bold text-amber-500 flex items-center gap-2 font-serif">
                        <WatchIcon size={16} />
                        {language === "kh" ? `តារាងគ្រប់គ្រងស្តុកនាឡិកា (${filteredWatches.length} ប្រភេទ)` : `Watch Stock Inventory (${filteredWatches.length} items)`}
                      </h3>
                      <span className={`text-[10px] ${sTextMuted} font-medium font-sans`}>{userRole === "owner" ? t.ownerNameLabel : t.adminNameLabel}</span>
                    </div>
                    
                    {/* Search & Category Filter Fields */}
                    <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto font-sans">
                      {/* Category Filter Selector */}
                      <select
                        id="watch-filter-category-select"
                        value={watchFilterCategory}
                        onChange={(e) => setWatchFilterCategory(e.target.value)}
                        className={`text-xs ${sInput} rounded-lg py-2 px-3 focus:outline-none focus:border-amber-500 cursor-pointer min-w-[125px]`}
                      >
                        <option value="all">{language === "kh" ? "ប្រភេទទាំងអស់" : "All Categories"}</option>
                        <option value="Watch Quartz">Watch Quartz</option>
                        <option value="Automatic Watch">Automatic Watch</option>
                        <option value="Digital Watch">Digital Watch</option>
                        <option value="Watch Sport">Watch Sport</option>
                        <option value="Smart Watch">Smart Watch</option>
                      </select>

                      <div className="relative w-full sm:w-48 md:w-56">
                        <span className={`absolute inset-y-0 left-0 pl-3 flex items-center ${sTextMuted}`}>
                          <Search size={14} />
                        </span>
                        <input
                          id="watch-search-input"
                          type="text"
                          value={watchSearch}
                          onChange={(e) => setWatchSearch(e.target.value)}
                          placeholder={t.searchPlaceholder}
                          className={`w-full ${sInput} rounded-lg pl-9 pr-3 py-2 text-xs focus:outline-none focus:border-amber-500`}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsQRModalOpenForWatchSearch(true)}
                        className="bg-slate-850 hover:bg-slate-800 text-amber-500 hover:text-amber-400 border border-slate-850 hover:border-amber-500/45 rounded-lg p-2 text-xs transition-all duration-150 flex items-center justify-center gap-1.5 shrink-0 cursor-pointer shadow-md"
                        title={language === "kh" ? "ស្កេនស្វែងរកនាឡិកា" : "Scan QR to Find"}
                      >
                        <QrCode size={14} />
                        <span className="hidden sm:inline">{language === "kh" ? "ស្កេន" : "Scan"}</span>
                      </button>
                    </div>
                  </div>

                  {filteredWatches.length === 0 ? (
                    <div className={`py-24 text-center ${sTextMuted} text-xs font-sans`}>
                      {language === "kh" ? "មិនមាននាឡិកាដែលត្រូវនឹងការស្វែងរករបស់អ្នកទេ។" : "No watches match your search criteria."}
                    </div>
                  ) : (
                    <div className={`overflow-x-auto rounded-xl border ${sBorder}`}>
                      <table className="w-full text-left border-collapse text-xs">
                        <thead className={sTableHead}>
                          <tr className="border-b border-zinc-200 dark:border-slate-800">
                            <th className="p-3 font-medium">{language === "kh" ? "លេខកូដ (ID)" : "Watch SKU (ID)"}</th>
                            <th className="p-3 font-medium">{language === "kh" ? "ម៉ាក និងម៉ូដែល" : "Brand & Model"}</th>
                            <th className="p-3 font-medium">{language === "kh" ? "ពណ៌" : "Color"}</th>
                            {userRole === "owner" && <th className="p-3 font-medium text-right">{t.costPrice}</th>}
                            {userRole === "owner" && <th className="p-3 font-medium text-right">{language === "kh" ? "លុយស្តុកសរុប" : "Stock Value"}</th>}
                            <th className="p-3 font-medium text-right">{t.sellPrice}</th>
                            {userRole === "owner" && <th className="p-3 font-medium text-right">{language === "kh" ? "ជិន (ចំណេញ/គ្រឿង)" : "Margin/unit"}</th>}
                            <th className="p-3 font-medium text-center">{language === "kh" ? "ស្តុក (ចាស់/ថ្មី)" : "Stock (Old/New)"}</th>
                            {userRole === "owner" && <th className="p-3 font-medium text-center">{language === "kh" ? "សកម្មភាព" : "Manage"}</th>}
                          </tr>
                        </thead>
                        <tbody className={`divide-y ${theme === "dark" ? "divide-slate-800" : "divide-zinc-200"}`}>
                          {filteredWatches.map((w, index) => {
                            const isLowStock = w.stock < (w.lowStockThreshold !== undefined ? w.lowStockThreshold : 5);
                            const isEven = index % 2 === 0;
                            return (
                              <tr key={w.id} className={`${isEven ? "" : sRowEven} transition-all`}>
                                <td className={`p-3 font-mono text-[11px] ${sTextMuted} font-semibold`}>{w.id}</td>
                                <td className="p-3 font-bold font-sans">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span>{w.brand} - {w.model}</span>
                                    <span className="inline-block text-[9px] px-1.5 py-0.5 bg-slate-800 dark:bg-slate-900 border border-slate-700 text-amber-500 rounded font-semibold font-sans">
                                      🏷️ {w.category || "Watch Quartz"}
                                    </span>
                                  </div>
                                  {w.supplierId && (() => {
                                    const linkedSup = (shopData.suppliers || []).find((s) => s.id === w.supplierId);
                                    if (!linkedSup) return null;

                                    const emailSubject = encodeURIComponent(language === "kh" ? `បញ្ជាទិញនាឡិកាបន្ថែម៖ ${w.brand} ${w.model}` : `Restock Order: ${w.brand} ${w.model}`);
                                    const emailBody = encodeURIComponent(
                                      language === "kh"
                                        ? `ជំរាបសួរ ${linkedSup.contactName || linkedSup.name}!\n\nខ្ញុំចង់សួរនាំអំពីការបញ្ជាទិញនាឡិកាដៃម៉ាក៖\n- ម៉ាក / ម៉ូឌែល៖ ${w.brand} ${w.model}\n- ពណ៌៖ ${w.color || "—"}\n- លេខកូដទំនិញ៖ ${w.id}\n- ស្តុកបច្ចុប្បន្ន៖ ${w.stock} គ្រឿង\n\nសូមជួយពិនិត្យលទ្ធភាពផ្គត់ផ្គង់ និងតម្លៃបោះដុំឡើងវិញផង។ សូមអរគុណ!`
                                        : `Dear ${linkedSup.contactName || linkedSup.name},\n\nI am contacting you regarding a restock request for:\n- Watch: ${w.brand} - ${w.model}\n- Color: ${w.color || "N/A"}\n- Watch ID / SKU: ${w.id}\n- Current Stock Qty: ${w.stock} units\n\nPlease let us know the availability and wholesale price as soon as possible. Thank you!`
                                    );
                                    const mailtoUrl = linkedSup.email ? `mailto:${linkedSup.email}?subject=${emailSubject}&body=${emailBody}` : null;
                                    const telUrl = linkedSup.phone ? `tel:${linkedSup.phone}` : null;

                                    return (
                                      <div className="flex flex-wrap items-center gap-1.5 mt-1.5 animate-in fade-in duration-200">
                                        <span className="inline-block text-[10px] px-2 py-0.5 bg-amber-500/10 text-amber-500 rounded-md font-semibold border border-amber-500/15" title={`Supplier ID: ${linkedSup.id}`}>
                                          🏢 {linkedSup.name}
                                        </span>
                                        {(telUrl || mailtoUrl) ? (
                                          <div className={`inline-flex items-center gap-2 ${theme === "dark" ? "bg-slate-950/65 border-slate-800" : "bg-zinc-100 border-zinc-200"} border rounded-md px-2 py-0.5 text-[10px] shadow-sm`} title="Contact Supplier">
                                            <span className={`${theme === "dark" ? "text-slate-400" : "text-zinc-600"} font-medium`}>
                                              {language === "kh" ? "ទាក់ទង៖" : "Contact:"}
                                            </span>
                                            {telUrl && (
                                              <a
                                                href={telUrl}
                                                className="text-emerald-500 hover:text-emerald-400 dark:text-emerald-400 dark:hover:text-emerald-300 transition-colors p-0.5 inline-flex items-center justify-center"
                                                title={language === "kh" ? `ខលទៅ៖ ${linkedSup.phone}` : `Call: ${linkedSup.phone}`}
                                              >
                                                <Phone size={10} className="stroke-[2.5]" />
                                              </a>
                                            )}
                                            {mailtoUrl && (
                                              <a
                                                href={mailtoUrl}
                                                className="text-amber-500 hover:text-amber-400 dark:text-amber-400 dark:hover:text-amber-300 transition-colors p-0.5 inline-flex items-center justify-center"
                                                title={language === "kh" ? `ផ្ញើអ៊ីមែលទៅ៖ ${linkedSup.email}` : `Email: ${linkedSup.email}`}
                                              >
                                                <Mail size={10} className="stroke-[2.5]" />
                                              </a>
                                            )}
                                          </div>
                                        ) : null}
                                      </div>
                                    );
                                  })()}
                                </td>
                                <td className="p-3 font-sans">
                                  <div className="font-semibold text-slate-200">{w.color || "—"}</div>
                                  {(() => {
                                    const watchSales = (shopData.sales || []).filter(s => s.watchId === w.id);
                                    if (watchSales.length === 0) return null;
                                    const salesByColor: { [key: string]: number } = {};
                                    watchSales.forEach(s => {
                                      const col = (s.watchColor || "").trim() || (language === "kh" ? "ទូទៅ" : "General");
                                      salesByColor[col] = (salesByColor[col] || 0) + s.quantity;
                                    });
                                    return (
                                      <div className="mt-1.5 space-y-1 animate-in fade-in duration-200">
                                        <div className="text-[9px] text-slate-500 font-semibold uppercase tracking-wide">
                                          📊 {language === "kh" ? "លក់ចេញតាមពណ៌៖" : "Sold by Color:"}
                                        </div>
                                        <div className="flex flex-wrap gap-1">
                                          {Object.entries(salesByColor).map(([col, qty]) => (
                                            <span 
                                              key={col} 
                                              className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded bg-slate-900/60 dark:bg-slate-950/60 border border-slate-800 text-slate-400 font-medium"
                                              title={language === "kh" ? `លក់ចេញ ${qty} គ្រឿង` : `Sold ${qty} units`}
                                            >
                                              <span className="text-slate-300 font-semibold mr-1">{col}:</span>
                                              <span className="text-amber-500 font-mono font-bold">{qty}</span>
                                            </span>
                                          ))}
                                        </div>
                                      </div>
                                    );
                                  })()}
                                </td>
                                {userRole === "owner" && (
                                  <td className="p-3 text-right font-mono text-slate-300 font-medium">${w.costPrice.toLocaleString()}</td>
                                )}
                                {userRole === "owner" && (
                                  <td className="p-3 text-right font-mono text-cyan-400 font-semibold" title={language === "kh" ? "លុយស្តុកសរុប = ថ្លៃដើម x ចំនួនស្តុក" : "Stock Value = Cost x Stock"}>
                                    ${(w.costPrice * w.stock).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </td>
                                )}
                                <td className="p-3 text-right font-mono font-bold text-amber-500">${w.sellPrice.toLocaleString()}</td>
                                {userRole === "owner" && (
                                  <td className="p-3 text-right font-mono text-emerald-400 font-semibold">${(w.sellPrice - w.costPrice).toLocaleString()}</td>
                                )}
                                <td className="p-3 text-center font-sans">
                                  <div className="flex items-center justify-center gap-1.5 font-mono">
                                    <span className={`font-bold ${isLowStock ? "text-rose-500 animate-pulse" : "text-slate-200"}`}>{w.stock}</span>
                                    <span className="text-[10px] text-slate-500">({w.oldStock !== undefined ? w.oldStock : w.stock}/{w.newStock !== undefined ? w.newStock : 0})</span>
                                  </div>
                                </td>
                                {userRole === "owner" && (
                                  <td className="p-3 text-center">
                                    <div className="flex items-center justify-center gap-1.5 font-sans">
                                      <button
                                        onClick={() => handleEditWatch(w)}
                                        className="p-1 px-2 bg-slate-800 text-amber-500 hover:bg-slate-700 rounded text-[10px] transition cursor-pointer"
                                      >
                                        <span>{language === "kh" ? "កែប្រែ" : "Edit"}</span>
                                      </button>
                                      <button
                                        onClick={() => handleDeleteWatch(w.id)}
                                        className="p-1 px-[7px] text-rose-450 hover:bg-rose-500/10 rounded text-rose-400 border border-transparent hover:border-rose-500/10 transition cursor-pointer"
                                        title={language === "kh" ? "លុបនាឡិកា" : "Delete watch"}
                                      >
                                        <Trash2 size={11} />
                                      </button>
                                    </div>
                                  </td>
                                )}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

              </div>

              {/* Floating Action Button (FAB) for Quick QR Product Lookup */}
              <button
                type="button"
                onClick={() => setIsQRModalOpenForWatchSearch(true)}
                className="fixed bottom-6 right-6 md:bottom-8 md:right-8 z-40 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 p-4 rounded-full shadow-[0_10px_25px_-5px_rgba(245,158,11,0.4)] hover:shadow-[0_15px_30px_-5px_rgba(245,158,11,0.6)] hover:scale-110 active:scale-95 transition-all duration-200 flex items-center justify-center cursor-pointer group border border-amber-400/30"
                title={language === "kh" ? "ស្កេន QR ស្វែងរកផលិតផលរហ័ស" : "Scan QR for Quick Product Lookup"}
              >
                <QrCode className="w-6 h-6 stroke-[2.5]" />
                <span className="max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-300 ease-in-out font-bold text-xs whitespace-nowrap pl-0 group-hover:pl-2">
                  {language === "kh" ? "ស្កេនស្វែងរក" : "Quick Scan"}
                </span>
              </button>
            </>
          ) : (
            /* RENDER MONTHLY STOCK TAKE WORKSPACE */
            <div className="space-y-6 animate-in fade-in duration-200 font-sans">
              
              {/* 1. Header Overview Banner */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-lg">
                <div>
                  <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                    <ClipboardList className="text-amber-500" size={20} />
                    <span>{language === "kh" ? "ផ្ទៀងផ្ទាត់ និងរាប់ស្តុកនាឡិកាប្រចាំខែ" : "Monthly Stock Count Audit"}</span>
                  </h3>
                  <p className={`text-xs ${sTextMuted} mt-1`}>
                    {language === "kh"
                      ? "រាប់ចំនួននាឡិកាជាក់ស្តែងក្នុងហាង ធៀបនឹងចំនួនក្នុងប្រព័ន្ធ ដើម្បីសម្រួលភាពលម្អៀង និងរក្សាកំណត់ត្រាប្រចាំខែ"
                      : "Perform high-precision physical stock counting, evaluate discrepancies, and record monthly audit logs."}
                  </p>
                </div>

                {/* Quick Action Button to download blank audit sheet */}
                <button
                  type="button"
                  onClick={() => {
                    const csvHeaders = ["Watch ID (SKU)", "Brand", "Model", "Color", "Current System Stock", "Physical Count"];
                    const rows = shopData.watches.map(w => [
                      w.id,
                      w.brand,
                      w.model,
                      w.color || "ទូទៅ",
                      w.stock || 0,
                      ""
                    ]);
                    const csvContent = "data:text/csv;charset=utf-8," 
                      + [csvHeaders.join(","), ...rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(","))].join("\n");
                    const encodedUri = encodeURI(csvContent);
                    const link = document.createElement("a");
                    link.setAttribute("href", encodedUri);
                    link.setAttribute("download", `Chrono_StockTake_Sheet_${stockTakeMonth}.csv`);
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    showNotice("success", language === "kh" ? "ទាញយកគំរូរៀបរាប់ស្តុកជោគជ័យ!" : "Blank audit sheet template exported!");
                  }}
                  className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs px-3.5 py-2 rounded-xl flex items-center gap-1.5 cursor-pointer transition self-start md:self-auto"
                >
                  <Download size={13} />
                  <span>{language === "kh" ? "ទាញយកបញ្ជីសម្រាប់រាប់" : "Export Audit Sheet"}</span>
                </button>
              </div>

              {/* 2. Top-level dynamic calculations cards */}
              {(() => {
                const systemTotal = shopData.watches.reduce((acc, w) => acc + (w.stock || 0), 0);
                const physicalTotal = shopData.watches.reduce((acc, w) => {
                  const count = physicalCounts[w.id];
                  return acc + (count !== undefined ? count : (w.stock || 0));
                }, 0);
                
                const discrepantCount = shopData.watches.filter((w) => {
                  const count = physicalCounts[w.id];
                  return count !== undefined && count !== (w.stock || 0);
                }).length;

                const totalValueDiff = shopData.watches.reduce((acc, w) => {
                  const count = physicalCounts[w.id];
                  const diff = (count !== undefined ? count : (w.stock || 0)) - (w.stock || 0);
                  return acc + (diff * (w.costPrice || 0));
                }, 0);

                return (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Card 1: System Stock */}
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4.5 space-y-1">
                      <span className={`text-[10px] uppercase font-bold tracking-wider ${sTextMuted}`}>
                        {language === "kh" ? "ស្តុកសរុបក្នុងប្រព័ន្ធ" : "Total System Stock"}
                      </span>
                      <p className="text-xl font-bold font-mono text-slate-100">
                        {systemTotal} <span className="text-xs font-sans text-slate-400 font-normal">{language === "kh" ? "គ្រឿង" : "pcs"}</span>
                      </p>
                    </div>

                    {/* Card 2: Physical Counted */}
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4.5 space-y-1">
                      <span className={`text-[10px] uppercase font-bold tracking-wider ${sTextMuted}`}>
                        {language === "kh" ? "ចំនួនរាប់ជាក់ស្តែងសរុប" : "Total Physical Stock"}
                      </span>
                      <p className="text-xl font-bold font-mono text-amber-500">
                        {physicalTotal} <span className="text-xs font-sans text-amber-500/80 font-normal">{language === "kh" ? "គ្រឿង" : "pcs"}</span>
                      </p>
                    </div>

                    {/* Card 3: Discrepant models */}
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4.5 space-y-1">
                      <span className={`text-[10px] uppercase font-bold tracking-wider ${sTextMuted}`}>
                        {language === "kh" ? "ម៉ូដែលដែលមានលម្អៀង" : "Discrepant Models"}
                      </span>
                      <p className={`text-xl font-bold font-mono ${discrepantCount > 0 ? "text-rose-450 text-rose-400" : "text-slate-100"}`}>
                        {discrepantCount} <span className="text-xs font-sans text-slate-400 font-normal">{language === "kh" ? "ម៉ូដែល" : "models"}</span>
                      </p>
                    </div>

                    {/* Card 4: Estimated Financial Discrepancy value */}
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4.5 space-y-1">
                      <span className={`text-[10px] uppercase font-bold tracking-wider ${sTextMuted}`}>
                        {language === "kh" ? "តម្លៃផលប៉ះពាល់ហិរញ្ញវត្ថុ" : "Financial Discrepancy"}
                      </span>
                      <p className={`text-xl font-bold font-mono ${totalValueDiff < 0 ? "text-rose-450 text-rose-400" : totalValueDiff > 0 ? "text-emerald-400" : "text-slate-100"}`}>
                        {totalValueDiff === 0 ? "$0.00" : (totalValueDiff < 0 ? `-$${Math.abs(totalValueDiff).toLocaleString()}` : `+$${totalValueDiff.toLocaleString()}`)}
                      </p>
                    </div>
                  </div>
                );
              })()}

              {/* 3. Detailed Report View (If a past Stock Take is selected) */}
              {selectedStockTakeId ? (
                (() => {
                  const session = (shopData.stockTakes || []).find(s => s.id === selectedStockTakeId);
                  if (!session) return <p className="text-slate-400 text-xs">Report not found.</p>;

                  return (
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
                      {/* Report Header */}
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-4">
                        <div className="space-y-1">
                          <span className="text-[10px] bg-amber-500/10 text-amber-500 border border-amber-500/20 px-2 py-0.5 rounded-md font-mono font-bold">
                            {session.id}
                          </span>
                          <h4 className="text-base font-bold text-slate-100">
                            {language === "kh" ? `របាយការណ៍សម្រួលស្តុកប្រចាំខែ៖ ${session.periodKey}` : `Stock Audit Report: ${session.periodKey}`}
                          </h4>
                          <p className="text-xs text-slate-400">
                            {language === "kh" 
                              ? `កាលបរិច្ឆេទរាប់៖ ${session.dateCounted} | រាប់ដោយ៖ ${session.countedBy}` 
                              : `Date Performed: ${session.dateCounted} | Performed By: ${session.countedBy}`}
                          </p>
                        </div>

                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              const csvHeaders = ["Brand", "Model", "Color", "System Stock", "Physical Stock", "Difference", "Cost Price", "Value Difference"];
                              const rows = session.items.map(item => [
                                item.brand,
                                item.model,
                                item.color,
                                item.systemStock,
                                item.physicalStock,
                                item.difference,
                                item.costPrice,
                                item.valueDifference
                              ]);
                              const csvContent = "data:text/csv;charset=utf-8," 
                                + [csvHeaders.join(","), ...rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(","))].join("\n");
                              const encodedUri = encodeURI(csvContent);
                              const link = document.createElement("a");
                              link.setAttribute("href", encodedUri);
                              link.setAttribute("download", `Report_StockTake_${session.periodKey}_${session.id}.csv`);
                              document.body.appendChild(link);
                              link.click();
                              document.body.removeChild(link);
                              showNotice("success", language === "kh" ? "នាំចេញរបាយការណ៍ជោគជ័យ!" : "Report exported successfully!");
                            }}
                            className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs px-3 py-2 rounded-xl flex items-center gap-1.5 transition cursor-pointer"
                          >
                            <Download size={13} />
                            <span>{language === "kh" ? "នាំចេញ CSV" : "Export Report"}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setSelectedStockTakeId(null)}
                            className="bg-slate-950 hover:bg-slate-850 text-slate-400 hover:text-slate-200 border border-slate-800 text-xs px-3 py-2 rounded-xl transition cursor-pointer"
                          >
                            {language === "kh" ? "ត្រឡប់ក្រោយ" : "Back to Count"}
                          </button>
                        </div>
                      </div>

                      {/* Report statistics metrics */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-slate-950/60 rounded-xl p-4 border border-slate-850">
                          <span className="text-[10px] text-slate-400 uppercase tracking-wide font-medium block">
                            {language === "kh" ? "ស្តុកប្រព័ន្ធសសរុប" : "Total System Stock"}
                          </span>
                          <span className="text-base font-bold text-slate-200 font-mono">{session.totalSystemStock}</span>
                        </div>
                        <div className="bg-slate-950/60 rounded-xl p-4 border border-slate-850">
                          <span className="text-[10px] text-slate-400 uppercase tracking-wide font-medium block">
                            {language === "kh" ? "ស្តុករាប់ពិតប្រាកដ" : "Total Counted Stock"}
                          </span>
                          <span className="text-base font-bold text-amber-500 font-mono">{session.totalPhysicalStock}</span>
                        </div>
                        <div className="bg-slate-950/60 rounded-xl p-4 border border-slate-850">
                          <span className="text-[10px] text-slate-400 uppercase tracking-wide font-medium block">
                            {language === "kh" ? "ចំនួនមុខនាឡិកាលម្អៀង" : "Discrepant Models"}
                          </span>
                          <span className="text-base font-bold text-rose-450 text-rose-400 font-mono">{session.totalDiscrepancies}</span>
                        </div>
                        <div className="bg-slate-950/60 rounded-xl p-4 border border-slate-850">
                          <span className="text-[10px] text-slate-400 uppercase tracking-wide font-medium block">
                            {language === "kh" ? "តម្លៃផលប៉ះពាល់ហិរញ្ញវត្ថុ" : "Financial Difference"}
                          </span>
                          <span className={`text-base font-bold font-mono ${session.totalValueDifference < 0 ? "text-rose-450 text-rose-400" : session.totalValueDifference > 0 ? "text-emerald-400" : "text-slate-200"}`}>
                            ${session.totalValueDifference.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>

                      {/* Detailed Discrepancies Table */}
                      <div className="space-y-3">
                        <h5 className="text-xs font-bold uppercase tracking-wider text-amber-500">
                          {language === "kh" ? "📝 តារាងព័ត៌មានលម្អៀង និងសម្រួលស្តុក" : "📝 Itemized Discrepancy Ledger"}
                        </h5>

                        <div className="border border-slate-800 rounded-xl overflow-hidden">
                          <table className="w-full text-left text-xs">
                            <thead>
                              <tr className="bg-slate-950 border-b border-slate-850 text-slate-400 font-semibold uppercase tracking-wider">
                                <th className="p-3">{language === "kh" ? "ម៉ាក និងម៉ូដែល" : "Brand & Model"}</th>
                                <th className="p-3 text-center">{language === "kh" ? "ស្តុកក្នុងប្រព័ន្ធ" : "System Stock"}</th>
                                <th className="p-3 text-center">{language === "kh" ? "ចំនួនរាប់ជាក់ស្តែង" : "Physical Count"}</th>
                                <th className="p-3 text-center">{language === "kh" ? "ភាពលម្អៀង" : "Discrepancy"}</th>
                                {userRole === "owner" && (
                                  <>
                                    <th className="p-3 text-right">{language === "kh" ? "តម្លៃដើម (Cost)" : "Cost Price"}</th>
                                    <th className="p-3 text-right">{language === "kh" ? "ផលប៉ះពាល់ហិរញ្ញវត្ថុ" : "Net Difference"}</th>
                                  </>
                                )}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-850">
                              {session.items.map((item, index) => {
                                const diff = item.difference;
                                return (
                                  <tr key={index} className="hover:bg-slate-900/40">
                                    <td className="p-3 font-sans">
                                      <div className="font-semibold text-slate-100">{item.brand} {item.model}</div>
                                      <div className="text-[10px] text-slate-500 font-mono flex items-center gap-1.5 mt-0.5">
                                        <span>ID: {item.watchId}</span>
                                        <span>•</span>
                                        <span>{language === "kh" ? `ពណ៌៖ ${item.color || "ទូទៅ"}` : `Color: ${item.color || "General"}`}</span>
                                      </div>
                                    </td>
                                    <td className="p-3 text-center font-mono text-slate-300">{item.systemStock}</td>
                                    <td className="p-3 text-center font-mono text-amber-500 font-semibold">{item.physicalStock}</td>
                                    <td className="p-3 text-center">
                                      {diff === 0 ? (
                                        <span className="inline-flex text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full font-sans font-semibold">
                                          {language === "kh" ? "ស្មើគ្នា" : "Perfect"}
                                        </span>
                                      ) : diff < 0 ? (
                                        <span className="inline-flex text-[10px] bg-rose-500/10 text-rose-450 text-rose-400 px-2 py-0.5 rounded-full font-mono font-bold">
                                          {diff} {language === "kh" ? "គ្រឿង" : "pcs"}
                                        </span>
                                      ) : (
                                        <span className="inline-flex text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full font-mono font-bold">
                                          +{diff} {language === "kh" ? "គ្រឿង" : "pcs"}
                                        </span>
                                      )}
                                    </td>
                                    {userRole === "owner" && (
                                      <>
                                        <td className="p-3 text-right font-mono text-slate-400">${item.costPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                        <td className={`p-3 text-right font-mono font-semibold ${item.valueDifference < 0 ? "text-rose-450 text-rose-400" : item.valueDifference > 0 ? "text-emerald-400" : "text-slate-400"}`}>
                                          {item.valueDifference === 0 ? "$0.00" : (item.valueDifference < 0 ? `-$${Math.abs(item.valueDifference).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : `+$${item.valueDifference.toLocaleString(undefined, { minimumFractionDigits: 2 })}`)}
                                        </td>
                                      </>
                                    )}
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {session.notes && (
                        <div className="bg-slate-950/60 border border-slate-850/60 rounded-xl p-4.5">
                          <span className="text-[10px] uppercase font-bold tracking-wider text-amber-500 block mb-1">
                            {language === "kh" ? "📝 កំណត់ចំណាំនៃការរាប់ស្តុក" : "📝 Counting Session Notes"}
                          </span>
                          <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line">{session.notes}</p>
                        </div>
                      )}
                    </div>
                  );
                })()
              ) : (
                /* 4. ACTIVE STOCK TAKE AND DISCREPANCY RECONCILIATION FORM */
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  
                  {/* Left Column - Watch Stock Counting Sheet (Col span 8) */}
                  <div className="lg:col-span-8 space-y-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
                      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 border-b border-slate-800 pb-4">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-amber-500">
                          {language === "kh" ? "📑 តារាងរាប់ចំនួននាឡិកាជាក់ស្តែង" : "📑 Physical Stock Count Sheet"}
                        </h4>
                        
                        {/* Search specifically for count list */}
                        <div className="relative w-full sm:w-64">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={12} />
                          <input
                            type="text"
                            placeholder={language === "kh" ? "ស្វែងរកនាឡិកាដើម្បីរាប់..." : "Search watches to count..."}
                            value={stockCountSearch}
                            onChange={(e) => setStockCountSearch(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-lg py-1.5 pl-8 pr-3 text-slate-200 text-xs focus:outline-none transition-all"
                          />
                        </div>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="bg-slate-950 border-b border-slate-850 text-slate-400 font-semibold uppercase tracking-wider">
                              <th className="p-3 w-44">{language === "kh" ? "ម៉ាក និងម៉ូដែល" : "Brand & Model"}</th>
                              <th className="p-3 text-center w-24">{language === "kh" ? "ស្តុកក្នុងប្រព័ន្ធ" : "System Stock"}</th>
                              <th className="p-3 text-center w-40">{language === "kh" ? "ចំនួនរាប់ពិតប្រាកដ" : "Physical Count"}</th>
                              <th className="p-3 text-center w-24">{language === "kh" ? "ភាពលម្អៀង" : "Discrepancy"}</th>
                              {userRole === "owner" && (
                                <th className="p-3 text-right w-24">{language === "kh" ? "ផលប៉ះពាល់" : "Financial Impact"}</th>
                              )}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-850">
                            {(() => {
                              const filteredWatches = shopData.watches.filter((w) => {
                                const searchStr = `${w.brand} ${w.model} ${w.id}`.toLowerCase();
                                return searchStr.includes(stockCountSearch.toLowerCase());
                              });

                              if (filteredWatches.length === 0) {
                                  return (
                                    <tr>
                                      <td colSpan={5} className="py-12 text-center text-slate-500 font-medium">
                                        {language === "kh" ? "រកមិនឃើញនាឡិកាត្រូវរាប់ទេ" : "No watches found matching count filter"}
                                      </td>
                                    </tr>
                                  );
                                }

                              return filteredWatches.map((w) => {
                                const currentSystem = w.stock || 0;
                                const currentPhysical = physicalCounts[w.id] !== undefined ? physicalCounts[w.id] : currentSystem;
                                const difference = currentPhysical - currentSystem;
                                const valueDiff = difference * (w.costPrice || 0);

                                return (
                                  <tr key={w.id} className="hover:bg-slate-900/40">
                                    <td className="p-3">
                                      <div className="font-semibold text-slate-200 font-sans">{w.brand} {w.model}</div>
                                      <div className="text-[10px] text-slate-500 font-mono flex items-center gap-1.5 mt-0.5">
                                        <span className="bg-slate-950 px-1.5 py-0.5 border border-slate-850 text-[9px] font-mono text-amber-500 rounded">
                                          {w.id}
                                        </span>
                                        <span>•</span>
                                        <span>{w.color || "ទូទៅ"}</span>
                                      </div>
                                    </td>
                                    
                                    <td className="p-3 text-center font-mono text-slate-400 font-medium">
                                      {currentSystem}
                                    </td>

                                    <td className="p-3">
                                      <div className="flex items-center justify-center gap-1.5 w-fit mx-auto">
                                        {/* Minus button */}
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setPhysicalCounts(prev => ({
                                              ...prev,
                                              [w.id]: Math.max(0, currentPhysical - 1)
                                            }));
                                          }}
                                          className="w-6.5 h-6.5 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 rounded text-slate-300 flex items-center justify-center font-bold text-sm cursor-pointer select-none transition animate-none"
                                        >
                                          -
                                        </button>

                                        <input
                                          type="number"
                                          value={currentPhysical}
                                          onChange={(e) => {
                                            const val = e.target.value === "" ? 0 : Math.max(0, parseInt(e.target.value) || 0);
                                            setPhysicalCounts(prev => ({
                                              ...prev,
                                              [w.id]: val
                                            }));
                                          }}
                                          className="w-14 bg-slate-950 border border-slate-800 focus:border-amber-500 rounded text-center text-xs font-mono font-bold py-1 text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
                                        />

                                        {/* Plus button */}
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setPhysicalCounts(prev => ({
                                              ...prev,
                                              [w.id]: currentPhysical + 1
                                            }));
                                          }}
                                          className="w-6.5 h-6.5 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 rounded text-slate-300 flex items-center justify-center font-bold text-sm cursor-pointer select-none transition animate-none"
                                        >
                                          +
                                        </button>
                                      </div>
                                    </td>

                                    <td className="p-3 text-center">
                                      {difference === 0 ? (
                                        <span className="text-[10px] text-slate-500 font-medium">{language === "kh" ? "ស្មើគ្នា" : "No difference"}</span>
                                      ) : difference < 0 ? (
                                        <span className="inline-flex text-[10px] bg-rose-500/10 text-rose-455 text-rose-400 font-mono font-bold px-2 py-0.5 rounded-full">
                                          {difference}
                                        </span>
                                      ) : (
                                        <span className="inline-flex text-[10px] bg-emerald-500/10 text-emerald-400 font-mono font-bold px-2 py-0.5 rounded-full">
                                          +{difference}
                                        </span>
                                      )}
                                    </td>

                                    {userRole === "owner" && (
                                      <td className={`p-3 text-right font-mono font-medium ${difference < 0 ? "text-rose-455 text-rose-400" : difference > 0 ? "text-emerald-400" : "text-slate-500"}`}>
                                        {valueDiff === 0 ? "$0" : (valueDiff < 0 ? `-$${Math.abs(valueDiff).toLocaleString()}` : `+$${valueDiff.toLocaleString()}`)}
                                      </td>
                                    )}
                                  </tr>
                                );
                              });
                            })()}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>

                  {/* Right Column - Audit Controls (Col span 4) */}
                  <div className="lg:col-span-4 space-y-4">
                    
                    {/* Count Settings Card */}
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-amber-500">
                        {language === "kh" ? "⚙️ បញ្ចប់ការរាប់ និងកែសម្រួលស្តុក" : "⚙️ Close & Reconcile Inventory"}
                      </h4>

                      <div className="space-y-3.5">
                        {/* Period Selector Month */}
                        <div>
                          <label className="block text-slate-400 text-[10px] font-semibold mb-1 uppercase tracking-wider">
                            {language === "kh" ? "ខែសម្រាប់ការរាប់ស្តុក" : "Stock Take Month"}
                          </label>
                          <input
                            type="month"
                            value={stockTakeMonth}
                            onChange={(e) => setStockTakeMonth(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-850 rounded-xl px-3 py-2 text-slate-200 text-xs font-mono focus:outline-none focus:border-amber-500 cursor-pointer"
                          />
                        </div>

                        {/* Counted By display */}
                        <div>
                          <label className="block text-slate-400 text-[10px] font-semibold mb-1 uppercase tracking-wider">
                            {language === "kh" ? "បុគ្គលិករាប់ស្តុក" : "Counted By"}
                          </label>
                          <div className="w-full bg-slate-950 border border-slate-850 rounded-xl px-3 py-2 text-slate-300 text-xs">
                            👑 {userName || "Owner (Kunthy)"}
                          </div>
                        </div>

                        {/* Notes field */}
                        <div>
                          <label className="block text-slate-400 text-[10px] font-semibold mb-1 uppercase tracking-wider">
                            {language === "kh" ? "កំណត់ចំណាំ" : "Session Notes"}
                          </label>
                          <textarea
                            placeholder={language === "kh" ? "បញ្ចូលកំណត់ចំណាំសម្រាប់ការរាប់ស្តុកនេះ (ឧទាហរណ៍៖ ស្តុករាប់ចុងខែ)..." : "Enter notes for this audit (e.g. final inventory check)..."}
                            value={stockTakeNotes}
                            onChange={(e) => setStockTakeNotes(e.target.value)}
                            rows={3}
                            className="w-full bg-slate-950 border border-slate-850 rounded-xl px-3 py-2 text-slate-200 text-xs focus:outline-none focus:border-amber-500 resize-none font-sans"
                          />
                        </div>
                      </div>

                      {/* Shortcuts block */}
                      <div className="pt-2 border-t border-slate-850 space-y-2 font-sans">
                        <span className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                          {language === "kh" ? "ផ្លូវកាត់បំពេញទិន្នន័យ" : "Quick Fill Shortcuts"}
                        </span>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => handleInitializePhysicalCounts("system")}
                            className="py-1.5 px-2.5 bg-slate-950 hover:bg-slate-850 border border-slate-850/80 rounded-lg text-[10px] text-amber-500 hover:text-amber-400 font-bold transition cursor-pointer"
                          >
                            {language === "kh" ? "ចម្លងស្តុកប្រព័ន្ធ" : "Copy System Stock"}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleInitializePhysicalCounts("zero")}
                            className="py-1.5 px-2.5 bg-slate-950 hover:bg-slate-850 border border-slate-850/80 rounded-lg text-[10px] text-slate-400 hover:text-slate-350 font-bold transition cursor-pointer"
                          >
                            {language === "kh" ? "កំណត់ទៅសូន្យ" : "Set to Zero"}
                          </button>
                        </div>
                      </div>

                      {/* Complete CTA Button */}
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm(language === "kh" 
                            ? "តើអ្នកចង់រក្សាទុកការរាប់ស្តុកនេះ និងកែសម្រួលស្តុកក្នុងប្រព័ន្ធអោយត្រូវគ្នានឹងចំនួនពិតប្រាកដមែនទេ?" 
                            : "Are you sure you want to finalize this stock take? This will overwrite system inventory counts to match physical counts."
                          )) {
                            handleCompleteStockTake();
                          }
                        }}
                        className="w-full bg-amber-500 hover:bg-amber-450 text-slate-950 font-bold text-xs py-3 rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-lg active:scale-[0.99] transition-all"
                      >
                        <Check size={14} className="stroke-[2.5]" />
                        <span>{language === "kh" ? "សម្រួល និងធ្វើបច្ចុប្បន្នភាពស្តុក" : "Finalize & Update Inventory"}</span>
                      </button>
                    </div>

                  </div>
                </div>
              )}

              {/* 5. HISTORICAL STOCK TAKES SECTION */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
                <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-amber-500 flex items-center gap-1.5">
                    <History size={14} />
                    <span>{language === "kh" ? "ប្រវត្តិនៃការរាប់ស្តុកប្រចាំខែ" : "Historical Stock Take Audit Logs"}</span>
                  </h4>
                </div>

                {(!shopData.stockTakes || shopData.stockTakes.length === 0) ? (
                  <p className="text-xs text-slate-500 py-6 text-center">
                    {language === "kh" ? "មិនទាន់មានប្រវត្តិនៃការសម្រួលរាប់ស្តុកពីមុនមកទេ" : "No historical stock count audits recorded yet."}
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-slate-950 border-b border-slate-850 text-slate-400 font-semibold uppercase tracking-wider">
                          <th className="p-3">{language === "kh" ? "លេខយោង ID" : "Audit ID"}</th>
                          <th className="p-3">{language === "kh" ? "ខែសម្រាប់ការរាប់" : "Period Month"}</th>
                          <th className="p-3">{language === "kh" ? "កាលបរិច្ឆេទ" : "Date Counted"}</th>
                          <th className="p-3 text-center">{language === "kh" ? "ស្តុកក្នុងប្រព័ន្ធ" : "System Stock"}</th>
                          <th className="p-3 text-center">{language === "kh" ? "ស្តុករាប់ពិតប្រាកដ" : "Counted Physical"}</th>
                          <th className="p-3 text-center">{language === "kh" ? "ភាពលម្អៀង" : "Discrepant Models"}</th>
                          <th className="p-3 text-right">{language === "kh" ? "ផលប៉ះពាល់" : "Financial Impact"}</th>
                          <th className="p-3 text-center">{language === "kh" ? "សកម្មភាព" : "Actions"}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-850">
                        {shopData.stockTakes.map((s) => (
                          <tr key={s.id} className="hover:bg-slate-950/40">
                            <td className="p-3 font-mono font-bold text-amber-500">{s.id}</td>
                            <td className="p-3 font-mono font-bold text-slate-200">{s.periodKey}</td>
                            <td className="p-3 text-slate-400">{s.dateCounted}</td>
                            <td className="p-3 text-center font-mono text-slate-350">{s.totalSystemStock}</td>
                            <td className="p-3 text-center font-mono text-slate-350">{s.totalPhysicalStock}</td>
                            <td className="p-3 text-center">
                              {s.totalDiscrepancies === 0 ? (
                                <span className="text-emerald-400 text-[11px] font-semibold">{language === "kh" ? "គ្មានលម្អៀង" : "No discrepancies"}</span>
                              ) : (
                                <span className="inline-flex text-[10px] bg-rose-500/10 text-rose-455 text-rose-400 font-bold px-2 py-0.5 rounded-full font-sans">
                                  {s.totalDiscrepancies} {language === "kh" ? "ម៉ូដែល" : "models"}
                                </span>
                              )}
                            </td>
                            <td className={`p-3 text-right font-mono font-bold ${s.totalValueDifference < 0 ? "text-rose-455 text-rose-400" : s.totalValueDifference > 0 ? "text-emerald-400" : "text-slate-400"}`}>
                              {s.totalValueDifference === 0 ? "$0" : (s.totalValueDifference < 0 ? `-$${Math.abs(s.totalValueDifference).toLocaleString()}` : `+$${s.totalValueDifference.toLocaleString()}`)}
                            </td>
                            <td className="p-3 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => setSelectedStockTakeId(s.id)}
                                  className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-bold rounded-lg transition cursor-pointer"
                                >
                                  {language === "kh" ? "មើលលម្អិត" : "Details"}
                                </button>
                                {userRole === "owner" && (
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteStockTake(s.id)}
                                    className="p-1 hover:bg-rose-500/10 text-rose-400 border border-transparent hover:border-rose-500/10 rounded-lg transition cursor-pointer"
                                    title="Delete stock take record"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

            </div>
          )}
        </div>
      )}

            {/* 3. SALES & INVENTORY DEDUCTION VIEW */}
            {activeTab === "sales" && (
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
                
                {/* Sale input form (Left panel) */}
                {!isSaleFormCollapsed && (
                  <div className="xl:col-span-4 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4 transition-all duration-300">
                  <h3 className="text-sm font-bold text-slate-100 pb-3 border-b border-slate-800 flex items-center gap-2 font-serif">
                    <TrendingUp size={16} className="text-amber-500" />
                    {language === "kh" ? "កត់ត្រាការលក់ថ្មី (New Watch Sale)" : "Record New Sale (Deduct Stock)"}
                  </h3>
                  
                  {userRole !== "owner" && userRole !== "staff" ? (
                    <div className="py-6 text-center text-slate-500 text-xs font-sans">
                      {language === "kh" ? "អ្នកគ្មានសិទ្ធិកត់ត្រាការលក់ទេ។" : "You do not have permission to record sales."}
                    </div>
                  ) : (
                    <form onSubmit={handleAddNewSale} className="space-y-4 font-sans">
                      
                      {/* CARD 1: 📦 ព័ត៌មាននាឡិកាដៃ និងតម្លៃ (Product & Pricing) */}
                      <div className="space-y-4 bg-slate-950/20 p-4 rounded-xl border border-slate-850/60">
                        <h4 className="text-[10px] font-bold text-amber-500 uppercase tracking-wider pb-1 border-b border-slate-850 flex items-center gap-1.5">
                          <span>📦</span>
                          {language === "kh" ? "ព័ត៌មានទំនិញ & តម្លៃលក់" : "Product & Pricing"}
                        </h4>

                        <div>
                          <label className="block text-slate-400 text-[11px] font-semibold mb-1.5 uppercase tracking-wide">
                            {language === "kh" ? "ជ្រើសរើសនាឡិកាដៃលក់ *" : "Select Watch to Sell *"}
                          </label>
                          
                          {/* 🔍 Watch Search Input and Suggestions */}
                          <div className="mb-2 relative">
                            <div className="relative">
                              <input
                                type="text"
                                placeholder={language === "kh" ? "🔍 វាយដើម្បីស្វែងរកនាឡិកា..." : "🔍 Search watch..."}
                                value={saleWatchSearchQuery}
                                onChange={(e) => setSaleWatchSearchQuery(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-850 focus:border-amber-500 rounded-lg py-1.5 px-2.5 pl-7 text-slate-100 text-xs focus:outline-none transition-all font-sans"
                              />
                              {saleWatchSearchQuery && (
                                <button
                                  type="button"
                                  onClick={() => setSaleWatchSearchQuery("")}
                                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 text-xs"
                                >
                                  ✕
                                </button>
                              )}
                            </div>
                            
                            {/* Suggestion list overlay */}
                            {saleWatchSearchQuery.trim() !== "" && (
                              <div className="absolute left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-slate-950 border border-slate-800 rounded-lg divide-y divide-slate-900 shadow-2xl z-30 scrollbar-thin">
                                {(() => {
                                  const query = saleWatchSearchQuery.toLowerCase().trim();
                                  const matches = shopData.watches.filter(w => 
                                    w.brand.toLowerCase().includes(query) ||
                                    w.model.toLowerCase().includes(query) ||
                                    w.color.toLowerCase().includes(query) ||
                                    w.id.toLowerCase().includes(query)
                                  );
                                  
                                  if (matches.length === 0) {
                                    return (
                                      <div className="p-3 text-center text-slate-500 text-xs">
                                        {language === "kh" ? "រកមិនឃើញនាឡិកាទេ" : "No watches found"}
                                      </div>
                                    );
                                  }
                                  
                                  return matches.map(w => (
                                    <button
                                      key={w.id}
                                      type="button"
                                      onClick={() => {
                                        setSelectedWatchId(w.id);
                                        setCustomSellPrice(w.sellPrice);
                                        setCustomSellPriceKHR(Math.round(w.sellPrice * (shopData.exchangeRate || 4100)));
                                        setSaleWatchSearchQuery(""); // clear search
                                      }}
                                      className="w-full text-left p-2.5 hover:bg-slate-850 transition-colors text-xs flex items-center justify-between cursor-pointer"
                                    >
                                      <div>
                                        <span className="font-bold text-amber-500">{w.brand}</span> - <span>{w.model}</span> <span className="text-slate-400 text-[10px]">({w.color})</span>
                                        <div className="text-[10px] text-slate-500">កូដ: {w.id}</div>
                                      </div>
                                      <div className="text-right">
                                        <div className="text-emerald-400 font-bold font-mono">${w.sellPrice}</div>
                                        <div className="text-[9px] text-slate-400">ស្តុក: {w.stock} គ្រឿង</div>
                                      </div>
                                    </button>
                                  ));
                                })()}
                              </div>
                            )}
                          </div>

                          <div className="flex gap-2 min-w-0 w-full">
                            <select
                              id="sale-watch-select"
                              required
                              value={selectedWatchId}
                              onChange={(e) => {
                                setSelectedWatchId(e.target.value);
                                const w = shopData.watches.find((wt) => wt.id === e.target.value);
                                if (w) {
                                  setCustomSellPrice(w.sellPrice);
                                  setCustomSellPriceKHR(Math.round(w.sellPrice * (shopData.exchangeRate || 4100)));
                                } else {
                                  setCustomSellPrice("");
                                  setCustomSellPriceKHR("");
                                }
                              }}
                              className="flex-1 min-w-0 w-full bg-slate-950 border border-slate-850 focus:border-amber-500 rounded-lg py-2 px-3 text-slate-100 text-xs focus:outline-none transition-all cursor-pointer font-sans truncate"
                            >
                              <option value="">-- {language === "kh" ? "ជ្រើសរើសនាឡិកា" : "Choose Watch"} --</option>
                              {shopData.watches.map((w) => (
                                <option key={w.id} value={w.id} disabled={w.stock <= 0}>
                                  {w.brand} - {w.model} ({w.color}) [ស្តុក: {w.stock} គ្រឿង]
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={() => setIsQRModalOpenForSale(true)}
                              className="bg-slate-850 hover:bg-slate-800 text-amber-500 border border-slate-850 rounded-lg px-3 py-2 text-xs transition-all flex items-center justify-center gap-1 shrink-0 cursor-pointer shadow-sm font-sans"
                              title={language === "kh" ? "ស្កេន QR នាឡិកា" : "Scan Watch QR"}
                            >
                              <QrCode size={13} />
                              <span>{language === "kh" ? "ស្កេន" : "Scan"}</span>
                            </button>
                          </div>
                          
                          {/* ពណ៌ទំនិញលក់ចេញ (Color Specific for Sale) */}
                          <div className="space-y-1.5 mt-2.5">
                            <label className="block text-slate-400 text-[11px] font-semibold mb-1 uppercase tracking-wide">
                              {language === "kh" ? "ពណ៌ទំនិញលក់ចេញ (Color Specific for Sale)" : "Color Specific for Sale"}
                            </label>

                            {selectedWatchId && (() => {
                              const selectedWatchObj = shopData.watches.find(w => w.id === selectedWatchId);
                              const parsedColors = selectedWatchObj && selectedWatchObj.color 
                                ? selectedWatchObj.color.split(/[,/|、]+/).map(c => c.trim()).filter(Boolean) 
                                : [];
                              if (parsedColors.length <= 1) return null;
                              return (
                                <div className="space-y-1 mb-2 animate-in fade-in duration-200">
                                  <span className="text-[10px] text-slate-400 font-medium block">
                                    👉 {language === "kh" ? "ជ្រើសរើសពណ៌លក់ចេញយ៉ាងរហ័ស៖" : "Quickly select sale color:"}
                                  </span>
                                  <div className="flex flex-wrap gap-1">
                                    {parsedColors.map((col) => {
                                      const isSelected = saleWatchColor.toLowerCase().trim() === col.toLowerCase().trim();
                                      return (
                                        <button
                                          key={col}
                                          type="button"
                                          onClick={() => setSaleWatchColor(col)}
                                          className={`px-2 py-0.5 text-[10px] rounded-md border font-semibold transition-all cursor-pointer ${
                                            isSelected
                                              ? "bg-amber-500 text-slate-950 border-amber-500 shadow-sm font-bold scale-[1.03]"
                                              : "bg-slate-900 hover:bg-slate-850 text-slate-300 border-slate-800 hover:border-slate-700"
                                          }`}
                                        >
                                          {col}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })()}

                            <input
                              type="text"
                              value={saleWatchColor}
                              onChange={(e) => setSaleWatchColor(e.target.value)}
                              placeholder={language === "kh" ? "ឧ. ខ្មៅ, ស, ទឹកមាស..." : "e.g., Black, White, Gold..."}
                              className="w-full bg-slate-950 border border-slate-850 focus:border-amber-500 rounded-lg py-1.5 px-3 text-slate-100 text-xs focus:outline-none transition-all font-sans"
                            />
                            <p className="text-[10px] text-slate-500">
                              ✓ {language === "kh" ? "បំពេញស្វ័យប្រវត្តិតាមពណ៌ដើមរបស់ទំនិញ ប៉ុន្តែអ្នកអាចកែប្រែបានទៅតាមតម្រូវការ" : "Autofills with the item's original color, but you can edit it as needed"}
                            </p>
                          </div>
                        </div>

                          <div className="grid grid-cols-2 gap-2.5">
                            <div>
                              <label className="block text-slate-400 text-[11px] font-semibold mb-1 uppercase tracking-wide">
                                {language === "kh" ? "បរិមាណ (QTY) *" : "Quantity *"}
                              </label>
                              <input
                                id="sale-qty"
                                type="number"
                                required
                                min="1"
                                value={saleQuantity}
                                onChange={(e) => setSaleQuantity(e.target.value !== "" ? Number(e.target.value) : "")}
                                placeholder="1"
                                className="w-full bg-slate-950 border border-slate-850 focus:border-amber-500 rounded-lg py-1.5 px-3 text-slate-100 text-xs focus:outline-none transition-all font-mono font-bold"
                              />
                            </div>
                            <div>
                              <label className="block text-slate-400 text-[11px] font-semibold mb-1 uppercase tracking-wide">
                                {language === "kh" ? "បញ្ចុះតម្លៃ %" : "Discount %"}
                              </label>
                              <input
                                id="sale-discount"
                                type="number"
                                min="0"
                                max="100"
                                value={saleDiscountPercent}
                                onChange={(e) => setSaleDiscountPercent(e.target.value !== "" ? Number(e.target.value) : "")}
                                placeholder="0"
                                className="w-full bg-slate-950 border border-slate-850 focus:border-amber-500 rounded-lg py-1.5 px-3 text-slate-100 text-xs focus:outline-none transition-all font-mono"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2.5">
                            <div>
                              <label className="block text-slate-400 text-[11px] font-semibold mb-1 uppercase tracking-wide">
                                {language === "kh" ? "តម្លៃ USD ($)" : "Price USD ($)"}
                              </label>
                              <input
                                id="sale-price"
                                type="number"
                                value={customSellPrice}
                                onChange={(e) => handleUSDPriceChange(e.target.value)}
                                placeholder="0"
                                className="w-full bg-slate-950 border border-slate-850 focus:border-amber-500 rounded-lg py-1.5 px-3 text-slate-100 text-xs focus:outline-none transition-all font-mono font-bold text-amber-500"
                              />
                            </div>
                            <div>
                              <label className="block text-slate-400 text-[11px] font-semibold mb-1 uppercase tracking-wide">
                                {language === "kh" ? "តម្លៃ KHR (៛)" : "Price KHR (៛)"}
                              </label>
                              <input
                                id="sale-price-khr"
                                type="number"
                                value={customSellPriceKHR}
                                onChange={(e) => handleKHRPriceChange(e.target.value)}
                                placeholder="0"
                                className="w-full bg-slate-950 border border-slate-850 focus:border-amber-500 rounded-lg py-1.5 px-3 text-slate-100 text-xs focus:outline-none transition-all font-mono font-bold text-amber-500"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                            {/* Deduct Stock Select Buttons */}
                            <div>
                              <label className="block text-slate-400 text-[10px] font-semibold mb-1.5 uppercase tracking-wide">
                                {language === "kh" ? "កាត់ស្តុកពីកញ្ចប់ (Deduct Stock) *" : "Deduct Stock *"}
                              </label>
                              {(() => {
                                const w = shopData.watches.find((wt) => wt.id === selectedWatchId);
                                const totalS = w ? w.stock : 0;
                                const oldStock = w ? (w.oldStock !== undefined ? w.oldStock : w.stock) : 0;
                                const newStock = w ? (w.newStock !== undefined ? w.newStock : 0) : 0;

                                return (
                                  <div className="grid grid-cols-3 gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => setSaleStockType("auto")}
                                      className={`py-1.5 px-0.5 rounded-lg text-[9px] font-bold border flex flex-col items-center justify-center gap-0.5 transition-all cursor-pointer ${
                                        saleStockType === "auto"
                                          ? "bg-amber-500/15 border-amber-500 text-amber-500"
                                          : "bg-slate-950 border-slate-850 text-slate-450 hover:border-slate-700"
                                      }`}
                                    >
                                      <span>🔄 Auto</span>
                                      <span className="text-[8px] opacity-75 font-mono">({totalS})</span>
                                    </button>
                                    
                                    <button
                                      type="button"
                                      onClick={() => setSaleStockType("old")}
                                      className={`py-1.5 px-0.5 rounded-lg text-[9px] font-bold border flex flex-col items-center justify-center gap-0.5 transition-all cursor-pointer ${
                                        saleStockType === "old"
                                          ? "bg-amber-500/15 border-amber-500 text-amber-500"
                                          : "bg-slate-950 border-slate-850 text-slate-450 hover:border-slate-700"
                                      }`}
                                    >
                                      <span>📦 {language === "kh" ? "ចាស់" : "Old"}</span>
                                      <span className="text-[8px] opacity-75 font-mono">({oldStock})</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setSaleStockType("new")}
                                      className={`py-1.5 px-0.5 rounded-lg text-[9px] font-bold border flex flex-col items-center justify-center gap-0.5 transition-all cursor-pointer ${
                                        saleStockType === "new"
                                          ? "bg-amber-500/15 border-amber-500 text-amber-500"
                                          : "bg-slate-950 border-slate-850 text-slate-450 hover:border-slate-700"
                                      }`}
                                    >
                                      <span>✨ {language === "kh" ? "ថ្មី" : "New"}</span>
                                      <span className="text-[8px] opacity-75 font-mono text-emerald-500">({newStock})</span>
                                    </button>
                                  </div>
                                );
                              })()}
                            </div>

                            {/* Sale Channel Select Buttons */}
                            <div>
                              <label className="block text-slate-400 text-[10px] font-semibold mb-1.5 uppercase tracking-wide">
                                {language === "kh" ? "ប្រភពលក់ (Sales Channel) *" : "Sales Channel *"}
                              </label>
                              <div className="grid grid-cols-2 gap-2">
                                <button
                                  type="button"
                                  onClick={() => setSaleChannel("instore")}
                                  className={`py-2 px-1.5 rounded-lg text-[10px] font-bold border flex items-center justify-center gap-1 transition-all cursor-pointer ${
                                    saleChannel === "instore"
                                      ? "bg-amber-500/15 border-amber-500 text-amber-500"
                                      : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                                  }`}
                                >
                                  <span>🏪</span>
                                  <span>{language === "kh" ? "លក់នៅហាង" : "In-store"}</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setSaleChannel("online")}
                                  className={`py-2 px-1.5 rounded-lg text-[10px] font-bold border flex items-center justify-center gap-1 transition-all cursor-pointer ${
                                    saleChannel === "online"
                                      ? "bg-amber-500/15 border-amber-500 text-amber-500"
                                      : "bg-slate-950 border-slate-800 text-slate-450 hover:border-slate-700"
                                  }`}
                                >
                                  <span>🌐</span>
                                  <span>Online</span>
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* Pre-calculations preview inside POS form */}
                          {selectedWatchId && (
                            <div className="bg-slate-950/40 border border-slate-850 p-3 rounded-xl space-y-1.5 font-sans">
                              <span className="text-[10px] text-slate-500 block uppercase font-bold tracking-wider">
                                {language === "kh" ? "ការគណនាស្វ័យប្រវត្ត" : "Order Summary"}
                              </span>
                              {(() => {
                                const w = shopData.watches.find((wt) => wt.id === selectedWatchId);
                                if (!w) return null;
                                const finalPrice = customSellPrice !== "" ? Number(customSellPrice) : w.sellPrice;
                                const qty = Number(saleQuantity) || 0;
                                const rawTotal = finalPrice * qty;
                                const discountPercent = Number(saleDiscountPercent || 0);
                                const discountAmount = rawTotal * (discountPercent / 100);
                                const finalTotal = rawTotal - discountAmount;

                                return (
                                  <div className="text-[11px] space-y-1">
                                    <div className="flex justify-between text-slate-400">
                                      <span>{language === "kh" ? "តម្លៃដើម (Cost)" : "Cost Price"}</span>
                                      <span>${w.costPrice.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between text-slate-400">
                                      <span>{language === "kh" ? "តម្លៃលក់ (Subtotal)" : "Subtotal"}</span>
                                      <span>${rawTotal.toLocaleString()}</span>
                                    </div>
                                    {discountPercent > 0 && (
                                      <div className="flex justify-between text-rose-400">
                                        <span>{language === "kh" ? "បញ្ចុះតម្លៃ" : "Discount"} ({discountPercent}%)</span>
                                        <span>-${discountAmount.toLocaleString()}</span>
                                      </div>
                                    )}
                                    <div className="flex justify-between text-slate-300 border-t border-slate-850/60 pt-1.5 mt-1">
                                      <span className="font-bold text-emerald-400">{language === "kh" ? "សរុបប្រាក់ត្រូវបង់" : "Total Due"}</span>
                                      <span className="font-bold text-emerald-400">${finalTotal.toLocaleString()}</span>
                                    </div>
                                  </div>
                                );
                              })()}
                            </div>
                          )}
                        </div>

                        {/* COLUMN 2: 💳 វិធីទូទាត់ និងគណនាប្រាក់អាប់ (Payment & Cashier) */}
                        <div className="space-y-4 bg-slate-950/20 p-4 rounded-xl border border-slate-850/60">
                          <h4 className="text-[10px] font-bold text-amber-500 uppercase tracking-wider pb-1 border-b border-slate-850 flex items-center gap-1.5">
                            <span>💳</span>
                            {language === "kh" ? "វិធីទូទាត់ & គណនាប្រាក់អាប់" : "Payment & Cashier"}
                          </h4>

                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-slate-400 text-[10px] font-semibold mb-1 uppercase tracking-wide">
                                {language === "kh" ? "រូបិយប័ណ្ណទូទាត់ *" : "Currency *"}
                              </label>
                              <div className="grid grid-cols-2 gap-1 bg-slate-950 p-1 border border-slate-850 rounded-lg">
                                <button
                                  type="button"
                                  onClick={() => setPaymentCurrency("USD")}
                                  className={`py-1 rounded text-[10px] font-bold text-center cursor-pointer transition-all ${
                                    paymentCurrency === "USD" ? "bg-amber-500 text-slate-950 font-bold" : "text-slate-400 hover:text-slate-200"
                                  }`}
                                >
                                  USD ($)
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setPaymentCurrency("KHR")}
                                  className={`py-1 rounded text-[10px] font-bold text-center cursor-pointer transition-all ${
                                    paymentCurrency === "KHR" ? "bg-amber-500 text-slate-950 font-bold" : "text-slate-400 hover:text-slate-200"
                                  }`}
                                >
                                  KHR (៛)
                                </button>
                              </div>
                            </div>
                            <div className="opacity-0 pointer-events-none"></div>
                          </div>

                          <div>
                            <label className="block text-slate-400 text-[11px] font-semibold mb-1.5 uppercase tracking-wide">
                              {language === "kh" ? "គណនី/វិធីបង់ប្រាក់ *" : "Account/Payment Method *"}
                            </label>
                            <select
                              id="sale-payment-method-select"
                              value={sellPaymentMethod}
                              onChange={(e) => {
                                setSellPaymentMethod(e.target.value as any);
                                setReceivedCashAmount("");
                              }}
                              className="w-full bg-slate-950 border border-slate-850 hover:border-slate-755 focus:border-amber-500 rounded-xl py-3 px-3.5 text-slate-100 text-xs font-semibold focus:outline-none transition-all cursor-pointer font-sans"
                            >
                              <option value="cash">Cash On Hand</option>
                              <option value="aba">ABA Bank</option>
                              <option value="acleda">ACLEDA Bank</option>
                              <option value="cod">Cash on Delivery</option>
                            </select>
                          </div>

                          {/* Cash Change Calculator (គណនាប្រាក់អាប់) */}
                          {sellPaymentMethod === "cash" && (
                            <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-850 space-y-3 animate-in fade-in duration-200">
                              <span className="text-[10px] font-bold text-amber-500 uppercase tracking-widest block">
                                💵 {language === "kh" ? "គណនាប្រាក់អាប់" : "Change Calculator"}
                              </span>
                              
                              {(() => {
                                const w = shopData.watches.find((wt) => wt.id === selectedWatchId);
                                if (!w) return null;
                                const finalPrice = customSellPrice !== "" ? Number(customSellPrice) : w.sellPrice;
                                const qty = Number(saleQuantity) || 0;
                                const rawTotal = finalPrice * qty;
                                const discountPercent = Number(saleDiscountPercent || 0);
                                const discountAmount = rawTotal * (discountPercent / 100);
                                const finalTotal = rawTotal - discountAmount;

                                const entered = receivedCashAmount !== "" ? Number(receivedCashAmount) : 0;
                                const rate = shopData.exchangeRate || 4100;

                                // Final total in selected payment currency
                                const finalTotalSelectedCurrency = paymentCurrency === "USD" ? finalTotal : Math.round(finalTotal * rate);
                                
                                let changeUSD = 0;
                                let changeKHR = 0;
                                if (entered > 0) {
                                  if (paymentCurrency === "USD") {
                                    changeUSD = Math.max(0, entered - finalTotal);
                                    changeKHR = Math.round(changeUSD * rate);
                                  } else {
                                    const enteredInUSD = entered / rate;
                                    changeUSD = Math.max(0, enteredInUSD - finalTotal);
                                    changeKHR = Math.round(changeUSD * rate);
                                  }
                                }

                                const isShort = entered > 0 && (paymentCurrency === "USD" ? entered < finalTotal : entered < Math.round(finalTotal * rate));

                                return (
                                  <div className="bg-slate-950/80 rounded-xl border border-slate-850/60 overflow-hidden grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-850/60">
                                    {/* COLUMN 1: ថ្លៃទំនិញសរុប (Total Cost) */}
                                    <div className="p-3.5 flex flex-col justify-between">
                                      <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">
                                        {language === "kh" ? "ថ្លៃលក់សរុប" : "Total Sale Amount"}
                                      </span>
                                      <div className="mt-1.5 space-y-0.5">
                                        {paymentCurrency === "USD" ? (
                                          <>
                                            <div className="text-sm font-extrabold font-mono text-slate-100">${finalTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                                            <div className="text-[10px] text-slate-500 font-mono">≈ ៛{Math.round(finalTotal * rate).toLocaleString()}</div>
                                          </>
                                        ) : (
                                          <>
                                            <div className="text-sm font-extrabold font-mono text-slate-100">៛{Math.round(finalTotal * rate).toLocaleString()}</div>
                                            <div className="text-[10px] text-slate-500 font-mono">≈ ${finalTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                                          </>
                                        )}
                                      </div>
                                    </div>

                                    {/* COLUMN 2: ប្រាក់ទទួលពីអតិថិជន (Received) */}
                                    <div className="p-3.5 flex flex-col justify-between">
                                      <label className="block text-slate-400 text-[9px] font-bold uppercase tracking-wider mb-1.5">
                                        {language === "kh" ? "ប្រាក់ទទួលពីភ្ញៀវ" : "Cash Received"}
                                      </label>
                                      <div className="relative">
                                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold font-mono">
                                          {paymentCurrency === "USD" ? "$" : "៛"}
                                        </span>
                                        <input
                                          type="number"
                                          min={0}
                                          step="any"
                                          value={receivedCashAmount}
                                          onChange={(e) => setReceivedCashAmount(e.target.value === "" ? "" : Number(e.target.value))}
                                          placeholder={paymentCurrency === "USD" ? "0.00" : "0"}
                                          className="w-full bg-slate-950/80 border border-slate-800 focus:border-amber-500 rounded-lg py-1.5 pl-7 pr-2.5 text-slate-100 text-xs font-mono font-bold focus:outline-none"
                                        />
                                      </div>
                                      {entered > 0 && (
                                        <div className="text-[9px] text-slate-500 font-mono mt-1">
                                          {paymentCurrency === "USD" ? (
                                            `≈ ៛${Math.round(entered * rate).toLocaleString()}`
                                          ) : (
                                            `≈ $${(entered / rate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                          )}
                                        </div>
                                      )}
                                    </div>

                                    {/* COLUMN 3: ប្រាក់ត្រូវអាប់ (Change back) */}
                                    <div className="p-3.5 flex flex-col justify-between">
                                      <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">
                                        {language === "kh" ? "ប្រាក់ត្រូវអាប់ជូន" : "Change to Return"}
                                      </span>
                                      <div className="mt-1.5">
                                        {entered === 0 ? (
                                          <div className="text-[10px] text-slate-500 font-sans italic">
                                            {language === "kh" ? "រង់ចាំការបញ្ចូលប្រាក់" : "Awaiting input"}
                                          </div>
                                        ) : isShort ? (
                                          <div className="text-[10px] text-rose-450 font-bold bg-rose-500/10 px-1.5 py-0.5 rounded border border-rose-500/15 text-center animate-pulse">
                                            {language === "kh" ? "ខ្វះខាត" : "Short / Unpaid"}
                                          </div>
                                        ) : (
                                          <div className="space-y-0.5">
                                            <div className="text-sm font-extrabold font-mono text-emerald-400">
                                              ${changeUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </div>
                                            <div className="text-[10px] text-emerald-500 font-mono font-semibold">
                                              ៛{changeKHR.toLocaleString()}
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })()}
                            </div>
                          )}

                          {/* Paid Toggle / Checkbox */}
                          <div className="mt-3 bg-slate-950 border border-slate-850 rounded-xl p-3 flex items-center justify-between animate-in fade-in duration-150">
                            <div className="flex items-center gap-2">
                              <span className={`text-sm ${isSalePaid ? "text-emerald-500" : "text-slate-500"}`}>✓</span>
                                <div className="flex flex-col">
                                  <span className="text-slate-200 text-xs font-bold">
                                    {language === "kh" ? "បានបង់ប្រាក់ (Paid)" : "Paid Status"}
                                  </span>
                                  <span className="text-[9px] text-slate-500">
                                    {language === "kh" ? "ចំណាំស្ថានភាពទូទាត់ក្នុងប្រវត្តិការលក់" : "Record payment status in sales history"}
                                  </span>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => setIsSalePaid(!isSalePaid)}
                                className={`px-3 py-1 rounded-lg text-[10px] font-black border transition-all cursor-pointer ${
                                  isSalePaid 
                                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20" 
                                    : "bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700"
                                }`}
                              >
                                {isSalePaid ? "✓ PAID" : "✗ UNPAID"}
                              </button>
                            </div>

                          {/* Customer Info (Phone & Location) */}
                          <div className="bg-slate-950/40 p-3 rounded-xl border border-slate-850/60 space-y-2 animate-in fade-in duration-150">
                            <span className="text-[9px] font-bold text-amber-500 uppercase tracking-widest block">
                              👤 {language === "kh" ? "ព័ត៌មានអតិថិជន (ទីតាំង & ទូរស័ព្ទ)" : "Customer Information"}
                            </span>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="block text-slate-500 text-[9px] font-semibold mb-0.5 uppercase">
                                  {language === "kh" ? "លេខទូរស័ព្ទ" : "Phone Number"}
                                </label>
                                <input
                                  type="text"
                                  value={saleCustomerPhone}
                                  onChange={(e) => setSaleCustomerPhone(e.target.value)}
                                  placeholder={language === "kh" ? "ឧ. 012345678" : "e.g., 012345678"}
                                  className="w-full bg-slate-950 border border-slate-850 rounded-lg p-1.5 text-slate-100 text-[10px] focus:outline-none focus:border-amber-500 font-mono"
                                />
                              </div>
                              <div>
                                <label className="block text-slate-500 text-[9px] font-semibold mb-0.5 uppercase">
                                  {language === "kh" ? "ទីតាំង/ខេត្ត-ក្រុង" : "Location/Province"}
                                </label>
                                <input
                                  type="text"
                                  value={saleCustomerLocation}
                                  onChange={(e) => setSaleCustomerLocation(e.target.value)}
                                  placeholder={language === "kh" ? "ឧ. ភ្នំពេញ, សៀមរាប" : "e.g., Phnom Penh, Siem Reap"}
                                  className="w-full bg-slate-950 border border-slate-850 rounded-lg p-1.5 text-slate-100 text-[10px] focus:outline-none focus:border-amber-500 font-sans"
                                />
                              </div>
                            </div>
                          </div>

                          {sellPaymentMethod === "cod" && (
                            <div className="bg-slate-950 border border-slate-850 p-3 rounded-xl space-y-2 animate-in fade-in duration-150">
                              <span className="text-[9px] font-bold text-rose-400 uppercase tracking-widest block">
                                🚚 {language === "kh" ? "ព័ត៌មានដឹកជញ្ជូន (COD)" : "Delivery Configuration"}
                              </span>
                              <div className="grid grid-cols-2 gap-2">
                                <select
                                  value={codCarrier}
                                  onChange={(e) => setCodCarrier(e.target.value)}
                                  className="bg-slate-950 border border-slate-850 rounded-lg p-1.5 text-slate-200 text-[10px] focus:outline-none focus:border-rose-500 cursor-pointer font-sans"
                                >
                                  <option value="">— Carrier —</option>
                                  <option value="J&T">J&T Express</option>
                                  <option value="VET">Virak Buntham (VET)</option>
                                  <option value="CamboExpress">Cambo Express</option>
                                  <option value="Capitol">Capitol Tour</option>
                                  <option value="Grab">Grab Delivery</option>
                                  <option value="Other">Other</option>
                                </select>
                                <select
                                  value={codSettlement}
                                  onChange={(e) => setCodSettlement(e.target.value as any)}
                                  className="bg-slate-950 border border-slate-850 rounded-lg p-1.5 text-slate-200 text-[10px] focus:outline-none focus:border-rose-500 cursor-pointer font-sans"
                                >
                                  <option value="cash">💵 Cash on Hand</option>
                                  <option value="aba">🔷 ABA Account</option>
                                  <option value="acleda">🟡 ACLEDA Account</option>
                                  <option value="split">➕ Split / Combined</option>
                                </select>
                              </div>
                              <textarea
                                value={codNotes}
                                onChange={(e) => setCodNotes(e.target.value)}
                                placeholder={language === "kh" ? "សរសេរកំណត់ចំណាំដឹកជញ្ជូនបន្ថែម..." : "Delivery notes..."}
                                className="w-full bg-slate-950 border border-slate-850 rounded-lg p-1.5 text-slate-200 text-[10px] focus:outline-none focus:border-rose-500 h-10 resize-none font-sans"
                              />
                            </div>
                          )}

                          {/* Payment Method Sales Summary */}
                          <div className="mt-4 pt-4 border-t border-slate-850/60 space-y-2.5 font-sans">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block flex items-center gap-1.5">
                              📊 {language === "kh" ? "សរុបប្រាក់លក់ទទួលបានតាមវិធីទូទាត់" : "Payment Method Sales Summary"}
                            </span>
                            <div className="bg-slate-950/45 p-3.5 rounded-xl border border-slate-850/60 space-y-2.5 text-xs">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 text-slate-300">
                                  <span>🟢 💵</span>
                                  <span>{language === "kh" ? "សាច់ប្រាក់សុទ្ធប្រាកដ (Cash in Hand):" : "Cash in Hand:"}</span>
                                </div>
                                <span className="font-mono font-bold text-emerald-400 text-sm">
                                  ${cashSalesTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                              </div>
                              
                              <div className="flex items-center justify-between border-t border-slate-900/40 pt-2.5">
                                <div className="flex items-center gap-2 text-slate-300">
                                  <span>🔵 🏦</span>
                                  <span>{language === "kh" ? "គណនី ABA Bank:" : "ABA Bank:"}</span>
                                </div>
                                <span className="font-mono font-bold text-sky-400 text-sm">
                                  ${abaSalesTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                              </div>

                              <div className="flex items-center justify-between border-t border-slate-900/40 pt-2.5">
                                <div className="flex items-center gap-2 text-slate-300">
                                  <span>🟠 🏦</span>
                                  <span>{language === "kh" ? "គណនី ACLEDA Bank:" : "ACLEDA Bank:"}</span>
                                </div>
                                <span className="font-mono font-bold text-amber-500 text-sm">
                                  ${acledaSalesTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>

                      {saleError && (
                        <div className="p-2.5 bg-rose-500/10 border border-rose-500/25 text-rose-400 text-xs rounded-xl font-medium text-center font-sans">
                          ⚠️ {saleError}
                        </div>
                      )}

                      <button
                        id="save-sale-btn"
                        type="submit"
                        className="w-full bg-amber-500 hover:bg-amber-400 active:scale-[0.99] text-slate-950 font-black py-3 px-4 rounded-xl text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-amber-500/15"
                      >
                        <Check size={15} className="stroke-[3]" />
                        {language === "kh" ? "បញ្ជាក់ការលក់ និងកាត់ស្តុកភ្លាមៗ" : "Confirm Sale & Deduct Stock"}
                      </button>
                    </form>
                  )}
                </div>
                )}

                {/* Sales list (Right panel, 2 cols) */}
                <div className={`${isSaleFormCollapsed ? "xl:col-span-12" : "xl:col-span-8"} bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4 transition-all duration-300`}>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-800 pb-3 gap-2">
                    <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2 font-serif">
                      <History size={16} className="text-amber-500" />
                      {language === "kh" 
                        ? `ប្រវត្តិការលក់ និងចំណេញសរុប ($${displayedSalesProfit.toLocaleString()} ពីការលក់)` 
                        : `Sales History & Total Profit ($${displayedSalesProfit.toLocaleString()})`}
                    </h3>
                    
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => setIsSaleFormCollapsed(!isSaleFormCollapsed)}
                        className="px-3 py-1.5 rounded-xl border border-slate-800 bg-slate-950 hover:bg-slate-850 text-slate-300 hover:text-amber-500 text-[11px] font-black flex items-center gap-1.5 transition-all cursor-pointer shadow-md"
                        title={
                          language === "kh"
                            ? isSaleFormCollapsed ? "បង្ហាញផ្ទាំងបញ្ជាលក់" : "ពង្រីកតារាងពេញ"
                            : isSaleFormCollapsed ? "Show Sale Form" : "Expand Table Full-Width"
                        }
                      >
                        {isSaleFormCollapsed ? (
                          <>
                            <Columns size={12} className="text-amber-500 stroke-[2.5]" />
                            <span>{language === "kh" ? "បង្ហាញផ្ទាំងបញ្ចូល" : "Show Form"}</span>
                          </>
                        ) : (
                          <>
                            <Maximize2 size={12} className="text-amber-500 stroke-[2.5]" />
                            <span>{language === "kh" ? "ពង្រីកពេញ" : "Full Width"}</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Permanently visible Advanced Options for Sales History */}
                  <div className="border-b border-slate-800/60 pb-3.5 space-y-2.5">
                    <div className="flex items-center gap-1.5 text-xs text-amber-500 font-sans font-semibold">
                      <span>⚙️ {language === "kh" ? "ការកំណត់កម្រិតខ្ពស់ (Advanced Options)" : "Advanced Options"}</span>
                    </div>

                    <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-850 space-y-4">
                      {/* Filters Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {/* Channel Filter */}
                        <div>
                          <label className="block text-slate-400 text-[10px] font-semibold mb-1 uppercase tracking-wide">
                            {language === "kh" ? "ប្រភពលក់ (Channel)" : "Sales Channel"}
                          </label>
                          <select
                            value={salesChannelFilter}
                            onChange={(e) => setSalesChannelFilter(e.target.value as any)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg py-1.5 px-2.5 text-slate-100 text-xs focus:outline-none"
                          >
                            <option value="all">📁 {language === "kh" ? "ទាំងអស់" : "All"}</option>
                            <option value="online">🌐 {language === "kh" ? "លក់ Online" : "Online"}</option>
                            <option value="instore">🏪 {language === "kh" ? "លក់នៅហាង" : "In-Store"}</option>
                          </select>
                        </div>

                        {/* Payment Method Filter */}
                        <div>
                          <label className="block text-slate-400 text-[10px] font-semibold mb-1 uppercase tracking-wide">
                            {language === "kh" ? "វិធីសាស្ត្រទូទាត់" : "Payment Method"}
                          </label>
                          <select
                            value={salesPaymentMethodFilter}
                            onChange={(e) => setSalesPaymentMethodFilter(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg py-1.5 px-2.5 text-slate-100 text-xs focus:outline-none"
                          >
                            <option value="all">📁 {language === "kh" ? "ទាំងអស់" : "All"}</option>
                            <option value="cash">Cash On Hand</option>
                            <option value="aba">ABA Bank</option>
                            <option value="acleda">ACLEDA Bank</option>
                            <option value="cod">Cash on Delivery</option>
                          </select>
                        </div>

                        {/* Payment Status Filter */}
                        <div>
                          <label className="block text-slate-400 text-[10px] font-semibold mb-1 uppercase tracking-wide">
                            {language === "kh" ? "ស្ថានភាពទូទាត់" : "Payment Status"}
                          </label>
                          <select
                            value={salesPaymentStatusFilter}
                            onChange={(e) => setSalesPaymentStatusFilter(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg py-1.5 px-2.5 text-slate-100 text-xs focus:outline-none"
                          >
                            <option value="all">📁 {language === "kh" ? "ទាំងអស់" : "All"}</option>
                            <option value="paid">✓ {language === "kh" ? "បានបង់ (Paid)" : "Paid"}</option>
                            <option value="unpaid">✗ {language === "kh" ? "មិនទាន់បង់ (Unpaid)" : "Unpaid"}</option>
                          </select>
                        </div>
                      </div>

                      {/* Action Buttons (Tucked inside Advanced Options!) */}
                      {userRole === "owner" && (
                        <div className="pt-3.5 border-t border-slate-850 flex flex-wrap items-center gap-2">
                          <button
                            id="clear-sales-btn"
                            type="button"
                            onClick={handleClearMonthlySales}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white font-bold text-[10px] rounded-lg transition-all cursor-pointer shadow-lg shadow-rose-600/10 hover:scale-[1.02] active:scale-[0.98]"
                            title={language === "kh" ? "សម្អាតទិន្នន័យលក់ប្រចាំខែដើម្បីលក់ខែថ្មី" : "Clear monthly sales to start a new sales month"}
                          >
                            <Trash2 size={12} className="stroke-[2.5]" />
                            {language === "kh" ? "សម្អាតទិន្នន័យលក់ខែនេះ" : "Clear Monthly Sales"}
                          </button>
                          <button
                            id="export-sales-csv-btn"
                            type="button"
                            onClick={handleExportSalesToCSV}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-slate-950 font-bold text-[10px] rounded-lg transition-all cursor-pointer shadow-lg shadow-emerald-500/10 hover:scale-[1.02] active:scale-[0.98]"
                          >
                            <FileSpreadsheet size={12} className="stroke-[2.5]" />
                            {language === "kh" ? "នាំចេញជា CSV" : "Export CSV"}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Table container */}
                  {(() => {
                    const filteredSales = displayedSales;

                    return filteredSales.length === 0 ? (
                      <div className="py-12 text-center text-slate-500 text-xs font-sans">
                        {language === "kh" ? "មិនទាន់មានកំណត់ត្រាការលក់នៅឡើយទេ។" : "No sales records found."}
                      </div>
                    ) : (
                      <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/20">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead className="bg-slate-950">
                            <tr className="text-slate-400 border-b border-slate-850">
                              <th className="p-3 font-medium">កាលបរិច្ឆេទ</th>
                              <th className="p-3 font-medium">នាឡិកា (Brand/Model)</th>
                              <th className="p-3 font-medium text-center">ចំនួន</th>
                              <th className="p-3 font-medium text-right">តម្លៃលក់</th>
                              <th className="p-3 font-medium text-right">សរុបប្រាក់</th>
                              <th className="p-3 font-medium text-center">វិធីទូទាត់</th>
                              <th className="p-3 font-medium text-center">ស្ថានភាព</th>
                              <th className="p-3 font-medium text-right">ចំណេញ</th>
                              <th className="p-3 font-medium text-center">សកម្មភាព</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-850 bg-slate-900/20 font-sans">
                            {filteredSales.slice().reverse().map((sale) => {
                              const isPaid = sale.isPaid !== false;
                              let paymentMethodDisplay = sale.paymentMethod || "Cash On Hand";
                              if (paymentMethodDisplay === "cash") paymentMethodDisplay = "Cash On Hand";
                              if (paymentMethodDisplay === "aba") paymentMethodDisplay = "ABA Bank";
                              if (paymentMethodDisplay === "acleda") paymentMethodDisplay = "ACLEDA Bank";
                              if (paymentMethodDisplay === "cod") paymentMethodDisplay = "Cash on Delivery";

                              return (
                                <tr key={sale.id} className="hover:bg-slate-800/10">
                                  <td className="p-3 text-slate-400 font-mono text-[10px]">{sale.date}</td>
                                  <td className="p-3 font-medium text-slate-200">
                                    <div>{sale.watchBrand} {sale.watchModel}</div>
                                    <div className="text-[10px] text-slate-500">កូដ: {sale.watchId} | ពណ៌: {sale.watchColor || "—"}</div>
                                    {(sale.customerPhone || sale.customerLocation) && (
                                      <div className="text-[10px] text-amber-500/95 mt-1 flex items-center gap-1.5 bg-slate-950/50 px-2 py-0.5 rounded-lg border border-slate-850/60 w-fit font-sans">
                                        {sale.customerPhone && <span className="font-mono">📞 {sale.customerPhone}</span>}
                                        {sale.customerPhone && sale.customerLocation && <span className="opacity-40">|</span>}
                                        {sale.customerLocation && <span>📍 {sale.customerLocation}</span>}
                                      </div>
                                    )}
                                  </td>
                                  <td className="p-3 text-center text-slate-300 font-mono font-bold">{sale.quantity}</td>
                                  <td className="p-3 text-right text-slate-300 font-mono">${sale.sellPrice.toLocaleString()}</td>
                                  <td className="p-3 text-right font-mono">
                                    {sale.paymentCurrency === "KHR" ? (
                                      <div>
                                        <div className="font-bold text-emerald-400">៛{(sale.totalAmount * (sale.exchangeRateUsed || 4100)).toLocaleString()}</div>
                                        <div className="text-[9px] text-slate-500">${sale.totalAmount.toLocaleString()} (Rate: {sale.exchangeRateUsed || 4100})</div>
                                      </div>
                                    ) : (
                                      <div>
                                        <div className="font-bold text-emerald-400">${sale.totalAmount.toLocaleString()}</div>
                                        <div className="text-[9px] text-slate-500">≈ ៛{(sale.totalAmount * (sale.exchangeRateUsed || 4100 || shopData.exchangeRate || 4100)).toLocaleString()}</div>
                                      </div>
                                    )}
                                  </td>
                                  <td className="p-3 text-center">
                                    <span className="text-[10px] bg-slate-950 border border-slate-850 text-slate-300 px-2 py-1 rounded font-medium">
                                      {paymentMethodDisplay}
                                    </span>
                                  </td>
                                  <td className="p-3 text-center">
                                    <button
                                      type="button"
                                      onClick={() => handleToggleSalePaymentStatus(sale.id)}
                                      className={`px-2 py-1 rounded text-[10px] font-bold border transition-all cursor-pointer ${
                                        isPaid
                                          ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20"
                                          : "bg-rose-500/10 border-rose-500/20 text-rose-400 hover:bg-rose-500/20"
                                      }`}
                                      title={language === "kh" ? "ចុចដើម្បីប្តូរស្ថានភាពទូទាត់" : "Click to toggle payment status"}
                                    >
                                      {isPaid 
                                        ? (language === "kh" ? "✓ បានបង់" : "✓ PAID") 
                                        : (language === "kh" ? "✗ មិនទាន់បង់" : "✗ UNPAID")}
                                    </button>
                                  </td>
                                  <td className={`p-3 text-right font-mono font-bold ${sale.profit >= 0 ? "text-amber-500" : "text-rose-500"}`}>
                                    ${sale.profit.toLocaleString()}
                                  </td>
                                  <td className="p-3 text-center">
                                    <div className="flex items-center justify-center gap-1.5">
                                      <button
                                        onClick={() => setSelectedInvoice(sale)}
                                        className="p-1 px-2 bg-slate-800 text-amber-500 hover:bg-slate-700 rounded text-[10px] transition cursor-pointer"
                                      >
                                        <span>{language === "kh" ? "វិក្កយបត្រ" : "Invoice"}</span>
                                      </button>
                                      <button
                                        onClick={() => handleStartEditSale(sale)}
                                        className="p-1 px-[7px] text-amber-450 hover:bg-amber-500/10 rounded text-amber-400 border border-transparent hover:border-amber-500/10 transition cursor-pointer"
                                        title={language === "kh" ? "កែប្រែការលក់" : "Edit recorded sale"}
                                      >
                                        <Pencil size={11} />
                                      </button>
                                      <button
                                        onClick={() => handleDeleteSale(sale.id)}
                                        className="p-1 px-[7px] text-rose-450 hover:bg-rose-500/10 rounded text-rose-400 border border-transparent hover:border-rose-500/10 transition cursor-pointer"
                                        title={language === "kh" ? "លុបការលក់" : "Delete recorded sale"}
                                      >
                                        <Trash2 size={11} />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    );
                  })()}
                </div>

              </div>
            )}

            {activeTab === "transactions" && (
              <div className="space-y-6">
                
                {/* 📊 Monthly expense budget limit progress tracker widget */}
                {(() => {
                  const thisMonthExpensesNum = shopData.expenses
                    .filter((e) => e.status !== "placeholder" && e.date >= startOfThisMonthStr)
                    .reduce((acc, exp) => acc + exp.amount, 0);
                  const expenseBudgetLimit = shopData.expenseBudgetLimit || 0;
                  const budgetProgressPercent = expenseBudgetLimit > 0 ? Math.min(100, Math.round((thisMonthExpensesNum / expenseBudgetLimit) * 100)) : 0;
                  const isOverBudget = expenseBudgetLimit > 0 && thisMonthExpensesNum > expenseBudgetLimit;
                  const isNearBudget = expenseBudgetLimit > 0 && !isOverBudget && (thisMonthExpensesNum / expenseBudgetLimit) >= 0.8;

                  return (
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row gap-6 items-center justify-between font-sans">
                      <div className="w-full md:w-2/3 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-xl">📊</span>
                            <h3 className="text-sm font-bold text-slate-100 font-serif">
                              {language === "kh" ? "ផែនការថវិកាចំណាយប្រចាំខែ" : "Monthly Expense Budget Plan"}
                            </h3>
                          </div>
                          <span className={`text-[10px] px-2 py-0.5 rounded font-black uppercase font-sans tracking-wide ${
                            isOverBudget 
                              ? "bg-rose-500/10 text-rose-400 border border-rose-500/20 animate-pulse" 
                              : isNearBudget 
                              ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" 
                              : expenseBudgetLimit > 0 
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                              : "bg-slate-850 text-slate-400 border border-slate-850"
                          }`}>
                            {isOverBudget 
                              ? (language === "kh" ? "⚠️ លើសថវិកាកំណត់!" : "⚠️ Over Budget!") 
                              : isNearBudget 
                              ? (language === "kh" ? "⚠️ ជិតដល់ដែនថវិកា!" : "⚠️ Near Budget!") 
                              : expenseBudgetLimit > 0 
                              ? (language === "kh" ? "✨ ស្ថិតក្នុងដែនថវិកា" : "✨ Within Budget")
                              : (language === "kh" ? "មិនទាន់កំណត់ដែនថវិកា" : "Not Defined")}
                          </span>
                        </div>

                        <div className="space-y-1">
                          <div className="flex justify-between items-baseline text-xs">
                            <span className="text-slate-400">
                              {language === "kh" ? "ការចំណាយខែនេះ៖" : "Current Month Spend:"}
                              <strong className="text-slate-100 ml-1.5 font-mono text-sm text-rose-400 font-semibold">
                                ${thisMonthExpensesNum.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </strong>
                            </span>
                            <span className="text-slate-400 text-xs">
                              {language === "kh" ? "ដែនកំណត់៖" : "Budget Limit:"}
                              <strong className="text-slate-100 ml-1.5 font-mono">
                                {expenseBudgetLimit > 0 ? `$${expenseBudgetLimit.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : "—"}
                              </strong>
                            </span>
                          </div>

                          {/* Progress Bar container */}
                          {expenseBudgetLimit > 0 ? (
                            <div className="w-full bg-slate-950 h-3 rounded-full overflow-hidden border border-slate-850 p-[1px]">
                              <div 
                                className={`h-full rounded-full transition-all duration-500 ${
                                  isOverBudget 
                                    ? "bg-gradient-to-r from-rose-500 to-rose-600 shadow-[0_0_8px_rgba(239,68,68,0.5)]" 
                                    : isNearBudget 
                                    ? "bg-gradient-to-r from-amber-500 to-amber-600" 
                                    : "bg-gradient-to-r from-emerald-500 to-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.3)]"
                                }`} 
                                style={{ width: `${budgetProgressPercent}%` }}
                              />
                            </div>
                          ) : (
                            <div className="w-full bg-slate-950 h-3 rounded-full border border-slate-850 border-dashed" />
                          )}
                          
                          <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                            <span>0%</span>
                            {expenseBudgetLimit > 0 && (
                              <span className={isOverBudget ? "text-rose-450 font-bold" : isNearBudget ? "text-amber-400 font-bold" : "text-emerald-400"}>
                                {budgetProgressPercent}% {language === "kh" ? "ប្រើប្រាស់រួច" : "used"}
                              </span>
                            )}
                            <span>100%</span>
                          </div>
                        </div>
                      </div>

                      {/* Right Panel: Settings input for budget limit */}
                      <div className="w-full md:w-1/3 bg-slate-955 border border-slate-800 rounded-xl p-4 transition-all shrink-0 font-sans">
                        <form onSubmit={handleUpdateBudgetLimit} className="space-y-3">
                          <label className="block text-slate-400 text-[11px] font-semibold uppercase tracking-wider">
                            {language === "kh" ? "⚙️ កំណត់ដែនថវិកាចំណាយ" : "⚙️ Expense Budget Setting"}
                          </label>
                          <div className="flex gap-2">
                            <div className="relative flex-1">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-mono text-xs font-bold">$</span>
                              <input
                                id="budget-limit-input-field"
                                type="number"
                                placeholder={language === "kh" ? "ឧ. 1000" : "e.g. 1000"}
                                value={budgetLimitInput}
                                onChange={(e) => setBudgetLimitInput(e.target.value !== "" ? Number(e.target.value) : "")}
                                className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-lg py-2 pl-7 pr-2.5 text-slate-100 text-xs focus:outline-none transition-all font-mono"
                              />
                            </div>
                            <button
                              type="submit"
                              className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-3.5 rounded-lg text-xs hover:text-slate-950 transition cursor-pointer shrink-0"
                            >
                              {language === "kh" ? "កែប្រែ" : "Apply"}
                            </button>
                          </div>
                          <p className="text-[9px] text-slate-500 leading-normal">
                            {language === "kh" 
                              ? "* ប្រព័ន្ធនឹងផ្ដល់សញ្ញាព្រមានប្រសិនបើការចំណាយប្រចាំខែរបស់អ្នកឡើងលើសពីកម្រិតកំណត់នេះ។" 
                              : "* System alerts and progress indications will change colour when operating operating expenses breach this value."}
                          </p>
                        </form>
                      </div>
                    </div>
                  );
                })()}

                {/* Upper Panel: Form Inputs Row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  {/* Left: Input Other Incomes */}
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
                    <h3 className="text-sm font-bold text-slate-100 mb-5 pb-3 border-b border-slate-800 flex items-center gap-2 font-serif">
                      <Plus size={16} className="text-emerald-500" />
                      កត់ត្រាចំណូលផ្សេងៗ (Other Incomes)
                    </h3>
                    <form onSubmit={handleAddOtherIncome} className="space-y-4 font-sans">
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="block text-slate-400 text-xs font-semibold uppercase-wide">
                            {language === "kh" ? "ទឹកប្រាក់ទទួលបាន *" : "Income Amount *"}
                          </label>
                          <div className="flex bg-slate-950 p-0.5 rounded-lg border border-slate-800">
                            <button
                              type="button"
                              onClick={() => setIncomeCurrency("USD")}
                              className={`px-2 py-0.5 text-[10px] rounded font-bold transition-all cursor-pointer ${
                                incomeCurrency === "USD"
                                  ? "bg-emerald-500 text-slate-950"
                                  : "text-slate-400 hover:text-slate-200"
                              }`}
                            >
                              USD ($)
                            </button>
                            <button
                              type="button"
                              onClick={() => setIncomeCurrency("KHR")}
                              className={`px-2 py-0.5 text-[10px] rounded font-bold transition-all cursor-pointer ${
                                incomeCurrency === "KHR"
                                  ? "bg-emerald-500 text-slate-950"
                                  : "text-slate-400 hover:text-slate-200"
                              }`}
                            >
                              KHR (៛)
                            </button>
                          </div>
                        </div>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-mono text-xs font-bold">
                            {incomeCurrency === "USD" ? "$" : "៛"}
                          </span>
                          <input
                            id="income-amt"
                            type="number"
                            required
                            value={incomeAmount}
                            onChange={(e) => setIncomeAmount(e.target.value !== "" ? Number(e.target.value) : "")}
                            placeholder={incomeCurrency === "USD" ? "ឧ. 150" : "ឧ. 60000"}
                            className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-lg py-2.5 pl-7 pr-3.5 text-slate-100 text-xs focus:outline-none transition-all font-mono"
                          />
                        </div>
                        {incomeCurrency === "KHR" && incomeAmount !== "" && (
                          <p className="text-[10px] text-slate-500 mt-1">
                            ≈ ${(Number(incomeAmount) / (shopData.exchangeRate || 4100)).toFixed(2)} (1$ = {(shopData.exchangeRate || 4100).toLocaleString()}៛)
                          </p>
                        )}
                      </div>
                      <div>
                        <label className="block text-slate-400 text-xs font-semibold mb-1.5 uppercase-wide">
                          ប្រភពចំណូល (វិស័យ / Category) *
                        </label>
                        <input
                          id="income-cat"
                          type="text"
                          required
                          value={incomeCategory}
                          onChange={(e) => setIncomeCategory(e.target.value)}
                          placeholder="ឧ. សេវាកម្មជួសជុលនាឡិកា"
                          className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-lg py-2.5 px-3.5 text-slate-100 text-xs focus:outline-none transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-400 text-xs font-semibold mb-1.5 uppercase-wide">
                          ពិពណ៌នាសេចក្តីលម្អិត
                        </label>
                        <input
                          id="income-desc"
                          type="text"
                          value={incomeDesc}
                          onChange={(e) => setIncomeDesc(e.target.value)}
                          placeholder="ឧ. ដូរសឺមី និងថាមពលថ្ម ROLEX"
                          className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-lg py-2.5 px-3.5 text-slate-100 text-xs focus:outline-none transition-all"
                        />
                      </div>
                      <button
                        type="submit"
                        className="w-full bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold py-2.5 px-4 rounded-lg text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Plus size={14} />
                        កត់ត្រាចំណូល
                      </button>
                    </form>
                  </div>

                  {/* Right: Input Expense */}
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
                    <h3 className="text-sm font-bold text-slate-100 mb-5 pb-3 border-b border-slate-800 flex items-center gap-2 font-serif">
                      <Plus size={16} className="text-rose-500" />
                      កត់ត្រាចំណាយអាជីវកម្ម (Business Expenses)
                    </h3>
                    <form onSubmit={handleAddExpense} className="space-y-4 font-sans">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <label className="block text-slate-400 text-xs font-semibold uppercase-wide">
                              {language === "kh" ? "ទឹកប្រាក់ចំណាយ *" : "Expense Amount *"}
                            </label>
                            <div className="flex bg-slate-950 p-0.5 rounded-lg border border-slate-800">
                              <button
                                type="button"
                                onClick={() => setExpenseCurrency("USD")}
                                className={`px-1.5 py-0.5 text-[9px] rounded font-bold transition-all cursor-pointer ${
                                  expenseCurrency === "USD"
                                    ? "bg-rose-500 text-slate-950"
                                    : "text-slate-400 hover:text-slate-200"
                                }`}
                              >
                                USD
                              </button>
                              <button
                                type="button"
                                onClick={() => setExpenseCurrency("KHR")}
                                className={`px-1.5 py-0.5 text-[9px] rounded font-bold transition-all cursor-pointer ${
                                  expenseCurrency === "KHR"
                                    ? "bg-rose-500 text-slate-950"
                                    : "text-slate-400 hover:text-slate-200"
                                }`}
                              >
                                KHR
                              </button>
                            </div>
                          </div>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-mono text-xs font-bold">
                              {expenseCurrency === "USD" ? "$" : "៛"}
                            </span>
                            <input
                              id="expense-amt"
                              type="number"
                              required
                              value={expenseAmount}
                              onChange={(e) => setExpenseAmount(e.target.value !== "" ? Number(e.target.value) : "")}
                              placeholder={expenseCurrency === "USD" ? "ឧ. 350" : "ឧ. 140000"}
                              className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-lg py-2.5 pl-7 pr-2.5 text-slate-100 text-xs focus:outline-none transition-all font-mono"
                            />
                          </div>
                          {expenseCurrency === "KHR" && expenseAmount !== "" && (
                            <p className="text-[10px] text-slate-500 mt-1">
                              ≈ ${(Number(expenseAmount) / (shopData.exchangeRate || 4100)).toFixed(2)}
                            </p>
                          )}
                        </div>
                        <div>
                          <label className="block text-slate-400 text-xs font-semibold mb-1.5 uppercase-wide">
                            ចំណាយលើ (Category) *
                          </label>
                          <select
                            id="expense-category-select"
                            value={expenseCategory}
                            onChange={(e) => setExpenseCategory(e.target.value as any)}
                            className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-lg py-2.5 px-3.5 text-slate-100 text-xs focus:outline-none transition-all"
                          >
                            <option value="rent">{translations[language].rentCategory}</option>
                            <option value="shipping">{translations[language].shippingCategory}</option>
                            <option value="electricity">{translations[language].electricityCategory}</option>
                            <option value="staff">{translations[language].staffCategory}</option>
                            <option value="marketing">{translations[language].marketingCategory}</option>
                            <option value="other">{translations[language].otherCategory}</option>
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="block text-slate-400 text-xs font-semibold mb-1.5 uppercase-wide">
                          ពិពណ៌នាសេចក្តីលម្អិត
                        </label>
                        <input
                          id="expense-desc"
                          type="text"
                          value={expenseDesc}
                          onChange={(e) => setExpenseDesc(e.target.value)}
                          placeholder="ឧ. បង់ថ្លៃជួលហាងប្រចាំខែមិថុនា"
                          className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-lg py-2.5 px-3.5 text-slate-100 text-xs focus:outline-none transition-all"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-slate-400 text-xs font-semibold mb-1.5 uppercase-wide">
                            កាលបរិច្ឆេទចំណាយ *
                          </label>
                          <input
                            id="expense-date"
                            type="date"
                            required
                            value={expenseDate}
                            onChange={(e) => setExpenseDate(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-lg py-2.5 px-3.5 text-slate-100 text-xs focus:outline-none transition-all font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-400 text-xs font-semibold mb-1.5 uppercase-wide">
                            គណនី/វិធីបង់ប្រាក់
                          </label>
                          <select
                            id="expense-payment-method"
                            value={expensePaymentMethod}
                            onChange={(e) => setExpensePaymentMethod(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-lg py-2.5 px-3.5 text-slate-100 text-xs focus:outline-none transition-all"
                          >
                            <option value="Cash On Hand">Cash On Hand</option>
                            <option value="ABA Bank">ABA Bank</option>
                            <option value="ACLEDA Bank">ACLEDA Bank</option>
                            <option value="Cash on Delivery">Cash on Delivery</option>
                          </select>
                        </div>
                      </div>
                      {/* Recurring Options */}
                      <div className="bg-slate-950/40 border border-slate-800/60 rounded-xl p-3.5 space-y-3">
                        <div className="flex items-center justify-between">
                          <label className="flex items-center gap-2 cursor-pointer text-slate-300 text-xs font-semibold">
                            <input
                              type="checkbox"
                              checked={isExpenseRecurring}
                              onChange={(e) => setIsExpenseRecurring(e.target.checked)}
                              className="accent-amber-500 rounded border-slate-800 w-4 h-4"
                            />
                            <span>{language === "kh" ? "ចំណាយដដែលៗ (Recurring Expense)" : "Mark as Recurring Expense"}</span>
                          </label>
                          <span className={`text-[9px] font-black font-sans px-2 py-0.5 rounded ${isExpenseRecurring ? "bg-amber-500/10 text-amber-500" : "bg-slate-800 text-slate-500"}`}>
                            {isExpenseRecurring ? "ACTIVE" : "OFF"}
                          </span>
                        </div>

                        {isExpenseRecurring && (
                          <div className="grid grid-cols-2 gap-3 pt-3.5 border-t border-slate-800/40">
                            <div>
                              <label className="block text-slate-400 text-[10px] font-bold mb-1.5 uppercase tracking-wide">
                                {language === "kh" ? "វដ្តចំណាយ (Interval) *" : "Interval *"}
                              </label>
                              <select
                                value={expenseRecurringInterval}
                                onChange={(e) => setExpenseRecurringInterval(e.target.value as any)}
                                className="w-full bg-slate-900 border border-slate-800 focus:border-amber-500 rounded-lg py-2 px-3 text-slate-100 text-xs focus:outline-none transition-all"
                              >
                                <option value="weekly">{language === "kh" ? "រៀងរាល់សប្តាហ៍" : "Weekly (Every Week)"}</option>
                                <option value="monthly">{language === "kh" ? "រៀងរាល់ខែ" : "Monthly (Every Month)"}</option>
                                <option value="yearly">{language === "kh" ? "រៀងរាល់ឆ្នាំ" : "Yearly (Every Year)"}</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-slate-400 text-[10px] font-bold mb-1.5 uppercase tracking-wide">
                                {language === "kh" ? "ចំនួនដងអនាគត (Placeholders) *" : "Placeholders *"}
                              </label>
                              <input
                                type="number"
                                min={1}
                                max={24}
                                required
                                value={expenseFutureCount}
                                onChange={(e) => setExpenseFutureCount(Number(e.target.value))}
                                className="w-full bg-slate-900 border border-slate-800 focus:border-amber-500 rounded-lg py-2 px-3 text-slate-100 text-xs focus:outline-none transition-all font-mono"
                              />
                              <span className="text-[9px] text-slate-500 mt-1 block">Max 24 months/times</span>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="pt-2">
                        <button
                          type="submit"
                          className="w-full bg-rose-500 hover:bg-rose-600 text-slate-950 font-bold py-2.5 px-4 rounded-lg text-xs flex items-center justify-center gap-1.5 cursor-pointer animate-none transition-all"
                        >
                          <Plus size={14} />
                          កត់ត្រាចំណាយ
                        </button>
                      </div>
                    </form>
                  </div>

                </div>

                {/* Lower Panel: Log Lists Rows */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  
                  {/* Left Table: Incomes logs */}
                  <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 shadow-xl space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-800 pb-3 gap-2">
                      <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2 font-serif">
                        <TrendingUp size={16} className="text-emerald-500" />
                        តារាងកំណត់ត្រាចំណូលសរុប (ទាំងការលក់ និងចំណូលផ្សេងៗ)
                      </h3>
                      <span className="text-[10px] text-slate-500 font-medium font-sans">Owner: Kunthy</span>
                    </div>

                    {shopData.incomes.length === 0 ? (
                      <div className="py-12 text-center text-slate-500 text-xs font-sans">
                        មិនទាន់មានកំណត់ត្រាចំណូលស្វែងរកនៅឡើយ។
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {/* 📊 Visual Summary Cards for Incomes */}
                        <div className="grid grid-cols-3 gap-3 bg-slate-950/50 p-3 rounded-xl border border-slate-850/60 font-sans">
                          <div className="text-center p-2 rounded bg-slate-900/40 border border-slate-850">
                            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">{language === "kh" ? "ចំណូលផ្សេងៗសរុប" : "Other Incomes"}</div>
                            <div className="text-xs md:text-sm font-mono font-black text-sky-400 mt-1">
                              ${shopData.incomes.filter(i => i.source !== "sale").reduce((sum, i) => sum + i.amount, 0).toLocaleString()}
                            </div>
                          </div>
                          <div className="text-center p-2 rounded bg-slate-900/40 border border-slate-850">
                            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">{language === "kh" ? "ពីការលក់នាឡិកា" : "Watch Sales"}</div>
                            <div className="text-xs md:text-sm font-mono font-black text-emerald-400 mt-1">
                              ${shopData.incomes.filter(i => i.source === "sale").reduce((sum, i) => sum + i.amount, 0).toLocaleString()}
                            </div>
                          </div>
                          <div className="text-center p-2 rounded bg-slate-950 border border-slate-800/80">
                            <div className="text-[10px] text-amber-500 font-bold uppercase tracking-wide">{language === "kh" ? "ចំណូលរួមសរុប" : "Grand Total"}</div>
                            <div className="text-xs md:text-sm font-mono font-black text-amber-400 mt-1">
                              ${shopData.incomes.reduce((sum, i) => sum + i.amount, 0).toLocaleString()}
                            </div>
                          </div>
                        </div>

                        <div className="overflow-x-auto rounded-xl border border-slate-850">
                          <table className="w-full text-left border-collapse text-xs">
                            <thead className="bg-slate-950">
                              <tr className="text-slate-400 border-b border-slate-850">
                                <th className="p-3 font-medium">កាលបរិច្ឆេទ</th>
                                <th className="p-3 font-medium">ប្រភព/ក្រុម</th>
                                <th className="p-3 font-medium">សេចក្តីលម្អិត</th>
                                <th className="p-3 font-medium text-right">ទឹកប្រាក់ចំណូល</th>
                                <th className="p-3 font-medium text-center">លុប</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-850 bg-slate-900/40">
                              {shopData.incomes.slice().reverse().map((inc) => (
                                <tr key={inc.id} className="hover:bg-slate-800/10">
                                  <td className="p-3 text-slate-400 font-mono text-[10px]">{inc.date}</td>
                                  <td className="p-3">
                                    <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold font-sans ${inc.source === "sale" ? "bg-emerald-500/10 text-emerald-400" : "bg-sky-500/10 text-sky-400"}`}>
                                      {inc.category}
                                    </span>
                                  </td>
                                  <td className="p-3 text-slate-300 font-sans">{inc.description || "—"}</td>
                                  <td className="p-3 text-right font-mono text-emerald-400 font-semibold">
                                    {inc.currency === "KHR" && inc.originalAmount ? (
                                      <div>
                                        <div>+៛{inc.originalAmount.toLocaleString()}</div>
                                        <div className="text-[9px] text-slate-500 font-normal">≈ ${inc.amount.toLocaleString()}</div>
                                      </div>
                                    ) : (
                                      `+$${inc.amount.toLocaleString()}`
                                    )}
                                  </td>
                                  <td className="p-3 text-center">
                                    {inc.source !== "sale" ? (
                                      <button
                                        onClick={() => handleDeleteIncome(inc.id)}
                                        className="p-1 px-2 text-rose-400 hover:bg-rose-500/10 rounded transition cursor-pointer"
                                      >
                                        <Trash2 size={11} />
                                      </button>
                                    ) : (
                                      <span className="text-[9px] text-slate-600 block italic leading-none font-sans">កាត់ស្តុកលក់</span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot>
                              <tr className="bg-slate-950 font-sans font-bold border-t border-slate-850 text-[11px]">
                                <td colSpan={3} className="p-3 text-slate-400">
                                  {language === "kh" ? "📊 សរុបចំណូលផ្សេងៗ (Other Incomes Total):" : "📊 Total Other Incomes:"}
                                </td>
                                <td className="p-3 text-right font-mono text-sky-400 font-black text-xs">
                                  +${shopData.incomes.filter(i => i.source !== "sale").reduce((sum, i) => sum + i.amount, 0).toLocaleString()}
                                </td>
                                <td></td>
                              </tr>
                              <tr className="bg-slate-950/80 font-sans font-bold border-t border-slate-850 text-[11px]">
                                <td colSpan={3} className="p-3 text-slate-400">
                                  {language === "kh" ? "🛍️ សរុបចំណូលពីការលក់នាឡិកា (Sales Total):" : "🛍️ Total Sales Income:"}
                                </td>
                                <td className="p-3 text-right font-mono text-emerald-400 font-black text-xs">
                                  +${shopData.incomes.filter(i => i.source === "sale").reduce((sum, i) => sum + i.amount, 0).toLocaleString()}
                                </td>
                                <td></td>
                              </tr>
                              <tr className="bg-slate-950 border-t border-slate-800 font-sans font-black text-[11px]">
                                <td colSpan={3} className="p-3 text-slate-200">
                                  {language === "kh" ? "💰 ផលបូកចំណូលសរុបរួម (Grand Total):" : "💰 Grand Total Incomes:"}
                                </td>
                                <td className="p-3 text-right font-mono text-amber-400 text-xs font-black">
                                  +${shopData.incomes.reduce((sum, i) => sum + i.amount, 0).toLocaleString()}
                                </td>
                                <td></td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right Table: Expenses logs */}
                  <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 shadow-xl space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-800 pb-3 gap-2">
                      <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2 font-serif">
                        <TrendingDown size={16} className="text-rose-500" />
                        តារាងកំណត់ត្រាចំណាយសរុប (ថ្លៃហាង ដឹកជញ្ជូន បុគ្គលិក ផ្សេងៗ)
                      </h3>
                      <span className="text-[10px] text-slate-500 font-medium font-sans">Owner: Kunthy</span>
                    </div>

                    {/* Filter controls */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-950/40 p-3.5 rounded-xl border border-slate-850/60 font-sans text-xs">
                      <div>
                        <label className="block text-slate-400 font-bold mb-1.5 text-[10px] uppercase tracking-wider">{language === "kh" ? "ស្វែងរកពិពណ៌នា" : "Search Details"}</label>
                        <input
                          type="text"
                          value={expenseSearchQuery}
                          onChange={(e) => setExpenseSearchQuery(e.target.value)}
                          placeholder={language === "kh" ? "ស្វែងរកការចំណាយ..." : "Search expenses..."}
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 text-xs focus:outline-none focus:border-amber-500 transition-colors"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-400 font-bold mb-1.5 text-[10px] uppercase tracking-wider">{language === "kh" ? "ក្រុមចំណាយ" : "Category"}</label>
                        <select
                          value={expenseCategoryFilter}
                          onChange={(e) => setExpenseCategoryFilter(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 text-xs focus:outline-none focus:border-amber-500 transition-colors"
                        >
                          <option value="all">📁 {language === "kh" ? "ទាំងអស់" : "All Categories"}</option>
                          <option value="rent">🏠 {translations[language].rentCategory}</option>
                          <option value="shipping">📦 {translations[language].shippingCategory}</option>
                          <option value="electricity">⚡ {translations[language].electricityCategory}</option>
                          <option value="staff">👥 {translations[language].staffCategory}</option>
                          <option value="marketing">📢 {translations[language].marketingCategory}</option>
                          <option value="other">⚙️ {translations[language].otherCategory}</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-slate-400 font-bold mb-1.5 text-[10px] uppercase tracking-wider">{language === "kh" ? "ស្ថានភាពទូទាត់" : "Payment Status"}</label>
                        <select
                          value={expenseStatusFilter}
                          onChange={(e) => setExpenseStatusFilter(e.target.value as any)}
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 text-xs focus:outline-none focus:border-amber-500 transition-colors"
                        >
                          <option value="all">🌐 {language === "kh" ? "ទាំងអស់" : "All States"}</option>
                          <option value="paid">✅ {language === "kh" ? "បានទូទាត់រួច (Paid)" : "Paid Only"}</option>
                          <option value="placeholder">⏳ {language === "kh" ? "គម្រោងអនាគត (Placeholders)" : "Placeholders Only"}</option>
                        </select>
                      </div>
                    </div>

                    {(() => {
                      if (shopData.expenses.length === 0) {
                        return (
                          <div className="py-12 text-center text-slate-500 text-xs font-sans">
                            មិនទាន់មានកំណត់ត្រាចំណាយនៅឡើយទេ។
                          </div>
                        );
                      }

                      const filteredExpensesList = (shopData.expenses || []).filter((exp) => {
                        // 1. Category Filter
                        if (expenseCategoryFilter !== "all" && exp.category !== expenseCategoryFilter) {
                          return false;
                        }
                        // 2. Status Filter
                        if (expenseStatusFilter === "paid" && exp.status === "placeholder") {
                          return false;
                        }
                        if (expenseStatusFilter === "placeholder" && exp.status !== "placeholder") {
                          return false;
                        }
                        // 3. Search Filter
                        if (expenseSearchQuery.trim() !== "") {
                          const query = expenseSearchQuery.toLowerCase().trim();
                          const desc = (exp.description || "").toLowerCase();
                          const catName = getExpenseCategoryName(exp.category).toLowerCase();
                          if (!desc.includes(query) && !catName.includes(query)) {
                            return false;
                          }
                        }
                        return true;
                      });

                      if (filteredExpensesList.length === 0) {
                        return (
                          <div className="py-12 text-center text-slate-500 text-xs font-sans">
                            {language === "kh" ? "រកមិនឃើញកំណត់ត្រាចំណាយត្រូវគ្នាទេ។" : "No matching expense records found."}
                          </div>
                        );
                      }

                      return (
                        <div className="overflow-x-auto rounded-xl border border-slate-850">
                          <table className="w-full text-left border-collapse text-xs">
                            <thead className="bg-slate-950">
                              <tr className="text-slate-400 border-b border-slate-850">
                                <th className="p-3 font-medium">កាលបរិច្ឆេទ</th>
                                <th className="p-3 font-medium">ក្រុមចំណាយ</th>
                                <th className="p-3 font-medium">លម្អិតគោលបំណង</th>
                                <th className="p-3 font-medium text-right">ទឹកប្រាក់ជាក់ស្តែង</th>
                                <th className="p-3 font-medium text-center">សកម្មភាព</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-850 bg-slate-900/40 font-sans">
                              {filteredExpensesList.slice().reverse().map((exp) => {
                                const isPlaceholder = exp.status === "placeholder";
                                return (
                                  <tr
                                    key={exp.id}
                                    className={`hover:bg-slate-800/10 transition-all ${
                                      isPlaceholder
                                        ? "opacity-65 bg-slate-950/30 border-l-2 border-l-amber-500/50"
                                        : "border-l-2 border-l-rose-500/25"
                                    }`}
                                  >
                                    <td className="p-3 text-slate-400 font-mono text-[10px]">{exp.date}</td>
                                    <td className="p-3">
                                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-sans ${
                                        isPlaceholder
                                          ? "bg-amber-500/10 text-amber-500"
                                          : "bg-rose-500/10 text-rose-400"
                                      }`}>
                                        {getExpenseCategoryName(exp.category)}
                                      </span>
                                    </td>
                                    <td className="p-3">
                                      <div className="text-slate-200 font-medium">{exp.description}</div>
                                      {isPlaceholder && (
                                        <div className="text-[9px] text-amber-500 font-mono flex items-center gap-1.5 mt-0.5">
                                          <span>⏳ {language === "kh" ? "ចំណាយគម្រោងអនាគត" : "Estimated future cost"}</span>
                                          {exp.recurringInterval && (
                                            <span className="bg-amber-500/10 px-1.5 py-0.2 rounded uppercase text-[8px] font-bold">
                                              {exp.recurringInterval}
                                            </span>
                                          )}
                                        </div>
                                      )}
                                    </td>
                                    <td className={`p-3 text-right font-mono font-bold ${isPlaceholder ? "text-amber-500" : "text-rose-400"}`}>
                                      {exp.currency === "KHR" && exp.originalAmount ? (
                                        <div>
                                          <div>-៛{exp.originalAmount.toLocaleString()}</div>
                                          <div className="text-[9px] text-slate-500 font-normal">≈ ${exp.amount.toLocaleString()}</div>
                                        </div>
                                      ) : (
                                        `-$${exp.amount.toLocaleString()}`
                                      )}
                                    </td>
                                    <td className="p-3 text-center">
                                      <div className="flex items-center justify-center gap-2">
                                        {isPlaceholder && (
                                          <button
                                            onClick={() => handleConfirmPlaceholderExpense(exp.id)}
                                            className="p-1 px-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[10px] rounded flex items-center gap-1.5 transition-all cursor-pointer shadow-lg shadow-amber-500/15"
                                            title={language === "kh" ? "បញ្ជាក់ថាបានបង់ប្រាក់ចំណាយនេះ" : "Confirm payment"}
                                          >
                                            <Check size={10} className="stroke-[3]" />
                                            <span>{language === "kh" ? "បង់" : "Pay"}</span>
                                          </button>
                                        )}
                                        <button
                                          onClick={() => handleDeleteExpense(exp.id)}
                                          className="p-1 px-2 text-rose-450 hover:bg-rose-500/10 rounded transition animate-none cursor-pointer"
                                          title={language === "kh" ? "លុប" : "Delete"}
                                        >
                                          <Trash2 size={11} />
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      );
                    })()}
                  </div>

                </div>

              </div>
            )}

            {/* 5. CAPITAL MANAGEMENT VIEW */}
            {activeTab === "capital" && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Capital inputs panel (1 col) */}
                <div className="lg:col-span-1 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl h-fit">
                  <h3 className="text-sm font-bold text-slate-100 mb-5 pb-3 border-b border-slate-800 flex items-center gap-2 font-serif">
                    <Wallet size={16} className="text-amber-500" />
                    កត់ត្រាប្រតិបត្តិការប្រចាក់ដើម
                  </h3>

                  <form onSubmit={handleAddCapitalTransaction} className="space-y-4 font-sans">
                    <div>
                      <label className="block text-slate-400 text-xs font-semibold mb-1.5 uppercase-wide">
                        ប្រភេទប្រតិបត្តិការ *
                      </label>
                      <select
                        id="capital-type-select"
                        value={capitalType}
                        onChange={(e) => setCapitalType(e.target.value as any)}
                        className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-lg py-2.5 px-3.5 text-slate-100 text-xs focus:outline-none transition-all"
                      >
                        <option value="initial">ប្រាក់ដើមដំបូង (Initial)</option>
                        <option value="add">ប្រាក់ដើមបន្ថែម (Capital Add)</option>
                        <option value="withdraw">ប្រាក់ដើមដកចេញ (Withdrawn)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-400 text-xs font-semibold mb-1.5 uppercase-wide">
                        ទឹកប្រាក់ប្រតិបត្តិការ $ *
                      </label>
                      <input
                        id="capital-amt"
                        type="number"
                        required
                        value={capitalAmount}
                        onChange={(e) => setCapitalAmount(e.target.value !== "" ? Number(e.target.value) : "")}
                        placeholder="ឧ. 15000"
                        className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-lg py-2.5 px-3.5 text-slate-100 text-xs focus:outline-none transition-all font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-400 text-xs font-semibold mb-1.5 uppercase-wide">
                        សម្គាល់ / មូលហេតុ
                      </label>
                      <input
                        id="capital-desc"
                        type="text"
                        value={capitalDesc}
                        onChange={(e) => setCapitalDesc(e.target.value)}
                        placeholder="ឧ. បន្ថែមប្រាក់បង្វិលស្តុកសម្រាប់ Rolex Sub"
                        className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-lg py-2.5 px-3.5 text-slate-100 text-xs focus:outline-none transition-all"
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold py-2.5 px-4 rounded-lg text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Check size={14} className="stroke-[2]" />
                      រក្សាទុកប្រតិបត្តិការ
                    </button>
                  </form>
                </div>

                {/* Capital logs panel (2 cols) */}
                <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-800 pb-3 gap-2">
                    <div className="flex flex-col gap-1">
                      <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2 font-serif">
                        <History size={16} className="text-amber-500" />
                        ប្រវត្តិនៃការចាក់បញ្ចូល ឬដកប្រាក់ដើម
                      </h3>
                      <span className="text-[10px] text-slate-500 font-medium font-sans">Owner: Kunthy</span>
                    </div>
                    <div className="text-xs bg-slate-950 px-3 py-1 border border-slate-850 rounded-lg text-slate-300">
                      ប្រាក់ដើមបច្ចុប្បន្ន៖ <span className="font-mono font-semibold text-amber-400">${currentCapitalNum.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>

                  {shopData.capitalTransactions.length === 0 ? (
                    <div className="py-24 text-center text-slate-500 text-xs font-sans">
                      មិនទាន់មានកំណត់ត្រាប្រាក់ដើមនៅឡើយទេ។ សូមបន្ថែមប្រាក់ដើមដំបូងដើម្បីគណនា!
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-slate-800">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead className="bg-slate-950">
                          <tr className="text-slate-400 border-b border-slate-850">
                            <th className="p-3 font-medium">កាលបរិច្ឆេទ</th>
                            <th className="p-3 font-medium">លេខកូដប្រតិបត្តិការ</th>
                            <th className="p-3 font-medium">ប្រភេទ</th>
                            <th className="p-3 font-medium">គោលបំណង/សេចក្តីលម្អិត</th>
                            <th className="p-3 font-medium text-right">ទឹកប្រាក់ប្រតិបត្តិការ</th>
                            <th className="p-3 font-medium text-center">សកម្មភាព</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-850 bg-slate-900/40">
                          {shopData.capitalTransactions.slice().reverse().map((trans) => (
                            <tr key={trans.id} className="hover:bg-slate-800/10">
                              <td className="p-3 text-slate-400 font-mono text-[10px]">{trans.date}</td>
                              <td className="p-3 font-mono text-[10px] text-slate-400 font-semibold">{trans.id}</td>
                              <td className="p-3">
                                <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold font-sans ${
                                  trans.type === "initial"
                                    ? "bg-blue-500/10 text-blue-400"
                                    : trans.type === "add"
                                    ? "bg-emerald-500/10 text-emerald-400"
                                    : "bg-red-500/10 text-red-400"
                                }`}>
                                  {getCapitalTypeName(trans.type)}
                                </span>
                              </td>
                              <td className="p-3 text-slate-300 font-sans">{trans.description}</td>
                              <td className={`p-3 text-right font-mono font-semibold ${
                                trans.type === "withdraw" ? "text-rose-400" : "text-emerald-405 text-emerald-400"
                              }`}>
                                {trans.type === "withdraw" ? "-" : "+"}${trans.amount.toLocaleString()}
                              </td>
                              <td className="p-3 text-center">
                                <button
                                  onClick={() => handleDeleteCapitalTransaction(trans.id)}
                                  className="p-1 px-2 text-rose-400 hover:bg-rose-500/10 rounded transition"
                                >
                                  <Trash2 size={11} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

              </div>
            )}

            {/* 5B. SUPPLIERS MANAGEMENT VIEW */}
            {activeTab === "suppliers" && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-350">
                
                {/* Left panel: Add/Edit Supplier Profile */}
                <div className={`lg:col-span-1 ${sCard} border rounded-2xl p-6 shadow-xl h-fit`}>
                  <h3 className="text-sm font-bold text-amber-500 mb-5 pb-3 border-b dark:border-slate-800 border-zinc-200 flex items-center gap-2 font-serif">
                    <Truck size={17} className="animate-pulse" />
                    {editingSupId 
                      ? (language === "kh" ? "កែប្រែប្រវត្តិអ្នកផ្គត់ផ្គង់" : "Edit Supplier Profile") 
                      : (language === "kh" ? "ចុះឈ្មោះអ្នកផ្គត់ផ្គង់ថ្មី" : "Add New Supplier Profile")}
                  </h3>

                  <form onSubmit={handleAddOrUpdateSupplier} className="space-y-4 font-sans">
                    <div>
                      <label className={`block ${sTextMuted} text-xs font-semibold tracking-wider mb-1.5 uppercase`}>
                        {language === "kh" ? "កូដសម្គាល់អ្នកផ្គត់ផ្គង់ (ID / Code) *" : "Supplier Code (ID) *"}
                      </label>
                      <input
                        id="supplier-id"
                        type="text"
                        required
                        disabled={!!editingSupId}
                        value={supId}
                        onChange={(e) => setSupId(e.target.value)}
                        placeholder="ឧ. THAI-WHOLESALE-01"
                        className={`w-full ${sInput} focus:border-amber-500 rounded-lg py-2.5 px-3.5 text-xs focus:outline-none transition-all font-mono`}
                      />
                    </div>

                    <div>
                      <label className={`block ${sTextMuted} text-xs font-semibold tracking-wider mb-1.5 uppercase`}>
                        {language === "kh" ? "ឈ្មោះក្រុមហ៊ុន ឬស្តង់ផ្គត់ផ្គង់ *" : "Company / Supplier Name *"}
                      </label>
                      <input
                        id="supplier-name"
                        type="text"
                        required
                        value={supName}
                        onChange={(e) => setSupName(e.target.value)}
                        placeholder="ឧ. Thai Watch Distributor Co."
                        className={`w-full ${sInput} focus:border-amber-500 rounded-lg py-2.5 px-3.5 text-xs focus:outline-none transition-all`}
                      />
                    </div>

                    <div>
                      <label className={`block ${sTextMuted} text-xs font-semibold tracking-wider mb-1.5 uppercase`}>
                        {language === "kh" ? "ឈ្មោះអ្នកទំនាក់ទំនង" : "Representative Contact Name"}
                      </label>
                      <input
                        id="supplier-contact"
                        type="text"
                        value={supContact}
                        onChange={(e) => setSupContact(e.target.value)}
                        placeholder="ឧ. Somchai"
                        className={`w-full ${sInput} focus:border-amber-500 rounded-lg py-2.5 px-3.5 text-xs focus:outline-none transition-all`}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={`block ${sTextMuted} text-xs font-semibold tracking-wider mb-1.5 uppercase`}>
                          {language === "kh" ? "លេខទូរស័ព្ទ" : "Phone Number"}
                        </label>
                        <input
                          id="supplier-phone"
                          type="text"
                          value={supPhone}
                          onChange={(e) => setSupPhone(e.target.value)}
                          placeholder="ឧ. +66 81 234 5678"
                          className={`w-full ${sInput} focus:border-amber-500 rounded-lg py-2.5 px-3.5 text-xs focus:outline-none transition-all font-mono`}
                        />
                      </div>
                      <div>
                        <label className={`block ${sTextMuted} text-xs font-semibold tracking-wider mb-1.5 uppercase`}>
                          {language === "kh" ? "អ៊ីមែល" : "Email Address"}
                        </label>
                        <input
                          id="supplier-email"
                          type="email"
                          value={supEmail}
                          onChange={(e) => setSupEmail(e.target.value)}
                          placeholder="ឧ. order@thaiwatch.com"
                          className={`w-full ${sInput} focus:border-amber-500 rounded-lg py-2.5 px-3.5 text-xs focus:outline-none transition-all font-mono`}
                        />
                      </div>
                    </div>

                    <div>
                      <label className={`block ${sTextMuted} text-xs font-semibold tracking-wider mb-1.5 uppercase`}>
                        {language === "kh" ? "កំណត់ចំណាំ ឬលក្ខខណ្ឌ" : "Notes & Restock Contracts"}
                      </label>
                      <textarea
                        id="supplier-notes"
                        value={supNotes}
                        onChange={(e) => setSupNotes(e.target.value)}
                        placeholder={language === "kh" ? "ឧ. ការដឹកជញ្ជូនរហ័ស ៥-៧ ថ្ងៃ ចុះកុងត្រារាល់ខែ..." : "e.g. Delivery takes 5-7 days. Net 30 payment."}
                        rows={3}
                        className={`w-full ${sInput} focus:border-amber-500 rounded-lg py-2.5 px-3.5 text-xs focus:outline-none transition-all`}
                      />
                    </div>

                    <div className="flex gap-2.5 pt-2">
                      {editingSupId && (
                        <button
                          type="button"
                          onClick={handleCancelEditSupplier}
                          className={`flex-1 ${theme === "dark" ? "bg-slate-800 hover:bg-slate-700 text-slate-300" : "bg-zinc-200 hover:bg-zinc-300 text-zinc-700"} font-semibold py-2.5 px-4 rounded-lg text-xs cursor-pointer text-center`}
                        >
                          {language === "kh" ? "បោះបង់" : "Cancel"}
                        </button>
                      )}
                      <button
                        type="submit"
                        className="flex-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold py-2.5 px-4 rounded-lg text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      >
                        {editingSupId ? (
                          <>
                            <Check size={14} />
                            {language === "kh" ? "រក្សាទុកការកែប្រែ" : "Save Supplier"}
                          </>
                        ) : (
                          <>
                            <Plus size={14} />
                            {language === "kh" ? "ចុះឈ្មោះអ្នកផ្គត់ផ្គង់" : "Add Supplier"}
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                </div>

                {/* Right panel: Registered Suppliers List & Linkages (2 cols) */}
                <div className="lg:col-span-2 space-y-6">
                  <div className={`${sCard} border rounded-2xl p-6 shadow-xl space-y-4`}>
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b dark:border-slate-800 border-zinc-200 pb-3">
                      <div className="flex flex-col gap-1">
                        <h3 className="text-sm font-bold text-amber-500 flex items-center gap-2 font-serif">
                          <Truck size={16} />
                          {language === "kh" 
                            ? `បញ្ជីអ្នកផ្គត់ផ្គង់ និងតុល្យភាពស្តុក (${(shopData.suppliers || []).length} ក្រុមហ៊ុន)` 
                            : `Suppliers & Restock Connections (${(shopData.suppliers || []).length} registered)`}
                        </h3>
                        <p className={`text-[10px] ${sTextMuted} font-sans`}>
                          {language === "kh" 
                            ? "តាមដានទំនាក់ទំនងអ្នកផ្គត់ផ្គង់ និងនាឡិកាដៃដែលភ្ជាប់គ្នាដើម្បីងាយស្រួលទិញបន្ថែម" 
                            : "Monitor wholsalers, their contact cards, and linkage with stock items."}
                        </p>
                      </div>

                      {/* Supplier Search Field */}
                      <div className="relative w-full sm:w-60 font-sans">
                        <span className={`absolute inset-y-0 left-0 pl-3 flex items-center ${sTextMuted}`}>
                          <Search size={14} />
                        </span>
                        <input
                          id="supplier-search-input"
                          type="text"
                          value={supSearch}
                          onChange={(e) => setSupSearch(e.target.value)}
                          placeholder={language === "kh" ? "ស្វែងរកតាមឈ្មោះ ឬលេខទូរស័ព្ទ..." : "Search Wholesaler name or phone..."}
                          className={`w-full ${sInput} rounded-lg pl-9 pr-3 py-2 text-xs focus:outline-none focus:border-amber-500`}
                        />
                      </div>
                    </div>

                    {/* Wholesaler entries list layout */}
                    {(() => {
                      const list = shopData.suppliers || [];
                      const query = supSearch.toLowerCase().trim();
                      const filtered = list.filter((s) => 
                        s.name.toLowerCase().includes(query) ||
                        s.id.toLowerCase().includes(query) ||
                        (s.contactName && s.contactName.toLowerCase().includes(query)) ||
                        (s.phone && s.phone.includes(query))
                      );

                      if (filtered.length === 0) {
                        return (
                          <div className={`py-24 text-center ${sTextMuted} text-xs font-sans`}>
                            {language === "kh" 
                              ? "មិនទាន់មានអ្នកផ្គត់ផ្គង់ណាមួយត្រូវបានចុះឈ្មោះទេ។ សូមចុះឈ្មោះអ្នកផ្គត់ផ្គង់នៅចំហៀងខាងឆ្វេង!" 
                              : "No suppliers match your active filter. Create or adjust profiles on the left panel!"}
                          </div>
                        );
                      }

                      return (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {filtered.map((sup) => {
                            const linkedWatches = shopData.watches.filter((w) => w.supplierId === sup.id);
                            const lowStockLinked = linkedWatches.filter((w) => w.stock < (w.lowStockThreshold !== undefined ? w.lowStockThreshold : 5));

                            return (
                              <div 
                                key={sup.id} 
                                className={`p-4 rounded-xl border ${theme === "dark" ? "bg-slate-950/40 border-slate-800" : "bg-zinc-50 border-zinc-200"} flex flex-col justify-between space-y-3 shadow-sm hover:border-amber-500/30 transition-all`}
                              >
                                <div className="space-y-1.5">
                                  <div className="flex items-start justify-between gap-1">
                                    <div>
                                      <h4 className="text-xs font-bold text-slate-100 font-sans tracking-wide">
                                        {sup.name}
                                      </h4>
                                      <p className="text-[10px] text-slate-500 font-mono">ID: {sup.id}</p>
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                      <button
                                        onClick={() => handleEditSupplier(sup)}
                                        className={`p-1 px-2 text-[10px] rounded ${theme === "dark" ? "bg-slate-800 hover:bg-slate-700 text-slate-305" : "bg-zinc-150 hover:bg-zinc-200 text-zinc-650"} transition cursor-pointer`}
                                        title={language === "kh" ? "កែប្រែ" : "Edit Profile"}
                                      >
                                        <Edit2 size={10} />
                                      </button>
                                      <button
                                        onClick={() => handleDeleteSupplier(sup.id)}
                                        className="p-1 px-1.5 text-[10px] rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition cursor-pointer"
                                        title={language === "kh" ? "លុប" : "Delete Profile"}
                                      >
                                        <Trash2 size={10} />
                                      </button>
                                    </div>
                                  </div>

                                  <div className="space-y-1 text-[11px] font-sans text-zinc-400 dark:text-slate-400 pt-1">
                                    {sup.contactName && (
                                      <p className="flex items-center gap-1.5">
                                        <span className="text-slate-500">👤 Contact:</span> {sup.contactName}
                                      </p>
                                    )}
                                    {sup.phone && (
                                      <p className="flex items-center gap-1.5 font-mono">
                                        <span className="text-slate-500">📞 Phone:</span> {sup.phone}
                                      </p>
                                    )}
                                    {sup.email && (
                                      <p className="flex items-center gap-1.5 font-mono">
                                        <span className="text-slate-500">✉️ Email:</span> {sup.email}
                                      </p>
                                    )}
                                    {sup.notes && (
                                      <p className="text-[10px] bg-amber-500/5 text-amber-500/80 p-2 rounded-lg border border-amber-500/10 italic leading-relaxed mt-2">
                                        📝 {sup.notes}
                                      </p>
                                    )}
                                  </div>
                                </div>

                                <div className="border-t dark:border-slate-800/65 border-zinc-200/65 pt-2.5">
                                  <div className="flex items-center justify-between text-[11px] font-sans">
                                    <span className="text-slate-400 font-medium font-sans">
                                      🔗 {language === "kh" ? `នាឡិកាដៃភ្ជាប់រួច៖` : `Linked Watches:`}{" "}
                                      <span className="font-mono font-bold text-slate-100">{linkedWatches.length} {language === "kh" ? "គ្រឿង" : "items"}</span>
                                    </span>
                                    
                                    {lowStockLinked.length > 0 && (
                                      <span className="px-1.5 py-0.5 bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] font-bold rounded flex items-center gap-1">
                                        ⚠️ {lowStockLinked.length} {language === "kh" ? "មុខអស់ស្តុក" : "low stock"}
                                      </span>
                                    )}
                                  </div>

                                  {linkedWatches.length > 0 && (
                                    <div className="mt-2 space-y-1 bg-slate-950/25 p-2 rounded-lg border border-slate-850">
                                      <p className="text-[9px] text-slate-500 font-semibold uppercase tracking-wider font-sans">
                                        {language === "kh" ? "ព័ត៌មានបំពេញស្តុកនាឡិកា៖" : "Linked Inventory status:"}
                                      </p>
                                      <div className="max-h-[90px] overflow-y-auto space-y-1 pr-1 scrollbar-thin">
                                        {linkedWatches.map((w) => {
                                          const isLow = w.stock < 5;
                                          return (
                                            <div key={w.id} className="flex items-center justify-between text-[10px] font-mono">
                                              <span className="truncate text-slate-450 max-w-[120px]" title={`${w.brand} - ${w.model}`}>
                                                {w.brand} {w.model}
                                              </span>
                                              <span className={isLow ? "text-red-400 font-bold" : "text-emerald-400 font-medium"}>
                                                {w.stock} Qty
                                              </span>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  )}
                                </div>

                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}

                  </div>
                </div>

              </div>
            )}

            {/* 5.5. USER ACCOUNTS MANAGEMENT */}
            {activeTab === "accounts" && userRole === "owner" && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in font-sans">
                {/* Left panel: Add/Edit Account */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4 h-fit">
                  <div>
                    <h3 className="text-sm font-bold text-slate-100 mb-1 font-serif">
                      {editingAccId 
                        ? (language === "kh" ? "កែប្រែគណនីប្រើប្រាស់" : "Edit User Account") 
                        : (language === "kh" ? "បង្កើតគណនីថ្មី" : "Create New Account")}
                    </h3>
                    <p className="text-[10px] text-slate-400">
                      {language === "kh" ? "កំណត់អត្តសញ្ញាណ និងសិទ្ធិអ្នកលក់" : "Configure login and levels of access"}
                    </p>
                  </div>

                  <form onSubmit={handleAddOrUpdateAccount} className="space-y-4 font-sans text-xs">
                    <div>
                      <label className="block text-slate-400 font-semibold mb-1 uppercase tracking-wide">
                        {language === "kh" ? "ឈ្មោះពេញបុគ្គលិក / ម្ចាស់ (Display Name) *" : "Display Name *"}
                      </label>
                      <input
                        type="text"
                        value={newAccName}
                        onChange={(e) => setNewAccName(e.target.value)}
                        placeholder="ឧ. ពីជ (Pich) ឬ គន្ធី"
                        className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-lg py-2.5 px-3.5 text-slate-100 focus:outline-none transition-all font-sans"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-slate-400 font-semibold mb-1 uppercase tracking-wide">
                        {language === "kh" ? "ឈ្មោះគណនី (Username) *" : "Username *"}
                      </label>
                      <input
                        type="text"
                        value={newAccUsername}
                        onChange={(e) => setNewAccUsername(e.target.value)}
                        placeholder="ឧ. pich, admin, kunthy"
                        className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-lg py-2.5 px-3.5 text-slate-100 focus:outline-none transition-all font-mono"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-slate-400 font-semibold mb-1 uppercase tracking-wide">
                        {language === "kh" ? "លេខកូដសម្ងាត់ (Password) *" : "Password *"}
                      </label>
                      <input
                        type="password"
                        value={newAccPassword}
                        onChange={(e) => setNewAccPassword(e.target.value)}
                        placeholder="••••••"
                        className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-lg py-2.5 px-3.5 text-slate-100 focus:outline-none transition-all font-mono"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-slate-400 font-semibold mb-1.5 uppercase tracking-wide">
                        {language === "kh" ? "កម្រិតសិទ្ធិប្រើប្រាស់ (User Role) *" : "Access Permission Role *"}
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => setNewAccRole("staff")}
                          className={`py-2 px-3 rounded-lg text-xs font-semibold border flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                            newAccRole === "staff"
                              ? "bg-blue-500/15 border-blue-500 text-blue-400"
                              : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                          }`}
                        >
                          <span>📇</span>
                          {language === "kh" ? "បុគ្គលិក (Staff)" : "Staff User"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setNewAccRole("owner")}
                          className={`py-2 px-3 rounded-lg text-xs font-semibold border flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                            newAccRole === "owner"
                              ? "bg-amber-500/15 border-amber-500 text-amber-500"
                              : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                          }`}
                        >
                          <span>👑</span>
                          {language === "kh" ? "ម្ចាស់ហាង (Owner)" : "Owner Admin"}
                        </button>
                      </div>
                    </div>

                    <div className="flex gap-2 pt-2">
                      {editingAccId && (
                        <button
                          type="button"
                          onClick={handleCancelEditAccount}
                          className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold py-2.5 px-4 rounded-lg text-xs transition-colors cursor-pointer"
                        >
                          {language === "kh" ? "បោះបង់" : "Cancel"}
                        </button>
                      )}
                      <button
                        type="submit"
                        className="flex-1 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold py-2.5 px-4 rounded-lg text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Check size={13} className="stroke-[2.5]" />
                        {editingAccId 
                          ? (language === "kh" ? "រក្សាទុកគណនី" : "Save Changes") 
                          : (language === "kh" ? "បង្កើតគណនី" : "Create Account")}
                      </button>
                    </div>
                  </form>
                </div>

                {/* Right panel: Live registered custom accounts */}
                <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
                  <div>
                    <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2 font-serif">
                      <Users size={16} className="text-amber-500" />
                      {language === "kh" ? "បញ្ជីគណនីអ្នកប្រើប្រាស់ក្នុងប្រព័ន្ធ" : "Registered Access Accounts List"}
                    </h3>
                    <p className={`text-[10px] ${sTextMuted} font-sans`}>
                      {language === "kh" 
                        ? `មានគណនីចំនួន ${getUserAccounts().length} ត្រូវបានបង្កើតឡើង និងមានសិទ្ធិចូលប្រើប្រាស់ប្រព័ន្ធ`
                        : `Total ${getUserAccounts().length} active accounts registered for shop controls`}
                    </p>
                  </div>

                  <div className="overflow-x-auto font-sans">
                    <table className="w-full text-left text-xs text-slate-300 font-sans">
                      <thead>
                        <tr className="border-b border-slate-800 text-[10px] text-slate-400 uppercase tracking-wider">
                          <th className="py-3 px-2">{language === "kh" ? "ឈ្មោះគណនី" : "User Info"}</th>
                          <th className="py-3 px-2">{language === "kh" ? "Username" : "Username"}</th>
                          <th className="py-3 px-2">{language === "kh" ? "លេខកូដ (Password)" : "Password"}</th>
                          <th className="py-3 px-2 text-center">{language === "kh" ? "សិទ្ធិប្រើប្រាស់" : "Access Level"}</th>
                          <th className="py-3 px-2 text-right">{language === "kh" ? "សកម្មភាព" : "Actions"}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {getUserAccounts().map((userItem) => (
                          <tr key={userItem.id} className="hover:bg-slate-950/20 transition-colors">
                            <td className="py-3 px-2 font-semibold text-slate-150">
                              {userItem.name}
                            </td>
                            <td className="py-3 px-2 text-slate-300 font-mono font-medium">
                              {userItem.username}
                            </td>
                            <td className="py-3 px-2 text-slate-400 font-mono">
                              <div className="flex items-center gap-1.5 justify-start">
                                <span>
                                  {revealedPasswords[userItem.id] ? (userItem.password || "123456") : "••••••"}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setRevealedPasswords(prev => ({
                                      ...prev,
                                      [userItem.id]: !prev[userItem.id]
                                    }));
                                  }}
                                  className="p-1 hover:bg-slate-800 text-slate-500 hover:text-slate-300 rounded transition duration-150 cursor-pointer"
                                  title={revealedPasswords[userItem.id] ? "លាក់" : "បង្ហាញ"}
                                >
                                  {revealedPasswords[userItem.id] ? <EyeOff size={12} /> : <Eye size={12} />}
                                </button>
                              </div>
                            </td>
                            <td className="py-3 px-2 text-center">
                              <span className={`inline-block text-[9px] font-bold px-2.5 py-0.5 rounded-full select-none ${
                                userItem.role === "owner" 
                                  ? "bg-amber-500/10 text-amber-500 border border-amber-500/15" 
                                  : "bg-blue-500/10 text-blue-400 border border-blue-500/15"
                              }`}>
                                {userItem.role === "owner" 
                                  ? (language === "kh" ? "👑 ម្ចាស់ហាង" : "Owner Admin") 
                                  : (language === "kh" ? "📇 បុគ្គលិក" : "Staff level")}
                              </span>
                            </td>
                            <td className="py-3 px-2 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleEditAccount(userItem)}
                                  className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-amber-500 rounded-lg transition-colors cursor-pointer"
                                  title={language === "kh" ? "កែប្រែគណនី" : "Edit Account"}
                                >
                                  <Edit2 size={13} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteAccount(userItem.id)}
                                  className="p-1.5 hover:bg-red-500/10 text-slate-400 hover:text-red-400 rounded-lg transition-colors cursor-pointer"
                                  title={language === "kh" ? "លុបគណនី" : "Delete Account"}
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* AUDIT LOGS LEDGER VIEW */}
            {activeTab === "audit" && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-200 font-sans">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                      <ClipboardList className="text-amber-500" size={20} />
                      <span>{language === "kh" ? "កំណត់ហេតុប្រតិបត្តិការប្រព័ន្ធ" : "System Audit Ledger"}</span>
                    </h2>
                    <p className={`text-xs ${sTextMuted} mt-1`}>
                      {language === "kh" 
                        ? "កំណត់ត្រាប្រតិបត្តិការ និងសកម្មភាពរួមគ្នាក្នុងប្រព័ន្ធគ្រប់គ្រងរបស់បុគ្គលិក និងម្ចាស់ហាង"
                        : "Synchronized actions, modifications, and system-wide modifications made by users"}
                    </p>
                  </div>

                  {/* Export button */}
                  <button
                    onClick={() => {
                      const logs = shopData.auditLogs || [];
                      if (logs.length === 0) {
                        showNotice("error", language === "kh" ? "គ្មានទិន្នន័យកំណត់ហេតុទេ!" : "No audit log data available!");
                        return;
                      }
                      const csvHeaders = ["ID", "Action", "Details", "User", "Timestamp"];
                      const rows = logs.map(l => [
                        l.id,
                        l.action,
                        l.details,
                        l.user,
                        l.timestamp
                      ]);
                      const csvContent = "data:text/csv;charset=utf-8," 
                        + [csvHeaders.join(","), ...rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(","))].join("\n");
                      const encodedUri = encodeURI(csvContent);
                      const link = document.createElement("a");
                      link.setAttribute("href", encodedUri);
                      link.setAttribute("download", `Chrono_Audit_Ledger_${new Date().toISOString().split('T')[0]}.csv`);
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                      showNotice("success", language === "kh" ? "នាំចេញកំណត់ហេតុជោគជ័យ!" : "Audit ledger exported successfully!");
                    }}
                    className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs px-3.5 py-2 rounded-xl flex items-center gap-1.5 cursor-pointer transition"
                  >
                    <Download size={13} />
                    <span>{language === "kh" ? "នាំចេញ CSV" : "Export Logs"}</span>
                  </button>
                </div>

                {/* Filters Row */}
                <div className={`${sCard} border border-slate-800 rounded-2xl p-4.5 flex flex-col sm:flex-row gap-3`}>
                  <div className="flex-1 relative">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
                    <input
                      type="text"
                      placeholder={language === "kh" ? "ស្វែងរកកំណត់ហេតុ (សកម្មភាព, ព័ត៌មានលម្អិត, អ្នកប្រើប្រាស់)..." : "Search logs (action, details, user)..."}
                      value={auditSearch}
                      onChange={(e) => setAuditSearch(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl py-2 pl-9 pr-4 text-slate-200 text-xs focus:outline-none transition-all"
                    />
                  </div>
                  <select
                    value={auditActionFilter}
                    onChange={(e) => setAuditActionFilter(e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-slate-200 text-xs focus:outline-none focus:border-amber-500 cursor-pointer"
                  >
                    <option value="all">{language === "kh" ? "គ្រប់សកម្មភាពទាំងអស់" : "All Action Types"}</option>
                    <option value="SALE">{language === "kh" ? "ការលក់" : "Sales"}</option>
                    <option value="QUICK_SALE">{language === "kh" ? "ការលក់លឿន" : "Quick Sales"}</option>
                    <option value="DELETE_SALE">{language === "kh" ? "ការលុបការលក់" : "Canceled Sales"}</option>
                    <option value="UPDATE_EXCHANGE_RATE">{language === "kh" ? "អត្រាដូរប្រាក់" : "Exchange Rates"}</option>
                  </select>
                </div>

                {/* Logs Table */}
                <div className={`${sCard} border border-slate-800 rounded-2xl overflow-hidden`}>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs font-sans">
                      <thead>
                        <tr className="bg-slate-900/50 border-b border-slate-850 text-slate-400 font-semibold uppercase tracking-wider">
                          <th className="py-3 px-4 w-28">{language === "kh" ? "ម៉ោង/កាលបរិច្ឆេទ" : "Time / Date"}</th>
                          <th className="py-3 px-4 w-24">{language === "kh" ? "អ្នកប្រើប្រាស់" : "User"}</th>
                          <th className="py-3 px-4 w-32">{language === "kh" ? "សកម្មភាព" : "Action Type"}</th>
                          <th className="py-3 px-4">{language === "kh" ? "ព័ត៌មានលម្អិត" : "Operational Details"}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-850">
                        {(() => {
                          const logs = shopData.auditLogs || [];
                          const filteredLogs = logs.filter(l => {
                            const matchSearch = 
                              l.action.toLowerCase().includes(auditSearch.toLowerCase()) ||
                              l.details.toLowerCase().includes(auditSearch.toLowerCase()) ||
                              l.user.toLowerCase().includes(auditSearch.toLowerCase());
                            const matchFilter = auditActionFilter === "all" || l.action === auditActionFilter;
                            return matchSearch && matchFilter;
                          });

                          if (filteredLogs.length === 0) {
                            return (
                              <tr>
                                <td colSpan={4} className="py-12 text-center text-slate-500 font-medium">
                                  {language === "kh" ? "រកមិនឃើញកំណត់ហេតុប្រតិបត្តិការទេ" : "No operational audit logs found"}
                                </td>
                              </tr>
                            );
                          }

                          return filteredLogs.map((l) => {
                            let badgeStyle = "bg-slate-500/10 text-slate-400 border border-slate-500/15";
                            if (l.action === "SALE" || l.action === "QUICK_SALE") {
                              badgeStyle = "bg-emerald-500/10 text-emerald-400 border border-emerald-500/15";
                            } else if (l.action === "DELETE_SALE") {
                              badgeStyle = "bg-rose-500/10 text-rose-400 border border-rose-500/15";
                            } else if (l.action === "UPDATE_EXCHANGE_RATE") {
                              badgeStyle = "bg-amber-500/10 text-amber-500 border border-amber-500/15";
                            }

                            return (
                              <tr key={l.id} className="hover:bg-slate-900/20 transition-all">
                                <td className="py-3 px-4 text-slate-400 font-mono text-[11px] whitespace-nowrap">
                                  {new Date(l.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}{" "}
                                  <span className="text-[10px] opacity-75">
                                    {new Date(l.timestamp).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-slate-200 font-medium whitespace-nowrap">
                                  {l.user === "Kunthy" ? "👑 " + l.user : "👤 " + l.user}
                                </td>
                                <td className="py-3 px-4">
                                  <span className={`inline-block text-[10px] font-mono px-2 py-0.5 rounded-md ${badgeStyle}`}>
                                    {l.action}
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-slate-300 font-medium leading-relaxed">
                                  {l.details}
                                </td>
                              </tr>
                            );
                          });
                        })()}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* 5. PERIOD CLOSING VIEW */}
            {activeTab === "closings" && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-200 font-sans">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                      <CalendarCheck className="text-amber-500" size={20} />
                      <span>{language === "kh" ? "បិទបញ្ជីគណនេយ្យចុងគ្រា (ចុងខែ និងឆ្នាំ)" : "Financial Period Closing (Month/Year)"}</span>
                    </h2>
                    <p className={`text-xs ${sTextMuted} mt-1`}>
                      {language === "kh" 
                        ? "គណនា និងចាក់សោរបាយការណ៍ហិរញ្ញវត្ថុហាងរបស់អ្នកសម្រាប់គ្រានីមួយៗ ដើម្បីងាយស្រួលផ្ទៀងផ្ទាត់ និងតាមដាន"
                        : "Calculate and lock your store's financial period records for easy auditing and history tracking."}
                    </p>
                  </div>
                </div>

                {/* Main Simulator & Live Calculations */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* Period Selection Form */}
                  <div className="lg:col-span-4 space-y-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-amber-500">
                        {language === "kh" ? "⚙️ ជ្រើសរើសគ្រាសម្រាប់បិទបញ្ជី" : "⚙️ Select Period to Close"}
                      </h3>

                      {/* Period Type Selector */}
                      <div>
                        <label className="block text-slate-400 text-[10px] font-semibold mb-1 uppercase tracking-wide">
                          {language === "kh" ? "ប្រភេទគ្រា" : "Period Type"}
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => setClosingPeriodType("month")}
                            className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                              closingPeriodType === "month"
                                ? "bg-amber-500/15 border-amber-500 text-amber-500"
                                : "bg-slate-950 border-slate-800 text-slate-400"
                            }`}
                          >
                            {language === "kh" ? "📅 ប្រចាំខែ" : "Monthly"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setClosingPeriodType("year")}
                            className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                              closingPeriodType === "year"
                                ? "bg-amber-500/15 border-amber-500 text-amber-500"
                                : "bg-slate-950 border-slate-800 text-slate-400"
                            }`}
                          >
                            {language === "kh" ? "🗓️ ប្រចាំឆ្នាំ" : "Yearly"}
                          </button>
                        </div>
                      </div>

                      {/* Month & Year Input fields */}
                      <div className="grid grid-cols-2 gap-3">
                        {closingPeriodType === "month" && (
                          <div>
                            <label className="block text-slate-400 text-[10px] font-semibold mb-1 uppercase tracking-wide">
                              {language === "kh" ? "ខែ" : "Month"}
                            </label>
                            <select
                              value={closingMonth}
                              onChange={(e) => setClosingMonth(Number(e.target.value))}
                              className="w-full bg-slate-950 border border-slate-850 rounded-xl px-3 py-2 text-slate-200 text-xs focus:outline-none focus:border-amber-500 cursor-pointer"
                            >
                              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                                <option key={m} value={m}>
                                  {language === "kh" ? `ខែ ${m}` : `Month ${m}`}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}

                        <div className={closingPeriodType === "year" ? "col-span-2" : ""}>
                          <label className="block text-slate-400 text-[10px] font-semibold mb-1 uppercase tracking-wide">
                            {language === "kh" ? "ឆ្នាំ" : "Year"}
                          </label>
                          <select
                            value={closingYear}
                            onChange={(e) => setClosingYear(Number(e.target.value))}
                            className="w-full bg-slate-950 border border-slate-850 rounded-xl px-3 py-2 text-slate-200 text-xs focus:outline-none focus:border-amber-500 cursor-pointer"
                          >
                            {Array.from({ length: 6 }, (_, i) => 2024 + i).map((y) => (
                              <option key={y} value={y}>
                                {y}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Custom Notes */}
                      <div>
                        <label className="block text-slate-400 text-[10px] font-semibold mb-1 uppercase tracking-wide">
                          {language === "kh" ? "កំណត់ចំណាំ (បើមាន)" : "Notes (Optional)"}
                        </label>
                        <textarea
                          rows={2}
                          value={closingNotes}
                          onChange={(e) => setClosingNotes(e.target.value)}
                          placeholder={language === "kh" ? "ឧ. បិទបញ្ជីដោយគ្មានបញ្ហាឆ្គង..." : "e.g., Closed successfully, all ledger balances matched..."}
                          className="w-full bg-slate-950 border border-slate-850 rounded-xl px-3 py-2 text-slate-200 text-xs focus:outline-none focus:border-amber-500 placeholder-slate-600 resize-none"
                        />
                      </div>

                      {/* Execute Button */}
                      <button
                        onClick={handleClosePeriod}
                        className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 active:scale-98 text-slate-950 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition shadow-lg shadow-amber-500/15 cursor-pointer"
                      >
                        <Lock size={13} />
                        <span>
                          {language === "kh" 
                            ? `ចាក់សោ & បិទបញ្ជីសម្រាប់ ${closingPeriodType === "month" ? `${closingYear}-${String(closingMonth).padStart(2, "0")}` : closingYear}` 
                            : `Lock & Close for ${closingPeriodType === "month" ? `${closingYear}-${String(closingMonth).padStart(2, "0")}` : closingYear}`}
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Live Calculation Preview Panel */}
                  <div className="lg:col-span-8 space-y-4">
                    {(() => {
                      const draftPeriodKey = closingPeriodType === "month"
                        ? `${closingYear}-${String(closingMonth).padStart(2, "0")}`
                        : `${closingYear}`;

                      const draftSales = shopData.sales.filter(s => s.date.startsWith(draftPeriodKey));
                      const draftIncomes = shopData.incomes.filter(i => i.date.startsWith(draftPeriodKey));
                      const draftExpenses = shopData.expenses.filter(e => e.date.startsWith(draftPeriodKey) && e.status !== "placeholder");

                      const draftSalesCount = draftSales.reduce((sum, s) => sum + s.quantity, 0);
                      const draftTotalSales = draftSales.reduce((sum, s) => sum + s.totalAmount, 0);
                      const draftTotalCOGS = draftSales.reduce((sum, s) => sum + (s.costPrice * s.quantity), 0);
                      const draftGrossProfit = draftTotalSales - draftTotalCOGS;
                      const draftOtherIncome = draftIncomes.reduce((sum, i) => sum + i.amount, 0);
                      const draftTotalExpenses = draftExpenses.reduce((sum, e) => sum + e.amount, 0);
                      const draftNetProfit = draftGrossProfit + draftOtherIncome - draftTotalExpenses;

                      const currentInventoryCount = shopData.watches.reduce((sum, w) => sum + w.stock, 0);
                      const currentInventoryValue = shopData.watches.reduce((sum, w) => sum + (w.costPrice * w.stock), 0);

                      const expenseCategoryMap: Record<string, number> = {
                        rent: 0,
                        shipping: 0,
                        electricity: 0,
                        staff: 0,
                        marketing: 0,
                        other: 0,
                      };
                      draftExpenses.forEach(e => {
                        if (expenseCategoryMap[e.category] !== undefined) {
                          expenseCategoryMap[e.category] += e.amount;
                        } else {
                          expenseCategoryMap.other += e.amount;
                        }
                      });

                      const isAlreadyClosed = (shopData.closings || []).some(
                        c => c.periodKey === draftPeriodKey && c.type === closingPeriodType
                      );

                      return (
                        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg space-y-5">
                          {/* Title */}
                          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                            <div>
                              <h3 className="text-sm font-bold text-slate-100 font-sans">
                                {language === "kh" 
                                  ? `📊 សេចក្តីសង្ខេបគណនាគ្រា៖ ${draftPeriodKey}` 
                                  : `📊 Period Calculation Draft: ${draftPeriodKey}`}
                              </h3>
                              <p className={`text-[10px] ${sTextMuted} mt-0.5`}>
                                {language === "kh" 
                                  ? "ទិន្នន័យត្រូវបានដកស្រង់ចេញពីបញ្ជីលក់ ចំណូលផ្សេងៗ និងចំណាយជាក់ស្តែងចុងក្រោយបង្អស់"
                                  : "Computed dynamically from latest inventory, sales, incomes, and expenses logs"}
                              </p>
                            </div>
                            <div>
                              {isAlreadyClosed ? (
                                <span className="text-[10px] px-2.5 py-0.8 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold rounded-lg uppercase tracking-wide">
                                  🔒 {language === "kh" ? "បានបិទបញ្ជីរួចហើយ" : "Already Closed"}
                                </span>
                              ) : (
                                <span className="text-[10px] px-2.5 py-0.8 bg-amber-500/10 text-amber-500 border border-amber-500/20 font-bold rounded-lg uppercase tracking-wide animate-pulse">
                                  ⏳ {language === "kh" ? "រង់ចាំការបិទបញ្ជី" : "Drafting / Open"}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Metric Grid Cards */}
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {/* Sales */}
                            <div className="bg-slate-950/40 border border-slate-850 p-3 rounded-xl">
                              <span className="text-[9px] text-emerald-400 font-semibold uppercase block tracking-wider">
                                {language === "kh" ? "ចំណូលលក់នាឡិកា" : "Gross Watch Sales"}
                              </span>
                              <div className="text-base font-bold font-mono text-slate-100 mt-1">
                                ${draftTotalSales.toLocaleString()}
                              </div>
                              <span className="text-[9px] text-slate-500 font-sans block mt-0.5">
                                {language === "kh" ? `លក់បាន ${draftSalesCount} គ្រឿង` : `${draftSalesCount} items sold`}
                              </span>
                            </div>

                            {/* COGS & Gross Profit */}
                            <div className="bg-slate-950/40 border border-slate-850 p-3 rounded-xl">
                              <span className="text-[9px] text-amber-500 font-semibold uppercase block tracking-wider">
                                {language === "kh" ? "ផលចំណេញដុល (Gross)" : "Gross Profit Margin"}
                              </span>
                              <div className="text-base font-bold font-mono text-amber-400 mt-1">
                                ${draftGrossProfit.toLocaleString()}
                              </div>
                              <span className="text-[9px] text-slate-500 font-sans block mt-0.5">
                                {language === "kh" ? `ថ្លៃដើម COGS: $${draftTotalCOGS.toLocaleString()}` : `COGS Cost: $${draftTotalCOGS.toLocaleString()}`}
                              </span>
                            </div>

                            {/* Other Income */}
                            <div className="bg-slate-950/40 border border-slate-850 p-3 rounded-xl">
                              <span className="text-[9px] text-sky-400 font-semibold uppercase block tracking-wider">
                                {language === "kh" ? "ចំណូលក្រៅហាង" : "Other Revenues"}
                              </span>
                              <div className="text-base font-bold font-mono text-slate-100 mt-1">
                                ${draftOtherIncome.toLocaleString()}
                              </div>
                              <span className="text-[9px] text-slate-500 font-sans block mt-0.5">
                                {language === "kh" ? "សេវាកម្ម និងចំណូលផ្សេងៗ" : "Services & commissions"}
                              </span>
                            </div>

                            {/* Operating Expenses */}
                            <div className="bg-slate-950/40 border border-slate-850 p-3 rounded-xl">
                              <span className="text-[9px] text-rose-400 font-semibold uppercase block tracking-wider">
                                {language === "kh" ? "ចំណាយសរុប (OPEX)" : "Total Operating Exp"}
                              </span>
                              <div className="text-base font-bold font-mono text-rose-400 mt-1">
                                -${draftTotalExpenses.toLocaleString()}
                              </div>
                              <span className="text-[9px] text-slate-500 font-sans block mt-0.5">
                                {language === "kh" ? `ប្រតិបត្តិការ ${draftExpenses.length} លើក` : `${draftExpenses.length} expense counts`}
                              </span>
                            </div>
                          </div>

                          {/* Net profit card */}
                          <div className={`p-4 rounded-xl border flex flex-col sm:flex-row items-center justify-between gap-4 ${
                            draftNetProfit >= 0 
                              ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-400" 
                              : "bg-rose-500/5 border-rose-500/20 text-rose-400"
                          }`}>
                            <div className="space-y-0.5 text-center sm:text-left font-sans">
                              <span className="text-[10px] uppercase font-black tracking-wide">
                                {language === "kh" ? "💵 ប្រាក់ចំណេញសុទ្ធចុងក្រោយ" : "💵 Final Net Profit / Loss"}
                              </span>
                              <h4 className="text-lg md:text-2xl font-black font-mono mt-0.5">
                                ${draftNetProfit.toLocaleString()}
                              </h4>
                            </div>
                            <div className="text-xs max-w-md text-slate-300 leading-relaxed font-sans text-center sm:text-right">
                              {language === "kh"
                                ? `បន្ទាប់ពីដកការចំណាយសរុប និង COGS រួច ហាងនាឡិកាដៃគន្ធី ទទួលបានប្រាក់ចំណេញសុទ្ធចំនួន $${draftNetProfit.toLocaleString()} (លុយដុល្លារ) សម្រាប់គ្រានេះ។`
                                : `After subtracting cost of goods and operating expenditures, the watch store generated a net profit of $${draftNetProfit.toLocaleString()} for this period.`}
                            </div>
                          </div>

                          {/* Detail expense breakdown list */}
                          <div className="space-y-2">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide font-sans block">
                              {language === "kh" ? "📋 វិភាគចំណាយតាមប្រភេទ" : "📋 Operating Expenses Breakdown"}
                            </span>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs font-sans">
                              {[
                                { key: "rent", label: translations[language].rentCategory, val: expenseCategoryMap.rent, color: "bg-amber-500" },
                                { key: "shipping", label: translations[language].shippingCategory, val: expenseCategoryMap.shipping, color: "bg-sky-500" },
                                { key: "electricity", label: translations[language].electricityCategory, val: expenseCategoryMap.electricity, color: "bg-yellow-500" },
                                { key: "staff", label: translations[language].staffCategory, val: expenseCategoryMap.staff, color: "bg-emerald-500" },
                                { key: "marketing", label: translations[language].marketingCategory, val: expenseCategoryMap.marketing, color: "bg-indigo-500" },
                                { key: "other", label: translations[language].otherCategory, val: expenseCategoryMap.other, color: "bg-slate-500" },
                              ].map(item => (
                                <div key={item.key} className="bg-slate-950/30 border border-slate-850/50 rounded-lg p-2.5 flex items-center justify-between">
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <span className={`w-2 h-2 rounded-full ${item.color} shrink-0`}></span>
                                    <span className="text-slate-400 text-[10px] font-medium truncate">{item.label}</span>
                                  </div>
                                  <span className="font-mono font-bold text-slate-200 shrink-0 text-[11px]">${item.val.toLocaleString()}</span>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Inventory Valuation Snapshot */}
                          <div className="border-t border-slate-800/80 pt-3 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 gap-3">
                            <span className="font-sans">
                              📦 {language === "kh" ? "តម្លៃស្តុកនាឡិកាគិតត្រឹមពេលនេះ៖" : "Inventory Valuation Snapshot at this exact moment:"}
                            </span>
                            <div className="flex items-center gap-4 font-mono">
                              <div>
                                {language === "kh" ? "សរុបគ្រឿង៖ " : "Total Items: "}
                                <span className="text-slate-200 font-bold">{currentInventoryCount} គ្រឿង</span>
                              </div>
                              <div>
                                {language === "kh" ? "តម្លៃដើមសរុប៖ " : "Total Cost Valuation: "}
                                <span className="text-amber-500 font-bold">${currentInventoryValue.toLocaleString()}</span>
                              </div>
                            </div>
                          </div>

                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* Closed Periods List (The Saved History Table) */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg space-y-4">
                  <div>
                    <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                      <History className="text-amber-500" size={16} />
                      <span>{language === "kh" ? "ប្រវត្តិនៃការបិទបញ្ជីហិរញ្ញវត្ថុផ្លូវការ" : "Official Historical Period Closings Registry"}</span>
                    </h3>
                    <p className={`text-xs ${sTextMuted} mt-0.5`}>
                      {language === "kh" 
                        ? "បញ្ជីនៃខែ ឬឆ្នាំ ដែលត្រូវបានផ្ទៀងផ្ទាត់ និងសម្រេចបិទបញ្ជីរួចរាល់ដោយម្ចាស់ហាង"
                        : "Past months or years audited, verified, and locked by the authorized shop management"}
                    </p>
                  </div>

                  {!(shopData.closings) || shopData.closings.length === 0 ? (
                    <div className="py-12 text-center text-slate-500 text-xs font-sans">
                      {language === "kh" ? "មិនទាន់មានកំណត់ត្រាបិទបញ្ជីនៅឡើយទេ" : "No closed period ledger found."}
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-slate-850">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead className="bg-slate-950">
                          <tr className="text-slate-400 border-b border-slate-850">
                            <th className="p-3 font-medium">{language === "kh" ? "គ្រាគណនេយ្យ" : "Period Key"}</th>
                            <th className="p-3 font-medium">{language === "kh" ? "ប្រភេទគ្រា" : "Type"}</th>
                            <th className="p-3 font-medium text-right">{language === "kh" ? "លក់បាន (គ្រឿង)" : "Watch Sold"}</th>
                            <th className="p-3 font-medium text-right">{language === "kh" ? "ចំណូលលក់" : "Sales Revenue"}</th>
                            <th className="p-3 font-medium text-right">{language === "kh" ? "ចំណេញដុល" : "Gross Profit"}</th>
                            <th className="p-3 font-medium text-right">{language === "kh" ? "ចំណាយ OPEX" : "Total OPEX"}</th>
                            <th className="p-3 font-medium text-right">{language === "kh" ? "ចំណេញសុទ្ធ" : "Net Profit"}</th>
                            <th className="p-3 font-medium">{language === "kh" ? "បិទដោយ" : "Closed By"}</th>
                            <th className="p-3 font-medium text-center">{language === "kh" ? "សកម្មភាព" : "Actions"}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-850 bg-slate-900/40 font-sans">
                          {shopData.closings.slice().reverse().map((c) => {
                            return (
                              <tr key={c.id} className="hover:bg-slate-800/10 transition-colors">
                                <td className="p-3 font-mono font-bold text-amber-500">{c.periodKey}</td>
                                <td className="p-3">
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase font-sans ${
                                    c.type === "month" ? "bg-sky-500/10 text-sky-400" : "bg-purple-500/10 text-purple-400"
                                  }`}>
                                    {c.type === "month" ? (language === "kh" ? "ប្រចាំខែ" : "Month") : (language === "kh" ? "ប្រចាំឆ្នាំ" : "Year")}
                                  </span>
                                </td>
                                <td className="p-3 text-right font-mono text-slate-300">{c.salesCount}</td>
                                <td className="p-3 text-right font-mono text-slate-300">${c.totalSales.toLocaleString()}</td>
                                <td className="p-3 text-right font-mono text-amber-400">${c.grossProfit.toLocaleString()}</td>
                                <td className="p-3 text-right font-mono text-rose-400">-${c.totalExpenses.toLocaleString()}</td>
                                <td className={`p-3 text-right font-mono font-black ${c.netProfit >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                                  ${c.netProfit.toLocaleString()}
                                </td>
                                <td className="p-3 text-slate-300">
                                  <div className="font-medium text-slate-200">{c.closedBy}</div>
                                  <div className="text-[9px] text-slate-500 font-mono mt-0.5">{c.closedAt}</div>
                                </td>
                                <td className="p-3 text-center">
                                  <div className="flex items-center justify-center gap-2">
                                    <button
                                      onClick={() => setViewingClosedPeriod(c)}
                                      className="p-1 px-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded text-[10px] font-bold flex items-center gap-1 cursor-pointer transition"
                                      title={language === "kh" ? "មើលរបាយការណ៍លម្អិត" : "View closing statement"}
                                    >
                                      <FileText size={10} />
                                      <span>{language === "kh" ? "របាយការណ៍" : "Report"}</span>
                                    </button>
                                    <button
                                      onClick={() => handleDeleteClosedPeriod(c.id, c.periodKey)}
                                      className="p-1 text-slate-500 hover:text-rose-400 rounded hover:bg-rose-500/10 transition cursor-pointer"
                                      title={language === "kh" ? "លុបចោលការបិទបញ្ជី" : "Delete closed statement"}
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* SYSTEM SETTINGS VIEW */}
            {activeTab === "settings" && userRole === "owner" && (
              <div className="space-y-6 max-w-4xl mx-auto font-sans">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
                  <div>
                    <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                      <Settings className="text-amber-500" size={20} />
                      <span>{language === "kh" ? "ការកំណត់ប្រព័ន្ធរបស់ហាង" : "System & Store Settings"}</span>
                    </h2>
                    <p className="text-xs text-slate-400 mt-1">
                      {language === "kh" 
                        ? "គ្រប់គ្រងព័ត៌មានហាង កំណត់ក្រុមហ៊ុនដឹកជញ្ជូនលំនាំដើម ដែនកំណត់ចំណាយ និងការកំណត់ទូទៅរបស់ប្រព័ន្ធ។" 
                        : "Manage shop profile, configure default carriers, monthly expense budget limit, and other global features."}
                    </p>
                  </div>
                </div>

                <form onSubmit={handleSaveSettings} className="space-y-6">
                  {/* Card 1: Shop Profile Info */}
                  <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 md:p-6 space-y-4">
                    <h3 className="text-sm font-bold text-amber-500 border-b border-slate-800/60 pb-2 flex items-center gap-2">
                      <span className="w-1.5 h-3.5 bg-amber-500 rounded-full"></span>
                      <span>{language === "kh" ? "ព័ត៌មានទូទៅរបស់ហាង" : "Store Profile & Details"}</span>
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-slate-400 text-xs font-semibold mb-1.5 uppercase tracking-wide">
                          {language === "kh" ? "ឈ្មោះហាងលក់នាឡិកា *" : "Store Name *"}
                        </label>
                        <input
                          type="text"
                          required
                          value={settingsShopName}
                          onChange={(e) => setSettingsShopName(e.target.value)}
                          placeholder="ហាងនាឡិកាដៃគន្ធី"
                          className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl py-2.5 px-3.5 text-slate-200 text-xs focus:outline-none transition-all font-sans font-medium"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-400 text-xs font-semibold mb-1.5 uppercase tracking-wide">
                          {language === "kh" ? "លេខទូរស័ព្ទហាង" : "Contact Phone Number"}
                        </label>
                        <input
                          type="text"
                          value={settingsShopPhone}
                          onChange={(e) => setSettingsShopPhone(e.target.value)}
                          placeholder="012 345 678 / 098 765 432"
                          className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl py-2.5 px-3.5 text-slate-200 text-xs focus:outline-none transition-all font-sans font-medium"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Card 2: Checkout & System Presets */}
                  <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 md:p-6 space-y-4">
                    <h3 className="text-sm font-bold text-amber-500 border-b border-slate-800/60 pb-2 flex items-center gap-2">
                      <span className="w-1.5 h-3.5 bg-amber-500 rounded-full"></span>
                      <span>{language === "kh" ? "ការកំណត់លំនាំដើមនៃការលក់ និងគណនេយ្យ" : "Sales & Accounting Defaults"}</span>
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-slate-400 text-xs font-semibold mb-1.5 uppercase tracking-wide">
                          {language === "kh" ? "ឆានែលលក់លំនាំដើម" : "Default Sales Channel"}
                        </label>
                        <select
                          value={settingsDefaultSalesChannel}
                          onChange={(e) => setSettingsDefaultSalesChannel(e.target.value as any)}
                          className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl p-2.5 text-slate-200 text-xs focus:outline-none cursor-pointer"
                        >
                          <option value="instore">{language === "kh" ? "🛍️ លក់នៅហាងផ្ទាល់ (In-Store)" : "🛍️ In-Store Sale"}</option>
                          <option value="online">{language === "kh" ? "🌐 លក់តាមអនឡាញ (Online)" : "🌐 Online Sale"}</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-slate-400 text-xs font-semibold mb-1.5 uppercase tracking-wide">
                          {language === "kh" ? "អត្រាដូរប្រាក់លំនាំដើម (1$ = ៛ KHR)" : "Default Exchange Rate (1$ = ៛ KHR)"}
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            value={rateInput}
                            onChange={(e) => {
                              setRateInput(e.target.value);
                              const val = Number(e.target.value);
                              if (val > 0) {
                                setShopData(prev => ({ ...prev, exchangeRate: val }));
                              }
                            }}
                            className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl py-2.5 px-3.5 text-slate-200 text-xs focus:outline-none transition-all font-mono font-medium"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Card 3: COD & Delivery Configurations */}
                  <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 md:p-6 space-y-4">
                    <h3 className="text-sm font-bold text-amber-500 border-b border-slate-800/60 pb-2 flex items-center gap-2">
                      <span className="w-1.5 h-3.5 bg-amber-500 rounded-full"></span>
                      <span>{language === "kh" ? "ប្រព័ន្ធដឹកជញ្ជូន និងប្រមូលប្រាក់ COD" : "COD & Logistics Configuration"}</span>
                    </h3>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 bg-slate-950/40 rounded-xl border border-slate-800/50">
                        <div className="space-y-0.5 pr-4">
                          <div className="text-xs font-bold text-slate-200">{language === "kh" ? "បើកដំណើរការមុខងារប្រមូលប្រាក់ COD" : "Enable COD Payment Method"}</div>
                          <div className="text-[10px] text-slate-400">{language === "kh" ? "អនុញ្ញាតឱ្យជ្រើសរើស COD ពេលលក់នាឡិកាចេញ" : "Enable selection of Cash on Delivery payment mode during checkouts"}</div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={settingsEnableCod}
                            onChange={(e) => setSettingsEnableCod(e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-300 after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500"></div>
                        </label>
                      </div>

                      {settingsEnableCod && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 animate-in fade-in duration-200">
                          <div>
                            <label className="block text-slate-400 text-xs font-semibold mb-1.5 uppercase tracking-wide">
                              {language === "kh" ? "ក្រុមហ៊ុនដឹកជញ្ជូនលំនាំដើម" : "Default Carrier Partner"}
                            </label>
                            <select
                              value={settingsCodCarrierDefault}
                              onChange={(e) => setSettingsCodCarrierDefault(e.target.value)}
                              className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl p-2.5 text-slate-200 text-xs focus:outline-none cursor-pointer"
                            >
                              <option value="">{language === "kh" ? "— គ្មាន (ជ្រើសរើសដោយដៃ) —" : "— None (Select manually) —"}</option>
                              <option value="J&T">J&T Express</option>
                              <option value="VET">Virak Buntham (VET)</option>
                              <option value="CamboExpress">Cambo Express</option>
                              <option value="Capitol">Capitol Tour</option>
                              <option value="Grab">Grab Delivery</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-slate-400 text-xs font-semibold mb-1.5 uppercase tracking-wide">
                              {language === "kh" ? "ពន្ធដារលំនាំដើម (%)" : "Default Tax Percentage (%)"}
                            </label>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={settingsTaxPercent}
                              onChange={(e) => setSettingsTaxPercent(e.target.value !== "" ? Number(e.target.value) : "")}
                              placeholder="0"
                              className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl py-2.5 px-3.5 text-slate-200 text-xs focus:outline-none transition-all font-mono font-medium"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Card 4: Operating Budget Limits & Goals */}
                  <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 md:p-6 space-y-4">
                    <h3 className="text-sm font-bold text-amber-500 border-b border-slate-800/60 pb-2 flex items-center gap-2">
                      <span className="w-1.5 h-3.5 bg-amber-500 rounded-full"></span>
                      <span>{language === "kh" ? "គោលដៅលក់ និងដែនកំណត់ចំណាយ" : "Sales Goals & Operating Budgets"}</span>
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-slate-400 text-xs font-semibold mb-1.5 uppercase tracking-wide">
                          {language === "kh" ? "គោលដៅលក់ប្រចាំថ្ងៃ ($)" : "Daily Sales Goal ($)"}
                        </label>
                        <input
                          type="number"
                          value={dailySalesGoal}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setDailySalesGoal(val);
                            localStorage.setItem("kunthy_daily_sales_goal", val.toString());
                          }}
                          className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl py-2.5 px-3.5 text-slate-200 text-xs focus:outline-none transition-all font-mono font-medium"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-400 text-xs font-semibold mb-1.5 uppercase tracking-wide">
                          {language === "kh" ? "គោលដៅលក់ប្រចាំខែ ($)" : "Monthly Sales Goal ($)"}
                        </label>
                        <input
                          type="number"
                          value={monthlySalesGoal}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setMonthlySalesGoal(val);
                            localStorage.setItem("kunthy_monthly_sales_goal", val.toString());
                          }}
                          className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl py-2.5 px-3.5 text-slate-200 text-xs focus:outline-none transition-all font-mono font-medium"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-400 text-xs font-semibold mb-1.5 uppercase tracking-wide">
                          {language === "kh" ? "កញ្ចប់ថវិការចំណាយប្រចាំខែ ($)" : "Monthly Expense Budget ($)"}
                        </label>
                        <input
                          type="number"
                          value={budgetLimitInput}
                          onChange={(e) => {
                            const val = e.target.value !== "" ? Number(e.target.value) : "";
                            setBudgetLimitInput(val);
                            if (val !== "") {
                              setShopData(prev => ({ ...prev, monthlyExpenseBudget: val }));
                            }
                          }}
                          placeholder={shopData.monthlyExpenseBudget ? shopData.monthlyExpenseBudget.toString() : "2000"}
                          className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl py-2.5 px-3.5 text-slate-200 text-xs focus:outline-none transition-all font-mono font-medium"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Form Submission Actions */}
                  <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        // Reset inputs from data
                        if (shopData?.settings) {
                          setSettingsShopName(shopData.settings.shopName || "");
                          setSettingsShopPhone(shopData.settings.shopPhone || "");
                          setSettingsDefaultSalesChannel(shopData.settings.defaultSalesChannel || "instore");
                          setSettingsEnableCod(shopData.settings.enableCod !== false);
                          setSettingsCodCarrierDefault(shopData.settings.codCarrierDefault || "");
                          setSettingsTaxPercent(shopData.settings.taxPercent !== undefined ? shopData.settings.taxPercent : "");
                        }
                        showNotice("success", language === "kh" ? "🔄 បានបោះបង់ការផ្លាស់ប្តូរ!" : "🔄 Changes discarded!");
                      }}
                      className="px-5 py-2.5 rounded-xl border border-slate-800 bg-slate-950 hover:bg-slate-900 text-slate-300 text-xs font-bold transition-all cursor-pointer"
                    >
                      {language === "kh" ? "បោះបង់" : "Discard"}
                    </button>
                    <button
                      type="submit"
                      className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-slate-950 text-xs font-bold transition-all cursor-pointer shadow-lg shadow-amber-500/10 flex items-center gap-1.5"
                    >
                      <span>💾</span>
                      <span>{language === "kh" ? "រក្សាទុកការកំណត់" : "Save Configurations"}</span>
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* 6. AI ASSISTANT VIEW */}
            {activeTab === "ai" && (
              <AIChatSection shopData={shopData} />
            )}

          </div>
        )}

      </main>

      {/* ERP DATABASE BACKUP & RESTORE CENTER MODAL */}
      {isBackupModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 overflow-y-auto">
          <div className={`w-full max-w-2xl rounded-2xl border p-6 md:p-8 shadow-2xl relative transition-all animate-in fade-in zoom-in-95 duration-200 ${sModalBg}`}>
            {/* Close button */}
            <button
              onClick={() => setIsBackupModalOpen(false)}
              className={`absolute top-4 right-4 p-1.5 rounded-xl border ${sBorder} ${theme === "dark" ? "bg-slate-800 hover:bg-slate-700 text-slate-400" : "bg-zinc-100 hover:bg-zinc-200 text-zinc-500"} transition-colors cursor-pointer`}
              title={t.closeBtn}
            >
              <X size={16} />
            </button>

            {/* Header */}
            <div className="flex items-center gap-3 border-b pb-4 mb-5 dark:border-slate-800 border-zinc-150">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500">
                <Database size={20} />
              </div>
              <div>
                <h3 className="text-sm font-black tracking-wide font-serif">
                  {language === "kh" ? "មជ្ឈមណ្ឌល រក្សាទុក & សង្គ្រោះទិន្នន័យ ERP" : "ERP Database Backup & Restore Center"}
                </h3>
                <p className={`text-[10px] ${sTextMuted} mt-0.5`}>
                  {language === "kh" 
                    ? "គ្រប់គ្រងការចម្លងទុក ឬទាញយកទិន្នន័យស្តុក វិក្កយបត្រ ចំណាយ និងបុគ្គលិក" 
                    : "Manage copying or downloading stock, invoices, expenses, and staff accounts"}
                </p>
              </div>
            </div>

            {/* Content Cards */}
            <div className="space-y-5">
              {/* Card 1: Export */}
              <div className={`border ${sBorder} rounded-xl p-4 md:p-5 bg-emerald-500/[0.01] hover:bg-emerald-500/[0.02] transition-colors`}>
                <h4 className="text-xs font-bold text-emerald-500 uppercase tracking-wider mb-2.5 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/10 text-emerald-500 text-[10px] font-bold flex items-center justify-center">១</span>
                  {language === "kh" ? "ចម្លងទុកទិន្នន័យ (Export Database to JSON)" : "Export Database to JSON"}
                </h4>
                
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div className="flex items-start gap-3.5 flex-1">
                    <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-500 shrink-0 mt-0.5">
                      <Download size={24} />
                    </div>
                    <p className={`text-xs ${sTextMuted} leading-relaxed max-w-md`}>
                      {language === "kh" 
                        ? "រក្សាទុករាល់ទិន្នន័យផលិតផលក្នុងស្តុក វិក្កយបត្រលក់ចេញ បញ្ជីចំណាយ និងគណនីបុគ្គលិក ទៅជាឯកសារ JSON ក្នុងកុំព្យូទ័ររបស់អ្នក ដើម្បីបង្ការការបាត់បង់ដោយចៃដន្យ។"
                        : "Backup all stock products, sales invoices, expense logs, and employee accounts to a JSON file on your computer to prevent accidental loss."}
                    </p>
                  </div>
                  <button
                    onClick={triggerDataBackup}
                    className="w-full md:w-auto bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white font-black py-2.5 px-4.5 rounded-xl text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md shadow-emerald-600/10 shrink-0"
                  >
                    <Download size={14} className="stroke-[2.5]" />
                    <span>{language === "kh" ? "ទាញយក Backup File (Download Backup)" : "Download Backup"}</span>
                  </button>
                </div>
              </div>

              {/* Card 2: Import / Restore */}
              <div className={`border ${sBorder} rounded-xl p-4 md:p-5 bg-teal-500/[0.01] hover:bg-teal-500/[0.02] transition-colors`}>
                <h4 className="text-xs font-bold text-teal-500 uppercase tracking-wider mb-2.5 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-teal-500/10 text-teal-500 text-[10px] font-bold flex items-center justify-center">២</span>
                  {language === "kh" ? "សង្គ្រោះទិន្នន័យពីក្រៅ (Restore Backup File)" : "Restore Backup File"}
                </h4>

                {/* Drag and Drop Zone */}
                <label className="block cursor-pointer">
                  <input
                    type="file"
                    accept=".json"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleRestoreBackupFile(file);
                      e.target.value = ''; // Reset
                    }}
                  />
                  <div
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const file = e.dataTransfer.files?.[0];
                      if (file) handleRestoreBackupFile(file);
                    }}
                    className={`border-2 border-dashed ${theme === "dark" ? "border-slate-800 hover:border-teal-500/50 bg-slate-950/40" : "border-zinc-200 hover:border-teal-500/50 bg-zinc-50/50"} rounded-xl p-6 flex flex-col items-center justify-center gap-3 transition-all duration-200 text-center group`}
                  >
                    <div className="w-12 h-12 rounded-full bg-teal-500/10 flex items-center justify-center text-teal-500 group-hover:scale-105 transition-transform duration-200">
                      <UploadCloud size={24} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-300 dark:text-slate-200 group-hover:text-teal-400 transition-colors">
                        {language === "kh" ? "អូសទម្លាក់ Backup JSON នៅទីនេះ ឬ ចុចដើម្បីជ្រើសរើស" : "Drag & drop Backup JSON here or click to choose"}
                      </p>
                      <p className={`text-[10px] ${sTextMuted} mt-1`}>
                        {language === "kh" ? "គាំទ្រតែប្រភេទឯកសារ (*.json) ប៉ុណ្ណោះ" : "Supports only *.json backup file format"}
                      </p>
                    </div>
                  </div>
                </label>
              </div>
            </div>

            {/* Bottom action bar */}
            <div className={`mt-6 pt-4 border-t dark:border-slate-800 border-zinc-150 flex justify-end`}>
              <button
                onClick={() => setIsBackupModalOpen(false)}
                className={`px-4 py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                  theme === "dark" 
                    ? "bg-slate-800 hover:bg-slate-750 border-slate-700 text-slate-300" 
                    : "bg-zinc-100 hover:bg-zinc-200 border-zinc-200 text-zinc-700"
                }`}
              >
                {language === "kh" ? "បិទចោល" : "Close"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PWA INSTALL / LINK TO PC MODAL */}
      {showInstallModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className={`w-full max-w-lg rounded-2xl border p-6 md:p-8 shadow-2xl relative transition-all animate-in fade-in zoom-in-95 duration-200 ${sModalBg}`}>
            {/* Close button */}
            <button
              onClick={() => {
                setShowInstallModal(false);
                setCopiedLink(false);
              }}
              className={`absolute top-4 right-4 p-1.5 rounded-xl border ${sBorder} ${theme === "dark" ? "bg-slate-800 hover:bg-slate-700 text-slate-400" : "bg-zinc-100 hover:bg-zinc-200 text-zinc-500"} transition-colors cursor-pointer`}
              title={t.closeBtn}
            >
              <X size={16} />
            </button>

            {/* Header */}
            <div className="flex items-center gap-3 border-b pb-4 mb-5 dark:border-slate-800 border-zinc-150">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
                <Laptop size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold font-serif text-amber-500">
                  {t.installTitle}
                </h3>
                <p className={`text-xs ${sTextMuted}`}>
                  {language === "kh" ? "បន្ទុករហ័ស និងបើកផ្ទាំងកម្មវិធីដាច់ដោយឡែក" : "Fast load & standalone window desktop client"}
                </p>
              </div>
            </div>

            {/* Dynamic Banner: Show Install Button if deferred prompt exists, otherwise teach how to open in new tab */}
            {deferredPrompt ? (
              <div className="bg-emerald-500/10 border border-emerald-500/35 rounded-xl p-4.5 mb-5 space-y-3 font-sans text-left">
                <p className="text-xs text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-2">
                  <span className="text-base">🚀</span>
                  {language === "kh" 
                    ? "រកឃើញប្រព័ន្ធដំឡើងកម្មវិធី!" 
                    : "Ready to Install Standalone Client!"}
                </p>
                <p className="text-[11px] leading-relaxed text-zinc-600 dark:text-slate-350">
                  {language === "kh" 
                    ? "កម្មវិធីរបស់អ្នករួចរាល់សម្រាប់ការដំឡើងផ្ទាល់ទៅលើកុំព្យូទ័រ (PC / Laptop) ឬទូរស័ព្ទរបស់លោកអ្នកហើយ។ វានឹងបង្កើតរូបតំណាងនៅលើ Desktop ហើយបើកចំណុចបម្រើទិន្នន័យដាច់ដោយឡែកល្បឿនលឿន។" 
                    : "The system has detected that this app is ready to install as a standalone client on your computer or device. It will add a desktop icon and open in a fast, clean app window."}
                </p>
                <button
                  onClick={handleNativeInstall}
                  className="w-full py-3 bg-emerald-500 hover:bg-emerald-605 text-slate-950 font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all shadow-md hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
                >
                  <Laptop size={14} className="stroke-[2.5]" />
                  {language === "kh" ? "👉 ចុចទីនេះដើម្បីដំឡើងកម្មវិធីឥឡូវនេះ (Install App)" : "👉 Click to Install Standalone App Now"}
                </button>
              </div>
            ) : (
              <div className="bg-amber-500/10 border border-amber-500/35 rounded-xl p-4.5 mb-5 space-y-3 font-sans text-left">
                <p className="text-xs text-amber-600 dark:text-amber-400 font-bold flex items-center gap-2">
                  <span className="text-base">⚠️</span>
                  {language === "kh" 
                    ? "ចំណាំសំខាន់បំផុត ដើម្បីអាចដំឡើងបាន៖" 
                    : "Critical requirement to install:"}
                </p>
                <p className="text-[11px] leading-relaxed text-zinc-600 dark:text-slate-350">
                  {language === "kh" 
                    ? "ដោយសារកម្មវិធីនេះកំពុងរត់នៅក្នុងប្រអប់ Preview Chat របស់ AI Studio ដូច្នេះកម្មវិធីរុករក (Chrome Browser) មិនអនុញ្ញាតឱ្យចុចដំឡើងបានទេ! លោកអ្នកត្រូវតែចុចបើកវានៅក្នុង Tab ថ្មីជាមុនសិន។" 
                    : "Since the app is currently running inside the AI Studio Chat preview iframe, browser installation is nested and blocked. You must open it as a direct full page."}
                </p>
                <a
                  href={currentAppUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all shadow-md hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
                >
                  <Laptop size={14} className="stroke-[2.5]" />
                  {language === "kh" ? "👉 ចុចបើកក្នុង Tab ថ្មី លើ PC/ទូរស័ព្ទ (Open Direct App on PC)" : "👉 Open Direct App on PC to Install"}
                </a>
              </div>
            )}

            {/* Interactive parts: QR Code & Copy Link */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 items-center bg-amber-500/5 dark:bg-amber-500/3 border border-amber-500/10 rounded-xl p-4 mb-5">
              <div className="sm:col-span-1 flex flex-col items-center justify-center bg-white p-2.5 rounded-lg shadow-sm border border-zinc-200">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=130x130&data=${encodeURIComponent(currentAppUrl)}`}
                  alt="App QR Code"
                  referrerPolicy="no-referrer"
                  className="w-[110px] h-[110px]"
                />
                <span className="text-[9px] text-zinc-500 mt-1 font-sans font-medium">Scan to open URL</span>
              </div>
              <div className="sm:col-span-2 space-y-2">
                <h4 className="text-xs font-bold text-amber-500">
                  {language === "kh" ? "តំណភ្ជាប់កម្មវិធីល្បឿនលឿន (PWA Link)" : "Direct Install Link"}
                </h4>
                <p className="text-[10px] font-mono select-all break-all overflow-hidden bg-slate-950/20 dark:bg-slate-950/60 border border-zinc-200 dark:border-slate-850 p-2 rounded-lg text-slate-400">
                  {currentAppUrl}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(currentAppUrl);
                      setCopiedLink(true);
                      setTimeout(() => setCopiedLink(false), 2000);
                    }}
                    className="flex-1 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-[11px] rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    {copiedLink ? (
                      <>
                        <Check size={11} className="stroke-[2.5]" />
                        {language === "kh" ? "បានចម្លងរួច!" : "Copied!"}
                      </>
                    ) : (
                      <>
                        <Copy size={11} />
                        {language === "kh" ? "ចម្លងតំណភ្ជាប់" : "Copy PC Link"}
                      </>
                    )}
                  </button>
                  <a
                    href={currentAppUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`px-3 py-1.5 rounded-lg border text-[11px] font-semibold flex items-center justify-center gap-1 transition-colors ${
                      theme === "dark" 
                        ? "bg-slate-850 hover:bg-slate-800 border-slate-700 text-slate-350 hover:text-slate-200" 
                        : "bg-white hover:bg-zinc-100 border-zinc-250 text-zinc-600"
                    }`}
                  >
                    <Laptop size={11} />
                    {language === "kh" ? "បើកលើ PC" : "Open PC Link"}
                  </a>
                </div>
              </div>
            </div>

            {/* Devices Selector Tabs */}
            <div className="flex border-b border-zinc-200 dark:border-slate-800 mb-4 pb-1 font-sans text-xs">
              <button
                type="button"
                onClick={() => setInstallDeviceTab("pc")}
                className={`flex-1 py-2 text-center border-b-2 font-semibold transition-all cursor-pointer ${
                  installDeviceTab === "pc"
                    ? "border-amber-500 text-amber-500 font-bold"
                    : "border-transparent text-slate-400 hover:text-slate-350"
                }`}
              >
                💻 {language === "kh" ? "កុំព្យូទ័រ (PC / Mac)" : "PC / Laptop"}
              </button>
              <button
                type="button"
                onClick={() => setInstallDeviceTab("android")}
                className={`flex-1 py-2 text-center border-b-2 font-semibold transition-all cursor-pointer ${
                  installDeviceTab === "android"
                    ? "border-amber-500 text-amber-500 font-bold"
                    : "border-transparent text-slate-400 hover:text-slate-350"
                }`}
              >
                🤖 Android (Chrome)
              </button>
              <button
                type="button"
                onClick={() => setInstallDeviceTab("ios")}
                className={`flex-1 py-2 text-center border-b-2 font-semibold transition-all cursor-pointer ${
                  installDeviceTab === "ios"
                    ? "border-amber-500 text-amber-500 font-bold"
                    : "border-transparent text-slate-400 hover:text-slate-350"
                }`}
              >
                🍎 iPhone (Safari)
              </button>
            </div>

            {/* Steps list */}
            <div className="space-y-3">
              {installDeviceTab === "pc" && (
                <div className="space-y-4 text-left">
                  <h4 className={`text-xs font-bold ${theme === "dark" ? "text-slate-250" : "text-zinc-700"} flex items-center gap-1.5`}>
                    <span>🔧</span>
                    {language === "kh" ? "របៀបដំឡើងលើកុំព្យូទ័រ (មិនចាំបាច់ប្រើ Google Chrome)" : "How to Install on PC (Without Google Chrome)"}
                  </h4>
                  
                  {/* Option 1: Microsoft Edge */}
                  <div className="space-y-2 border-l-2 border-amber-500/40 pl-3">
                    <p className="text-[11px] font-bold text-amber-500">
                      {language === "kh" ? "👉 វិធីទី១៖ ប្រើកម្មវិធី Microsoft Edge (មានស្រាប់លើ Windows)" : "Option 1: Using Microsoft Edge (Pre-installed on Windows)"}
                    </p>
                    <ul className={`space-y-2 text-[11px] ${sTextMuted} font-sans leading-relaxed`}>
                      <li className="flex items-start gap-2">
                        <span className="w-5 h-5 rounded-full bg-amber-500/10 text-amber-500 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">1</span>
                        <span>{language === "kh" ? "ចុចបើកតំណខាងលើក្នុង Microsoft Edge (Open Direct App)" : "Click the link above to open in Microsoft Edge"}</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="w-5 h-5 rounded-full bg-amber-500/10 text-amber-500 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">2</span>
                        <span>{language === "kh" ? "ចុចលើសញ្ញា «App Available» (សញ្ញាការ៉េបី និងសញ្ញាបូក ➕) នៅផ្នែកខាងស្តាំនៃរបារ URL ខាងលើ" : "Look for the [App Available] icon (three squares with a plus ➕) on the right side of the address bar at the top"}</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="w-5 h-5 rounded-full bg-amber-500/10 text-amber-500 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">3</span>
                        <span>{language === "kh" ? "ឬចុចលើ សញ្ញាចុចបី (...) នៅស្តាំបំផុត រួចជ្រើសរើសយក «Apps» ➔ «Install this site as an app»" : "Or click the browser menu dots (...) at the top right, select 'Apps' -> 'Install this site as an app'"}</span>
                      </li>
                    </ul>
                  </div>

                  {/* Option 2: Safari on Mac */}
                  <div className="space-y-2 border-l-2 border-slate-500/30 pl-3">
                    <p className="text-[11px] font-bold text-slate-400">
                      {language === "kh" ? "🍏 វិធីទី២៖ សម្រាប់កុំព្យូទ័រ Mac (ប្រើ Safari)" : "Option 2: For Mac users (using Safari)"}
                    </p>
                    <ul className={`space-y-2 text-[11px] ${sTextMuted} font-sans leading-relaxed`}>
                      <li className="flex items-start gap-2">
                        <span className="w-5 h-5 rounded-full bg-slate-500/10 text-slate-450 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">1</span>
                        <span>{language === "kh" ? "បើកតំណភ្ជាប់ខាងលើជាមួយកម្មវិធី Safari" : "Open the direct link from above using macOS Safari browser"}</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="w-5 h-5 rounded-full bg-slate-500/10 text-slate-450 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">2</span>
                        <span>{language === "kh" ? "ចុចលើមឺនុយ «File» នៅខាងលើបង្អស់ រួចជ្រើសរើសយក «Add to Dock...»" : "Click 'File' menu in the top screen bar and select 'Add to Dock...'"}</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="w-5 h-5 rounded-full bg-slate-500/10 text-slate-450 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">3</span>
                        <span>{language === "kh" ? "កម្មវិធីនឹងបង្កើតរូបតំណាងនៅលើ Dock និង Launchpad ស្រស់ស្អាតដូចកម្មវិធី Mac ទូទៅ!" : "It will create a native app icon on your Dock and Launchpad, launching in a fast standalone window!"}</span>
                      </li>
                    </ul>
                  </div>

                  {/* Benefit notice */}
                  <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-[11px] text-amber-500 font-medium">
                    📍 {language === "kh" ? "នៅពេលដំឡើងរួច វានឹងបង្កើតរូបតំណាង (Icon) នៅលើ Desktop កុំព្យូទ័ររបស់អ្នក បើកមកទំហំពេញអេក្រង់ រលូន លឿន និងងាយស្រួលបំផុត!" : "Once installed, it will place a shortcut icon on your Desktop, running smoothly in full standalone screen with maximum speed!"}
                  </div>
                </div>
              )}

              {installDeviceTab === "android" && (
                <div className="space-y-3 text-left">
                  <h4 className={`text-xs font-bold ${theme === "dark" ? "text-slate-250" : "text-zinc-700"} flex items-center gap-1.5`}>
                    <span>🔧</span>
                    {language === "kh" ? "របៀបដំឡើងលើ Android (Google Chrome)" : "How to Install on Android"}
                  </h4>
                  <ul className={`space-y-2 text-[11px] ${sTextMuted} font-sans leading-relaxed`}>
                    <li className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-amber-500/10 text-amber-500 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">1</span>
                      <span>{language === "kh" ? "បើកតំណភ្ជាប់កម្មវិធីក្នុងទូរស័ព្ទរបស់អ្នកជាមួយកម្មវិធីរុករក Chrome" : "Open this direct web link on your android system using Google Chrome browser"}</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-amber-500/10 text-amber-500 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">2</span>
                      <span>{language === "kh" ? "ចុចលើសញ្ញាចុចបី (⋮) ជ្រុងខាងស្តាំខាងលើនៃកម្មវិធីរុករក Chrome" : "Tap the settings dots (⋮) in the top-right corner of Chrome on your android phone"}</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-amber-500/10 text-amber-500 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">3</span>
                      <span>{language === "kh" ? "ជ្រើសរើសយកពាក្យ «Install app» (ដំឡើងកម្មវិធី) ឬ «Add to Home screen» (បន្ថែមទៅអេក្រង់ដើម)" : "Select \"Install app\" or \"Add to Home screen\" option from menu"}</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-amber-500/10 text-amber-500 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">4</span>
                      <span>{language === "kh" ? "ចុចពាក្យថា «Install» (ដំឡើង) ដើម្បីបញ្ចប់ការដំឡើង" : "Confirm the installation by tapping \"Install\" button"}</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-amber-500/10 text-amber-500 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">5</span>
                      <span>{language === "kh" ? "ប្រព័ន្ធនឹងទាញយកកម្មវិធី ហើយលោកអ្នកអាចបើកប្រើប្រាស់ពីអេក្រង់ទូរស័ព្ទបានភ្លាមៗ!" : "Open it directly from your Mobile apps list like a real app client!"}</span>
                    </li>
                  </ul>
                </div>
              )}

              {installDeviceTab === "ios" && (
                <div className="space-y-3 text-left">
                  <h4 className={`text-xs font-bold ${theme === "dark" ? "text-slate-250" : "text-zinc-700"} flex items-center gap-1.5`}>
                    <span>🔧</span>
                    {language === "kh" ? "របៀបដំឡើងលើ iPhone / iPad (កម្មវិធី Safari)" : "How to Install on iPhone / iPad"}
                  </h4>
                  <ul className={`space-y-2 text-[11px] ${sTextMuted} font-sans leading-relaxed`}>
                    <li className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-amber-500/10 text-amber-500 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">1</span>
                      <span>{language === "kh" ? "បើកតំណភ្ជាប់កម្មវិធីជាមួយកម្មវិធីរុករក Safari (ចាំបាច់បំផុត)" : "Open this web link inside your default iOS Safari browser (Safari is required on iPhone/iPad)"}</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-amber-500/10 text-amber-500 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">2</span>
                      <span>{language === "kh" ? "ចុចលើប៊ូតុង «Share» (រូបតំណាងប្រអប់មួយមានព្រួញឡើងលើ 📤) នៅរបារខាងក្រោម" : "Tap the \"Share\" action icon (the arrow pointing out of a square tray 📤) at the bottom tab selection"}</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-amber-500/10 text-amber-500 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">3</span>
                      <span>{language === "kh" ? "អូសចុះមកខាងក្រោម រួចជ្រើសរើសយក «Add to Home Screen» (បន្ថែមទៅអេក្រង់ដើម)" : "Swipe down on options list and choose \"Add to Home Screen\" option"}</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-amber-500/10 text-amber-500 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">4</span>
                      <span>{language === "kh" ? "ចុចពាក្យ «Add» (បន្ថែម) នៅជ្រុងស្តាំខាងលើដើម្បីរក្សាទុក" : "Tap the \"Add\" setup action at the top right header"}</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-amber-500/10 text-amber-500 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">5</span>
                      <span>{language === "kh" ? "រូបតំណាង «Kunthy Watch» នឹងលេចឡើងលើអេក្រង់ទូរស័ព្ទរបស់អ្នក" : "The logo of \"Kunthy Watch\" will appear beautifully as an application on your iOS screen!"}</span>
                    </li>
                  </ul>
                </div>
              )}
            </div>

            {/* Bottom action */}
            <div className="mt-6 pt-4 border-t dark:border-slate-800 border-zinc-150 flex justify-end">
              <button
                onClick={() => {
                  setShowInstallModal(false);
                  setCopiedLink(false);
                }}
                className={`px-4 py-2 text-xs font-semibold rounded-xl border transition-colors cursor-pointer ${
                  theme === "dark" 
                    ? "bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300" 
                    : "bg-zinc-100 hover:bg-zinc-200 border-zinc-200 text-zinc-700"
                }`}
              >
                {t.closeBtn}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ✏️ Edit Sale Modal Overlay */}
      {editingSale && (
        <div className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-[4px] flex items-center justify-center p-4 overflow-y-auto font-sans">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 bg-slate-950 border-b border-slate-850">
              <div className="flex items-center gap-2.5">
                <Pencil size={18} className="text-amber-500" />
                <div>
                  <h3 className="text-sm font-bold text-slate-100 font-serif">
                    {language === "kh" ? "កែប្រែកំណត់ត្រាការលក់" : "Edit Sale Record"}
                  </h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    {language === "kh"
                      ? `កូដវិក្កយបត្រ៖ ${editingSale.id} | ${editingSale.watchBrand} ${editingSale.watchModel}`
                      : `Invoice ID: ${editingSale.id} | ${editingSale.watchBrand} ${editingSale.watchModel}`}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setEditingSale(null)}
                className="p-1.5 text-slate-500 hover:text-slate-300 rounded-lg cursor-pointer hover:bg-slate-850 transition"
              >
                <X size={18} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleUpdateSale} className="p-6 space-y-4">
              {editSaleError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs font-medium">
                  {editSaleError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                {/* Date */}
                <div className="space-y-1.5">
                  <label className="text-[11px] text-slate-400 font-medium">
                    {language === "kh" ? "កាលបរិច្ឆេទលក់" : "Sale Date"}
                  </label>
                  <input
                    type="date"
                    required
                    value={editSaleDate}
                    onChange={(e) => setEditSaleDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500 transition font-mono"
                  />
                </div>

                {/* Color */}
                <div className="space-y-1.5">
                  <label className="text-[11px] text-slate-400 font-medium">
                    {language === "kh" ? "ពណ៌នាឡិកា" : "Watch Color"}
                  </label>
                  <input
                    type="text"
                    value={editSaleColor}
                    onChange={(e) => setEditSaleColor(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500 transition"
                    placeholder={language === "kh" ? "ឧ. ខ្មៅ មាស" : "e.g. Black, Gold"}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Quantity */}
                <div className="space-y-1.5">
                  <label className="text-[11px] text-slate-400 font-medium">
                    {language === "kh" ? "បរិមាណលក់ (Quantity)" : "Quantity"}
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={editSaleQuantity}
                    onChange={(e) => setEditSaleQuantity(e.target.value === "" ? "" : Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500 transition font-mono font-bold"
                  />
                </div>

                {/* Unit Sell Price */}
                <div className="space-y-1.5">
                  <label className="text-[11px] text-slate-400 font-medium">
                    {language === "kh" ? "តម្លៃលក់ដើម ($)" : "Original Sell Price ($)"}
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    required
                    value={editSaleSellPrice}
                    onChange={(e) => setEditSaleSellPrice(e.target.value === "" ? "" : Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500 transition font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Discount % */}
                <div className="space-y-1.5">
                  <label className="text-[11px] text-slate-400 font-medium">
                    {language === "kh" ? "ភាគរយបញ្ចុះតម្លៃ (%)" : "Discount Percent (%)"}
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={editSaleDiscountPercent}
                    onChange={(e) => setEditSaleDiscountPercent(e.target.value === "" ? "" : Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500 transition font-mono"
                  />
                </div>

                {/* Channel */}
                <div className="space-y-1.5">
                  <label className="text-[11px] text-slate-400 font-medium">
                    {language === "kh" ? "ប្រភពលក់" : "Sales Channel"}
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setEditSaleSaleChannel("instore")}
                      className={`py-1.5 rounded-xl border text-[11px] font-medium transition ${
                        editSaleSaleChannel === "instore"
                          ? "bg-amber-500/10 border-amber-500/20 text-amber-400"
                          : "bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-300"
                      }`}
                    >
                      {language === "kh" ? "លក់នៅហាង" : "In-store"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditSaleSaleChannel("online")}
                      className={`py-1.5 rounded-xl border text-[11px] font-medium transition ${
                        editSaleSaleChannel === "online"
                          ? "bg-amber-500/10 border-amber-500/20 text-amber-400"
                          : "bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-300"
                      }`}
                    >
                      Online
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {/* Payment Method */}
                <div className="space-y-1.5 col-span-2">
                  <label className="text-[11px] text-slate-400 font-medium">
                    {language === "kh" ? "វិធីទូទាត់" : "Payment Method"}
                  </label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {(["cash", "aba", "acleda", "cod"] as const).map((method) => (
                      <button
                        key={method}
                        type="button"
                        onClick={() => setEditSalePaymentMethod(method)}
                        className={`py-1.5 rounded-xl border text-[10px] font-black uppercase tracking-wider transition ${
                          editSalePaymentMethod === method
                            ? "bg-amber-500/10 border-amber-500/20 text-amber-400"
                            : "bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-300"
                        }`}
                      >
                        {method}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Currency */}
                <div className="space-y-1.5">
                  <label className="text-[11px] text-slate-400 font-medium">
                    {language === "kh" ? "រូបិយប័ណ្ណ" : "Currency"}
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setEditSalePaymentCurrency("USD")}
                      className={`py-1.5 rounded-xl border text-[10px] font-black transition ${
                        editSalePaymentCurrency === "USD"
                          ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                          : "bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-300"
                      }`}
                    >
                      USD
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditSalePaymentCurrency("KHR")}
                      className={`py-1.5 rounded-xl border text-[10px] font-black transition ${
                        editSalePaymentCurrency === "KHR"
                          ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                          : "bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-300"
                      }`}
                    >
                      KHR
                    </button>
                  </div>
                </div>
              </div>

              {/* Customer Info (Phone & Location) */}
              <div className="bg-slate-950/40 p-4 rounded-2xl border border-slate-850 space-y-2">
                <span className="text-[11px] font-bold text-amber-500 uppercase tracking-widest block">
                  👤 {language === "kh" ? "ព័ត៌មានអតិថិជន (ទីតាំង & ទូរស័ព្ទ)" : "Customer Information"}
                </span>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[11px] text-slate-400 font-medium">
                      {language === "kh" ? "លេខទូរស័ព្ទ" : "Phone Number"}
                    </label>
                    <input
                      type="text"
                      value={editSaleCustomerPhone}
                      onChange={(e) => setEditSaleCustomerPhone(e.target.value)}
                      placeholder={language === "kh" ? "ឧ. 012345678" : "e.g., 012345678"}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500 font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] text-slate-400 font-medium">
                      {language === "kh" ? "ទីតាំង/ខេត្ត-ក្រុង" : "Location/Province"}
                    </label>
                    <input
                      type="text"
                      value={editSaleCustomerLocation}
                      onChange={(e) => setEditSaleCustomerLocation(e.target.value)}
                      placeholder={language === "kh" ? "ឧ. ភ្នំពេញ, សៀមរាប" : "e.g., Phnom Penh, Siem Reap"}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500 font-sans"
                    />
                  </div>
                </div>
              </div>

              {/* Status & calculations preview */}
              <div className="bg-slate-950/40 rounded-2xl border border-slate-850 p-4 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">
                    {language === "kh" ? "ស្ថានភាពទូទាត់៖" : "Payment Status:"}
                  </span>
                  <button
                    type="button"
                    onClick={() => setEditSaleIsPaid(!editSaleIsPaid)}
                    className={`px-3 py-1 rounded-xl text-[10px] font-bold border transition ${
                      editSaleIsPaid
                        ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                        : "bg-rose-500/10 border-rose-500/20 text-rose-400"
                    }`}
                  >
                    {editSaleIsPaid 
                      ? (language === "kh" ? "✓ បានបង់ (PAID)" : "✓ PAID") 
                      : (language === "kh" ? "✗ មិនទាន់បង់ (UNPAID)" : "✗ UNPAID")}
                  </button>
                </div>

                <div className="h-[1px] bg-slate-850" />

                {/* Calculation Summary Preview */}
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div className="space-y-1">
                    <div className="text-[10px] text-slate-500">{language === "kh" ? "សរុបប្រាក់លក់មុនចុះថ្លៃ" : "Subtotal Amount"}</div>
                    <div className="font-mono text-slate-300">${(Number(editSaleSellPrice || 0) * Number(editSaleQuantity || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                  </div>
                  <div className="space-y-1 text-right">
                    <div className="text-[10px] text-slate-500">{language === "kh" ? "សរុបប្រាក់ទូទាត់ចុងក្រោយ" : "Final Grand Total"}</div>
                    <div className="font-mono font-bold text-emerald-400">
                      {editSalePaymentCurrency === "USD" 
                        ? `$${((Number(editSaleSellPrice || 0) * Number(editSaleQuantity || 0)) * (1 - Number(editSaleDiscountPercent || 0) / 100)).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                        : `៛${Math.round(((Number(editSaleSellPrice || 0) * Number(editSaleQuantity || 0)) * (1 - Number(editSaleDiscountPercent || 0) / 100)) * (shopData.exchangeRate || 4100)).toLocaleString()}`
                      }
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingSale(null)}
                  className="px-4 py-2 bg-slate-950 hover:bg-slate-850 text-slate-400 border border-slate-800 rounded-xl text-xs font-semibold cursor-pointer transition"
                >
                  {language === "kh" ? "បោះបង់" : "Cancel"}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-bold hover:opacity-90 rounded-xl text-xs cursor-pointer shadow-lg transition"
                >
                  {language === "kh" ? "រក្សាទុកការកែប្រែ" : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 🔮 AI Auto-Stock Review & Confirm Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-[9999] bg-slate-950/85 backdrop-blur-[6px] flex items-center justify-center p-4 overflow-y-auto font-sans">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-5xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4.5 bg-slate-950 border-b border-slate-850">
              <div className="flex items-center gap-2.5">
                <Sparkles size={18} className="text-amber-500 animate-pulse" />
                <div>
                  <h3 className="text-sm font-bold text-slate-100 font-serif">
                    {language === "kh" ? "ផ្ទៀងផ្ទាត់ទិន្នន័យស្តុកនាំចូល (AI Extracted Stock)" : "Verify AI Extracted Stock Data"}
                  </h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    {language === "kh"
                      ? `បានរកឃើញនាឡិកាចំនួន ${importedWatches.length} ម៉ូដែល។ សូមត្រួតពិនិត្យ និងកែសម្រួលមុនពេលបញ្ចូលស្តុក។`
                      : `Extracted ${importedWatches.length} items. Please inspect and edit before committing.`}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => {
                  if (window.confirm(language === "kh" ? "តើអ្នកចង់បោះបង់ការនាំចូលស្តុកនេះមែនទេ?" : "Are you sure you want to cancel importing?")) {
                    setIsImportModalOpen(false);
                    setImportedWatches([]);
                  }
                }}
                className="p-1.5 text-slate-500 hover:text-slate-300 rounded-lg cursor-pointer hover:bg-slate-850 transition"
              >
                <X size={18} />
              </button>
            </div>

            {/* Content Table / Editable Grid */}
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {importedWatches.length === 0 ? (
                <div className="text-center py-12 text-slate-500 italic text-sm">
                  {language === "kh" ? "គ្មានទិន្នន័យនាឡិកាដែលបានស្រង់ចេញទេ" : "No extracted watch data"}
                </div>
              ) : (
                <div className="border border-slate-850 rounded-xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-950/60 text-[10px] uppercase font-bold text-amber-500/90 tracking-wider border-b border-slate-850">
                          <th className="py-3 px-4">{language === "kh" ? "លេខកូដ (SKU)" : "SKU / Code"}</th>
                          <th className="py-3 px-4">{language === "kh" ? "ម៉ាក (Brand)" : "Brand"}</th>
                          <th className="py-3 px-4">{language === "kh" ? "ម៉ូដែល (Model)" : "Model"}</th>
                          <th className="py-3 px-3">{language === "kh" ? "ប្រភេទ" : "Category"}</th>
                          <th className="py-3 px-3">{language === "kh" ? "ពណ៌" : "Color"}</th>
                          <th className="py-3 px-3">{language === "kh" ? "តម្លៃដើម (Cost)" : "Cost Price"}</th>
                          <th className="py-3 px-3">{language === "kh" ? "តម្លៃលក់ (Retail)" : "Retail Price"}</th>
                          <th className="py-3 px-3 text-center">{language === "kh" ? "ចំនួន" : "Qty"}</th>
                          <th className="py-3 px-4 text-center">{language === "kh" ? "សកម្មភាព" : "Action"}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-850">
                        {importedWatches.map((item, index) => {
                          const existingWatch = shopData.watches.find((w) => w.id === (item.id || "").trim());
                          const isDuplicate = !!existingWatch;

                          return (
                            <tr key={index} className={`text-xs hover:bg-slate-900/30 transition-colors ${isDuplicate ? "bg-amber-500/[0.02]" : ""}`}>
                              {/* SKU Input & Badge */}
                              <td className="py-3 px-4 min-w-[140px]">
                                <input
                                  type="text"
                                  value={item.id || ""}
                                  onChange={(e) => handleUpdateImportedWatchField(index, "id", e.target.value)}
                                  className={`w-full bg-slate-950/40 border border-slate-800 rounded px-2 py-1 text-xs font-mono text-slate-100 focus:border-amber-500 focus:outline-none`}
                                />
                                {isDuplicate ? (
                                  <span className="inline-flex items-center gap-1 mt-1 text-[8px] bg-amber-500/10 text-amber-500 px-1 py-0.5 rounded font-medium">
                                    <RefreshCw size={8} className="animate-spin" />
                                    {language === "kh" ? "បូកចូលស្តុកចាស់" : "Restocking Existing"}
                                  </span>
                                ) : (
                                  <span className="inline-block mt-1 text-[8px] bg-emerald-500/10 text-emerald-400 px-1 py-0.5 rounded font-medium">
                                    {language === "kh" ? "ទំនិញថ្មី" : "New watch SKU"}
                                  </span>
                                )}
                              </td>

                              {/* Brand */}
                              <td className="py-3 px-4">
                                <input
                                  type="text"
                                  value={item.brand || ""}
                                  onChange={(e) => handleUpdateImportedWatchField(index, "brand", e.target.value)}
                                  className="w-full bg-slate-950/40 border border-slate-800 rounded px-2 py-1 text-xs text-slate-100 focus:border-amber-500 focus:outline-none font-semibold"
                                />
                              </td>

                              {/* Model */}
                              <td className="py-3 px-4">
                                <input
                                  type="text"
                                  value={item.model || ""}
                                  onChange={(e) => handleUpdateImportedWatchField(index, "model", e.target.value)}
                                  className="w-full bg-slate-950/40 border border-slate-800 rounded px-2 py-1 text-xs text-slate-100 focus:border-amber-500 focus:outline-none font-mono"
                                />
                              </td>

                              {/* Category */}
                              <td className="py-3 px-3">
                                <select
                                  value={item.category || "Watch Quartz"}
                                  onChange={(e) => handleUpdateImportedWatchField(index, "category", e.target.value)}
                                  className="bg-slate-955 border border-slate-800 rounded px-1.5 py-1 text-[11px] text-slate-200 cursor-pointer focus:border-amber-500 focus:outline-none"
                                >
                                  <option value="Watch Quartz">Watch Quartz</option>
                                  <option value="Automatic Watch">Automatic Watch</option>
                                  <option value="Digital Watch">Digital Watch</option>
                                  <option value="Watch Sport">Watch Sport</option>
                                  <option value="Smart Watch">Smart Watch</option>
                                </select>
                              </td>

                              {/* Color */}
                              <td className="py-3 px-3">
                                <input
                                  type="text"
                                  value={item.color || ""}
                                  onChange={(e) => handleUpdateImportedWatchField(index, "color", e.target.value)}
                                  className="w-20 bg-slate-955 border border-slate-800 rounded px-2 py-1 text-xs text-slate-200 focus:border-amber-500 focus:outline-none"
                                />
                              </td>

                              {/* Cost Price */}
                              <td className="py-3 px-3">
                                <div className="relative">
                                  <span className="absolute left-1.5 inset-y-0 flex items-center text-[10px] text-slate-500">$</span>
                                  <input
                                    type="number"
                                    value={item.costPrice || 0}
                                    onChange={(e) => handleUpdateImportedWatchField(index, "costPrice", Number(e.target.value))}
                                    className="w-16 bg-slate-955 border border-slate-800 rounded pl-4 pr-1 py-1 text-xs font-mono text-slate-200 focus:border-amber-500 focus:outline-none"
                                  />
                                </div>
                              </td>

                              {/* Selling Price */}
                              <td className="py-3 px-3">
                                <div className="relative">
                                  <span className="absolute left-1.5 inset-y-0 flex items-center text-[10px] text-slate-500">$</span>
                                  <input
                                    type="number"
                                    value={item.sellPrice || 0}
                                    onChange={(e) => handleUpdateImportedWatchField(index, "sellPrice", Number(e.target.value))}
                                    className="w-16 bg-slate-955 border border-slate-800 rounded pl-4 pr-1 py-1 text-xs font-mono text-slate-200 focus:border-amber-500 focus:outline-none"
                                  />
                                </div>
                              </td>

                              {/* Quantity */}
                              <td className="py-3 px-3 text-center">
                                <input
                                  type="number"
                                  min="1"
                                  value={item.stock || 1}
                                  onChange={(e) => handleUpdateImportedWatchField(index, "stock", Math.max(1, parseInt(e.target.value, 10)))}
                                  className="w-12 bg-slate-955 border border-slate-800 rounded px-1.5 py-1 text-center text-xs font-mono text-slate-200 focus:border-amber-500 focus:outline-none"
                                />
                              </td>

                              {/* Delete Action */}
                              <td className="py-3 px-4 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleDeleteImportedWatch(index)}
                                  className="text-slate-500 hover:text-red-500 transition-colors p-1.5 cursor-pointer"
                                  title={language === "kh" ? "លុបចោល" : "Exclude item"}
                                >
                                  <Trash2 size={14} />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Footer Summary / Confirmation Button */}
            <div className="px-6 py-4 bg-slate-950 border-t border-slate-850 flex flex-col sm:flex-row items-center justify-between gap-4 font-sans">
              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400">
                <div>
                  {language === "kh" ? "ចំនួនមុខនាឡិកា៖" : "Total SKUs:"}{" "}
                  <span className="text-amber-500 font-bold font-mono text-sm">{importedWatches.length}</span>
                </div>
                <div className="hidden sm:inline-block h-4 w-px bg-slate-800"></div>
                <div>
                  {language === "kh" ? "ប្រាក់ដើមសរុបប្រហាក់ប្រហែល៖" : "Est. Total Capital:"}{" "}
                  <span className="text-emerald-400 font-extrabold font-mono text-sm">
                    ${importedWatches.reduce((acc, w) => acc + ((w.stock || 1) * (w.costPrice || 0)), 0).toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(language === "kh" ? "តើអ្នកចង់បោះបង់ការនាំចូលស្តុកនេះមែនទេ?" : "Are you sure you want to cancel importing?")) {
                      setIsImportModalOpen(false);
                      setImportedWatches([]);
                    }
                  }}
                  className="w-full sm:w-auto bg-slate-850 hover:bg-slate-800 text-slate-300 font-semibold py-2 px-5 rounded-lg text-xs cursor-pointer text-center"
                >
                  {language === "kh" ? "បដិសេធ" : "Discard"}
                </button>
                <button
                  type="button"
                  onClick={handleConfirmImportStock}
                  className="w-full sm:w-auto bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold py-2 px-6 rounded-lg text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-lg shadow-amber-500/10"
                >
                  <Check size={14} />
                  {language === "kh" ? "រក្សាទុកចូលស្តុកទាំងស្រុង" : "Confirm & Import to Stock"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer copyright */}
      <footer className="mt-auto py-6 border-t border-slate-900 bg-slate-900/20 text-center font-sans">
        <p className="text-[11px] text-slate-500">
          ChronoManager System • admin Panel with Server-Side Gemini AI Core • Local Time 2026-06-18
        </p>
      </footer>

      {/* Floating Action Button (FAB) for QR Scanner - Active only when in Inventory / Watch list tab */}
      {activeTab === "watches" && (
        <div className="fixed bottom-6 right-6 z-[9990] flex items-center gap-2 group">
          {/* Label tooltip (reveals on group hover) */}
          <div className="bg-slate-900 border border-slate-800 text-amber-500 font-bold px-3 py-1.5 rounded-xl text-xs shadow-2xl opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-2 group-hover:translate-x-0 font-sans whitespace-nowrap pointer-events-none">
            {language === "kh" ? "ស្កេនស្វែងរកនាឡិកា" : "Scan QR for Watch Lookup"}
          </div>
          <button
            type="button"
            onClick={() => setIsQRModalOpenForWatchSearch(true)}
            className="w-14 h-14 bg-amber-500 hover:bg-amber-650 text-slate-950 rounded-full flex items-center justify-center shadow-2xl hover:shadow-amber-500/20 hover:scale-110 active:scale-95 transition-all duration-300 cursor-pointer border border-amber-400 relative overflow-hidden"
          >
            <span className="absolute inset-0 rounded-full bg-white/10 animate-pulse"></span>
            <QrCode size={24} className="relative z-10" />
          </button>
        </div>
      )}

      {/* QR Scanner Modals Overlay */}
      <QRScannerModal
        isOpen={isQRModalOpenForSale}
        onClose={() => setIsQRModalOpenForSale(false)}
        onScan={handleScanQRForSale}
        language={language}
      />
      <QRScannerModal
        isOpen={isQRModalOpenForWatchForm}
        onClose={() => setIsQRModalOpenForWatchForm(false)}
        onScan={handleScanQRForWatchForm}
        language={language}
      />
      <QRScannerModal
        isOpen={isQRModalOpenForWatchSearch}
        onClose={() => setIsQRModalOpenForWatchSearch(false)}
        onScan={handleScanQRForWatchSearch}
        language={language}
      />

      {/* 🧾 Invoice Detail Modal Overlay with printing layout */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-[9999] bg-slate-950/85 backdrop-blur-[4px] flex items-center justify-center p-4 overflow-y-auto no-print">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 bg-slate-950 border-b border-slate-850">
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2 font-serif">
                <FileText size={16} className="text-amber-500" />
                {language === "kh" ? "វិក្កយបត្រទូទាត់ប្រាក់" : "Sales Invoice & Receipt"}
              </h3>
              <button 
                onClick={() => setSelectedInvoice(null)}
                className="p-1 text-slate-500 hover:text-slate-300 rounded-lg cursor-pointer hover:bg-slate-850 transition"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body / Invoice Content */}
            <div className="p-6 overflow-y-auto max-h-[70vh]">
              {/* This is the printable area */}
              <div 
                id="invoice-pdf-render-root" 
                className="bg-white text-zinc-900 rounded-xl p-6 shadow-sm border border-zinc-200 font-sans tracking-tight leading-relaxed text-xs"
                style={{ contentVisibility: "auto" }}
              >
                {/* Watch Store Branding Header */}
                <div className="text-center space-y-1.5 pb-4 border-b border-zinc-200 border-dashed">
                  <h1 className="text-lg font-black tracking-wider text-black font-serif uppercase">KUNTHY WATCH CO.</h1>
                  <p className="text-[10px] text-zinc-500 font-sans">
                    {language === "kh" 
                      ? "មហាវិថីព្រះសីហនុ រាជធានីភ្នំពេញ • ទូរស័ព្ទ៖ 012 345 678" 
                      : "Sihanouk Blvd, Phnom Penh, Cambodia • Tel: +855 12 345 678"}
                  </p>
                  <p className="text-[9px] uppercase tracking-widest text-[#000000] font-mono px-3 py-0.5 bg-zinc-100 rounded inline-block">
                    {selectedInvoice.saleChannel === "online" 
                      ? (language === "kh" ? "លក់តាមអ៊ីនធឺណិត (ONLINE)" : "ONLINE TRANSACTION")
                      : (language === "kh" ? "លក់នៅហាងផ្ទាល់ (IN-STORE)" : "IN-STORE TRANSACTION")}
                  </p>
                </div>

                {/* Meta details */}
                <div className="grid grid-cols-2 gap-y-2 py-4 text-[11px] border-b border-zinc-200">
                  <div>
                    <span className="text-zinc-500 block text-[10px] uppercase font-semibold">Invoice No / លេខវិក្កយបត្រ</span>
                    <strong className="text-black font-mono text-xs">{selectedInvoice.id}</strong>
                  </div>
                  <div className="text-right">
                    <span className="text-zinc-500 block text-[10px] uppercase font-semibold">Date / កាលបរិច្ឆេទ</span>
                    <strong className="text-black font-mono text-xs">{selectedInvoice.date}</strong>
                  </div>
                </div>

                {/* Customer Details */}
                {(selectedInvoice.customerPhone || selectedInvoice.customerLocation) && (
                  <div className="grid grid-cols-2 gap-y-2 py-3 text-[11px] border-b border-zinc-200 bg-zinc-50 px-2.5 rounded-lg my-1.5 border border-zinc-150">
                    {selectedInvoice.customerPhone && (
                      <div>
                        <span className="text-zinc-500 block text-[9px] uppercase font-semibold">{language === "kh" ? "លេខទូរស័ព្ទភ្ញៀវ" : "Customer Phone"}</span>
                        <strong className="text-black font-mono text-xs">{selectedInvoice.customerPhone}</strong>
                      </div>
                    )}
                    {selectedInvoice.customerLocation && (
                      <div className={selectedInvoice.customerPhone ? "text-right" : "col-span-2"}>
                        <span className="text-zinc-500 block text-[9px] uppercase font-semibold">{language === "kh" ? "ទីតាំងដឹកជញ្ជូន" : "Shipping Location"}</span>
                        <strong className="text-black text-xs">{selectedInvoice.customerLocation}</strong>
                      </div>
                    )}
                  </div>
                )}

                {/* Purchase specs */}
                <div className="py-4 space-y-4">
                  <div className="bg-zinc-100 p-3 rounded-lg border border-zinc-150">
                    <div className="flex justify-between items-baseline font-bold text-black text-sm">
                      <span>{selectedInvoice.watchBrand} {selectedInvoice.watchModel}</span>
                      <span className="text-zinc-650 font-mono text-xs">x{selectedInvoice.quantity}</span>
                    </div>
                    <div className="flex justify-between text-[11px] text-zinc-500 mt-1">
                      <span>Color: {selectedInvoice.watchColor || "Default"}</span>
                      <span>Unit Price: ${selectedInvoice.sellPrice.toLocaleString()}</span>
                    </div>
                  </div>

                  {/* Calculations breakdown */}
                  <div className="space-y-1.5 text-[11px] px-1">
                    <div className="flex justify-between text-zinc-600">
                      <span>Subtotal (តម្លៃលក់សរុប)</span>
                      <span className="font-mono">${(selectedInvoice.sellPrice * selectedInvoice.quantity).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-zinc-600">
                      <span>Discount (ការបញ្ចុះតម្លៃ)</span>
                      <span className="font-mono">
                        {selectedInvoice.discountPercent ? `(${selectedInvoice.discountPercent}%) ` : ""}
                        -${(selectedInvoice.discountAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex justify-between text-black font-black text-sm border-t border-zinc-200 pt-2 mt-2">
                      <span>Total Paid / ទឹកប្រាក់សរុប</span>
                      {selectedInvoice.paymentCurrency === "KHR" ? (
                        <span className="font-mono text-emerald-600 font-bold">
                          ៛{Math.round(selectedInvoice.totalAmount * (selectedInvoice.exchangeRateUsed || 4100)).toLocaleString()}
                        </span>
                      ) : (
                        <span className="font-mono text-emerald-600 font-bold">
                          ${selectedInvoice.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      )}
                    </div>

                    {/* Dual currency display and exchange rate details */}
                    <div className="text-[10px] text-zinc-500 flex flex-col items-end gap-0.5 mt-1 border-t border-zinc-150 pt-1.5 font-sans">
                      {selectedInvoice.paymentCurrency === "KHR" ? (
                        <span>
                          Equivalent to USD: <span className="font-mono font-semibold">${selectedInvoice.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </span>
                      ) : (
                        <span>
                          Equivalent to KHR: <span className="font-mono font-semibold">៛{Math.round(selectedInvoice.totalAmount * (selectedInvoice.exchangeRateUsed || 4100 || shopData.exchangeRate || 4100)).toLocaleString()}</span>
                        </span>
                      )}
                      <span className="italic opacity-80">
                        Exchange Rate Used: 1$ = {(selectedInvoice.exchangeRateUsed || 4100 || shopData.exchangeRate || 4100).toLocaleString()}៛ (KHR)
                      </span>
                    </div>
                  </div>
                </div>

                {/* Footer notes */}
                <div className="text-center pt-6 border-t border-zinc-200 border-dashed space-y-3 mt-4 text-[10px] text-zinc-500 font-sans">
                  <p className="italic text-zinc-450">
                    {language === "kh" 
                      ? "សូមអរគុណសម្រាប់ការទិញនាឡិកាពីស្តង់ Kunthy! ធានាគុណភាព ១០០%។" 
                      : "Thank you for shopping with Kunthy Watch. Quality guaranteed!"}
                  </p>
                  
                  {/* Signature fields */}
                  <div className="grid grid-cols-2 pt-4 gap-4 text-center text-[9px] uppercase tracking-wider text-zinc-400">
                    <div>
                      <div className="h-10 border-b border-zinc-200 border-dotted" />
                      <span className="block mt-1">CUSTOMER SIGNATURE</span>
                    </div>
                    <div>
                      <div className="h-10 border-b border-zinc-200 border-dotted" />
                      <span className="block mt-1">AUTHORIZED SELLER</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 bg-slate-950 border-t border-slate-850">
              <button 
                onClick={() => setSelectedInvoice(null)}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-755 border border-slate-700 text-slate-300 cursor-pointer"
              >
                {language === "kh" ? "បិទ" : "Close"}
              </button>
              <button 
                onClick={() => window.print()}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 cursor-pointer flex items-center gap-1.5 shadow-lg shadow-amber-500/10 hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                <Printer size={14} className="stroke-[2.5]" />
                {language === "kh" ? "រក្សាទុកជា PDF / បោះពុម្ព" : "Save as PDF / Print"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 📧 Supplier Email Order Drafter Modal */}
      {isReorderModalOpen && reorderSelectedWatch && (
        <div className="fixed inset-0 z-[9999] bg-slate-950/85 backdrop-blur-[4px] flex items-center justify-center p-4 overflow-y-auto font-sans">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 bg-slate-950 border-b border-slate-850">
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2 font-serif">
                <Mail size={16} className="text-amber-500 animate-pulse" />
                {language === "kh" ? "លិខិតបញ្ជាទិញស្តុកទៅអ្នកផ្គត់ផ្គង់ (Email Order)" : "Supplier Restock Email Draft"}
              </h3>
              <button
                onClick={() => setIsReorderModalOpen(false)}
                className="p-1 text-slate-500 hover:text-slate-300 rounded-lg cursor-pointer hover:bg-slate-850 transition"
              >
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4 font-sans text-xs">
              <div className="space-y-1.5">
                <label className="block text-slate-400 font-semibold tracking-wide uppercase text-[10px]">
                  {language === "kh" ? "អ្នកទទួល (Recipient):" : "To (Supplier Email):"}
                </label>
                <input
                  type="email"
                  value={reorderEmailRecipient}
                  onChange={(e) => setReorderEmailRecipient(e.target.value)}
                  placeholder="supplier@email.com"
                  className="w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-lg py-2 px-3 focus:outline-none focus:border-amber-500 font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-slate-400 font-semibold tracking-wide uppercase text-[10px]">
                  {language === "kh" ? "ប្រធានបទ (Subject):" : "Subject:"}
                </label>
                <input
                  type="text"
                  value={reorderEmailSubject}
                  onChange={(e) => setReorderEmailSubject(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-lg py-2 px-3 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="block text-slate-400 font-semibold tracking-wide uppercase text-[10px]">
                    {language === "kh" ? "ខ្លឹមសារអ៊ីមែល (Email Content):" : "Email Message Body:"}
                  </label>
                  <span className="text-[9px] text-amber-500 font-semibold uppercase bg-amber-500/10 px-2 py-0.5 rounded animate-pulse">
                    ⚡ CHRONO AI DRAFT
                  </span>
                </div>
                <textarea
                  value={reorderEmailBody}
                  onChange={(e) => setReorderEmailBody(e.target.value)}
                  rows={10}
                  className="w-full bg-slate-950 border border-slate-800 text-slate-300 rounded-lg p-3.5 focus:outline-none focus:border-amber-500 font-sans leading-relaxed resize-none"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 bg-slate-950 border-t border-slate-850">
              <button
                onClick={() => setIsReorderModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 cursor-pointer"
              >
                {language === "kh" ? "បោះបង់" : "Cancel"}
              </button>
              
              <button
                onClick={() => {
                  navigator.clipboard.writeText(reorderEmailBody);
                  showNotice("success", language === "kh" ? "បានចម្លងខ្លឹមសារអ៊ីមែលទុកជោគជ័យ!" : "Email body copied to clipboard!");
                }}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 cursor-pointer flex items-center gap-1.5"
              >
                <Copy size={13} />
                {language === "kh" ? "ចម្លងខ្លឹមសារ" : "Copy Body"}
              </button>

              <a
                href={`mailto:${reorderEmailRecipient}?subject=${encodeURIComponent(reorderEmailSubject)}&body=${encodeURIComponent(reorderEmailBody)}`}
                onClick={() => {
                  setIsReorderModalOpen(false);
                  showNotice("success", language === "kh" ? "កំពុងបើកកម្មវិធីអ៊ីមែល..." : "Opening your default mail client...");
                }}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 cursor-pointer flex items-center gap-1.5 shadow-lg shadow-amber-500/10"
              >
                <ExternalLink size={13} className="stroke-[2.5]" />
                {language === "kh" ? "ផ្ញើអ៊ីមែលភ្លាមៗ" : "Launch Mail Client"}
              </a>
            </div>
          </div>
        </div>
      )}

      {/* 🔔 Periodic Low Stock Prompt Toast */}
      {autoPromptWatch && (
        <div className="fixed bottom-6 right-6 z-[9999] bg-slate-900 border border-amber-500/35 rounded-2xl shadow-2xl p-5 w-full max-w-sm overflow-hidden animate-in slide-in-from-bottom-12 duration-300 font-sans">
          <div className="absolute top-0 left-0 w-2 h-full bg-amber-500 animate-pulse" />
          
          <div className="pl-3 space-y-3 font-sans">
            <div className="flex items-start justify-between gap-1.5">
              <div className="flex items-center gap-2">
                <AlertTriangle size={15} className="text-amber-500 animate-bounce" />
                <h4 className="text-xs font-bold text-slate-100 font-serif uppercase tracking-wide">
                  {language === "kh" ? "ការជូនដំណឹងស្តុកទាបឆ្លាតវៃ" : "Chrono AI Smart Alert"}
                </h4>
              </div>
              <button
                onClick={() => {
                  setDismissedWatchPrompts((prev) => ({ ...prev, [autoPromptWatch.id]: Date.now() }));
                  setAutoPromptWatch(null);
                }}
                className="text-slate-500 hover:text-slate-300 transition p-0.5 rounded cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>

            <div className="space-y-1 text-xs">
              <p className="text-slate-200 font-bold leading-snug">
                {language === "kh"
                  ? `ម៉ូដែល ${autoPromptWatch.brand} ${autoPromptWatch.model} សល់តែ ${autoPromptWatch.stock} គ្រឿងទេ!`
                  : `Model ${autoPromptWatch.brand} ${autoPromptWatch.model} has only ${autoPromptWatch.stock} left in stock!`}
              </p>
              <p className="text-[11px] text-slate-400">
                {language === "kh"
                  ? `កម្រិតដែលអ្នកបានកំណត់គឺ ${autoPromptWatch.lowStockThreshold !== undefined ? autoPromptWatch.lowStockThreshold : 5} គ្រឿង។`
                  : `Defined threshold is ${autoPromptWatch.lowStockThreshold !== undefined ? autoPromptWatch.lowStockThreshold : 5} units.`}
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                onClick={() => {
                  // Snooze for 15 mins by setting a dismissed timestamp of now
                  setDismissedWatchPrompts((prev) => ({ ...prev, [autoPromptWatch.id]: Date.now() }));
                  setAutoPromptWatch(null);
                  showNotice("success", language === "kh" ? "បានផ្អាកការជូនដំណឹង ១៥ នាទី" : "Alert snoozed for 15 minutes");
                }}
                className="px-3 py-1.5 text-[11px] font-semibold bg-slate-800 hover:bg-slate-750 text-slate-400 rounded-lg cursor-pointer"
              >
                {language === "kh" ? "ផ្អាក ១៥ នាទី" : "Snooze"}
              </button>
              
              <button
                onClick={() => {
                  const watchToOrder = autoPromptWatch;
                  setAutoPromptWatch(null);
                  handleOpenReorderModal(watchToOrder);
                }}
                className="px-3 py-1.5 text-[11px] font-bold bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-lg cursor-pointer flex items-center gap-1 shadow-md shadow-amber-500/10"
              >
                <Mail size={11} className="stroke-[2.5]" />
                {language === "kh" ? "បញ្ជាទិញឥឡូវ" : "Draft Order"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
