#!/bin/bash

# Vercel Deployment Script
# Usage: ./deploy.sh [project-path]
# Prefers the claimable deploy endpoint and falls back to the Vercel CLI when
# the endpoint is unavailable or no longer returns deployment URLs.

set -euo pipefail

DEPLOY_ENDPOINT="https://claude-skills-deploy.vercel.com/api/deploy"
SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)

# Detect framework from package.json
detect_framework() {
    local pkg_json="$1"

    if [ ! -f "$pkg_json" ]; then
        echo "null"
        return
    fi

    local content=$(cat "$pkg_json")

    # Helper to check if a package exists in dependencies or devDependencies
    has_dep() {
        echo "$content" | grep -q "\"$1\""
    }

    # Order matters - check more specific frameworks first

    # Blitz
    if has_dep "blitz"; then echo "blitzjs"; return; fi

    # Next.js
    if has_dep "next"; then echo "nextjs"; return; fi

    # Gatsby
    if has_dep "gatsby"; then echo "gatsby"; return; fi

    # Remix
    if has_dep "@remix-run/"; then echo "remix"; return; fi

    # React Router (v7 framework mode)
    if has_dep "@react-router/"; then echo "react-router"; return; fi

    # TanStack Start
    if has_dep "@tanstack/start"; then echo "tanstack-start"; return; fi

    # Astro
    if has_dep "astro"; then echo "astro"; return; fi

    # Hydrogen (Shopify)
    if has_dep "@shopify/hydrogen"; then echo "hydrogen"; return; fi

    # SvelteKit
    if has_dep "@sveltejs/kit"; then echo "sveltekit-1"; return; fi

    # Svelte (standalone)
    if has_dep "svelte"; then echo "svelte"; return; fi

    # Nuxt
    if has_dep "nuxt"; then echo "nuxtjs"; return; fi

    # Vue with Vitepress
    if has_dep "vitepress"; then echo "vitepress"; return; fi

    # Vue with Vuepress
    if has_dep "vuepress"; then echo "vuepress"; return; fi

    # Gridsome
    if has_dep "gridsome"; then echo "gridsome"; return; fi

    # SolidStart
    if has_dep "@solidjs/start"; then echo "solidstart-1"; return; fi

    # Docusaurus
    if has_dep "@docusaurus/core"; then echo "docusaurus-2"; return; fi

    # RedwoodJS
    if has_dep "@redwoodjs/"; then echo "redwoodjs"; return; fi

    # Hexo
    if has_dep "hexo"; then echo "hexo"; return; fi

    # Eleventy
    if has_dep "@11ty/eleventy"; then echo "eleventy"; return; fi

    # Angular / Ionic Angular
    if has_dep "@ionic/angular"; then echo "ionic-angular"; return; fi
    if has_dep "@angular/core"; then echo "angular"; return; fi

    # Ionic React
    if has_dep "@ionic/react"; then echo "ionic-react"; return; fi

    # Create React App
    if has_dep "react-scripts"; then echo "create-react-app"; return; fi

    # Ember
    if has_dep "ember-cli" || has_dep "ember-source"; then echo "ember"; return; fi

    # Dojo
    if has_dep "@dojo/framework"; then echo "dojo"; return; fi

    # Polymer
    if has_dep "@polymer/"; then echo "polymer"; return; fi

    # Preact
    if has_dep "preact"; then echo "preact"; return; fi

    # Stencil
    if has_dep "@stencil/core"; then echo "stencil"; return; fi

    # UmiJS
    if has_dep "umi"; then echo "umijs"; return; fi

    # Sapper (legacy Svelte)
    if has_dep "sapper"; then echo "sapper"; return; fi

    # Saber
    if has_dep "saber"; then echo "saber"; return; fi

    # Sanity
    if has_dep "sanity"; then echo "sanity-v3"; return; fi
    if has_dep "@sanity/"; then echo "sanity"; return; fi

    # Storybook
    if has_dep "@storybook/"; then echo "storybook"; return; fi

    # NestJS
    if has_dep "@nestjs/core"; then echo "nestjs"; return; fi

    # Elysia
    if has_dep "elysia"; then echo "elysia"; return; fi

    # Hono
    if has_dep "hono"; then echo "hono"; return; fi

    # Fastify
    if has_dep "fastify"; then echo "fastify"; return; fi

    # h3
    if has_dep "h3"; then echo "h3"; return; fi

    # Nitro
    if has_dep "nitropack"; then echo "nitro"; return; fi

    # Express
    if has_dep "express"; then echo "express"; return; fi

    # Vite (generic - check last among JS frameworks)
    if has_dep "vite"; then echo "vite"; return; fi

    # Parcel
    if has_dep "parcel"; then echo "parcel"; return; fi

    # No framework detected
    echo "null"
}

