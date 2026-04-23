"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = { href: string; label: string; adminOnly?: boolean };

// 종합 대시보드 외 항목은 운영/품질 관리 성격이라 관리자만 접근.
// 치료사는 종합 대시보드 안에서 환자 목록·핵심 패널을 그대로 확인할 수 있다.
// 과거의 "/therapist/patients (사용자/훈련 이력)" 항목은 종합 대시보드로 흡수되어 제거.
const NAV_ITEMS: NavItem[] = [
  { href: "/therapist", label: "종합 대시보드" },
  { href: "/therapist/results", label: "측정·안면 분석", adminOnly: true },
  { href: "/therapist/system", label: "보안·검증 현황", adminOnly: true },
];

function isActive(pathname: string, href: string) {
  if (href === "/therapist") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

type Props = { isAdmin?: boolean };

export function TherapistShellNav({ isAdmin = false }: Props) {
  const pathname = usePathname();
  const visibleItems = NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin);

  return (
    <nav className="flex flex-wrap gap-2">
      {visibleItems.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`rounded-full px-4 py-2 text-sm font-black transition ${
              active
                ? "bg-slate-900 text-white"
                : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
