import { createContext, useContext, useState, useEffect, useCallback, Fragment, type ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import { getCurrencyList, setUserCurrency } from "@/lib/api";
import { setMoneyState, detectCurrency } from "@/lib/money";

export interface CurrencyDef {
  code: string;
  name: string;
  symbol: string;
  flag: string;
  perKes: number;
}

const FALLBACK_CURRENCIES: CurrencyDef[] = [
  { code: "KES", name: "Kenyan Shilling", symbol: "KSh", flag: "🇰🇪", perKes: 1 },
  { code: "USD", name: "US Dollar", symbol: "$", flag: "🇺🇸", perKes: 0.00773 },
  { code: "NGN", name: "Nigerian Naira", symbol: "₦", flag: "🇳🇬", perKes: 12.10 },
  { code: "TZS", name: "Tanzanian Shilling", symbol: "TSh", flag: "🇹🇿", perKes: 19.90 },
  { code: "UGX", name: "Ugandan Shilling", symbol: "USh", flag: "🇺🇬", perKes: 28.30 },
  { code: "GHS", name: "Ghanaian Cedi", symbol: "₵", flag: "🇬🇭", perKes: 0.1085 },
];

const STORAGE_KEY = "currency_pref";
const STORAGE_SEEN_KEY = "currency_prompted";

interface CurrencyContextType {
  currency: string;
  currencies: CurrencyDef[];
  setCurrency: (code: string) => void;
  format: (amountKes: number, opts?: { decimals?: number }) => string;
  convert: (amountKes: number) => number;
  shouldPrompt: boolean;
  dismissPrompt: () => void;
}

const CurrencyContext = createContext<CurrencyContextType>({
  currency: "KES",
  currencies: FALLBACK_CURRENCIES,
  setCurrency: () => {},
  format: (amountKes: number) => `KSh ${amountKes.toFixed(2)}`,
  convert: (amountKes: number) => amountKes,
  shouldPrompt: false,
  dismissPrompt: () => {},
});

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const { user, refreshUser } = useAuth();
  const [currencies, setCurrencies] = useState<CurrencyDef[]>(FALLBACK_CURRENCIES);
  const [currency, setCurrencyState] = useState<string>(() => {
    const code = localStorage.getItem(STORAGE_KEY) || detectCurrency();
    setMoneyState(code);
    return code;
  });
  const [shouldPrompt, setShouldPrompt] = useState(false);

  useEffect(() => {
    getCurrencyList()
      .then(list => { if (Array.isArray(list) && list.length) setCurrencies(list); })
      .catch(() => {});
  }, []);

  useEffect(() => { setMoneyState(currency, currencies); }, [currency, currencies]);

  useEffect(() => {
    if (!user) return;
    if (user.currencySet && user.currency) {
      setCurrencyState(user.currency);
      localStorage.setItem(STORAGE_KEY, user.currency);
    } else if (!user.currencySet) {
      // First visit after sign-up: detect the country automatically and remember it (no popup).
      const guess = localStorage.getItem(STORAGE_KEY) || detectCurrency();
      setCurrencyState(guess);
      localStorage.setItem(STORAGE_KEY, guess);
      setUserCurrency(guess).then(() => refreshUser()).catch(() => {});
    }
    setShouldPrompt(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const setCurrency = useCallback((code: string) => {
    setCurrencyState(code);
    localStorage.setItem(STORAGE_KEY, code);
    setShouldPrompt(false);
    sessionStorage.setItem(STORAGE_SEEN_KEY, "1");
    if (user) {
      setUserCurrency(code).then(() => refreshUser()).catch(() => {});
    }
  }, [user, refreshUser]);

  const dismissPrompt = useCallback(() => {
    setShouldPrompt(false);
    sessionStorage.setItem(STORAGE_SEEN_KEY, "1");
  }, []);

  const convert = useCallback((amountKes: number) => {
    const def = currencies.find(c => c.code === currency) || currencies[0];
    return amountKes * (def?.perKes ?? 1);
  }, [currency, currencies]);

  const format = useCallback((amountKes: number, opts?: { decimals?: number }) => {
    const def = currencies.find(c => c.code === currency) || currencies[0];
    const value = amountKes * (def?.perKes ?? 1);
    const decimals = opts?.decimals ?? (value >= 1000 ? 0 : 2);
    const formatted = value.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    return `${def?.symbol ?? "KSh"} ${formatted}`;
  }, [currency, currencies]);

  return (
    <CurrencyContext.Provider value={{ currency, currencies, setCurrency, format, convert, shouldPrompt, dismissPrompt }}>
      {/* Re-render the tree when the currency changes so every price updates. */}
      <Fragment key={currency}>{children}</Fragment>
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  return useContext(CurrencyContext);
}
