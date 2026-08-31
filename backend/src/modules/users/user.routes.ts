import { Router } from "express";

import {
  createUserController,
  deleteUserController,
  getUser,
  listUsers,
  updateUserController,
  updateUserRolesController,
} from "./user.controller.js";

const router = Router();

router.get("/", listUsers);

router.post("/", createUserController);

router.get("/:id", getUser);

router.patch("/:id", updateUserController);

router.patch("/:id/roles", updateUserRolesController);

router.delete("/:id", deleteUserController);

export default router;
