export interface SimilarityImageMetadata {
  id: string;
  title: string;
  title_ko?: string | null;
  title_en?: string | null;
  description?: string | null;
  description_ko?: string | null;
  description_en?: string | null;
  tags?: string[] | null;
  tags_ko?: string[] | null;
  tags_en?: string[] | null;
  exif_location?: string | null;
  photographer_id?: string | null;
  categoryCodes: string[];
}

// Search stop words: these are deliberately ignored because matching on them
// alone (for example, two unrelated titles containing "사진") creates false
// recommendations. This is unrelated to the admin-managed category taxonomy.
const SIMILARITY_STOP_WORDS = new Set([
  "사진", "이미지", "모습", "풍경", "전경", "장면", "촬영", "대한민국", "한국",
  "photo", "image", "view", "scene", "photograph", "photography", "korea", "south",
  "the", "and", "with", "from", "front", "side",
]);

function normalizedText(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function terms(values: Array<string | null | undefined>) {
  return new Set(
    values
      .flatMap((value) => normalizedText(value).split(/\s+/))
      .filter((term) => term.length >= 2 && !SIMILARITY_STOP_WORDS.has(term)),
  );
}

function intersectionSize(left: Set<string>, right: Set<string>) {
  let count = 0;
  for (const value of left) if (right.has(value)) count += 1;
  return count;
}

function flattenedTags(image: SimilarityImageMetadata) {
  return [...(image.tags ?? []), ...(image.tags_ko ?? []), ...(image.tags_en ?? [])];
}

function flattenedTitles(image: SimilarityImageMetadata) {
  return [image.title, image.title_ko, image.title_en];
}

export function similaritySearchTerms(image: SimilarityImageMetadata) {
  const titleTerms = terms(flattenedTitles(image));
  const tagTerms = terms(flattenedTags(image));
  return Array.from(new Set([...titleTerms, ...tagTerms]))
    .sort((a, b) => b.length - a.length)
    .slice(0, 8);
}

function scoreSimilarity(current: SimilarityImageMetadata, candidate: SimilarityImageMetadata) {
  const currentTitles = flattenedTitles(current).map(normalizedText).filter(Boolean);
  const candidateTitles = flattenedTitles(candidate).map(normalizedText).filter(Boolean);
  const currentTitleTerms = terms(flattenedTitles(current));
  const candidateTitleTerms = terms(flattenedTitles(candidate));
  const sharedTitleTerms = intersectionSize(currentTitleTerms, candidateTitleTerms);

  const currentTagTerms = terms(flattenedTags(current));
  const candidateTagTerms = terms(flattenedTags(candidate));
  const sharedTags = intersectionSize(currentTagTerms, candidateTagTerms);

  const currentLocation = normalizedText(current.exif_location);
  const candidateLocation = normalizedText(candidate.exif_location);
  const sharedLocationTerms = intersectionSize(terms([currentLocation]), terms([candidateLocation]));

  const currentDescriptionTerms = terms([current.description, current.description_ko, current.description_en]);
  const candidateDescriptionTerms = terms([candidate.description, candidate.description_ko, candidate.description_en]);
  const sharedDescriptionTerms = intersectionSize(currentDescriptionTerms, candidateDescriptionTerms);

  const exactTitle = currentTitles.some((title) => candidateTitles.includes(title));
  const containedTitle = currentTitles.some((left) =>
    candidateTitles.some((right) => left.length >= 4 && right.length >= 4 && (left.includes(right) || right.includes(left))),
  );
  const exactLocation = currentLocation.length >= 2 && currentLocation === candidateLocation;
  const containedLocation = currentLocation.length >= 2 && candidateLocation.length >= 2
    && (currentLocation.includes(candidateLocation) || candidateLocation.includes(currentLocation));
  const sharedCategories = intersectionSize(new Set(current.categoryCodes), new Set(candidate.categoryCodes));

  let semanticScore = 0;
  if (exactTitle) semanticScore += 60;
  else if (containedTitle) semanticScore += 35;
  semanticScore += Math.min(sharedTitleTerms, 3) * 28;
  semanticScore += Math.min(sharedTags, 4) * 24;
  if (exactLocation) semanticScore += 55;
  else if (containedLocation) semanticScore += 35;
  else semanticScore += Math.min(sharedLocationTerms, 2) * 20;
  semanticScore += Math.min(sharedDescriptionTerms, 4) * 4;

  const tieBreaker = sharedCategories * 5 + (current.photographer_id === candidate.photographer_id ? 2 : 0);
  return { score: semanticScore + tieBreaker, semanticScore };
}

export function rankSimilarImages<T extends SimilarityImageMetadata>(current: SimilarityImageMetadata, candidates: T[]) {
  return candidates
    .filter((candidate) => candidate.id !== current.id)
    .map((image) => ({ image, ...scoreSimilarity(current, image) }))
    .filter(({ semanticScore }) => semanticScore >= 20)
    .sort((a, b) => b.score - a.score || a.image.id.localeCompare(b.image.id));
}
