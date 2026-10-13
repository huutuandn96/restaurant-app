class CreatePushSubscriptions < ActiveRecord::Migration[8.1]
  def change
    # Web Push (SPEC §1.1): mỗi trình duyệt / máy đã bật thông báo
    create_table :push_subscriptions do |t|
      t.references :user, null: false, foreign_key: true
      t.string :endpoint, null: false, index: { unique: true }
      t.string :p256dh, null: false
      t.string :auth, null: false
      t.string :user_agent
      t.datetime :last_success_at
      t.timestamps
    end
  end
end
