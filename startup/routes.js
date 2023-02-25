const express = require("express");
const cors = require("cors");
const root = require("../routes/root");

module.exports = function (app) {
    app.use(express.json());
    app.use(
      cors({
        origin: "*",
        exposedHeaders: ["x-auth-token"],
      })
    );
    app.use("/", root);
  };