import { Request, Response, NextFunction } from 'express';
import { Shop } from '../modules/sellers/seller.model';

export const shopApprovedOnly = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const shop = await Shop.findOne({ userId: req.user!._id });

  if (!shop || shop.status !== 'APPROVED') {
    return res.status(403).json({
      success: false,
      message: 'Seller approval pending'
    });
  }

  next();
};
