class AuditLog < ApplicationRecord
  validates :route, :method, :request_id, :status_code, presence: true

  scope :recent, -> { order(created_at: :desc) }
  scope :for_route, ->(route) { where(route: route) }
  scope :errors_only, -> { where("status_code >= 400") }
end
