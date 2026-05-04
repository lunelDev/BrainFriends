# 시판 전 마지막 점검 체크리스트 v0.1

작성일: 2026-04-30
적용: 1차 SaMD 신청서 제출 + GMP 적합판정 신청 직전

## 1. 코드 산출물 체크

- [ ] `npm run test:vnv` → 49+/49+ PASS
- [ ] `npx tsc --noEmit` → exit 0 (`.next/dev/*` 제외)
- [ ] `npm run security:all` → SBOM + SOUP + audit + manifest 모두 산출
- [ ] Release manifest sha256 동결 (`docs/security/manifest/latest.json`)
- [ ] `analyzeChangeImpact` 결과 — major variation 발생 시 변경허가 사유 첨부
- [ ] CVE 면제 등록부 high 7건 status update (deferred-patch 적용 여부)

## 2. 규제 문서 체크

- [ ] `claim-lock.md` 최신 v 외부 자료와 cross-check
- [ ] `risk-management-file.md` v1.0 + 임상/사용성 결과 반영 (v1.x)
- [ ] `usability-evaluation-protocol.md` + 평가 결과 보고서
- [ ] `intended-use-and-contraindications.md` 사용목적 식약처 회신 반영
- [ ] `traceability-matrix.md` IEC 62304 별지 제2호 + V&V execution log
- [ ] `srs.md` / `sds.md` IEC 62304 양식
- [ ] `cve-exemptions.md` v 갱신
- [ ] 사용자 매뉴얼 3종 (치료사 / 환자 / 보호자)
- [ ] 변경허가 신청 SOP
- [ ] PMS / CAPA 절차서

## 3. 임상 / 사용성 증적 체크

- [ ] AI 성능평가 — 60~80대 30건 음성 → npm run ai-eval:wer 결과
- [ ] AI 성능평가 — RTF 측정 → npm run ai-eval:rtf 결과
- [ ] 사용성평가 — formative round 1~3 결과
- [ ] 사용성평가 — summative 15명 결과 + 합격기준 통과 증명
- [ ] 이상반응 보고 0건 (시판 전 테스트 기간)

## 4. 보안 체크

- [ ] 보안 침투 시험 (외부 위탁) 보고서
- [ ] OWASP Top 10 점검
- [ ] PHI 마스킹 production 적용 확인
- [ ] 접근통제 테스트 (admin / 담당 치료사 / 비담당 / 환자 / 보호자)
- [ ] HMAC 감사로그 체인 무결성 검증

## 5. 운영 체크

- [ ] DB 백업 정책
- [ ] 장애 대응 SOP
- [ ] 시판 후 감시 (PMS) 운영 인력 지정
- [ ] CAPA 의사결정자 지정
- [ ] 보호자 리포트 자동 발송 동작 확인
- [ ] 환자 데이터 보존기간 정책 적용

## 6. 의사결정 체크

- [ ] GMP/QMS 옵션 (A/B/C) 확정
- [ ] DTx 분류 동시 신청 vs 후속 결정
- [ ] 사용목적 1차 범위 식약처 회신 반영
- [ ] MCI 적응증 분리 시점 확정
- [ ] 시판 timing D-day 확정

## 7. 갱신 이력

- 2026-04-30 v0.1: 초안. 6 묶음 35 체크 항목.
