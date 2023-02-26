const express = require("express");
const cors = require("cors");
const root = require("../routes/root");
const user = require("../routes/user");

module.exports = function (app) {
  app.use(express.json());
  app.use(
    cors({
      origin: "*",
      exposedHeaders: ["x-auth-token"],
    })
  );
  app.use("/", root);
  app.use("/user", user);
};
