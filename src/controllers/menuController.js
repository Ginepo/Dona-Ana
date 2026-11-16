const { listMenu } = require('../repositories/menuRepository');

function getMenu(req, res) {
  res.json(listMenu());
}

module.exports = { getMenu };
