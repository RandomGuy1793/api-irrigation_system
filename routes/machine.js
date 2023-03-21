const express = require("express");
const _ = require("lodash");

const router = express.Router();

const {
  machineModel,
  machineValidate,
  validateMotorThreshold,
  updateMotorBasedOnThreshold,
  validateWaterLevel,
  validateSoilMoisture,
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

  let propertiesToPick = ["productKey", "address"];
  const newMachine = await machineModel.register(req.body, propertiesToPick);

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

router.get("/motor-threshold/:id", [auth, validateObjId], async (req, res) => {
  const isUserAuthorized = await MachineBelongsToUser(
    req.data._id,
    req.params.id
  );
  if (isUserAuthorized === false)
    return res.status(404).send("machine not found for the user");

  const machine = await machineModel.findById(req.params.id);
  if (!machine) return res.status(404).send("machine unavailable");

  res.send(_.pick(machine, ["thresholdMoisture", "soilMoisture"]));
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
    if (
      machine.waterTankLog.length > 0 &&
      machine.waterTankLog[machine.waterTankLog.length - 1].waterLevel <= 10
    )
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
    if (
      machine.waterTankLog.length > 0 &&
      machine.waterTankLog[machine.waterTankLog.length - 1].waterLevel <= 10
    ) {
      await machine.save();
      return res.status(403).send("can't turn on motor.\nTank water low");
    }
    machine.soilMoisture[0].isMotorOn = req.body.motor0On;
    machine.soilMoisture[1].isMotorOn = req.body.motor1On;
    machine.soilMoisture[2].isMotorOn = req.body.motor2On;
    machine.soilMoisture[3].isMotorOn = req.body.motor3On;
    await machine.save();
    res.send("motors updated successfully");
  }
);

router.get("/iot/get-motor-status", machineAuth, async (req, res) => {
  const mach = await machineModel
    .findOne({ productKey: req.body.productKey })
    .select("soilMoisture");
  if (!mach) return res.status(404).send("machine unavailable");
  res.send(mach.soilMoisture.map((item) => _.pick(item, ["isMotorOn"])));
});

router.post("/iot/tank-level", machineAuth, async (req, res) => {
  const err = validateWaterLevel({ waterLevel: req.body.waterLevel });
  if (err) return res.status(400).send(err.details[0].message);

  const mach = await machineModel
    .findOne({ productKey: req.body.productKey })
    .select("waterTankLog soilMoisture thresholdMoisture _id");
  if (!mach) return res.status(404).send("machine unavailable");
  mach.waterTankLog.push({ waterLevel: req.body.waterLevel });

  if (req.body.waterLevel <= 10) {
    mach.soilMoisture.map((item) => {
      item.isMotorOn = false;
      return item;
    });
  } else if (req.body.waterLevel > 10 && mach.thresholdMoisture >= 0) {
    await updateMotorBasedOnThreshold(mach.thresholdMoisture, mach._id);
  }
  await mach.save();
  res.send("tank water level received successfully");
});

router.post("/iot/soil-moisture", machineAuth, async (req, res) => {
  const err = await validateSoilMoisture(
    _.pick(req.body, [
      "soilMoisture0",
      "soilMoisture1",
      "soilMoisture2",
      "soilMoisture3",
    ])
  );
  if (err) return res.status(400).send(err.details[0].message);

  const mach = await machineModel
    .findOne({ productKey: req.body.productKey })
    .select("soilMoisture soilMoistureLog thresholdMoisture waterTankLog _id");
  if (!mach) return res.status(404).send("machine unavailable");

  mach.soilMoisture[0].value = req.body.soilMoisture0;
  mach.soilMoisture[1].value = req.body.soilMoisture1;
  mach.soilMoisture[2].value = req.body.soilMoisture2;
  mach.soilMoisture[3].value = req.body.soilMoisture3;
  for (let i = 0; i < 4; i++) {
    mach.soilMoistureLog[i].push({
      moistureLevel: mach.soilMoisture[i].value,
      createdAt: new Date().toISOString(),
    });
  }
  await mach.save();
  if (
    mach.waterTankLog.length > 0 &&
    mach.waterTankLog[mach.waterTankLog.length - 1].waterLevel > 10 &&
    mach.thresholdMoisture >= 0
  ) {
    await updateMotorBasedOnThreshold(mach.thresholdMoisture, mach._id);
  }
  res.send("soil moisture logged successfully");
});

router.post("/iot/send-motor-status", machineAuth, async (req, res) => {
  const err = validateMotorThreshold(
    _.pick(req.body, ["motor0On", "motor1On", "motor2On", "motor3On"]),
    false
  );
  if (err) return res.status(400).send(err.details[0].message);

  const mach = await machineModel
    .findOne({ productKey: req.body.productKey })
    .select("motorLog");
  if (!mach) return res.status(404).send("machine unavailable");
  for (let i = 0; i < 4; i++) {
    if (mach.motorLog[i].length === 0) {
      if (req.body[`motor${i}On`] === true) {
        mach.motorLog[i].push({
          isMotorOn: req.body[`motor${i}On`],
          createdAt: new Date().toISOString(),
        });
      }
    } else if (
      mach.motorLog[i][mach.motorLog[i].length - 1].isMotorOn !==
      req.body[`motor${i}On`]
    ) {
      mach.motorLog[i].push({
        isMotorOn: req.body[`motor${i}On`],
        createdAt: new Date().toISOString(),
      });
    }
  }
  await mach.save();
  res.send("motor status logged successfully");
});

module.exports = router;
