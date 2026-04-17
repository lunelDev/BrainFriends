# 시료 버전 고정 및 해시 생성 가이드

## 목적

공인성적서 시험 의뢰 전, 시험 대상 소프트웨어의 버전을 고정하고 무결성 증적(SHA-256 해시)을 생성하는 절차를 정의합니다.

시험기관은 자신들이 수령한 소프트웨어가 개발사가 제출한 버전과 동일함을 해시값으로 확인합니다.

---

## 1. 사전 확인

태그 생성 전 아래 조건을 모두 만족해야 합니다.

- [ ] `npm run test:vnv` 전체 PASS 확인
- [ ] `npx tsc --noEmit` 오류 0건 확인
- [ ] 미커밋 변경사항 없음 (`git status` 클린)
- [ ] `docs/remediation/01-sw-vnv/sw-vnv-current-test-report.md` 최신 상태 확인

---

## 2. Git 태그 생성 (로컬에서 실행)

```bash
# 현재 브랜치 상태 확인
git status

# 변경사항이 있으면 커밋 먼저
git add .
git commit -m "docs: finalize submission package for SaMD v1.0.0"

# 태그 생성 (버전명은 제출 시 결정)
git tag -a v1.0.0-samd-submission -m "SaMD 공인성적서 시험 의뢰용 제출 버전 v1.0.0"

# 태그 원격 푸시
git push origin v1.0.0-samd-submission
```

---

## 3. 소프트웨어 아카이브 생성 및 SHA-256 해시 추출 (로컬에서 실행)

```bash
# 태그 기준 소스 아카이브 생성 (node_modules 제외됨)
git archive --format=zip v1.0.0-samd-submission -o brainfriends-v1.0.0-samd.zip

# SHA-256 해시 생성
# Windows PowerShell:
Get-FileHash brainfriends-v1.0.0-samd.zip -Algorithm SHA256

# macOS / Linux:
sha256sum brainfriends-v1.0.0-samd.zip
```

---

## 4. 해시값 기록

아래 표에 생성된 해시값을 기록하고 시험기관에 함께 전달합니다.

| 항목 | 내용 |
| --- | --- |
| 제품명 | BrainFriends |
| 제출 버전 | v1.0.0-samd-submission |
| Git 커밋 해시 | _(태그 생성 후 `git rev-parse v1.0.0-samd-submission` 결과 기입)_ |
| 아카이브 파일명 | brainfriends-v1.0.0-samd.zip |
| SHA-256 해시 | _(위 명령 실행 결과 기입)_ |
| 생성 일자 | _(기입)_ |
| 생성자 | _(기입)_ |

---

## 5. 시험기관 수령 확인 절차

시험기관이 아카이브를 수령하면 동일한 명령으로 해시를 재계산하여 위 표의 값과 일치하는지 확인합니다. 불일치 시 파일 재전달이 필요합니다.

---

## 관련 문서

- [SW V&V 시험 계획서](../01-sw-vnv/sw-vnv-test-plan.md)
- [시험 환경 설명서](./submission-test-environment.md)
- [시험용 DB 초기 스크립트](../../database/brainfriends_test_init.sql) _(별도 관리)_
