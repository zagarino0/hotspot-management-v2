import type { Organization } from "../organization/organization.types";
import type { Site } from "../site/site.types";
import type { Router } from "../router/router.types";
import type { AccessPoint } from "../access-point/accessPoint.types";
import type { AccessPointRadio } from "../access-point/apRadio.types";

export interface OrganizationDetails
  extends Organization {
  sites: Site[];
}

export interface SiteDetails
  extends Site {
  routers: Router[];
  accessPoints: AccessPoint[];
}

export interface AccessPointDetails
  extends AccessPoint {
  radios: AccessPointRadio[];
}

export interface RouterDetails
  extends Router {
  accessPoints: AccessPoint[];
}