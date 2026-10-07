import { Router } from "express";
import {
  getSettings, listNotifications, markAllRead, markRead, putSettings, unreadCount
} from "./notification.controller.js";

const router = Router();

router.get("/settings", getSettings);
router.put("/settings", putSettings);
router.get("/", listNotifications);
router.get("/unread-count", unreadCount);
router.patch("/read-all", markAllRead);
router.patch("/:id/read", markRead);

export default router;
