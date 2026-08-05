# Image Partners

Image Partners is a Korea-focused B2B image library. Buyers can search curated images, request images, obtain free licenses, and request paid licenses by bank transfer. Approved photographers can upload images and use Mistral-assisted metadata generation; administrators review images and operate the service.

The current production policy keeps bank-transfer orders available while online card payments, subscriptions, and on-chain payments remain hidden until their policies and operating requirements are approved.

## Project documentation

- [System definition](docs/system-definition.md): authoritative scope, actors, workflows, data, security boundaries, integrations, and operational baseline
- [Document-driven development](docs/document-driven-development.md): required change process and Definition of Done
- [Documentation index](docs/README.md): domain specifications, runbooks, and active backlog
- [Operations backlog](docs/operations-backlog.md): verified remaining work and evidence
- [Service terminology](docs/service-terminology.md): canonical Korean product language

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Local Development

This project keeps local and remote environments separate. Local development uses the Supabase Docker stack defined by `supabase/config.toml`.

Prerequisites:

- Docker runtime, either Docker Desktop or Colima
- Supabase CLI
- Node.js 20+

On macOS, a CLI-only setup works well:

```bash
brew install docker docker-compose colima supabase/tap/supabase
colima start --cpu 4 --memory 8 --disk 60
```

1. Copy the local env template:

```bash
cp .env.example .env.local
```

2. Start local Supabase through Docker:

```bash
npm run supabase:start
```

3. Copy the local Supabase keys printed by `npm run supabase:status` into `.env.local`:

```bash
npm run supabase:status
```

Use:

- `Project URL` or `API URL` → `NEXT_PUBLIC_SUPABASE_URL`
- `Publishable` or `anon key` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `Secret` or `service_role key` → `SUPABASE_SERVICE_ROLE_KEY`

4. Check that the local API is reachable:

```bash
npm run supabase:check
```

5. Start the app on the host:

```bash
npm run dev
```

Or start Supabase and the app together:

```bash
npm run dev:local
```

6. If running the web app itself inside Docker, create a Docker env file:

```bash
cp .env.docker.example .env.docker.local
npm run supabase:status
```

Copy the local anon/service keys into `.env.docker.local`. Keep `NEXT_PUBLIC_SUPABASE_URL=http://host.docker.internal:55001` so the web container can reach the host Supabase stack.

Then launch the web container:

```bash
docker compose up --build
```

Local services:

- App: `http://localhost:3000`
- Supabase API: `http://127.0.0.1:55001`
- Supabase DB: `postgresql://postgres:postgres@127.0.0.1:55002/postgres`
- Supabase Studio: `http://127.0.0.1:55003`
- Local email inbox: `http://127.0.0.1:55005`

Useful commands:

```bash
npm run supabase:start
npm run supabase:stop
npm run supabase:status
npm run supabase:reset
npm run supabase:check
```

Make sure `.env.local` and `.env.docker.local` are not committed.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
