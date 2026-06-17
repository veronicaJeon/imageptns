export interface LibrarySearchState {
  query: string;
  category: string;
  freeOnly: boolean;
  educationFreeOnly: boolean;
  commercialOnly: boolean;
  derivativesOnly: boolean;
}

export interface PhotoRequestDraft {
  mode: "photo" | null;
  title: string;
  brief: string;
  location_guidance: string;
  category: string;
  tags: string;
  usage_intent: string;
  sourcing_purposes: Array<"rights_check" | "similar_search" | "supply_check">;
}

const CATEGORY_LABELS: Record<string, string> = {
  nature: "자연",
  people: "인물",
  editorial: "에디토리얼",
  urban: "도시/공간",
  abstract: "추상/그래픽",
  architecture: "건축",
};

const CATEGORY_VALUES = new Set(Object.keys(CATEGORY_LABELS));

function cleanText(value: string | null | undefined) {
  return (value ?? "").trim().replace(/\s+/g, " ");
}

function usageLabelsFromParams(params: URLSearchParams) {
  const labels: string[] = [];
  if (params.get("free") === "true") labels.push("무료 사용 가능");
  if (params.get("educationFree") === "true") labels.push("교육용 무료 사용 가능");
  if (params.get("commercial") === "true") labels.push("상업 사용 가능");
  if (params.get("derivatives") === "true") labels.push("원 저작물 변경 가능");
  return labels;
}

function keywordDraft(query: string) {
  return Array.from(new Set(
    query
      .split(/[\s,]+/)
      .map((keyword) => keyword.trim())
      .filter(Boolean)
      .slice(0, 8),
  )).join(", ");
}

export function buildPhotoRequestHref(state: LibrarySearchState) {
  const params = new URLSearchParams();
  params.set("mode", "photo");

  const query = cleanText(state.query);
  if (query) params.set("query", query);
  if (state.category && state.category !== "all") params.set("category", state.category);
  if (state.freeOnly) params.set("free", "true");
  if (state.educationFreeOnly) params.set("educationFree", "true");
  if (state.commercialOnly) params.set("commercial", "true");
  if (state.derivativesOnly) params.set("derivatives", "true");
  params.set("similarSearch", "true");

  return `/contact?${params.toString()}`;
}

function sourcingPurposesFromParams(params: URLSearchParams): PhotoRequestDraft["sourcing_purposes"] {
  const purposes: PhotoRequestDraft["sourcing_purposes"] = [];
  if (params.get("rightsCheck") === "true") purposes.push("rights_check");
  if (params.get("similarSearch") === "true") purposes.push("similar_search");
  if (params.get("supplyCheck") === "true") purposes.push("supply_check");
  return purposes.length > 0 ? purposes : ["similar_search"];
}

export function draftPhotoRequestFromSearchParams(params: URLSearchParams): PhotoRequestDraft {
  const explicitPhotoMode = params.get("mode") === "photo";
  if (!explicitPhotoMode) {
    return {
      mode: null,
      title: "",
      brief: "",
      location_guidance: "",
      category: "editorial",
      tags: "",
      usage_intent: "",
      sourcing_purposes: [],
    };
  }

  const query = cleanText(params.get("query"));
  const categoryParam = cleanText(params.get("category"));
  const category = CATEGORY_VALUES.has(categoryParam) ? categoryParam : "editorial";
  const usageLabels = usageLabelsFromParams(params);
  const lines = [
    query ? `찾고 있는 사진: ${query}` : "찾고 있는 사진:",
    `카테고리: ${CATEGORY_LABELS[category] ?? "에디토리얼"}`,
    usageLabels.length > 0 ? `희망 사용 조건: ${usageLabels.join(", ")}` : "",
    "검색 결과에서 적합한 이미지를 찾지 못해 이미지 소싱 요청으로 전환했습니다.",
    "필요한 장면, 촬영 위치, 대상 지역, 마감일, 예산은 아래 항목에서 보완해주세요.",
  ].filter(Boolean);

  return {
    mode: "photo",
    title: query ? `${query} 이미지 소싱 요청` : "이미지 소싱 요청",
    brief: lines.join("\n"),
    location_guidance: query
      ? "검색어에 지역명이 포함되어 있다면 촬영 위치에는 실제 촬영 지점, 대상 지역에는 작가를 찾을 시/군/구나 권역을 직접 입력해주세요."
      : "촬영 위치에는 실제 촬영 지점, 대상 지역에는 작가를 찾을 시/군/구나 권역을 입력해주세요.",
    category,
    tags: keywordDraft(query),
    usage_intent: usageLabels.length > 0 ? "검색 조건과 동일한 사용 목적 검토" : "",
    sourcing_purposes: sourcingPurposesFromParams(params),
  };
}
