import bcrypt from 'bcrypt';
import jwt, { Secret } from 'jsonwebtoken';
import { User } from '../users/user.model';
import { OAuth2Client } from 'google-auth-library';
import appleSignin from 'apple-signin-auth';
import AppError from '../../errorHelper/AppError';
import crypto from 'crypto';
import { sendEmail } from '../../utils/sendEmail';
import { createAccount } from '../payments/connect.service';
import { string } from 'zod';


const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// In-memory revoked access tokens store (simple blacklist until server restart)
const revokedTokens = new Set<string>();

const registerUser = async (
  fullName: string,
  email: string,
  password: string,
  role: 'BUYER' | 'SELLER',
  country?: string
) => {
  const exists = await User.findOne({ email });
  if (exists) throw new AppError(400, 'Email already exists');

  const hashedPassword = await bcrypt.hash(password, 10);

  let stripeConnectAccountId: string | undefined;

  if (role === 'SELLER') {
    if (!country) {
      throw new AppError(400, 'Country is required for seller registration');
    }

    const account = await createAccount({ email, country });
    stripeConnectAccountId = account.id;
  }
  const user = await User.create({
    fullName,
    email,
    password: hashedPassword,
    role,
    stripeConnectAccountId
  });

  // sanitize like login
  const { password: _, ...safeUser } = user.toObject();

  return safeUser;
};

const loginUser = async (
  email: string,
  password: string,
  loginAs: 'BUYER' | 'SELLER'
) => {
  const user = await User.findOne({ email, role: loginAs }).select('+password');
  if (!user) throw new AppError(401, 'Invalid credentials');

  if (!user.password) throw new AppError(401, 'Invalid credentials');
  const match = await bcrypt.compare(password, user.password);
  if (!match) throw new AppError(401, 'Invalid credentials');

  const jwtAccessSecret = process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET;
  if (!jwtAccessSecret) {
    throw new AppError(500, 'JWT_ACCESS_SECRET (or JWT_SECRET) environment variable is not set');
  }

  const accessToken = (jwt as any).sign(
    { userId: user._id, role: user.role },
    jwtAccessSecret,
    { expiresIn: '7d' }
  );

  const { password: _, ...safeUser } = user.toObject();

  return { user: safeUser, accessToken };
};

const verifyGoogleToken = async (idToken: string, role: 'BUYER' | 'SELLER') => {
  if (!idToken) throw new AppError(400, 'idToken is required');
  const ticket = await googleClient.verifyIdToken({ idToken, audience: process.env.GOOGLE_CLIENT_ID });
  const payload = ticket.getPayload();
  if (!payload || !payload.email || !payload.sub) throw new AppError(400, 'Invalid Google token');

  const email = payload.email;
  const providerId = payload.sub;

  let user = await User.findOne({ email });
  if (!user) {
    user = await User.create({ fullName: payload.name || 'No Name', email, role, provider: 'google', providerId, isEmailVerified: true });
  } else if (!user.providerId) {
    user.provider = 'google';
    user.providerId = providerId;
    await user.save();
  }

  const jwtAccessSecret = process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET;
  if (!jwtAccessSecret) throw new AppError(500, 'JWT secret not set');

  const accessToken = (jwt as any).sign({ userId: user._id, role: user.role }, jwtAccessSecret, { expiresIn: process.env.JWT_ACCESS_EXPIRATION || '30m' });

  return { user, accessToken };
};

const verifyAppleToken = async (idToken: string, role: 'BUYER' | 'SELLER') => {
  if (!idToken) throw new AppError(400, 'idToken is required');
  const applePayload = await appleSignin.verifyIdToken(idToken, {
    audience: process.env.APPLE_CLIENT_ID || process.env.APPLE_SERVICE_ID
  });

  const email = (applePayload as any).email;
  const providerId = (applePayload as any).sub;

  let user = await User.findOne({ email });
  if (!user) {
    user = await User.create({ fullName: (applePayload as any).name || 'No Name', email, role, provider: 'apple', providerId, isEmailVerified: true });
  } else if (!user.providerId) {
    user.provider = 'apple';
    user.providerId = providerId;
    await user.save();
  }

  const jwtAccessSecret = process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET;
  if (!jwtAccessSecret) throw new AppError(500, 'JWT secret not set');

  const accessToken = (jwt as any).sign({ userId: user._id, role: user.role }, jwtAccessSecret, { expiresIn: process.env.JWT_ACCESS_EXPIRATION || '30m' });

  return { user, accessToken };
};

const logoutUser = async (refreshToken: string) => {
  // For this low-budget project we don't use refresh tokens.
  // Keep the function for compatibility. If a token string is provided, revoke it temporarily.
  if (refreshToken) {
    revokedTokens.add(refreshToken);
  }
  return;
}

const revokeToken = (token: string) => {
  if (!token) return;
  revokedTokens.add(token);
};

const isTokenRevoked = (token: string) => {
  return revokedTokens.has(token);
};

async function forgotPassword(email: string) {
  const user = await User.findOne({ email });
  // Always respond success to avoid revealing account existence; only perform actions if user exists
  if (!user) return;

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const hashed = crypto.createHash('sha256').update(otp).digest('hex');
  const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  user.resetPasswordOtp = hashed;
  user.resetPasswordOtpExpires = expires;
  user.resetPasswordVerified = false;
  await user.save();

  // send OTP via email (plain OTP in email body)
  try {
    await sendEmail({
      to: user.email,
      subject: 'Password reset OTP',
      text: `Your password reset code is: ${otp}. It expires in 10 minutes.`,
      html: `<p>Your password reset code is: <strong>${otp}</strong>. It expires in 10 minutes.</p>`
    });
  } catch (err) {
    // Log and swallow to avoid leaking email problems to client
    console.error('Failed to send reset OTP email', err);
  }
}

async function verifyResetOtp(email: string, otp: string) {
  const user = await User.findOne({ email });
  if (!user || !user.resetPasswordOtp || !user.resetPasswordOtpExpires) throw new AppError(400, 'Invalid OTP or email');

  if (user.resetPasswordOtpExpires.getTime() < Date.now()) throw new AppError(400, 'OTP expired');

  const hashed = crypto.createHash('sha256').update(otp).digest('hex');
  if (hashed !== user.resetPasswordOtp) throw new AppError(400, 'Invalid OTP');

  user.resetPasswordVerified = true;
  await user.save();
}

async function resetPassword(email: string, newPassword: string) {
  const user = await User.findOne({ email }).select('+password resetPasswordOtp resetPasswordOtpExpires resetPasswordVerified');
  if (!user) throw new AppError(400, 'Invalid request');

  if (!user.resetPasswordVerified) throw new AppError(400, 'OTP not verified');
  if (user.resetPasswordOtpExpires && user.resetPasswordOtpExpires.getTime() < Date.now()) throw new AppError(400, 'OTP expired');

  const hashedPassword = await bcrypt.hash(newPassword, 10);
  user.password = hashedPassword;
  user.resetPasswordOtp = undefined as any;
  user.resetPasswordOtpExpires = undefined as any;
  user.resetPasswordVerified = false;
  await user.save();
}

export const AuthService = {
  registerUser,
  loginUser,
  verifyGoogleToken,
  verifyAppleToken,
  forgotPassword,
  verifyResetOtp,
  resetPassword,
  logoutUser,
  revokeToken,
  isTokenRevoked
};

