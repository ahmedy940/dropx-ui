import { createRequestHandler } from "@remix-run/express";
import express from "express";
import compression from "compression";
import morgan from "morgan";

const app = express();

app.use(compression());
app.use(morgan("tiny"));

app.all(
  "*",
  createRequestHandler({
  build: require("../build/index.js"),
    mode: process.env.NODE_ENV,
  })
);

export default app;