module MenuSerializer
  module_function

  def category(c, items: nil)
    { id: c.id, name: c.name, position: c.position, active: c.active }.tap do |h|
      h[:items] = items.map { |i| item(i) } if items
    end
  end

  def item(i)
    {
      id: i.id,
      category_id: i.category_id,
      name: i.name,
      description: i.description,
      price: i.price,
      image_url: i.image_url,
      available: i.available,
      position: i.position
    }
  end
end
