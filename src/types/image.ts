export type ImageWithRelations = {
  id: string
  storage_path: string
  title: string
  caption: string | null
  width: number | null
  height: number | null
  view_count: number
  created_at: string
  profiles: { username: string; display_name: string | null; avatar_url: string | null } | null
  image_tags: { tags: { name: string } | null }[]
  image_categories: { categories: { name_ko: string; slug: string } | null }[]
}
