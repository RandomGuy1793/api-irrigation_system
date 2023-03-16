const mongoose = require("mongoose");

const productKeySchema = new mongoose.Schema({
  productKey: {
    type: String,
    length: 15,
    required: true,
  },
  isRegistered: {
    type: Boolean,
    default:false
  },
});

const productKey = mongoose.model("productKey", productKeySchema);

exports.productKey=productKey
