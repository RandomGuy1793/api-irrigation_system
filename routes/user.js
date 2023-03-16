const express = require("express");
const bcrypt = require("bcrypt");
const _ = require("lodash");

const router = express.Router();

const {
  userModel,
  userLoginValidate,
  userValidate,
} = require("../models/user");

router.post("/register", async (req, res) => {
  const error = userValidate(req.body, true);
  if (error) return res.status(400).send(error.details[0].message);

  const user = await userModel.findOne({ email: req.body.email }).select("_id");
  if (user) return res.status(409).send("User is already registered.");

  let propertiesToPick = ["name", "email", "password"];
  req.body.password = await bcrypt.hash(req.body.password, 10);

  const newUser = await userModel.register(req.body, propertiesToPick);
  propertiesToPick.pop();
  const token = newUser.generateAuthToken();
  res.header("x-auth-token", token).send(_.pick(newUser, propertiesToPick));
});

router.post("/login", async (req, res) => {
  const error = userLoginValidate(req.body);
  if (error) return res.status(400).send(error.details[0].message);

  const user = await userModel
    .findOne({ email: req.body.email })
    .select("_id password name");
  if (!user) return res.status(400).send("invalid email or password");
  const isPasswordCorrect = await bcrypt.compare(
    req.body.password,
    user.password
  );
  if (!isPasswordCorrect)
    return res.status(400).send("invalid email or password");
  const token = user.generateAuthToken();
  res.header("x-auth-token", token).send("login successful");
});

module.exports = router;
