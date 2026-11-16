const { getPickupDates } = require('./menuController');
const { createOrder } = require('../repositories/orderRepository');

const pickupTimes = ['12:00', '14:00', '16:00'];

function getPickupTimes(req, res) {
  res.json(pickupTimes);
}

function postOrder(req, res) {
  const { requestId, pickupDate, pickupTime, items } = req.body ?? {};
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  const phone = typeof req.body?.phone === 'string' ? req.body.phone.trim() : '';
  const digits = phone.replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '');

  if (name.length < 2 || name.length > 80) {
    return res.status(400).json({ error: 'Escribe tu nombre (2 a 80 caracteres).' });
  }
  if (!/^[+\d().\s-]+$/.test(phone) || digits.length !== 10) {
    return res.status(400).json({ error: 'Escribe un número de teléfono de 10 dígitos.' });
  }
  if (typeof pickupDate !== 'string' || !pickupTimes.includes(pickupTime)) {
    return res.status(400).json({ error: 'Elige una fecha y una hora de recogida válidas.' });
  }
  if (typeof requestId !== 'string' || !/^[\da-f-]{36}$/i.test(requestId) ||
      !Array.isArray(items) || items.length === 0 ||
      items.some((item) => !item || !Number.isSafeInteger(item.productId) ||
        !Number.isSafeInteger(item.quantity) || !Number.isSafeInteger(item.priceCents))) {
    return res.status(400).json({ error: 'Agrega un plato al carrito y vuelve a intentar.' });
  }

  const isOpenDate = getPickupDates().some((day) => day.open && day.date === pickupDate);
  const result = createOrder({
    requestId, name, phone: digits, pickupDate, pickupTime, items
  }, isOpenDate);

  return res.status(result.code).json(result.data);
}

module.exports = { getPickupTimes, postOrder };
