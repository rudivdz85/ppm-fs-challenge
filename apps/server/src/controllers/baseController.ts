import { Request, Response, NextFunction } from 'express';

export abstract class BaseController {
  protected asyncHandler = (fn: Function) => {
    return (req: Request, res: Response, next: NextFunction) => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };
  };

  protected sendResponse = (res: Response, statusCode: number, data: any, message?: string) => {
    res.status(statusCode).json({
      success: true,
      message,
      data
    });
  };

  protected sendError = (res: Response, statusCode: number, message: string) => {
    res.status(statusCode).json({
      success: false,
      error: { message }
    });
  };
}