/**
 * BrainFriends 서버 측 기능 플래그
 *
 * 목적
 *   - 신규 통일 스키마(users / therapist_profiles / institutions 등)로의 이중 쓰기를
 *     단계적으로 켜고 끄기 위한 단일 진입점.
 *   - 기본값은 항상 "안전한 쪽" (= 기존 동작 유지). 프로덕션 경로는 플래그를 켜지 않는 한
 *     절대 새 테이블에 쓰지 않는다.
 *
 * 롤백 방법
 *   - 어떤 단계에서든 문제가 감지되면 해당 env 값을 false(또는 미설정)로 되돌리고
 *     서버를 재시작한다. 자세한 절차는
 *     docs/decisions/2026-04-21-rollback-playbook.md 참조.
 *
 * 환경 변수
 *   USE_NEW_USERS_SCHEMA
 *     - true 일 때 회원가입/승인 경로에서 신규 users 테이블에 이중 쓰기 수행
 *     - false (기본) 일 때 기존 app_users / patient_pii / organizations 경로만 동작
 *
 *   USE_NEW_USERS_SCHEMA_STRICT
 *     - true 일 때 이중 쓰기 실패 시 전체 트랜잭션을 실패시킨다 (마이그 후기 단계용)
 *     - false (기본) 일 때 이중 쓰기 실패를 로깅만 하고 레거시 경로 결과를 유지 (초기 단계용)
 *
 * 사용 예
 *   import { featureFlags } from "@/lib/server/featureFlags";
 *   if (featureFlags.useNewUsersSchema) {
 *     try { await mirrorToNewSchema(...); }
 *     catch (err) {
 *       if (featureFlags.useNewUsersSchemaStrict) throw err;
 *       console.error("[dual-write] mirror failed (non-fatal):", err);
 *     }
 *   }
 */

function readBool(name: string, defaultValue = false): boolean {
  const raw = process.env[name];
  if (raw === undefined || raw === null || raw === "") return defaultValue;
  const normalized = raw.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return defaultValue;
}

export const featureFlags = {
  /**
   * 신규 통일 스키마(users 외 6개)에 이중 쓰기 여부.
   * 기본 false — 이 플래그가 꺼져 있는 한 운영 경로는 기존 테이블만 사용한다.
   */
  get useNewUsersSchema(): boolean {
    return readBool("USE_NEW_USERS_SCHEMA", false);
  },

  /**
   * 이중 쓰기 실패를 치명적 오류로 취급할지 여부.
   * 초기 단계에서는 false (실패해도 레거시 결과는 지킴), 완전 전환 직전에만 true.
   */
  get useNewUsersSchemaStrict(): boolean {
    return readBool("USE_NEW_USERS_SCHEMA_STRICT", false);
  },
};

/** 부팅 시 현재 플래그 상태를 한 줄 로깅 (디버깅 편의용) */
export function logFeatureFlagsOnce(): void {
  if ((globalThis as { __bfFlagsLogged?: boolean }).__bfFlagsLogged) return;
  (globalThis as { __bfFlagsLogged?: boolean }).__bfFlagsLogged = true;
  console.log(
    `[featureFlags] useNewUsersSchema=${featureFlags.useNewUsersSchema} ` +
      `useNewUsersSchemaStrict=${featureFlags.useNewUsersSchemaStrict}`,
  );
}
