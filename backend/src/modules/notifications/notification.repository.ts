import { pool } from "../../database/pool.js";

export type NotificationSettingsRow = {
  id: string; userId: string; enabled: boolean;
  newSessionEnabled: boolean; networkProblemEnabled: boolean;
  routerOfflineEnabled: boolean; routerOnlineEnabled: boolean;
  syncErrorEnabled: boolean; allSites: boolean; siteIds: string[];
  createdAt: string; updatedAt: string;
};

export type NotificationRow = {
  id: string; userId: string; siteId: string | null; routerId: string | null;
  type: string; severity: string; title: string; message: string;
  eventKey: string; readAt: string | null; resolvedAt: string | null;
  createdAt: string;
};

const SETTINGS_SELECT = \`
  SELECT ns.id, ns.user_id AS "userId", ns.enabled,
    ns.new_session_enabled AS "newSessionEnabled",
    ns.network_problem_enabled AS "networkProblemEnabled",
    ns.router_offline_enabled AS "routerOfflineEnabled",
    ns.router_online_enabled AS "routerOnlineEnabled",
    ns.sync_error_enabled AS "syncErrorEnabled",
    ns.all_sites AS "allSites",
    COALESCE(ARRAY_AGG(nss.site_id) FILTER (WHERE nss.site_id IS NOT NULL),
      ARRAY[]::uuid[]) AS "siteIds",
    ns.created_at AS "createdAt", ns.updated_at AS "updatedAt"
  FROM notification_setting ns
  LEFT JOIN notification_setting_site nss ON nss.setting_id = ns.id
  WHERE ns.user_id = $1 GROUP BY ns.id
\`;

export async function findSettingsByUserId(userId: string) {
  const result = await pool.query<NotificationSettingsRow>(SETTINGS_SELECT, [userId]);
  return result.rows[0] ?? null;
}

export async function createDefaultSettings(userId: string) {
  await pool.query(\`INSERT INTO notification_setting (user_id)
    VALUES ($1) ON CONFLICT (user_id) DO NOTHING\`, [userId]);
  const settings = await findSettingsByUserId(userId);
  if (!settings) throw new Error("Impossible de créer les paramètres de notifications.");
  return settings;
}

export async function upsertSettings(userId: string, data: {
  enabled: boolean; newSessionEnabled: boolean; networkProblemEnabled: boolean;
  routerOfflineEnabled: boolean; routerOnlineEnabled: boolean;
  syncErrorEnabled: boolean; allSites: boolean; siteIds: string[];
}) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query<{ id: string }>(
      \`INSERT INTO notification_setting (
        user_id, enabled, new_session_enabled, network_problem_enabled,
        router_offline_enabled, router_online_enabled, sync_error_enabled, all_sites
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      ON CONFLICT (user_id) DO UPDATE SET
        enabled=EXCLUDED.enabled, new_session_enabled=EXCLUDED.new_session_enabled,
        network_problem_enabled=EXCLUDED.network_problem_enabled,
        router_offline_enabled=EXCLUDED.router_offline_enabled,
        router_online_enabled=EXCLUDED.router_online_enabled,
        sync_error_enabled=EXCLUDED.sync_error_enabled,
        all_sites=EXCLUDED.all_sites, updated_at=NOW()
      RETURNING id\`,
      [userId, data.enabled, data.newSessionEnabled, data.networkProblemEnabled,
       data.routerOfflineEnabled, data.routerOnlineEnabled, data.syncErrorEnabled, data.allSites]
    );
    const settingId = result.rows[0].id;
    await client.query(\`DELETE FROM notification_setting_site WHERE setting_id = $1\`, [settingId]);
    if (!data.allSites && data.siteIds.length) {
      await client.query(
        \`INSERT INTO notification_setting_site (setting_id, site_id)
         SELECT $1, s.id FROM site s
         WHERE s.organization_id = (SELECT organization_id FROM "user" WHERE id = $2)
           AND s.id = ANY($3::uuid[]) ON CONFLICT DO NOTHING\`,
        [settingId, userId, data.siteIds]
      );
    }
    await client.query("COMMIT");
    const settings = await findSettingsByUserId(userId);
    if (!settings) throw new Error("Impossible de relire les paramètres de notifications.");
    return settings;
  } catch (error) {
    await client.query("ROLLBACK"); throw error;
  } finally { client.release(); }
}

export async function findNotificationsByUserId(userId: string, limit: number, offset: number) {
  const result = await pool.query<NotificationRow>(
    \`SELECT id, user_id AS "userId", site_id AS "siteId", router_id AS "routerId",
      type, severity, title, message, event_key AS "eventKey",
      read_at AS "readAt", resolved_at AS "resolvedAt", created_at AS "createdAt"
     FROM notification WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3\`,
    [userId, limit, offset]
  );
  return result.rows;
}

export async function countUnreadNotifications(userId: string) {
  const result = await pool.query<{ count: string }>(
    \`SELECT COUNT(*)::text AS count FROM notification
     WHERE user_id = $1 AND read_at IS NULL\`, [userId]
  );
  return Number(result.rows[0]?.count ?? 0);
}

export async function markNotificationAsRead(userId: string, id: string) {
  const result = await pool.query(
    \`UPDATE notification SET read_at = COALESCE(read_at, NOW())
     WHERE id = $1 AND user_id = $2\`, [id, userId]
  );
  return (result.rowCount ?? 0) > 0;
}

export async function markAllNotificationsAsRead(userId: string) {
  const result = await pool.query(
    \`UPDATE notification SET read_at = NOW()
     WHERE user_id = $1 AND read_at IS NULL\`, [userId]
  );
  return result.rowCount ?? 0;
}

export type CreateNotificationInput = {
  userId: string; siteId?: string | null; routerId?: string | null;
  type: string; severity: string; title: string; message: string; eventKey: string;
};

export async function insertNotification(data: CreateNotificationInput) {
  const result = await pool.query<NotificationRow>(
    \`INSERT INTO notification (
      user_id, site_id, router_id, type, severity, title, message, event_key
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
    ON CONFLICT (user_id, event_key) WHERE resolved_at IS NULL DO NOTHING
    RETURNING id, user_id AS "userId", site_id AS "siteId", router_id AS "routerId",
      type, severity, title, message, event_key AS "eventKey",
      read_at AS "readAt", resolved_at AS "resolvedAt", created_at AS "createdAt"\`,
    [data.userId, data.siteId ?? null, data.routerId ?? null, data.type,
     data.severity, data.title, data.message, data.eventKey]
  );
  return result.rows[0] ?? null;
}

export async function findUsersEligibleForNotification(
  organizationId: string, siteId: string | null, type: string
) {
  const columns: Record<string, string> = {
    NEW_SESSION: "new_session_enabled", NETWORK_PROBLEM: "network_problem_enabled",
    ROUTER_OFFLINE: "router_offline_enabled", ROUTER_ONLINE: "router_online_enabled",
    SYNC_ERROR: "sync_error_enabled",
  };
  const column = columns[type];
  if (!column) throw new Error(\`Type de notification inconnu: \${type}\`);

  const result = await pool.query<{ user_id: string }>(
    \`SELECT ns.user_id FROM notification_setting ns
     JOIN "user" u ON u.id = ns.user_id
     WHERE u.organization_id = $1 AND u.status = 'ACTIVE'
       AND ns.enabled = TRUE AND ns.\${column} = TRUE
       AND ($2::uuid IS NULL OR ns.all_sites = TRUE OR EXISTS (
         SELECT 1 FROM notification_setting_site nss
         WHERE nss.setting_id = ns.id AND nss.site_id = $2
       ))\`,
    [organizationId, siteId]
  );
  return result.rows.map(row => row.user_id);
}

export async function resolveActiveEvents(organizationId: string, eventKey: string) {
  const result = await pool.query(
    \`UPDATE notification n SET resolved_at = COALESCE(n.resolved_at, NOW())
     FROM "user" u WHERE n.user_id = u.id AND u.organization_id = $1
       AND n.event_key = $2 AND n.resolved_at IS NULL\`,
    [organizationId, eventKey]
  );
  return result.rowCount ?? 0;
}
