const mongoose = require("mongoose");
const config = require("config");

const mongoDbUrl = config.get("mongoDb");
module.exports = function () {
  mongoose.connect(mongoDbUrl).then(() => console.log("connected to mongoDb"));
};
