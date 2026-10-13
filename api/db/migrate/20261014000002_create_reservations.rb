class CreateReservations < ActiveRecord::Migration[8.1]
  def change
    # Đặt bàn trước (SPEC §5.5) — nhân viên nhập khi khách gọi điện
    create_table :reservations do |t|
      t.references :table, null: false, foreign_key: true
      t.string :customer_name, null: false
      t.string :phone, null: false
      t.integer :party_size, null: false
      t.datetime :reserved_at, null: false
      t.string :note
      t.string :status, null: false, default: "booked"
      t.references :created_by, foreign_key: { to_table: :users }
      t.references :table_session, foreign_key: true
      t.datetime :arrived_at
      t.datetime :cancelled_at
      t.timestamps
    end
    add_index :reservations, %i[table_id reserved_at]
    add_index :reservations, :reserved_at
  end
end
