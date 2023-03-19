const mongoose = require("mongoose");
const Joi = require("joi");
const _ = require("lodash");

const machineSchema = new mongoose.Schema({
  productKey: {
    type: String,
    length: 15,
    required: true,
    unique: true,
  },
  address: {
    type: String,
    minlength: 10,
    maxlength: 100,
    required: true,
  },
  soilMoisture: [
    // array of size 4 with smvalue
    {
      value: {
        type: Number,
        min: 0,
        max: 100,
        default: 50,
        required: true,
      },
      isMotorOn: {
        type: Boolean,
        default: false,
        required: true,
      },
    },
  ],
  thresholdMoisture: {
    type: Number,
    min: -1,
    max: 100,
    default: 50,
    required: true,
  },
  waterTankLog: [
    {
      type: new mongoose.Schema(
        {
          waterLevel: {
            type: Number,
            min: 0,
            max: 100,
          },
        },
        { timestamps: true }
      ),
    },
  ],
  motorLog: [
    [
      {
        type: new mongoose.Schema(
          {
            isMotorOn: Boolean,
          },
          { timestamps: true }
        ),
      },
    ],
  ],
  soilMoistureLog: [
    [
      {
        type: new mongoose.Schema(
          {
            moistureLevel: {
              type: Number,
              min: 0,
              max: 100,
            },
          },
          { timestamps: true }
        ),
      },
    ],
  ],
});

machineSchema.statics.register = async function (details, propertiesToPick) {
  const newMachine = new this(_.pick(details, propertiesToPick));
  newMachine.soilMoisture = [];
  for (let i = 0; i < 4; i++) {
    newMachine.soilMoisture.push({});
  }
  newMachine.thresholdMoisture = 50;
  newMachine.WaterTankLog = [];
  newMachine.motorLog = [];
  newMachine.soilMoistureLog = [];
  await newMachine.save();
  return newMachine;
};

const machine = mongoose.model("machine", machineSchema);

const updateMotorBasedOnThreshold = async (threshold, id) => {
  const mach = await machine.findById(id).select("soilMoisture");
  for (let i = 0; i < 4; i++) {
    mach.soilMoisture[i].value < threshold
      ? (mach.soilMoisture[i].isMotorOn = true)
      : (mach.soilMoisture[i].isMotorOn = false);
  }
  await mach.save();
};

function validateMotorThreshold(details, isAutoMode) {
  if (isAutoMode) {
    return Joi.object({
      thresholdMoisture: Joi.number().min(0).max(100),
    }).validate(details).error;
  }
  const motorSchema = Joi.object({
    motor0On: Joi.boolean().required(),
    motor1On: Joi.boolean().required(),
    motor2On: Joi.boolean().required(),
    motor3On: Joi.boolean().required(),
  });
  return motorSchema.validate(details).error;
}

function validateWaterLevel(details) {
  return Joi.object({
    waterLevel: Joi.number().min(0).max(100).required(),
  }).validate(details).error;
}

function validateMachine(mac) {
  const macSchema = Joi.object({
    productKey: Joi.string().trim().length(15).required(),
    address: Joi.string().trim().min(10).max(100).required(),
  });
  return macSchema.validate(mac).error;
}

exports.machineModel = machine;
exports.machineValidate = validateMachine;
exports.validateMotorThreshold = validateMotorThreshold;
exports.updateMotorBasedOnThreshold = updateMotorBasedOnThreshold;
exports.validateWaterLevel = validateWaterLevel;
