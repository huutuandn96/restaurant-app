Rails.application.routes.draw do
  get "up" => "rails/health#show", as: :rails_health_check

  namespace :api do
    namespace :v1 do
      get "health", to: "health#show"

      post "auth/login", to: "auth#login"
      get "auth/me", to: "auth#me"

      # Khách (SPEC §6)
      namespace :public do
        post "tables/:qr_token/session", to: "sessions#create"
        get "session", to: "sessions#show"
        get "menu", to: "menu#show"
        resources :orders, only: :create
        resources :staff_calls, only: :create
      end

      namespace :staff do
        resources :tables, only: %i[index show] do
          member do
            post :checkout
            post :move
            post :merge
          end
        end
        resources :orders, only: %i[index show] do
          member do
            post :confirm
            post :cancel
            post :done
          end
        end
        resources :order_items, only: :update do
          patch :batch, on: :collection
        end
        resources :table_sessions, only: [] do
          get :bill, on: :member
        end
        resources :menu_items, only: :update
        resources :staff_calls, only: :index do
          post :resolve, on: :member
        end
      end

      namespace :manage do
        get "dashboard", to: "dashboard#show"
        resources :orders, only: %i[index show update]
        resources :categories, only: %i[index create update destroy] do
          post :adjust_prices, on: :member
        end
        resources :menu_items, only: %i[create update destroy]
        resources :tables, only: %i[index create update destroy] do
          post :regenerate_qr, on: :member
        end
        get "reports/revenue", to: "reports#revenue"
        resources :users, only: %i[index create update]
      end
    end
  end
end
