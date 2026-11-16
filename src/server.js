const express = require('express');
const path = require('node:path');
const { getMenu } = require('./controllers/menuController');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, '../public')));
app.get('/api/menu', getMenu);
const { postCartQuote } = require('./controllers/cartController');
app.post('/api/cart/quote', express.json(), postCartQuote);
const { getPickupTimes, postOrder } = require('./controllers/orderController');
app.get('/api/pickup-times', getPickupTimes);
app.post('/api/orders', express.json(), postOrder);

const { rateLimit } = require('express-rate-limit');
const { login, logout, requireOwner } = require('./controllers/ownerAuth');
const limitOwnerLogin = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  message: { error: 'Demasiados intentos. Vuelve a intentar en unos minutos.' }
});

app.post('/api/owner/login', limitOwnerLogin, express.json({ limit: '2kb' }), login);
app.get('/api/owner/session', requireOwner, (req, res) => res.json({ signedIn: true }));
app.post('/api/owner/logout', logout);
const { getPendingOrders } = require('./controllers/ownerOrders');
app.get('/api/owner/orders', requireOwner, getPendingOrders);

const { listDishes, saveDish, archiveDish, dishPhoto } = require('./controllers/ownerMenu');
const dishBody = express.json({ limit: '6mb' });

app.get('/api/owner/dishes', requireOwner, listDishes);
app.post('/api/owner/dishes', requireOwner, dishBody, saveDish);
app.put('/api/owner/dishes/:id', requireOwner, dishBody, saveDish);
app.delete('/api/owner/dishes/:id', requireOwner, archiveDish);
app.get('/api/dishes/:id/photo', dishPhoto);

app.listen(port, () => {
  console.log(`Dona Ana is running at http://localhost:${port}`);
});





