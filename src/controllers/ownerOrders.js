const { db } = require('../repositories/menuRepository');

const pendingOrders = db.prepare(`
  SELECT id, customer_name, phone, pickup_date, pickup_time, total_cents
  FROM orders
  WHERE status = 'pending'
  ORDER BY pickup_date, pickup_time, id
`);

const orderItems = db.prepare(`
  SELECT product_name, quantity
  FROM order_items
  WHERE order_id = ?
  ORDER BY product_name
`);

function getPendingOrders(req, res) {
  res.set('Cache-Control', 'no-store');
  res.json(pendingOrders.all().map((order) => ({
    ...order,
    items: orderItems.all(order.id)
  })));
}

module.exports = { getPendingOrders };
