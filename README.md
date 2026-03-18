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

## Testing

This project uses Rails' built-in Minitest.

Run the suite locally:

```powershell
set DATABASE_HOST=localhost
set DATABASE_PORT=5432
set DATABASE_USERNAME=postgres
set DATABASE_PASSWORD=your_password_here
bundle exec rails test
```

Run a specific file:

```powershell
bundle exec rails test test/services/metrics_service_test.rb
```

## Benchmarks Dashboard + CI Status

The Benchmarks panel has two concerns:

- Test Suite: runtime AI benchmark scenarios (latency/cost/consistency)
- Ops Metrics: live API telemetry plus CI status from GitHub Actions

To enable CI status in the dashboard, set:

- `GITHUB_REPOSITORY` (example: `owner/repo`)
- Optional `GITHUB_TOKEN` for higher API rate limits/private repos

## Deployment (Fly.io)

Fly configuration is in `fly.toml`.

Use the full runbook in `DEPLOY_FLY.md`.
