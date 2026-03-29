import { Schema, model, Types } from 'mongoose';

export type OrderStatus =
  | 'PENDING'
  | 'ORDER_CONFIRMED'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'CANCELLED';

const orderItemSchema = new Schema(
  {
    product: { type: Types.ObjectId, ref: 'Product', required: true },
    variantSku: { type: String },
    quantity: { type: Number, required: true },
    price: { type: Number, required: true }, // snapshot
    title: { type: String, required: true }, // snapshot
  },
  { _id: false }
);

const orderSchema = new Schema(
  {
    user: { type: Types.ObjectId, ref: 'User', required: true },

    items: {
      type: [orderItemSchema],
      required: true,
    },

    subtotal: { type: Number, required: true },
    shippingFee: { type: Number, default: 0 },
    total: { type: Number, required: true },

    status: {
      type: String,
      enum: ['PENDING', 'ORDER_CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED'],
      default: 'PENDING',
    },

    shippingAddress: {
      fullName: String,
      phone: String,
      addressLine: String,
      city: String,
      country: String,
      postalCode: String,
    },

    paidAt: Date,
    deliveredAt: Date,
  },
  { timestamps: true }
);

export const Order = model('Order', orderSchema);
