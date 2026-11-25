import { prisma } from "@/lib/prisma";

export type CategoryKind = "EXPENSE" | "INVESTMENT" | "INCOME" | "TRANSFER";
export type Bucket = "NEEDS" | "WANTS";

export const KIND_LABEL: Record<CategoryKind, string> = {
  EXPENSE: "Expense",
  INVESTMENT: "Investment",
  INCOME: "Income",
  TRANSFER: "Transfer (not counted)",
};

// Starter set, created the first time the personal tracker is opened. Fully editable after
// that from Personal → Plan & Salary.
export const DEFAULT_CATEGORIES: { name: string; kind: CategoryKind; bucket?: Bucket }[] = [
  // Needs — the essentials
  { name: "Rent & Housing", kind: "EXPENSE", bucket: "NEEDS" },
  { name: "Groceries", kind: "EXPENSE", bucket: "NEEDS" },
  { name: "Bills & Utilities", kind: "EXPENSE", bucket: "NEEDS" },
  { name: "Transport & Fuel", kind: "EXPENSE", bucket: "NEEDS" },
  { name: "Health & Medical", kind: "EXPENSE", bucket: "NEEDS" },
  { name: "Insurance", kind: "EXPENSE", bucket: "NEEDS" },
  { name: "Home Services", kind: "EXPENSE", bucket: "NEEDS" },
  { name: "Family Support", kind: "EXPENSE", bucket: "NEEDS" },
  { name: "Education", kind: "EXPENSE", bucket: "NEEDS" },
  { name: "EMI & Loans", kind: "EXPENSE", bucket: "NEEDS" },
  { name: "Taxes & Fees", kind: "EXPENSE", bucket: "NEEDS" },
  // Wants — the "fun money"
  { name: "Food Delivery", kind: "EXPENSE", bucket: "WANTS" },
  { name: "Eating Out & Cafes", kind: "EXPENSE", bucket: "WANTS" },
  { name: "Snacks & Street Food", kind: "EXPENSE", bucket: "WANTS" },
  { name: "Shopping & Clothes", kind: "EXPENSE", bucket: "WANTS" },
  { name: "Subscriptions", kind: "EXPENSE", bucket: "WANTS" },
  { name: "Entertainment & Events", kind: "EXPENSE", bucket: "WANTS" },
  { name: "Travel & Trips", kind: "EXPENSE", bucket: "WANTS" },
  { name: "Fitness & Sports", kind: "EXPENSE", bucket: "WANTS" },
  { name: "Personal Care", kind: "EXPENSE", bucket: "WANTS" },
  { name: "Gifts & Occasions", kind: "EXPENSE", bucket: "WANTS" },
  { name: "Miscellaneous", kind: "EXPENSE", bucket: "WANTS" },
  // Investments
  { name: "Mutual Funds / SIP", kind: "INVESTMENT" },
  { name: "Stocks", kind: "INVESTMENT" },
  { name: "FD / RD", kind: "INVESTMENT" },
  { name: "PPF / NPS / EPF", kind: "INVESTMENT" },
  { name: "Gold", kind: "INVESTMENT" },
  { name: "Crypto", kind: "INVESTMENT" },
  { name: "Other Investment", kind: "INVESTMENT" },
  // Income
  { name: "Salary", kind: "INCOME" },
  { name: "Freelance / Side Income", kind: "INCOME" },
  { name: "Refunds & Cashback", kind: "INCOME" },
  { name: "Interest & Dividends", kind: "INCOME" },
  { name: "Other Income", kind: "INCOME" },
  // Transfers — excluded from totals
  { name: "Self Transfer", kind: "TRANSFER" },
  { name: "Credit Card Bill", kind: "TRANSFER" },
  { name: "Money Lent / Borrowed", kind: "TRANSFER" },
];

