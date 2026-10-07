import api from "./api";

export interface SiteProfilePrice {
  code: string;
  name: string;
  durationSeconds: number | null;
  price: number;
  currency: string;
  defaultPrice: number;
}

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  message?: string;
  count?: number;
}

export async function getSiteProfilePrices(
  siteId: string
): Promise<SiteProfilePrice[]> {
  const response = await api.get<
    ApiEnvelope<SiteProfilePrice[]>
  >("/api/plans/site-prices", {
    params: { siteId },
  });

  return response.data.data;
}

export async function updateSiteProfilePrice(
  siteId: string,
  profileCode: string,
  price: number
): Promise<SiteProfilePrice> {
  const response = await api.put<
    ApiEnvelope<SiteProfilePrice>
  >("/api/plans/site-prices", {
    siteId,
    profileCode,
    price,
  });

  return response.data.data;
}
