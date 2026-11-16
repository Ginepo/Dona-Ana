const { getPickupDates } = require('./menuController');
const { listMenu } = require('../repositories/menuRepository');
const { quoteCart } = require('../services/cartService');

function postCartQuote(req, res) {
  const { pickupDate, items } = req.body ?? {};

  if (!getPickupDates().some((day) => day.open && day.date === pickupDate)) {
    return res.status(400).json({ error: 'Elige una fecha de recogida abierta.' });
  }

  const quote = quoteCart(listMenu(pickupDate), items);
  return res.status(quote.error ? 400 : 200).json(quote);
}

module.exports = { postCartQuote };
