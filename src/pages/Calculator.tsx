import { useMemo, useState } from "react";
import { useNavLoader } from "@/App";
import { TechBackground } from "@/components/TechBackground";
import { AppLogoIcon } from "@/components/AppLogo";
import { ArrowLeft } from "lucide-react";

export function Calculator() {
  const { navigateWithLoader } = useNavLoader();
  const [display, setDisplay] = useState("0");
  const [prev, setPrev] = useState<string | null>(null);
  const [op, setOp] = useState<string | null>(null);
  const [waitNext, setWaitNext] = useState(false);

  const liveResult = useMemo(() => {
    if (!op || prev === null || waitNext) return null;
    const a = parseFloat(prev);
    const b = parseFloat(display);
    if (isNaN(a) || isNaN(b) || display === "" || display === "Error") return null;
    let result: number;
    if (op === "+") result = a + b;
    else if (op === "-") result = a - b;
    else if (op === "×") result = a * b;
    else if (op === "÷") result = b === 0 ? NaN : a / b;
    else return null;
    if (isNaN(result) || !isFinite(result)) return "Error";
    return String(parseFloat(result.toFixed(10)));
  }, [display, prev, op, waitNext]);

  const input = (val: string) => {
    if (display === "Error") {
      setDisplay(val === "." ? "0." : val);
      setWaitNext(false);
      return;
    }
    if (waitNext) {
      setDisplay(val === "." ? "0." : val);
      setWaitNext(false);
      return;
    }
    if (val === "." && display.includes(".")) return;
    setDisplay(display === "0" && val !== "." ? val : display + val);
  };

  const setOperator = (next: string) => {
    if (display === "Error") return;
    if (op && prev !== null && !waitNext) {
      const a = parseFloat(prev);
      const b = parseFloat(display);
      let result: number;
      if (op === "+") result = a + b;
      else if (op === "-") result = a - b;
      else if (op === "×") result = a * b;
      else if (op === "÷") result = b === 0 ? NaN : a / b;
      else result = b;
      const r = isNaN(result) || !isFinite(result) ? "Error" : String(parseFloat(result.toFixed(10)));
      setPrev(r === "Error" ? null : r);
      setDisplay(r === "Error" ? "Error" : r);
      setOp(r === "Error" ? null : next);
      setWaitNext(true);
      return;
    }
    setPrev(display);
    setOp(next);
    setWaitNext(true);
  };

  const calculate = () => {
    if (!op || prev === null) return;
    const a = parseFloat(prev);
    const b = parseFloat(display);
    let result: number;
    if (op === "+") result = a + b;
    else if (op === "-") result = a - b;
    else if (op === "×") result = a * b;
    else if (op === "÷") result = b === 0 ? NaN : a / b;
    else return;
    const r = isNaN(result) || !isFinite(result) ? "Error" : String(parseFloat(result.toFixed(10)));
    setDisplay(r);
    setPrev(null);
    setOp(null);
    setWaitNext(true);
  };

  const clear = () => { setDisplay("0"); setPrev(null); setOp(null); setWaitNext(false); };
  const negate = () => {
    if (display === "Error") return;
    setDisplay(String(parseFloat(display) * -1));
  };
  const percent = () => {
    if (display === "Error") return;
    setDisplay(String(parseFloat(display) / 100));
  };
  const backspace = () => {
    if (display.length <= 1 || display === "Error") { setDisplay("0"); return; }
    setDisplay(display.slice(0, -1));
  };

  type BtnVariant = "number" | "operator" | "action" | "equals";
  const btn = (label: string, action: () => void, variant: BtnVariant = "number", wide = false) => {
    const base = "flex items-center justify-center rounded-2xl text-xl font-semibold select-none active:scale-95 transition-all duration-100 cursor-pointer";
    const variants: Record<BtnVariant, string> = {
      number: "bg-muted hover:bg-muted/70 text-foreground",
      operator: "bg-teal-500/20 hover:bg-teal-500/30 text-teal-400 border border-teal-500/20",
      action: "bg-card hover:bg-muted text-muted-foreground border border-border",
      equals: "bg-teal-600 hover:bg-teal-500 text-white shadow-lg shadow-teal-900/30",
    };
    return (
      <button key={label} onClick={action}
        className={`${base} ${variants[variant]} ${wide ? "col-span-2" : ""} h-16`}>
        {label}
      </button>
    );
  };

  const truncated = display.length > 12 ? parseFloat(display).toExponential(4) : display;

  return (
    <div className="min-h-screen bg-background relative">
      <TechBackground />
      <div className="min-h-screen flex flex-col items-center justify-start pt-10 pb-10 px-4 relative z-[1]">
        <div className="w-full max-w-sm space-y-4">
          <div className="flex items-center gap-3 mb-2">
            <button onClick={() => navigateWithLoader("/dashboard")} className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <AppLogoIcon className="w-5 h-5 text-primary" />
              <span className="font-bold text-base">Calculator</span>
            </div>
          </div>

          <div className="bg-card border border-border rounded-3xl overflow-hidden shadow-xl">
            <div className="px-6 pt-8 pb-6">
              <div className="text-right">
                {op && prev !== null && (
                  <p className="text-sm text-muted-foreground mb-1 h-5">{prev} {op}{!waitNext ? ` ${display}` : ""}</p>
                )}
                {!(op && prev !== null) && <p className="h-5" />}
                <p className="text-5xl font-light text-foreground overflow-hidden text-ellipsis whitespace-nowrap">{truncated}</p>
                {liveResult !== null && liveResult !== display && (
                  <p className="text-sm text-teal-400 mt-2 h-5">= {liveResult}</p>
                )}
                {(liveResult === null || liveResult === display) && <p className="h-5 mt-2" />}
              </div>
            </div>

            <div className="px-4 pb-6 grid grid-cols-4 gap-3">
              {btn("AC", clear, "action")}
              {btn("+/-", negate, "action")}
              {btn("%", percent, "action")}
              {btn("÷", () => setOperator("÷"), "operator")}

              {btn("7", () => input("7"))}
              {btn("8", () => input("8"))}
              {btn("9", () => input("9"))}
              {btn("×", () => setOperator("×"), "operator")}

              {btn("4", () => input("4"))}
              {btn("5", () => input("5"))}
              {btn("6", () => input("6"))}
              {btn("-", () => setOperator("-"), "operator")}

              {btn("1", () => input("1"))}
              {btn("2", () => input("2"))}
              {btn("3", () => input("3"))}
              {btn("+", () => setOperator("+"), "operator")}

              {btn("⌫", backspace, "action")}
              {btn("0", () => input("0"))}
              {btn(".", () => input("."))}
              {btn("=", calculate, "equals")}
            </div>
          </div>

          <p className="text-center text-xs text-muted-foreground">Bmb Tech Hosting · Calculator</p>
        </div>
      </div>
    </div>
  );
}
