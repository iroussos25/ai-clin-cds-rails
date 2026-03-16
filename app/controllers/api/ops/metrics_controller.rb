module Api
  module Ops
    class MetricsController < Api::BaseController
      def show
        started_at = Time.current
        audit(route: "/api/ops/metrics", status: 200, started_at: started_at)
        render_ok(MetricsService.snapshot)
      end
    end
  end
end
