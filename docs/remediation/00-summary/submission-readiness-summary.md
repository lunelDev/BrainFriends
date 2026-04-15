# BrainFriends 공인성적서 대응 준비 현황

## 목적

이 폴더는 BrainFriends의 공인성적서 대응 구조를 정리한 현재 상태를 기록합니다.  
UI/UX 고도화보다 먼저 SW V&V, 사이버보안, AI 성능평가 대응 구조를 고정하는 것을 목표로 합니다.

현재 정리 순서는 다음과 같습니다.

1. SW V&V
2. 사이버보안
3. AI 성능평가

## 현재 확보된 실행 근거

### SW V&V

- `SessionManager`를 중심으로 실행 시점 추적성이 연결되어 있습니다.
- 치료사 시스템에서 V&V export를 내려받을 수 있습니다.
- `npm run test:vnv`로 deterministic check를 실행할 수 있습니다.
- `npm run test:vnv:record`로 날짜별 실행 로그를 저장할 수 있습니다.
- 현재 운영본 결과서는 `docs/remediation/01-sw-vnv/sw-vnv-current-test-report.md`에 정리되어 있습니다.

### 사이버보안

- 고위험 step 원시 데이터는 더 이상 브라우저 `localStorage`에 장기 저장하지 않습니다.
- step review payload는 `src/lib/security/transientStepStorage.ts`를 통해 세션 범위로만 유지합니다.
- 차단된 브라우저 쓰기 시도는 `src/app/api/security-audit/route.ts`를 통해 기록됩니다.
- 현재 최종 고정 상태는 `docs/remediation/02-cybersecurity/cybersecurity-final-readiness-report.md`에 정리되어 있습니다.

### AI 성능평가

- measured-only 샘플 수집 구조가 동작 중입니다.
- `src/lib/server/evaluationSamplesDb.ts` 기준으로 DB 우선 저장이 구현되어 있습니다.
- 치료사 시스템 화면 `/therapist/system`, `/therapist/system/evaluation`에서 운영 모니터링이 가능합니다.
- 제출형 export 경로 `/api/therapist/system/ai-evaluation-export`가 추가되었습니다.
- 현재 운영본 보고서는 `docs/remediation/03-ai-evaluation/ai-evaluation-current-report.md`에 정리되어 있습니다.

## 제출용 참고 문서

- [SW V&V 개요](C:/Users/pc/Desktop/ProjectFiles/BrainFriends/docs/remediation/01-sw-vnv/sw-vnv-submission-outline.md)
- [시험기관 사전 문의 1페이지 요약본](C:/Users/pc/Desktop/ProjectFiles/BrainFriends/docs/remediation/00-summary/test-lab-inquiry-one-pager.md)
- [SaMD 준비 부족 항목 체크리스트](C:/Users/pc/Desktop/ProjectFiles/BrainFriends/docs/remediation/00-summary/samd-gap-checklist.md)
- [SaMD 관련 문서 경로 정리](C:/Users/pc/Desktop/ProjectFiles/BrainFriends/docs/remediation/00-summary/samd-document-paths.md)
- [사이버보안 저장 현황](C:/Users/pc/Desktop/ProjectFiles/BrainFriends/docs/remediation/02-cybersecurity/cybersecurity-storage-inventory.md)
- [사이버보안 최종 고정 보고서](C:/Users/pc/Desktop/ProjectFiles/BrainFriends/docs/remediation/02-cybersecurity/cybersecurity-final-readiness-report.md)
- [AI 성능평가 개요](C:/Users/pc/Desktop/ProjectFiles/BrainFriends/docs/remediation/03-ai-evaluation/ai-evaluation-submission-outline.md)
- [AI 성능평가 현재 운영본 보고서](C:/Users/pc/Desktop/ProjectFiles/BrainFriends/docs/remediation/03-ai-evaluation/ai-evaluation-current-report.md)
- [브라우저 / 서버 저장 항목표](C:/Users/pc/Desktop/ProjectFiles/BrainFriends/docs/remediation/02-cybersecurity/browser-server-storage-matrix.md)
- [사이버보안 정책 결정서](C:/Users/pc/Desktop/ProjectFiles/BrainFriends/docs/remediation/02-cybersecurity/cybersecurity-policy-decisions.md)
- [민감정보 분류표](C:/Users/pc/Desktop/ProjectFiles/BrainFriends/docs/remediation/02-cybersecurity/sensitive-data-classification.md)
- [SW V&V 시험 결과서 템플릿](C:/Users/pc/Desktop/ProjectFiles/BrainFriends/docs/remediation/01-sw-vnv/sw-vnv-test-report-template.md)
- [SW V&V 결함 / 재시험 기록서](C:/Users/pc/Desktop/ProjectFiles/BrainFriends/docs/remediation/01-sw-vnv/sw-vnv-defect-retest-log.md)
- [SW V&V 실행 로그 정책](C:/Users/pc/Desktop/ProjectFiles/BrainFriends/docs/remediation/01-sw-vnv/sw-vnv-execution-log-policy.md)
- [AI 평가 데이터셋 정의서](C:/Users/pc/Desktop/ProjectFiles/BrainFriends/docs/remediation/03-ai-evaluation/ai-evaluation-dataset-definition.md)
- [AI 오류 사례 기록서](C:/Users/pc/Desktop/ProjectFiles/BrainFriends/docs/remediation/03-ai-evaluation/ai-evaluation-error-case-log.md)

## 검증 명령

```bash
npx tsc --noEmit
npm run test:vnv
npm run test:vnv:record
```

## 남은 후속 작업

- V&V export JSON을 실제 시험기관 제출 형식에 맞춰 다시 정리
- legacy local fallback 경로를 마이그레이션 완료 후 제거
- remediation 구조가 내부적으로 승인되면 사용자/치료사 UI 정리 재개
