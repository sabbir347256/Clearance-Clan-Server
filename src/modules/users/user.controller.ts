import { Request, Response } from 'express';
import { UserService } from './user.service';
import { uploadBufferToCloudinary } from '../../config/cloudinary.config';
import AppError from '../../errorHelper/AppError';
import asyncHandler from '../../utils/CatchAsync';
import { User } from './user.model';
import { Shop } from '../sellers/seller.model';
import { ProductService } from '../products/product.service';
import OrderService from '../order/order.service';
import { Order } from '../order/order.model';

const getProfile = async (req: Request, res: Response) => {
  const user = req.user;
  return res.json({ success: true, data: user });
};

const updateProfile = async (req: Request, res: Response) => {
  try {
    const userId = req.user?._id;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const { gender, dateOfBirth, fullName, name } = req.body || {};

    const updates: any = {};
    // allow updating user's display name via `fullName` or `name`
    const displayName = fullName || name;
    if (typeof displayName !== 'undefined' && displayName !== null) {
      const trimmed = String(displayName).trim();
      if (!trimmed) {
        return res.status(400).json({ success: false, message: 'Invalid name' });
      }
      updates.fullName = trimmed;
    }
    if (gender) {
      const allowed = ['MALE', 'FEMALE', 'OTHER'];
      if (!allowed.includes(gender)) {
        return res.status(400).json({ success: false, message: 'Invalid gender value' });
      }
      updates.gender = gender;
    }
    if (dateOfBirth) {
      const dob = new Date(dateOfBirth);
      if (isNaN(dob.getTime())) {
        return res.status(400).json({ success: false, message: 'Invalid dateOfBirth' });
      }
      updates.dateOfBirth = dob;
    }
    // handle profile photo upload (multer memory storage provides `req.file.buffer` or `req.files` array)
    let file = (req as any).file as Express.Multer.File | undefined;
    const files = (req as any).files as Express.Multer.File[] | undefined;
    if (!file && Array.isArray(files) && files.length > 0) {
      // prefer explicitly named field 'profilePhoto' if present
      file = files.find(f => f.fieldname === 'profilePhoto') || files[0];
    }
    if (file && (file as any).buffer) {
      try {
        const uploadResult = await uploadBufferToCloudinary(file.buffer, `user-${userId}`, 'profile_photos');
        // prefer secure_url when available
        updates.imgUrl = (uploadResult && (uploadResult.secure_url || (uploadResult as any).url)) as string;
      } catch (err: any) {
        throw new AppError(500, 'Failed to upload profile photo');
      }
    }

    const updated = await UserService.updateProfile(String(userId), updates);
    return res.json({ success: true, data: updated });
  } catch (error: any) {
    throw new AppError(500, error.message || 'Server error');
  }
};

const addAddress = async (req: Request, res: Response) => {
  try {
    const userId = req.user?._id;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    let addrObj: any = req.body;
    // support nested `address` field when using multipart/form-data
    if (req.body && req.body.address) addrObj = req.body.address;
    if (typeof addrObj === 'string') {
      try {
        addrObj = JSON.parse(addrObj);
      } catch (e) {}
    }

    const role = req.user?.role;
    if (role !== 'BUYER') {
      return res.status(403).json({ success: false, message: 'Only BUYER users can add shipping addresses' });
    }

    const allowed = ['HOME', 'OFFICE', 'OTHERS'];
    if (!addrObj || !allowed.includes(addrObj.label)) {
      return res.status(400).json({ success: false, message: 'Invalid or missing address label' });
    }

    const updated = await UserService.addAddress(String(userId), addrObj as any);
    return res.json({ success: true, data: updated });
  } catch (error: any) {
    throw new AppError(500, error.message || 'Server error');
  }
};

const getAddresses = async (req: Request, res: Response) => {
  try {
    const userId = req.user?._id;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });
    const addresses = await UserService.getAddresses(String(userId));
    return res.json({ success: true, data: addresses });
  } catch (error: any) {
    throw new AppError(500, error.message || 'Server error');
  }
};

