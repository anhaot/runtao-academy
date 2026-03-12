declare module 'multer' {
  const multer: any;
  export default multer;
}

declare global {
  namespace Express {
    interface MulterFile {
      path: string;
      originalname: string;
      mimetype?: string;
      size?: number;
    }

    interface Request {
      file?: MulterFile;
    }
  }
}

export {};
