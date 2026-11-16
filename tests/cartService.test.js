const { quoteCart } = require('../src/services/cartService');

const menu = [{ id: 1, name: 'Pastelito de pollo', price_cents: 250, available_units: 6 }];

test('calculates the total from the server price', () => {
  const quote = quoteCart(menu, [{ productId: 1, quantity: 2, priceCents: 250 }]);
  expect(quote.totalCents).toBe(500);
  expect(quote.priceChanged).toBe(false);
});

test('flags a changed price and returns the updated total', () => {
  const quote = quoteCart(menu, [{ productId: 1, quantity: 2, priceCents: 200 }]);
  expect(quote.totalCents).toBe(500);
  expect(quote.priceChanged).toBe(true);
});

test.each([0, -1, 1.5, 7])('rejects invalid or unavailable quantity %s', (quantity) => {
  expect(quoteCart(menu, [{ productId: 1, quantity }])).toHaveProperty('error');
});

test('rejects a product that is missing from the menu', () => {
  expect(quoteCart(menu, [{ productId: 99, quantity: 1 }])).toHaveProperty('error');
});

test('quotes an empty cart at zero', () => {
  expect(quoteCart(menu, []).totalCents).toBe(0);
});
