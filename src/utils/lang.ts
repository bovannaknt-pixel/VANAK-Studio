export type Language = "kh" | "en";

export interface Translations {
  appName: string;
  appSubtitle: string;
  adminLabel: string;
  staffLabel: string;
  ownerLabel: string;
  logoutBtn: string;
  stockHeader: string;
  salesHeader: string;
  incomeHeader: string;
  expenseHeader: string;
  capitalHeader: string;
  aiChatHeader: string;
  dashboardTab: string;
  watchesTab: string;
  salesTab: string;
  transactionsTab: string;
  capitalTab: string;
  suppliersTab: string;
  aiChatTab: string;
  financialSummary: string;
  ownerNameLabel: string;
  adminNameLabel: string;
  totalSales: string;
  totalIncome: string;
  totalExpense: string;
  netProfit: string;
  remainingStock: string;
  revenueFromSales: string;
  otherIncome: string;
  totalExpenses: string;
  currentCapital: string;
  capitalHistory: string;
  watchId: string;
  brand: string;
  model: string;
  color: string;
  costPrice: string;
  sellPrice: string;
  stock: string;
  actions: string;
  quantity: string;
  totalPrice: string;
  profit: string;
  date: string;
  type: string;
  category: string;
  description: string;
  amount: string;
  addBtn: string;
  editBtn: string;
  deleteBtn: string;
  cancelBtn: string;
  saveBtn: string;
  searchPlaceholder: string;
  registerNewWatch: string;
  editWatchDetails: string;
  registerSale: string;
  registerIncome: string;
  registerExpense: string;
  depositWithdrawCapital: string;
  depositType: string;
  withdrawType: string;
  initialType: string;
  emptyStock: string;
  emptySales: string;
  emptyIncome: string;
  emptyExpense: string;
  emptyCapital: string;
  rentCategory: string;
  shippingCategory: string;
  electricityCategory: string;
  staffCategory: string;
  marketingCategory: string;
  otherCategory: string;
  pichRestrictedText: string;
  installGuideBtn: string;
  installTitle: string;
  installStep1: string;
  installStep2: string;
  installStep3: string;
  installStep4: string;
  installStep5: string;
  closeBtn: string;
  successAddWatch: string;
  successEditWatch: string;
  successDeleteWatch: string;
  successAddSale: string;
  successReset: string;
  errorFillAll: string;
  errorInvalidPrice: string;
  errorDuplicateId: string;
  errorNoStockSelect: string;
  errorStockNotFound: string;
  errorNotEnoughStock: string;
  errorSalePriceRequire: string;
  errorDbFail: string;
}

