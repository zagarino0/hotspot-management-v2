import { RouterOSAPI } from "node-routeros";
import { env } from "../config/env.js";
import { AppError } from "../lib/errors.js";

export type MikroTikProtocol = "api" | "api-ssl";
type RouterOSTlsOptions = NonNullable<ConstructorParameters<typeof RouterOSAPI>[0]["tls"]>;
export type MikroTikNetworkMode = "direct" | "vpn";

export interface MikroTikConnectionConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  /** Optional explicit protocol. Otherwise 8729 selects API-SSL; other ports select API. */
  protocol?: MikroTikProtocol;
  /** Optional TLS overrides for private PKI deployments. Never disable verification in production. */
  tls?: RouterOSTlsOptions;
}

export function resolveMikroTikProtocol(config: Pick<MikroTikConnectionConfig, "port" | "protocol">): MikroTikProtocol {
  if (config.protocol) return config.protocol;
  return config.port === 8729 ? "api-ssl" : "api";
}

export function resolveMikroTikTlsOptions(
  config: Pick<MikroTikConnectionConfig, "host" | "port" | "protocol" | "tls">
): RouterOSTlsOptions | undefined {
  if (resolveMikroTikProtocol(config) !== "api-ssl") return undefined;
  return {
    servername: config.host,
    ...config.tls,
    rejectUnauthorized: true,
  };
}

/**
 * Network routing is deliberately external to this module.
 * In "vpn" mode, host:port must be reachable through a VPN route or a
 * TCP gateway configured for this specific router. This module never
 * assumes that RFC1918 addresses are reachable from Render.
 */
function getNetworkMode(): MikroTikNetworkMode {
  const value = (process.env.MIKROTIK_NETWORK_MODE ?? "direct").toLowerCase();
  if (value !== "direct" && value !== "vpn") {
    throw new Error("MIKROTIK_NETWORK_MODE doit être 'direct' ou 'vpn'.");
  }
  return value;
}

function getDefaultConfig(): MikroTikConnectionConfig {
  if (!env.mikrotik.host) throw new Error("MIKROTIK_HOST n'est pas configuré.");
  if (!env.mikrotik.user) throw new Error("MIKROTIK_USER n'est pas configuré.");
  if (!env.mikrotik.password) throw new Error("MIKROTIK_PASSWORD n'est pas configuré.");

  return {
    host: env.mikrotik.host,
    port: env.mikrotik.port || 8728,
    user: env.mikrotik.user,
    password: env.mikrotik.password,
  };
}

export async function connectMikroTik(config: MikroTikConnectionConfig): Promise<RouterOSAPI> {
  const protocol = resolveMikroTikProtocol(config);
  const networkMode = getNetworkMode();
  const tls = resolveMikroTikTlsOptions(config);

  const api = new RouterOSAPI({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    timeout: 10,
    ...(tls ? { tls } : {}),
  });

  api.on("error", (error: Error) => {
    console.error(`[mikrotik] ${protocol} asynchronous error ${config.host}:${config.port}: ${error.message}`);
  });

  try {
    await api.connect();
    return api;
  } catch (error) {
    try {
      await Promise.resolve(api.close());
    } catch {
      // The socket may already be closed after a connection failure.
    }

    const detail = error instanceof Error ? error.message : String(error);
    console.error(`[mikrotik] ${protocol} connection failed (${networkMode}) for ${config.host}:${config.port}: ${detail}`);

    const detailLower = detail.toLowerCase();
    let message = "Connexion MikroTik impossible. Vérifiez l’adresse, le port, le pare-feu et la connectivité réseau.";
    if (protocol === "api-ssl" && /cert|tls|ssl|handshake|self.signed|unable to verify/i.test(detailLower)) {
      message = "Échec TLS API-SSL. Vérifiez le certificat, son nom DNS et sa chaîne de confiance.";
    } else if (/login|password|user|auth/i.test(detailLower)) {
      message = "Authentification MikroTik refusée. Vérifiez le compte et ses permissions.";
    } else {
      message += networkMode === "vpn"
        ? " En mode VPN, vérifiez que le tunnel et la route vers ce routeur sont actifs."
        : " Si l’adresse est privée, Render doit disposer d’une route VPN ou d’une passerelle TCP sécurisée.";
    }

    throw new AppError(message, 502);
  }
}

export async function connectDefaultMikroTik(): Promise<RouterOSAPI> {
  return connectMikroTik(getDefaultConfig());
}
