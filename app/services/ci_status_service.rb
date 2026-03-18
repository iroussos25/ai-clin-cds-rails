require "json"
require "net/http"
require "uri"

class CiStatusService
  GITHUB_API_BASE = "https://api.github.com".freeze

  class << self
    def snapshot
      repo = github_repo
      return unavailable("Missing GITHUB_REPOSITORY configuration") if repo.blank?

      latest = latest_workflow_run(repo)
      return unavailable("No workflow runs found") if latest.nil?

      {
        status: "ok",
        provider: "github_actions",
        repository: repo,
        workflow: latest[:workflow_name],
        branch: latest[:branch],
        conclusion: latest[:conclusion] || "in_progress",
        run_started_at: latest[:run_started_at],
        run_updated_at: latest[:run_updated_at],
        run_url: latest[:run_url]
      }
    rescue StandardError => e
      unavailable("Unable to fetch CI status: #{e.message}")
    end

    private

    def github_repo
      ENV["GITHUB_REPOSITORY"].presence ||
        Rails.application.credentials.dig(:github, :repository).presence
    end

    def github_token
      ENV["GITHUB_TOKEN"].presence ||
        Rails.application.credentials.dig(:github, :token).presence
    end

    def latest_workflow_run(repo)
      uri = URI.parse("#{GITHUB_API_BASE}/repos/#{repo}/actions/runs?per_page=1")
      request = Net::HTTP::Get.new(uri)
      request["Accept"] = "application/vnd.github+json"
      request["User-Agent"] = "ai-clin-cds-rails"
      request["Authorization"] = "Bearer #{github_token}" if github_token.present?

      response = http_client(uri).request(request)
      return nil unless response.is_a?(Net::HTTPSuccess)

      payload = JSON.parse(response.body)
      run = payload.fetch("workflow_runs", []).first
      return nil unless run

      {
        workflow_name: run["name"].to_s,
        branch: run["head_branch"].to_s,
        conclusion: run["conclusion"],
        run_started_at: run["run_started_at"],
        run_updated_at: run["updated_at"],
        run_url: run["html_url"].to_s
      }
    end

    def http_client(uri)
      client = Net::HTTP.new(uri.host, uri.port)
      client.use_ssl = true
      client.open_timeout = 5
      client.read_timeout = 8
      client
    end

    def unavailable(message)
      {
        status: "unavailable",
        provider: "github_actions",
        message: message
      }
    end
  end
end
