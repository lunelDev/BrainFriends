// /therapist/patients 페이지는 더 이상 별도 화면으로 운영하지 않는다.
// 환자 검색·위험도 정렬·메모/follow-up 뱃지 모두 /therapist 대시보드의
// TherapistPatientListPanel 로 흡수했고, 환자 상세 진입은 그 패널에서 직접 한다.
// 기존 북마크/링크 호환을 위해 /therapist 로 영구 리다이렉트한다.
import { redirect } from "next/navigation";

export default function TherapistPatientsPage(): never {
  redirect("/therapist");
}
