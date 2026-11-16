const cart = (() => {
  const cartsByDate = new Map();
  const list = document.querySelector('#cart-items');
  const cartStatus = document.querySelector('#cart-status');
  const total = document.querySelector('#cart-total');
  const acceptPrices = document.querySelector('#accept-prices');
  const dollars = new Intl.NumberFormat('es-US', { style: 'currency', currency: 'USD' });

  let date;
  let products = new Map();
  let requestVersion = 0;
  let updatedLines = [];

  function currentItems() {
    return cartsByDate.get(date);
  }

  function setMenu(menuDate, menuProducts) {
    date = menuDate;
    products = new Map(menuProducts.map((product) => [product.id, product]));
    if (date && !cartsByDate.has(date)) cartsByDate.set(date, new Map());
    render();
  }

  function add(product, quantity) {
    const items = currentItems();
    const existing = items.get(product.id);
    const nextQuantity = (existing?.quantity ?? 0) + quantity;

    if (!Number.isSafeInteger(quantity) || quantity < 1 ||
        nextQuantity > product.available_units) {
      cartStatus.textContent = 'Elige una cantidad dentro de las unidades disponibles.';
      return;
    }

    items.set(product.id, {
      productId: product.id,
      name: product.name,
      priceCents: existing?.priceCents ?? product.price_cents,
      quantity: nextQuantity
    });
    render();
  }

  function render() {
    list.replaceChildren();
    const items = currentItems();

    for (const item of items?.values() ?? []) {
      const row = document.createElement('li');
      const label = document.createElement('label');
      const input = document.createElement('input');
      const remove = document.createElement('button');
      const max = products.get(item.productId)?.available_units ?? 0;

      label.textContent = `${item.name} — cantidad`;
      input.type = 'number';
      input.min = '1';
      input.max = String(max);
      input.value = String(item.quantity);
      input.disabled = max === 0;
      input.addEventListener('change', () => {
        if (!input.value || !input.checkValidity()) {
          input.value = String(item.quantity);
          cartStatus.textContent = 'Elige una cantidad dentro de las unidades disponibles.';
          return;
        }
        item.quantity = input.valueAsNumber;
        refreshQuote();
      });
      label.append(input);

      remove.type = 'button';
      remove.textContent = 'Quitar';
      remove.setAttribute('aria-label', `Quitar ${item.name}`);
      remove.addEventListener('click', () => {
        items.delete(item.productId);
        render();
      });
      row.append(label, remove);
      list.append(row);
    }

    refreshQuote();
  }

  async function refreshQuote() {
    const version = ++requestVersion;
    const items = [...(currentItems()?.values() ?? [])];
    acceptPrices.hidden = true;
    updatedLines = [];
    total.textContent = '—';

    if (!items.length) {
      cartStatus.textContent = 'Tu carrito está vacío.';
      return;
    }

    cartStatus.textContent = 'Calculando el total…';

    try {
      const response = await fetch('/api/cart/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pickupDate: date, items })
      });
      const quote = await response.json();
      if (version !== requestVersion) return;
      if (!response.ok) throw new Error(quote.error || 'No se pudo calcular el total.');

      total.textContent = dollars.format(quote.totalCents / 100);
      cartStatus.textContent = quote.priceChanged
        ? 'Cambió el precio de un plato. Revisa y acepta el total actualizado.'
        : '';
      updatedLines = quote.lines;
      acceptPrices.hidden = !quote.priceChanged;
    } catch (error) {
      if (version === requestVersion) {
        cartStatus.textContent = error instanceof SyntaxError
          ? 'No se pudo calcular el total. Intenta de nuevo.'
          : error.message;
      }
    }
  }

  acceptPrices.addEventListener('click', () => {
    for (const line of updatedLines) {
      currentItems().get(line.productId).priceCents = line.priceCents;
    }
    refreshQuote();
  });

  return { add, setMenu };
})();
