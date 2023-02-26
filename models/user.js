const mongoose = require("mongoose");
const config = require("config");
const jwt = require("jsonwebtoken");
const Joi = require("joi");
const _ = require("lodash");

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    minlength: 3,
    maxlength: 50,
    required: true,
  },
  email: {
    type: String,
    minlength: 3,
    maxlength: 50,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    minlength: 3,
    maxlength: 255,
    required: true,
  },
  machines: [
    {
      type: mongoose.Schema.Types.ObjectId,
    },
  ],
});

const jwtKey = config.get("jwtKey");
userSchema.methods.generateAuthToken = function () {
  return jwt.sign({ _id: this._id, name: this.name }, jwtKey);
};

userSchema.statics.register = async function (details, propertiesToPick) {
  const newUser = new this(_.pick(details, propertiesToPick));
  await newUser.save();
  return newUser;
};

const user = mongoose.model("user", userSchema);

const loginValidate = (customer) => {
  const schema = Joi.object({
    email: Joi.string().trim().email().min(3).max(50).required(),
    password: Joi.string().trim().min(3).max(255).required(),
  });
  return schema.validate(customer).error;
};

const userValidate = (customer) => {
  const schema = Joi.object({
    name: Joi.string().trim().min(3).max(50).required(),
    email: Joi.string().trim().email().min(3).max(50).required(),
    password: Joi.string().trim().min(3).max(255).required(),
  });
  return schema.validate(customer).error;
};

exports.userModel = user;
exports.userLoginValidate = loginValidate;
exports.userValidate = userValidate;
