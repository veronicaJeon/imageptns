import { NextResponse } from "next/server";
import { isCommerceEnabled } from "@/lib/commerce/availability";

export const dynamic = "force-static";

const PLANS = [
  { id: "basic",      price_monthly: 29000,  price_annual: 23200  },
  { id: "pro",        price_monthly: 79000,  price_annual: 63200  },
  { id: "enterprise", price_monthly: 199000, price_annual: 159200 },
] as const;

export function GET() {
  if (!isCommerceEnabled()) {
    return NextResponse.json({ error: "Subscription plans are not available yet" }, { status: 503 });
  }
  return NextResponse.json({ plans: PLANS });
}
