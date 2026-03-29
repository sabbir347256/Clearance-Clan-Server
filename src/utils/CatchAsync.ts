import { NextFunction, Request, RequestHandler, Response } from 'express';

type AsyncHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<any>;

const CatchAsync = (fn: AsyncHandler): RequestHandler => (
  req,
  res,
  next
) => Promise.resolve(fn(req, res, next)).catch(next);

export default CatchAsync;
export { CatchAsync };