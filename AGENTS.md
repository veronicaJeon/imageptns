<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Image Partners project rules

Before changing product behavior, data, permissions, integrations, operations, or user-facing terms, read:

1. `docs/system-definition.md`
2. `docs/document-driven-development.md`
3. The domain documents linked from the system definition

Treat the system definition as the approved product baseline. If code and documentation disagree, do not silently choose one: verify the running behavior, record the discrepancy as a defect or decision, and update both in the same change where possible.

Every behavior-changing change must include the applicable documentation update, tests for its acceptance criteria, and an entry in the operations backlog or release evidence when follow-up work remains. Preserve the Korean service terminology in `docs/service-terminology.md`. Never put credentials, personal data, private image URLs, or production environment values in documentation.
