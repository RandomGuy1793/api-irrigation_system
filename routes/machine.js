const express = require("express");
const _ = require("lodash");

const router = express.Router();

const { machineModel, machineValidate } = require("../models/machine");
const { userModel } = require("../models/user");
const { productKeyModel } = require("../models/productKey");
const auth = require("../middleware/auth");
const validateObjId = require("../middleware/validateObjId");

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

router.delete("/delete/:id", [auth, validateObjId], async (req, res) => {
  const user = await userModel.findById(req.data._id);
  if (!user) return res.status(400).send("Invalid User");

  const mod = await userModel.updateOne(
    { _id: req.data._id },
    {
      $pull: {
        machines: req.params.id,
      },
    }
  );
  if (mod.modifiedCount === 1) {
    const mac = await machineModel.findById(req.params.id).select("productKey");
    if (mac) {
      const prod = await productKeyModel.findOne({
        productKey: mac.productKey,
      });
      if (prod) {
        prod.isRegistered = false;
        await prod.save();
      }
    }

    await machineModel.deleteOne({ _id: req.params.id });
    return res.send("deleted successfully");
  }
  res.status(404).send();
});

module.exports = router;
