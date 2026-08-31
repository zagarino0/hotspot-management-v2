import { Router } from "express";
import { getHotspotProfiles } from "./mikrotik.controller.js";

const router = Router();

router.get("/profiles/:siteId", getHotspotProfiles);

export default router;
