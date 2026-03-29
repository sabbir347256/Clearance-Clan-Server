import { Request, Response } from 'express';
import asyncHandler from '../../utils/CatchAsync';
import { ReviewService } from './review.service';
import AppError from '../../errorHelper/AppError';

const createReview = async (req: Request, res: Response) => {
  const userId = String((req.user as any)?._id);
  const { orderId, rating, comment } = req.body || {};

  if (!orderId || !rating) {
    throw new AppError(400, 'orderId and rating are required');
  }

  const review = await ReviewService.createReview({
    orderId,
    userId,
    rating,
    comment,
  });

  return res.status(201).json({
    success: true,
    data: review,
  });
};


const deleteReview = async (req: Request, res: Response) => {
  const reviewId = req.params.id;
  const userId = String((req.user as any)._id);
  const role = (req.user as any).role;

  await ReviewService.deleteReview({
    reviewId,
    userId,
    role,
  });

  return res.status(200).json({
    success: true,
    message: 'Review deleted successfully',
  });
};

const getReviewsByProduct = async (req: Request, res: Response) => {
  const productId = req.params.productId;

  const rawPage = req.query.page as string | undefined;
  const rawLimit = req.query.limit as string | undefined;

  const page = rawPage ? Math.max(1, parseInt(rawPage, 10) || 1) : 1;
  const limit = rawLimit ? Math.max(1, parseInt(rawLimit, 10) || 10) : 10;

  const result = await ReviewService.getReviewsByProduct(productId, page, limit);

  return res.status(200).json({
    success: true,
    data: result.data,
    meta: result.meta,
  });
};

export const ReviewController = {
  createReview: asyncHandler(createReview),
  deleteReview: asyncHandler(deleteReview),
  getReviewsByProduct: asyncHandler(getReviewsByProduct),
};
