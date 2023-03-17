const express = require("express");
const _ = require("lodash");

const router = express.Router();

const { machineModel, machineValidate } = require("../models/machine");
const { userModel } = require("../models/user");
const { productKeyModel } = require("../models/productKey");
const auth = require("../middleware/auth");

router.post("/register", auth, async (req, res) => {
  const user = await userModel.findById(req.data._id);
  if (!user) return res.status(400).send("User not available.");
  const error = machineValidate(req.body);
  if (error) return res.status(400).send(error.details[0].message);

  const prodKey = await productKeyModel
    .findOne({ productKey: req.body.productKey })
    .select("productKey, isRegistered");
  if (!prodKey || prodKey.isRegistered === true)
    return res.status(404).send("Machine not valid");
  prodKey.isRegistered = true;

  let propertiesToPick = ["productKey", "address"];
  const newMachine = await machineModel.register(req.body, propertiesToPick);
  // console.log(newMachine);

  user.machines.push(newMachine._id);
  await user.save();
  await prodKey.save();
  res.send(
    _.pick(newMachine, ["productKey", "address", "thresholdMoisture", "_id"])
  );
});

module.exports = router;
