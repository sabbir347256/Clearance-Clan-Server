import express from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { optionalAuth } from '../../middlewares/optionalAuth.middleware';
import { roleMiddleware } from '../../middlewares/role.middleware';
import { shopApprovedOnly } from '../../middlewares/sellerapproved.middleware';
import { ProductController } from './product.controller';
import { multerUpload } from '../../config/multer.config';
import { parseFormJsonFields } from '../../middlewares/parseFormData.middleware';

const router = express.Router();

// Create product (seller only, requires an approved shop)
router.post('/create-product', 
  authMiddleware, 
  roleMiddleware('SELLER'),
  shopApprovedOnly,  
  multerUpload.fields([
    { name: 'coverImage', maxCount: 1 },
    { name: 'galleryImages', maxCount: 6 }
  ]),
  parseFormJsonFields,
  ProductController.createProduct);

// Get seller's products (seller only)
router.get(
  '/my-products',
  authMiddleware,
  roleMiddleware('SELLER'),
  ProductController.getMyProducts
);

// Update product (seller only, ownership enforced)
router.patch(
  '/update/:id',
  authMiddleware,
  roleMiddleware('SELLER'),
  shopApprovedOnly,
  multerUpload.fields([
    { name: 'coverImage', maxCount: 1 },
    { name: 'galleryImages', maxCount: 6 }
  ]),
    parseFormJsonFields,
  ProductController.updateProduct
);

router.patch(
  '/update-status/:id',
  authMiddleware,
  roleMiddleware('ADMIN'),
  ProductController.updateProductStatus
)

// Get products list(public)
router.get(
  '/',
  optionalAuth,
  ProductController.getActiveProducts
);

// Get product by ID (public)
router.get(
  '/:productId',
  optionalAuth,
  ProductController.getProductById
);

// Get product by ID (seller only)
router.get(
  '/my-products/:productId',
  authMiddleware,
  roleMiddleware('SELLER'),
  ProductController.getProductById
);

// Toggle product active status (seller only, ownership enforced)
router.patch(
  '/my-products/toggle-active/:productId',
  authMiddleware,
  roleMiddleware('SELLER'),
  shopApprovedOnly,
  ProductController.toggleProductActive
);

// Delete product (seller only, ownership enforced)
router.delete(
  '/delete/:productId',
  authMiddleware,
  roleMiddleware('SELLER'),
  shopApprovedOnly,
  ProductController.deleteProduct
);

export const productRoutes = router;