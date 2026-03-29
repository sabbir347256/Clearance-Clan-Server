import { Schema, model, Document } from 'mongoose';
import { IUser } from './user.interfaces';

const userSchema = new Schema(
  {
    imgUrl: { type: String },
    fullName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String },
    provider: { type: String },
    providerId: { type: String },
    role: { type: String, enum: ['BUYER', 'SELLER', 'ADMIN'], required: true },
    gender: { type: String, enum: ['MALE', 'FEMALE', 'OTHER'], required: false },
    dateOfBirth: { type: Date, required: false },
    country : { type: String, required: false },
    addresses: [
      {
        label: { type: String, enum: ['HOME', 'OFFICE', 'OTHERS'], required: true },
        street: { type: String },
        city: { type: String },
        postalCode: { type: String },
        state: { type: String },
        phone: { type: String },
        fullName: { type: String },
        isDefault: { type: Boolean, default: false },
        createdAt: { type: Date, default: Date.now }
      }
    ],
    // ✅ Stripe Connect
    stripeConnectAccountId: { type: String },
    isEmailVerified: { type: Boolean, default: false }
    ,
    // Favourite products for the user
    favorites: [{ type: Schema.Types.ObjectId, ref: 'Product' }],
    resetPasswordOtp: { type: String },
    resetPasswordOtpExpires: { type: Date },
    resetPasswordVerified: { type: Boolean, default: false },
    fcmTokens: { type: [String], default: [] }
  },
  { timestamps: true }
);

export const User = model<IUser>('User', userSchema);
