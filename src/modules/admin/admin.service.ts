import { Shop } from "../sellers/seller.model";
import { User } from "../users/user.model";
import { CategoryService } from '../categories/category.service';
import AppError from '../../errorHelper/AppError';
import { Order } from '../order/order.model';
import { GraphService } from '../graphs/graph.service';
import { Banner } from "./banner.model";
import { Product } from "../products/product.model";

const getAllPendingShops = async () => {
  return Shop.find({ status: 'PENDING' })
    .populate('userId', 'fullName email')
    .sort({ createdAt: -1 });
};

const getAllApprovedShops = async () => {
  return Shop.find({ status: 'APPROVED' })
    .populate('userId', 'fullName email')
    .sort({ createdAt: -1 });
};

const getAllShops = async ({
  page,
  limit,
  search,
  status,
}: {
  page: number;
  limit: number;
  search?: string;
  status?: string;
}) => {
  const skip = (page - 1) * limit;

  const filter: any = {};
  if (search && String(search).trim().length) {
    const safe = String(search).trim();
    const searchRegex = new RegExp(safe, 'i');
    filter.shopName = searchRegex;
  }
  // optional status filter (accepts 'ALL' to mean no filter) Status = [PENDING, APPROVED, REJECTED, SUSPENDED]
  if (status && String(status).toUpperCase() !== 'ALL') {
    filter.status = String(status).toUpperCase();
  }


  const [shops, total] = await Promise.all([
    Shop.find(filter)
      .populate('userId', 'fullName email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),

    Shop.countDocuments(filter),
  ]);

  return {
    data: shops,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
};

const getShopById = async (shopId: string) => {
  return Shop.findById(shopId).populate('userId', 'fullName email');
};

const getShopStats = async (shopId: string) => {
  const shop = await Shop.findById(shopId);
  if (!shop) {
    throw new AppError(404, 'Shop not found');
  }
  
  // total sales and units for this shop (only from delivered orders)
  const salesPipeline = [
    { $match: { status: 'DELIVERED', 'items.product.shop': shopId } },
    { $unwind: '$items' },
    {
      $group: {
        _id: null,
        totalSales: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
        totalUnits: { $sum: '$items.quantity' }
      }
    },
    {
      $project: {
        _id: 0,
        totalSales: 1,
        totalUnits: 1
      }
    }
  ];

  const salesRes = await Order.aggregate(salesPipeline as any);
  const sales = salesRes[0] || { totalSales: 0, totalUnits: 0 };
  // total products for this shop
  const totalProducts = await Product.countDocuments({ shop: shopId });

  // precentage of retrun (cancelled orders / total orders)
  const totalOrders = await Order.countDocuments({ 'items.product.shop': shopId });
  const cancelledOrders = await Order.countDocuments({ status: 'CANCELLED', 'items.product.shop': shopId });
  const returnPercentage = totalOrders > 0 ? (cancelledOrders / totalOrders) * 100 : 0;

  return {
    totalSales: sales.totalSales || 0,
    totalUnits: sales.totalUnits || 0,
    totalProducts,
    returnPercentage: parseFloat(returnPercentage.toFixed(2))
  };
};
  

const approveShop = async (shopId: string) => {
  const shop = await Shop.findByIdAndUpdate(
    shopId,
    { status: 'APPROVED' },
    { new: true }
  ).populate('userId', 'fullName email');

  if (!shop) {
    throw new AppError(404, 'Shop not found');
  }

  return shop;
};

const rejectShop = async (shopId: string, reason?: string) => {
  const shop = await Shop.findByIdAndUpdate(
    shopId,
    { status: 'REJECTED', rejectionReason: reason },
    { new: true }
  ).populate('userId', 'fullName email');

  if (!shop) {
    throw new AppError(404, 'Shop not found');
  }

  return shop;
};

const suspendShop = async (shopId: string, reason?: string) => {
  const shop = await Shop.findByIdAndUpdate(
    shopId,
    { status: 'SUSPENDED', suspensionReason: reason },
    { new: true }
  ).populate('userId', 'fullName email');

  if (!shop) {
    throw new AppError(404, 'Shop not found');
  }

  return shop;
};

const addShopCategory = async (name: string, file?: Express.Multer.File) => {
  // Delegate to CategoryService which handles Cloudinary upload
  const category = await CategoryService.createCategory(name, file, 'SHOP');
  return category;
}

const addProductCategory = async (name: string, file?: Express.Multer.File) => {
  const category = await CategoryService.createCategory(name, file, 'PRODUCT');
  return category;
}

const getPlatformStats = async (period?: 'weekly' | 'monthly', limit?: number) => {
  // totals excluding cancelled orders
  const totalsPipeline = [
    { $match: { status: { $ne: 'CANCELLED' } } },
    { $unwind: '$items' },
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
        totalOrders: { $size: '$ordersSet' },
        totalRevenue: '$revenue',
        totalUnits: '$units'
      }
    }
  ];

  const totalsRes = await Order.aggregate(totalsPipeline as any);
  const totals = totalsRes[0] || { totalOrders: 0, totalRevenue: 0, totalUnits: 0 };

  // order status counts (include cancelled)
  const statusPipeline = [
    { $group: { _id: '$status', count: { $sum: 1 } } }
  ];

  const statusRaw = await Order.aggregate(statusPipeline as any);
  const statusCounts: Record<string, number> = {};
  // initialize known statuses (use canonical values from Order model)
  const statuses = ['PENDING', 'ORDER_CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED'];
  statuses.forEach(s => (statusCounts[s] = 0));
  statusRaw.forEach((r: any) => {
    statusCounts[r._id] = r.count || 0;
  });

  // include overall total order count inside orderStatusCounts
  const totalStatusCount = Object.values(statusCounts).reduce((s, v) => s + (v || 0), 0);
  statusCounts['total'] = totalStatusCount;

  // include per-period series when requested (defaults: weekly=7, monthly=12)
  let series: any[] | undefined;
  if (period) {
    const l = limit && limit > 0 ? limit : (period === 'weekly' ? 7 : 12);
    series = await GraphService.getShopStats(period, l);
  }

  return {
    totalOrders: totals.totalOrders || 0,
    totalRevenue: totals.totalRevenue || 0,
    totalUnits: totals.totalUnits || 0,
    orderStatusCounts: statusCounts,
    series // optional: array of { periodStart, orders, revenue, units }
  };
};

