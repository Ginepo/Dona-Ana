function quoteCart(products, items) {
  if (!Array.isArray(items)) {
    return { error: 'Envía una lista de productos.' };
  }

  const productsById = new Map(products.map((product) => [product.id, product]));
  const seen = new Set();
  const lines = [];

  for (const item of items) {
    if (!item || !Number.isSafeInteger(item.productId) ||
        !Number.isSafeInteger(item.quantity) || item.quantity < 1) {
      return { error: 'Elige una cantidad entera mayor que cero.' };
    }

    if (seen.has(item.productId)) {
      return { error: 'Envía una sola cantidad por plato.' };
    }
    seen.add(item.productId);

    const product = productsById.get(item.productId);
    if (!product || item.quantity > product.available_units) {
      return { error: 'Uno de los platos no tiene suficientes unidades para esa fecha.' };
    }

    lines.push({
      productId: product.id,
      name: product.name,
      quantity: item.quantity,
      priceCents: product.price_cents,
      subtotalCents: product.price_cents * item.quantity,
      priceChanged: item.priceCents !== product.price_cents
    });
  }

  return {
    lines,
    totalCents: lines.reduce((total, line) => total + line.subtotalCents, 0),
    priceChanged: lines.some((line) => line.priceChanged)
  };
}

module.exports = { quoteCart };
