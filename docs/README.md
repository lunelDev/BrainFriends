# BrainFriends Docs

문서 기준은 `docs/regulatory/permit-readiness-internal-standard.md` 하나를 먼저 본다.

## 현재 기준 문서

| 문서 | 용도 |
| --- | --- |
| `regulatory/permit-readiness-internal-standard.md` | 허가 준비 내부 기준서. 현재 제품 포지션, 부족 항목, 개발 우선순위를 한곳에서 확인 |
| `regulatory/regulatory-master-map.md` | 분류·등급 → 제24~26조 → GMP/QMS → 개발 증빙 흐름 |
| `regulatory/regulatory-work-log.md` | 원문 검토와 문서 정리 작업 이력 |
| `regulatory/README.md` | 규제/허가 문서 인덱스 |
| `development-progress.md` | 날짜별 개발 진행 상황과 검증·후속 작업 기록 |

## 남긴 폴더

| 폴더 | 유지 이유 |
| --- | --- |
| `regulatory/` | 현재 허가·심사·품질·AI·보안 기준 문서 |
| `clinical/` | 향후 임상/IRB/문헌 근거 초안 |
| `10-operations/` | 운영, 백업, 감사로그, 개인정보 관련 메모 |
| `manuals/` | 환자/치료사/보호자 매뉴얼 초안 |
| `database/` | DB 스키마와 개발 SQL |
| `security/` | SBOM/SOUP/보안 감사 산출물 |
| `11-game-mode/`, `12-game-specs/` | 게임형 훈련 기획·구현 참고 |
| `13-reference/` | 조음·발음 참고 이미지 |
| `decisions/` | 과거 주요 기술·제품 의사결정 기록 |

## 삭제한 폴더 기준

다음 성격의 문서는 현재 기준과 중복되거나 충돌 가능성이 있어 정리했다.

- 예전 시험기관/KTL 문의 패키지
- 예전 remediation 제출 패키지
- 상담 준비용 문서
- WASM-STT 전용 공인시험 문서
- 프로젝트 허가 기준과 직접 관련 없는 루트 DOCX

새 문서를 만들 때는 먼저 `regulatory/permit-readiness-internal-standard.md`에 반영할 내용인지 확인한다.
