const mongoose = require("mongoose");
const Joi = require("joi");
const _ = require("lodash");
const moment = require("moment");

const logDiff = 3e5; // time diff.in millis

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
  soilMoisture: [
    {
      type: Number,
      min: 0,
      max: 100,
    },
  ],
  isMotorOn: {
    type: Boolean,
    default: false,
  },
  thresholdMoisture: {
    type: Number,
    min: -1,
    max: 100,
    default: 30,
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
        { _id: false, timestamps: { createdAt: true, updatedAt: false } }
      ),
    },
  ],
  motorLog: [
    {
      type: new mongoose.Schema(
        {
          isMotorOn: Boolean,
        },
        { _id: false, timestamps: { createdAt: true, updatedAt: false } }
      ),
    },
  ],
  motorUsagePerDay: [
    {
      type: new mongoose.Schema(
        {
          durationMinutes: {
            type: Number,
            min: 0,
            max: 1440,
          },
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
        },
        { _id: false, timestamps: { createdAt: true, updatedAt: false } }
      ),
    },
  ],
});

machineSchema.statics.register = async function (details, propertiesToPick) {
  const newMachine = new this(_.pick(details, propertiesToPick));
  newMachine.soilMoisture = [40, 40, 40, 40];
  newMachine.WaterTankLog = [];
  newMachine.motorLog = [];
  newMachine.motorUsagePerDay = [];
  newMachine.soilMoistureLog = [];
  await newMachine.save();
  return newMachine;
};

machineSchema.methods.updateWaterTank = function (details) {
  this.waterTankLevel = details.waterLevel;
  const len = this.waterTankLog.length;
  if (len > 0) {
    const d1 = new Date(this.waterTankLog[len - 1].createdAt),
      d2 = new Date();
    const diff = d2.valueOf() - d1.valueOf();
    if (diff > logDiff)
      this.waterTankLog.push({ waterLevel: details.waterLevel });
  } else this.waterTankLog.push({ waterLevel: details.waterLevel });
};

machineSchema.methods.updateSoilMoisture = function (details) {
  for (let i = 0; i < 4; i++) {
    this.soilMoisture[i] = details[`soilMoisture${i}`];
  }
  const aggregatedMoisture = this.aggregateSoilMoisture();
  const len = this.soilMoistureLog.length;
  if (len > 0) {
    const d1 = new Date(this.soilMoistureLog[len - 1].createdAt),
      d2 = new Date();
    const diff = d2 - d1;
    if (diff > logDiff) {
      this.soilMoistureLog.push({
        moistureLevel: aggregatedMoisture,
      });
    }
  } else {
    this.soilMoistureLog.push({
      moistureLevel: this.aggregatedMoisture,
    });
  }
};

machineSchema.methods.updateMotorLog = function (details) {
  if (this.motorLog.length === 0) {
    if (details[`motorOn`] === true) {
      this.motorLog.push({
        isMotorOn: details[`motorOn`],
      });
    }
  } else if (
    this.motorLog[this.motorLog.length - 1].isMotorOn !== details[`motorOn`]
  ) {
    this.motorLog.push({
      isMotorOn: details[`motorOn`],
    });
  }
};

machineSchema.methods.aggregateSoilMoisture = function () {
  let avg = 0;
  for (let i = 0; i < 4; i++) avg += this.soilMoisture[i];
  return avg / 4;
};

machineSchema.methods.consolidateMotorLog = async function () {
  const { motorLog } = this;
  const len = motorLog.length;
  for (let i = 0; i < Math.floor(len / 2) * 2; i += 2) {
    let startDate = moment(motorLog[i].createdAt).utcOffset("+05:30"),
      endDate = moment(motorLog[i + 1].createdAt).utcOffset("+05:30");
    let midnight = moment(startDate)
      .utcOffset("+05:30")
      .startOf("day")
      .add(1, "d");
    while (startDate < endDate) {
      let n = this.motorUsagePerDay.length;
      if (
        n === 0 ||
        !startDate.isSame(
          moment(this.motorUsagePerDay[n - 1].createdAt).utcOffset("+05:30"),
          "day"
        )
      ) {
        //date doesn't exist
        this.motorUsagePerDay.push({
          durationMinutes: 0,
          createdAt: startDate.toISOString(),
        });
        n++;
      }
      //consolidate dates
      this.motorUsagePerDay[n - 1].durationMinutes += Math.min(
        endDate.diff(startDate, "m"),
        midnight.diff(startDate, "m")
      );
      startDate = midnight.clone();
      midnight.add(1, "d");
    }
  }
  if (len % 2 != 0)
    this.motorLog = this.motorLog.slice(-1); // save motor ON command
  else this.motorLog = [];
  await this.save();
};

const machine = mongoose.model("machine", machineSchema);

const updateMotorBasedOnThreshold = async (threshold, id) => {
  const mach = await machine.findById(id).select("soilMoisture isMotorOn");
  const aggregatedMoisture = mach.aggregateSoilMoisture();
  mach.isMotorOn = aggregatedMoisture < threshold;
  const motorStatus=mach.isMotorOn
  await mach.save();
  return motorStatus
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
    soilMoisture0: Joi.number().min(0).max(100).required(),
    soilMoisture1: Joi.number().min(0).max(100).required(),
    soilMoisture2: Joi.number().min(0).max(100).required(),
    soilMoisture3: Joi.number().min(0).max(100).required(),
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
