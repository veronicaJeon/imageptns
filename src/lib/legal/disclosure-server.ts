import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  DEFAULT_BUSINESS_DISCLOSURE,
  type BusinessDisclosure,
} from "./disclosure";

export async function getBusinessDisclosure(): Promise<BusinessDisclosure> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("business_disclosures")
    .select("*")
    .eq("id", true)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? { ...DEFAULT_BUSINESS_DISCLOSURE, ...data } as BusinessDisclosure : DEFAULT_BUSINESS_DISCLOSURE;
}

export async function getPublicBusinessDisclosure() {
  const disclosure = await getBusinessDisclosure();
  return disclosure.is_published ? disclosure : null;
}
