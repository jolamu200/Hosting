/** Static brand backdrop: soft grid + two colour glows (no canvas animation). */
export function TechBackground() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 bmb-grid" />
      <div
        className="absolute -top-40 -left-32 h-[28rem] w-[28rem] rounded-full blur-3xl"
        style={{ background: "hsl(var(--primary) / 0.16)" }}
      />
      <div
        className="absolute top-1/2 -right-40 h-[26rem] w-[26rem] rounded-full blur-3xl"
        style={{ background: "hsl(var(--brand-2) / 0.10)" }}
      />
    </div>
  );
}
