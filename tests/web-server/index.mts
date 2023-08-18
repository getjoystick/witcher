import express from "express";
import { defineEventualConsistencyRoutes } from "./eventual-consistency-test.mjs";
import bodyParser from "body-parser";

const PORT = 5070;

const app = express();

app.use(bodyParser.json());

defineEventualConsistencyRoutes(app);

app.get("/healthcheck", (req, res) => {
  res.json({ status: "ok" });
});

app.listen(PORT);

console.log("Witcher test server is listening on port " + PORT);
