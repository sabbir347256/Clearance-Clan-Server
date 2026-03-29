import { Types } from 'mongoose';

export interface ICartItem {
  product: Types.ObjectId;
  variantSku?: string;
  quantity: number;
  price: number; // snapshot price
}

export interface ICart {
  user: Types.ObjectId;
  items: ICartItem[];
}

export interface AddCartItemPayload {
  productId: string;
  variantSku?: string;
  quantity?: number;
}

export interface UpdateCartPayload {
  items: Array<{
    productId: string;
    variantSku?: string;
    quantity: number;
  }>;
}

export default ICart;
