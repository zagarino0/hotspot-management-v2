import { Router } from "express";

import {
  createRoleController,
  deleteRoleController,
  getRole,
  listPermissions,
  listRoles,
  updateRoleController,
} from "./role.controller.js";

const router = Router();

router.get("/", listRoles);

router.get("/permissions", listPermissions);

router.post("/", createRoleController);

router.get("/:id", getRole);

router.patch("/:id", updateRoleController);

router.delete("/:id", deleteRoleController);

export default router;
