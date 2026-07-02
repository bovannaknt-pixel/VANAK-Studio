export interface Watch {
  id: string; // SKU / Code
  brand: string;
  model: string;
  category?: string;
  color: string;
  costPrice: number;
  sellPrice: number;
  stock: number;
  oldStock?: number;
  newStock?: number;
  supplierId?: string; // Link to Supplier
  lowStockThreshold?: number; // Custom threshold for low stock alert
  colorBreakdown?: { color: string; qty: number; oldQty?: number; newQty?: number }[]; // Color-based stock breakdown
}

export interface Sale {
  id: string;
  watchId: string;
  watchBrand: string;
  watchModel: string;
  watchColor: string;
  quantity: number;
  sellPrice: number;
  costPrice: number;
  totalAmount: number;
  profit: number;
  date: string; // ISO string or YYYY-MM-DD
  saleChannel?: 'instore' | 'online';
  discountPercent?: number;
  discountAmount?: number;
  deductedStockType?: 'auto' | 'old' | 'new';
  paymentCurrency?: 'USD' | 'KHR';
  exchangeRateUsed?: number;
  paymentMethod?: 'cash' | 'aba' | 'acleda' | 'split' | 'cod';
  receivedCashUSD?: number;
  receivedCashKHR?: number;
  receivedABA?: number;
  receivedAcleda?: number;
  changeUSD?: number;
  changeKHR?: number;
  codCarrier?: string;
  codSettlement?: 'cash' | 'aba' | 'acleda' | 'split';
  codNotes?: string;
  isPaid?: boolean;
  paymentStatus?: 'Paid' | 'Unpaid';
  customerPhone?: string; // Added customer phone
  customerLocation?: string; // Added customer location (province/Phnom Penh)
}

export interface Income {
  id: string;
  amount: number;
  source: string; // 'sale' | 'other'
  category: string; // e.g., 'លក់នាឡិកា', 'ការប្រាក់', 'សេវាកម្មជួសជុល', 'លក់ Online'
  date: string;
  description?: string;
  currency?: 'USD' | 'KHR';
  originalAmount?: number;
  exchangeRateUsed?: number;
}

export interface Expense {
  id: string;
  amount: number;
  category: 'rent' | 'shipping' | 'staff' | 'marketing' | 'electricity' | 'other';
  description: string;
  date: string;
  paymentMethod?: string;
  isRecurring?: boolean;
  recurringInterval?: 'weekly' | 'monthly' | 'yearly';
  parentId?: string;
  status?: 'paid' | 'placeholder';
  currency?: 'USD' | 'KHR';
  originalAmount?: number;
  exchangeRateUsed?: number;
}

export interface CapitalTransaction {
  id: string;
  type: 'initial' | 'add' | 'withdraw';
  amount: number;
  description: string;
  date: string;
}

export interface Supplier {
  id: string;
  name: string;
  contactName?: string;
  phone?: string;
  email?: string;
  notes?: string;
}

export interface UserAccount {
  id: string;
  username: string;
  password?: string;
  name: string;
  role: 'owner' | 'staff';
}

export interface AuditLog {
  id: string;
  action: string;
  details: string;
  user: string;
  timestamp: string;
}

export interface ClosedPeriod {
  id: string;
  type: 'month' | 'year';
  periodKey: string; // e.g., "2026-06" or "2026"
  salesCount: number;
  totalSales: number;
  totalCOGS: number;
  grossProfit: number;
  otherIncome: number;
  totalExpenses: number;
  netProfit: number;
  inventoryCount: number;
  inventoryValue: number;
  closedAt: string;
  closedBy: string;
  notes?: string;
}

export interface ShopSettings {
  shopName?: string;
  shopPhone?: string;
  defaultSalesChannel?: 'instore' | 'online';
  enableCod?: boolean;
  enableAiChat?: boolean;
  taxPercent?: number;
  codCarrierDefault?: string;
}

export interface StockTakeItem {
  watchId: string;
  brand: string;
  model: string;
  color: string;
  systemStock: number;
  physicalStock: number;
  difference: number;
  costPrice: number;
  valueDifference: number; // difference * costPrice
}

export interface StockTakeSession {
  id: string;
  periodKey: string; // e.g., "2026-06"
  dateCounted: string; // YYYY-MM-DD
  countedBy: string;
  items: StockTakeItem[];
  totalSystemStock: number;
  totalPhysicalStock: number;
  totalDiscrepancies: number; // count of items with difference !== 0
  totalValueDifference: number; // net financial impact of discrepancies
  status: 'completed' | 'draft';
  notes?: string;
}

export interface ShopData {
  watches: Watch[];
  sales: Sale[];
  incomes: Income[];
  expenses: Expense[];
  capitalTransactions: CapitalTransaction[];
  suppliers?: Supplier[]; // Supppliers List
  users?: UserAccount[]; // User accounts List
  expenseBudgetLimit?: number; // Monthly operating expense budget limit
  exchangeRate?: number; // USD to KHR rate (e.g. 4100)
  auditLogs?: AuditLog[]; // Audit trail ledger
  closings?: ClosedPeriod[]; // History of month/year closed books
  settings?: ShopSettings; // General configuration settings
  stockTakes?: StockTakeSession[]; // Monthly stock counting records
  lastUpdated?: number; // Milliseconds timestamp for conflict-free syncing
}

export interface Message {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
}
