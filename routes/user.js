const express = require("express");
const bcrypt = require("bcrypt");
const _ = require("lodash");

const router = express.Router();

const {
  userModel,
  userLoginValidate,
  userValidate,
} = require("../models/user");
const { machineModel } = require("../models/machine");
const auth = require("../middleware/auth");

router.post("/register", async (req, res) => {
  const error = userValidate(req.body);
  if (error) return res.status(400).send(error.details[0].message);

  const user = await userModel.findOne({ email: req.body.email }).select("_id");
  if (user) return res.status(409).send("User is already registered.");

  let propertiesToPick = ["name", "email", "password"];
  req.body.password = await bcrypt.hash(req.body.password, 10);

  const newUser = await userModel.register(req.body, propertiesToPick);
  propertiesToPick.pop();
  const token = newUser.generateAuthToken();
  res.send(_.pick(newUser, propertiesToPick));
});

router.post("/login", async (req, res) => {
  const error = userLoginValidate(req.body);
  if (error) return res.status(400).send(error.details[0].message);

  const user = await userModel
    .findOne({ email: req.body.email })
    .select("_id password name email");
  if (!user) return res.status(400).send("invalid email or password");
  const isPasswordCorrect = await bcrypt.compare(
    req.body.password,
    user.password
  );
  if (!isPasswordCorrect)
    return res.status(400).send("invalid email or password");
  const token = user.generateAuthToken();
  res.send({ token: token, name: user.name, email: user.email });
});

router.get("/", auth, async (req, res) => {
  const user = await userModel.findById(req.data._id).select("name machines");
  if (!user) return res.status(400).send("invalid user");
  const resObj = { name: user.name, machines: [] };
  for (let i = 0; i < user.machines.length; i++) {
    const mach = await machineModel
      .findById(user.machines[i])
      .select("name address _id productKey");
    if (mach) {
      resObj.machines.push(mach);
    }
  }
  res.send(resObj);
});

module.exports = router;
