import "server-only";

import { checkoutRequestHash, CHECKOUT_CONSENT_TEXT_KO, CHECKOUT_TERMS_VERSION } from "./transaction";
import { getBusinessDisclosure } from "@/lib/legal/disclosure-server";
import { createAdminClient } from "@/lib/supabase/admin";

interface LegalDocumentRow {
  slug: string;
  title: string;
  body: string;
  published_at: string | null;
  updated_at: string | null;
}

export async function buildCheckoutTermsSnapshot() {
  const [disclosure, legalDocuments] = await Promise.all([
    getBusinessDisclosure(),
    createAdminClient()
      .from("legal_documents")
      .select("slug, title, body, published_at, updated_at")
      .in("slug", ["terms", "license_guide"])
      .eq("is_published", true),
  ]);

  if (legalDocuments.error) throw new Error(legalDocuments.error.message);
  const documents = (legalDocuments.data ?? []) as LegalDocumentRow[];
  const terms = documents.find((document) => document.slug === "terms");
  const licenseGuide = documents.find((document) => document.slug === "license_guide");
  if (!terms || !licenseGuide) throw new Error("Published checkout legal documents are incomplete");

  const publishedValue = <T>(show: boolean, value: T) => disclosure.is_published && show ? value : null;

  const snapshot = {
    version: CHECKOUT_TERMS_VERSION,
    consentText: CHECKOUT_CONSENT_TEXT_KO,
    acceptedDocuments: {
      terms: {
        title: terms.title,
        body: terms.body,
        publishedAt: terms.published_at,
        updatedAt: terms.updated_at,
        sha256: checkoutRequestHash(terms.body),
      },
      licenseGuide: {
        title: licenseGuide.title,
        body: licenseGuide.body,
        publishedAt: licenseGuide.published_at,
        updatedAt: licenseGuide.updated_at,
        sha256: checkoutRequestHash(licenseGuide.body),
      },
    },
    businessDisclosure: {
      businessName: publishedValue(disclosure.show_business_name, disclosure.business_name),
      representativeName: publishedValue(disclosure.show_representative_name, disclosure.representative_name),
      businessRegistrationNumber: publishedValue(
        disclosure.show_business_registration_number,
        disclosure.business_registration_number,
      ),
      address: publishedValue(disclosure.show_address, disclosure.address),
      publicPhone: publishedValue(disclosure.show_public_phone, disclosure.public_phone),
      publicEmail: publishedValue(disclosure.show_public_email, disclosure.public_email),
      ecommerceRegistrationNumber: publishedValue(
        disclosure.show_ecommerce_registration,
        disclosure.ecommerce_registration_number,
      ),
      ecommerceRegistrationAuthority: publishedValue(
        disclosure.show_ecommerce_registration,
        disclosure.ecommerce_registration_authority,
      ),
      refundPolicy: disclosure.refund_policy,
      receiptPolicy: disclosure.receipt_policy,
      isPublished: disclosure.is_published,
      updatedAt: disclosure.updated_at,
    },
  };

  return { disclosure, snapshot };
}
