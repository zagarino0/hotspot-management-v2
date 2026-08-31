import { Router, Request, Response, NextFunction } from "express";

import { login } from "../services/auth.service.js";

const authRoutes = Router();

authRoutes.post(
  "/login",
  async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { username, password } = req.body;

      if (
        typeof username !== "string" ||
        typeof password !== "string" ||
        username.trim() === "" ||
        password.trim() === ""
      ) {
        res.status(400).json({
          success: false,
          message: "Username et password sont requis.",
        });

        return;
      }

      const result = await login({
        username: username.trim(),
        password,
      });

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
);

export default authRoutes;