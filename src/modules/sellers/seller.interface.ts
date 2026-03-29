import { Types } from "mongoose";

export interface IShop {
  userId: Types.ObjectId;

  shopName: string;
  shopCategory: string;
  businessType: 'INDIVIDUAL' | 'COMPANY';
  shopDescription?: string;

  country: string;
  city: string;
  businessAddress: string;
  pickupLocation: string;
  phoneNumber: string;

  branding: {
    logoUrl?: string;
    bannerUrl?: string;
  };

  bankDetails: {
    accountHolderName: string;
    bankName: string;
    routingCode: string;
    payoutFrequency: 'WEEKLY' | 'MONTHLY';
  };

  stripeAccountId?: string;
  
  documents: {
    nationalId?: string;
    companyRegistration?: string;
    taxDocument?: string;
  };

  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';
  rejectionReason?: string;
  suspensionReason?: string;
}

export interface ShopFiles {
  shopLogo?: string;
  shopBanner?: string;
  nationalId?: string;
  companyRegistration?: string;
  taxDocument?: string;
}