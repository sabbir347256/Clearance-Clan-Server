import { GetProductsByShopParams, IProduct, IVariant, UpdateProductParams } from './product.interface';
import { Product } from './product.model';
import AppError from '../../errorHelper/AppError';
import { Shop } from '../sellers/seller.model';
import { createStripeProduct } from '../payments/connect.service';

// Helper to calculate total stock from variants
const calculateTotalStock = (variants: IVariant[]) => {
  return variants.reduce((sum, v) => sum + (Number(v.stock) || 0), 0);
};

// 🔹 Create product
const createProduct = async (payload: Partial<IProduct>) => {

  if (!payload.name) {
    throw new AppError(400, 'Product name is required');
  }

  // if payload.inventory.stock exist, set direct stock. otherwise payload variants exist so calculate paylaod variants stock
if (!payload.variants && payload.inventory && payload.inventory?.stock > 0) {
  payload.inventory = {
    stock: payload.inventory.stock,
    lowStockAlert: payload.inventory.lowStockAlert || 10,
  };
} else if (payload.variants && payload.variants?.length > 0) {
  payload.inventory = {
    stock: calculateTotalStock(payload.variants),
    lowStockAlert: payload.inventory?.lowStockAlert || 10,
  };
}

  // 🔹 Get shop + seller Stripe account
  const shop = await Shop.findById(payload.shop).populate('userId');
  // After populate TypeScript may still type userId as ObjectId, narrow it to any to access Stripe fields
  const sellerUser: any = shop?.userId;
  if (!shop || !sellerUser?.stripeConnectAccountId) {
    throw new AppError(400, 'Seller Stripe account not found');
  }

  // If variants exist, create a Stripe product+price for each variant
  if (payload.variants && payload.variants.length > 0) {
    const variantsWithStripe = [] as any[];
    for (const v of payload.variants) {
      console.log(JSON.stringify(v))
      if (v.price == null) throw new AppError(400, 'Each variant must have a price');
      const suffix = (v.attributes && (v.attributes as any).edition) || Object.values(v.attributes || {}).join(' ');
      const name = suffix ? `${payload.name} - ${suffix}` : payload.name;
      const stripeProduct = await createStripeProduct({
        name,
        description: payload.description,
        price: Math.round(v.price * 100),
        connectedAccountId: sellerUser.stripeConnectAccountId
      });

      const stripePriceId = typeof stripeProduct.default_price === 'string'
        ? stripeProduct.default_price
        : stripeProduct.default_price?.id;

      variantsWithStripe.push({
        ...v,
        stripeProductId: stripeProduct.id,
        stripePriceId
      });
    }

    // Save product with variants containing Stripe IDs
    const product = await Product.create({
      ...payload,
      variants: variantsWithStripe,
      stripeProductId: undefined,
      stripePriceId: undefined
    });

    return product;
  }

  // No variants: use pricing/base price to create a single Stripe product
  const stripePrice =
    payload.pricing?.salePrice ??
    payload.pricing?.basePrice;

  if (!stripePrice) {
    throw new AppError(400, 'Stripe price is required');
  }

  const stripeProduct = await createStripeProduct({
    name: payload.name,
    description: payload.description,
    price: Math.round(stripePrice * 100), // cents
    connectedAccountId: sellerUser.stripeConnectAccountId
  });

  const stripePriceId = typeof stripeProduct.default_price === 'string'
    ? stripeProduct.default_price
    : stripeProduct.default_price?.id;

  const product = await Product.create({
    ...payload,
    stripeProductId: stripeProduct.id,
    stripePriceId
  });

  return product;
};

// 🔹 Find product by ID
const findById = async (
  id: string,
  options?: { includeInactive?: boolean; shopId?: string }
) => {
  const filter: any = { _id: id };

  // By default only return active products for public requests
  if (!options?.includeInactive) {
    filter.isActive = true;
  }

  // If a shopId is provided, scope the query to that shop (used for seller routes)
  if (options?.shopId) {
    filter.shop = options.shopId;
  }

  return Product.findOne(filter)
    .populate('category', 'name')
    .populate(
      'shop',
      'shopName branding.logoUrl branding.bannerUrl country city phoneNumber stripeAccountId'
    );
};

// 🔹 Get products by shop
const getProductsByShop = async ({
  shopId,
  page,
  limit,  
}: GetProductsByShopParams) => {

  const filter: any = {
    shop: shopId
  };

  const skip = (page - 1) * limit;

  const [products, total] = await Promise.all([
    Product.find(filter)
      .populate('category', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),

    Product.countDocuments(filter)
  ]);

  return {
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    },
    data: products
  };
};

