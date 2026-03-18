require "test_helper"

class MetricsServiceTest < ActiveSupport::TestCase
  setup do
    MetricsService.reset!
  end

  test "record accumulates route and model counters" do
    MetricsService.record(route: "/api/analyze", status: 200, duration_ms: 120, model_used: "gemini-2.5-flash")
    MetricsService.record(route: "/api/analyze", status: 500, duration_ms: 80, model_used: "gemini-2.5-flash")

    snapshot = MetricsService.snapshot

    assert_equal 2, snapshot[:total_requests]
    assert_equal 1, snapshot[:total_errors]
    assert_equal 100, snapshot[:avg_latency_ms]

    route_stats = snapshot[:routes].fetch("/api/analyze")
    assert_equal 2, route_stats[:count]
    assert_equal 1, route_stats[:errors]
    assert_equal 100, route_stats[:avg_ms]

    assert_equal 2, snapshot[:models]["gemini-2.5-flash"]
  end

  test "reset clears accumulated metrics" do
    MetricsService.record(route: "/api/ops/metrics", status: 200, duration_ms: 10)
    assert_equal 1, MetricsService.snapshot[:total_requests]

    MetricsService.reset!

    snapshot = MetricsService.snapshot
    assert_equal 0, snapshot[:total_requests]
    assert_equal({}, snapshot[:routes])
    assert_equal({}, snapshot[:models])
  end
end
