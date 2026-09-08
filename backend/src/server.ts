import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import http from "http";
import { Server as SocketIOServer } from "socket.io";
import { env } from "./config/env";
import { errors } from "./middleware/error";
import routes from "./routes/index.routes";
import { taskAndTrashSweep } from "./services/taskWorker";
import { subscriptionSweep } from "./services/subscriptionWorker";
import { createSocketServer } from "./sockets/socket.server";

const app = express();
app.disable("etag");
app.use((req, res, next) => {
  const started = process.hrtime.bigint();

  res.on("finish", () => {
    const ms = Number(process.hrtime.bigint() - started) / 1e6;
    if (ms >= 250) {
      console.warn(
        `[slow-api] ${req.method} ${req.originalUrl} ${res.statusCode} ${ms.toFixed(1)}ms`,
      );
    }
  });

  next();
});

app.set("trust proxy", 1);

app.set(
  "json replacer",
  (_key: string, value: unknown) =>
    typeof value === "bigint" ? value.toString() : value,
);

app.use(
  helmet({
    crossOriginResourcePolicy: {
      policy: "cross-origin",
    },
  }),
);

app.use(compression());

const configuredOrigins = env.CORS_ORIGINS.split(",")
  .map((x) => x.trim().replace(/\/$/, ""))
  .filter(Boolean);

const allowedOrigins = new Set([
  ...configuredOrigins,
  "https://securefile-api-lkxs.vercel.app",
  "https://securefile-api.vercel.app",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]);

const corsOptions: cors.CorsOptions = {
  exposedHeaders: ["Content-Disposition"],
  credentials: true,
  methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
    "X-Tenant-Slug",
  ],
  origin: (origin, cb) => {
    if (!origin) {
      return cb(null, true);
    }

    const normalizedOrigin = origin.replace(/\/$/, "");

    if (env.NODE_ENV !== "production") {
      return cb(null, true);
    }

    if (allowedOrigins.has(normalizedOrigin)) {
      return cb(null, true);
    }

    return cb(null, false);
  },
};

app.use(cors(corsOptions));

app.options(/.*/, cors(corsOptions));

app.use(
  "/api/subscriptions/stripe-webhook",
  express.raw({
    type: "application/json",
    limit: "1mb",
  }),
);

app.use(express.json({ limit: "2mb" }));

app.use(
  express.urlencoded({
    extended: true,
    limit: "2mb",
  }),
);

app.get("/", (_req, res) => {
  res.status(200).send("SecureFile backend is running");
});

app.use("/api", routes);
app.use(errors);

const httpServer = http.createServer(app);

const io = new SocketIOServer(httpServer, {
  cors: {
    origin: (origin, callback) => {
      if (!origin) {
        return callback(null, true);
      }

      const normalizedOrigin = origin.replace(/\/$/, "");

      if (env.NODE_ENV !== "production") {
        return callback(null, true);
      }

      if (allowedOrigins.has(normalizedOrigin)) {
        return callback(null, true);
      }

      return callback(new Error("Socket.IO CORS origin not allowed"));
    },
    credentials: true,
    methods: ["GET", "POST"],
  },
  transports: ["websocket", "polling"],
});

createSocketServer(io);

if (process.env.VERCEL !== "1") {
  httpServer.listen(env.PORT, () => {
    console.log(`SecureFile API listening on ${env.PORT}`);
    console.log("SecureFile Socket.IO enabled");
  });

  const runSweep = () =>
    Promise.all([subscriptionSweep(), taskAndTrashSweep()]).catch(
      console.error,
    );

  runSweep();

  setInterval(runSweep, 60 * 60 * 1000);
}

export default app;

export { app };
export { io };
export { httpServer };
