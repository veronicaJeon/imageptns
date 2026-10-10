import { NextRequest, NextResponse } from "next/server";
import { forbidden, requireAdminUser } from "@/lib/admin/auth";
import { recordAdminAuditLog } from "@/lib/admin/audit";
import { createAuthLibraryAsset, isAuthPageImageSlot } from "@/lib/auth/library-assets";
import { createAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 60;
export async function POST(req: NextRequest) {
  const user=await requireAdminUser(); if(!user) return forbidden();
  const payload=await req.json().catch(()=>null) as {imageId?:unknown;slot?:unknown}|null;
  const imageId=typeof payload?.imageId === "string" ? payload.imageId.trim() : "";
  if(!imageId || !isAuthPageImageSlot(payload?.slot)) return NextResponse.json({error:"이미지와 적용 위치를 확인해 주세요."},{status:400});
  const admin=createAdminClient();
  try { const asset=await createAuthLibraryAsset(admin,imageId,payload.slot); await recordAdminAuditLog(admin,{actorId:user.id,action:"auth_pages.library_asset_created",targetType:"image",targetId:imageId,targetLabel:asset.assetId ?? asset.title,after:{slot:payload.slot,derivedPath:asset.derivedPath}}); return NextResponse.json(asset); }
  catch(error){ return NextResponse.json({error:error instanceof Error ? error.message : "전시용 이미지를 만들지 못했습니다."},{status:400}); }
}
