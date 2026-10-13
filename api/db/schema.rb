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

ActiveRecord::Schema[8.1].define(version: 2026_10_14_000001) do
  # These are extensions that must be enabled in order to support this database
  enable_extension "pg_catalog.plpgsql"

  create_table "active_storage_attachments", force: :cascade do |t|
    t.string "name", null: false
    t.string "record_type", null: false
    t.bigint "record_id", null: false
    t.bigint "blob_id", null: false
    t.datetime "created_at", null: false
    t.index ["blob_id"], name: "index_active_storage_attachments_on_blob_id"
    t.index ["record_type", "record_id", "name", "blob_id"], name: "index_active_storage_attachments_uniqueness", unique: true
  end

  create_table "active_storage_blobs", force: :cascade do |t|
    t.string "key", null: false
    t.string "filename", null: false
    t.string "content_type"
    t.text "metadata"
    t.string "service_name", null: false
    t.bigint "byte_size", null: false
    t.string "checksum"
    t.datetime "created_at", null: false
    t.index ["key"], name: "index_active_storage_blobs_on_key", unique: true
  end

  create_table "active_storage_variant_records", force: :cascade do |t|
    t.bigint "blob_id", null: false
    t.string "variation_digest", null: false
    t.index ["blob_id", "variation_digest"], name: "index_active_storage_variant_records_uniqueness", unique: true
  end

  create_table "categories", force: :cascade do |t|
    t.string "name", null: false
    t.integer "position", default: 0, null: false
    t.boolean "active", default: true, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "menu_items", force: :cascade do |t|
    t.bigint "category_id", null: false
    t.string "name", null: false
    t.text "description"
    t.integer "price", null: false
    t.string "image_url"
    t.boolean "available", default: true, null: false
    t.integer "position", default: 0, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["category_id"], name: "index_menu_items_on_category_id"
  end

  create_table "order_events", force: :cascade do |t|
    t.bigint "order_id", null: false
    t.bigint "user_id"
    t.string "action", null: false
    t.string "from_status"
    t.string "to_status"
    t.jsonb "data", default: {}, null: false
    t.datetime "created_at", null: false
    t.index ["order_id"], name: "index_order_events_on_order_id"
    t.index ["user_id"], name: "index_order_events_on_user_id"
  end

  create_table "order_items", force: :cascade do |t|
    t.bigint "order_id", null: false
    t.bigint "menu_item_id", null: false
    t.string "name_snapshot", null: false
    t.integer "price_snapshot", null: false
    t.integer "quantity", null: false
    t.string "note"
    t.string "status", default: "pending", null: false
    t.datetime "done_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["menu_item_id"], name: "index_order_items_on_menu_item_id"
    t.index ["order_id"], name: "index_order_items_on_order_id"
  end

  create_table "orders", force: :cascade do |t|
    t.bigint "table_id", null: false
    t.bigint "table_session_id", null: false
    t.string "code", null: false
    t.string "status", default: "pending", null: false
    t.text "note"
    t.integer "total", default: 0, null: false
    t.bigint "confirmed_by_id"
    t.datetime "confirmed_at"
    t.datetime "ready_at"
    t.datetime "completed_at"
    t.datetime "cancelled_at"
    t.string "cancel_reason"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["code"], name: "index_orders_on_code", unique: true
    t.index ["completed_at"], name: "index_orders_on_completed_at"
    t.index ["confirmed_by_id"], name: "index_orders_on_confirmed_by_id"
    t.index ["created_at"], name: "index_orders_on_created_at"
    t.index ["status"], name: "index_orders_on_status"
    t.index ["table_id"], name: "index_orders_on_table_id"
    t.index ["table_session_id"], name: "index_orders_on_table_session_id"
  end

  create_table "staff_calls", force: :cascade do |t|
    t.bigint "table_session_id", null: false
    t.string "status", default: "open", null: false
    t.bigint "resolved_by_id"
    t.datetime "resolved_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["resolved_by_id"], name: "index_staff_calls_on_resolved_by_id"
    t.index ["table_session_id"], name: "index_staff_calls_on_table_session_id"
  end

  create_table "table_sessions", force: :cascade do |t|
    t.bigint "table_id", null: false
    t.string "session_token", null: false
    t.string "verify_code", null: false
    t.string "status", default: "open", null: false
    t.datetime "opened_at", null: false
    t.datetime "closed_at"
    t.bigint "closed_by_id"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.bigint "merged_into_id"
    t.index ["closed_by_id"], name: "index_table_sessions_on_closed_by_id"
    t.index ["merged_into_id"], name: "index_table_sessions_on_merged_into_id"
    t.index ["session_token"], name: "index_table_sessions_on_session_token", unique: true
    t.index ["table_id"], name: "index_table_sessions_on_table_id"
    t.index ["table_id"], name: "index_table_sessions_one_open_per_table", unique: true, where: "((status)::text = 'open'::text)"
  end

  create_table "tables", force: :cascade do |t|
    t.integer "number", null: false
    t.string "area"
    t.integer "seats", default: 4, null: false
    t.string "qr_token", null: false
    t.string "status", default: "available", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["number"], name: "index_tables_on_number", unique: true
    t.index ["qr_token"], name: "index_tables_on_qr_token", unique: true
  end

  create_table "users", force: :cascade do |t|
    t.string "name", null: false
    t.string "email", null: false
    t.string "password_digest", null: false
    t.string "role", null: false
    t.boolean "active", default: true, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["email"], name: "index_users_on_email", unique: true
  end

  add_foreign_key "active_storage_attachments", "active_storage_blobs", column: "blob_id"
  add_foreign_key "active_storage_variant_records", "active_storage_blobs", column: "blob_id"
  add_foreign_key "menu_items", "categories"
  add_foreign_key "order_events", "orders"
  add_foreign_key "order_events", "users"
  add_foreign_key "order_items", "menu_items"
  add_foreign_key "order_items", "orders"
  add_foreign_key "orders", "table_sessions"
  add_foreign_key "orders", "tables"
  add_foreign_key "orders", "users", column: "confirmed_by_id"
  add_foreign_key "staff_calls", "table_sessions"
  add_foreign_key "staff_calls", "users", column: "resolved_by_id"
  add_foreign_key "table_sessions", "table_sessions", column: "merged_into_id"
  add_foreign_key "table_sessions", "tables"
  add_foreign_key "table_sessions", "users", column: "closed_by_id"
end
