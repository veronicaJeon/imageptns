# Vercel Deployment Runbook

Image Partners is linked to Vercel through the repository-local `.vercel/` project config. Do not rely on a globally installed `vercel` binary, because the local machine may not have one on `PATH`.

배포 전후 전체 체크리스트, Supabase 환경 검증, 스모크 테스트, 롤백 기준과 보고 양식은 [운영 배포 인수인계](./production-deployment-handoff.md)를 따른다.

## Production Deploy

Run from the repository root:

```bash
npx vercel deploy --prod --yes
```

This is the canonical manual production deployment command for this workspace.

## Preview Deploy

Run from the repository root:

```bash
npx vercel deploy --yes
```

Use this when a preview URL is enough and the production domain should not be updated.

## Before Deploying

Run the app verification commands first:

```bash
npm run lint
npx tsc --noEmit --pretty false
npm run build
```

If a database migration was added, apply it before the production deploy:

```bash
supabase db push
supabase migration list
```

## Notes

- The linked Vercel project is recorded under `.vercel/repo.json`.
- If `vercel deploy` fails with `command not found`, use `npx vercel deploy ...`; do not stop there.
- If production deployment should reflect GitHub `main`, merge or push the relevant commit to `main` before relying on GitHub/Vercel automatic deployment.
