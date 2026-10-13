class CreateCoreSchema < ActiveRecord::Migration[8.1]
  def change
    create_table :users do |t|
      t.string :name, null: false
      t.string :email, null: false, index: { unique: true }
      t.string :password_digest, null: false
      t.string :role, null: false
      t.boolean :active, null: false, default: true
      t.timestamps
    end

    create_table :tables do |t|
      t.integer :number, null: false, index: { unique: true }
      t.string :area
      t.integer :seats, null: false, default: 4
      t.string :qr_token, null: false, index: { unique: true }
      t.string :status, null: false, default: "available"
      t.timestamps
    end

    create_table :table_sessions do |t|
      t.references :table, null: false, foreign_key: true
      t.string :session_token, null: false, index: { unique: true }
      t.string :verify_code, null: false
      t.string :status, null: false, default: "open"
      t.datetime :opened_at, null: false
      t.datetime :closed_at
      t.references :closed_by, foreign_key: { to_table: :users }
      t.timestamps
    end
    # Mỗi bàn tối đa 1 session open (SPEC §2.2)
    add_index :table_sessions, :table_id, unique: true, where: "status = 'open'", name: "index_table_sessions_one_open_per_table"

    create_table :categories do |t|
      t.string :name, null: false
      t.integer :position, null: false, default: 0
      t.boolean :active, null: false, default: true
      t.timestamps
    end

    create_table :menu_items do |t|
      t.references :category, null: false, foreign_key: true
      t.string :name, null: false
      t.text :description
      t.integer :price, null: false
      t.string :image_url
      t.boolean :available, null: false, default: true
      t.integer :position, null: false, default: 0
      t.timestamps
    end

    create_table :orders do |t|
      t.references :table, null: false, foreign_key: true
      t.references :table_session, null: false, foreign_key: true
      t.string :code, null: false, index: { unique: true }
      t.string :status, null: false, default: "pending"
      t.text :note
      t.integer :total, null: false, default: 0
      t.references :confirmed_by, foreign_key: { to_table: :users }
      t.datetime :confirmed_at
      t.datetime :ready_at
      t.datetime :completed_at
      t.datetime :cancelled_at
      t.string :cancel_reason
      t.timestamps
    end
    add_index :orders, :status
    add_index :orders, :created_at
    add_index :orders, :completed_at

    create_table :order_items do |t|
      t.references :order, null: false, foreign_key: true
      t.references :menu_item, null: false, foreign_key: true
      t.string :name_snapshot, null: false
      t.integer :price_snapshot, null: false
      t.integer :quantity, null: false
      t.string :note
      t.string :status, null: false, default: "pending"
      t.datetime :done_at
      t.timestamps
    end

    create_table :order_events do |t|
      t.references :order, null: false, foreign_key: true
      t.references :user, foreign_key: true
      t.string :action, null: false
      t.string :from_status
      t.string :to_status
      t.jsonb :data, null: false, default: {}
      t.datetime :created_at, null: false
    end

    create_table :staff_calls do |t|
      t.references :table_session, null: false, foreign_key: true
      t.string :status, null: false, default: "open"
      t.references :resolved_by, foreign_key: { to_table: :users }
      t.datetime :resolved_at
      t.timestamps
    end
  end
end
