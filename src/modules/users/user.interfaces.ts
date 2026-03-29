import { Document } from "mongoose";

export interface IUser extends Document {
  imgUrl?: string;
  fullName: string;
  email: string;
  password?: string;
  resetPasswordOtp?: string;
  country?: string;
  resetPasswordOtpExpires?: Date;
  resetPasswordVerified?: boolean;
  role: 'BUYER' | 'SELLER' | 'ADMIN';
  // ✅ Stripe
  stripeConnectAccountId?: string;
  provider?: string;
  providerId?: string;
  isEmailVerified: boolean;
  gender?: 'MALE' | 'FEMALE' | 'OTHER' | string;
  dateOfBirth?: Date;
  addresses?: IAddress[];
  favorites?: string[];
}

export type AddressLabel = 'HOME' | 'OFFICE' | 'OTHERS';

export interface IAddress {
  label: AddressLabel;
  street?: string;
  city?: string;
  postalCode?: string;
  state?: string;
  phone?: string;
  fullName?: string;
  isDefault?: boolean;
  createdAt?: Date;
}

