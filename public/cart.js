const cart = (() => {
  const cartsByDate = new Map();
  const list = document.querySelector('#cart-items');
  const cartStatus = document.querySelector('#cart-status');
  const total = document.querySelector('#cart-total');
  const cartShortcut = document.querySelector('#cart-shortcut');
  const acceptPrices = document.querySelector('#accept-prices');
  const dollars = new Intl.NumberFormat('es-US', { style: 'currency', currency: 'USD' });

  const orderForm = document.querySelector('#order-form');
  const orderStatus = document.querySelector('#order-status');
  const timeSelect = orderForm.elements.pickupTime;
  const submitOrder = orderForm.querySelector('button[type="submit"]');
  const pickupSelector = document.querySelector('#pickup-date');
  const menuSection = document.querySelector('#menu');
  let submitting = false;
  let lastAttempt;

  fetch('/api/pickup-times')
    .then((response) => {
      if (!response.ok) throw new Error('Pickup times unavailable');
      return response.json();
    })
    .then((times) => {
      timeSelect.add(new Option('Elige una hora', ''));
      for (const time of times) timeSelect.add(new Option(time, time));
      submitOrder.disabled = times.length === 0;
    })
    .catch(() => {
      orderStatus.textContent = 'No se pudieron cargar las horas de recogida. Recarga la página.';
    });

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
    orderForm.hidden = true;
    const items = [...(currentItems()?.values() ?? [])];
    const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
    const shortcutLabel = itemCount === 1
      ? 'Ver carrito · 1 unidad'
      : `Ver carrito · ${itemCount} unidades`;
    cartShortcut.hidden = itemCount === 0;
    cartShortcut.textContent = shortcutLabel;
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
      cartShortcut.textContent = `${shortcutLabel} · ${total.textContent}`;
      cartStatus.textContent = quote.priceChanged
        ? 'Cambió el precio de un plato. Revisa y acepta el total actualizado.'
        : '';
      updatedLines = quote.lines;
      acceptPrices.hidden = !quote.priceChanged;
      orderForm.hidden = quote.priceChanged;
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

  orderForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (submitting || orderForm.hidden || !currentItems()?.size) return;

    const items = currentItems();
    const payload = {
      pickupDate: date,
      pickupTime: timeSelect.value,
      name: orderForm.elements.customerName.value.trim(),
      phone: orderForm.elements.phone.value.trim(),
      items: [...items.values()].map(({ productId, quantity, priceCents }) => ({
        productId, quantity, priceCents
      }))
    };
    const signature = JSON.stringify(payload);
    if (lastAttempt?.signature !== signature) {
      lastAttempt = { signature, requestId: crypto.randomUUID() };
    }

    submitting = true;
    orderForm.querySelector('fieldset').disabled = true;
    pickupSelector.disabled = true;
    menuSection.inert = true;
    list.inert = true;
    orderStatus.textContent = 'Enviando pedido…';

    let refreshMenu = false;
    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, requestId: lastAttempt.requestId })
      });
      const order = await response.json();

      if (!response.ok) {
        orderStatus.textContent = order.error || 'No se pudo enviar el pedido.';
        if (response.status === 409) refreshQuote();
        return;
      }

      items.clear();
      lastAttempt = undefined;
      orderForm.reset();
      orderStatus.textContent = `Pedido ${order.orderNumber} recibido. Estado: pendiente.`;
      refreshMenu = true;
      render();
    } catch {
      orderStatus.textContent = 'No pudimos confirmar el pedido. Vuelve a enviarlo con los mismos datos.';
    } finally {
      submitting = false;
      orderForm.querySelector('fieldset').disabled = false;
      pickupSelector.disabled = false;
      menuSection.inert = false;
      list.inert = false;
      if (refreshMenu) pickupSelector.dispatchEvent(new Event('change'));
    }
  });

  return { add, setMenu };
})();


