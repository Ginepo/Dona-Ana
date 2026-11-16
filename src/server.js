const express = require('express');
const path = require('node:path');
const { getMenu } = require('./controllers/menuController');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, '../public')));
app.get('/api/menu', getMenu);

app.listen(port, () => {
  console.log(`Dona Ana is running at http://localhost:${port}`);
});
