import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env.js";
import { errorHandler, notFoundHandler } from "./middleware/error-handler.js";
import { apiRouter } from "./routes/index.js";

export const app = express();

app.disable("x-powered-by");
app.use(helmet());
app.use(
  cors({
    origin: env.frontendUrl,
    credentials: true,
    exposedHeaders: [
      "X-Chunk-Count",
      "X-Largest-Chunk-MB",
      "X-Extracted-Count",
      "X-Processed-Count",
      "X-Page-Count",
      "X-OCR-Confidence",
      "X-Original-Size",
      "X-Compressed-Size",
      "X-Reduction-Percent",
      "X-Compression-Applied",
    ],
  }),
);
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use(
  morgan(
    (tokens, request, response) =>
      JSON.stringify({
        level: "info",
        event: "http_request",
        method: tokens.method?.(request, response),
        path: tokens.url?.(request, response),
        status: Number(tokens.status?.(request, response)),
        responseTimeMs: Number(tokens["response-time"]?.(request, response)),
        contentLength: Number(
          tokens.res?.(request, response, "content-length") ?? 0,
        ),
        remoteAddress: tokens["remote-addr"]?.(request, response),
      }),
    { skip: () => env.nodeEnv === "test" },
  ),
);

app.get("/", (_request, response) => {
  response.json({ success: true, message: "FileFlow API", version: "v1" });
});

app.use("/api/v1", apiRouter);
app.use(notFoundHandler);
app.use(errorHandler);
