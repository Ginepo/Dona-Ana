const ownerMenuEditor = (() => {
  const form = document.querySelector('#dish-form');
  const fields = form.elements;
  const list = document.querySelector('#dish-list');
  const status = document.querySelector('#dish-status');
  const action = document.querySelector('#dish-action');
  const cancel = document.querySelector('#cancel-dish-edit');
  const fieldset = form.querySelector('fieldset');
  let editingId = null;
  let sessionVersion = 0;

  function resetForm() {
    editingId = null;
    form.reset();
    action.textContent = 'Nuevo plato';
    cancel.hidden = true;
  }

  function clear() {
    sessionVersion++;
    list.replaceChildren();
    status.textContent = '';
    resetForm();
  }

  async function request(path = '', options = {}) {
    const response = await fetch(`/api/owner/dishes${path}`, {
      cache: 'no-store', ...options
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'No se pudo actualizar el menú.');
    return data;
  }

  function edit(dish) {
    editingId = dish.id;
    form.reset();
    action.textContent = `Editar ${dish.name}`;
    cancel.hidden = false;
    fields.dishName.value = dish.name;
    fields.category.value = dish.category;
    fields.description.value = dish.description;
    fields.price.value = (dish.price_cents / 100).toFixed(2);
    fields.units.value = dish.available_units;
    fields.dishName.focus();
  }

  async function load() {
    const version = sessionVersion;
    const dishes = await request();
    if (version !== sessionVersion) return;
    list.replaceChildren();

    for (const dish of dishes) {
      const card = document.createElement('article');
      const label = document.createElement('h3');
      label.textContent = dish.archived ? `${dish.name} (archivado)` : dish.name;
      card.append(label);

      if (!dish.archived) {
        const editButton = document.createElement('button');
        editButton.type = 'button';
        editButton.textContent = 'Editar';
        editButton.addEventListener('click', () => edit(dish));

        const archiveButton = document.createElement('button');
        archiveButton.type = 'button';
        archiveButton.textContent = 'Archivar';
        archiveButton.addEventListener('click', async () => {
          if (!confirm(`¿Archivar ${dish.name}?`)) return;
          archiveButton.disabled = true;
          try {
            await request(`/${dish.id}`, { method: 'DELETE' });
            if (version !== sessionVersion) return;
            if (editingId === dish.id) resetForm();
            status.textContent = 'Plato archivado.';
            await load();
          } catch (error) {
            if (version === sessionVersion) status.textContent = error.message;
          } finally {
            archiveButton.disabled = false;
          }
        });

        card.append(editButton, ' ', archiveButton);
      }

      list.append(card);
    }
  }

  function photoData(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('No se pudo leer la foto.'));
      reader.readAsDataURL(file);
    });
  }

  cancel.addEventListener('click', resetForm);
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const version = sessionVersion;
    const id = editingId;
    const file = fields.photo.files[0];
    const payload = {
      name: fields.dishName.value,
      category: fields.category.value,
      description: fields.description.value,
      priceCents: Math.round(fields.price.valueAsNumber * 100),
      availableUnits: fields.units.valueAsNumber
    };

    fieldset.disabled = true;
    list.inert = true;
    try {
      if (file) {
        if (file.size > 4 * 1024 * 1024) throw new Error('La foto debe pesar hasta 4 MB.');
        payload.photo = await photoData(file);
      }
      if (version !== sessionVersion) return;

      await request(id === null ? '' : `/${id}`, {
        method: id === null ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (version !== sessionVersion) return;

      resetForm();
      status.textContent = 'Plato guardado.';
      await load();
    } catch (error) {
      if (version === sessionVersion) status.textContent = error.message;
    } finally {
      fieldset.disabled = false;
      list.inert = false;
    }
  });

  return {
    clear,
    refresh() {
      const version = sessionVersion;
      return load().catch((error) => {
        if (version === sessionVersion) status.textContent = error.message;
      });
    }
  };
})();
