# Fly.io Deployment Runbook

This repo is configured for container-based deployment on Fly.io.

## 1) Prerequisites (your machine)

- Install Fly CLI: `flyctl`
- Log in: `fly auth login`
- Be in repo root

## 2) One-time app setup

- If app name differs, edit `fly.toml` `app = "..."`
- Create Fly app (if not already created):
  - `fly apps create <your-app-name>`

## 3) Provision Postgres

- Create managed Postgres:
  - `fly postgres create --name <your-db-name> --region iad`
- Attach DB to app (sets `DATABASE_URL`):
  - `fly postgres attach --app <your-app-name> <your-db-name>`

## 4) Set required secrets

Set secrets in Fly (these are required):

- `RAILS_MASTER_KEY`
- `GOOGLE_API_KEY`

Commands:

- `fly secrets set RAILS_MASTER_KEY="<value>" --app <your-app-name>`
- `fly secrets set GOOGLE_API_KEY="<value>" --app <your-app-name>`

Optional but useful:

- `fly secrets set RAILS_LOG_LEVEL="info" --app <your-app-name>`

## 5) Deploy

- `fly deploy --app <your-app-name>`

The deploy runs `./bin/rails db:prepare` via `release_command`.

## 5b) Deploy directly from GitHub

This repo includes a workflow at `.github/workflows/deploy-fly.yml`.

Required GitHub repository secret:

- `FLY_API_TOKEN`

Create token and add it:

- `fly tokens create deploy -x 999999h`
- GitHub repo -> Settings -> Secrets and variables -> Actions -> New repository secret
  - Name: `FLY_API_TOKEN`
  - Value: token from command above

Then deploy by either:

- pushing to `master`, or
- manually running the workflow from Actions -> "Deploy to Fly.io" -> Run workflow

Important: this workflow only deploys code. It does not change Fly app secrets.

## 5c) Resolve "failed to update app secrets: all not found"

Cause: an attempted deploy tried to update a secret key named `all` (or used an invalid secrets update step).

Fix:

1. Set required secrets directly on Fly (one-time):
  - `fly secrets set RAILS_MASTER_KEY="<value>" --app <your-app-name>`
  - `fly secrets set GOOGLE_API_KEY="<value>" --app <your-app-name>`
2. Verify secrets exist:
  - `fly secrets list --app <your-app-name>`
3. Re-run GitHub deploy workflow.

Do not include a step like `fly secrets set all=...`. Secret names must be explicit.

## 6) Verify health

- `fly status --app <your-app-name>`
- `fly logs --app <your-app-name>`
- Open health endpoint:
  - `https://<your-app-name>.fly.dev/up`

## 7) Persistent uploads (if needed)

Current production storage is local disk (`config.active_storage.service = :local`).
For durable uploads, choose one:

- Preferred: object storage (S3-compatible) and configure Active Storage service.
- Alternative: Fly volume + local storage (single-region/single-machine constraints).

## 8) Local run note

If local `rails server` says a server is already running, clear stale state:

- `Get-Process ruby -ErrorAction SilentlyContinue | Stop-Process -Force`
- `Remove-Item tmp\pids\server.pid -ErrorAction SilentlyContinue`
- `bundle exec rails server`
