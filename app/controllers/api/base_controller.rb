module Api
  class BaseController < ActionController::Base
    skip_forgery_protection

    before_action :set_request_id
    before_action :validate_api_key

    rescue_from StandardError, with: :handle_server_error

    private

    def set_request_id
      @request_id = SecureRandom.uuid
      response.headers["X-Request-Id"] = @request_id
    end

    def validate_api_key
      return if Rails.env.development? || Rails.env.test?

      expected = Rails.application.credentials.dig(:api, :key) || ENV["APP_API_KEY"]
      return if expected.blank?

      provided = request.headers["X-API-Key"]
      unless ActiveSupport::SecurityUtils.secure_compare(provided.to_s, expected.to_s)
        render_error("Unauthorized", :unauthorized)
      end
    end

    def client_ip
      request.headers["X-Forwarded-For"]&.split(",")&.first&.strip || request.remote_ip || "unknown"
    end

    def render_error(message, status)
      render json: { error: message, request_id: @request_id }, status: status
    end

    def render_ok(data, status: :ok)
      render json: data, status: status
    end

    def handle_server_error(exception)
      Rails.logger.error "[API Error] #{exception.class}: #{exception.message}"
      render_error("Internal server error", :internal_server_error)
    end

    def audit(route:, status:, started_at:, error: nil, model_used: nil)
      AuditLogService.record(
        route: route,
        method: request.method,
        request_id: @request_id,
        ip: client_ip,
        status: status,
        duration_ms: ((Time.current - started_at) * 1000).round,
        error: error,
        model_used: model_used
      )
    end

    def sanitize_input(text)
      text.to_s.gsub(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/, "").strip
    end
  end
end
