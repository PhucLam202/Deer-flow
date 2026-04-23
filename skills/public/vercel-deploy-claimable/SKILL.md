---
name: vercel-deploy
description: Deploy applications and websites to Vercel. Use this skill when the user requests deployment actions such as "Deploy my app", "Deploy this to production", "Create a preview deployment", "Deploy and give me the link", or "Push this live". Prefers the claimable deploy endpoint and falls back to the Vercel CLI when needed.
metadata:
  author: vercel
  version: "1.1.0"
---

# Vercel Deploy

Deploy any project to Vercel with a two-step strategy:

1. Try the claimable deploy endpoint first
2. Fall back to the Vercel CLI if the endpoint fails, changes behavior, or no longer returns deployment URLs

## How It Works

1. Packages your project into a tarball (excludes `node_modules` and `.git`)
2. Auto-detects framework from `package.json`
3. Uploads to the claimable deployment service
4. If the claimable service is unavailable, deploys with `vercel --yes --token ...`
5. Returns a **Preview URL**. Claim URL is only available when the claimable endpoint succeeds.

## Usage

```bash
bash /mnt/skills/public/vercel-deploy-claimable/scripts/deploy.sh [path]
```

**Arguments:**
- `path` - Directory to deploy, or a `.tgz` file (defaults to current directory)

**Optional environment variables:**
- `FORCE_VERCEL_CLI=1` - Skip the claimable endpoint and deploy with the Vercel CLI directly
- `VERCEL_TOKEN=...` - Required for CLI fallback
- `VERCEL_TOKEN_FILE=/path/to/.env` - Optional custom file to load `VERCEL_TOKEN` from

**Examples:**

```bash
# Deploy current directory
bash /mnt/skills/public/vercel-deploy-claimable/scripts/deploy.sh

# Deploy specific project
bash /mnt/skills/public/vercel-deploy-claimable/scripts/deploy.sh /path/to/project

# Deploy existing tarball
bash /mnt/skills/public/vercel-deploy-claimable/scripts/deploy.sh /path/to/project.tgz
```

## Output

```
Preparing deployment...
Detected framework: nextjs
Creating deployment package...
Deploying...
✓ Deployment successful!

Preview URL: https://skill-deploy-abc123.vercel.app
Claim URL:   https://vercel.com/claim-deployment?code=...
```

If CLI fallback is used:

```
Preparing deployment...
Detected framework: nextjs
Creating deployment package...
Deploying...
Claimable deploy endpoint did not return a preview URL.
Falling back to Vercel CLI...
Loaded VERCEL_TOKEN from .env

Deployment successful via Vercel CLI!

Preview URL: https://my-project-git-main-abc123.vercel.app
```

The script also outputs JSON to stdout for programmatic use:

```json
{
  "previewUrl": "https://skill-deploy-abc123.vercel.app",
  "claimUrl": "https://vercel.com/claim-deployment?code=...",
  "deploymentId": "dpl_...",
  "projectId": "prj_...",
  "deploymentMethod": "claimable-endpoint"
}
```

CLI fallback returns:

```json
{
  "previewUrl": "https://my-project-git-main-abc123.vercel.app",
  "claimUrl": "",
  "deploymentId": "",
  "projectId": "",
  "deploymentMethod": "vercel-cli"
}
```

## Framework Detection

The script auto-detects frameworks from `package.json`. Supported frameworks include:

- **React**: Next.js, Gatsby, Create React App, Remix, React Router
- **Vue**: Nuxt, Vitepress, Vuepress, Gridsome
- **Svelte**: SvelteKit, Svelte, Sapper
- **Other Frontend**: Astro, Solid Start, Angular, Ember, Preact, Docusaurus
- **Backend**: Express, Hono, Fastify, NestJS, Elysia, h3, Nitro
- **Build Tools**: Vite, Parcel
- **And more**: Blitz, Hydrogen, RedwoodJS, Storybook, Sanity, etc.

For static HTML projects (no `package.json`), framework is set to `null`.

## Static HTML Projects

For projects without a `package.json`:
- If there's a single `.html` file not named `index.html`, it gets renamed automatically
- This ensures the page is served at the root URL (`/`)

## Present Results to User

Always show the Preview URL. Only show the Claim URL when it exists:

```
✓ Deployment successful!

- [Preview URL](https://skill-deploy-abc123.vercel.app)
- [Claim URL](https://vercel.com/claim-deployment?code=...)

View your site at the Preview URL.
To transfer this deployment to your Vercel account, visit the Claim URL.
```

When fallback uses the Vercel CLI, say clearly that the deployment was created with the user's authenticated Vercel account and there may be no claim URL.

## Troubleshooting

### Claimable Endpoint No Longer Deploys

If the endpoint returns guidance to use the CLI, or does not return `previewUrl`, use the CLI fallback:

```bash
pnpm add -g vercel
export VERCEL_TOKEN=your_vercel_token
bash /mnt/skills/public/vercel-deploy-claimable/scripts/deploy.sh /path/to/project
```

The script will automatically switch to the CLI when needed.

### CLI Fallback Setup

Install the Vercel CLI with one of:

```bash
pnpm add -g vercel
# or
npm install -g vercel
```

Provide a token in one of these ways:

```bash
export VERCEL_TOKEN=your_vercel_token
```

or add it to `.env` / `.env.local`:

```bash
VERCEL_TOKEN=your_vercel_token
```

Create a token at:

`https://vercel.com/account/tokens`

### Network Egress Error

If deployment fails due to network restrictions (common on claude.ai), tell the user:

```
Deployment failed due to network restrictions. To fix this:

1. Go to https://claude.ai/settings/capabilities
2. Add *.vercel.com to the allowed domains
3. Try deploying again
```
