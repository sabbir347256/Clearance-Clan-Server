import { Types } from 'mongoose';

export enum OrderStatus {
  PENDING = 'PENDING',
  ORDER_CONFIRMED = 'ORDER_CONFIRMED',
  SHIPPED = 'SHIPPED',
  OUT_FOR_DELIVERY = 'OUT_FOR_DELIVERY',
  DELIVERED = 'DELIVERED'
}

export interface IOrderItem {
  product?: Types.ObjectId;
  title: string;
  variantSku?: string;
  price: number; // immutable snapshot
  quantity: number;
}

export interface IOrder {
  buyer: Types.ObjectId;
  items: IOrderItem[];
  subtotal: number;
  shippingFee: number;
  total: number;
  status: OrderStatus;
}

export default IOrder;
