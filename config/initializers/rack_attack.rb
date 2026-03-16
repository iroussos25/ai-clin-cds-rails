# Rate limiting configuration for clinical API endpoints
# Mirrors the security rules from the Next.js implementation

class Rack::Attack
  # Throttle general API requests by IP
  throttle("api/ip", limit: 100, period: 60.seconds) do |req|
    req.ip if req.path.start_with?("/api/")
  end

  # Stricter throttle for AI analysis (expensive operation)
  throttle("api/analyze", limit: 50, period: 60.seconds) do |req|
    req.ip if req.path == "/api/analyze" && req.post?
  end

  # Clinical review rate limit
  throttle("api/clinical_review", limit: 30, period: 60.seconds) do |req|
    req.ip if req.path == "/api/clinical_review" && req.post?
  end

  # File upload rate limit
  throttle("api/upload", limit: 12, period: 60.seconds) do |req|
    req.ip if req.path == "/api/upload" && req.post?
  end

  # Metrics endpoint rate limit
  throttle("api/ops/metrics", limit: 10, period: 60.seconds) do |req|
    req.ip if req.path == "/api/ops/metrics"
  end

  # Block suspicious requests
  blocklist("block/bad-paths") do |req|
    # Block common exploit paths
    req.path.match?(%r{\.\./|\.env|/wp-admin|/phpMyAdmin}i)
  end

  # Custom response for throttled requests
  self.throttled_responder = lambda do |req|
    match_data = req.env["rack.attack.match_data"]
    now = match_data[:epoch_time]
    retry_after = match_data[:period] - (now % match_data[:period])

    [
      429,
      {
        "Content-Type" => "application/json",
        "Retry-After" => retry_after.to_s
      },
      [{ error: "Rate limit exceeded. Try again in #{retry_after} seconds." }.to_json]
    ]
  end
end
