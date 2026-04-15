"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/therapist", label: "Overview" },
  { href: "/therapist/patients", label: "Patients" },
  { href: "/therapist/results", label: "Results" },
  { href: "/therapist/system", label: "System" },
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