// Built-in merchant keyword → category guesses, so common Indian merchants are labelled even
// with no Gemini key and before any rules are learned. Matched against the lowercased
// narration/merchant. Learned rules (from your own labels) always win over these.
export const KEYWORD_RULES: { keywords: string[]; category: string }[] = [
  { keywords: ["zomato", "swiggy", "eternalltd", "eternal ltd", "eatsure", "box8", "faasos"], category: "Food Delivery" },
  { keywords: ["zepto", "blinkit", "bigbasket", "instamart", "star bazaa", "dmart", "jiomart", "grofers", "reliance fresh", "nature s basket", "more retail"], category: "Groceries" },
  { keywords: ["spotify", "netflix", "apple serv", "apple media", "itunes", "youtube", "google play", "prime video", "amazon prime", "hotstar", "jiocinema", "sonyliv", "zee5", "chatgpt", "openai"], category: "Subscriptions" },
  { keywords: ["rapido", "uber", "ola", "olacabs", "namma yatri", "irctc", "metro", "fastag", "petrol", "hpcl", "bpcl", "indian oil", "iocl", "shell"], category: "Transport & Fuel" },
  { keywords: ["myntra", "ajio", "nykaa", "amazon", "flipkart", "meesho", "tata cliq", "h&m", "zara", "uniqlo", "decathlon", "lenskart"], category: "Shopping & Clothes" },
  { keywords: ["mutual fun", "mutual fund", "groww", "zerodha", "coin by", "kuvera", "indmoney", "paytm money", "bse ltd", "icici pru", "sip"], category: "Mutual Funds / SIP" },
  { keywords: ["urban comp", "urbanclap", "housejoy"], category: "Home Services" },
  { keywords: ["cultsport", "cult.fit", "curefit", "cult fit", "gym", "playo", "hudle"], category: "Fitness & Sports" },
  { keywords: ["cred club", "credclub", "cred"], category: "Credit Card Bill" },
  { keywords: ["district", "bookmyshow", "paytm insider", "pvr", "inox"], category: "Entertainment & Events" },
  { keywords: ["makemytrip", "goibibo", "cleartrip", "indigo", "air india", "akasa", "vistara", "airbnb", "oyo", "adani airp", "ixigo"], category: "Travel & Trips" },
  { keywords: ["pharma", "medical", "med", "pharmacy", "apollo", "1mg", "netmeds", "pharmeasy", "hospital", "clinic", "diagnostic", "chemist"], category: "Health & Medical" },
  { keywords: ["airtel", "jio", "vodafone", "vi prepaid", "bescom", "adani electricity", "tata power", "mahanagar gas", "electricity", "broadband", "act fibernet", "bbps"], category: "Bills & Utilities" },
  { keywords: ["starbucks", "third wave", "blue tokai", "chaayos", "cafe", "coffee", "restaurant", "dominos", "mcdonald", "kfc", "burger king", "pizza hut"], category: "Eating Out & Cafes" },
  { keywords: ["salon", "barber", "urbanic", "wellness"], category: "Personal Care" },
  { keywords: ["lic", "policybazaar", "insurance", "hdfc life", "acko", "digit insur"], category: "Insurance" },
  { keywords: ["salary", "sal cr", "payroll"], category: "Salary" },
  { keywords: ["interest", "int.pd", "dividend", "div"], category: "Interest & Dividends" },
  { keywords: ["refund", "cashback", "reversal"], category: "Refunds & Cashback" },
  { keywords: ["police cha", "challan", "gst", "income tax", "tds"], category: "Taxes & Fees" },
];

export async function ensureDefaultCategories() {
  const count = await prisma.personalCategory.count();
  if (count > 0) return;
  await prisma.$transaction(
    DEFAULT_CATEGORIES.map((c, i) =>
      prisma.personalCategory.create({
        data: { name: c.name, kind: c.kind, bucket: c.bucket || "WANTS", sortOrder: i },
      })
    )
  );
}

export async function getCategories(includeArchived = false) {
  await ensureDefaultCategories();
  return prisma.personalCategory.findMany({
    where: includeArchived ? {} : { archived: false },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
}

export async function getPlan() {
  return prisma.personalPlan.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} });
}
