const { listMenu } = require('../repositories/menuRepository');

const businessDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/New_York',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
});

function getPickupDates() {
  const parts = Object.fromEntries(
    businessDate.formatToParts(new Date()).map(({ type, value }) => [type, value])
  );
  const start = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day));

  return Array.from({ length: 7 }, (_, offset) => {
    const date = new Date(start + offset * 86400000);
    return { date: date.toISOString().slice(0, 10), open: date.getUTCDay() !== 1 };
  });
}

function getMenu(req, res) {
  const pickupDates = getPickupDates();
  const pickupDate = req.query.date ?? pickupDates.find((day) => day.open).date;
  const selectedDay = pickupDates.find((day) => day.date === pickupDate);

  if (!selectedDay) {
    return res.status(400).json({ error: 'Elige una fecha de los próximos siete días.' });
  }

  res.json({
    pickupDate,
    pickupDates,
    closed: !selectedDay.open,
    products: selectedDay.open ? listMenu(pickupDate) : []
  });
}

module.exports = { getMenu };

