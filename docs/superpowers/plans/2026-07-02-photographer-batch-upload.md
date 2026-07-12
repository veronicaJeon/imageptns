# Photographer Batch Upload Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 사진작가 이미지 업로드 화면에서 여러 장을 한 번에 선택하고, 공통 필드와 파일별 필드를 편집한 뒤 순차 제출할 수 있게 한다.

**Architecture:** 서버 API는 그대로 두고, 클라이언트에 업로드 대기열을 추가한다. 순수 helper는 `src/lib/uploads/batch-client.ts`에 두어 파일 선택, 중복 제거, 제출 가능 여부를 테스트한다.

**Tech Stack:** Next.js client component, TypeScript, Supabase signed upload API, Vitest.

---

### Task 1: Batch Helper

**Files:**
- Create: `src/lib/uploads/batch-client.ts`
- Test: `src/lib/uploads/batch-client.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, expect, it } from "vitest";
import {
  canSubmitUploadBatch,
  dedupeUploadFiles,
  filterAcceptedUploadFiles,
  initialDraftIdForFiles,
} from "./batch-client";

const jpg = (name: string, sizeMb = 1, lastModified = 1) => ({
  name,
  type: "image/jpeg",
  size: sizeMb * 1024 * 1024,
  lastModified,
}) as File;

describe("batch upload client helpers", () => {
  it("keeps only the first copy of the same browser file", () => {
    const first = jpg("a.jpg", 1, 10);
    expect(dedupeUploadFiles([first, jpg("a.jpg", 1, 10), jpg("b.jpg", 1, 10)])).toEqual([first, jpg("b.jpg", 1, 10)]);
  });

  it("filters unsupported or oversized files", () => {
    const result = filterAcceptedUploadFiles([
      jpg("ok.jpg"),
      { ...jpg("bad.gif"), type: "image/gif" } as File,
      jpg("big.jpg", 501),
    ]);
    expect(result.accepted.map((file) => file.name)).toEqual(["ok.jpg"]);
    expect(result.rejected).toHaveLength(2);
  });

  it("uses the first valid file as the initial active draft", () => {
    expect(initialDraftIdForFiles([jpg("a.jpg", 1, 20), jpg("b.jpg", 1, 30)])).toBe("a.jpg:1048576:20");
  });

  it("requires valid per-file fields and common attestations before submit", () => {
    expect(canSubmitUploadBatch({
      drafts: [{
        id: "a",
        title: "Title",
        description: "Description",
        categoryCodes: ["nature"],
        tags: "tag",
        takenAt: "unknown",
        location: "unknown",
        uploadStatus: "idle",
      }],
      authorshipDeclaration: "human_original",
      factualityAgreed: true,
      busy: false,
    })).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/uploads/batch-client.test.ts`
Expected: FAIL because `src/lib/uploads/batch-client.ts` does not exist.

- [ ] **Step 3: Implement helper**

Create helper functions for file IDs, accepted type filtering, duplicate removal, active ID selection, and submit readiness.

- [ ] **Step 4: Run helper tests**

Run: `npx vitest run src/lib/uploads/batch-client.test.ts`
Expected: PASS.

### Task 2: Upload Page Queue

**Files:**
- Modify: `src/app/(dashboard)/dashboard/uploads/new/page.tsx`

- [ ] **Step 1: Replace single file state with draft queue**

Add `UploadDraft` state, `activeDraftId`, and derived `activeDraft`.

- [ ] **Step 2: Allow multi-select and multi-drop**

Use `<input multiple>` and iterate `DataTransfer.files`.

- [ ] **Step 3: Preserve AI/EXIF analysis per file**

Run existing AI analysis for each new draft and merge results into the matching draft.

- [ ] **Step 4: Move file-specific form fields onto active draft**

Title, description, tags, categories, shooting date/location, dimensions, rotation, EXIF data, AI status, progress, and error live per draft.

- [ ] **Step 5: Keep rights and attestations common**

Copyright license, free usage policy, attribution, authorship declaration, and factuality attestation stay as common fields applied to every submitted image.

- [ ] **Step 6: Submit drafts sequentially**

For each pending or failed draft, call `/api/uploads/presign`, upload the original file, then call `/api/uploads`. Continue after failures and mark each item.

### Task 3: Verification and Deployment

**Files:**
- No code files beyond Task 1 and Task 2.

- [ ] **Step 1: Run focused tests**

Run: `npx vitest run src/lib/uploads/batch-client.test.ts`
Expected: PASS.

- [ ] **Step 2: Run regression tests**

Run: `npx vitest run src/lib/uploads/batch-client.test.ts src/lib/images/categories.test.ts src/lib/admin/nav.test.ts src/lib/checkout/success-downloads.test.ts`
Expected: PASS.

- [ ] **Step 3: Run lint, typecheck, build**

Run: `npm run lint`
Expected: 0 errors.

Run: `npx tsc --noEmit --pretty false`
Expected: exit 0.

Run: `npm run build`
Expected: exit 0.

- [ ] **Step 4: Deploy production from clean temp folder**

Use the existing Vercel project config and include only current scoped files plus previously deployed uncommitted files.

- [ ] **Step 5: Smoke test production**

Check `/dashboard/uploads/new`, `/api/categories`, and `/api/uploads/presign` unauthenticated response shape on `https://www.imagepartners.kr`.
