# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# This file is the source Rails uses to define your schema when running `bin/rails
# db:schema:load`. When creating a new database, `bin/rails db:schema:load` tends to
# be faster and is potentially less error prone than running all of your
# migrations from scratch. Old migrations may fail to apply correctly if those
# migrations use external dependencies or application code.
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema[8.1].define(version: 2026_03_16_200002) do
  # These are extensions that must be enabled in order to support this database
  enable_extension "pg_catalog.plpgsql"

  create_table "audit_logs", force: :cascade do |t|
    t.string "client_ip"
    t.datetime "created_at", null: false
    t.integer "duration_ms"
    t.string "error_message"
    t.string "method", null: false
    t.string "model_used"
    t.string "request_id", null: false
    t.string "route", null: false
    t.integer "status_code", null: false
    t.index ["created_at"], name: "index_audit_logs_on_created_at"
    t.index ["request_id"], name: "index_audit_logs_on_request_id"
    t.index ["route"], name: "index_audit_logs_on_route"
  end

  create_table "document_chunks", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.integer "chunk_index", null: false
    t.text "content", null: false
    t.datetime "created_at", null: false
    t.string "doc_id", null: false
    t.jsonb "embedding", default: [], null: false
    t.jsonb "metadata", default: {}
    t.datetime "updated_at", null: false
    t.index ["doc_id"], name: "index_document_chunks_on_doc_id"
  end

  create_table "playing_with_neon", id: :serial, force: :cascade do |t|
    t.text "name", null: false
    t.float "value", limit: 24
  end
end
