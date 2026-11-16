/** Same look as the boot screen in index.html, used while routes/auth load. */
export function PageLoader() {
  return (
    <div className="ld-root ld-page">
      <div className="ld-logo">
        <span className="ld-ring" />
        <span className="ld-box">
          <img src="/favicon.png" alt="" width={44} height={44} />
        </span>
      </div>
      <div className="ld-title">
        <span className="ld-name">Bmb Tech</span>
        <span className="ld-badge">Cloud</span>
      </div>
      <p className="ld-sub">Initializing platform...</p>
      <div className="ld-bar"><span /></div>
      <ul className="ld-steps">
        <li>Connect</li>
        <li>Load</li>
        <li>Ready</li>
      </ul>
      <style>{`
        .ld-page { min-height: 100vh; background: hsl(var(--background)); }
        .ld-root{--ld-1:#2dd4bf;--ld-2:#34d399;--ld-3:#fb923c;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:"Manrope",ui-sans-serif,system-ui,sans-serif;color:hsl(var(--foreground,180 20% 95%))}
        .ld-logo{position:relative;width:96px;height:96px;display:grid;place-items:center}
        .ld-ring{position:absolute;inset:0;border-radius:50%;background:conic-gradient(from 0deg,var(--ld-3),var(--ld-1) 45%,var(--ld-2) 70%,transparent 90%,var(--ld-3));-webkit-mask:radial-gradient(farthest-side,transparent calc(100% - 3px),#000 calc(100% - 2px));mask:radial-gradient(farthest-side,transparent calc(100% - 3px),#000 calc(100% - 2px));animation:ld-spin 2.4s linear infinite}
        .ld-box{position:relative;width:72px;height:72px;border-radius:18px;background:hsl(var(--card,191 30% 9.5%));border:1px solid hsl(var(--border,190 22% 17%));display:grid;place-items:center;overflow:hidden}
        .ld-box img{width:44px;height:44px;object-fit:contain;border-radius:10px}
        .ld-title{display:flex;align-items:center;gap:10px;margin-top:22px}
        .ld-name{font-family:"Sora","Manrope",ui-sans-serif,system-ui,sans-serif;font-size:26px;font-weight:800;letter-spacing:-0.02em;background:linear-gradient(90deg,var(--ld-1),var(--ld-3));-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}
        .ld-badge{font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--ld-3);border:1px solid rgba(251,146,60,.4);background:rgba(251,146,60,.12);border-radius:999px;padding:3px 10px}
        .ld-sub{margin:10px 0 0;font-size:14px;color:hsl(var(--muted-foreground,186 14% 62%))}
        .ld-bar{width:192px;height:4px;border-radius:999px;background:hsl(var(--muted,190 24% 13%));margin-top:22px;overflow:hidden}
        .ld-bar span{display:block;height:100%;width:100%;border-radius:inherit;transform-origin:left center;background:linear-gradient(90deg,var(--ld-1),var(--ld-2),var(--ld-3));animation:ld-fill 2.2s ease-in-out infinite}
        .ld-steps{display:flex;gap:18px;list-style:none;margin:18px 0 0;padding:0;font-size:13px;font-weight:600}
        .ld-steps li{display:flex;align-items:center;gap:6px}
        .ld-steps li::before{content:"";width:6px;height:6px;border-radius:50%;background:var(--ld-1);animation:ld-dot 2.4s ease-in-out infinite}
        .ld-steps li:nth-child(2)::before{background:var(--ld-2);animation-delay:.8s}
        .ld-steps li:nth-child(3)::before{background:var(--ld-3);animation-delay:1.6s}
        @keyframes ld-spin{to{transform:rotate(360deg)}}
        @keyframes ld-fill{0%{transform:scaleX(.06)}80%,100%{transform:scaleX(1)}}
        @keyframes ld-dot{0%,100%{opacity:.35;transform:scale(.85)}30%{opacity:1;transform:scale(1.25)}}
        @media (prefers-reduced-motion:reduce){.ld-ring{animation-duration:6s}.ld-bar span{animation:none}}
        
      `}</style>
    </div>
  );
}
