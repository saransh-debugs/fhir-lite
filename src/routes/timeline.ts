import { FastifyPluginAsync } from "fastify";
import { prisma } from "../db.js";
import { redis, ttlSeconds, key } from "../lib/cache.js";
import { httpDuration, cacheHits, cacheMisses } from "../lib/metrics.js";

export const timelineRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Params: { patientId: string }, Querystring: { days?: string, page?: string, size?: string } }>("/:patientId", async (req, reply) => {
    const end = httpDuration.startTimer({ method: "GET", route: "/timeline", status_code: "" });
    const { patientId } = req.params;
    const days = Number(req.query.days ?? 30);
    const page = Number(req.query.page ?? 1);
    const size = Number(req.query.size ?? 20);
    const cacheKey = key(`timeline:${patientId}:${days}:${page}:${size}`);

    try {
      const hit = await redis.get(cacheKey);
      if (hit) {
        cacheHits.inc({ route: "timeline" });
        end({ status_code: "200" });
        return reply.send(JSON.parse(hit));
      }
      cacheMisses.inc({ route: "timeline" });

      const since = new Date(Date.now() - days * 24 * 3600 * 1000);
      const [encs, obs, p] = await Promise.all([
        prisma.encounter.findMany({
          where: { patientId, start: { gte: since } },
          orderBy: { start: "desc" },
          skip: (page - 1) * size, take: size
        }),
        prisma.observation.findMany({
          where: { patientId, issued: { gte: since } },
          orderBy: { issued: "desc" },
          skip: (page - 1) * size, take: size
        }),
        prisma.patient.findUnique({ where: { id: patientId } })
      ]);

      const payload = { patient: p, encounters: encs, observations: obs, page, size, days };
      await redis.setex(cacheKey, ttlSeconds, JSON.stringify(payload));

      end({ status_code: "200" });
      return reply.send(payload);
    } catch (e:any) {
      end({ status_code: "500" });
      return reply.status(500).send({ ok: false, error: e.message });
    }
  });
};
