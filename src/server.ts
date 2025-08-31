import Fastify from "fastify";
import cors from "@fastify/cors";
import { registry } from "./lib/metrics.js";
import { ingestRoutes } from "./routes/ingest.js";
import { timelineRoutes } from "./routes/timeline.js";
import { statsRoutes } from "./routes/stats.js";
import multipart from "@fastify/multipart";
import { dicomRoutes } from "./routes/dicom.js";
import { imagingStudyRoutes } from "./routes/imaging-studies.js";
import { pollOrthancChanges } from "./dicom/sync.js";
setInterval(() => pollOrthancChanges().catch(err => app.log.error(err)), 5000);


const app = Fastify({ logger: true });

// Remove top-level await and use promise chaining
app.register(cors, { origin: true })
  .then(async() => {
    app.get("/health", async () => ({ ok: true }));

    app.get("/metrics", async (req, reply) => {
      reply.header("Content-Type", registry.contentType);
      return await registry.metrics();
    });

    app.register(ingestRoutes, { prefix: "/ingest" });
    app.register(timelineRoutes, { prefix: "/timeline" });
    app.register(statsRoutes, { prefix: "/stats" });
    await app.register(multipart, { limits: { fileSize: 1024*1024*200 } }); // allow big studies
    app.register(dicomRoutes);
    app.register(imagingStudyRoutes, { prefix: "/imaging-study" });

    const port = Number(process.env.PORT ?? 8080);
    return app.listen({ port, host: "0.0.0.0" });
  })
  .then(() => {
    const port = Number(process.env.PORT ?? 8080);
    app.log.info(`listening on ${port}`);
  });
