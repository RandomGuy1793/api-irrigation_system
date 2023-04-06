const jwt = require("jsonwebtoken");
const config = require("config");

const tokenOffset = 7;

module.exports = function (req, res, next) {
  const received_token = req.header("authorization");
  const token = received_token.substr(tokenOffset, received_token.length);
  if (!token) return res.status(401).send("Access denied, no token provided.");
  try {
    const jwtKey = config.get("jwtKey");
    const verified = jwt.verify(token, jwtKey);
    req.data = verified;
    next();
  } catch (ex) {
    res.status(400).send("Token invalid.");
  }
};
