const express = require("express");
const https = require("https");
const config = require("config");

const app = express();

require("express-async-errors");
require("./startup/db")();
require("./startup/routes")(app);

// const PORT = process.env.PORT || 5000;
const httpsPORT = process.env.httpsPORT || 3443;
const sslServer = https.createServer(
  {
    key: Buffer.from(config.get("sslKey"), "base64").toString("ascii"),
    cert: Buffer.from(config.get("sslCert"), "base64").toString("ascii"),
  },
  app
);

sslServer.listen(httpsPORT, () =>
  console.log(`SSL Server active on port ${httpsPORT}`)
); //https server
// app.listen(PORT, () => console.log(`Server Active on port ${PORT}`));    //for http
