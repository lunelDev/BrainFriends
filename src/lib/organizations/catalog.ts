export type OrganizationCatalogEntry = {
  id: string;
  code: string;
  name: string;
  address: string;
};

export const ORGANIZATION_CATALOG: OrganizationCatalogEntry[] = [
  {
    id: "0f572cb5-6b64-47d7-bf83-1f85a0fda101",
    code: "BF-SEOUL-001",
    name: "브레인프렌즈 서울 재활의원",
    address: "서울특별시 강남구 테헤란로 100",
  },
  {
    id: "86d5a9fb-dac4-4afb-bf0a-4c98bd0aa102",
    code: "BF-BUNDANG-001",
    name: "브레인프렌즈 분당 언어재활센터",
    address: "경기도 성남시 분당구 황새울로 200",
  },
  {
    id: "4a4db55f-f264-4f7f-ae65-e45666b1a103",
    code: "BF-BUSAN-001",
    name: "브레인프렌즈 부산 재활병원",
    address: "부산광역시 해운대구 센텀중앙로 55",
  },
  {
    id: "d2d27f3f-91d2-41b7-b463-a8c84cf6a104",
    code: "BF-DAEJEON-001",
    name: "브레인프렌즈 대전 언어치료실",
    address: "대전광역시 서구 둔산로 88",
  },
];

export function getOrganizationCatalogEntry(organizationId: string) {
  return ORGANIZATION_CATALOG.find((item) => item.id === organizationId) ?? null;
}
