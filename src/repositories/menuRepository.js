const { mkdirSync } = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const dataDirectory = path.join(__dirname, '../../data');
mkdirSync(dataDirectory, { recursive: true });

const db = new DatabaseSync(path.join(dataDirectory, 'dona-ana.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT NOT NULL,
    price_cents INTEGER NOT NULL,
    available_units INTEGER NOT NULL,
    archived INTEGER NOT NULL DEFAULT 0
  );

  INSERT OR IGNORE INTO products
    (id, name, category, description, price_cents, available_units)
  VALUES
    (1, 'Pastelito de pollo', 'Pastelitos', 'Masa dorada rellena de pollo.', 250, 12),
    (2, 'Pastelito de queso', 'Pastelitos', 'Masa dorada rellena de queso.', 225, 8),
    (3, 'Flan casero', 'Postres', 'Flan de vainilla con caramelo.', 350, 0);
`);

const listProducts = db.prepare(`
  SELECT id, name, category, description, price_cents, available_units
  FROM products
  WHERE archived = 0
  ORDER BY category, name
`);

function listMenu() {
  return listProducts.all();
}

module.exports = { listMenu };
