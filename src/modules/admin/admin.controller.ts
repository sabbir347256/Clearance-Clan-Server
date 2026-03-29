import { Request, Response } from 'express';
import { AdminService } from "./admin.service";
import asyncHandler from '../../utils/CatchAsync';
import { AuthService } from '../auth/auth.service';
import { uploadBufferToCloudinary } from '../../config/cloudinary.config';

const getPlatformStats = async (req: Request, res: Response) => {
  const period = (req.query.period as string) === 'weekly' ? 'weekly' : (req.query.period as string) === 'monthly' ? 'monthly' : undefined;
  const rawLimit = req.query.limit !== undefined ? Number(req.query.limit) : undefined;
  const stats = await (AdminService as any).getPlatformStats(period as any, rawLimit);
  res.json({ success: true, data: stats });
};

const getAllPendingShops = async (req: Request, res: Response) => {
  const shops = await AdminService.getAllPendingShops();

  res.json({
    success: true,
    count: shops.length,
    data: shops
  });
};

const getAllApprovedShops = async (req: Request, res: Response) => {
  const shops = await AdminService.getAllApprovedShops();

  res.json({
    success: true,
    count: shops.length,
    data: shops
  });
};

const getAllShops = async (req: Request, res: Response) => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 10;
  const search = req.query.search as string | undefined;
  const status = req.query.status as string | undefined;

  const result = await AdminService.getAllShops({ page, limit, search, status });

  res.json({
    success: true,
    count: result.data.length,
    pagination: result.pagination,
    data: result.data,
  });
};

const getShopById = async (req: Request, res: Response) => {
  const shop = await AdminService.getShopById(req.params.shopId);

  if (!shop) {
    return res.status(404).json({
      success: false,
      message: 'Shop not found'
    });
  }

  res.json({
    success: true,
    data: shop
  });
};

const getShopStats = async (req: Request, res: Response) => {
  const shopId = req.params.shopId;
  const stats = await AdminService.getShopStats(shopId);

  res.json({
    success: true,
    data: stats
  });
};

const approveShop = async (req: Request, res: Response) => {
  const shop = await AdminService.approveShop(req.params.shopId);

  res.json({
    success: true,
    message: 'Shop approved successfully',
    data: shop
  });
};

const rejectShop = async (req: Request, res: Response) => {
  const { reason } = req.body;
  const shop = await AdminService.rejectShop(req.params.shopId, reason);

  res.json({
    success: true,
    message: 'Shop rejected',
    data: shop
  });
};

const suspendShop = async (req: Request, res: Response) => {
  const { reason } = req.body;
  const shop = await AdminService.suspendShop(req.params.shopId, reason);

  res.json({
    success: true,
    message: 'Shop suspended',
    data: shop
  });
};

const addShopCategory = async (req: Request, res: Response) => {
  const { name } = req.body;
  const file = (req.file as Express.Multer.File) || undefined;
  const category = await AdminService.addShopCategory(name, file);
  res.json({
    success: true,
    message: 'Shop category added successfully',
    data: category
  });
}

const addProductCategory = async (req: Request, res: Response) => {
  const { name } = req.body;
  const file = (req.file as Express.Multer.File) || undefined;
  const category = await AdminService.addProductCategory(name, file);
  res.json({
    success: true,
    message: 'Product category added successfully',
    data: category
  });
}

const createBanner = async (req: Request, res: Response) => {
  const file = (req.file as Express.Multer.File) || undefined;
  let { imageUrl, isActive } = req.body as any;

  if (file && file.buffer) {
    const result: any = await uploadBufferToCloudinary(file.buffer, `banner-upload`, 'banners');
    imageUrl = result?.secure_url || imageUrl;
  }

  // Normalize isActive to boolean (defaults to true)
  if (isActive === undefined) {
    isActive = true;
  } else if (typeof isActive === 'string') {
    isActive = isActive === 'false' ? false : Boolean(isActive);
  } else {
    isActive = Boolean(isActive);
  }

  const banner = await AdminService.createBanner(imageUrl, isActive as boolean);

  res.json({
    success: true,
    message: 'Banner created successfully',
    data: banner
  });
};

