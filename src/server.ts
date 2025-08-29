import Fastify from "fastify";
import cors from "@fastify/cors";
import { registry } from "./lib/metrics.js";
import { ingestRoutes } from "./routes/ingest.js";
import { timelineRoutes } from "./routes/timeline.js";
import { statsRoutes } from "./routes/stats.js";

const app = Fastify({ logger: true });

// Remove top-level await and use promise chaining
app.register(cors, { origin: true })
  .then(() => {
    app.get("/health", async () => ({ ok: true }));

    app.get("/metrics", async (req, reply) => {
      reply.header("Content-Type", registry.contentType);
      return await registry.metrics();
    });

    app.register(ingestRoutes, { prefix: "/ingest" });
    app.register(timelineRoutes, { prefix: "/timeline" });
    app.register(statsRoutes, { prefix: "/stats" });

    const port = Number(process.env.PORT ?? 8080);
    return app.listen({ port, host: "0.0.0.0" });
  })
  .then(() => {
    const port = Number(process.env.PORT ?? 8080);
    app.log.info(`listening on ${port}`);
  });
