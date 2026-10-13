FactoryBot.define do
  factory :user do
    sequence(:name) { |n| "User #{n}" }
    sequence(:email) { |n| "user#{n}@test.vn" }
    password { "password" }
    role { "waiter" }

    trait(:kitchen) { role { "kitchen" } }
    trait(:manager) { role { "manager" } }
    trait(:owner) { role { "owner" } }
  end

  factory :table do
    sequence(:number) { |n| n }
    area { "Tầng 1" }
  end

  factory :category do
    sequence(:name) { |n| "Category #{n}" }
  end

  factory :menu_item do
    category
    sequence(:name) { |n| "Món #{n}" }
    price { 50_000 }
  end
end
