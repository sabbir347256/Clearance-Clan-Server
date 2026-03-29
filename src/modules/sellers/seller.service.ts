import { Shop } from './seller.model';
import { uploadBufferToCloudinary } from '../../config/cloudinary.config';
import AppError from '../../errorHelper/AppError';
import { Order } from '../order/order.model';

interface FileFields {
  [fieldname: string]: Express.Multer.File[];
}

const createShop = async (userId: string, payload: any, files?: FileFields) => {
  const existing = await Shop.findOne({ userId });
  if (existing) {
    throw new AppError(400, 'Seller shop already exists');
  }

  // Upload files to Cloudinary
  let shopLogoUrl = '';
  let shopBannerUrl = '';
  let nationalIdUrl = '';
  let companyRegistrationUrl = '';
  let taxDocumentUrl = '';

  try {
    if (files?.shopLogo?.[0]) {
      const result = await uploadBufferToCloudinary(
        files.shopLogo[0].buffer,
        `shop-logo-${userId}`,
        'shops/logos'
      );
      shopLogoUrl = result.secure_url;
    }

    if (files?.shopBanner?.[0]) {
      const result = await uploadBufferToCloudinary(
        files.shopBanner[0].buffer,
        `shop-banner-${userId}`,
        'shops/banners'
      );
      shopBannerUrl = result.secure_url;
    }

    if (files?.nationalId?.[0]) {
      const result = await uploadBufferToCloudinary(
        files.nationalId[0].buffer,
        `national-id-${userId}`,
        'shops/documents'
      );
      nationalIdUrl = result.secure_url;
    }

    if (files?.companyRegistration?.[0]) {
      const result = await uploadBufferToCloudinary(
        files.companyRegistration[0].buffer,
        `company-reg-${userId}`,
        'shops/documents'
      );
      companyRegistrationUrl = result.secure_url;
    }

    if (files?.taxDocument?.[0]) {
      const result = await uploadBufferToCloudinary(
        files.taxDocument[0].buffer,
        `tax-doc-${userId}`,
        'shops/documents'
      );
      taxDocumentUrl = result.secure_url;
    }
  } catch (error: any) {
    throw new AppError(500, `File upload failed: ${error.message}`);
  }

  const shopData = {
    userId,
    shopName: payload.shopName,
    shopCategory: payload.shopCategory,
    businessType: payload.businessType,
    shopDescription: payload.shopDescription,
    country: payload.country,
    city: payload.city,
    businessAddress: payload.businessAddress,
    pickupLocation: payload.pickupLocation,
    phoneNumber: payload.phoneNumber,
    branding: {
      logoUrl: shopLogoUrl,
      bannerUrl: shopBannerUrl
    },
    bankDetails: {
      accountHolderName: payload.accountHolderName,
      bankName: payload.bankName,
      routingCode: payload.routingCode,
      payoutFrequency: payload.payoutFrequency
    },
    documents: {
      nationalId: nationalIdUrl,
      companyRegistration: companyRegistrationUrl,
      taxDocument: taxDocumentUrl
    },
    status: 'PENDING'
  };

  return Shop.create(shopData);
};


const getShopByUserId = async (userId: string) => {
  const seller = await Shop.findOne({ userId });
  return seller;
};

const updateShop = async (userId: string, payload: any, files?: FileFields) => {
  const seller = await Shop.findOne({ userId });
  if (!seller) {
    throw new AppError(404, 'Shop not found');
  }

  // Upload new files to Cloudinary if provided
  const updateData: any = {
    shopName: payload.shopName || seller.shopName,
    shopCategory: payload.shopCategory || seller.shopCategory,
    businessType: payload.businessType || seller.businessType,
    shopDescription: payload.shopDescription || seller.shopDescription,
    country: payload.country || seller.country,
    city: payload.city || seller.city,
    businessAddress: payload.businessAddress || seller.businessAddress,
    pickupLocation: payload.pickupLocation || seller.pickupLocation,
    phoneNumber: payload.phoneNumber || seller.phoneNumber
  };

  // Update branding files
  const branding: any = {};
  if (files?.shopLogo?.[0]) {
    const result = await uploadBufferToCloudinary(
      files.shopLogo[0].buffer,
      `shop-logo-${userId}`,
      'shops/logos'
    );
    branding.logoUrl = result.secure_url;
  } else {
    branding.logoUrl = seller.branding?.logoUrl;
  }

  if (files?.shopBanner?.[0]) {
    const result = await uploadBufferToCloudinary(
      files.shopBanner[0].buffer,
      `shop-banner-${userId}`,
      'shops/banners'
    );
    branding.bannerUrl = result.secure_url;
  } else {
    branding.bannerUrl = seller.branding?.bannerUrl;
  }
  updateData.branding = branding;

  // Update bank details if provided
  if (payload.accountHolderName || payload.bankName || payload.routingCode || payload.payoutFrequency) {
    updateData.bankDetails = {
      accountHolderName: payload.accountHolderName || seller.bankDetails.accountHolderName,
      bankName: payload.bankName || seller.bankDetails.bankName,
      routingCode: payload.routingCode || seller.bankDetails.routingCode,
      payoutFrequency: payload.payoutFrequency || seller.bankDetails.payoutFrequency
    };
  }

  // Update documents
  const documents: any = {};
  if (files?.nationalId?.[0]) {
    const result = await uploadBufferToCloudinary(
      files.nationalId[0].buffer,
      `national-id-${userId}`,
      'shops/documents'
    );
    documents.nationalId = result.secure_url;
  } else {
    documents.nationalId = seller.documents?.nationalId;
  }

  if (files?.companyRegistration?.[0]) {
    const result = await uploadBufferToCloudinary(
      files.companyRegistration[0].buffer,
      `company-reg-${userId}`,
      'shops/documents'
    );
    documents.companyRegistration = result.secure_url;
  } else {
    documents.companyRegistration = seller.documents?.companyRegistration;
  }

  if (files?.taxDocument?.[0]) {
    const result = await uploadBufferToCloudinary(
      files.taxDocument[0].buffer,
      `tax-doc-${userId}`,
      'shops/documents'
    );
    documents.taxDocument = result.secure_url;
  } else {
    documents.taxDocument = seller.documents?.taxDocument;
  }
  updateData.documents = documents;

  const updated = await Shop.findOneAndUpdate({ userId }, updateData, { new: true });
  return updated;
};

// Dashboard totals for a seller's shop
const getDashboard = async (userId: string) => {
  const shop = await Shop.findOne({ userId });
  if (!shop) throw new AppError(404, 'Shop not found');

  const pipeline = [
    { $match: { status: { $ne: 'CANCELLED' } } },
    { $unwind: '$items' },
    {
      $lookup: {
        from: 'products',
        localField: 'items.product',
        foreignField: '_id',
        as: 'product'
      }
    },
    { $unwind: '$product' },
    { $match: { 'product.shop': shop._id } },
    {
      $group: {
        _id: null,
        ordersSet: { $addToSet: '$_id' },
        revenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
        units: { $sum: '$items.quantity' }
      }
    },
    {
      $project: {
        _id: 0,
        orders: { $size: '$ordersSet' },
        revenue: 1,
        units: 1
      }
    }
  ];

  const result = await Order.aggregate(pipeline as any);
  const totals = result[0] || { orders: 0, revenue: 0, units: 0 };

  return {
    totalOrders: totals.orders || 0,
    totalRevenue: totals.revenue || 0,
    totalUnits: totals.units || 0
  };
};

export const SellerService = {
  createShop,
  getShopByUserId,
  updateShop,
  getDashboard
};