const createBanner = async (imageUrl: string, isActive = true) => {
  const banner = await Banner.create({ imageUrl, isActive });
  return banner;
};


const getActiveBanners = async () => {
  return Banner.find({ isActive: true }).sort({ createdAt: -1 });
};

const deleteBanner = async (bannerId: string) => {
  return Banner.findByIdAndDelete(bannerId);
};

const getUsers = async (query: any) => {
  const filter: any = {};

  // role filter (SELLER / BUYER)
  if (query.role) {
    filter.role = query.role;
  }

  // email verification filter
  if (query.isEmailVerified !== undefined) {
    filter.isEmailVerified = query.isEmailVerified === 'true';
  }

  // pagination
  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 20;
  const skip = (page - 1) * limit;

  const users = await User.find(filter)
    .select('-password')
    .skip(skip)
    .limit(limit)
    .sort({ createdAt: -1 });

  const total = await User.countDocuments(filter);

  return {
    users,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
};

const getProducts = async (query: any) => {
  const filter: any = {};

  // approvalStatus filter (accepts `status` or `approvalStatus`, case-insensitive)
  const rawStatus = query.status || query.approvalStatus;
  if (rawStatus && String(rawStatus).toLowerCase() !== 'all') {
    filter.approvalStatus = String(rawStatus).toUpperCase();
  }

  // optional shop filter
  if (query.shopId) {
    filter.shop = query.shopId;
  }
  
  // optional category filter
  if (query.category) {
    filter.category = query.category;
  }

  // optional search by name (case-insensitive partial match regex)
   if (query.search) {
    const searchRegex = new RegExp(query.search, 'i'); // case-insensitive

    filter.$or = [
      { name: searchRegex }
    ];
  }

  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 20;
  const skip = (page - 1) * limit;

  const products = await Product.find(filter)
    .populate('shop', 'shopName')
    .populate('category', 'name imageUrl')
    .skip(skip)
    .limit(limit)
    .sort({ createdAt: -1 });

  const total = await Product.countDocuments(filter);

  return {
    products,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
};

const getCategories = async (query: any) => {
  const type = query.type && (String(query.type).toUpperCase() === 'PRODUCT' ? 'PRODUCT' : 'SHOP');
  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 20;

  return CategoryService.listCategories(type as any, page, limit);
};

const updateCategory = async (categoryId: string, body: any, file?: Express.Multer.File) => {
  const { name } = body;
  return CategoryService.updateCategory(categoryId, name, file);
};

const updateProductApproval = async (productId: string, status: string) => {
  const allowed = ['PENDING', 'APPROVED', 'REJECTED'];
  if (!allowed.includes(status)) {
    throw new AppError(400, 'Invalid approval status');
  }

  const updated = await Product.findByIdAndUpdate(
    productId,
    { approvalStatus: status },
    { new: true }
  ).populate('shop', 'shopName');

  if (!updated) {
    throw new AppError(404, 'Product not found');
  }

  return updated;
};

const getRecentOrders = async () => {
  const orders = await Order.find()
    .sort({ createdAt: -1 }) // most recent first
    .limit(5)
    // Order schema uses `user` for the buyer reference
    .populate('user', 'fullName email')
    // populate each item's product and that product's shop so we can infer seller/shopName
    .populate({ path: 'items.product', populate: { path: 'shop', select: 'shopName' } })
    .select('_id status total user items createdAt');

  return orders.map(order => {
    const o: any = order;
    // derive a simple seller summary from the first item's product.shop (if available)
    const firstItemProduct: any = o.items && o.items.length ? o.items[0].product : null;
    const shop = firstItemProduct && firstItemProduct.shop ? firstItemProduct.shop : null;

    return {
      orderId: o._id,
      status: o.status,
      totalPrice: o.total,
      buyer: {
        id: o.user?._id,
        name: o.user?.fullName,
        email: o.user?.email,
        image : o.user?.imgUrl
      },
      seller: shop
        ? { id: shop._id, shopName: shop.shopName }
        : null,
      createdAt: o.createdAt,
    };
  });
};

const updateEmailVerificationStatus = async (
  userId: string,
  isEmailVerified: boolean
) => {
  const user = await User.findByIdAndUpdate(
    userId,
    {
      isEmailVerified,
    },
    { new: true }
  ).select('-password');

  if (!user) {
    throw new AppError(404, 'User not found');
  }

  return user;
};

const getStats = async (query: any) => {
  const orderFilter: any = {};

  // Optional date filtering
  if (query.from || query.to) {
    orderFilter.createdAt = {};
    if (query.from) orderFilter.createdAt.$gte = new Date(query.from);
    if (query.to) orderFilter.createdAt.$lte = new Date(query.to);
  }

  // Optional order status (recommended: DELIVERED for sales)
  if (query.orderStatus) {
    orderFilter.status = query.orderStatus;
  }

  // total orders
  const totalOrders = await Order.countDocuments(orderFilter);

  // total sales
  const salesAgg = await Order.aggregate([
    { $match: orderFilter },
    {
      $group: {
        _id: null,
        totalSales: { $sum: '$totalPrice' },
      },
    },
  ]);

  const totalSales = salesAgg[0]?.totalSales || 0;

  // total products (whole app)
  const totalProducts = await Product.countDocuments();

  // total pending products (awaiting approval)
  const totalPendingProducts = await Product.countDocuments({ approvalStatus: 'PENDING' });

  // recent shops (last 7) with logo and product count
  const recentShopsAgg = await Shop.aggregate([
    { $sort: { createdAt: -1 } },
    { $limit: 7 },
    {
      $lookup: {
        from: 'products',
        localField: '_id',
        foreignField: 'shop',
        as: 'products'
      }
    },
    {
      $project: {
        _id: 1,
        shopName: 1,
        status: 1,
        logoUrl: '$branding.logoUrl',
        productCount: { $size: '$products' },
        createdAt: 1
      }
    }
  ] as any);

  const recentShops = recentShopsAgg.map((s: any) => ({
    id: s._id,
    name: s.shopName,
    status: s.status || null,
    logoUrl: s.logoUrl || null,
    productCount: s.productCount || 0,
    createdAt: s.createdAt
  }));

  return {
    totalSales,
    totalOrders,
    totalProducts,
    totalPendingProducts,
    recentShops,
  };
};

const getAllOrders = async (query: any) => {
  const filter: any = {};

  if (query.status) {
    filter.status = query.status;
  }

  // monthName filter (0=Jan, 1=Feb, ..., 11=Dec)
  // "createdAt": "2026-01-21T20:10:50.468Z" --> month=0 (January)
  if (query.monthly) {
    const month = Number(query.monthly);
    if (!isNaN(month) && month >= 0 && month <= 11) {
      const now = new Date();
      const year = now.getFullYear();
      const start = new Date(year, month, 1);
      const end = new Date(year, month + 1, 1);
      filter.createdAt = { $gte: start, $lt: end };
    }
  }

  // pagination
  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 10;
  const total = await Order.countDocuments(filter);
  const totalPages = total === 0 ? 1 : Math.ceil(total / limit);
  const pageToUse = Math.max(1, Math.min(page, totalPages));
  const skip = (pageToUse - 1) * limit;

  const orders = await Order.find(filter)
    .sort({ createdAt: -1 })
    .populate('user', 'fullName email')   
    .populate({ path: 'items.product', populate: { path: 'shop', select: 'shopName' } })
    .select('_id status total user items createdAt')
    .skip(skip)
    .limit(limit);
    
  const data = orders.map(order => {
    const o: any = order;
    const firstItemProduct: any = o.items && o.items.length ? o.items[0].product : null;
    const shop = firstItemProduct && firstItemProduct.shop ? firstItemProduct.shop : null;

    return {
      orderId: o._id,
      status: o.status,
      totalPrice: o.total,
      buyer: {
        id: o.user?._id,
        name: o.user?.fullName,
        email: o.user?.email,
        image : o.user?.imgUrl
      },
      shop: {
        name: shop?.shopName || null,
      },
      createdAt: o.createdAt
    };
  });

  return {
    meta: {
      total,
      page: pageToUse,
      limit,
      totalPages,
    },
    data
  };
};

const getOrderById = async (orderId: string) => {
  const order = await Order.findById(orderId)
    .populate('user', 'fullName email')
    .populate({ path: 'items.product', populate: { path: 'shop', select: 'shopName' } })
    .select('_id status total user items createdAt shippingAddress shippingFee');
    
  if (!order) {
    throw new AppError(404, 'Order not found');
  }
  const o: any = order;
  const firstItemProduct: any = o.items && o.items.length ? o.items[0].product : null;
  const shop = firstItemProduct && firstItemProduct.shop ? firstItemProduct.shop : null;
  
  return {
    orderId: o._id,
    status: o.status,
    totalPrice: o.total,
    buyer: {
      id: o.user?._id,
      name: o.user?.fullName,
      email: o.user?.email,
      image : o.user?.imgUrl
    },
    shop: {
      name: shop?.shopName || null,
    },
    items: o.items.map((item: any) => ({
      productId: item.product?._id,
      productName: item.product?.name,
      shopName: item.product?.shop?.shopName || null,
      variantSku: item.variantSku || null,
      quantity: item.quantity,
      price: item.price,
      imageUrl: item.product.media,
      totalPrice: item.price * item.quantity
    })),
    shippingAddress: o.shippingAddress,
    shippingFee: o.shippingFee,
    createdAt: o.createdAt
  };
};

export const AdminService = {
    getAllPendingShops,
    getAllApprovedShops,
    getAllShops,
    getShopById,
    getShopStats,
    approveShop,
    rejectShop,
    suspendShop,
    addShopCategory,
    addProductCategory,
    getPlatformStats,
    createBanner,
    getActiveBanners,
    deleteBanner,
    getUsers,
    getRecentOrders,
    updateEmailVerificationStatus,
    getStats,
    getProducts,
    getCategories,
    updateCategory,
    updateProductApproval,
    getAllOrders,
    getOrderById,
};


