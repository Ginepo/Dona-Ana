const { randomBytes } = require('node:crypto');
const { db, listMenu } = require('./menuRepository');
const { quoteCart } = require('../services/cartService');

db.exec(`
  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY,
    request_id TEXT NOT NULL UNIQUE,
    request_details TEXT NOT NULL,
    status_token TEXT NOT NULL UNIQUE,
    customer_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    pickup_date TEXT NOT NULL,
    pickup_time TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    total_cents INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS order_items (
    order_id INTEGER NOT NULL REFERENCES orders(id),
    product_id INTEGER NOT NULL REFERENCES products(id),
    product_name TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    price_cents INTEGER NOT NULL,
    PRIMARY KEY (order_id, product_id)
  );
`);

const findRequest = db.prepare(`
  SELECT id, request_details, status_token, status, total_cents
  FROM orders WHERE request_id = ?
`);
const insertOrder = db.prepare(`
  INSERT INTO orders
    (request_id, request_details, status_token, customer_name, phone,
     pickup_date, pickup_time, total_cents)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);
const insertItem = db.prepare(`
  INSERT INTO order_items (order_id, product_id, product_name, quantity, price_cents)
  VALUES (?, ?, ?, ?, ?)
`);
const deductStock = db.prepare(`
  UPDATE product_availability
  SET available_units = available_units - ?
  WHERE pickup_date = ? AND product_id = ? AND available_units >= ?
`);

function orderResponse(id, token, status, totalCents) {
  return { orderNumber: `DA-${id}`, statusToken: token, status, totalCents };
}

function createOrder(order, isOpenDate) {
  const requestDetails = JSON.stringify([
    order.name, order.phone, order.pickupDate, order.pickupTime,
    order.items.map(({ productId, quantity, priceCents }) => (
      [productId, quantity, priceCents]
    )).sort((a, b) => a[0] - b[0])
  ]);

  db.exec('BEGIN IMMEDIATE');
  try {
    const existing = findRequest.get(order.requestId);
    let result;

    if (existing) {
      result = existing.request_details === requestDetails
        ? { code: 200, data: orderResponse(existing.id, existing.status_token,
          existing.status, existing.total_cents) }
        : { code: 409, data: { error: 'Ese intento ya se usó para otro pedido.' } };
    } else if (!isOpenDate) {
      result = { code: 400, data: { error: 'Elige una fecha de recogida abierta.' } };
    } else {
      const quote = quoteCart(listMenu(order.pickupDate), order.items);
      if (quote.error) {
        result = { code: 400, data: { error: quote.error } };
      } else if (quote.priceChanged) {
        result = { code: 409, data: { error: 'Cambió un precio. Revisa el carrito antes de enviar el pedido.' } };
      } else {
        const token = randomBytes(32).toString('hex');
        const { lastInsertRowid: id } = insertOrder.run(
          order.requestId, requestDetails, token, order.name, order.phone,
          order.pickupDate, order.pickupTime, quote.totalCents
        );

        for (const line of quote.lines) {
          const { changes } = deductStock.run(
            line.quantity, order.pickupDate, line.productId, line.quantity
          );
          if (changes !== 1) throw new Error('Unable to deduct order inventory.');
          insertItem.run(id, line.productId, line.name, line.quantity, line.priceCents);
        }

        result = { code: 201, data: orderResponse(id, token, 'pending', quote.totalCents) };
      }
    }

    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

module.exports = { createOrder };
