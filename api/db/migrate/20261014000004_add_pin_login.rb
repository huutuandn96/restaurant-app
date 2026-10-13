class AddPinLogin < ActiveRecord::Migration[8.1]
  def change
    # Đăng nhập PIN trên máy dùng chung đã ghi danh (SPEC §4.1)
    add_column :users, :pin_digest, :string
    add_column :users, :pin_failed_attempts, :integer, null: false, default: 0
    add_column :users, :pin_locked_until, :datetime

    create_table :devices do |t|
      t.string :name, null: false
      t.string :token_digest, null: false, index: { unique: true }
      t.integer :lock_minutes # tự khoá khi không thao tác; nil = không tự khoá
      t.references :registered_by, null: false, foreign_key: { to_table: :users }
      t.datetime :last_used_at
      t.datetime :revoked_at
      t.timestamps
    end
  end
end
