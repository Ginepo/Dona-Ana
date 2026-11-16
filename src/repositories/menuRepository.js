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

db.exec(`
  CREATE TABLE IF NOT EXISTS product_availability (
    pickup_date TEXT NOT NULL,
    product_id INTEGER NOT NULL REFERENCES products(id),
    available_units INTEGER NOT NULL CHECK (available_units >= 0),
    PRIMARY KEY (pickup_date, product_id)
  );
`);

const initializeAvailability = db.prepare(`
  INSERT OR IGNORE INTO product_availability
    (pickup_date, product_id, available_units)
  SELECT ?, id,
    CASE
      WHEN id = 1 AND strftime('%w', ?) = '2' THEN MIN(available_units, 6)
      ELSE available_units
    END
  FROM products
  WHERE archived = 0
`);

const listProducts = db.prepare(`
  SELECT p.id, p.name, p.category, p.description, p.price_cents, a.available_units
  FROM products AS p
  JOIN product_availability AS a ON a.product_id = p.id
  WHERE p.archived = 0 AND a.pickup_date = ?
  ORDER BY p.category, p.name
`);

function listMenu(pickupDate) {
  initializeAvailability.run(pickupDate, pickupDate);
  return listProducts.all(pickupDate);
}

module.exports = { db, listMenu };

