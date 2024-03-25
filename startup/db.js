const mongoose = require("mongoose");
const config = require("config");

const mongoDbUrl = config.get("mongoDb");
module.exports = async function () {
  try {
    await mongoose.connect(mongoDbUrl);
    console.log("connected to mongoDB");
  } catch (err) {
    console.log(err);
    process.exit(1);
  }
};
