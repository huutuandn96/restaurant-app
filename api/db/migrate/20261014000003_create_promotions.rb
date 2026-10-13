class CreatePromotions < ActiveRecord::Migration[8.1]
  def change
    # Khuyến mãi (SPEC §5.6)
    # 1) Giảm giá món theo khung giờ (happy hour)
    create_table :promotions do |t|
      t.string :name, null: false
      t.integer :percent, null: false
      t.integer :category_ids, array: true, null: false, default: []
      t.integer :menu_item_ids, array: true, null: false, default: []
      t.integer :weekdays, array: true, null: false, default: [] # 0 = CN … 6 = T7; rỗng = mọi ngày
      t.string :start_time, null: false # "HH:MM"
      t.string :end_time, null: false
      t.date :starts_on
      t.date :ends_on
      t.boolean :active, null: false, default: true
      t.timestamps
    end

    # 2) Mã voucher
    create_table :vouchers do |t|
      t.string :code, null: false, index: { unique: true }
      t.string :kind, null: false # percent | amount
      t.integer :value, null: false
      t.integer :max_discount
      t.integer :min_spend, null: false, default: 0
      t.datetime :starts_at
      t.datetime :ends_at
      t.integer :usage_limit
      t.integer :used_count, null: false, default: 0
      t.boolean :active, null: false, default: true
      t.string :note
      t.timestamps
    end

    # 3) Giảm giá trên hoá đơn (theo phiên bàn) + voucher áp cho phiên
    change_table :table_sessions do |t|
      t.references :voucher, foreign_key: true
      t.string :manual_discount_kind
      t.integer :manual_discount_value
      t.string :manual_discount_reason
      t.references :discount_by, foreign_key: { to_table: :users }
      t.integer :discount_total, null: false, default: 0
    end

    # Giá gốc khi món được giảm theo happy hour; phần giảm hoá đơn phân bổ về từng đơn khi thanh toán
    add_column :order_items, :original_price, :integer
    add_column :order_items, :promotion_name, :string
    add_column :orders, :discount, :integer, null: false, default: 0
  end
end
