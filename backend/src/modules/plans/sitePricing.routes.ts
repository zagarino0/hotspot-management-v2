import { Router } from "express";

import {
  listSiteProfilePrices,
  updateSiteProfilePriceController,
} from "./sitePricing.controller.js";

const router = Router();

router.get("/site-prices", listSiteProfilePrices);
router.put("/site-prices", updateSiteProfilePriceController);

export default router;