// 🔹 Get active products (public) with optional category name and light name search
const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&');

const getActiveProducts = async (opts: { page?: number; limit?: number; categoryName?: string; q?: string } = {}) => {
  const page = Number(opts.page) || 1;
  const limit = Number(opts.limit) || 10;
  const skip = (page - 1) * limit;

  const filter: any = { isActive: true };

  // category name filter (case-insensitive, partial)
  if (opts.categoryName) {
    const regex = new RegExp(escapeRegex(opts.categoryName), 'i');
    const Category = (await import('../categories/category.model')).Category;
    const categories = await Category.find({ name: regex }).select('_id');
    const ids = categories.map((c: any) => c._id);
    if (ids.length > 0) filter.category = { $in: ids };
    else {
      // no categories match -> return empty result
      return { meta: { page, limit, total: 0, totalPages: 0 }, data: [] };
    }
  }

  // light search on product name
  if (opts.q) {
    const qRegex = new RegExp(escapeRegex(opts.q), 'i');
    filter.name = qRegex;
  }

  const [products, total] = await Promise.all([
    Product.find(filter)
      .populate('category', 'name')
      .populate(
        'shop',
        'shopName branding.logoUrl branding.bannerUrl country city phoneNumber stripeAccountId'
      )
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),

    Product.countDocuments(filter)
  ]);

  return {
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    },
    data: products
  };
};

// 🔹 Get active products for a specific shop (public)
const getActiveProductsByShop = async ({ shopId, page = 1, limit = 10 }: { shopId: string; page?: number; limit?: number }) => {
  const filter: any = { isActive: true, shop: shopId };
  const skip = (page - 1) * limit;

  const [products, total] = await Promise.all([
    Product.find(filter)
      .populate('category', 'name')
      .populate(
        'shop',
        'shopName branding.logoUrl branding.bannerUrl country city phoneNumber stripeAccountId'
      )
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),

    Product.countDocuments(filter)
  ]);

  return {
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    },
    data: products
  };
};

// 🔹 Update product
const updateProduct = async ({
  productId,
  shopId,
  payload
}: UpdateProductParams) => {

  // 🔒 Ownership check
  const product = await Product.findOne({ _id: productId, shop: shopId });
  if (!product) return null;

    // if payload.inventory.stock exist, set direct stock. otherwise payload variants exist so calculate paylaod variants stock
if (!payload.variants && payload.inventory && payload.inventory?.stock > 0) {
  payload.inventory = {
    stock: payload.inventory.stock,
    lowStockAlert: payload.inventory.lowStockAlert || 10,
  };
} else if (payload.variants && payload.variants?.length > 0) {
  payload.inventory = {
    stock: calculateTotalStock(payload.variants),
    lowStockAlert: payload.inventory?.lowStockAlert || 10,
  };
}

  // 🔹 Sync inventory stock if variants updated
  // if (payload.variants) {
  //   payload.inventory = {
  //     stock: calculateTotalStock(payload.variants),
  //     lowStockAlert: product.inventory.lowStockAlert || 10
  //   };
  // }

  Object.assign(product, payload);
  await product.save();

  return product;
};

const updateProductStatus = async ({
  productId,
  payload
}: {
  productId: string;
  payload: {
    status: string;
  };
}) => {
  const product = await Product.findByIdAndUpdate(
    productId,
    { approvalStatus: payload.status },
    { new: true }
  );

  return product;
};


// 🔹 Toggle product active status (seller only, ownership enforced)
const toggleProductActive = async (
  productId: string,
  shopId: string
) => {
  const product = await Product.findOne({
    _id: productId,
    shop: shopId
  });
  
  if (!product) {
    throw new AppError(404, 'Product not found or unauthorized');
  }

  product.isActive = !product.isActive;
  await product.save();

  return product;
};

// 🔹 Delete product
const deleteProduct = async (
  productId: string,
  shopId: string
) => {
  const product = await Product.findOneAndDelete({
    _id: productId,
    shop: shopId
  });
  return product;
}

export const ProductService = {
  createProduct,
  findById,
  getProductsByShop,
  getActiveProducts,
  getActiveProductsByShop,
  updateProduct,
  updateProductStatus,
  toggleProductActive,
  deleteProduct
};
