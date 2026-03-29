import { Schema, model, Types } from 'mongoose';
import { IShop } from './seller.interface';


const shopSchema = new Schema<IShop>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },

    shopName: { type: String, required: true },
    shopCategory: { type: String, required: true },
    businessType: {
      type: String,
      enum: ['INDIVIDUAL', 'COMPANY'],
      required: true
    },
    shopDescription: String,

    country: { type: String, required: true },
    city: { type: String, required: true },
    businessAddress: { type: String, required: true },
    pickupLocation: { type: String, required: true },
    phoneNumber: { type: String, required: true },

    branding: {
      logoUrl: String,
      bannerUrl: String
    },

    bankDetails: {
      accountHolderName: { type: String, required: false },
      bankName: { type: String, required: false },
      routingCode: { type: String, required: false },
      payoutFrequency: {
        type: String,
        enum: ['WEEKLY', 'MONTHLY'],
        required: false
      }
    },

    // optional: Stripe Connect account ID for payouts
    stripeAccountId: { type: String },

    documents: {
      nationalId: String,
      companyRegistration: String,
      taxDocument: String
    },

    status: {
      type: String,
      enum: ['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED'],
      default: 'PENDING'
    },

    rejectionReason: String,
    suspensionReason: String
  },
  { timestamps: true }
);

export const Shop = model<IShop>('Shop', shopSchema);
