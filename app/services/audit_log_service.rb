class AuditLogService
  def self.record(route:, method:, request_id:, ip:, status:, duration_ms:, error: nil, model_used: nil)
    attrs = {
      route: route,
      method: method,
      request_id: request_id,
      client_ip: ip,
      status_code: status,
      duration_ms: duration_ms,
      error_message: error,
      model_used: model_used
    }

    Rails.logger.info "[api_audit] #{attrs.to_json}"

    MetricsService.record(
      route: route,
      status: status,
      duration_ms: duration_ms,
      model_used: model_used
    )

    return unless ENV["ENABLE_DB_AUDIT_LOGS"] == "true"

    AuditLog.create(attrs)
  rescue => e
    Rails.logger.warn "[api_audit] Failed to write audit log: #{e.message}"
  end
end
