const loginForm = document.querySelector('#login');
const dashboard = document.querySelector('#dashboard');
const ownerStatus = document.querySelector('#owner-status');
const ordersList = document.querySelector('#pending-orders');
const logoutButton = document.querySelector('#logout');
const dollars = new Intl.NumberFormat('es-US', { style: 'currency', currency: 'USD' });

function showSignedOut(message = '') {
  ordersList.replaceChildren();
  dashboard.hidden = true;
  ownerMenuEditor.clear();
  loginForm.hidden = false;
  ownerStatus.textContent = message;
}

async function loadOrders() {
  const response = await fetch('/api/owner/orders', { cache: 'no-store' });
  if (response.status === 401) {
    showSignedOut('Inicia sesión para ver los pedidos.');
    return;
  }
  if (!response.ok) throw new Error('No se pudieron cargar los pedidos.');

  const orders = await response.json();
  loginForm.hidden = true;
  dashboard.hidden = false;
  ownerMenuEditor.refresh();
  ownerStatus.textContent = '';
  ordersList.replaceChildren();

  if (orders.length === 0) {
    ordersList.textContent = 'No hay pedidos pendientes.';
    return;
  }

  for (const order of orders) {
    const card = document.createElement('article');
    const title = document.createElement('h3');
    const customer = document.createElement('p');
    const pickup = document.createElement('p');
    const items = document.createElement('p');

    title.textContent = `Pedido DA-${order.id} · ${dollars.format(order.total_cents / 100)}`;
    customer.textContent = `${order.customer_name} · ${order.phone}`;
    pickup.textContent = `Recogida: ${order.pickup_date} a las ${order.pickup_time}`;
    items.textContent = order.items.map((item) => `${item.quantity} × ${item.product_name}`).join(', ');
    card.append(title, customer, pickup, items);
    ordersList.append(card);
  }
}

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = loginForm.querySelector('button');
  button.disabled = true;

  try {
    const response = await fetch('/api/owner/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: loginForm.elements.password.value })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'No se pudo iniciar sesión.');
    await loadOrders();
  } catch (error) {
    ownerStatus.textContent = error.message;
  } finally {
    loginForm.reset();
    button.disabled = false;
  }
});

logoutButton.addEventListener('click', async () => {
  logoutButton.disabled = true;
  try {
    const response = await fetch('/api/owner/logout', { method: 'POST' });
    if (!response.ok) throw new Error('No se pudo cerrar la sesión. Intenta de nuevo.');
    showSignedOut('Sesión cerrada.');
  } catch (error) {
    ownerStatus.textContent = error.message;
  } finally {
    logoutButton.disabled = false;
  }
});

loadOrders().catch(() => showSignedOut('No se pudo conectar al panel. Intenta de nuevo.'));

