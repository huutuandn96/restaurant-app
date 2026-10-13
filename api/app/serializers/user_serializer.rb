module UserSerializer
  module_function

  def call(u) = u.slice(:id, :name, :email, :role, :active)
end
