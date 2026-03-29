/* eslint-disable @typescript-eslint/no-explicit-any */
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';

// Initial configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export const uploadBufferToCloudinary = (
  buffer: Buffer,
  fileName: string,
  folder = 'uploads'
): Promise<UploadApiResponse> => {
  // Reconfigure to ensure values are set
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    console.error('Cloudinary config missing:', { cloudName, apiKey: apiKey ? 'SET' : 'MISSING', apiSecret: apiSecret ? 'SET' : 'MISSING' });
    throw new Error('Cloudinary configuration missing. Check CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in .env');
  }

  // Reconfigure before upload
  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
  });

  return new Promise((resolve, reject) => {
    const public_id = `${fileName}-${Date.now()}`;

    cloudinary.uploader.upload_stream(
      {
        resource_type: 'auto',
        folder,
        public_id,
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result as UploadApiResponse);
      }
    ).end(buffer);
  });
};
