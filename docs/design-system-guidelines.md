# Image Partners Design System Guidelines

## Navigation emphasis and hover policy

- Priority navigation items may use the brand primary color without adding a persistent filled background that could be mistaken for a selected state.
- Hover feedback for a priority action must increase perceived brightness or contrast. Do not darken the brand color by lowering opacity.
- Use the `primary-highlight` color token for brighter brand hover states. In light mode it is a clearer, brighter green than `primary`; in dark mode it advances to the high-luminance brand accent.
- Supporting copy must remain visually subordinate to the menu label through smaller type and lighter weight, while changing to the same highlight family on hover.
- Mobile and desktop variants must preserve the same interaction meaning even when their layouts differ.

## Collapsible search and filter panels

- Keep the primary search row visible when secondary filters are collapsed.
- Place the collapse/expand control at the far right of the primary search row and expose its state with `aria-expanded`, an accessible label, and a tooltip title.
- Collapse category and usage-condition rows as one secondary-filter group so their information hierarchy remains intact.
- Animate height and opacity together, and clip collapsed content to prevent focusable or visible remnants.
- Default to expanded for new users. Persist an explicit user preference locally so returning to the library restores the last chosen state.

## Admin data list policy

- Simple metrics and metadata must default to inline typography, not filled containers. Prefer patterns such as `Views 0 · Sales 0` over separate gray boxes for each value.
- Status values must use compact chips with a shared height, border, and tone scale. Keep related states inline with the record title or row header whenever possible.
- Action buttons must communicate hierarchy consistently: primary for the most common task, secondary for supporting inspection or navigation, and danger for destructive or irreversible actions.
- Data-heavy admin screens should use a bounded page width and either a dense table or a responsive record list. Avoid cards that stretch uncomfortably when there are few results or create excessive vertical bulk when there are many.
- Admin screens should use the shared primitives in `src/components/admin/AdminPrimitives.tsx` before adding page-local badge, button, metric, or list-surface styles.
