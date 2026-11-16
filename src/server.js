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

app.listen(port, () => {
  console.log(`Dona Ana is running at http://localhost:${port}`);
});


