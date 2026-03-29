import express from 'express';
import { CategoryController } from './category.controller';

const router = express.Router();

// Public listing
router.get('/shops', CategoryController.listShopCategories);

router.get('/products', CategoryController.listProductCategories);

export const categoryRoutes = router;
