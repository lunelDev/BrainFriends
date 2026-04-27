# BrainFriends 보안 산출물

식약처 사이버보안 가이드라인 / IEC 81001-5-1 대응을 위한 정기 산출물 보관 디렉토리.

## 디렉토리 구조

```
docs/security/
├── sbom/      — CycloneDX 1.5 SBOM (npm run security:sbom)
└── audit/     — npm audit 결과 (npm run security:audit)
```

각 디렉토리에는 `latest.json` (가장 최근) 과 `*-YYYYMMDDHHmmss.json` (이력) 가 함께 보존된다.

## 실행 방법

```sh
# SBOM 만 생성
npm run security:sbom

# 의존성 취약점 점검 (critical/high 발견 시 EXIT 1)
npm run security:audit

# 둘 다 한 번에
npm run security:all
```

## CI 게이트 권장 설정

main / release 브랜치 머지 게이트로 다음을 권장한다.

- `npm ci`
- `npm run security:audit`  (high 이상 차단)
- `npm run security:sbom`
- 산출물(sbom + audit json) 을 빌드 아티팩트로 업로드

## 정책 — npm audit 차단 레벨

기본값은 `high` 이상 차단. 환경변수로 조정:

```sh
AUDIT_FAIL_LEVEL=critical npm run security:audit  # critical 만 차단
AUDIT_FAIL_LEVEL=moderate npm run security:audit  # moderate 까지 차단
```

운영 진입 직전에는 `critical` 로 완화하여 비차단 의존성은 분기 ticket 으로 트래킹.

## 시판 후 관리

GMP 사후관리 절차서 기준 **분기별 1회 SBOM 재생성 + 취약점 평가** 가 요구된다.
스케줄 잡 (cron 또는 GitHub Actions schedule) 으로 자동화 권장.
