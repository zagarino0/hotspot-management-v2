import { env } from "../config/env.js";

/* ============================================================
   TYPES
============================================================ */

export interface RouterOSRestConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  useSSL?: boolean;
}

export interface RouterOSRestResponse<T = any> {
  data?: T;
  error?: string;
  detail?: string;
}

/* ============================================================
   HTTP AUTHORIZATION
============================================================ */

function getBasicAuthHeader(username: string, password: string): string {
  const credentials = `${username}:${password}`;
  return `Basic ${Buffer.from(credentials).toString('base64')}`;
}

/* ============================================================
   GENERIC REST API CALL
============================================================ */

async function restApiCall<T = any>(
  config: RouterOSRestConfig,
  path: string,
  method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE" = "GET",
  body?: any
): Promise<RouterOSRestResponse<T>> {
  const protocol = config.useSSL ? "https" : "http";
  const url = `${protocol}://${config.host}:${config.port}/rest${path}`;

  const headers: Record<string, string> = {
    "Authorization": getBasicAuthHeader(config.username, config.password),
    "Content-Type": "application/json",
  };

  const options: RequestInit = {
    method,
    headers,
  };

  if (body !== undefined) {
    options.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(url, options);

    if (!response.ok) {
      const errorText = await response.text();
      return {
        error: `HTTP ${response.status}: ${errorText}`,
      };
    }

    const data = await response.json();
    return { data };
  } catch (error: any) {
    return {
      error: error.message || "Connection failed",
    };
  }
}

/* ============================================================
   SYSTEM INFO
============================================================ */

export async function getSystemInfo(
  config: RouterOSRestConfig
): Promise<RouterOSRestResponse> {
  return restApiCall(config, "/system/resource");
}

export async function getIdentity(
  config: RouterOSRestConfig
): Promise<RouterOSRestResponse> {
  return restApiCall(config, "/system/identity");
}

/* ============================================================
   HOTSPOT USERS
============================================================ */

export async function getHotspotUsers(
  config: RouterOSRestConfig
): Promise<RouterOSRestResponse> {
  return restApiCall(config, "/ip/hotspot/active");
}

export async function getHotspotUsersTotal(
  config: RouterOSRestConfig
): Promise<RouterOSRestResponse> {
  return restApiCall(config, "/ip/hotspot/user");
}

/* ============================================================
   INTERFACES
============================================================ */

export async function getInterfaces(
  config: RouterOSRestConfig
): Promise<RouterOSRestResponse> {
  return restApiCall(config, "/interface");
}

/* ============================================================
   TRAFFIC MONITORING
============================================================ */

export async function getInterfaceTraffic(
  config: RouterOSRestConfig,
  interfaceName: string
): Promise<RouterOSRestResponse> {
  return restApiCall(config, `/interface/${interfaceName}/traffic`);
}

/* ============================================================
   CONNECTION TEST
============================================================ */

export async function testRouterRestConnection(
  config: RouterOSRestConfig
): Promise<{ success: boolean; identity?: string; model?: string; routerOsVersion?: string; error?: string }> {
  try {
    // Test 1: Get identity
    const identityResult = await getIdentity(config);
    if (identityResult.error) {
      return { success: false, error: identityResult.error };
    }

    const identity = identityResult.data?.name || "Unknown";

    // Test 2: Get system info for model
    const systemResult = await getSystemInfo(config);
    if (systemResult.error) {
      return { success: true, identity, error: systemResult.error };
    }

    const boardName = systemResult.data?.[0]?.["board-name"];
    const version = systemResult.data?.[0]?.["version"];

    return {
      success: true,
      identity,
      model: boardName,
      routerOsVersion: version,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || "Connection failed",
    };
  }
}
