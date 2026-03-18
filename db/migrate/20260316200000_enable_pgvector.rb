class EnablePgvector < ActiveRecord::Migration[8.1]
  def change
    return unless connection.adapter_name == "PostgreSQL"

    available = select_value("SELECT 1 FROM pg_available_extensions WHERE name = 'vector' LIMIT 1")
    enable_extension "vector" if available
  end
end
