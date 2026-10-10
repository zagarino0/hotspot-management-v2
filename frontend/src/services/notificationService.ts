import api from "./api";

export interface NotificationSettings {
  id: string;
  userId: string;
  enabled: boolean;
  newSessionEnabled: boolean;
  networkProblemEnabled: boolean;
  routerOfflineEnabled: boolean;
  routerOnlineEnabled: boolean;
  syncErrorEnabled: boolean;
  allSites: boolean;
  siteIds: string[];
  createdAt: string;
  updatedAt: string;
}

export type NotificationSettingsPayload = Omit<
  NotificationSettings,
  "id" | "userId" | "createdAt" | "updatedAt"
>;

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  message?: string;
}

export async function getNotificationSettings(): Promise<NotificationSettings> {
  const response = await api.get<ApiEnvelope<NotificationSettings>>(
    "/api/notifications/settings",
  );
  return response.data.data;
}

export async function saveNotificationSettings(
  payload: NotificationSettingsPayload,
): Promise<NotificationSettings> {
  const response = await api.put<ApiEnvelope<NotificationSettings>>(
    "/api/notifications/settings",
    payload,
  );
  return response.data.data;
}
