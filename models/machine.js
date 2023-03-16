const mongoose = require("mongoose");
const Joi = require("joi");
const _ = require("lodash");

const machineSchema = new mongoose.Schema({
  productKey: {
    type: String,
    length: 25,
    required: true,
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
  WaterTankLog: [
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

machineSchema.statics.register = async function () {
  const newMachine = new this(_.pick(details, propertiesToPick));
  await newMachine.save();
  return newMachine;
};

const machine = mongoose.model("machine", machineSchema);

function validateMachine(mac) {
  const macSchema = Joi.object({
    userId: Joi.objectId().required(),
    productKey: Joi.string().trim().length(25).required(),
    address: Joi.string().trim().min(10).max(100).required(),
  });
  return macSchema.validate(sub).error;
}

exports.machine = machine;
exports.validateMachine = validateMachine;