# Parse arguments
INPUT_PATH="${1:-.}"

# Create temp directory for packaging
TEMP_DIR=$(mktemp -d)
TARBALL="$TEMP_DIR/project.tgz"
CLEANUP_TEMP=true

cleanup() {
    if [ "$CLEANUP_TEMP" = true ]; then
        rm -rf "$TEMP_DIR"
    fi
}
trap cleanup EXIT

extract_json_value() {
    local key="$1"
    local json="$2"
    printf '%s' "$json" | grep -o "\"$key\":\"[^\"]*\"" | head -1 | cut -d'"' -f4
}

find_token_file() {
    local project_path_safe
    local candidate
    project_path_safe="${PROJECT_PATH:-}"
    for candidate in \
        "${VERCEL_TOKEN_FILE:-}" \
        "$project_path_safe/.env" \
        "$project_path_safe/.env.local" \
        "$PWD/.env" \
        "$PWD/.env.local" \
        "$SCRIPT_DIR/../.env"
    do
        if [ -n "${candidate:-}" ] && [ -f "$candidate" ]; then
            echo "$candidate"
            return 0
        fi
    done
    return 1
}

load_vercel_token() {
    if [ -n "${VERCEL_TOKEN:-}" ]; then
        return 0
    fi

    local token_file
    if token_file=$(find_token_file); then
        local token_line
        token_line=$(grep -E '^[[:space:]]*VERCEL_TOKEN=' "$token_file" | tail -1 || true)
        if [ -n "$token_line" ]; then
            VERCEL_TOKEN="${token_line#*=}"
            VERCEL_TOKEN="${VERCEL_TOKEN%\"}"
            VERCEL_TOKEN="${VERCEL_TOKEN#\"}"
            export VERCEL_TOKEN
            echo "Loaded VERCEL_TOKEN from $token_file" >&2
            return 0
        fi
    fi

    return 1
}

print_cli_setup_help() {
    cat >&2 <<'EOF'
Vercel CLI fallback requires authentication.

Setup steps:
1. Install the CLI:
   pnpm add -g vercel
   # or: npm install -g vercel
2. Provide a token:
   export VERCEL_TOKEN=your_vercel_token
   # or add VERCEL_TOKEN=... to .env / .env.local
3. Run the deploy script again.

You can create a token at https://vercel.com/account/tokens
EOF
}

deploy_with_vercel_cli() {
    echo "Falling back to Vercel CLI..." >&2

    if ! command -v vercel >/dev/null 2>&1; then
        echo "Error: Vercel CLI is not installed." >&2
        print_cli_setup_help
        exit 1
    fi

    if ! load_vercel_token; then
        echo "Error: VERCEL_TOKEN is not set for Vercel CLI fallback." >&2
        print_cli_setup_help
        exit 1
    fi

    local deploy_target="$PROJECT_PATH"
    if [ -z "${deploy_target:-}" ]; then
        deploy_target="$TEMP_DIR/cli-project"
        mkdir -p "$deploy_target"
        tar -xzf "$TARBALL" -C "$deploy_target"
    fi

    local cli_stdout cli_stderr exit_code preview_url escaped_url
    cli_stdout="$TEMP_DIR/vercel.stdout"
    cli_stderr="$TEMP_DIR/vercel.stderr"
    exit_code=0
    vercel --cwd "$deploy_target" --token "$VERCEL_TOKEN" --yes >"$cli_stdout" 2>"$cli_stderr" || exit_code=$?

    if [ "$exit_code" -ne 0 ]; then
        echo "Error: Vercel CLI deployment failed." >&2
        cat "$cli_stderr" >&2
        exit "$exit_code"
    fi

    preview_url=$(tr -d '\r' <"$cli_stdout" | tail -1)
    if [ -z "$preview_url" ]; then
        echo "Error: Vercel CLI did not return a deployment URL." >&2
        cat "$cli_stderr" >&2
        exit 1
    fi

    echo "" >&2
    echo "Deployment successful via Vercel CLI!" >&2
    echo "" >&2
    echo "Preview URL: $preview_url" >&2
    echo "" >&2

    escaped_url=$(printf '%s' "$preview_url" | sed 's/"/\\"/g')
    printf '{"previewUrl":"%s","claimUrl":"","deploymentId":"","projectId":"","deploymentMethod":"vercel-cli"}\n' "$escaped_url"
}

