const mongoose = require("mongoose");
const Joi = require("joi");
const _ = require("lodash");

const machineSchema = new mongoose.Schema({
  name: {
    type: String,
    minlength: 1,
    maxlength: 20,
    required: true,
  },
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
  soilMoisture: {
    type: Number,
    min: 0,
    max: 100,
    default: 50,
  },
  isMotorOn: {
    type: Boolean,
    default: false,
  },
  thresholdMoisture: {
    type: Number,
    min: -1,
    max: 100,
    default: 50,
  },
  waterTankLevel: {
    type: Number,
    min: 0,
    max: 100,
    default: 50,
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
    {
      type: new mongoose.Schema(
        {
          isMotorOn: Boolean,
          createdAt: Date,
        },
        { _id: false }
      ),
    },
  ],
  soilMoistureLog: [
    {
      type: new mongoose.Schema(
        {
          moistureLevel: {
            type: Number,
            min: 0,
            max: 100,
          },
          createdAt: Date,
        },
        { _id: false }
      ),
    },
  ],
});

machineSchema.statics.register = async function (details, propertiesToPick) {
  const newMachine = new this(_.pick(details, propertiesToPick));
  newMachine.WaterTankLog = [];
  newMachine.motorLog = [];
  newMachine.soilMoistureLog = [];
  await newMachine.save();
  return newMachine;
};

const machine = mongoose.model("machine", machineSchema);

const updateMotorBasedOnThreshold = async (threshold, id) => {
  const mach = await machine.findById(id).select("soilMoisture");
  mach.isMotorOn = mach.soilMoisture < threshold;
  await mach.save();
};

function validateMotorThreshold(details, isAutoMode) {
  if (isAutoMode) {
    return Joi.object({
      thresholdMoisture: Joi.number().min(0).max(100),
    }).validate(details).error;
  }
  const motorSchema = Joi.object({
    motorOn: Joi.boolean().required(),
  });
  return motorSchema.validate(details).error;
}

function validateIotData(details) {
  return Joi.object({
    waterLevel: Joi.number().min(0).max(100).required(),
    soilMoisture: Joi.number().min(0).max(100).required(),
    motorOn: Joi.boolean().required(),
  }).validate(details).error;
}

function validateMachine(mac) {
  const macSchema = Joi.object({
    name: Joi.string().trim().min(1).max(20).required(),
    productKey: Joi.string().trim().length(15).required(),
    address: Joi.string().trim().min(10).max(100).required(),
  });
  return macSchema.validate(mac).error;
}

exports.machineModel = machine;
exports.machineValidate = validateMachine;
exports.validateMotorThreshold = validateMotorThreshold;
exports.updateMotorBasedOnThreshold = updateMotorBasedOnThreshold;
exports.validateIotData = validateIotData;
