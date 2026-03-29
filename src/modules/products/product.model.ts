import { Schema, model } from 'mongoose';
import { IProduct } from './product.interface';

const variantSchema = new Schema(
  {
    attributes: {
      type: Map,
      of: String,
      required: true
    },
    price: {
      type: Number,
      required: true
    },
    stock: {
      type: Number,
      required: true
    },
    sku: String
    ,
    // Stripe identifiers for variant-level products/prices
    stripeProductId: String,
    stripePriceId: String
  },
  { _id: false }
);

const productSchema = new Schema<IProduct>(
  {
    name: { type: String, required: true },

    description: { type: String, maxlength: 500 },

    category: { type: Schema.Types.ObjectId, ref: 'Category' },

    pricing: {
      basePrice: Number,
      salePrice: Number
    },

    inventory: {
      stock: { type: Number, default: 0 },
      lowStockAlert: { type: Number, default: 10 }
    },

    variants: {
      type: [variantSchema],
      default: []
    },

    media: {
      coverImage: String,
      gallery: [String]
    },

    shipping: {
      weight: Number,
      shippingFee: Number,
      freeShipping: { type: Boolean, default: false }
    },

    shop: {
      type: Schema.Types.ObjectId,
      ref: 'Shop',
      required: true
    },

    isActive: { type: Boolean, default: true },

    // Approval status controlled by Admin: PENDING / APPROVED / REJECTED
    approvalStatus: {
      type: String,
      enum: ['PENDING', 'APPROVED', 'REJECTED'],
      default: 'PENDING'
    },

    // ✅ Stripe
    stripeProductId: { type: String },
    stripePriceId: { type: String }
  },
  
  { timestamps: true }
);

export const Product = model<IProduct>('Product', productSchema);
