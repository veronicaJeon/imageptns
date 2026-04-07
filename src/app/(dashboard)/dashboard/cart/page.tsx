"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// /dashboard/cart → redirect to public /cart
export default function DashboardCartPage() {
  const router = useRouter();
  useEffect(() => { router.replace("/cart"); }, [router]);
  return null;
}
