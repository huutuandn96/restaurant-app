class ServiceError < StandardError
  attr_reader :status

  def initialize(message, status: :unprocessable_entity)
    super(message)
    @status = status
  end
end
