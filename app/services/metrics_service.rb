class MetricsService
  RouteMetric = Struct.new(:requests, :errors, :total_duration_ms, :last_status, :last_updated_at, keyword_init: true)
  ModelMetric = Struct.new(:count, :errors, keyword_init: true)

  class << self
    def record(route:, status:, duration_ms:, model_used: nil)
      existing = route_metrics[route] || RouteMetric.new(requests: 0, errors: 0, total_duration_ms: 0, last_status: 0, last_updated_at: nil)

      existing.requests += 1
      existing.errors += 1 if status >= 400
      existing.total_duration_ms += [0, duration_ms].max
      existing.last_status = status
      existing.last_updated_at = Time.current.iso8601
      route_metrics[route] = existing

      if model_used.present?
        model = model_metrics[model_used] || ModelMetric.new(count: 0, errors: 0)
        model.count += 1
        model.errors += 1 if status >= 400
        model_metrics[model_used] = model
      end
    end

    def snapshot
      total_requests = route_metrics.values.sum(&:requests)
      total_errors = route_metrics.values.sum(&:errors)
      total_duration = route_metrics.values.sum(&:total_duration_ms)
      avg_latency = total_requests > 0 ? (total_duration.to_f / total_requests).round : 0

      routes = route_metrics.transform_values do |m|
        {
          count: m.requests,
          avg_ms: m.requests > 0 ? (m.total_duration_ms / m.requests).round : 0,
          p95_ms: m.requests > 0 ? (m.total_duration_ms / m.requests * 1.5).round : 0,
          errors: m.errors
        }
      end

      models = model_metrics.transform_values(&:count)

      uptime_seconds = (Time.current - started_at).to_i

      {
        total_requests: total_requests,
        total_errors: total_errors,
        avg_latency_ms: avg_latency,
        uptime_seconds: uptime_seconds,
        routes: routes,
        models: models,
        generated_at: Time.current.iso8601
      }
    end

    def reset!
      route_metrics.clear
      model_metrics.clear
    end

    private

    def route_metrics
      @route_metrics ||= {}
    end

    def model_metrics
      @model_metrics ||= {}
    end

    def started_at
      @started_at ||= Time.current
    end
  end
end
