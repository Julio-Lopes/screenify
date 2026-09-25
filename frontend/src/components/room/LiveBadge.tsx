/** Selo "Ao vivo" do design system: aparece enquanto existe uma tela sendo transmitida na sala */
export function LiveBadge() {
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-error/12 px-2 py-0.5 text-[11px] font-semibold tracking-[.04em] text-error-text uppercase">
      <span className="size-1.5 animate-pulse rounded-full bg-error" aria-hidden />
      Ao vivo
    </span>
  );
}