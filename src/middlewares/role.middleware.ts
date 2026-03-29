import { Request, Response, NextFunction } from 'express';

export const roleMiddleware =
  (...allowedRoles: Array<'BUYER' | 'SELLER' | 'ADMIN'>) =>
  (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    next();
  };
