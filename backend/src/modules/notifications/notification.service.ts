import { badRequest, notFoundError } from "../../lib/errors.js";
import {
  countUnreadNotifications, createDefaultSettings, findNotificationsByUserId,
  findSettingsByUserId, findUsersEligibleForNotification, insertNotification,
  markAllNotificationsAsRead, markNotificationAsRead, resolveActiveEvents,
  upsertSettings, type CreateNotificationInput
} from "./notification.repository.js";

export type NotificationSettingsInput = {
  enabled: boolean; newSessionEnabled: boolean; networkProblemEnabled: boolean;
  routerOfflineEnabled: boolean; routerOnlineEnabled: boolean;
  syncErrorEnabled: boolean; allSites: boolean; siteIds: string[];
};

export async function getNotificationSettings(userId: string) {
  return (await findSettingsByUserId(userId)) ?? createDefaultSettings(userId);
}

export async function updateNotificationSettings(
  userId: string, data: NotificationSettingsInput
) {
  return upsertSettings(userId, data);
}

export async function getNotifications(userId: string, limit: number, offset: number) {
  return findNotificationsByUserId(userId, limit, offset);
}

export async function getUnreadNotificationCount(userId: string) {
  return countUnreadNotifications(userId);
}

export async function readNotification(userId: string, id: string) {
  if (!(await markNotificationAsRead(userId, id))) {
    throw notFoundError("Notification introuvable.");
  }
}

export async function readAllNotifications(userId: string) {
  return markAllNotificationsAsRead(userId);
}

/*
 * Point d'entrée pour le futur synchroniseur MikroTik.
 * Les préférences et l'anti-duplication restent côté backend.
 */
export async function publishNotification(
  organizationId: string,
  data: Omit<CreateNotificationInput, "userId">
) {
  const userIds = await findUsersEligibleForNotification(
    organizationId, data.siteId ?? null, data.type
  );
  const notifications = [];
  for (const userId of userIds) {
    const notification = await insertNotification({ ...data, userId });
    if (notification) notifications.push(notification);
  }
  return notifications;
}

export async function resolveNotificationEvent(
  organizationId: string, eventKey: string
) {
  if (!organizationId.trim() || !eventKey.trim()) {
    throw badRequest("Organisation et événement sont requis.");
  }
  return resolveActiveEvents(organizationId, eventKey);
}
