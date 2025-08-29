import { FastifyPluginAsync } from "fastify";
import { prisma } from "../db.js";
import { redis, ttlSeconds, key } from "../lib/cache.js";
import { httpDuration, cacheHits, cacheMisses } from "../lib/metrics.js";

export const statsRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Params: { patientId: string }, Querystring: { days?: string } }>("/:patientId", async (req, reply) => {
    const end = httpDuration.startTimer({ method: "GET", route: "/stats", status_code: "" });
    const { patientId } = req.params;
    const days = Number(req.query.days ?? 30);
    const cacheKey = key(`stats:${patientId}:${days}`);
    try {
      const hit = await redis.get(cacheKey);
      if (hit) { cacheHits.inc({ route: "stats" }); end({ status_code: "200" }); return reply.send(JSON.parse(hit)); }
      cacheMisses.inc({ route: "stats" });

      const since = new Date(Date.now() - days * 24 * 3600 * 1000);
      const rows = await prisma.$queryRawUnsafe(`
        SELECT code, unit,
               MIN("valueNum") as min,
               AVG("valueNum") as avg,
               MAX("valueNum") as max
        FROM "Observation"
        WHERE "patientId" = $1 AND (issued IS NULL OR issued >= $2) AND "valueNum" IS NOT NULL
        GROUP BY code, unit
        ORDER BY code NULLS LAST
      `, patientId, since);

      await redis.setex(cacheKey, ttlSeconds, JSON.stringify(rows));
      end({ status_code: "200" });
      return reply.send({ patientId, days, stats: rows });
    } catch (e:any) {
      end({ status_code: "500" });
      return reply.status(500).send({ ok: false, error: e.message });
    }
  });
};
