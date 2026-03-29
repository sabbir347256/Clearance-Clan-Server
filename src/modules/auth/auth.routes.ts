import express from 'express';
import { AuthController } from './auth.controller';

const router = express.Router();

router.post('/buyer/register', AuthController.registerBuyer);
router.post('/seller/register', AuthController.registerSeller);
router.post('/login', AuthController.login);
router.post('/oauth/google', AuthController.googleOAuth);
router.post('/oauth/apple', AuthController.appleOAuth);
router.post('/logout', AuthController.logout);
router.post('/forgot-password', AuthController.forgotPassword);
router.post('/verify-reset-otp', AuthController.verifyResetOtp);
router.post('/reset-password', AuthController.resetPassword);

export const authRoutes = router;