const sharp = require('sharp');
const { db } = require('../repositories/menuRepository');

const list = db.prepare(`
  SELECT id, name, category, description, price_cents, available_units, archived,
         photo_jpeg IS NOT NULL AS has_photo
  FROM products ORDER BY archived, category, name
`);
const insert = db.prepare(`
  INSERT INTO products
    (name, category, description, price_cents, available_units, photo_jpeg)
  VALUES (?, ?, ?, ?, ?, ?)
`);
const update = db.prepare(`
  UPDATE products
  SET name = ?, category = ?, description = ?, price_cents = ?, available_units = ?,
      photo_jpeg = COALESCE(?, photo_jpeg)
  WHERE id = ? AND archived = 0
`);
const archive = db.prepare('UPDATE products SET archived = 1 WHERE id = ? AND archived = 0');
const getPhoto = db.prepare('SELECT photo_jpeg FROM products WHERE id = ? AND archived = 0');

function listDishes(req, res) {
  res.set('Cache-Control', 'no-store').json(list.all());
}

async function saveDish(req, res) {
  const body = req.body ?? {};
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const category = typeof body.category === 'string' ? body.category.trim() : '';
  const description = typeof body.description === 'string' ? body.description.trim() : '';
  const { priceCents, availableUnits, photo } = body;
  const id = req.params.id === undefined ? null : Number(req.params.id);

  if (!name || name.length > 80 || !category || category.length > 40 ||
      !description || description.length > 400 ||
      !Number.isSafeInteger(priceCents) || priceCents < 1 || priceCents > 100000 ||
      !Number.isSafeInteger(availableUnits) || availableUnits < 0 || availableUnits > 999 ||
      (id !== null && (!Number.isSafeInteger(id) || id < 1))) {
    return res.status(400).json({ error: 'Revisa el nombre, la categoría, la descripción, el precio y las unidades.' });
  }

  let jpeg = null;
  if (photo !== undefined) {
    if (typeof photo !== 'string' || photo.length > 6000000 ||
        !/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(photo)) {
      return res.status(400).json({ error: 'Elige una foto JPG, PNG o WebP de hasta 4 MB.' });
    }

    try {
      const original = Buffer.from(photo.slice(photo.indexOf(',') + 1), 'base64');
      if (original.length > 4 * 1024 * 1024) {
        return res.status(400).json({ error: 'La foto debe pesar hasta 4 MB.' });
      }
      const image = sharp(original, { limitInputPixels: 24000000 });
      const { format } = await image.metadata();
      if (!['jpeg', 'png', 'webp'].includes(format)) {
        return res.status(400).json({ error: 'Elige una foto JPG, PNG o WebP.' });
      }
      jpeg = await image.rotate()
        .resize({ width: 1000, height: 1000, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 85 }).toBuffer();
    } catch {
      return res.status(400).json({ error: 'No se pudo leer la foto.' });
    }
  }

  const fields = [name, category, description, priceCents, availableUnits, jpeg];
  if (id === null) {
    const result = insert.run(...fields);
    return res.status(201).json({ id: result.lastInsertRowid });
  }

  if (update.run(...fields, id).changes === 0) {
    return res.status(404).json({ error: 'No se encontró un plato activo con ese número.' });
  }
  res.json({ id });
}

function archiveDish(req, res) {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1 || archive.run(id).changes === 0) {
    return res.status(404).json({ error: 'No se encontró un plato activo con ese número.' });
  }
  res.json({ archived: true });
}

function dishPhoto(req, res) {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1) return res.sendStatus(404);
  const photo = getPhoto.get(id)?.photo_jpeg;
  if (!photo) return res.sendStatus(404);
  res.set('Cache-Control', 'no-cache').type('image/jpeg').send(Buffer.from(photo));
}

module.exports = { listDishes, saveDish, archiveDish, dishPhoto };

