// Tipos de dominio de Memory Box (espejo de los modelos del backend).
// Se mantienen flexibles: los snapshots y settings llegan como JSON libre.

export type BoxType = "no_light" | "with_light";
export type LedType = "warm" | "white";
export type ShippingOption = "pickup" | "province";
export type OrderStatus = "draft" | "in_progress" | "processing" | "delivered";

export interface ImageCrop {
  id: number;
  order?: number;
  slot: number;
  display_order: number;
  image: string | null;
  crop_data?: { x: number; y: number; width: number; height: number } | null;
  created_at?: string;
}

export interface Order {
  id: number;
  client_name: string;
  phone: string;
  box_type: BoxType;
  led_type?: LedType | null;
  variant: string;
  shipping_option: ShippingOption;
  status: OrderStatus;
  deposit: boolean;
  active: boolean;
  qr_code?: string | null;
  cost_snapshot?: Record<string, unknown> | null;
  price_snapshot?: Record<string, unknown> | null;
  image_crops?: ImageCrop[];
  created_at?: string;
  updated_at?: string;
}

export interface StockItem {
  id: number;
  variant: string;
  box_type: BoxType;
  quantity: number;
}

export interface PackagingItem {
  id: number;
  item_type: string;
  quantity: number;
}

export interface Purchase {
  id: number;
  category: string;
  date: string;
  quantity: number;
  unit_cost: number;
  total_cost: number;
  variant?: string | null;
  brand?: string | null;
  grams_per_roll?: number | null;
  notes?: string | null;
}

export interface BoxVariant {
  id: number;
  code: string;
  name: string;
  visible_no_light: boolean;
  visible_with_light: boolean;
  order: number;
  images?: BoxVariantImage[];
}

export interface BoxVariantImage {
  id: number;
  variant: number;
  box_type: BoxType;
  file: string;
  order: number;
}

export interface BackgroundMedia {
  id: number;
  type: "video" | "audio";
  name: string;
  file: string;
}

// Settings y estadísticas llegan como objetos JSON variables.
export type Prices = Record<string, unknown>;
export type Costs = Record<string, unknown>;
export type Estadisticas = Record<string, unknown>;
