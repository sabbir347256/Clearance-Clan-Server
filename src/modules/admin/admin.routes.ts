import express from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { roleMiddleware } from '../../middlewares/role.middleware';
import { AdminController } from './admin.controller';
import { conditionalMulterSingle } from '../../config/conditionalmulter.config';

const router = express.Router();

// Get all shops
router.get(
  '/shops',
  authMiddleware,
  roleMiddleware('ADMIN'),
  AdminController.getAllShops
);

// Get pending shops
router.get(
  '/shops/pending',
  authMiddleware,
  roleMiddleware('ADMIN'),
  AdminController.getAllPendingShops
);

// Get approved shops
router.get(
  '/shops/approved',
  authMiddleware,
  roleMiddleware('ADMIN'),
  AdminController.getAllApprovedShops
);

// Get shop by ID
router.get(
  '/shops/:shopId',
  authMiddleware,
  roleMiddleware('ADMIN'),
  AdminController.getShopById
);

// get totale sales , total prpducts, retrun % 
router.get(
  '/shops/:shopId/stats',
  authMiddleware,
  roleMiddleware('ADMIN'),
  AdminController.getShopStats
);

// Approve Shop
router.patch(
  '/shops/:shopId/approve',
  authMiddleware,
  roleMiddleware('ADMIN'),
  AdminController.approveShop
);

// Reject Shop
router.patch(
  '/shops/:shopId/reject',
  authMiddleware,
  roleMiddleware('ADMIN'),
  AdminController.rejectShop
);

// Suspend Shop
router.patch(
  '/shops/:shopId/suspend',
  authMiddleware,
  roleMiddleware('ADMIN'),
  AdminController.suspendShop
);

// Add Shop Category
router.post(
  '/shops/add-category',
  authMiddleware,
  roleMiddleware('ADMIN'),
  conditionalMulterSingle('image'),
  AdminController.addShopCategory
);

// Add Product Category
router.post(
  '/products/add-category',
  authMiddleware,
  roleMiddleware('ADMIN'),
  conditionalMulterSingle('image'),
  AdminController.addProductCategory
);

// Get all categories (optional type=SHOP|PRODUCT) with pagination
router.get(
  '/categories',
  authMiddleware,
  roleMiddleware('ADMIN'),
  AdminController.getCategories
);

// Update category (name and/or image)
router.patch(
  '/categories/:categoryId',
  authMiddleware,
  roleMiddleware('ADMIN'),
  conditionalMulterSingle('image'),
  AdminController.updateCategory
);

// List products with optional approvalStatus filter
router.get(
  '/products',
  authMiddleware,
  roleMiddleware('ADMIN'),
  AdminController.getProducts
);

// Update product approval status
router.patch(
  '/products/:productId/approval',
  authMiddleware,
  roleMiddleware('ADMIN'),
  AdminController.updateProductApproval
);

// Platform stats (totals + order status counts)
router.get(
  '/stats',
  authMiddleware,
  roleMiddleware('ADMIN'),
  AdminController.getPlatformStats
);

// Add Bannner Images
router.post(
  '/banners',
  authMiddleware,
  roleMiddleware('ADMIN'),
  conditionalMulterSingle('image'),
  AdminController.createBanner
);

// Delete Banner Image
router.delete(
  '/banners/:id',
  authMiddleware,
  roleMiddleware('ADMIN'),
  AdminController.deleteBanner
);

// Fetch all users ( buyers and sellers)
router.get(
  '/users',
  authMiddleware,
  roleMiddleware('ADMIN'),
  AdminController.getUsers
);

// Fetch last 5 orders ( for dashboard )
router.get(
  '/recent-orders',
  authMiddleware,
  roleMiddleware('ADMIN'),
  AdminController.getRecentOrders
)

// Email Verify for users ( buyers and sellers)
router.post(
  '/:userId/verify-email',
  authMiddleware,
  roleMiddleware('ADMIN'),
  AdminController.updateEmailVerificationStatus
);

// Total sales, orders count, total products
router.get(
  '/dashboard/stats',
  authMiddleware,
  roleMiddleware('ADMIN'),
  AdminController.getStats
);

router.get(
  '/orders',
  authMiddleware,
  roleMiddleware('ADMIN'),
  AdminController.getAllOrders 
)

router.get(
  '/orders/:orderId',
  authMiddleware,
  roleMiddleware('ADMIN'),
  AdminController.getOrderById
)

export const adminRoutes = router;