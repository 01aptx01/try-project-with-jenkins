import type { SeedCatalogue, SeedClient, SeedFamilyRelationship, SeedFinancialProfile, SeedGoal, SeedUser } from "./types.js";

export interface BuildCatalogueOptions {
  rm1PasswordHash?: string | undefined;
  rm2PasswordHash?: string | undefined;
}

export const SEED_RM_1_ID = "11111111-1111-4111-8111-111111111111";
export const SEED_RM_2_ID = "22222222-2222-4222-8222-222222222222";

// Default pre-computed bcrypt cost 12 hash for "Password123!" for local tests / fallback
export const DEFAULT_DEV_PASSWORD_HASH =
  "$2b$12$e8x6sY1mRgn8o/93pM0nheQ9O1lS2xXpW4K8o0oPzY3tD2zW3lIqu";

export function addDays(asOfDateStr: string, days: number): string {
  const [y, m, d] = asOfDateStr.split("-").map((v) => parseInt(v, 10)) as [number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function clientUuid(index: number): string {
  return `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
}

function profileUuid(index: number): string {
  return `00000000-0000-4000-8100-${String(index).padStart(12, "0")}`;
}

function goalUuid(index: number): string {
  return `00000000-0000-4000-8200-${String(index).padStart(12, "0")}`;
}

function relationshipUuid(index: number): string {
  return `00000000-0000-4000-8300-${String(index).padStart(12, "0")}`;
}

interface ClientTemplate {
  codeNumber: number;
  firstName: string;
  lastName: string;
  age: number;
  occupation: string;
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  rmId: string;
  income: string;
  expense: string;
  liquidAssets: string;
  totalAssets: string;
  totalDebt: string;
  savings: string;
  investments: string;
  goals: Array<{
    goalType: "RETIREMENT" | "EDUCATION" | "EMERGENCY_FUND" | "PROPERTY" | "OTHER";
    targetAmount: string;
    currentAmount: string;
    startDayOffset: number;
    targetDayOffset: number;
  }>;
}

const CLIENT_TEMPLATES: ClientTemplate[] = [
  // --- RM 1 Clients (C-001 through C-015) ---
  // C-001: Emergency Fund deficit (liquid < 3 months expense) -> Review Emergency Fund (HIGH)
  {
    codeNumber: 1,
    firstName: "Anan",
    lastName: "Prasert",
    age: 42,
    occupation: "Civil Engineer",
    riskLevel: "MEDIUM",
    rmId: SEED_RM_1_ID,
    income: "85000.00",
    expense: "55000.00",
    liquidAssets: "90000.00", // ~1.6 months (< 3)
    totalAssets: "1500000.00",
    totalDebt: "250000.00", // ~16.7%
    savings: "50000.00",
    investments: "300000.00",
    goals: [
      {
        goalType: "EMERGENCY_FUND",
        targetAmount: "300000.00",
        currentAmount: "90000.00",
        startDayOffset: -180,
        targetDayOffset: 365,
      },
    ],
  },
  // C-002: Excessive Debt (> 60% of assets) -> Review Debt Position (HIGH)
  {
    codeNumber: 2,
    firstName: "Bussaba",
    lastName: "Prasert",
    age: 40,
    occupation: "Accountant",
    riskLevel: "LOW",
    rmId: SEED_RM_1_ID,
    income: "90000.00",
    expense: "35000.00",
    liquidAssets: "250000.00", // ~7.1 months (>= 3)
    totalAssets: "2200000.00",
    totalDebt: "1600000.00", // ~72.7% (> 60%)
    savings: "100000.00",
    investments: "200000.00",
    goals: [
      {
        goalType: "PROPERTY",
        targetAmount: "1000000.00",
        currentAmount: "450000.00",
        startDayOffset: -365,
        targetDayOffset: 730,
      },
    ],
  },
  // C-003: Behind Goal within 365 days -> Review Goal Funding (MEDIUM)
  {
    codeNumber: 3,
    firstName: "Chaiwat",
    lastName: "Prasert",
    age: 19,
    occupation: "University Student",
    riskLevel: "HIGH",
    rmId: SEED_RM_1_ID,
    income: "30000.00",
    expense: "15000.00",
    liquidAssets: "90000.00", // 6 months (>= 3)
    totalAssets: "500000.00",
    totalDebt: "50000.00", // 10% (<= 60%)
    savings: "40000.00",
    investments: "150000.00",
    goals: [
      {
        goalType: "EDUCATION",
        targetAmount: "400000.00",
        currentAmount: "50000.00", // Only 12.5% progress vs expected 83%
        startDayOffset: -300,
        targetDayOffset: 60, // Due in 60 days (<= 365)
      },
    ],
  },
  // C-004: Health score < 60, no emergency deficit, debt <= 60%, goals far/on track -> Schedule Financial Health Review (MEDIUM)
  {
    codeNumber: 4,
    firstName: "Duangjai",
    lastName: "Prasert",
    age: 22,
    occupation: "Graphic Designer",
    riskLevel: "MEDIUM",
    rmId: SEED_RM_1_ID,
    income: "45000.00",
    expense: "35000.00",
    liquidAssets: "110000.00", // 3.14 months (>= 3 -> liquidity score 18)
    totalAssets: "400000.00",
    totalDebt: "220000.00", // 55% (<= 60% -> debt score 10)
    savings: "0.00", // 0% -> savings score 0
    investments: "0.00", // 0% -> investment score 0
    goals: [
      {
        goalType: "OTHER",
        targetAmount: "200000.00",
        currentAmount: "40000.00",
        startDayOffset: -200,
        targetDayOffset: 800, // Due in 800 days (> 365) -> Goal score ~15
      },
    ],
  },
  // C-005: Excellent profile & goals on track -> Routine Financial Review (LOW)
  {
    codeNumber: 5,
    firstName: "Ekkarat",
    lastName: "Thanakit",
    age: 48,
    occupation: "Medical Doctor",
    riskLevel: "LOW",
    rmId: SEED_RM_1_ID,
    income: "200000.00",
    expense: "60000.00",
    liquidAssets: "800000.00", // 13.3 months (>= 6 -> 25)
    totalAssets: "8500000.00",
    totalDebt: "800000.00", // ~9.4% (<= 20% -> 25)
    savings: "60000.00", // 30% of monthly income (>= 20% -> 15)
    investments: "4000000.00", // ~47% of total assets (>= 30% -> 15)
    goals: [
      {
        goalType: "RETIREMENT",
        targetAmount: "5000000.00",
        currentAmount: "3500000.00",
        startDayOffset: -1000,
        targetDayOffset: 1500,
      },
    ],
  },
  // C-006: Review Emergency Fund (HIGH)
  {
    codeNumber: 6,
    firstName: "Fonthip",
    lastName: "Ratanaporn",
    age: 34,
    occupation: "Marketing Manager",
    riskLevel: "HIGH",
    rmId: SEED_RM_1_ID,
    income: "75000.00",
    expense: "50000.00",
    liquidAssets: "80000.00", // 1.6 months (< 3)
    totalAssets: "1200000.00",
    totalDebt: "300000.00",
    savings: "30000.00",
    investments: "400000.00",
    goals: [
      {
        goalType: "EMERGENCY_FUND",
        targetAmount: "250000.00",
        currentAmount: "80000.00",
        startDayOffset: -120,
        targetDayOffset: 240,
      },
    ],
  },
  // C-007: Review Debt Position (HIGH)
  {
    codeNumber: 7,
    firstName: "Gitsada",
    lastName: "Somboon",
    age: 38,
    occupation: "Architect",
    riskLevel: "MEDIUM",
    rmId: SEED_RM_1_ID,
    income: "110000.00",
    expense: "45000.00",
    liquidAssets: "300000.00", // 6.67 months
    totalAssets: "3000000.00",
    totalDebt: "2100000.00", // 70% (> 60%)
    savings: "80000.00",
    investments: "500000.00",
    goals: [
      {
        goalType: "PROPERTY",
        targetAmount: "1500000.00",
        currentAmount: "600000.00",
        startDayOffset: -300,
        targetDayOffset: 600,
      },
    ],
  },
  // C-008: Review Goal Funding (MEDIUM)
  {
    codeNumber: 8,
    firstName: "Hathairat",
    lastName: "Wongsuwan",
    age: 29,
    occupation: "Software Developer",
    riskLevel: "MEDIUM",
    rmId: SEED_RM_1_ID,
    income: "95000.00",
    expense: "35000.00",
    liquidAssets: "350000.00", // 10 months
    totalAssets: "1800000.00",
    totalDebt: "200000.00", // 11%
    savings: "100000.00",
    investments: "600000.00",
    goals: [
      {
        goalType: "PROPERTY",
        targetAmount: "800000.00",
        currentAmount: "150000.00", // Behind
        startDayOffset: -330,
        targetDayOffset: 35, // Due in 35 days
      },
    ],
  },
  // C-009: Schedule Financial Health Review (MEDIUM)
  {
    codeNumber: 9,
    firstName: "Itthipat",
    lastName: "Charoen",
    age: 45,
    occupation: "Store Owner",
    riskLevel: "LOW",
    rmId: SEED_RM_1_ID,
    income: "60000.00",
    expense: "40000.00",
    liquidAssets: "130000.00", // 3.25 months (>= 3 -> 18)
    totalAssets: "600000.00",
    totalDebt: "330000.00", // 55% (<= 60% -> 10)
    savings: "0.00",
    investments: "0.00",
    goals: [
      {
        goalType: "RETIREMENT",
        targetAmount: "1000000.00",
        currentAmount: "100000.00",
        startDayOffset: -400,
        targetDayOffset: 1200,
      },
    ],
  },
  // C-010: Routine Financial Review (LOW)
  {
    codeNumber: 10,
    firstName: "Jiraporn",
    lastName: "Boonmee",
    age: 52,
    occupation: "Senior Consultant",
    riskLevel: "LOW",
    rmId: SEED_RM_1_ID,
    income: "160000.00",
    expense: "50000.00",
    liquidAssets: "650000.00",
    totalAssets: "6500000.00",
    totalDebt: "600000.00",
    savings: "50000.00",
    investments: "3200000.00",
    goals: [
      {
        goalType: "RETIREMENT",
        targetAmount: "3000000.00",
        currentAmount: "2400000.00",
        startDayOffset: -700,
        targetDayOffset: 800,
      },
    ],
  },
  // C-011: Routine Financial Review (LOW)
  {
    codeNumber: 11,
    firstName: "Kittisak",
    lastName: "Saelim",
    age: 36,
    occupation: "Data Scientist",
    riskLevel: "HIGH",
    rmId: SEED_RM_1_ID,
    income: "130000.00",
    expense: "45000.00",
    liquidAssets: "450000.00",
    totalAssets: "3500000.00",
    totalDebt: "400000.00",
    savings: "60000.00",
    investments: "1800000.00",
    goals: [
      {
        goalType: "EDUCATION",
        targetAmount: "1000000.00",
        currentAmount: "700000.00",
        startDayOffset: -500,
        targetDayOffset: 500,
      },
    ],
  },
  // C-012: Review Emergency Fund (HIGH)
  {
    codeNumber: 12,
    firstName: "Lalita",
    lastName: "Siriporn",
    age: 28,
    occupation: "School Teacher",
    riskLevel: "LOW",
    rmId: SEED_RM_1_ID,
    income: "40000.00",
    expense: "30000.00",
    liquidAssets: "50000.00", // 1.67 months (< 3)
    totalAssets: "400000.00",
    totalDebt: "80000.00",
    savings: "15000.00",
    investments: "50000.00",
    goals: [
      {
        goalType: "EMERGENCY_FUND",
        targetAmount: "150000.00",
        currentAmount: "50000.00",
        startDayOffset: -90,
        targetDayOffset: 275,
      },
    ],
  },
  // C-013: Review Debt Position (HIGH)
  {
    codeNumber: 13,
    firstName: "Manat",
    lastName: "Chucheep",
    age: 47,
    occupation: "Logistics Specialist",
    riskLevel: "MEDIUM",
    rmId: SEED_RM_1_ID,
    income: "80000.00",
    expense: "38000.00",
    liquidAssets: "180000.00", // 4.74 months
    totalAssets: "1400000.00",
    totalDebt: "950000.00", // ~67.9% (> 60%)
    savings: "40000.00",
    investments: "150000.00",
    goals: [
      {
        goalType: "PROPERTY",
        targetAmount: "700000.00",
        currentAmount: "300000.00",
        startDayOffset: -400,
        targetDayOffset: 400,
      },
    ],
  },
  // C-014: Review Goal Funding (MEDIUM)
  {
    codeNumber: 14,
    firstName: "Nattaporn",
    lastName: "Vongvanij",
    age: 33,
    occupation: "Product Manager",
    riskLevel: "HIGH",
    rmId: SEED_RM_1_ID,
    income: "125000.00",
    expense: "48000.00",
    liquidAssets: "400000.00",
    totalAssets: "2800000.00",
    totalDebt: "300000.00",
    savings: "80000.00",
    investments: "1100000.00",
    goals: [
      {
        goalType: "EDUCATION",
        targetAmount: "600000.00",
        currentAmount: "100000.00", // Behind
        startDayOffset: -300,
        targetDayOffset: 50, // Due in 50 days (<= 365)
      },
    ],
  },
  // C-015: Routine Financial Review (LOW)
  {
    codeNumber: 15,
    firstName: "Orawan",
    lastName: "Theerapong",
    age: 50,
    occupation: "University Professor",
    riskLevel: "LOW",
    rmId: SEED_RM_1_ID,
    income: "140000.00",
    expense: "42000.00",
    liquidAssets: "550000.00",
    totalAssets: "5200000.00",
    totalDebt: "450000.00",
    savings: "65000.00",
    investments: "2500000.00",
    goals: [
      {
        goalType: "RETIREMENT",
        targetAmount: "2500000.00",
        currentAmount: "1900000.00",
        startDayOffset: -600,
        targetDayOffset: 600,
      },
    ],
  },

  // --- RM 2 Clients (C-016 through C-030) ---
  // C-016: Review Emergency Fund (HIGH)
  {
    codeNumber: 16,
    firstName: "Pakorn",
    lastName: "Panyarat",
    age: 44,
    occupation: "Airline Pilot",
    riskLevel: "HIGH",
    rmId: SEED_RM_2_ID,
    income: "220000.00",
    expense: "120000.00",
    liquidAssets: "180000.00", // 1.5 months (< 3)
    totalAssets: "5000000.00",
    totalDebt: "1000000.00", // 20%
    savings: "70000.00",
    investments: "1500000.00",
    goals: [
      {
        goalType: "EMERGENCY_FUND",
        targetAmount: "600000.00",
        currentAmount: "180000.00",
        startDayOffset: -150,
        targetDayOffset: 200,
      },
    ],
  },
  // C-017: Review Debt Position (HIGH)
  {
    codeNumber: 17,
    firstName: "Qwanjai",
    lastName: "Panyarat",
    age: 41,
    occupation: "Pharmacist",
    riskLevel: "LOW",
    rmId: SEED_RM_2_ID,
    income: "95000.00",
    expense: "35000.00",
    liquidAssets: "220000.00", // 6.28 months
    totalAssets: "2500000.00",
    totalDebt: "1750000.00", // 70% (> 60%)
    savings: "80000.00",
    investments: "300000.00",
    goals: [
      {
        goalType: "PROPERTY",
        targetAmount: "1200000.00",
        currentAmount: "500000.00",
        startDayOffset: -300,
        targetDayOffset: 600,
      },
    ],
  },
  // C-018: Review Goal Funding (MEDIUM)
  {
    codeNumber: 18,
    firstName: "Rungroj",
    lastName: "Panyarat",
    age: 20,
    occupation: "Apprentice Baker",
    riskLevel: "MEDIUM",
    rmId: SEED_RM_2_ID,
    income: "32000.00",
    expense: "16000.00",
    liquidAssets: "80000.00", // 5 months (>= 3)
    totalAssets: "300000.00",
    totalDebt: "30000.00", // 10%
    savings: "30000.00",
    investments: "80000.00",
    goals: [
      {
        goalType: "EDUCATION",
        targetAmount: "250000.00",
        currentAmount: "30000.00", // Behind
        startDayOffset: -280,
        targetDayOffset: 70, // Due in 70 days (<= 365)
      },
    ],
  },
  // C-019: Schedule Financial Health Review (MEDIUM)
  {
    codeNumber: 19,
    firstName: "Siriwan",
    lastName: "Panyarat",
    age: 24,
    occupation: "Content Creator",
    riskLevel: "HIGH",
    rmId: SEED_RM_2_ID,
    income: "50000.00",
    expense: "36000.00",
    liquidAssets: "115000.00", // 3.19 months (>= 3 -> 18)
    totalAssets: "350000.00",
    totalDebt: "190000.00", // 54.3% (<= 60% -> 10)
    savings: "0.00",
    investments: "0.00",
    goals: [
      {
        goalType: "OTHER",
        targetAmount: "150000.00",
        currentAmount: "30000.00",
        startDayOffset: -200,
        targetDayOffset: 700,
      },
    ],
  },
  // C-020: Routine Financial Review (LOW)
  {
    codeNumber: 20,
    firstName: "Tanawat",
    lastName: "Sutthisan",
    age: 46,
    occupation: "Investment Banker",
    riskLevel: "HIGH",
    rmId: SEED_RM_2_ID,
    income: "250000.00",
    expense: "70000.00",
    liquidAssets: "950000.00",
    totalAssets: "12000000.00",
    totalDebt: "1000000.00",
    savings: "100000.00",
    investments: "6500000.00",
    goals: [
      {
        goalType: "RETIREMENT",
        targetAmount: "6000000.00",
        currentAmount: "4800000.00",
        startDayOffset: -1200,
        targetDayOffset: 1500,
      },
    ],
  },
  // C-021: Review Emergency Fund (HIGH)
  {
    codeNumber: 21,
    firstName: "Udomsak",
    lastName: "Chaiprasit",
    age: 37,
    occupation: "Civil Servant",
    riskLevel: "LOW",
    rmId: SEED_RM_2_ID,
    income: "55000.00",
    expense: "42000.00",
    liquidAssets: "70000.00", // 1.67 months (< 3)
    totalAssets: "900000.00",
    totalDebt: "200000.00",
    savings: "25000.00",
    investments: "200000.00",
    goals: [
      {
        goalType: "EMERGENCY_FUND",
        targetAmount: "200000.00",
        currentAmount: "70000.00",
        startDayOffset: -100,
        targetDayOffset: 250,
      },
    ],
  },
  // C-022: Review Debt Position (HIGH)
  {
    codeNumber: 22,
    firstName: "Varaporn",
    lastName: "Kiatnukul",
    age: 39,
    occupation: "Restaurateur",
    riskLevel: "MEDIUM",
    rmId: SEED_RM_2_ID,
    income: "105000.00",
    expense: "40000.00",
    liquidAssets: "280000.00", // 7 months
    totalAssets: "2600000.00",
    totalDebt: "1800000.00", // 69.2% (> 60%)
    savings: "70000.00",
    investments: "350000.00",
    goals: [
      {
        goalType: "PROPERTY",
        targetAmount: "1200000.00",
        currentAmount: "500000.00",
        startDayOffset: -350,
        targetDayOffset: 450,
      },
    ],
  },
  // C-023: Review Goal Funding (MEDIUM)
  {
    codeNumber: 23,
    firstName: "Wichai",
    lastName: "Metheeporn",
    age: 31,
    occupation: "Biotech Researcher",
    riskLevel: "MEDIUM",
    rmId: SEED_RM_2_ID,
    income: "90000.00",
    expense: "32000.00",
    liquidAssets: "320000.00",
    totalAssets: "1700000.00",
    totalDebt: "180000.00",
    savings: "80000.00",
    investments: "600000.00",
    goals: [
      {
        goalType: "PROPERTY",
        targetAmount: "700000.00",
        currentAmount: "120000.00", // Behind
        startDayOffset: -320,
        targetDayOffset: 40, // Due in 40 days (<= 365)
      },
    ],
  },
  // C-024: Schedule Financial Health Review (MEDIUM)
  {
    codeNumber: 24,
    firstName: "Xavier",
    lastName: "Lekhayanon",
    age: 49,
    occupation: "Translator",
    riskLevel: "LOW",
    rmId: SEED_RM_2_ID,
    income: "58000.00",
    expense: "38000.00",
    liquidAssets: "120000.00", // 3.16 months (>= 3 -> 18)
    totalAssets: "550000.00",
    totalDebt: "300000.00", // 54.5% (<= 60% -> 10)
    savings: "0.00",
    investments: "0.00",
    goals: [
      {
        goalType: "RETIREMENT",
        targetAmount: "800000.00",
        currentAmount: "90000.00",
        startDayOffset: -350,
        targetDayOffset: 1000,
      },
    ],
  },
  // C-025: Routine Financial Review (LOW)
  {
    codeNumber: 25,
    firstName: "Yingluck",
    lastName: "Sirimongkol",
    age: 55,
    occupation: "Judge",
    riskLevel: "LOW",
    rmId: SEED_RM_2_ID,
    income: "180000.00",
    expense: "55000.00",
    liquidAssets: "700000.00",
    totalAssets: "8000000.00",
    totalDebt: "700000.00",
    savings: "70000.00",
    investments: "3800000.00",
    goals: [
      {
        goalType: "RETIREMENT",
        targetAmount: "4000000.00",
        currentAmount: "3100000.00",
        startDayOffset: -800,
        targetDayOffset: 700,
      },
    ],
  },
  // C-026: Routine Financial Review (LOW)
  {
    codeNumber: 26,
    firstName: "Zong",
    lastName: "Tantivejkul",
    age: 35,
    occupation: "Electrical Engineer",
    riskLevel: "HIGH",
    rmId: SEED_RM_2_ID,
    income: "115000.00",
    expense: "40000.00",
    liquidAssets: "420000.00",
    totalAssets: "3200000.00",
    totalDebt: "350000.00",
    savings: "55000.00",
    investments: "1600000.00",
    goals: [
      {
        goalType: "EDUCATION",
        targetAmount: "900000.00",
        currentAmount: "650000.00",
        startDayOffset: -450,
        targetDayOffset: 550,
      },
    ],
  },
  // C-027: Review Emergency Fund (HIGH)
  {
    codeNumber: 27,
    firstName: "Amara",
    lastName: "Petchpradub",
    age: 27,
    occupation: "Nurse",
    riskLevel: "MEDIUM",
    rmId: SEED_RM_2_ID,
    income: "48000.00",
    expense: "36000.00",
    liquidAssets: "60000.00", // 1.67 months (< 3)
    totalAssets: "500000.00",
    totalDebt: "90000.00",
    savings: "20000.00",
    investments: "80000.00",
    goals: [
      {
        goalType: "EMERGENCY_FUND",
        targetAmount: "180000.00",
        currentAmount: "60000.00",
        startDayOffset: -80,
        targetDayOffset: 280,
      },
    ],
  },
  // C-028: Review Debt Position (HIGH)
  {
    codeNumber: 28,
    firstName: "Boonsong",
    lastName: "Charupat",
    age: 48,
    occupation: "Automotive Mechanic",
    riskLevel: "LOW",
    rmId: SEED_RM_2_ID,
    income: "72000.00",
    expense: "34000.00",
    liquidAssets: "170000.00", // 5 months
    totalAssets: "1300000.00",
    totalDebt: "900000.00", // 69.2% (> 60%)
    savings: "35000.00",
    investments: "120000.00",
    goals: [
      {
        goalType: "PROPERTY",
        targetAmount: "600000.00",
        currentAmount: "280000.00",
        startDayOffset: -380,
        targetDayOffset: 420,
      },
    ],
  },
  // C-029: Review Goal Funding (MEDIUM)
  {
    codeNumber: 29,
    firstName: "Chompoo",
    lastName: "Ariyawong",
    age: 32,
    occupation: "UX Designer",
    riskLevel: "MEDIUM",
    rmId: SEED_RM_2_ID,
    income: "110000.00",
    expense: "44000.00",
    liquidAssets: "380000.00",
    totalAssets: "2400000.00",
    totalDebt: "250000.00",
    savings: "70000.00",
    investments: "950000.00",
    goals: [
      {
        goalType: "EDUCATION",
        targetAmount: "500000.00",
        currentAmount: "80000.00", // Behind
        startDayOffset: -290,
        targetDayOffset: 55, // Due in 55 days (<= 365)
      },
    ],
  },
  // C-030: Routine Financial Review (LOW)
  {
    codeNumber: 30,
    firstName: "Danai",
    lastName: "Kitpaibul",
    age: 51,
    occupation: "Supply Chain Director",
    riskLevel: "LOW",
    rmId: SEED_RM_2_ID,
    income: "155000.00",
    expense: "46000.00",
    liquidAssets: "600000.00",
    totalAssets: "5800000.00",
    totalDebt: "500000.00",
    savings: "70000.00",
    investments: "2900000.00",
    goals: [
      {
        goalType: "RETIREMENT",
        targetAmount: "3500000.00",
        currentAmount: "2700000.00",
        startDayOffset: -750,
        targetDayOffset: 650,
      },
    ],
  },
];

export function buildSeedCatalogue(
  asOfDateInput: string | Date,
  options?: BuildCatalogueOptions
): SeedCatalogue {
  const asOfDate =
    typeof asOfDateInput === "string"
      ? asOfDateInput
      : asOfDateInput.toISOString().slice(0, 10);

  const rm1PasswordHash = options?.rm1PasswordHash ?? DEFAULT_DEV_PASSWORD_HASH;
  const rm2PasswordHash = options?.rm2PasswordHash ?? DEFAULT_DEV_PASSWORD_HASH;

  const rms: SeedUser[] = [
    {
      id: SEED_RM_1_ID,
      email: "rm1@meridian.local",
      passwordHash: rm1PasswordHash,
      name: "Somchai Jaidee",
      role: "RM",
    },
    {
      id: SEED_RM_2_ID,
      email: "rm2@meridian.local",
      passwordHash: rm2PasswordHash,
      name: "Kamonwan Sukjai",
      role: "RM",
    },
  ];

  const clients: SeedClient[] = [];
  const profiles: SeedFinancialProfile[] = [];
  const goals: SeedGoal[] = [];

  let goalGlobalCounter = 1;

  for (const t of CLIENT_TEMPLATES) {
    const cid = clientUuid(t.codeNumber);
    const code = `C-${String(t.codeNumber).padStart(3, "0")}`;

    clients.push({
      id: cid,
      customerCode: code,
      firstName: t.firstName,
      lastName: t.lastName,
      age: t.age,
      occupation: t.occupation,
      riskLevel: t.riskLevel,
      rmId: t.rmId,
    });

    profiles.push({
      id: profileUuid(t.codeNumber),
      clientId: cid,
      monthlyIncome: t.income,
      monthlyExpense: t.expense,
      liquidAssets: t.liquidAssets,
      totalAssets: t.totalAssets,
      totalDebt: t.totalDebt,
      savings: t.savings,
      investments: t.investments,
    });

    for (const g of t.goals) {
      goals.push({
        id: goalUuid(goalGlobalCounter++),
        clientId: cid,
        goalType: g.goalType,
        targetAmount: g.targetAmount,
        currentAmount: g.currentAmount,
        startDate: addDays(asOfDate, g.startDayOffset),
        targetDate: addDays(asOfDate, g.targetDayOffset),
      });
    }
  }

  // Define family relationships covering all 4 types (PARENT, CHILD, SPOUSE, SIBLING)
  // Intra-RM 1:
  // C-001 <-> C-002: SPOUSE
  // C-001 -> C-003: PARENT, C-003 -> C-001: CHILD
  // C-003 <-> C-004: SIBLING
  //
  // Intra-RM 2:
  // C-016 <-> C-017: SPOUSE
  // C-016 -> C-018: PARENT, C-018 -> C-016: CHILD
  // C-018 <-> C-019: SIBLING

  let relCounter = 1;
  const relationships: SeedFamilyRelationship[] = [
    // RM 1 family (all pairs have clientId < relatedClientId)
    {
      id: relationshipUuid(relCounter++),
      clientId: clientUuid(1),
      relatedClientId: clientUuid(2),
      relationshipType: "SPOUSE",
    },
    {
      id: relationshipUuid(relCounter++),
      clientId: clientUuid(1),
      relatedClientId: clientUuid(3),
      relationshipType: "PARENT",
    },
    {
      id: relationshipUuid(relCounter++),
      clientId: clientUuid(3),
      relatedClientId: clientUuid(4),
      relationshipType: "SIBLING",
    },
    {
      id: relationshipUuid(relCounter++),
      clientId: clientUuid(3),
      relatedClientId: clientUuid(5),
      relationshipType: "CHILD",
    },

    // RM 2 family (all pairs have clientId < relatedClientId)
    {
      id: relationshipUuid(relCounter++),
      clientId: clientUuid(16),
      relatedClientId: clientUuid(17),
      relationshipType: "SPOUSE",
    },
    {
      id: relationshipUuid(relCounter++),
      clientId: clientUuid(16),
      relatedClientId: clientUuid(18),
      relationshipType: "PARENT",
    },
    {
      id: relationshipUuid(relCounter++),
      clientId: clientUuid(18),
      relatedClientId: clientUuid(19),
      relationshipType: "SIBLING",
    },
    {
      id: relationshipUuid(relCounter++),
      clientId: clientUuid(18),
      relatedClientId: clientUuid(20),
      relationshipType: "CHILD",
    },
  ];

  return {
    asOfDate,
    rms,
    clients,
    profiles,
    goals,
    relationships,
  };
}
