/**
 * 신규 통일 스키마 리포지토리 배럴.
 *
 * 이 디렉터리의 모든 export 는 기능 플래그 `USE_NEW_USERS_SCHEMA` 가
 * 켜져 있을 때 이중 쓰기에만 사용된다. 레거시 읽기 경로와 섞지 말 것.
 */
export * from "./usersDb";
export * from "./userPiiProfileDb";
export * from "./therapistProfilesDb";
export * from "./institutionsDb";
export * from "./institutionMembersDb";
export * from "./userTherapistMappingsDb";
export * from "./clinicalPatientProfilesDb";
export * from "./pseudonymLinkDb";
