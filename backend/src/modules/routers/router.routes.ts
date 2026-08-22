import { Router } from "express";

import {
  listRouters,
  testRouter,
  createRouterController,
  getRouter,
  updateRouterController,
  deleteRouterController,
} from "./router.controller.js";

const router = Router();

router.get(
  "/",
  listRouters
);

router.post(
  "/test",
  testRouter
);

router.post(
  "/",
  createRouterController
);

router.get(
  "/:id",
  getRouter
);

router.patch(
  "/:id",
  updateRouterController
);

router.delete(
  "/:id",
  deleteRouterController
);

export default router;