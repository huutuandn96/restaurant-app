module MenuSerializer
  module_function

  def category(c, items: nil, pricing: nil)
    { id: c.id, name: c.name, position: c.position, active: c.active }.tap do |h|
      h[:items] = items.map { |i| item(i, pricing:) } if items
    end
  end

  # pricing (Promotions::Pricing) → giá bán hiện hành cho khách; không truyền → giá gốc (Manage)
  def item(i, pricing: nil)
    {
      id: i.id,
      category_id: i.category_id,
      name: i.name,
      description: i.description,
      price: i.price,
      image_url: i.image_path,
      available: i.available,
      position: i.position
    }.tap do |h|
      next unless pricing

      p = pricing.for(i)
      h.merge!(price: p.price, original_price: p.original_price, promotion: p.promotion_name)
    end
  end
end
