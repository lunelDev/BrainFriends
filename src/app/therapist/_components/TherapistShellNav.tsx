"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/therapist", label: "종합 대시보드" },
  { href: "/therapist/patients", label: "사용자/훈련 이력" },
  { href: "/therapist/results", label: "측정·안면 분석" },
  { href: "/therapist/system", label: "보안·검증 현황" },
];

function isActive(pathname: string, href: string) {
  if (href === "/therapist") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function TherapistShellNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap gap-2">
      {NAV_ITEMS.map((item) => {
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
