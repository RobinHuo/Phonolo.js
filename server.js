"use strict";

const path = require("path");
const express = require("express");

const app = express();

app.use("/docs", express.static(path.join(__dirname, "/out")));

app.use(express.static(path.join(__dirname, "/pub")));


const port = process.env.PORT || 5000;
app.listen(port, () => {
    console.log(`Express listening on port ${port}...`);
});
