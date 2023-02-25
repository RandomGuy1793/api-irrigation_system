const express = require("express");
const https=require('https');
const fs=require('fs');

const app = express();

app.get("/", (req,res)=>{
    res.send("welcome to irrigation-system")
})
// const PORT = process.env.PORT || 5000;
const httpsPORT=process.env.httpsPORT || 3443;

const sslServer=https.createServer({
    key: fs.readFileSync("cert/key.pem"),
    cert: fs.readFileSync("cert/cert.pem")
}, app)

sslServer.listen(httpsPORT, ()=> console.log(`SSL Server active on port ${httpsPORT}`))     //https server
// app.listen(PORT, () => console.log(`Server Active on port ${PORT}`));    //for http