# 브레인톡톡 / 브레인프렌즈 / GOLDEN — 일자별 주간 리포트

기간: **2026-02-25 ~ 2026-05-13**
작성: 2026-05-13

각 일자별 핵심 작업과 검증·후속을 이미지 형식(파일 경로/모듈 + 신규/수정 + 검증 + 후속)에 맞춰 압축 정리했습니다.

- 2026-05-08: AAC 보조 채널(/select-page/aac) 추가 + AAC 퀵 스트립/TTS + XR 라이브러리 리디자인 + 노래 훈련 점수 v3(참여율/타이밍/안정도/동시성) 반영
- 2026-05-07: 반복훈련 step1/4/5 안정화 + 노래훈련 증적 ZIP 내보내기 + XR 프리뷰 라우트(/select-page/xr) + 인허가 소스 감사표/인덱스 정리
- 2026-05-06: Report 리팩터링(/report→/mypage) + Step2 점수/복원 안정화 + WASM STT 로컬 자산화(실험 플래그) + IRT evidence export
- 2026-05-11: 회원가입 연락처 입력 포맷(10/11자리) 보정 + 개발 기록 문서 정리
- 2026-05-13: preview 7개

---

## 2026-02-25: 브레인톡톡 step2~5 녹음/난이도/UX 정비

- src/lib/text/displayText.ts 신규 — 문장부호 뒤 자동 줄바꿈, 글자 길이별 반응형 사이즈 클래스, 단어 단위 줄바꿈 판정 함수
- src/lib/speech/SpeechAnalyzer.ts 수정 — 자음/모음 정확도(consonantAccuracy, vowelAccuracy) 필드 추가, AudioRecorder 구조 정비
- step2 녹음 및 진행 방식 수정 — "321 → 듣고 따라 말하세요 → 321 → 자동 녹음 시작" 흐름으로 통일
- step2 난이도 점진 상승 적용, step3 정답 위치 랜덤화
- step4 장면 힌트 직접 노출 제거, 힌트보기 버튼으로 분리
- 검증: https://brain-talk-talk.vercel.app/ 배포 환경에서 step2~4 흐름 확인
- 후속: step별 결과 디테일 정의, 결과 리포트 디자인 통일

## 2026-02-26: 홈 가드/리팩터링/step6 분리

- src/lib/trainingExitProgress.ts 신규 — place별 currentStep/completedThroughStep 로컬 저장 유틸
- 홈 버튼 클릭 시 "정말 나가시겠습니까" 재확인 팝업 추가
- 폰트 사이즈 전체 재조정, step4 UI 튕김 수정 및 TTS 용어 명칭 정비(장소·내용 힌트 최소화)
- step5 일기 시간/속도 계산 로직 수정
- step6 힌트보기/따라쓰기 분리, 이모지 → 사진 교체
- step 공통 버튼 클래스 유틸로 리팩터링
- 검증: 배포 환경에서 step1~6 전체 회귀 확인
- 후속: 결과/리포트 디자인 일관화

## 2026-03-04: 재활 훈련 선택 / 리포트 분할 작업

- src/app/(training)/mode-select/page.tsx 신규 — 자가진단/언어재활 2카드 모드 선택 화면
- 언어재활 결과 리포트 step별 세부항목 분리, 수행기록 상세를 step별로 다르게 표시
- 언어재활 반복훈련에서 리포트보기 → 언어재활 토글 기본 선택, 홈버튼 → 언어재활로 복귀
- 재활 리포트 디자인을 결과 화면 디자인과 동일하게 정렬
- 검증: 모드 선택 → 자가진단/언어재활 이미지 노출 확인
- 후속: 결과/리포트 디자인 통일 정교화

## 2026-03-05: 자가진단 리포트 디자인 통일 / 데이터 백업 ZIP

- 발병일·경과일을 설정일 기준 1일부터 시작하도록 수정
- 자가진단 종합 평가 결과 페이지를 언어재활 결과 페이지와 동일한 디자인으로 정렬
- 데이터 백업 버튼 → "생년월일-이름-검사일시.zip" 형식으로 저장
- 전문가 임상 소견에서 AQ 표현 최소화, 부족 영역 중심 서술로 변경
- 안면 인식 카메라 녹화는 단말 사양/용량 부담으로 보류 결정
- 후속: 자가진단 사진 비교, 안면 비대칭 정밀 분석 디테일

## 2026-03-06: 점수 산출 식 전면 재정의 + 대형 페이지 리팩터링

