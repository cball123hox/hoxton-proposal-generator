import type { Region, ProductModule, Category } from '../types'

export const REGIONS: Region[] = [
  { id: 'uk', name: 'UK', display: 'United Kingdom', introSlides: 21 },
  { id: 'asia', name: 'Asia', display: 'Asia Pacific', introSlides: 21 },
  { id: 'int', name: 'International', display: 'International', introSlides: 22 },
  { id: 'jp', name: 'Japan', display: 'Japan', introSlides: 14 },
]

export const PRODUCT_MODULES: ProductModule[] = [
  { id: 'sipp-intl', name: 'UK Retirement Options (SIPP)', category: 'Retirement', regions: ['uk', 'int', 'asia'], slides: 12, layout: 'new' },
  { id: 'sipp-domestic', name: 'UK Retirement Options (Domestic)', category: 'Retirement', regions: ['uk'], slides: 8, layout: 'new' },
  { id: 'gia-intl', name: 'General Investment Account (GIA)', category: 'Investment', regions: ['int', 'asia'], slides: 11, layout: 'new' },
  { id: 'gia-domestic', name: 'GIA (UK Domestic)', category: 'Investment', regions: ['uk'], slides: 5, layout: 'new' },
  { id: 'offshore-bond', name: 'Offshore Bond', category: 'Tax Planning', regions: ['uk', 'int'], slides: 13, layout: 'new' },
  { id: 'offshore-bond-aus', name: 'Offshore Bond (Australia)', category: 'Tax Planning', regions: ['asia'], slides: 12, layout: 'new' },
  { id: '401k', name: '401(k) / IRA Rollover', category: 'Retirement', regions: ['int'], slides: 10, layout: 'new' },
  { id: 'annuities', name: 'Annuities', category: 'Insurance', regions: ['int'], slides: 5, layout: 'new' },
  { id: 'fpcf', name: 'Focus Private Credit Fund', category: 'Investment', regions: ['uk', 'int', 'asia', 'jp'], slides: 9, layout: 'new' },
  { id: 'fic', name: 'Family Investment Company (FIC)', category: 'Tax Planning', regions: ['uk'], slides: 3, layout: 'old' },
  { id: 'vct', name: 'Venture Capital Trust (VCT)', category: 'Tax Planning', regions: ['uk'], slides: 6, layout: 'old' },
  { id: 'eis', name: 'Enterprise Investment Scheme (EIS)', category: 'Tax Planning', regions: ['uk'], slides: 4, layout: 'old' },
  { id: 'ssas', name: 'SSAS', category: 'Retirement', regions: ['uk'], slides: 3, layout: 'old' },
  { id: 'estate-planning', name: 'Estate Planning', category: 'Estate Planning', regions: ['uk', 'int'], slides: 6, layout: 'old' },
  { id: 'bushell', name: 'Bushell Investment Group', category: 'Investment', regions: ['int'], slides: 4, layout: 'old' },
  { id: 'tab-bond', name: 'TAB Bond', category: 'Investment', regions: ['int'], slides: 4, layout: 'old' },
  { id: 'focus-bond', name: 'Focus AF Property & Lotus Sanctuary', category: 'Investment', regions: ['int'], slides: 4, layout: 'old' },
  { id: 'structured-notes', name: 'Structured Notes', category: 'Investment', regions: ['int'], slides: 7, layout: 'old' },
  { id: 'assurance-vie', name: 'Assurance Vie', category: 'Tax Planning', regions: ['int'], slides: 6, layout: 'old' },
  { id: 'australian-bond', name: 'Australian Bond', category: 'Investment', regions: ['asia'], slides: 8, layout: 'old' },
  { id: 'us-estate-tax', name: 'US Estate Tax Planning', category: 'Estate Planning', regions: ['int'], slides: 6, layout: 'old' },
  { id: '401k-active', name: '401(k)/403(b) Active Management', category: 'Retirement', regions: ['int'], slides: 3, layout: 'old' },
  { id: 'iul', name: 'IUL / 529 Alternative', category: 'Insurance', regions: ['int'], slides: 5, layout: 'old' },
  { id: 'accountancy', name: 'Hoxton Accountancy Services', category: 'Services', regions: ['int'], slides: 5, layout: 'old' },
]

export const CATEGORIES: Category[] = ['Retirement', 'Investment', 'Tax Planning', 'Estate Planning', 'Insurance', 'Services']