echo "Preparing deployment..." >&2

# Check if input is a .tgz file or a directory
FRAMEWORK="null"

if [ -f "$INPUT_PATH" ] && [[ "$INPUT_PATH" == *.tgz ]]; then
    # Input is already a tarball, use it directly
    echo "Using provided tarball..." >&2
    TARBALL="$INPUT_PATH"
    CLEANUP_TEMP=false
    # Can't detect framework from tarball, leave as null
elif [ -d "$INPUT_PATH" ]; then
    # Input is a directory, need to tar it
    PROJECT_PATH=$(cd "$INPUT_PATH" && pwd)

    # Detect framework from package.json
    FRAMEWORK=$(detect_framework "$PROJECT_PATH/package.json")

    # Check if this is a static HTML project (no package.json)
    if [ ! -f "$PROJECT_PATH/package.json" ]; then
        # Find HTML files in root
        HTML_FILES=$(find "$PROJECT_PATH" -maxdepth 1 -name "*.html" -type f)
        HTML_COUNT=$(echo "$HTML_FILES" | grep -c . || echo 0)

        # If there's exactly one HTML file and it's not index.html, rename it
        if [ "$HTML_COUNT" -eq 1 ]; then
            HTML_FILE=$(echo "$HTML_FILES" | head -1)
            BASENAME=$(basename "$HTML_FILE")
            if [ "$BASENAME" != "index.html" ]; then
                echo "Renaming $BASENAME to index.html..." >&2
                mv "$HTML_FILE" "$PROJECT_PATH/index.html"
            fi
        fi
    fi

    # Create tarball of the project (excluding node_modules and .git)
    echo "Creating deployment package..." >&2
    tar -czf "$TARBALL" -C "$PROJECT_PATH" --exclude='node_modules' --exclude='.git' .
else
    echo "Error: Input must be a directory or a .tgz file" >&2
    exit 1
fi

if [ "$FRAMEWORK" != "null" ]; then
    echo "Detected framework: $FRAMEWORK" >&2
fi

# Deploy
echo "Deploying..." >&2
RESPONSE=""
CURL_EXIT_CODE=0

if [ "${FORCE_VERCEL_CLI:-0}" = "1" ]; then
    deploy_with_vercel_cli
    exit 0
fi

if ! RESPONSE=$(curl -s -X POST "$DEPLOY_ENDPOINT" -F "file=@$TARBALL" -F "framework=$FRAMEWORK"); then
    CURL_EXIT_CODE=$?
fi

# Check for error in response
if echo "$RESPONSE" | grep -q '"error"'; then
    ERROR_MSG=$(echo "$RESPONSE" | grep -o '"error":"[^"]*"' | cut -d'"' -f4)
    echo "Error: $ERROR_MSG" >&2
    echo "Claimable deploy failed, trying Vercel CLI fallback..." >&2
    deploy_with_vercel_cli
    exit 0
fi

# Extract URLs from response
PREVIEW_URL=$(extract_json_value "previewUrl" "$RESPONSE")
CLAIM_URL=$(extract_json_value "claimUrl" "$RESPONSE")

if [ "$CURL_EXIT_CODE" -ne 0 ] || [ -z "$PREVIEW_URL" ]; then
    if [ "$CURL_EXIT_CODE" -ne 0 ]; then
        echo "Claimable deploy endpoint request failed (curl exit code $CURL_EXIT_CODE)." >&2
    else
        echo "Claimable deploy endpoint did not return a preview URL." >&2
        echo "$RESPONSE" >&2
    fi
    deploy_with_vercel_cli
    exit 0
fi

echo "" >&2
echo "Deployment successful!" >&2
echo "" >&2
echo "Preview URL: $PREVIEW_URL" >&2
echo "Claim URL:   $CLAIM_URL" >&2
echo "" >&2

# Output JSON for programmatic use
echo "$RESPONSE"
