interface AppLogoProps {
  className?: string;
}

export function AppLogoIcon({ className = "w-6 h-6" }: AppLogoProps) {
  return (
    <svg
      viewBox="0 0 36 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <rect x="7" y="9" width="22" height="4" rx="2" fill="currentColor" />
      <rect x="15" y="13" width="6" height="14" rx="2" fill="currentColor" />
      <rect x="10" y="22" width="16" height="3" rx="1.5" fill="currentColor" fillOpacity="0.5" />
    </svg>
  );
}

export function AppLogoFull({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <AppLogoIcon className="w-6 h-6 text-primary" />
      <span className="font-bold tracking-tight text-foreground">
        Bmb Tech <span className="text-primary">Hosting</span>
      </span>
    </span>
  );
}
