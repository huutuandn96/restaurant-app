# Publish event lên Redis để Socket server phát tới room (SPEC §1)
module Realtime
  CHANNEL = "restaurant:events"

  module_function

  def publish(rooms:, event:, payload:)
    redis.publish(CHANNEL, { rooms: Array(rooms), event:, payload: }.to_json)
  rescue Redis::BaseError => e
    Rails.logger.error("[realtime] publish #{event} failed: #{e.message}")
  end

  def order_rooms(order, kitchen: true)
    rooms = %W[waiters managers table_session:#{order.table_session_id}]
    rooms << "kitchen" if kitchen && Order::KITCHEN_STATUSES.include?(order.status)
    rooms
  end

  def order_changed(order, event: "order.updated")
    publish(rooms: order_rooms(order), event:, payload: OrderSerializer.call(order))
  end

  def menu_item_changed(item)
    publish(rooms: %w[waiters kitchen managers guests], event: "menu_item.updated", payload: MenuSerializer.item(item))
  end

  def redis
    @redis ||= Redis.new(url: REDIS_URL)
  end
end
