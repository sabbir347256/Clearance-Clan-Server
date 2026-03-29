import { Request, Response, NextFunction } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { AuthService } from '../modules/auth/auth.service';
import { User } from '../modules/users/user.model';

interface CustomJwtPayload extends JwtPayload {
  userId: string;
  role: string;
}

export const optionalAuth = async (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.split(' ')[1];

    if (AuthService.isTokenRevoked && AuthService.isTokenRevoked(token)) {
      return next();
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_ACCESS_SECRET as string
    ) as CustomJwtPayload;

    const user = await User.findById(decoded.userId).select('-password');
    if (!user) return next();

    req.user = user;
    return next();
  } catch (_error) {
    // If token invalid/expired, ignore and continue as anonymous
    return next();
  }
};

export default optionalAuth;