export const translations: Record<Language, Translations> = {
  kh: {
    appName: "KUNTHY WATCH STORE",
    appSubtitle: "ប្រព័ន្ធគ្រប់គ្រង និងរបាយការណ៍ហាងលក់នាឡិកាដៃ",
    adminLabel: "អ្នកគ្រប់គ្រង",
    staffLabel: "បុគ្គលិកជំនួយការ",
    ownerLabel: "ម្ចាស់ហាង (Owner)",
    logoutBtn: "ចាកចេញ",
    stockHeader: "គ្រប់គ្រងស្តុកនាឡិកា",
    salesHeader: "គ្រប់គ្រងការលក់",
    incomeHeader: "គ្រប់គ្រងចំណូល",
    expenseHeader: "គ្រប់គ្រងចំណាយ",
    capitalHeader: "គ្រប់គ្រងប្រាក់ដើម",
    aiChatHeader: "សួរនាំជំនួយការ AI (Gemini)",
    dashboardTab: "ផ្ទាំងគ្រប់គ្រង",
    watchesTab: "ស្តុកនាឡិកា",
    salesTab: "ចុះបញ្ជីការលក់",
    transactionsTab: "ចំណូល/ចំណាយ",
    capitalTab: "ប្រាក់ដើមអាជីវកម្ម",
    suppliersTab: "អ្នកផ្គត់ផ្គង់",
    aiChatTab: "ជំនួយការ AI",
    financialSummary: "សេចក្តីសង្ខេបរបាយការណ៍ហិរញ្ញវត្ថុ",
    ownerNameLabel: "ម្ចាស់ហាង៖ Kunthy",
    adminNameLabel: "អ្នកគ្រប់គ្រង៖ Pich",
    totalSales: "ការលក់សរុប",
    totalIncome: "ចំណូលសរុប",
    totalExpense: "ចំណាយសរុប",
    netProfit: "ប្រាក់ចំណេញសុទ្ធ",
    remainingStock: "ស្តុកនៅសល់សរុប",
    revenueFromSales: "ចំណូលពីការលក់",
    otherIncome: "ចំណូលផ្សេងៗ",
    totalExpenses: "ចំណាយផ្សេងៗ",
    currentCapital: "ប្រាក់ដើមបច្ចុប្បន្ន",
    capitalHistory: "ប្រវត្តិនៃការចាក់បញ្ចូល ឬដកប្រាក់ដើម",
    watchId: "លេខកូដ (ID)",
    brand: "ម៉ាក (Brand)",
    model: "ស៊េរី (Model)",
    color: "ពណ៌ (Color)",
    costPrice: "តម្លៃដើម",
    sellPrice: "តម្លៃលក់",
    stock: "ចំនួនស្តុក",
    actions: "សកម្មភាព",
    quantity: "បរិមាណ (Qty)",
    totalPrice: "តម្លៃសរុប",
    profit: "ប្រាក់ចំណេញ",
    date: "កាលបរិច្ឆេទ",
    type: "ប្រភេទ",
    category: "ប្រភេទចំណាយ/ចំណូល",
    description: "ការពិពណ៌នា",
    amount: "ទឹកប្រាក់ ($)",
    addBtn: "បន្ថែម",
    editBtn: "កែប្រែ",
    deleteBtn: "លុប",
    cancelBtn: "បោះបង់",
    saveBtn: "រក្សាទុក",
    searchPlaceholder: "ស្វែងរកតាម ម៉ាក ស៊េរី លេខកូដ ឬពណ៌...",
    registerNewWatch: "បន្ថែមនាឡិកាថ្មីទៅក្នុងស្តុក",
    editWatchDetails: "កែប្រែព័ត៌មាននាឡិកា",
    registerSale: "ចុះបញ្ជីការលក់ថ្មី",
    registerIncome: "កត់ត្រាចំណូលផ្សេងៗ",
    registerExpense: "កត់ត្រាចំណាយផ្សេងៗ",
    depositWithdrawCapital: "ចាក់បញ្ចូល ឬដកប្រាក់ដើមអាជីវកម្ម",
    depositType: "ប្រាក់បន្ថែម (+)",
    withdrawType: "ប្រាក់ដក (-)",
    initialType: "ប្រាក់ដើមដំបូង",
    emptyStock: "មិនទាន់មាននាឡិកាក្នុងស្តុកនៅឡើយទេ",
    emptySales: "មិនទាន់មានកំណត់ត្រាការលក់នៅឡើយទេ",
    emptyIncome: "មិនទាន់មានកំណត់ត្រាចំណូលផ្សេងៗទេ",
    emptyExpense: "មិនទាន់មានកំណត់ត្រាចំណាយទេ",
    emptyCapital: "មិនទាន់មានប្រវត្តិប្រាក់ដើមទេ",
    rentCategory: "ថ្លៃជួលទីតាំង",
    shippingCategory: "ថ្លៃដឹកជញ្ជូន (Shipping)",
    electricityCategory: "ថ្លៃទឹកភ្លើង / ថ្លៃភ្លើង",
    staffCategory: "ថ្លៃបុគ្គលិក",
    marketingCategory: "ចំណាយលើទីផ្សារ (Marketing)",
    otherCategory: "ចំណាយផ្សេងៗ",
    pichRestrictedText: "🔒 ព័ត៌មាននេះត្រូវបានរក្សាការសម្ងាត់ (សម្រាប់តែ Kunthy ប៉ុណ្ណោះ)",
    installGuideBtn: "របៀបដំឡើង App លើ Chrome",
    installTitle: "ការណែនាំអំពីការដំឡើង App លើ Chrome (PWA)",
    installStep1: "១. សូមបើកកម្មវិធី Google Chrome",
    installStep2: "២. រកមើលប៊ូតុង Install (រូបតំណាងកុំព្យូទ័រដែលមានសញ្ញាព្រួញចុះក្រោម) នៅលើរបារអាសយដ្ឋាន URL (បើមាន) ហើយចុចដំឡើង",
    installStep3: "៣. ប្រសិនបើរកមិនឃើញទេ សូមចុចលើ Menu ត្រីចំណុច (⋮) នៅជ្រុងខាងស្តាំខាងលើនៃ Chrome",
    installStep4: "៤. ជ្រើសរើសយកពាក្យ \"Install App\" ឬ \"Add to Home Screen\" (បន្ថែមទៅអេក្រង់ដើម)",
    installStep5: "៥. បន្ទាប់មកប្រព័ន្ធនឹងបង្កើត Shortcut នៅលើ Desktop ឬទូរស័ព្ទរបស់អ្នកសម្រាប់បើកប្រើប្រាស់ងាយស្រួល ដូចជាកម្មវិធីទូទៅដទៃទៀត",
    closeBtn: "បិទផ្ទាំង",
    successAddWatch: "បានបន្ថែមនាឡិកាថ្មីទៅក្នុងស្តុកដោយជោគជ័យ!",
    successEditWatch: "ការកែប្រែព័ត៌មាននាឡិកាបានជោគជ័យ!",
    successDeleteWatch: "បានលុបនាឡិកាចេញពីស្តុកជោគជ័យ!",
    successAddSale: "ការលក់ត្រូវបានចុះបញ្ជី និងកាត់ស្តុកដោយស្វ័យប្រវត្ត!",
    successReset: "បានកំណត់ទិន្នន័យហាងឡើងវិញជោគជ័យ!",
    errorFillAll: "សូមបំពេញព័ត៌មានទាំងអស់ឱ្យបានត្រឹមត្រូវ!",
    errorInvalidPrice: "តម្លៃ ឬចំនួនមិនអាចតូចជាងសូន្យទេ!",
    errorDuplicateId: "លេខកូដ (ID) នេះមានរួចហើយ! សូមប្រើលេខកូដផ្សេង!",
    errorNoStockSelect: "សូមជ្រើសរើសនាឡិកាសម្រាប់លក់!",
    errorStockNotFound: "រកមិនឃើញនាឡិកានៅក្នុងស្តុកទេ!",
    errorNotEnoughStock: "បរិមាណលក់លើសចំនួនស្តុកដែលមានស្រាប់!",
    errorSalePriceRequire: "សូមបំពេញតម្លៃលក់!",
    errorDbFail: "មានបញ្ហាក្នុងការរក្សាទុកទិន្នន័យ!",
  },
  en: {
    appName: "KUNTHY WATCH STORE",
    appSubtitle: "Watch Store Inventory & Finance Management System",
    adminLabel: "Administrator",
    staffLabel: "Assistant Staff",
    ownerLabel: "Owner",
    logoutBtn: "Log Out",
    stockHeader: "Watch Inventory",
    salesHeader: "Sales Register",
    incomeHeader: "Incomes Manager",
    expenseHeader: "Expenses Manager",
    capitalHeader: "Capital Manager",
    aiChatHeader: "Ask Gemini Business Assistant",
    dashboardTab: "Dashboard",
    watchesTab: "Inventory",
    salesTab: "New Sale",
    transactionsTab: "Incomes/Expenses",
    capitalTab: "Capital Capital",
    suppliersTab: "Suppliers Profile",
    aiChatTab: "AI Business Assistant",
    financialSummary: "Business Financial Summary Report",
    ownerNameLabel: "Owner: Kunthy",
    adminNameLabel: "Staff Admin: Pich",
    totalSales: "Total Sales",
    totalIncome: "Total Income",
    totalExpense: "Total Expense",
    netProfit: "Net Profit",
    remainingStock: "Total Stock Items",
    revenueFromSales: "Revenue from Sales",
    otherIncome: "Other Revenue",
    totalExpenses: "Other Expenses",
    currentCapital: "Current Business Capital",
    capitalHistory: "Capital Balance History (Inflow/Outflow)",
    watchId: "Watch ID",
    brand: "Brand",
    model: "Model",
    color: "Color",
    costPrice: "Cost Price",
    sellPrice: "Selling Price",
    stock: "Stock Quantity",
    actions: "Actions",
    quantity: "Qty",
    totalPrice: "Total Amount",
    profit: "Profit Generated",
    date: "Date Logged",
    type: "Transaction Type",
    category: "Financial Category",
    description: "Description Details",
    amount: "Amount ($)",
    addBtn: "Add Item",
    editBtn: "Edit",
    deleteBtn: "Delete",
    cancelBtn: "Cancel",
    saveBtn: "Save Updates",
    searchPlaceholder: "Search brand, model, series, color, or ID...",
    registerNewWatch: "Register New Watch to Stock",
    editWatchDetails: "Edit Watch Spec Details",
    registerSale: "Register Customer Sale Order",
    registerIncome: "Log Other Business Income",
    registerExpense: "Log Operating Expense Outflow",
    depositWithdrawCapital: "Inject Capital Inflow / Outflow Balance",
    depositType: "Capital Addition (+)",
    withdrawType: "Capital Private Withdrawal (-)",
    initialType: "Initial Business Capital",
    emptyStock: "No watch inventory found in live registry.",
    emptySales: "No sales transaction registry is recorded.",
    emptyIncome: "No independent non-sale incomes recorded.",
    emptyExpense: "No standard business expenses recorded.",
    emptyCapital: "No balance capital transaction record detected.",
    rentCategory: "Store Rent Fee",
    shippingCategory: "Shipping / Courier Fee",
    electricityCategory: "Electricity / Utility Fee",
    staffCategory: "Staff Wages / Salary",
    marketingCategory: "Marketing Expense",
    otherCategory: "Other Store Expense",
    pichRestrictedText: "🔒 Privacy Restricted (Authorized for Kunthy only)",
    installGuideBtn: "How to Install on Chrome",
    installTitle: "Chrome App PWA Installation Guide",
    installStep1: "1. Open Google Chrome web browser",
    installStep2: "2. Look for the 'Install App' icon (small monitor with a down arrow) at the right end of address bar (if available) and click install",
    installStep3: "3. Or click menu option dots (⋮) on the top right-hand side of browser layout",
    installStep4: "4. Select \"Install App\" or \"Add to Home Screen\" from the dropdown options",
    installStep5: "5. The browser will generate a desktop shortcut launch app layout. Open it like a native direct desktop application anytime",
    closeBtn: "Close Window",
    successAddWatch: "Successfully added new watch item into inventory catalog!",
    successEditWatch: "Successfully completed product edit spec details modification!",
    successDeleteWatch: "Successfully deleted selected watch from active inventory log!",
    successAddSale: "Customer sale logged and inventory count deducted dynamically!",
    successReset: "Successfully purged and reset default business database register!",
    errorFillAll: "Please specify all required form parameters correctly!",
    errorInvalidPrice: "Financial specs and positive inventory quantity are required!",
    errorDuplicateId: "This target Watch ID has already registered in database catalog!",
    errorNoStockSelect: "Please select a registered watch to initiate sales process!",
    errorStockNotFound: "The specified watch species was not found in the inventory registry!",
    errorNotEnoughStock: "The requested customer sales volume exceeds available inventory volume!",
    errorSalePriceRequire: "Please input realistic watch transaction retail price!",
    errorDbFail: "Internal database service sync communication failed!",
  }
};
