interface AppLogoProps {
  className?: string;
}

/** Bmb Tech mark: a monoline "B" built from two stacked loops. */
export function AppLogoIcon({ className = "w-6 h-6" }: AppLogoProps) {
  return (
    <svg
      viewBox="0 0 36 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M11 6v24M11 6h7a5.5 5.5 0 0 1 0 11h-7M11 17h8a6.5 6.5 0 0 1 0 13h-8"
        stroke="currentColor"
        strokeWidth="3.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function AppLogoFull({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <span className="grid place-items-center w-7 h-7 rounded-md bg-primary text-primary-foreground">
        <AppLogoIcon className="w-[18px] h-[18px]" />
      </span>
      <span className="font-display font-bold tracking-tight text-foreground">
        Bmb<span className="text-primary">Tech</span>
      </span>
    </span>
  );
}
