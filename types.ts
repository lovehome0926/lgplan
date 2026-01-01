
export enum Language {
  EN = 'EN',
  CN = 'CN'
}

export enum CustomerType {
  EXISTING = 'Existing',
  NEW = 'New'
}

export enum PlanType {
  SUBSCRIBE = 'Subscribe',
  OUTRIGHT = 'Outright',
  BUNDLE = 'Bundle'
}

export enum ContractLength {
  MONTHS_36 = '36 months',
  MONTHS_60 = '60 months',
  MONTHS_84 = '84 months'
}

export enum ProductCategory {
  WP = 'WP (Water Purifiers)',
  AP = 'AP (Air Purifiers)',
  REF = 'REF (Refrigerators)',
  RAC = 'RAC (Air Conditioners)',
  MICROWAVE = 'MICROWAVE',
  TV = 'TV',
  SOUNDBAR = 'SOUNDBAR',
  MONITOR = 'MONITOR',
  VACUUM = 'VACUUM',
  DEHUMIDIFIER = 'DEHUMIDIFIER',
  WASHER_DRYER = 'WASHER & DRYER'
}

export interface ProductInput {
  category: string;
  name: string;
  model: string;
  quantity: number;
  contract: ContractLength;
}

export interface OrderData {
  customerType: CustomerType;
  products: ProductInput[];
  plan: PlanType;
  promotion: string;
  manualKnowledge?: string;
  additionalContext?: string;
  wantsFullSettlement: boolean;
  language: Language;
}

export interface FileData {
  name: string;
  base64: string;
  mimeType: string;
  isSystem?: boolean; // New: Flag to identify built-in files
}

export interface CatalogItem {
  id: string;
  category: ProductCategory;
  name: string;
  models: string[];
  supportedPlans: ContractLength[];
}

// This allows the owner to "bake" the configuration into the app
export interface SystemConfig {
  catalog: CatalogItem[];
  masterKnowledge: string;
  memos: FileData[];
}

export const DEFAULT_CATALOG: CatalogItem[] = [
  { 
    id: 'wp-1',
    category: ProductCategory.WP,
    name: 'PuriCare Self-Service', 
    models: ['WD518AN (Navy)', 'WD518AS (Silver)', 'WD516AN'], 
    supportedPlans: [ContractLength.MONTHS_60, ContractLength.MONTHS_84] 
  },
  { 
    id: 'ap-1',
    category: ProductCategory.AP,
    name: 'PuriCare 360 Hit', 
    models: ['AS60GHWG0', 'AS60GHCGO'], 
    supportedPlans: [ContractLength.MONTHS_60, ContractLength.MONTHS_84] 
  },
  { 
    id: 'ref-1',
    category: ProductCategory.REF,
    name: 'InstaView Door-in-Door', 
    models: ['GC-X247CSAV', 'GC-X22FTQLL'], 
    supportedPlans: [ContractLength.MONTHS_60] 
  },
  { 
    id: 'rac-1',
    category: ProductCategory.RAC,
    name: 'Dual Inverter AirCon', 
    models: ['S3-Q09JAPPA (1.0HP)', 'S3-Q12JAPPA (1.5HP)'], 
    supportedPlans: [ContractLength.MONTHS_60] 
  },
  { 
    id: 'mw-1',
    category: ProductCategory.MICROWAVE,
    name: 'NeoChef Microwave', 
    models: ['MS2595DIS', 'MH6565DIS'], 
    supportedPlans: [ContractLength.MONTHS_36, ContractLength.MONTHS_60] 
  },
  { 
    id: 'tv-1',
    category: ProductCategory.TV,
    name: 'OLED evo C3', 
    models: ['OLED55C3PSA', 'OLED65C3PSA'], 
    supportedPlans: [ContractLength.MONTHS_60] 
  },
  { 
    id: 'sb-1',
    category: ProductCategory.SOUNDBAR,
    name: 'LG Soundbar', 
    models: ['SC9S', 'S95QR'], 
    supportedPlans: [ContractLength.MONTHS_60] 
  },
  { 
    id: 'mon-1',
    category: ProductCategory.MONITOR,
    name: 'UltraGear Gaming', 
    models: ['27GR95QE', '45GR95QE'], 
    supportedPlans: [ContractLength.MONTHS_60] 
  },
  { 
    id: 'vac-1',
    category: ProductCategory.VACUUM,
    name: 'CordZero A9K', 
    models: ['A9K-ULTRA', 'A9K-CORE'], 
    supportedPlans: [ContractLength.MONTHS_60] 
  },
  { 
    id: 'dehu-1',
    category: ProductCategory.DEHUMIDIFIER,
    name: 'PuriCare Dehumidifier', 
    models: ['MD16GQSA1', 'MD19GQGA1'], 
    supportedPlans: [ContractLength.MONTHS_60, ContractLength.MONTHS_84] 
  },
  { 
    id: 'wd-1',
    category: ProductCategory.WASHER_DRYER,
    name: 'Vivace Washer Dryer', 
    models: ['V4-FV1409S4W', 'V5-FV1450S4W'], 
    supportedPlans: [ContractLength.MONTHS_60] 
  }
];
