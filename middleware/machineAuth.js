const { isProductAuthentic } = require("../models/productKey");

module.exports = async function (req, res, next) {
  const { productKey: pKey, code } = req.body;
  if (pKey && code && (await isProductAuthentic(pKey, code))) next();
  else return res.status(401).send("Access denied, invalid productKey or Code");
};
