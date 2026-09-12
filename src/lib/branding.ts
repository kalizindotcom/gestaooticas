export const BRAND = {
  name: 'GESTÃO ÓTICAS H2K',
  subtitle: 'Sertão ótica & Nordestina',
  primary: '#E6451F',
  primaryDark: '#9B3218',
  primaryLight: '#F0643E',
  accent: '#F28C28',
  green: '#4F8630',
  greenLight: '#A3D33F',
  markAsset: '/brand/cactus-brand-mark.png',
  iconAsset: '/brand/cactus-icon-96.png',
  faviconAsset: '/brand/cactus-favicon.png',
} as const;

export const COMPANY_PALETTE = {
  primaryColor: BRAND.primary,
  secondaryColor: BRAND.primaryDark,
} as const;
