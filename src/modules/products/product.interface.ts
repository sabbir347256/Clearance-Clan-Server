import { Types } from 'mongoose';

export interface IVariant {
  attributes: Record<string, string>; // dynamic (size, color, etc.)
  price: number;
  stock: number;
  sku?: string;
  // Stripe identifiers for this specific variant (optional)
  stripeProductId?: string;
  stripePriceId?: string;
}

export interface IProduct {
  name: string;
  description?: string;
  category?: Types.ObjectId;

  pricing?: {
    basePrice?: number;
    salePrice?: number;
  };

  inventory: {
    stock: number;
    lowStockAlert: number;
  };

  variants: IVariant[];

  media?: {
    coverImage?: string;
    gallery?: string[];
  };

  shipping?: {
    weight?: number;
    shippingFee?: number;
    freeShipping?: boolean;
  };

  shop: Types.ObjectId;
  isActive: boolean;

  // Admin approval status
  approvalStatus?: 'PENDING' | 'APPROVED' | 'REJECTED';

  // ✅ Stripe
  stripeProductId?: string;
  stripePriceId?: string;
}

export interface GetProductsByShopParams {
  shopId: string;
  page: number;
  limit: number;
}

export interface UpdateProductParams {
  productId: string;
  shopId: string;
  payload: any;
}
