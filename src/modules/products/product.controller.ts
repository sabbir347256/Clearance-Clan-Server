import { Request, Response } from 'express';
import { ProductService } from './product.service';
import { Shop } from '../sellers/seller.model';
import { User } from '../users/user.model';
import { uploadBufferToCloudinary } from '../../config/cloudinary.config';
import { Category } from '../categories/category.model';
import asyncHandler from '../../utils/CatchAsync';
import AppError from '../../errorHelper/AppError';

// Helper to ensure Map attributes serialize to plain objects
const normalizeProductAttributes = (prod: any) => {
  if (!prod) return prod;
  if (Array.isArray(prod.variants)) {
    prod.variants = prod.variants.map((v: any) => {
      if (v && v.attributes) {
        if (v.attributes instanceof Map) {
          v.attributes = Object.fromEntries(v.attributes);
        } else if (typeof v.attributes === 'object' && Object.keys(v.attributes).length === 0) {
          // keep as empty object
          v.attributes = {};
        }
      }
      return v;
    });
  }
  return prod;
};

// Helper to parse JSON fields from form-data
const parseIfString = (value: any) =>
  typeof value === 'string' ? JSON.parse(value) : value;

// 🔹 Create product (seller only)
const createProduct = async (req: Request, res: Response) => {
  try {
    const shop = await Shop.findOne({ userId: req.user?._id });
    if (!shop) {
      return res.status(400).json({ success: false, message: 'Seller shop not found' });
    }

    // 🔹 Parse JSON fields (multipart sends strings). Be defensive: `req.body` may be undefined
    const rawBody = req.body || {};
    const body = typeof (rawBody as any).data === 'string'
      ? JSON.parse((rawBody as any).data)
      : rawBody;

    let {
      name,
      description,
      category,
      variants,
      pricing,
      shipping,
      inventory
    } = body;


    if (typeof variants === 'string') {
      try {
        variants = JSON.parse(variants);
      } catch (e) {}
    }

    // 🔹 Sanitize variants
    if (variants && Array.isArray(variants)) {
      variants.forEach((v: any) => {
        // Fix [Object: null prototype] for attributes
        if (v.attributes && typeof v.attributes === 'object') {
          v.attributes = { ...v.attributes };
        }
        
        v.stock = Number(v.stock) || 0;
        if (v.price !== undefined && v.price !== null) v.price = Number(v.price);
      });
    }

    if (!name) {
      return res.status(400).json({ success: false, message: 'Product name is required' });
    }

    // 🔹 Handle images
    const files = req.files as {
      coverImage?: Express.Multer.File[];
      galleryImages?: Express.Multer.File[];
    };

    let coverImageUrl: string | undefined;
    const galleryUrls: string[] = [];

    if (files?.coverImage?.[0]) {
      const uploaded = await uploadBufferToCloudinary(
        files.coverImage[0].buffer,
        `product-cover`,
        'products'
      );
      coverImageUrl = uploaded.secure_url;
    }

    if (files?.galleryImages?.length) {
      for (const file of files.galleryImages) {
        const uploaded = await uploadBufferToCloudinary(
          file.buffer,
          `product-gallery`,
          'products'
        );
        galleryUrls.push(uploaded.secure_url);
      }
    }

    if (category) {
    const categoryDoc = await Category.findById(category);

    if (!categoryDoc) {
      return res.status(400).json({
        success: false,
        message: 'Category not found'
        });
    }

    if (categoryDoc.type !== 'PRODUCT') {
      return res.status(400).json({
        success: false,
        message: 'Only PRODUCT type categories can be assigned to products'
        });
      }
    }

    const product = await ProductService.createProduct({
      name,
      description,
      category,
      variants,
      pricing,
      inventory,
      shipping,
      media: {
        coverImage: coverImageUrl,
        gallery: galleryUrls
      },
      shop: shop._id,
      isActive: true
    });

    return res.status(201).json({ success: true, data: product });

  } catch (error: any) {
    throw new AppError(500, error.message || 'Server error');
  }
};

