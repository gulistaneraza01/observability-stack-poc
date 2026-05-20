import express from "express";
import client from "prom-client";
import winston, { createLogger } from "winston";
import LokiTransport from "winston-loki";

const app = express();
app.disable("x-powered-by");

const port = process.env.PORT || 8000;

const collectDefaultMetrics = client.collectDefaultMetrics;
const Registry = client.Registry;
const register = new Registry();
collectDefaultMetrics({ register });

const options = {
  transports: [
    new winston.transports.Console(),
    new LokiTransport({
      labels: { appName: "nodejs" },
      host: "http://127.0.0.1:3100",
    }),
  ],
};
const logger = createLogger(options);
console.log = (...args) => logger.info(args.join(" "));
console.error = (...args) => logger.error(args.join(" "));
console.warn = (...args) => logger.warn(args.join(" "));
console.info = (...args) => logger.info(args.join(" "));

const httpRequestsTotal = new client.Counter({
  name: "http_requests_total",
  help: "Total HTTP requests",
  labelNames: ["method", "route", "status_code"],
});

const httpDuration = new client.Histogram({
  name: "http_request_duration_seconds",
  help: "HTTP request duration in seconds",
  labelNames: ["method", "route", "status_code"],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
});

const activeRequests = new client.Gauge({
  name: "http_active_requests",
  help: "Number of requests currently being processed",
});

// 3. Middleware to auto-track all routes
app.use((req, res, next) => {
  activeRequests.inc();
  const end = httpDuration.startTimer();

  res.on("finish", () => {
    const labels = {
      method: req.method,
      route: req.route?.path || req.path,
      status_code: res.statusCode,
    };
    httpRequestsTotal.inc(labels);
    end(labels);
    activeRequests.dec();
  });

  next();
});

app.get("/metrics", async (req, res) => {
  try {
    res.set("Content-Type", register.contentType);
    const metrics = await register.metrics();
    res.end(metrics);
  } catch (err) {
    res.status(500).end(err.message);
  }
});

app.get("/", async (req, res) => {
  console.log("request came in / routh");
  res.json({ message: "Hello World" });
});

app.get("/slow", async (req, res) => {
  console.log("request came in /slow routh");

  try {
    const delay = Math.floor(Math.random() * 2500) + 500;
    await new Promise((resolve) => setTimeout(resolve, delay));

    if (Math.random() < 0.3) {
      throw new Error("Internal Server Error");
    }

    console.log(`Responded in ${delay}ms`);
    res.json({ message: `Responded in ${delay}ms` });
  } catch (error) {
    console.error(`Internal Server Error:) ${error.message}`);
    res.status(500).json({ error: `Internal Server Error:) ${error.message}` });
  }
});

app.listen(port, () => {
  console.log("Server is running on port: ", port);
});
