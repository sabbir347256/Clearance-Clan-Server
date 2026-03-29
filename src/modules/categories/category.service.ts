import { Category } from './category.model';
import { uploadBufferToCloudinary } from '../../config/cloudinary.config';
import AppError from '../../errorHelper/AppError';

type FileField = Express.Multer.File | undefined;

const createCategory = async (name: string, file?: FileField, type: 'SHOP' | 'PRODUCT' = 'SHOP') => {
  const exists = await Category.findOne({ name, type });
  if (exists) throw new AppError(400, 'Category already exists');

  let imageUrl = '';
  let imagePublicId = '';

  if (file && file.buffer) {
    const result = await uploadBufferToCloudinary(file.buffer, `category-${name}`, 'categories');
    imageUrl = result.secure_url;
    imagePublicId = result.public_id;
  }

  const category = await Category.create({ name, imageUrl, imagePublicId, type });
  return category;
};

const listShopCategories = async () => {
  return Category.find({ type: 'SHOP' }).sort({ createdAt: -1 });
};

const listProductCategories = async () => {
  return Category.find({ type: 'PRODUCT' }).sort({ createdAt: -1 });
}

export const CategoryService = {
  createCategory,
  listShopCategories,
  listProductCategories,
  // Generic listing with pagination and optional type filter
  listCategories: async (type?: 'SHOP' | 'PRODUCT', page = 1, limit = 20) => {
    const filter: any = {};
    if (type) filter.type = type;

    const p = Number(page) || 1;
    const l = Number(limit) || 20;
    const skip = (p - 1) * l;

    const categories = await Category.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(l);

    const total = await Category.countDocuments(filter);

    return {
      categories,
      meta: {
        total,
        page: p,
        limit: l,
        totalPages: Math.ceil(total / l),
      },
    };
  },
  updateCategory: async (categoryId: string, name?: string, file?: FileField) => {
    const category = await Category.findById(categoryId);
    if (!category) throw new AppError(404, 'Category not found');

    // If name is changing, ensure uniqueness for same type
    if (name && name !== category.name) {
      const exists = await Category.findOne({ name, type: category.type });
      if (exists) throw new AppError(400, 'Category with this name already exists');
      category.name = name;
    }

    if (file && file.buffer) {
      const result = await uploadBufferToCloudinary(file.buffer, `category-${category.name}`, 'categories');
      category.imageUrl = result.secure_url;
      category.imagePublicId = result.public_id;
    }

    await category.save();
    return category;
  }
};
