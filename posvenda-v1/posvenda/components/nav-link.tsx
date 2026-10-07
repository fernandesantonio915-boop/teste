"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
export function NavLink({ href, label, icon }: { href: string; label: string; icon: string }) {
  const p = usePathname();
  const active = href === "/" ? p === "/" : p.startsWith(href);
  return <Link href={href} data-i={icon} className={active ? "active" : ""}>{icon} &nbsp; {label}</Link>;
}
