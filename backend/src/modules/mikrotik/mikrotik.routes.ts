import { Router } from "express";
import { createHotspotProfile, getHotspotProfiles } from "./mikrotik.controller.js";

const router = Router();

router.get("/profiles/:siteId", getHotspotProfiles);
router.post("/profiles/:siteId", createHotspotProfile);

export default router;
