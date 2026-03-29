import { multerUpload } from "./multer.config";

export const conditionalMulterSingle = (field: string) => {
  return (req: any, res: any, next: any) => {
    const contentType = req.headers && req.headers['content-type'];
    if (contentType && contentType.indexOf('multipart/form-data') !== -1) {
      return multerUpload.single(field)(req, res, next);
    }
    return next();
  };
};