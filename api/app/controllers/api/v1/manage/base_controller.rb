module Api
  module V1
    module Manage
      class BaseController < AuthenticatedController
        allow_roles :manager, :owner
      end
    end
  end
end
