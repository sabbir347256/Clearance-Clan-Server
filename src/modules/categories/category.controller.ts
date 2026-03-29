import { Request, Response } from 'express';
import { CategoryService } from './category.service';
import asyncHandler from '../../utils/CatchAsync';

const listShopCategories = async (req: Request, res: Response) => {
  const categories = await CategoryService.listShopCategories();
  res.json({ success: true, data: categories });
};

const listProductCategories = async (req: Request, res: Response) => {
  const categories = await CategoryService.listProductCategories();
  res.json({ success: true, data: categories });
}

export const CategoryController = {
  listShopCategories: asyncHandler(listShopCategories),
  listProductCategories: asyncHandler(listProductCategories)
};
