import winston, { createLogger } from "winston";
import LokiTransport from "winston-loki";

const logger = createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json(), // JSON format for production
  ),
  transports: [
    // Console only in development
    ...(process.env.NODE_ENV !== "production"
      ? [new winston.transports.Console()]
      : []),

    // Loki in all environments
    new LokiTransport({
      host: process.env.LOKI_URL || "http://localhost:3100",
      labels: {
        app: "node-app",
        env: process.env.NODE_ENV || "development",
      },
      json: true,
      format: winston.format.json(),
      onConnectionError: (err) => console.error("Loki error:", err),
    }),
  ],
});

export default logger;
