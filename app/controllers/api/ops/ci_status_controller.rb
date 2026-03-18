module Api
  module Ops
    class CiStatusController < Api::BaseController
      def show
        started_at = Time.current
        payload = CiStatusService.snapshot
        audit(route: "/api/ops/ci_status", status: 200, started_at: started_at)
        render_ok(payload)
      end
    end
  end
end