// 🔹 Get seller's products (seller only)
const getMyProducts = async (req: Request, res: Response) => {
  try {
    const shop = await Shop.findOne({ userId: req.user?._id });

    if (!shop) {
      return res.status(400).json({
        success: false,
        message: 'Seller shop not found'
      });
    }

    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;

    const result = await ProductService.getProductsByShop({
      shopId: shop._id.toString(),
      page,
      limit,
    });

    res.status(200).json({
      success: true,
      data: {
        meta: result.meta,
        items: result.data
      }
    });

  } catch (error: any) {
    throw new AppError(500, error.message || 'Server error');
  }
};

// 🔹 Update product (seller only, ownership enforced)
const updateProduct = async (req: Request, res: Response) => {
  try {
    const productId = req.params.id;

    const shop = await Shop.findOne({ userId: req.user?._id });
    if (!shop) {
      return res.status(400).json({ success: false, message: 'Seller shop not found' });
    }

    // 🔹 Parse body fields (form-data)
    const name = req.body.name;
    const description = req.body.description;
    const status = req.body.status;

    const category = req.body.category;
    const variants = parseIfString(req.body.variants);
    const shipping = parseIfString(req.body.shipping);
    const inventory = parseIfString(req.body.inventory);

    // 🔹 Validate category (if provided)
    if (category) {
      const categoryDoc = await Category.findById(category);
      if (!categoryDoc || categoryDoc.type !== 'PRODUCT') {
        return res.status(400).json({
          success: false,
          message: 'Only PRODUCT type categories can be assigned'
        });
      }
    }

    // 🔹 Validate variants (if provided)
    if (variants) {
      if (Array.isArray(variants)) {
        variants.forEach((v: any) => {
          // Fix [Object: null prototype] for attributes
          if (v.attributes && typeof v.attributes === 'object') {
            v.attributes = { ...v.attributes };
          }
          if (v.stock !== undefined) v.stock = Number(v.stock);
          if (v.price !== undefined) v.price = Number(v.price);
        });
      }

      for (const v of variants) {
        if (!v.price || !v.stock) {
          return res.status(400).json({
            success: false,
            message: 'Each variant must have price and stock'
          });
        }
        if (!v.attributes || Object.keys(v.attributes).length === 0) {
          return res.status(400).json({
            success: false,
            message: 'Variant attributes cannot be empty'
          });
        }
      }
    }

    // 🔹 Handle image uploads
    const files = req.files as {
      coverImage?: Express.Multer.File[];
      galleryImages?: Express.Multer.File[];
    };

    const media: any = {};

    if (files?.coverImage?.[0]) {
      const uploaded = await uploadBufferToCloudinary(
        files.coverImage[0].buffer,
        'product-cover',
        'products'
      );
      media.coverImage = uploaded.secure_url;
    }

    if (files?.galleryImages?.length) {
      media.gallery = [];
      for (const file of files.galleryImages) {
        const uploaded = await uploadBufferToCloudinary(
          file.buffer,
          'product-gallery',
          'products'
        );
        media.gallery.push(uploaded.secure_url);
      }
    }

    const updated = await ProductService.updateProduct({
      productId,
      shopId: shop._id.toString(),
      payload: {
        name,
        description,
        category,
        variants,
        inventory,
        shipping,
        status,
        ...(Object.keys(media).length ? { media } : {})
      }
    });

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: 'Product not found or not owned by seller'
      });
    }

    res.status(200).json({
      success: true,
      data: updated
    });

  } catch (error: any) {
    throw new AppError(500, error.message || 'Server error');
  }
};

const updateProductStatus = async (req: Request, res: Response) => {
  try {
    const productId = req.params.id;
    const { status } = req.body;

    if (!['APPROVED', 'REJECTED', 'PENDING'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status value'
      });
    }

    const updated = await ProductService.updateProductStatus({
      productId,
      payload: {
        status
      }
    });

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    res.status(200).json({
      success: true,
      data: updated
    });

  } catch (error: any) {
    throw new AppError(500, error.message || 'Server error');
  }
};

