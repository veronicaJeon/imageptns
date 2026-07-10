export const IMAGE_CATEGORIES = [
  { code: "nature", ko: "자연/풍경", en: "Nature / Landscape" },
  { code: "heritage", ko: "역사/문화재", en: "History / Heritage" },
  { code: "architecture", ko: "도시/건축", en: "Urban / Architecture" },
  { code: "people", ko: "인물/생활", en: "People / Lifestyle" },
  { code: "editorial", ko: "보도/현장", en: "Editorial / Documentary" },
  { code: "object", ko: "예술/오브제", en: "Art / Object" },
  { code: "education", ko: "교육자료", en: "Educational Material" },
  { code: "urban", ko: "도시/거리", en: "City / Street" },
  { code: "abstract", ko: "추상/배경", en: "Abstract / Background" },
] as const;

export type ImageCategoryCode = (typeof IMAGE_CATEGORIES)[number]["code"];

export function isImageCategoryCode(value: string): value is ImageCategoryCode {
  return IMAGE_CATEGORIES.some((category) => category.code === value);
}

export function imageCategoryLabel(value: string | null | undefined, lang: "ko" | "en") {
  const category = IMAGE_CATEGORIES.find((item) => item.code === value);
  return category ? category[lang] : value || "-";
}

export function imageCategoryPromptList() {
  return IMAGE_CATEGORIES.map((category) => category.code).join(" | ");
}
