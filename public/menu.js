const filters = document.querySelector('#filters');
const menu = document.querySelector('#menu');
const status = document.querySelector('#status');
const currency = new Intl.NumberFormat('es-US', {
  style: 'currency',
  currency: 'USD'
});

const demoPhotos = {
  1: '/images/pastelito-pollo.jpg',
  2: '/images/pastelito-queso.jpg',
  3: '/images/flan-casero.jpg'
};

function renderMenu(products, category) {
  menu.replaceChildren();
  const featuredProductId = products.find((product) => product.available_units > 0)?.id;
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
    const photoUrl = demoPhotos[product.id];
    if (photoUrl) {
      const photo = document.createElement('img');
      photo.className = 'dish-photo';
      photo.alt = '';
      photo.addEventListener('error', () => photo.remove(), { once: true });
      photo.src = photoUrl;
      card.append(photo);
    }
    if (product.id === featuredProductId) {
      const featured = document.createElement('p');
      featured.textContent = 'Destacado';
      featured.style.color = '#713526';
      featured.style.fontWeight = '700';
      card.append(featured);
    }
    card.append(name, price, availability, details);
    menu.append(card);
  }
}

const pickupDate = document.querySelector('#pickup-date');
const dateLabel = new Intl.DateTimeFormat('es-US', {
  weekday: 'long',
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC'
});

async function loadMenu(date) {
  pickupDate.disabled = true;
  filters.replaceChildren();
  menu.replaceChildren();
  status.textContent = 'Cargando el menú…';

  try {
    const url = date ? `/api/menu?date=${encodeURIComponent(date)}` : '/api/menu';
    const response = await fetch(url);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'No se pudo cargar el menú.');

    pickupDate.replaceChildren();
    for (const day of data.pickupDates) {
      const label = dateLabel.format(new Date(`${day.date}T00:00:00Z`));
      pickupDate.add(new Option(day.open ? label : `${label} (cerrado)`, day.date));
    }
    pickupDate.value = data.pickupDate;

    if (data.closed) {
      status.textContent = 'Ese día estamos cerrados. Elige otra fecha de recogida.';
      return;
    }

    const categories = [...new Set(data.products.map((product) => product.category))];

    for (const category of [null, ...categories]) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = category ?? 'Todos';
      button.setAttribute('aria-pressed', String(category === null));
      button.addEventListener('click', () => {
        for (const filter of filters.children) {
          filter.setAttribute('aria-pressed', String(filter === button));
        }
        renderMenu(data.products, category);
      });
      filters.append(button);
    }

    renderMenu(data.products, null);
  } catch (error) {
    console.error(error);
    status.textContent = 'No se pudo cargar el menú. Recarga la página e inténtalo de nuevo.';
  } finally {
    pickupDate.disabled = pickupDate.options.length === 0;
  }
}

pickupDate.addEventListener('change', () => loadMenu(pickupDate.value));
loadMenu();


