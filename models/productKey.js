const mongoose = require("mongoose");
const Joi = require("joi");

const productKeySchema = new mongoose.Schema({
  productKey: {
    type: String,
    length: 15,
    required: true,
    unique: true,
  },
  code: {
    // unique 10 digit code for machine authentication
    type: String,
    length: 10,
    required: true,
    unique: true,
  },
  isRegistered: {
    type: Boolean,
    default: false,
  },
});

const productKey = mongoose.model("productkeys", productKeySchema);

const isProductAuthentic = async (pKey, code) => {
  const err = Joi.object({
    productKey: Joi.string().trim().length(15).required(),
    code: Joi.string().trim().length(10).required(),
  }).validate({ productKey: pKey, code: code }).error;
  if (err) return false;
  const prod = await productKey.findOne({ productKey: pKey });
  return prod && prod.code === code && prod.isRegistered;
};

exports.productKeyModel = productKey;
exports.isProductAuthentic = isProductAuthentic;