const updateAddress = async (req: Request, res: Response) => {
  try {
    const userId = req.user?._id;
    const addressId = req.params.id;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });
    if (!addressId) return res.status(400).json({ success: false, message: 'Address id is required' });
    const payload = req.body || {};
    const updated = await UserService.updateAddressById(String(userId), String(addressId), payload);
    if (!updated) return res.status(404).json({ success: false, message: 'Address not found' });
    return res.json({ success: true, data: updated });
  } catch (error: any) {
    throw new AppError(500, error.message || 'Server error');
  }
};

const deleteAddress = async (req: Request, res: Response) => {
  try {
    const userId = req.user?._id;
    const addressId = req.params.id;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });
    if (!addressId) return res.status(400).json({ success: false, message: 'Address id is required' });
    const updated = await UserService.deleteAddressById(String(userId), String(addressId));
    if (!updated) return res.status(404).json({ success: false, message: 'Address not found' });
    return res.json({ success: true, data: updated });
  } catch (error: any) {
    throw new AppError(500, error.message || 'Server error');
  }
};

// const addCard = async (req: Request, res: Response) => {
//   try {
//     const userId = req.user?._id;
//     if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

//     let cardObj: any = req.body;
//     if (req.body && req.body.card) cardObj = req.body.card;
//     if (typeof cardObj === 'string') {
//       try {
//         cardObj = JSON.parse(cardObj);
//       } catch (e) {}
//     }

//     const last4 = cardObj.last4 || (cardObj.cardNumber ? String(cardObj.cardNumber).slice(-4) : undefined);
//     if (!last4) {
//       return res.status(400).json({ success: false, message: 'Invalid or missing card number' });
//     }

//     if (cardObj.cardNumber) {
//       cardObj.maskedNumber = `**** **** **** ${last4}`;
//     }

//     const updated = await UserService.addCard(String(userId), cardObj as any);
//     return res.json({ success: true, data: updated });
//   } catch (error: any) {
//     return res.status(500).json({ success: false, message: error.message || 'Server error' });
//   }
// };

// const getCards = async (req: Request, res: Response) => {
//   try {
//     const userId = req.user?._id;
//     if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });
//     const cards = await UserService.getCards(String(userId));
//     return res.json({ success: true, data: cards });
//   } catch (error: any) {
//     return res.status(500).json({ success: false, message: error.message || 'Server error' });
//   }
// };

// const updateCard = async (req: Request, res: Response) => {
//   try {
//     const userId = req.user?._id;
//     const cardId = req.params.id;
//     if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });
//     if (!cardId) return res.status(400).json({ success: false, message: 'Card id is required' });
//     const payload = req.body || {};
//     const updated = await UserService.updateCardById(String(userId), String(cardId), payload);
//     if (!updated) return res.status(404).json({ success: false, message: 'Card not found' });
//     return res.json({ success: true, data: updated });
//   } catch (error: any) {
//     return res.status(500).json({ success: false, message: error.message || 'Server error' });
//   }
// };

// const deleteCard = async (req: Request, res: Response) => {
//   try {
//     const userId = req.user?._id;
//     const cardId = req.params.id;
//     if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });
//     if (!cardId) return res.status(400).json({ success: false, message: 'Card id is required' });
//     const updated = await UserService.deleteCardById(String(userId), String(cardId));
//     if (!updated) return res.status(404).json({ success: false, message: 'Card not found' });
//     return res.json({ success: true, data: updated });
//   } catch (error: any) {
//     return res.status(500).json({ success: false, message: error.message || 'Server error' });
//   }
// };

const addFcmToken = asyncHandler(async (req, res) => {
    const userId = String(req.user?._id);
    const { token } = req.body || {};
    if (!token) throw new AppError(400, 'token is required');
    await User.findByIdAndUpdate(userId, { $addToSet: { fcmTokens: token } });
    return res.json({ success: true });
  });