- src/lib/scoring/* 수정 — step별 점수 산출 식 정식화
  - step1/3: 정확도×0.8 + 속도가점×0.2 (6초 이내 가점)
  - step2: (자음 정확도 + 모음 정확도) / 2
  - step4: 내용 0.40 + 유창성 0.35 + 명료도 0.15 + 시작반응 0.10, 구간 라벨(85+/70~84/55~69/<55)
  - step5: readingScore = 정확도45% + 완독도25% + 명료도20% + 유창성10%, ≥70이면 정답
  - step6: writingScore = strokeScore×0.65 + shapeSimilarity×0.35
- 8개 대형 페이지 리팩터링: 9,627 → 8,142줄 (-15.4%)
- "반복훈련" 훈련 세부 항목 정리, step2 정답 매칭/정확도 점수화로 변경
- 후속: 자가진단 사진 비교, AI 정밀 분석 결과 디테일 보강

## 2026-03-09: LISTENING UI 단순화 / 결과 복구

- 카운트다운 상태/타이머 로직 제거 — 상단 표시를 LISTENING.../ANSWER READY로 단순화
- 오디오 생성 실패 대비 — 저장 오류 시 재녹음 안내, 새로고침 시 단계별 저장키 기반 누적 결과 복구
- 점수 산출식(3/6) 재확인 및 step1~6 정합성 점검
- 후속: 반응형(step2 카메라/step4 결과창/step5 카메라/step6 따라쓰기) 보정, 매뉴얼 스토리보드, 노래방 섹션, 자가진단 리포트 출력

## 2026-03-10: 브레인노래방 섹션 신설 / KPI 충족 정비

- mode-select 메인에 "브레인 노래방" 섹션 추가
- 노래방 → 곡 선택 select 페이지 신설
- 곡 라인업 정의: Lv1(나비야, 둥글게 둥글게) / Lv2(아리랑, 도라지 타령) / Lv3(군밤타령, 밀양아리랑) — 저작권 안전곡 우선
- 폴더/파일 명명 정리, KPI 충족 여부 판정 로직 손봄
- 후속: 반응형 보정, 자가진단 리포트 출력, 전체 기술명세서 작성

## 2026-03-11: 노래방 메인/결과 화면 + 음원 편집

- 노래방 페이지(곡 진행 화면) 작업
- 노래방 결과 화면 — 시각 디자인 우선 적용(세부 점수 항목은 후속)
- 음원 다운로드 및 길이 편집 작업
- 후속: 빠른 곡에서 음절을 시각적으로 따라가지 못하는 문제 — 음절 첫 글자 자동 색칠 방식으로 전환

## 2026-03-12: select-page 안정화 / 노래 싱크 / 리포트 정렬

- select-page 메인 컨텐츠를 한 화면 안에 스크롤 없이 들어오도록 조정
- 모바일 mode 페이지 하단 스크롤 불가 문제 해결
- 6개 곡 가사·음원 싱크 보정
- 리포트에 최신순/오래된 순 정렬 필터 적용
- 산출물: 브레인톡톡 SaMD 허가 갭 진단 (현 단계: PoC ~ Pre-SaMD, 검증/문서/임상근거 보강 필요)
- 후속: 반응형 보정, 자가진단 리포트 출력, 기술명세서

## 2026-03-13: 버전 스냅샷 / 노래방 녹음 / PII·PHI 분리 스키마

- src/lib/version/VersionSnapshot.ts (가칭) 신규 — step1~6 + sing 공통 VersionSnapshot 타입 도입
- 노래방 녹음 후 음성 저장 추가
- 현 프로젝트 기준 PII/PHI 분리 DB 스키마 초안 작성
- 후속: 오디오 webm 보존 정책(데이터 삭제 시 동작), 자가진단 리포트 상단 레이아웃 재디자인

## 2026-03-16: 서버/DB/Object Storage 연결 / 도메인 셋업

- NCP 기반 DB·Server·ObjectStorage 연결 구성
- 브라우저 로컬 저장만 하던 사용자 진행 데이터를 서버/DB에도 함께 적재하도록 전환
- step6에서 2회 이상 오답 시 다음 단계로 진행하도록 설계
- 도메인 host 추가 — brainfriends.goldenbraincare.com → :3000 프록시
- 후속: Nginx 프록시 설정, SSL 인증서 발급, DNS 반영 확인 (nslookup / dig +short)

## 2026-03-17: 환자/검진 DB 필드 확정 / 노래방 DB 저장 / TTS 통일

- DB 환자 필드 확정: 계정정보, 실명/기본정보, 초기 문진, 가명 연결
- 검진 핵심 필드 확정: aq, step_score, step_details, articulation_scores, facial_analysis_snapshot, step_version_snapshots
- step별 대표값 정의(step1 정확도/속도가점, step2 발음·대칭, step3 자음/모음, step4 유창성/명료도/반응시간, step5 읽기 정확도/속도, step6 writing/shape)
- 녹음·이미지 원본은 별도 Object Storage, DB에는 분석값과 구조화된 결과만 저장
- 노래방 실측값 DB 저장 항목 수정
- 활동 TTS 호출을 speakKoreanText()로 통일
- 후속: localStorage/sessionStorage 의존부 제거, 외부 레프토용 조회 API 정리, Draft Sync 빈도 축소(원본 미디어 보존 정책 정비)

## 2026-03-18: 운영/관리자 분리 / 도메인 호스팅 완료 / 안면 캘리브레이션

- 일반 사용자/관리자 구분 — 관리자만 하단 KPI 버튼 노출 (admin / 0000)
- 도메인 호스팅 연결 완료 — 서버 DB 호출/저장 정상 동작 확인 단계 진입
- 로컬 patientStorage 제거 → 서버 기반 환자 프로필로 전환
- 노래방 시작 전 얼굴 인식 안정화를 위한 캘리브레이션 추가 (정면/추적 안정 후 시작)
- KPI UI 정리: footer KPI 제거, 훈련/리포트 KPI는 개발자 전용 패널로 이동
- 후속: step 콘솔 디버그 정리, step4 유창성 점수 완화, step5 만점 기준 통일, 노래방 미측정 처리, 요구사항/위험관리/검증 항목/실패 메시지 표준 문서

## 2026-03-19: 카메라 종료 / 알림창 안정화 / 노래방 랭킹 / 안면 지표 재정의

- 훈련 종료 시 모든 카메라 설정 kill — 홈/결과창 진입 시점에 일괄 해제
- 얼굴 미인식/녹화 실패 알림창이 화면 레이아웃을 밀던 문제 해결 — 카메라 패널 상단으로 이동
- 노래방 미측정 판정 완화 — 일정 점수 미만이면 미측정으로 떨어지던 기존 정책 제거
- 노래방 랭킹: 곡별 최고 기록 기준 SQL 단순 조회로 변경, "내 랭킹"과 "전국 5위까지" 분리
- 노래방 결과 → 행 기반 리팩터(언어재활/자가진단과 동일 구조)
- SKIP은 관리자만 사용하도록 제한(쓰레기 데이터 방지)
- 안면 반응 변화량 산식 변경 — 이전 baseline facialSymmetry 절댓값 차이로 리포트 참고 지표화 (총점에서 제외)
- 후속: 노래방 클릭 시 자동 음원 1회 재생되는 잔존 이슈 확인

## 2026-03-20: 미디어 URL 확장 / 저장 불일치 해소 / measured 정책 명문화

- 관리자 리포트 print 버튼만 있던 것을 API/detail에 media URL 확장으로 보강
- 자가진단 일부 스킵 시 저장 누락 문제 — 결과 페이지에서 현재 세션 entry 직접 생성 후 저장/업로드 경로 통일
- step 중 하나라도 partial이면 전체 저장 제외되던 문제 해소
- 저장 정책 정리:
  - 자가진단/언어재활 → measured · partial 저장, demo·skip 미저장
  - 노래방 → measured만 저장, 그 외 미저장
- src/lib/kwab/SessionManager.ts, src/lib/client/clinicalResultsApi.ts, src/app/api/clinical-results/route.ts 의 measured 게이트 위치 명문화
- 사용자 관리 페이지의 ID 없는 관리자 계정 정리
- 후속: SaMD 명확성 vs 저장 범위 정책 결정

## 2026-03-23: 실측정 저장 재정비 / step2 녹음 복원 / 미인식 텍스트 처리

- self/rehab measured 세션 → language_training_results row 생성, step2/4/5 오디오·step6 이미지 → clinical_media_objects 생성
- partial/demo 세션은 결과 화면만 표시, DB·미디어 미생성으로 정책 일관화
- 관리자 계정 잔존 정리, step2 녹음 방식 기존 흐름으로 롤백
- 노래방 인식 실패 시 임의 텍스트가 들어가던 문제 → "..." 으로 대치
- 사용자 리포트 관리 페이지의 자가진단/언어재활 토글 색상 분리
- 후속: 유창성 점수 판정 완화

## 2026-03-24: 플레이스토어 비공개 테스트 외주 / 로컬 다운로드 / 유니티 PoC

- 구글 플레이스토어 비공개 테스트 외주 진행
- 로컬에서도 결과를 파일로 저장 가능하도록 정비
- 언어재활 결과 화면에 데이터 다운로드/리포트 버튼 추가 (자가진단과 통일)
- 유니티 기반 카메라 모션 게임 PoC 시작 — MediaPipe(파이썬) 대체 검토
- 후속: 게임 모드 본 프로젝트 통합

## 2026-03-25: 링고프렌즈 기획 / 권한 토글 시각화 / 게임 프론트 4종

- 링고프렌즈 기획 단계 진입
- 홈 화면 카메라 권한 설정 UX 개선 — 카메라/마이크 권한 보유 시 토글로 시각 표시, 보유 시 팝업 미노출
- 테트리스 게임 배경 톤을 메인과 통일(네이비 → 화이트)
- 게임 4종 프론트 구성: 말소리 블럭, 목소리 다리, 말로 열기, 문장 마법
- 후속: 말소리 여행 상단 칸 채워질 때 레이아웃 흔들림 보정

## 2026-03-26: 게임 프론트 디자인 안정화

- 25일 작업의 디테일 보정 (권한 토글 시각화/테트리스 배경 톤 적용 확정)
- 게임 4종 프론트 컨텐츠 디자인 마감, 세부 상호작용은 후속 단계로 분리
- 후속: 말소리 여행 레이아웃 흔들림 후속 처리

## 2026-03-27: 풍선 키우기 전환 / 문장 마법 전투씬 결과 / 카메라 활성화

- "말소리 여행" → "풍선 키우기" 게임으로 프론트 재설계
- 문장 마법 — 성공/실패 결과 표시 누락 문제 해결, 최종 승패 연출을 전투씬 형태로 보강
- 게임 이름을 좀 더 게임 톤으로 변경 검토
- 배경 카드 블록 느낌 제거
- 말소리 블럭 — 테트리스 뒤에 카메라 활성화되도록 구성
- 회의 메모: 보상 시각화(스노우 필터), SNS 업로드 저장, 목숨/플레이 횟수 제한, 한글 모양 블록, 1~10 난이도 × 10 레벨, 신규 아이디어(고요속의 외침/사투리 게임)

## 2026-03-30: 테트리스 등급제 / 서버 STT 전환 결정

- 테트리스 — perfect / excellent / good / fail 4단계 등급 도입(통과 미만=fail, 98+ =perfect, 충분히 높음=excellent, 그 외 통과=good)
- 테트리스 난이도 — 높이 고정·글자 수 증가로 난이도 조절, 오답 시 블럭 상승 방식
- 실시간 STT의 환경 의존성(네트워크 끊김/재연결 편차) 확인 → 서버 STT 전환 결정
- 게임 로직 = 브라우저가 듣고, 서버가 판정, 프론트가 결과에 반응 — 문장 마법에 우선 적용
- 후속: 보상 시각화(스노우 오버레이), 한글 모양 블럭 디자인 검토

## 2026-03-31: 등급 적용 / 횟수 제한 / 영상 저장 / 반응형 마감

- 테트리스 perfect/excellent/good/fail 기준 적용 완료
- 테트리스 STT 적용 및 게임 구현
- 풍선 키우기 — 발성 구간 레벨 축소(난이도 완화)
- 음성 테스트 페이지 제거
- 로그인 페이지 신설 — 플레이 가능 횟수 제한·시간 경과 시 횟수 보충
- 테트리스 화면 영상 저장 기능 추가
- 게임을 브레인프렌즈 본 프로젝트에 복제 통합
- 전체 페이지 반응형 정비 완료
- 언어재활/자가진단 카메라 팝업을 게임모드와 동일한 팝업 형태로 통일
- 후속: 게임 활동 페이지의 카드 디자인을 언어재활/자가진단과 일관되게

## 2026-04-01: 풍선/말로 열기 마감 / OpenAI 키 운영 이슈

- 풍선 키우기·말로 열기 반응형 레이아웃 마감(게임모드 전체 디자인 마감)
- 풍선 키우기 — DB 입력 조절 및 레벨 도입(추가 보정 예정)
- 말로 열기 — 로컬에서만 STT 테스트 버튼 노출
- OpenAI API 키 변경 — 서버 미반영 상태로 인한 음성 인식 미동작 확인
- 문장 대결 외 다른 게임에서 음성 인식 미동작 — 판정 흐름 이슈 분리
- 후속: 음성 입력 시 파형 시각화, 시연(다음 주 월/목) 전 서버 반영·디버깅

## 2026-04-02: 게임 UI 통일 / 결과 모달 셸 / OpenAI 진단 로그

- src/components/lingo/LingoResultModalShell.tsx 신규 — 게임 공통 결과 모달 셸
- 한글 테트리스/말로 열기/문장 마법/풍선 키우기 — 상단바 톤·결과 모달·선택 모달·모니터링 패널 구조 통일
- 선택 페이지 — game-mode/speech-rehab/self-assessment/sing-training 배너·카드 공통 컴포넌트화
- 풍선 키우기 — 별도 실시간 상태판 제거, 본문 중심 1열 구성, 전용 오디오 입력 훅 분리
- 문장 마법 — 좌우 패널 제거 후 1열 중심, 전투 상태바·결과 모달 정리, 관리자 예시 버튼 헤더로 이동
- 말로 열기 — 테트리스 유사 메인+우측 패널 레이아웃, Listening Stream/세션 진행 UI 보강
- 한글 테트리스 — STT 흐름·fallback·마이크/카메라 로그 보강
- src/app/page.tsx, src/lib/auth/accountAuth.ts 수정 — 로그인 화면 Admin 빠른 로그인 버튼 제거(내장 admin/0000 로직은 잔존 확인)
- src/app/api/proxy/stt/route.ts 수정 — 서버가 어떤 OpenAI 키를 읽는지 진단 로그 추가
- 검증: 테트리스 STT 흐름은 짧은 목표어(≤4~5자) SpeechRecognition / 긴 목표어·문장 Whisper로 분기
- 후속: 테트리스 STT 체감 안정성, 배포 서버 신규 OpenAI 키 반영 최종 확인

## 2026-04-03: (간단 점검일)

- 진행 사항 별도 기록 없음 — 시연·환경 점검 위주
- 후속: 4/7 게임 정비 시작

## 2026-04-07: 게임 디버그 정리 / 풍선 키우기 시각화 / 말로 열기 흐름 보강

- 일반 사용자도 게임 모드 접근 가능하도록 권한 조정
- 임시 STT/게임 디버그 로그 일괄 정리
- 관리자 리포트 — 실제 계정 생성 사용자만 노출
- 테트리스 — 음성 인식 흐름을 브라우저 인식 기준으로 재구성, 우측 사이드 패널 문제 흐름 UI 개선, 카메라 안면 상태를 소형 배지로, 상단 시간 표시 제거, 하단 인식 문구를 실제 인식값 중심으로
- 테트리스 난이도/점수/판정 등급 기획 문서 작성
- 풍선 키우기 — 성장 조건/위험 구간/무음 처리 반복 조정, 메인 카드 좌우 2분할, 풍선 아래 실시간 파형 + 현재 dB 표시, 상단 상태 pill·하단 볼륨/위험 카드 제거, 단모음 발화 보너스 성장 로직, 상단 문구를 목표 중심 안내로
- 말로 열기 — 난이도별 제한시간, 시간 초과 시에도 카드 공개, 진행 카드 공개 위치 랜덤화, 자동 듣기·카드 전환 흐름, 카메라 필터 + 연속 성공/실패 코스튬 효과, 실패 카드 문구 제거
- 게임 모드 통합 기획 문서 + 풍선 키우기/말로 열기/문장 마법 개별 기획 문서 작성
- 로그인 화면 개발용 관리자 빠른 진입 버튼 제거
- 서버 OpenAI API 키 반영 절차 점검·가이드 정리
- 후속: 테트리스 화면용 사용자 설명/기술 효과 문구

## 2026-04-08: 게임 모드 디자인 분리 / KOREA WORD GAME 타이틀

- 게임 모드 전용 디자인을 공통 콘텐츠와 분리 — 자가진단/언어재활/노래방의 공통 셸·버튼 스타일 복구
- 게임 모드 메인 타이틀을 "KOREA WORD GAME / LEVEL ROADMAP v2"로 정렬
- 픽셀 폰트·네온 글로우는 게임 모드 타이틀·스크롤 문구에만 한정 적용
- 메인 레벨 카드 — "서울 튜토리얼" 등 운영명 → "서울 🏙️ / 인천 ⚓" 도시명 중심
- 카드 하단 설명 — 훈련 메타 → 도시 소개 문구
- 스테이지 상세 로드맵 카드 제목을 짧은 단계명으로
- 게임 모드 진입 시 각 게임 화면에만 별도 헤더 톤 적용
- 후속: 전체 로드맵 디자인 방향 결정, 데이터셋 본 적용

## 2026-04-09: 게임 5종 재정비 / payload 구조 일원화

- src/lib/lingo/gameModeStagePayloads.ts 수정 — 중간 변환 구조 제거, 최종 payload 직접 관리 방식으로 전환
- 게임 코어 5종 확정: 테트리스 / 말로 열기 / 문장 만들기 / 잿말놀이 / 풍선 키우기
- 도시별 스테이지 — 단일 도시 15노드 유지, 노드별 실제 게임 타입 payload 직접 참조
- legacy sentence 타입 전면 제거, 전체 노드를 5종 gameType으로 통일
- 서울·인천·부산 — 실제 플레이 문구 수작업 보정으로 도시 테마-게임 유형 정합성 확보
- 메인 로드맵 / 상세 스테이지 / 게임 진입 / 진행도 저장이 동일 payload 구조 기준으로 동작
- 게임모드 payload 문서 재생성, npm run build 통과
- 검증: npm run build 통과
- 후속: 경주~제주 구간 노드별 문구 품질 보정

## 2026-04-13: 인수인계 정리 / 카페24 운영 정보 / 로컬 환경 구축

- 프로젝트 구조 파악: braintalktalk_mobile(앱), goldenbraincare_src_20260410010001(PHP 웹/백엔드), selftest_bak_20260410020001.sql(DB 백업)
- 모바일 앱 = 운영 웹사이트를 WebView로 감싸는 구조 / 푸시·딥링크·결제 보강 — 웹사이트가 본체임을 확인
- 로컬 실행 환경 구축 — XAMPP, PHP, Composer, MySQL 설정 후 http://localhost/ 기준 사이트 동작 확인
- 토스페이먼츠 연동 구조 확인(PHP·모바일 앱 양쪽)
- 카페24 가상서버 운영 정보 정리 — 서버/계정/배포 경로/DB/설정/백업 경로
- SSH/SFTP 미접속 원인 = 방화벽 허용 IP 제한 — 환경 점검 후 접속 성공
- goldenbraincare 서버 계정 비밀번호 변경(기본 보안 조치)
- 검증: localhost 사이트 동작 확인, 서버 계정 SSH 접속 확인
- 후속: 결제 로컬 검증, 운영 DB·서버 접속 정보 추가 변경/관리

## 2026-04-14: 서버 의존 제거 / V&V 메타데이터 연결 / therapist UI 분리

- src/app/(login) 수정 — 아이디/비밀번호 제거, 이름·생년월일·성별·교육년수·연락처 입력만으로 로컬 프로필 생성
- 시작하기 이후 진행을 막던 미들웨어/세션 의존 로직 제거 — 자가진단/재활/노래방 전 과정 서버 없이 진행 가능
- 모든 훈련 화면에서 SKIP 항상 사용 가능, 401 발생시키던 동기화·이벤트 로그 등 서버 호출 제거 또는 local-only 전환
- 결과 ZIP에 녹음 파일·안면 key frame 포함, backup/*.json을 서버 백업과 유사 구조로 추가
- patient_id / session_id / result_id / media_id를 서버 deterministic UUID 규칙과 동일하게 통일(노래방 포함)
- src/lib/kwab/SessionManager.ts 수정 — requirement id, test case id, runtime validation checkpoint, measurement quality 기록 구조 연결
- 결과 저장 시 V&V 메타데이터가 서버 저장 경로·audit 로그까지 전달되도록 정리
- 브라우저 저장 정책 재정리 — 민감 raw step 데이터의 local/session storage 저장 범위 축소, 환자 bootstrap을 patientId/role/displayName 중심으로 최소화
- 결과 페이지 server-first 보강 — self-assessment / speech-rehab / sing-training이 서버 저장본 기준으로 재동기화
- measured-only AI 평가셋 분리 뼈대 연결 — measured 조건 만족 샘플만 별도 evaluation 수집 경로로 적재
- src/app/therapist/* 신규 — overview/patients/results/system 화면 뼈대 추가
- src/app/api/therapist/reports 신규 — therapist 화면이 admin route 직접 호출하지 않도록 분리
- 인증/세션 계층에서 therapist 역할 인식, therapist 로그인 시 콘솔 진입으로 분기
- admin 세션에서 therapist 계정 생성 — therapist provisioning API/화면 추가
- 검증: 의존성 설치·보안 취약점 정리 후 빌드 통과
- 후속: 최종 브라우저 실사용 검증

## 2026-04-15: 공인성적서·SaMD 제출형 구조 정리

- docs/remediation 신규 — SW V&V (요구사항-시험-결과 추적성, deterministic check, 날짜별 실행 로그, 결과서/결함/재시험, export 구조)
- 사이버보안 — 브라우저 저장 최소화, raw 데이터 transient/session 처리, 정책 결정서, 저장 항목표/민감정보 분류표, 최종 고정 보고서
- AI 성능평가 — measured-only 평가셋 분리, DB 저장, 버전 비교/운영 모니터링, 제출형 개요/운영본 보고서, 오류 사례 기록서
- 요약 문서 — 제품 정의 1장, 사전 문의 1페이지, 부족 항목 체크리스트, 문서 경로 인덱스, HTML 문서 맵
- 후속: 시험기관 사전 문의 → 품목/등급 확정 → 필요 성적서 종류 확정

## 2026-04-16: SaMD 문서 마감 / 치료사 대시보드 KPI / admin 화면 전환

- docs/remediation 정비 — 요약·제출·경로 문서 한국어 중심 정리
- SW V&V 제출형 마감 — deterministic 검증 시나리오 12개로 확장
- vnv-export 제출형 구조 정리 — 실행 로그·커버리지·최신 시험 결과 포함
- npm run test:vnv:record 결과를 날짜별 JSON 증적으로 누적, 결과서에 최신 실행 로그 반영
- 사이버보안 정책 최종 고정 — 브라우저 저장 항목·민감정보 분류·정책 결정·readiness 보고서 정리
- AI 성능평가 제출형 정리 — measured-only 평가셋, DB 저장, 버전 비교, 운영 모니터링, export 구조
- 시험기관 문의 패키지 — 제품 정의 1장 / 사전 문의 1페이지 / 시험기관 선정 기준 / 공통 질문 리스트
- HTML 문서 맵 신규 — 내부 링크 상대 경로화(압축 전달 시에도 동작), 완료/부족/다음 할 일 상태 요약, 핵심 내용 즉시 확인
- src/app/therapist/overview — KPI, 빠른 검색, 사용자 상세 핵심 패널, 즉시 실행 액션 추가
- src/app/therapist/results — 검색·측정 품질·훈련 모드·저장 상태 필터 + V&V/AI export 액션 연결
- src/app/therapist/patients/[id] — 결과 다운로드·저장 실패 재시도
- 사용자 모드 선택 — blur·카드 이미지 위 원형 장식 제거(시인성 개선)
- admin 계정 — 상단에서 사용자/치료사 화면 전환 + "현재 관리자 / 사용자 화면 미리보기 / 치료사 화면 미리보기" 배지
- 검증: npx tsc --noEmit 통과, npm run test:vnv 통과
- 후속: 시험기관 사전 문의, 품목/등급 확정, 필요 성적서 종류 확정, GMP·사용적합성 외부 준비

## 2026-04-20: 가입-승인-연결 흐름 운영 구조 재정리

- src/app/(signup)/page.tsx 수정 — 일반 회원가입 / 치료사 회원가입 화면 분리
- 치료사 가입 — 기존 기관 선택 + 1인 기관 등록 흐름 추가
- 기관 등록 요청 페이지 + 관련 API 정비 — 심사형 프로세스로 관리
- src/app/link-care/page.tsx 신규 — 환자가 기관·담당 치료사 연결 요청
- 환자-치료사 연결 요청 API 추가
- 관리자 콘솔 확장 — 기관 등록 요청 / 치료사 승인 / 환자 연결 요청 검토 화면 + 서버 로직
- 계정/기관/치료사/환자 매칭 구조 재설계 문서 + SQL 초안 작성
- 후속: 운영 DB 마이그레이션, 승인/반려 후 알림 처리, 예외 케이스 검증, 통합 테스트

## 2026-04-29: P1-6 보호자 주간 리포트 Phase 1 완료

- src/lib/guardian/weeklyReportSummary.ts 신규 — 최근 7일 훈련 수, 언어/노래 세션 수, 최신 AQ, AQ 변화, 평균 점수, step별 완료율, 이상반응 상태 결정요소 요약
- src/lib/server/guardianReportsDb.ts 신규 — guardian_report_links 테이블 자동 생성, 토큰 hash 저장, 보호자 read-only 리포트 조회
- src/app/api/guardian/report-link/route.ts 신규 — 환자 본인/admin/담당 치료사가 보호자용 링크 생성
- src/app/guardian/[token]/page.tsx 신규 — 로그인 없는 토큰 기반 read-only 보호자 주간 리포트 화면
- src/app/api/cron/weekly-report/route.ts 신규 — 발송 전 단계 cron preview/link generation API. 실제 이메일/SMS 발송은 아직 제외
- src/lib/vnv/requirements.ts SR-GUARDIAN-010 추가, src/lib/vnv/runDeterministicChecks.ts TC-GUARDIAN-001 추가
- 검증: npm run test:vnv → 17/17 PASS. npx tsc --noEmit → exit 0
- 후속: guardian 동의 상태/수신 채널 테이블, SMTP/SES 발송, 실패 재시도 큐, 보호자 생성 버튼을 치료사 UI에 노출

## 2026-04-30: 사이버보안 입력검증/추적성 확장 + WASM STT/AI 평가 러너 + 인허가 문서 패키지 정리

- src/lib/server/inputSchemas.ts 신규 — zod 기반 입력 스키마/validateInput 통합(SI-05) + 일부 API 라우트 적용(로그인/가입/ID찾기/비번재설정, 환자-치료사 연결, 처방코드 redeem, AAC intent, 이상반응)
- src/lib/server/accountAuth.ts 수정 — 비밀번호 강도 정책(validatePasswordStrength) 추가(IA-05) 및 기존 validatePassword 경로 연결
- src/lib/server/loginLockout.ts 신규 — 연속 로그인 실패 잠금 결정성 정책(IA-07)
- src/lib/server/rateLimit.ts 신규 — sliding window 기반 rate limit 결정성 정책(RA-01)
- src/lib/server/auditChain.ts 신규 — 감사로그 체인(HMAC) + 시간 단조성 검증(UC-07/TRE-01)
- src/lib/server/phiMasking.ts 신규 — 로그/리포트 산출물용 PHI 마스킹 결정성 유틸(SR-PHI-013)
- src/lib/speech/wasmSttAdapter.ts 수정 — transformers.js 기반 온디바이스 Whisper 전사(lazy import, Blob→16kHz mono 디코드, 엔진 버전 상수화)
- public/sw.js 신규 — WASM STT 모델 캐싱용 Service Worker 스켈레톤(실제 PWA/workbox 통합은 후속)
- src/lib/vnv/* 수정 — 요구사항(SR)·결정성 테스트(TC)·traceability matrix를 보안/변경관리/IEC62304 export/usability/AI-eval runner/guardian sender까지 확장
- package.json 수정 — next 16.2.4, zod/@huggingface/transformers 추가, security:manifest/security:soup 및 ai-eval:* 스크립트 추가
- docs/regulatory/* / docs/security/* / docs/decisions/* 추가·수정 — MFDS 사전상담/갭 분석/리스크 파일/변경승인 SOP/PMS 계획/SRS·SDS/사용적합성 패키지/릴리즈 매니페스트·SOUP·SBOM 산출 구조 정리
- docs/regulatory/regulatory-completion-status.md 신규 — 인허가 산출물 완료 현황 Dashboard v0.1 작성. 자체 작성 가능한 코드+문서 산출물 약 90% 완료, 외부 의존(임상 실측/사용성평가/식약처 회신/침투시험) 분리
- docs/regulatory/claim-lock.md v0.3.0 정리 — 사용 가능 클레임/조건부 클레임/금지 표현/근거 파일/갱신 트리거를 제출 전 표현 통제 기준으로 정리
- docs/regulatory/digital-medical-product-gap-matrix.md v0.2 정정 — NIDS 답변 기준 SaMD ⊃ DTx 관계 반영, 1차 SaMD 신청 + DTx 후속/병행 전략으로 수정
- docs/regulatory/risk-management-file.md v1.0 마감 — ISO 14971 형식 RM-* 위해요인, 위험통제, 결정성 V&V 매핑, IEC 62366 사용성 매핑, 잔여위험 재평가 정리
- docs/regulatory/srs.md / sds.md 신규 — IEC 62304 §5.2/§5.4 제출형 요구사항·설계 문서 초안 작성
- docs/regulatory/usability-evaluation-protocol.md / usability-evaluation-irb-package.md 신규 — IEC 62366-1 사용성평가 프로토콜, critical task, use scenario, IRB 부속자료(동의서/모집공고/폐기 SOP) 정리
- docs/regulatory/wasm-stt-model-evaluation-plan.md / ai-evaluation-data-collection-guide.md 신규 — WASM STT 후보 모델, WER/CER/RTF/P95 평가 기준, 60~80대 30건 수집 가이드 작성
- docs/regulatory/gmp-qms-decision-matrix.md / change-approval-sop.md / pms-capa-procedure.md / post-market-surveillance-plan.md / pre-launch-checklist.md / mfds-pre-consultation-pack.md 신규 — GMP/QMS 의사결정, 변경허가, PMS/CAPA, 시판 전 체크리스트, 식약처 사전상담 질의 패키지 정리
- docs/manuals/manual-therapist.md / manual-patient.md / manual-guardian.md 신규 — 치료사·환자·보호자 사용자 매뉴얼 v0.1 작성
- docs/security/* 신규·갱신 — SBOM, SOUP, release manifest, npm audit 결과, CVE 면제 등록부(high 7건 reachability/decision) 정리
- src/app/api/auth/login/route.ts 수정 — 파일 끝부분에 중복으로 붙은 stray 코드 제거. 원인: 빌드 오류(Return statement is not allowed here)로 로그인 API가 500 응답
- admin 로그인 검증 — 브라우저에서 http://localhost:3000 접속 후 admin / 0000 로그인 성공, /admin 관리자 콘솔 진입 확인. 비밀번호 규정 문제가 아니라 login route 빌드 오류였음
- 검증: POST /api/auth/login admin/0000 → ok:true 확인. 브라우저 관리자 콘솔 진입 확인. npx tsc --noEmit은 login route 수정 후 기존 V&V 타입 오류(src/app/api/therapist/system/iec62304-traceability/route.ts, src/lib/server/vnvEvidenceDb.ts, src/lib/vnv/runDeterministicChecks.ts)로 실패
- 후속: V&V async 타입 오류 정리 후 tsc 재검증, npm run test:vnv 재실행, 문서 산출물 git 커밋/버전 고정, 외부 의존 항목(임상 음성 30건·사용성평가·식약처 사전상담·침투시험) 착수

---

## 2026-05-04: 사이버보안 통제 구체화(입력검증/잠금/레이트리밋/감사체인) + 보호자 주간리포트 크론 스케일업 + 적응형(IRT) 기반

- src/lib/server/inputSchemas.ts 신규/확장 — SI-05 zod 통합 입력 스키마(로그인/회원가입/비번재설정/AAC/이상반응/보호자 연락처 등)로 라우트별 수동 검증 패턴 대체 기반 마련
- src/lib/server/rateLimit.ts 신규 — RA-01 sliding window rate limit 결정성 함수 + 정책 프리셋(login/passwordReset/stt/aac)
- src/lib/server/loginLockout.ts 신규 — IA-07 연속 실패 5회 잠금(15분) 결정성 정책 추가
- src/lib/server/sessionLockout.ts 신규 — UC-03 세션 idle 30분 만료/임박 경고 결정성 정책 추가
- src/lib/server/auditChain.ts 신규 — UC-07/TRE-01 감사로그 체인(HMAC-SHA256, prevHash/entryHash, 시간 단조성 검증) 결정성 모듈 추가
- src/app/api/auth/login/route.ts 수정 — SI-05 스키마 적용 + TOTP 2단계(필요 시) 처리 강화(누락 시 세션 무효화 후 totp_required)
- src/app/api/proxy/stt/route.ts / src/lib/speech/sttLanguage.ts 수정/신규 — 외부 STT language 값을 `ko`로 고정(클라이언트 요청값 무시)해 전송 정책 명확화
- src/app/api/guardian/contacts/route.ts 신규 — 보호자 연락처 등록/조회/동의 철회 API 추가(권한: admin/본인 patient/담당 therapist), 감사로그(access) 기록 포함
- src/app/api/cron/weekly-report/route.ts 수정 + src/lib/server/weeklyReportSender.ts 신규(연동) — 보호자 주간 리포트 링크 생성 + 발송(현재 dry-run/스킵 기록 중심) 배치 처리/증적 테이블 설계
- src/lib/adaptive/irt.ts 등 신규 — 2PL IRT + EAP 능력치 추정 + MFI 문항 선택 결정성 로직 추가(적응형 난이도 조정 기반)
- src/lib/training/questionOrder.ts 신규 — 세션 단위 셔플 순서 고정(새로고침/복귀 시 순서 유지) 유틸 추가
- docs/regulatory/claim-lock.md / cloud-and-data-transfer.md 등 갱신 — 보안 통제(레이트리밋/잠금/감사체인/입력검증) 및 WASM STT wiring/언어 고정 정책을 클레임/데이터 전송 명세에 반영
- 검증: `npx tsc --noEmit` 통과. `npm run test:vnv`는 esbuild spawn `EPERM`으로 실행 실패(환경/권한 제약)

## 2026-05-06: Report 본체 분리 + Step2 점수/저장 안정화 + WASM STT 로컬 자산화 + IRT evidence export

- src/app/(training)/report/page.tsx 수정 — `/report` 직접 접근 시 `/mypage`로 즉시 redirect만 수행
- src/app/(training)/report/ReportContent.tsx 신규 + src/app/(training)/mypage/page.tsx 수정 — 기존 리포트 UI 본체를 ReportContent로 분리해 mypage에 임베드
- src/lib/training/step2Scoring.ts 신규 + src/app/(training)/programs/step-2/page.tsx 수정 — step2 점수 계산(자음/모음+문장 매칭 가중치), 짧은 타겟 prompt-bias 캡, 동일 index 결과 merge, resume 복원 중복 적용 방지, 녹음 시작 비프 추가
- src/lib/kwab/SessionManager.ts 수정 — step2/step4 결과에 `rawTranscript`/`audioUrl`/세부 점수 필드 저장 경로 확장(결과·export 증적 강화 기반)
- STT 정책/런타임/로컬 자산 고정
  - src/lib/speech/sttPolicy.ts / src/lib/speech/sttRuntime.ts / .env.example 수정 — 훈련(daily/game)은 서버 Whisper 기본, WASM은 `NEXT_PUBLIC_STT_WASM_EXPERIMENT=true` 실험 플래그에서만 사용
  - src/lib/speech/wasmSttAdapter.ts 수정 + public/models/ / public/vendor/ 추가 — transformers.js 런타임을 로컬 모델 경로(`/models/wasm-stt/`) + ONNX 런타임(`/vendor/onnxruntime/`)로 고정, remote model 차단
  - next.config.ts / public/sw.js / src/lib/speech/wasmSttCacheStrategy.ts 수정 — CSP `blob:`/`worker-src` 허용 및 모델·런타임 캐시 패턴 추가
- IRT evidence export(치료사 검토용)
  - src/lib/adaptive/evidence.ts 신규 — stepDetails/노래 결과의 adaptive 메타데이터 수집 + CSV/요약 serializer 추가
  - src/lib/server/adaptiveEvidenceExportDb.ts 신규 + src/app/api/therapist/system/adaptive-evidence-export/route.ts 신규 — DB(step_details) 기반 evidence export(JSON/CSV) + DB 불가 시 deterministic fixture 제공
  - src/app/admin/_components/AdminConsoleClient.tsx 수정 — 관리자 콘솔에 IRT evidence 내보내기 링크 추가
- src/app/(result)/result-page/speech-rehab/page.tsx 수정 — 결과 ZIP 다운로드에 transient 저장 스냅샷 병합 + adaptive evidence(JSON/CSV) 포함
- src/app/(training)/webxr/page.tsx / src/app/webxr/_disabled.tsx / src/components/aac/XrAacCanvas.tsx 삭제 — WebXR 관련 코드 경로 정리
- docs/regulatory/* / docs/security/audit/* / scripts/run-npm-audit.mjs / package.json 등 수정 — WASM STT 제출/보안 문서 갱신, audit 증적 갱신, Windows `npm audit` 실행 호환, Next 빌드 옵션 조정
- 검증: deterministic V&V에 TC-STEP2-003(step2 점수/merge), TC-IRT-EVIDENCE-EXPORT-001(evidence export) 시나리오 추가(실행 결과는 미기록)

## 2026-05-07: 반복훈련 안정화 + 노래훈련 증적 ZIP + XR 프리뷰 + 인허가 소스 감사표 정리

- 반복훈련 resume/증적 안정화
  - src/app/(training)/programs/step-1/page.tsx 수정 — resume 복원 중복 적용 방지(시그니처 기반 1회 적용) + baseTrainingData 기준으로 signature 계산 정합성 보정
  - src/app/(training)/programs/step-4/page.tsx 수정 — 녹음 시작 비프 추가 + step4 복원 시 동일 index 병합 시 audioUrl 보존 + 결과 저장 시 audioUrl 포함
  - src/app/(training)/programs/step-5/page.tsx 수정 — step5 읽기 문항을 IRT bank(STEP5_READING_BANK) 기반 적응형 순서로 구성 + 결과에 theta/sd/문항 파라미터(b/a) 메타 저장
- 노래 훈련 결과 export(증적 강화)
  - src/app/(result)/result-page/sing-training/page.tsx 수정 — 결과/히스토리/스토리지 스냅샷 + 리뷰 오디오/키프레임을 ZIP으로 다운로드(파일명: 생년월일-이름-검사일시-곡명-sing.zip)
  - src/lib/client/clinicalMediaUpload.ts 수정 — data URL 파싱을 직접 처리하는 `dataUrlToBlob` 추가(비-base64/ base64 모두 지원), 기존 fetch 기반은 `dataUrlToBlobViaFetch`로 분리
- 치료사 화면 보강(적응형 난이도 보조지표)
  - src/app/therapist/patients/[patientId]/page.tsx 수정 — IRT evidence 요약(θ/SD/최근 난이도/권장 난이도) 카드/배지 추가 + entry JSON export에 adaptiveEvidence + CSV 문자열 포함
- XR 프리뷰 라우트(정식 SaMD 스코프 외 R&D)
  - src/app/(training)/select-page/mode/page.tsx 수정 — XR 진입 버튼을 `/webxr` → `/select-page/xr`로 변경(PREVIEW 표기)
  - src/app/(training)/select-page/xr/* 신규 + src/app/(training)/layout.tsx 수정 — XR 라우트는 임상 chrome/KPI/백그라운드 FaceTracker 우회 + body 배경을 라우트 동안 다크로 강제
- 인허가/규제 문서 정리
  - docs/regulatory/README.md / regulatory-source-audit.md 등 신규 — 제공 원문(가이드라인/NIDS) → 내부 문서 반영/증적 상태를 추적하는 감사표 + 최소 인덱스 추가, 중복/충돌 문서 일부 정리(삭제 포함)
- 검증: 기능 동작/빌드/테스트 실행 결과는 미기록(후속으로 최소 `npm run test:vnv` 재실행 필요)

## 2026-05-08: AAC 보조 채널 + XR 라이브러리 리디자인 + 노래 훈련 점수 v3 반영

- AAC 보조 채널 라우트 추가(처방 게이트 우회)
  - src/app/(training)/select-page/aac/page.tsx 신규 — AACBoard 기반 의사 표현 화면 + `/api/aac/intent` POST 전송/상태 표시
  - src/app/(training)/select-page/mode/page.tsx 수정 — `/select-page/aac` 진입 버튼 추가(AAC 보조 배지)
- AACBoard 임상 우선 UX 보강
  - src/components/aac/AACBoard.tsx 수정 — 상단 “필수 표현” 퀵 스트립(긴급/감정/통증/인사) + 심볼/문장 즉시 TTS(SpeechSynthesis, ko-KR) + 음소거/문장 듣기 버튼
  - src/constants/aacData.ts 수정 — quick 카테고리/심볼 정의(AAC_QUICK_GROUPS/…SYMBOLS) + `findAacSymbolById()` 에 quick id 지원
  - src/lib/aac/intentTemplate.ts 수정 — quick 단독 클릭(예: “도와주세요”, “머리가 아파요”)은 라벨을 완성 문장으로 그대로 출력
- XR 프리뷰 페이지 리디자인(R&D 컨텐츠 라이브러리)
  - src/app/(training)/select-page/xr/page.tsx 수정 — 4 시나리오 카드(마트/카페/병원/공원) + `/select-page/xr/vr-tour?scenario=<key>` 딥링크, three.js 미니 파노라마(hero) 톤 순환 UI 구성
- 노래 훈련 점수/리포트 지표 재정의(전사 정확도 중심 → 수행 기반 보조 지표)
  - src/app/(training)/programs/sing-training/page.tsx 수정 — `sing-score-v3-performance-weighted`로 점수 버전 변경, 참여율/타이밍/안면-음성 동시성 등 새 지표 추가 및 가중치 재조정
  - src/app/(result)/result-page/sing-training/page.tsx + src/app/(training)/report/ReportContent.tsx 수정 — 결과/리포트에 참여율·타이밍·동시성 중심으로 표시 문구/카드 갱신, 리뷰 오디오 접근 URL 처리 보강(objectKey → `/api/media/access` 폴백)
  - docs/regulatory/claim-lock.md 수정 — 노래 훈련 클레임 잠금 문구를 v3 수행 기반 지표로 정정(STT 전사는 참고값으로 제한)
- 기타 UI 용어 정리
  - src/app/(training)/mypage/page.tsx 수정 — “브레인 노래방” → “노래 훈련”, 안면 지표 라벨 “비대칭 위험” → “비대칭 참고”
  - src/app/therapist/* 일부 수정 — 위험도/정상 표기 용어를 “주의도/일반”으로 정리(대시보드/리다이렉트 문구)
- 검증: `npx tsc --noEmit` 통과

## 2026-05-11: 회원가입 연락처 입력 포맷 보정 + 개발 기록 정리

- 회원가입 연락처 입력 포맷 보정(10자리/11자리)
  - src/app/signup/page.tsx 수정 — `formatPhoneInput()`에서 10자리(3-3-4) / 11자리(3-4-4) 케이스를 분기 처리해 하이픈 포맷이 깨지지 않도록 수정
  - 검증: 10자리/11자리 입력 포맷 출력 로직 단위 확인(node 실행)
- 개발 기록 정리
  - 개발내용.md 신규 — 변경사항을 별도 요약 문서로 기록(상세 이력은 본 문서 유지)
- (preview) 게임 모드/결과/세션 스키마 확장(작업 중)
  - brainfriends-preview/src/app/(training)/select-page/game-mode/page.tsx 수정 — VR 투어(4 시나리오) 중심의 Game Hub로 재구성(딥링크/섹션 구성)
  - brainfriends-preview/src/lib/gameModeProgress.ts 수정 — 권역/도시/미션 진행도 localStorage 기반 잠금 해제 시스템 추가
  - brainfriends-preview/src/lib/kwab/SessionManager.ts 수정 — 음향 분석(AcousticSnapshot), V&V traceability/runtime check, 시선 응시(gaze) 요약 등 결과 스키마 확장
  - brainfriends-preview/src/lib/client/clinicalMediaUpload.ts 수정 — 오프라인 미디어 저장을 deterministic id/objectKey로 정리

## 누적 후속 과제 (2026-05-08 기준)

- SaMD 시험기관 사전 문의 / 품목·등급 확정 / 필요 성적서 종류 확정
- GMP·사용적합성 외부 준비
- 운영 DB 마이그레이션, 승인/반려 후 알림 처리, 예외 케이스 검증, 통합 테스트
- 보호자 리포트 — 동의 상태/수신 채널 테이블, SMTP/SES 실제 발송, 실패 재시도 큐, 치료사 UI 보호자 링크 생성 버튼 노출
- 보안/V&V — SI-05 입력 스키마 적용 범위 확대 + rate limit/lockout 운영 저장소 연동 정책 확정, 감사로그 체인 저장/검증 운영 시나리오 구체화
- 보호자 리포트 — 발송 채널(SMTP/SES/카카오) 어댑터 실제 연동, 실패 재시도/큐, 크론 운영 시나리오(건별/배치) 확정
- 인허가 문서 — regulatory-completion-status 기준 산출물 인덱스/상태표를 사전상담 제출용 요약본으로 압축, git 커밋으로 버전 고정
- 외부 의존 — 임상 협력기관 음성 30건 수집, IEC 62366 사용성평가 실시, 식약처 사전상담/품목분류 회신, 외부 침투시험 보고서 확보
- WASM STT — 실험 플래그 기반 성능/호환성(V&V) 확인 후 기본값 전환 여부 결정, service worker 캐시 정책 실제 통합(next-pwa/workbox) 및 모델 평가/버전 고정 절차 확정
- 노래방 — Draft Sync 빈도/원본 미디어 보존 정책 후속 정비
- 게임 모드 — 경주~제주 구간 노드별 문구 품질 보정
- 결제 — 로컬 환경에서 토스페이먼츠 승인 완료까지 검증
- 운영 — 카페24 서버/DB 접속 정보 추가 변경 및 관리

