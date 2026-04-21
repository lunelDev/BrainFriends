export type OrganizationCatalogEntry = {
  id: string;
  code: string;
  name: string;
  address: string;
};

export const ORGANIZATION_CATALOG: OrganizationCatalogEntry[] = [];

export function getOrganizationCatalogEntry(organizationId: string) {
  return ORGANIZATION_CATALOG.find((item) => item.id === organizationId) ?? null;
}
