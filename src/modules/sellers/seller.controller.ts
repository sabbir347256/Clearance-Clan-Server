import { Request, Response } from 'express';
import { SellerService } from './seller.service';
import asyncHandler from '../../utils/CatchAsync';

const createShop = async (req: Request, res: Response) => {
  // Debugging: log content-type and file presence
  console.log('CreateShop - content-type:', req.headers['content-type']);
  console.log('CreateShop - content-length:', req.headers['content-length']);
  console.log('CreateShop - req.files present:', Boolean(req.files));
  if (Array.isArray(req.files)) {
    console.log('CreateShop - files array length:', (req.files as Express.Multer.File[]).length);
    if ((req.files as Express.Multer.File[]).length === 0) {
      console.warn('⚠️ WARNING: No files received! Client must send files as multipart/form-data with File type (not Text).');
      console.warn('⚠️ Expected file fields: shopLogo, shopBanner, nationalId, companyRegistration, taxDocument');
    } else {
      console.log('CreateShop - file fields:', (req.files as Express.Multer.File[]).map(f => `${f.fieldname}:${f.originalname}`).join(', '));
    }
  } else if (req.files && typeof req.files === 'object') {
    console.log('CreateShop - files object keys:', Object.keys(req.files as object));
  }
  console.log('CreateShop - req.body keys:', Object.keys(req.body || {}).join(', '));

  // Normalize multer output: it may be an array (from .any()) or an object (from .fields())
  let files = {} as { [fieldname: string]: Express.Multer.File[] };
  if (Array.isArray(req.files)) {
    for (const f of req.files as Express.Multer.File[]) {
      const file = f as any;
      if (!files[file.fieldname]) files[file.fieldname] = [];
      files[file.fieldname].push(file);
    }
  } else if (req.files && typeof req.files === 'object') {
    files = req.files as { [fieldname: string]: Express.Multer.File[] };
  }

  const seller = await SellerService.createShop(
    req.user!._id.toString(),
    req.body,
    files
  );

  res.status(201).json({
    success: true,
    message: 'Shop submitted for approval',
    data: seller
  });
};

const getMyShop = async (req: Request, res: Response) => {
  const seller = await SellerService.getShopByUserId(req.user!._id.toString());
  
  if (!seller) {
    return res.status(404).json({
      success: false,
      message: 'Shop not found'
    });
  }

  res.json({
    success: true,
    data: seller
  });
};

const updateShop = async (req: Request, res: Response) => {  
  // Normalize multer output: it may be an array (from .any()) or an object (from .fields())
  let files = {} as { [fieldname: string]: Express.Multer.File[] };
  if (Array.isArray(req.files)) {
    for (const f of req.files as Express.Multer.File[]) {
      const file = f as any;
      if (!files[file.fieldname]) files[file.fieldname] = [];
      files[file.fieldname].push(file);
    }
  } else if (req.files && typeof req.files === 'object') {
    files = req.files as { [fieldname: string]: Express.Multer.File[] };
  }
  
  const seller = await SellerService.updateShop(
    req.user!._id.toString(),
    req.body,
    files
  );

  res.json({
    success: true,
    message: 'Shop updated successfully',
    data: seller
  });
};

const getDashboard = async (req: Request, res: Response) => {
  if (!req.user) return res.status(401).json({ success: false, message: 'Unauthorized' });

  const data = await (SellerService as any).getDashboard(req.user._id.toString());
  return res.json({ success: true, data });
};

export const SellerController = {
  createShop: asyncHandler(createShop),
  getMyShop: asyncHandler(getMyShop),
  updateShop: asyncHandler(updateShop),
  getDashboard: asyncHandler(getDashboard)
};