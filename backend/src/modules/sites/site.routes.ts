import { Router } from "express";

import {
  createSiteController,
  deleteSiteController,
  getSite,
  listSites,
  updateSiteController,
} from "./site.controller.js";

const router = Router();

router.get("/", listSites);

router.post("/", createSiteController);

router.get("/:id", getSite);

router.patch("/:id", updateSiteController);

router.delete("/:id", deleteSiteController);

export default router;
