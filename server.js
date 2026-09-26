const express = require("express");
const client = require("prom-client");

const app = express();
const PORT = 4000;

// Collect default Node.js process metrics
client.collectDefaultMetrics();

// Prometheus Registry
const register = new client.Registry();

// Collect default metrics into our registry
client.collectDefaultMetrics({ register });

// HTTP request counter
const httpRequestsTotal = new client.Counter({
  name: "http_requests_total",
  help: "Total number of HTTP requests",
  labelNames: ["method", "route", "status_code"],
  registers: [register],
});

// HTTP request duration histogram
const httpRequestDuration = new client.Histogram({
  name: "http_request_duration_seconds",
  help: "HTTP request duration in seconds",
  labelNames: ["method", "route", "status_code"],
  registers: [register],
  buckets: [0.1, 0.3, 0.5, 1, 2, 5],
});

// Middleware for measuring requests
app.use((req, res, next) => {
  const start = process.hrtime();

  res.on("finish", () => {
    const diff = process.hrtime(start);
    const duration = diff[0] + diff[1] / 1e9;

    httpRequestsTotal.inc({
      method: req.method,
      route: req.route?.path || req.path,
      status_code: res.statusCode,
    });

    httpRequestDuration.observe(
      {
        method: req.method,
        route: req.route?.path || req.path,
        status_code: res.statusCode,
      },
      duration
    );
  });

  next();
});

// Routes
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.get("/hello", (req, res) => {
  res.json({ message: "Hello from SNRT monitoring project" });
});

app.get("/error", (req, res) => {
  res.status(500).json({ error: "Simulated internal server error" });
});

app.get("/slow", async (req, res) => {
  await new Promise((resolve) => setTimeout(resolve, 2000));
  res.json({ message: "Slow response" });
});

// Prometheus endpoint
app.get("/metrics", async (req, res) => {
  res.set("Content-Type", register.contentType);
  res.end(await register.metrics());
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Application running on http://localhost:${PORT}`);
  });
}

module.exports = app;
