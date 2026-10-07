import { Router, Request, Response, NextFunction } from "express";

import { login, getCurrentUser, changeOwnPassword } from "../services/auth.service.js";
import { authenticate } from "../middleware/auth.js";

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

authRoutes.get(
  "/me",
  authenticate,
  async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = req.auth?.sub;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: "Authentification requise.",
        });
        return;
      }

      const user = await getCurrentUser(userId);

      res.status(200).json({
        success: true,
        data: user,
      });
    } catch (error) {
      next(error);
    }
  }
);

authRoutes.post(
  "/change-password",
  authenticate,
  async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = req.auth?.sub;
      const { currentPassword, newPassword } = req.body;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: "Authentification requise.",
        });
        return;
      }

      if (
        typeof currentPassword !== "string" ||
        typeof newPassword !== "string" ||
        !currentPassword ||
        !newPassword
      ) {
        res.status(400).json({
          success: false,
          message: "Les mots de passe sont requis.",
        });
        return;
      }

      await changeOwnPassword(
        userId,
        currentPassword,
        newPassword
      );

      res.status(200).json({
        success: true,
        message: "Mot de passe modifié avec succès.",
      });
    } catch (error) {
      next(error);
    }
  }
);
