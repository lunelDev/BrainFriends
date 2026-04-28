import { redirect } from "next/navigation";

export default function AdminReportsPage() {
  redirect("/admin?section=samd");
}
