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

const logDiff = 3e5; // time diff.in millis

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

  const machine = await machineModel.findById(req.params.id);
  if (!machine) return res.status(404).send("machine unavailable");

  res.send(
    _.pick(machine, [
      "name",
      "address",
      "waterTankLevel",
      "thresholdMoisture",
      "soilMoisture",
      "isMotorOn",
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
    _.pick(req.body, ["waterLevel", "soilMoisture", "motorOn"])
  );
  if (err) return res.status(400).send(err.details[0].message);

  const mach = await machineModel.findOne({ productKey: req.body.productKey });
  if (!mach) return res.status(404).send("machine unavailable");
  updateWaterTank(req.body, mach);
  updateSoilMoisture(req.body, mach);
  updateMotorLog(req.body, mach);

  if (req.body.waterLevel <= 10) {
    mach.isMotorOn = false;
    await mach.save();
  } else if (mach.thresholdMoisture >= 0) {
    await mach.save();
    await updateMotorBasedOnThreshold(mach.thresholdMoisture, mach._id);
  } else await mach.save();
  res.send("water level, soil moisture and motor status received successfully");
});

const updateWaterTank = (details, mach) => {
  mach.waterTankLevel = details.waterLevel;
  const len = mach.waterTankLog.length;
  if (len > 0) {
    const d1 = new Date(mach.waterTankLog[len - 1].createdAt),
      d2 = new Date();
    const diff = d2.valueOf() - d1.valueOf();
    if (diff > logDiff)
      mach.waterTankLog.push({ waterLevel: details.waterLevel });
  } else mach.waterTankLog.push({ waterLevel: details.waterLevel });
};

const updateSoilMoisture = (details, mach) => {
  mach.soilMoisture = details.soilMoisture;
  const len = mach.soilMoistureLog.length;
  if (len > 0) {
    const d1 = new Date(mach.soilMoistureLog[len - 1].createdAt),
      d2 = new Date();
    const diff = d2 - d1;
    if (diff > logDiff) {
      mach.soilMoistureLog.push({
        moistureLevel: mach.soilMoisture,
        createdAt: new Date().toISOString(),
      });
    }
  } else {
    mach.soilMoistureLog.push({
      moistureLevel: mach.soilMoisture,
      createdAt: new Date().toISOString(),
    });
  }
};

const updateMotorLog = (details, mach) => {
  if (mach.motorLog.length === 0) {
    if (details[`motorOn`] === true) {
      mach.motorLog.push({
        isMotorOn: details[`motorOn`],
        createdAt: new Date().toISOString(),
      });
    }
  } else if (
    mach.motorLog[mach.motorLog.length - 1].isMotorOn !== details[`motorOn`]
  ) {
    mach.motorLog.push({
      isMotorOn: details[`motorOn`],
      createdAt: new Date().toISOString(),
    });
  }
};

module.exports = router;
