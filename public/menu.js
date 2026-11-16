const filters = document.querySelector('#filters');
const menu = document.querySelector('#menu');
const status = document.querySelector('#status');
const currency = new Intl.NumberFormat('es-US', {
  style: 'currency',
  currency: 'USD'
});

function renderMenu(products, category) {
  menu.replaceChildren();
  const visibleProducts = products.filter(
    (product) => category === null || product.category === category
  );

  status.textContent = visibleProducts.length ? '' : 'No hay platos disponibles.';

  for (const product of visibleProducts) {
    const card = document.createElement('article');
    const name = document.createElement('h3');
    const price = document.createElement('p');
    const availability = document.createElement('p');
    const details = document.createElement('details');
    const summary = document.createElement('summary');
    const description = document.createElement('p');

    name.textContent = product.name;
    price.textContent = currency.format(product.price_cents / 100);

    if (product.available_units === 0) {
      availability.textContent = 'Agotado';
      availability.className = 'sold-out';
    } else {
      availability.textContent = `Unidades disponibles: ${product.available_units}`;
    }

    summary.textContent = 'Ver detalles';
    description.textContent = product.description;
    details.append(summary, description);
    card.append(name, price, availability, details);
    menu.append(card);
  }
}

async function loadMenu() {
  try {
    const response = await fetch('/api/menu');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const products = await response.json();
    const categories = [...new Set(products.map((product) => product.category))];

    for (const category of [null, ...categories]) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = category ?? 'Todos';
      button.setAttribute('aria-pressed', String(category === null));
      button.addEventListener('click', () => {
        for (const filter of filters.children) {
          filter.setAttribute('aria-pressed', String(filter === button));
        }
        renderMenu(products, category);
      });
      filters.append(button);
    }

    renderMenu(products, null);
  } catch (error) {
    console.error(error);
    status.textContent = 'No se pudo cargar el menú. Recarga la página para intentarlo de nuevo.';
  }
}

loadMenu();
