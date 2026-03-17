# AI Clinical CDS Rails

Rails 8 application for AI-assisted clinical decision support workflows.

## Local Setup

1. Install Ruby `3.2.10` and bundle dependencies.
2. Configure a Postgres connection for development via either:
	- `DATABASE_URL`, or
	- `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_USERNAME`, `DATABASE_PASSWORD`.
3. Run:

```powershell
bundle install
bundle exec rails db:prepare
bundle exec rails tailwindcss:build
bundle exec rails server
```

If startup says a server is already running, clear stale processes/PID:

```powershell
Get-Process ruby -ErrorAction SilentlyContinue | Stop-Process -Force
Remove-Item tmp\pids\server.pid -ErrorAction SilentlyContinue
bundle exec rails server
```

## Deployment (Fly.io)

Fly configuration is in `fly.toml`.

Use the full runbook in `DEPLOY_FLY.md`.
