# 시험 환경 설명서

## 문서 정보

| 항목 | 내용 |
| --- | --- |
| 제품명 | BrainFriends |
| 문서 유형 | 시험 환경 설명서 |
| 버전 | 1.0 |
| 작성일 | 2026-04-17 |

---

## 1. 제품 개요

BrainFriends는 웹 브라우저에서 동작하는 언어재활 지원 소프트웨어입니다. 별도 설치 없이 URL 접속만으로 사용하며, 카메라와 마이크를 통해 사용자의 발화 및 안면 데이터를 수집합니다.

---

## 2. 시험 접속 방법

### 방법 A: 스테이징 서버 접속 (기본 권장)

시험기관에 별도 전달하는 접속 정보를 사용합니다.

| 항목 | 내용 |
| --- | --- |
| 접속 URL | _(시험기관 전달 시 기입)_ |
| 프로토콜 | HTTPS |
| 접속 방법 | 브라우저에서 URL 직접 입력 |

### 방법 B: 로컬 실행 (시험기관 자체 환경 구동 시)

```bash
# 1. 의존성 설치
npm install

# 2. 환경 변수 설정 (.env.local 파일 생성)
cp .env.example .env.local
# DATABASE_URL 등 항목 기입 (별도 전달 문서 참조)

# 3. DB 초기화
psql -U postgres -d brainfriends_test -f docs/database/brainfriends_dev.sql
psql -U postgres -d brainfriends_test -f docs/database/brainfriends_test_init.sql

# 4. 서버 실행
npm run build
npm start
# 또는 개발 모드: npm run dev

# 5. 브라우저에서 접속
# http://localhost:3000
```

---

## 3. 지원 브라우저

| 브라우저 | 권장 버전 | 비고 |
| --- | --- | --- |
| **Google Chrome** | 최신 버전 (권장) | 카메라/마이크 권한 허용 필요 |
| Microsoft Edge | 최신 버전 | Chromium 기반, Chrome과 동일 |
| Mozilla Firefox | 최신 버전 | 지원됨 |
| Safari | 16 이상 | macOS 환경에서 지원 |

> **주의:** Internet Explorer는 지원하지 않습니다.

---

## 4. 필수 하드웨어

| 항목 | 최소 기준 | 권장 |
| --- | --- | --- |
| 카메라 | 해상도 720p 이상, 15fps 이상 | 1080p, 30fps |
| 마이크 | 단일 지향성 마이크 | 헤드셋 마이크 |
| 조도 | 얼굴 정면 300lux 이상 | 500lux 이상 균일 조명 |
| 화면 해상도 | 1280×720 이상 | 1920×1080 |
| 인터넷 연결 | 10Mbps 이상 | 스테이징 서버 접속 시 필요 |

---

## 5. 브라우저 권한 설정

BrainFriends는 카메라와 마이크 접근 권한이 필요합니다. 시험 시작 전 아래를 확인합니다.

1. 브라우저 주소창 왼쪽 자물쇠 아이콘 클릭
2. 카메라: **허용** 설정 확인
3. 마이크: **허용** 설정 확인
4. 권한 거부 상태에서는 시험 진입이 차단됩니다 (`TC-PERM-001` 검증 항목)

---

## 6. 시험 계정 정보

아래 계정은 `docs/database/brainfriends_test_init.sql` 스크립트로 생성됩니다.

| 역할 | 로그인 ID | 비밀번호 | 용도 |
| --- | --- | --- | --- |
| 관리자 | `test-admin` | `Test1234!` | V&V export, 시스템 관리 기능 시험 |
| 치료사 | `test-therapist` | `Test1234!` | 치료사 화면, 결과 조회, AI 평가 export 시험 |
| 환자 1 | `test-patient-01` | `Test1234!` | 자가진단(self-assessment) 훈련 흐름 시험 |
| 환자 2 | `test-patient-02` | `Test1234!` | 언어재활(speech-rehab) 훈련 흐름 시험 |

---

## 7. 주요 시험 경로

| 화면 | URL 경로 | 접속 계정 |
| --- | --- | --- |
| 로그인 | `/` | 전체 |
| 훈련 모드 선택 | `/select-page/mode` | 환자 |
| 자가진단 시험 선택 | `/select-page/self-assessment` | 환자 |
| 언어재활 훈련 선택 | `/select-page/speech-rehab` | 환자 |
| Step 1~6 훈련 | `/programs/step-1` ~ `/programs/step-6` | 환자 |
| 훈련 결과 | `/result-page/self-assessment` | 환자 |
| 치료사 대시보드 | `/therapist` | 치료사/관리자 |
| 환자 목록 | `/therapist/patients` | 치료사/관리자 |
| V&V export | `/therapist/system` | 관리자 |
| AI 평가 모니터링 | `/therapist/system/evaluation` | 관리자 |

---

## 8. SW V&V 결정론적 시험 실행

시험기관이 자체 환경에서 SW V&V 시험을 실행하는 경우 아래 명령을 사용합니다.

```bash
# 기본 실행 (콘솔 출력)
npm run test:vnv

# 날짜별 로그 저장 (증적 생성)
npm run test:vnv:record

# 타입 검증
npx tsc --noEmit
```

실행 결과는 `docs/remediation/test-runs/<YYYY-MM-DD>/` 폴더에 JSON 형식으로 저장됩니다.

---

## 9. 소프트웨어 버전 확인 방법

시험기관은 아래 방법으로 수령한 소프트웨어 버전을 확인할 수 있습니다.

```bash
# Git 태그 확인
git tag --list

# 현재 커밋 해시 확인
git rev-parse HEAD

# 아카이브 SHA-256 해시 재계산 (수령한 .zip 파일 기준)
# Windows PowerShell:
Get-FileHash brainfriends-v1.0.0-samd.zip -Algorithm SHA256

# macOS / Linux:
sha256sum brainfriends-v1.0.0-samd.zip
```

계산된 해시값은 개발사가 전달한 [버전 고정 및 해시 기록서](./submission-version-guide.md)의 값과 일치해야 합니다.

---

## 10. 문의 및 지원

시험 환경 구성 중 문제가 발생하면 아래 창구로 문의합니다.

| 항목 | 내용 |
| --- | --- |
| 담당자 | _(기입)_ |
| 이메일 | _(기입)_ |
| 연락처 | _(기입)_ |

---

## 관련 문서

- [SW V&V 시험 계획서](../01-sw-vnv/sw-vnv-test-plan.md)
- [버전 고정 및 해시 생성 가이드](./submission-version-guide.md)
- [시험용 DB 초기화 스크립트](../../database/brainfriends_test_init.sql)
- [시험기관 사전 문의 요약본](./test-lab-inquiry-one-pager.md)
