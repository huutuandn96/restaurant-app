class StaffCall < ApplicationRecord
  belongs_to :table_session
  belongs_to :resolved_by, class_name: "User", optional: true
  has_one :table, through: :table_session

  enum :status, { open: "open", resolved: "resolved" }, validate: true
end