// 🔹 Get product by ID (public or seller)
const getProductById = async (req: Request, res: Response) => {
  try {
    // Accept either `productId` (route) or `id` (older routes)
    const productId = req.params.productId || req.params.id;

    // Default: public request -> only active products
    let options: any = {};

    // If authenticated seller, allow fetching their own product regardless of isActive
    if (req.user && (req.user as any).role === 'SELLER') {
      const shop = await Shop.findOne({ userId: req.user?._id });
      if (!shop) {
        return res.status(400).json({ success: false, message: 'Seller shop not found' });
      }
      options = { includeInactive: true, shopId: shop._id.toString() };
    }

    const product = await ProductService.findById(productId, options);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Convert to plain object to ensure Map fields (e.g. variant attributes) serialize
    const base = normalizeProductAttributes(product.toObject());
    if (req.user) {
      const user = await User.findById(req.user._id).select('favorites');
      const favSet = new Set((user?.favorites || []).map((f: any) => String(f)));
      (base as any).isFavourite = favSet.has(String(product._id));
    }

    res.status(200).json({ success: true, data: base });

  } catch (error: any) {
    throw new AppError(500, error.message || 'Server error');
  }
};

const toggleProductActive = async (req: Request, res: Response) => {
  try {
    const productId = req.params.productId;

    const shop = await Shop.findOne({ userId: req.user?._id });
    if (!shop) {
      return res.status(400).json({
        success: false,
        message: 'Seller shop not found'
      });
    }

    const updatedProduct = await ProductService.toggleProductActive(
      productId,
      shop._id.toString()
    );

    res.status(200).json({
      success: true,
      message: `Product ${updatedProduct.isActive ? 'activated' : 'deactivated'}`,
      data: updatedProduct
    });

  } catch (error: any) {
    throw new AppError(500, error.message || 'Server error');
  }
};

// 🔹 Get active products (public)
const getActiveProducts = async (req: Request, res: Response) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;
    const categoryName = req.query.categoryName as string | undefined;
    const q = req.query.q as string | undefined;

    const result = await ProductService.getActiveProducts({ page, limit, categoryName, q });

    // Convert all products to plain objects so Map fields (attributes) are included
    let items: any[] = (result.data as any[]).map(p => normalizeProductAttributes(p.toObject()));
    if (req.user) {
      const user = await User.findById(req.user._id).select('favorites');
      const favSet = new Set((user?.favorites || []).map((f: any) => String(f)));
      items = items.map(p => ({ ...p, isFavourite: favSet.has(String(p._id)) }));
    }
    res.status(200).json({
      success: true,
      data: {
        meta: result.meta,
        items
      }
    });

  } catch (error: any) {
    throw new AppError(500, error.message || 'Server error');
  }
};

// Delete product (seller only, ownership enforced)
const deleteProduct = async (req: Request, res: Response) => {
  try {
    const productId = req.params.productId;
    const shop = await Shop.findOne({ userId: req.user?._id });
    if (!shop) {
      return res.status(400).json({
        success: false,
        message: 'Seller shop not found'
      });
    }
    const deleted = await ProductService.deleteProduct(productId, shop._id.toString());
    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Product not found or not owned by seller'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Product deleted successfully'
    });

  } catch (error: any) {
    throw new AppError(500, error.message || 'Server error');
  }
};

export const ProductController = {
  createProduct: asyncHandler(createProduct),
  getMyProducts: asyncHandler(getMyProducts),
  updateProduct: asyncHandler(updateProduct),
  updateProductStatus: asyncHandler(updateProductStatus),
  getProductById: asyncHandler(getProductById),
  toggleProductActive: asyncHandler(toggleProductActive),
  getActiveProducts: asyncHandler(getActiveProducts),
  deleteProduct: asyncHandler(deleteProduct)
};
