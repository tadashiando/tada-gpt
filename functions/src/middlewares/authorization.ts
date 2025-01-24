import { Request, Response, NextFunction } from "express";

export const authorizeRole =
  (roles: string[]) =>
    (req: Request, res: Response, next: NextFunction): void => {
      if (!req.user || !roles.includes(req.user.role)) {
        res.status(403)
          .json({ message: "Access forbidden: insufficient role" });
        return;
      }
      next(); // Continue if the role is authorized
    };
