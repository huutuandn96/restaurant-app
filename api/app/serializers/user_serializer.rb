module UserSerializer
  module_function

  def call(u) = u.slice(:id, :name, :email, :role, :active).merge(has_pin: u.pin?)
end
