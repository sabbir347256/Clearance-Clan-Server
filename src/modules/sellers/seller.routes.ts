import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { roleMiddleware } from '../../middlewares/role.middleware';
import { shopApprovedOnly } from '../../middlewares/sellerapproved.middleware';
import { multerUpload } from '../../config/multer.config';
import { SellerController } from './seller.controller';
import { Request, Response, NextFunction } from 'express';

const router = Router();

// Debug middleware to log request before multer
const debugRequest = (req: Request, res: Response, next: NextFunction) => {
  console.log('\n=== PRE-MULTER DEBUG ===');
  console.log('Content-Type:', req.headers['content-type']);
  console.log('Content-Length:', req.headers['content-length']);
  console.log('Has body:', !!req.body);
  console.log('Body readable:', req.readable);
  console.log('========================\n');
  next();
};

// Multer error handler middleware
const multerErrorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  if (err) {
    console.error('Multer error:', err);
    return res.status(400).json({
      success: false,
      message: `File upload error: ${err.message}`,
      error: err.code || 'UPLOAD_ERROR'
    });
  }
  next();
};

// Create shop with file uploads (no approval needed - first time setup)
router.post(
  '/create-shop',
  authMiddleware,
  roleMiddleware('SELLER'),
  debugRequest,
  multerUpload.fields([
    { name: 'shopLogo', maxCount: 1 },
    { name: 'shopBanner', maxCount: 1 },
    { name: 'nationalId', maxCount: 1 },
    { name: 'companyRegistration', maxCount: 1 },
    { name: 'taxDocument', maxCount: 1 }
  ]),
  multerErrorHandler,
  SellerController.createShop
);

// Get my shop (accessible to check approval status)
router.get(
  '/my-shop',
  authMiddleware,
  roleMiddleware('SELLER'),
  SellerController.getMyShop
);

// Update shop (requires approval)
router.patch(
  '/update-shop',
  authMiddleware,
  roleMiddleware('SELLER'),
  shopApprovedOnly,
  debugRequest,
  multerUpload.fields([
    { name: 'shopLogo', maxCount: 1 },
    { name: 'shopBanner', maxCount: 1 },
    { name: 'nationalId', maxCount: 1 },
    { name: 'companyRegistration', maxCount: 1 },
    { name: 'taxDocument', maxCount: 1 }
  ]),
  multerErrorHandler,
  SellerController.updateShop
);

// Dashboard access (requires approval)
router.get(
  '/dashboard',
  authMiddleware,
  roleMiddleware('SELLER'),
  shopApprovedOnly,
  SellerController.getDashboard
);

export const sellerRoutes =  router;
