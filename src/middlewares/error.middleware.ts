import { Request, Response, NextFunction } from 'express';
import AppError from '../errorHelper/AppError';

export default function globalErrorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ status: 'error', message: err.message });
  }

  console.error(err);
  res.status(500).json({ status: 'error', message: 'Internal Server Error' });
}
