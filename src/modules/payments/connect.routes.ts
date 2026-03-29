import { Router } from 'express';
import ConnectController from './connect.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';

const router = Router();

// Create a connected account
router.post('/accounts',authMiddleware, ConnectController.createAccount);

// Create an account link to onboard the connected account
router.post('/accounts/:id/onboard', ConnectController.createAccountLink);

// Get account status directly from Stripe
router.get('/accounts/:id/status', ConnectController.getAccountStatus);

// Create a product at the platform level and attach connected account mapping in metadata
router.post('/products', ConnectController.createProduct);

// List platform products
router.get('/products', ConnectController.listProducts);

// Show a simple storefront page
router.get('/storefront', ConnectController.storefrontPage);

// Create a Stripe Checkout session (destination charge) for a product
router.post('/checkout', ConnectController.createCheckoutSession);

// Simple success and cancel pages for Checkout redirects
router.get('/success', ConnectController.checkoutSuccess);
router.get('/cancel', ConnectController.checkoutCancel);

export const connectRoutes = router;

export default connectRoutes;
