// src/lib/firstDiagnosisFlow.ts
//
// "최초 자가진단 흐름" 식별 플래그.
//
// 사용 시점:
// - 활동 선택 화면(/select-page/mode)에서 최초 자가진단 모달 → "자가진단 시작"
//   을 눌러 우리집(home) place 로 직행할 때 set.
// - 진단 도중 step-1~6 페이지의 홈 버튼은 이 플래그가 세팅돼 있으면
//   /select-page/self-assessment(장소 선택) 가 아니라 /select-page/mode
//   (활동 선택) 으로 돌아가야 한다.
// - 진단 완료(결과 페이지 진입) 또는 사용자가 홈 버튼으로 빠져나갈 때 clear.
//
// 저장소: sessionStorage. 탭이 닫히면 자연 소멸.

const KEY = "btt.firstDiagnosisFlow";

export function setFirstDiagnosisFlow(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(KEY, "1");
  } catch {
    // sessionStorage quota / privacy mode 등은 조용히 무시.
  }
}

export function isFirstDiagnosisFlow(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function clearFirstDiagnosisFlow(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