const removeFcmToken = asyncHandler(async (req, res) => {
    const userId = String(req.user?._id);
    const { token } = req.body || {};
    if (!token) throw new AppError(400, 'token is required');
    await User.findByIdAndUpdate(userId, { $pull: { fcmTokens: token } });
    return res.json({ success: true });
  });

const getShopById = asyncHandler(async (req: Request, res: Response) => {
    const shopId = req.params.shopId;
    if (!shopId) return res.status(400).json({ success: false, message: 'shopId is required' });

    const shop = await Shop.findById(shopId).populate('userId', 'fullName email');
    if (!shop) return res.status(404).json({ success: false, message: 'Shop not found' });

    return res.json({ success: true, data: shop });
  });

const getShopProducts = asyncHandler(async (req: Request, res: Response) => {
    const shopId = req.params.shopId;
    if (!shopId) return res.status(400).json({ success: false, message: 'shopId is required' });

    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;

    const result = await ProductService.getActiveProductsByShop({ shopId, page, limit });
    return res.json({ success: true, data: result });
  });

const addFavorite = asyncHandler(async (req: Request, res: Response) => {
    const userId = String(req.user?._id);
    const productId = req.params.productId;
    if (!productId) return res.status(400).json({ success: false, message: 'productId is required' });

    const updated = await UserService.addFavorite(userId, productId);
    return res.json({ success: true, data: updated });
  });

const removeFavourite =  asyncHandler(async (req: Request, res: Response) => {
    const userId = String(req.user?._id);
    const productId = req.params.productId;
    if (!productId) return res.status(400).json({ success: false, message: 'productId is required' });

    const updated = await UserService.removeFavorite(userId, productId);
    return res.json({ success: true, data: updated });
  });

const getFavourites = asyncHandler(async (req: Request, res: Response) => {
    const userId = String(req.user?._id);
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const result = await UserService.getFavorites(userId, page, limit);
    return res.json({ success: true, data: result });
  });

const getOrderHistory = asyncHandler(async (req: Request, res: Response) => {
    const userId = String(req.user?._id);
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.max(1, Number(req.query.limit) || 20);
    const skip = (page - 1) * limit;

    const [orders, total] = await Promise.all([
      Order.find({ user: userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate({ path: 'items.product', select: 'name pricing variants media shop' }),
      Order.countDocuments({ user: userId }),
    ]);

    const pages = limit > 0 ? Math.ceil(total / limit) : 0;

    return res.json({
      success: true,
      data: {
        orders,
        pagination: { page, limit, total, pages },
      },
    });
  });

const getOrderDetails = asyncHandler(async (req: Request, res: Response) => {
    const userId = String(req.user?._id);
    const orderId = req.params.orderId;
    if (!orderId) throw new AppError(400, 'orderId is required');

    const order = await Order.findById(orderId).populate({ path: 'items.product', select: 'name pricing variants media shop' });
    if (!order) throw new AppError(404, 'Order not found');
    if (String(order.user) !== String(userId)) throw new AppError(403, 'Not authorized to view this order');

    return res.json({ success: true, data: order });
  });
export const UserController = {
  getProfile: asyncHandler(getProfile),
  updateProfile: asyncHandler(updateProfile),
  addAddress: asyncHandler(addAddress),
  getAddresses: asyncHandler(getAddresses),
  updateAddress: asyncHandler(updateAddress),
  deleteAddress: asyncHandler(deleteAddress),
  addFcmToken,
  removeFcmToken,
  getShopById,
  getShopProducts,
  addFavorite,
  removeFavourite,
  getFavourites
  ,getOrderHistory,
  getOrderDetails
  // addCard: asyncHandler(addCard),
  // getCards: asyncHandler(getCards),
  // updateCard: asyncHandler(updateCard),
  // deleteCard: asyncHandler(deleteCard),
};
