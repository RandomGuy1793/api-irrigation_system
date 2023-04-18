const express = require("express");
const _ = require("lodash");

const router = express.Router();

const {
  machineModel,
  machineValidate,
  validateMotorThreshold,
  updateMotorBasedOnThreshold,
  validateIotData,
} = require("../models/machine");
const { userModel, MachineBelongsToUser } = require("../models/user");
const { productKeyModel } = require("../models/productKey");
const auth = require("../middleware/auth");
const validateObjId = require("../middleware/validateObjId");
const machineAuth = require("../middleware/machineAuth");

router.post("/register", auth, async (req, res) => {
  const user = await userModel.findById(req.data._id);
  if (!user) return res.status(400).send("User not available.");
  const error = machineValidate(req.body);
  if (error) return res.status(400).send(error.details[0].message);

  const prodKey = await productKeyModel
    .findOne({ productKey: req.body.productKey })
    .select("productKey isRegistered");
  if (!prodKey || prodKey.isRegistered === true)
    return res.status(404).send("Machine not valid");
  prodKey.isRegistered = true;

  let propertiesToPick = ["name", "productKey", "address"];
  const newMachine = await machineModel.register(req.body, propertiesToPick);

  user.machines.push(newMachine._id);
  await user.save();
  await prodKey.save();
  res.send(
    _.pick(newMachine, [
      "name",
      "productKey",
      "address",
      "thresholdMoisture",
      "_id",
    ])
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

router.get("/:id", [auth, validateObjId], async (req, res) => {
  const isUserAuthorized = await MachineBelongsToUser(
    req.data._id,
    req.params.id
  );
  if (isUserAuthorized === false)
    return res.status(404).send("machine not found for the user");

  let machine = await machineModel.findById(req.params.id);
  if (!machine) return res.status(404).send("machine unavailable");

  await machine.consolidateMotorLog()
  machine = await machineModel.findById(req.params.id);
  res.send(
    _.pick(machine, [
      "name",
      "address",
      "waterTankLevel",
      "thresholdMoisture",
      "soilMoisture",
      "motorUsagePerDay",
      "isMotorOn",
      "waterTankLog",
      "soilMoistureLog",
    ])
  );
});

router.put(
  "/motor-threshold/auto/:id",
  [auth, validateObjId],
  async (req, res) => {
    const isUserAuthorized = await MachineBelongsToUser(
      req.data._id,
      req.params.id
    );
    if (isUserAuthorized === false)
      return res.status(404).send("machine not found for the user");

    const machine = await machineModel.findById(req.params.id);
    if (!machine) return res.status(404).send("machine unavailable");

    const error = validateMotorThreshold(req.body, true);
    if (error) return res.status(400).send(error.details[0].message);

    machine.thresholdMoisture = req.body.thresholdMoisture;
    await machine.save();
    if (machine.waterTankLevel <= 10)
      return res.send("threshold updated.\nmotors off due to low tank water");
    await updateMotorBasedOnThreshold(
      req.body.thresholdMoisture,
      req.params.id
    );
    res.send("motors updated successfully");
  }
);

router.put(
  "/motor-threshold/manual/:id",
  [auth, validateObjId],
  async (req, res) => {
    const isUserAuthorized = await MachineBelongsToUser(
      req.data._id,
      req.params.id
    );
    if (isUserAuthorized === false)
      return res.status(404).send("machine not found for the user");

    const machine = await machineModel.findById(req.params.id);
    if (!machine) return res.status(404).send("machine unavailable");

    const error = validateMotorThreshold(req.body, false);
    if (error) return res.status(400).send(error.details[0].message);

    machine.thresholdMoisture = -1;
    if (machine.waterTankLevel <= 10) {
      await machine.save();
      return res.status(403).send("can't turn on motor.\nTank water low");
    }
    machine.isMotorOn = req.body.motorOn;
    await machine.save();
    res.send("motors updated successfully");
  }
);

router.get("/iot/get-motor-status", machineAuth, async (req, res) => {
  const mach = await machineModel
    .findOne({ productKey: req.body.productKey })
    .select("isMotorOn");
  if (!mach) return res.status(404).send("machine unavailable");
  res.send({ isMotorOn: mach.isMotorOn });
});

router.post("/iot/send-data", machineAuth, async (req, res) => {
  const err = validateIotData(
    _.pick(req.body, [
      "waterLevel",
      "soilMoisture0",
      "soilMoisture1",
      "soilMoisture2",
      "soilMoisture3",
      "motorOn",
    ])
  );
  if (err) return res.status(400).send(err.details[0].message);

  const mach = await machineModel.findOne({ productKey: req.body.productKey });
  if (!mach) return res.status(404).send("machine unavailable");
  mach.updateWaterTank(req.body);
  mach.updateSoilMoisture(req.body);
  mach.updateMotorLog(req.body);

  if (req.body.waterLevel <= 10) {
    mach.isMotorOn = false;
    await mach.save();
  } else if (mach.thresholdMoisture >= 0) {
    await mach.save();
    await updateMotorBasedOnThreshold(mach.thresholdMoisture, mach._id);
  } else await mach.save();
  res.send("water level, soil moisture and motor status received successfully");
});

module.exports = router;
