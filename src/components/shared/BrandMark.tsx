import { cn } from '@/lib/utils';

interface BrandMarkProps {
  /** Use `icon` for compact UI/favicon-like sizes and `mark` for larger brand placements. */
  variant?: 'icon' | 'mark';
  className?: string;
  alt?: string;
  priority?: boolean;
}

const BRAND_ASSETS = {
  icon: '/brand/cactus-icon-96.png',
  mark: '/brand/cactus-brand-mark.png',
} as const;

export function BrandMark({
  variant = 'icon',
  className,
  alt = 'Cacto da GESTÃO ÓTICAS H2K',
  priority = false,
}: BrandMarkProps) {
  return (
    <img
      src={BRAND_ASSETS[variant]}
      alt={alt}
      className={cn('select-none object-contain', className)}
      draggable={false}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
    />
  );
}
