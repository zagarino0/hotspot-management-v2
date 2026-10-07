import type { NextFunction, Request, Response } from "express";
import {
  getNotificationSettings, getNotifications, getUnreadNotificationCount,
  readAllNotifications, readNotification, updateNotificationSettings
} from "./notification.service.js";

function userId(req: Request) {
  return req.auth?.sub ?? null;
}

export async function getSettings(req: Request, res: Response, next: NextFunction) {
  try {
    const id = userId(req);
    if (!id) return res.status(401).json({ success: false, message: "Authentification requise." });
    return res.status(200).json({ success: true, data: await getNotificationSettings(id) });
  } catch (error) { return next(error); }
}

export async function putSettings(req: Request, res: Response, next: NextFunction) {
  try {
    const id = userId(req);
    if (!id) return res.status(401).json({ success: false, message: "Authentification requise." });
    const body = req.body ?? {};
    const fields = [
      "enabled","newSessionEnabled","networkProblemEnabled","routerOfflineEnabled",
      "routerOnlineEnabled","syncErrorEnabled","allSites"
    ];
    for (const field of fields) {
      if (typeof body[field] !== "boolean") {
        return res.status(400).json({ success: false, message: \`Le champ "\${field}" doit être booléen.\` });
      }
    }
    if (!Array.isArray(body.siteIds) ||
        !body.siteIds.every((v: unknown) => typeof v === "string" && v.trim())) {
      return res.status(400).json({ success: false, message: "siteIds doit être un tableau d'identifiants valides." });
    }
    const data = await updateNotificationSettings(id, {
      enabled: body.enabled, newSessionEnabled: body.newSessionEnabled,
      networkProblemEnabled: body.networkProblemEnabled, routerOfflineEnabled: body.routerOfflineEnabled,
      routerOnlineEnabled: body.routerOnlineEnabled, syncErrorEnabled: body.syncErrorEnabled,
      allSites: body.allSites,
      siteIds: [...new Set(body.siteIds.map((v: string) => v.trim()))]
    });
    return res.status(200).json({ success: true, message: "Paramètres de notifications enregistrés.", data });
  } catch (error) { return next(error); }
}

export async function listNotifications(req: Request, res: Response, next: NextFunction) {
  try {
    const id = userId(req);
    if (!id) return res.status(401).json({ success: false, message: "Authentification requise." });
    const limit = Number(req.query.limit ?? 20);
    const offset = Number(req.query.offset ?? 0);
    if (!Number.isInteger(limit) || limit < 1 || limit > 100 ||
        !Number.isInteger(offset) || offset < 0) {
      return res.status(400).json({ success: false, message: "limit doit être entre 1 et 100 et offset positif." });
    }
    const data = await getNotifications(id, limit, offset);
    return res.status(200).json({ success: true, data, count: data.length, limit, offset });
  } catch (error) { return next(error); }
}

export async function unreadCount(req: Request, res: Response, next: NextFunction) {
  try {
    const id = userId(req);
    if (!id) return res.status(401).json({ success: false, message: "Authentification requise." });
    return res.status(200).json({ success: true, data: { count: await getUnreadNotificationCount(id) } });
  } catch (error) { return next(error); }
}

export async function markRead(req: Request, res: Response, next: NextFunction) {
  try {
    const id = userId(req);
    if (!id) return res.status(401).json({ success: false, message: "Authentification requise." });
    await readNotification(id, String(req.params.id ?? ""));
    return res.status(200).json({ success: true, message: "Notification marquée comme lue." });
  } catch (error) { return next(error); }
}

export async function markAllRead(req: Request, res: Response, next: NextFunction) {
  try {
    const id = userId(req);
    if (!id) return res.status(401).json({ success: false, message: "Authentification requise." });
    const count = await readAllNotifications(id);
    return res.status(200).json({ success: true, message: "Notifications marquées comme lues.", data: { count } });
  } catch (error) { return next(error); }
}