const getHomepageBanners = async (_req: Request, res: Response) => {
  const banners = await AdminService.getActiveBanners();

  res.json({
    success: true,
    data: banners
  });
};

const deleteBanner = async (req: Request, res: Response) => {
  await AdminService.deleteBanner(req.params.id);

  res.json({
    success: true,
    message: 'Banner deleted successfully'
  });
};


const getUsers = async (req: Request, res: Response) => {
  const users = await AdminService.getUsers(req.query);

  res.json({
    success: true,
    data: users,
  });
};

const getProducts = async (req: Request, res: Response) => {
  const result = await AdminService.getProducts(req.query);

  res.json({
    success: true,
    data: result.products,
    meta: result.meta,
  });
};

const getCategories = async (req: Request, res: Response) => {
  const result = await AdminService.getCategories(req.query);

  res.json({
    success: true,
    data: result.categories,
    meta: result.meta,
  });
};

const updateCategory = async (req: Request, res: Response) => {
  const { categoryId } = req.params;
  const file = (req.file as Express.Multer.File) || undefined;

  const updated = await AdminService.updateCategory(categoryId, req.body, file);

  res.json({ success: true, message: 'Category updated', data: updated });
};

const updateProductApproval = async (req: Request, res: Response) => {
  const { productId } = req.params;
  const { status } = req.body;

  if (!status) {
    return res.status(400).json({ success: false, message: 'status is required' });
  }

  const updated = await AdminService.updateProductApproval(productId, status);

  res.json({ success: true, message: 'Product approval status updated', data: updated });
};

const getRecentOrders = async (req: Request, res: Response) => {
  const orders = await AdminService.getRecentOrders();

  res.json({
    success: true,
    data: orders,
  });
};

const updateEmailVerificationStatus = async (req: Request, res: Response) => {
  const { userId } = req.params;
  const { isEmailVerified } = req.body;

  if (typeof isEmailVerified !== 'boolean') {
    return res.status(400).json({
      success: false,
      message: 'isEmailVerified must be a boolean',
    });
  }

  const user = await AdminService.updateEmailVerificationStatus(
    userId,
    isEmailVerified
  );

  res.json({
    success: true,
    message: 'Email verification status updated',
    data: user,
  });
};

const getStats = async (req: Request, res: Response) => {
  const stats = await AdminService.getStats(req.query);

  res.json({
    success: true,
    data: stats,
  });
};

const getAllOrders = async (req: Request, res: Response) => {
  const orders = await AdminService.getAllOrders(req.query);

  res.json({
    success: true,
    data: orders,
  });
};

const getOrderById = async (req: Request, res: Response) => {
  const order = await AdminService.getOrderById(req.params.orderId);

  if (!order) {
    return res.status(404).json({
      success: false,
      message: 'Order not found'
    });
  }

  res.json({
    success: true,
    data: order
  });
};

export const AdminController = {
  getAllPendingShops: asyncHandler(getAllPendingShops),
  getAllApprovedShops: asyncHandler(getAllApprovedShops),
  getAllShops: asyncHandler(getAllShops),
  getShopById: asyncHandler(getShopById),
  getShopStats: asyncHandler(getShopStats),
  approveShop: asyncHandler(approveShop),
  rejectShop: asyncHandler(rejectShop),
  suspendShop: asyncHandler(suspendShop),
  addShopCategory: asyncHandler(addShopCategory),
  addProductCategory: asyncHandler(addProductCategory),
  getPlatformStats: asyncHandler(getPlatformStats),
  createBanner: asyncHandler(createBanner),
  getHomepageBanners: asyncHandler(getHomepageBanners),
  deleteBanner: asyncHandler(deleteBanner),
  getUsers: asyncHandler(getUsers),
  getRecentOrders: asyncHandler(getRecentOrders),
  updateEmailVerificationStatus: asyncHandler(updateEmailVerificationStatus),
  getProducts: asyncHandler(getProducts),
  getCategories: asyncHandler(getCategories),
  updateCategory: asyncHandler(updateCategory),
  updateProductApproval: asyncHandler(updateProductApproval),
  getStats: asyncHandler(getStats),
  getAllOrders: asyncHandler(getAllOrders),
  getOrderById: asyncHandler(getOrderById),
};
