import type { QualityTarget } from '@screenify/shared';

/** Badges do design system com a qualidade escolhida para a live, visíveis para toda a sala */
export function QualityBadges({ quality }: { quality: QualityTarget }) {
  const badge =
    'inline-flex h-[22px] shrink-0 items-center rounded-sm border border-border px-1.5 font-mono text-[11px] font-medium text-text-secondary tabular-nums';

  return (
    <span className="hidden items-center gap-1.5 md:flex" aria-label={`Transmitindo em ${quality.height}p a ${quality.frameRate} FPS`}>
      <span className={badge}>{quality.height}p</span>
      <span className={badge}>{quality.frameRate} FPS</span>
    </span>
  );
}