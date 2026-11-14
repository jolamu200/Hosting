export type PaymentCountryId = "kenya" | "nigeria" | "tanzania" | "other";

export type PayMethodId = "mpesa" | "airtel" | "card" | "apple_pay" | "mobile_money" | "transfer";

export interface PaymentMethodDef {
  id: PayMethodId;
  label: string;
  logoUrl?: string;
  countries: PaymentCountryId[];
}

export interface PaymentCountryDef {
  id: PaymentCountryId;
  flag: string;
  name: string;
  currency: string;
  methods: PayMethodId[];
  description: string;
  accent: string;
  available: boolean | "config";
}

export const PAYMENT_LOGOS = {
  mpesa: "https://raw.githubusercontent.com/xhclintohn/Music-Clips-Collection/refs/heads/main/images/mpesa.jpg",
  airtel: "https://raw.githubusercontent.com/xhclintohn/Music-Clips-Collection/refs/heads/main/images/airtel.jpg",
  card: "https://raw.githubusercontent.com/xhclintohn/Music-Clips-Collection/refs/heads/main/images/card.jpg",
  apple_pay: "https://raw.githubusercontent.com/xhclintohn/Music-Clips-Collection/refs/heads/main/images/applepay.jpg",
} as const;

export const PAYMENT_METHODS: PaymentMethodDef[] = [
  { id: "mpesa", label: "M-Pesa", logoUrl: PAYMENT_LOGOS.mpesa, countries: ["kenya"] },
  { id: "airtel", label: "Airtel", logoUrl: PAYMENT_LOGOS.airtel, countries: ["kenya"] },
  { id: "card", label: "Card", logoUrl: PAYMENT_LOGOS.card, countries: ["kenya", "nigeria", "other"] },
  { id: "apple_pay", label: "Apple Pay", logoUrl: PAYMENT_LOGOS.apple_pay, countries: ["other"] },
  { id: "mobile_money", label: "Mobile Money", countries: ["tanzania"] },
  { id: "transfer", label: "Bank / Transfer", countries: ["nigeria"] },
];

export const PAYMENT_COUNTRIES: PaymentCountryDef[] = [
  {
    id: "kenya",
    flag: "🇰🇪",
    name: "Kenya",
    currency: "KES",
    methods: ["mpesa", "airtel", "card"],
    description: "Pay with M-Pesa, Airtel, Card",
    accent: "teal",
    available: true,
  },
  {
    id: "nigeria",
    flag: "🇳🇬",
    name: "Nigeria",
    currency: "NGN",
    methods: ["card", "transfer"],
    description: "Pay with Card, Transfer, USSD, OPay, Zap",
    accent: "green",
    available: true,
  },
  {
    id: "tanzania",
    flag: "🇹🇿",
    name: "Tanzania",
    currency: "TZS",
    methods: ["mobile_money"],
    description: "Pay with Tigo, Airtel, Vodacom",
    accent: "sky",
    available: true,
  },
  {
    id: "other",
    flag: "🌍",
    name: "Other Countries",
    currency: "USD",
    methods: ["card", "apple_pay"],
    description: "Pay with Card or Apple Pay",
    accent: "teal",
    available: true,
  },
];

export const USD_PER_TX = 0.2;

export interface TxPackage {
  id: string;
  name: string;
  txAmount: number;
  bonusTx: number;
  isBestDeal: boolean;
  price: number;
  currency: string;
}

export const TANZANIA_PACKAGES: TxPackage[] = [
  { id: "tz_starter", name: "Starter", txAmount: 10, bonusTx: 0, price: 1500, currency: "TZS", isBestDeal: false },
  { id: "tz_basic", name: "Basic", txAmount: 20, bonusTx: 0, price: 3000, currency: "TZS", isBestDeal: false },
  { id: "tz_standard", name: "Standard", txAmount: 30, bonusTx: 0, price: 4500, currency: "TZS", isBestDeal: false },
  { id: "tz_pro", name: "Pro", txAmount: 50, bonusTx: 5, price: 7500, currency: "TZS", isBestDeal: true },
  { id: "tz_elite", name: "Elite", txAmount: 100, bonusTx: 10, price: 15000, currency: "TZS", isBestDeal: false },
  { id: "tz_ultimate", name: "Ultimate", txAmount: 200, bonusTx: 20, price: 30000, currency: "TZS", isBestDeal: false },
];

export const NIGERIA_PACKAGES: TxPackage[] = [
  { id: "ng_starter", name: "Starter", txAmount: 10, bonusTx: 0, price: 1000, currency: "NGN", isBestDeal: false },
  { id: "ng_basic", name: "Basic", txAmount: 20, bonusTx: 0, price: 2000, currency: "NGN", isBestDeal: false },
  { id: "ng_standard", name: "Standard", txAmount: 30, bonusTx: 0, price: 3000, currency: "NGN", isBestDeal: false },
  { id: "ng_pro", name: "Pro", txAmount: 50, bonusTx: 5, price: 5000, currency: "NGN", isBestDeal: true },
  { id: "ng_elite", name: "Elite", txAmount: 100, bonusTx: 10, price: 10000, currency: "NGN", isBestDeal: false },
  { id: "ng_ultimate", name: "Ultimate", txAmount: 200, bonusTx: 20, price: 20000, currency: "NGN", isBestDeal: false },
];

export function methodsForCountry(countryId: PaymentCountryId): PaymentMethodDef[] {
  return PAYMENT_METHODS.filter(m => m.countries.includes(countryId));
}

export function getCountry(id: PaymentCountryId): PaymentCountryDef | undefined {
  return PAYMENT_COUNTRIES.find(c => c.id === id);
}
