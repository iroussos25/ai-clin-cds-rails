class CreateAuditLogs < ActiveRecord::Migration[8.1]
  def change
    create_table :audit_logs do |t|
      t.string :route, null: false
      t.string :method, null: false
      t.string :request_id, null: false
      t.string :client_ip
      t.integer :status_code, null: false
      t.integer :duration_ms
      t.string :error_message
      t.string :model_used

      t.datetime :created_at, null: false
    end

    add_index :audit_logs, :request_id
    add_index :audit_logs, :created_at
    add_index :audit_logs, :route
  end
end
