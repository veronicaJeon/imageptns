import { NextResponse } from "next/server";
import { allowIncompleteDisclosureForBeta } from "@/lib/checkout/transaction";
import { disclosureIsCompleteForPaidCommerce } from "@/lib/legal/disclosure";
import { getBusinessDisclosure } from "@/lib/legal/disclosure-server";
import { bankTransferAccountIsConfigured } from "@/lib/payments/bank-transfer";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const disclosure = await getBusinessDisclosure();
    const disclosureComplete = disclosureIsCompleteForPaidCommerce(disclosure);
    const betaOverride = allowIncompleteDisclosureForBeta();
    const accountConfigured = bankTransferAccountIsConfigured();
    return NextResponse.json({
      paidOrdersAvailable: accountConfigured && (disclosureComplete || betaOverride),
      disclosureComplete,
      betaOverride,
      accountConfigured,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({
      paidOrdersAvailable: false,
      disclosureComplete: false,
      betaOverride: false,
      accountConfigured: false,
    }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
