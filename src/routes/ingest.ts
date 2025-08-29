import { FastifyPluginAsync } from "fastify";
import { prisma } from "../db.js";
import { fetchPatient, fetchEncounters, fetchObservations } from "../lib/fhir.js";
import { z } from "zod";
import { httpDuration } from "../lib/metrics.js";

export const ingestRoutes: FastifyPluginAsync = async (app) => {
  app.post<{ Querystring: { patientId: string } }>("/", async (req, reply) => {
    const end = httpDuration.startTimer({ method: "POST", route: "/ingest", status_code: "" });
    try {
      const q = z.object({ patientId: z.string().min(1) }).parse(req.query);
      const [pat, encs, obs] = await Promise.all([
        fetchPatient(q.patientId),
        fetchEncounters(q.patientId),
        fetchObservations(q.patientId)
      ]);

      // Minimal mapping – tailor as needed
      const pName = pat.name?.[0]?.text ?? `${pat.name?.[0]?.given?.[0] ?? ""} ${pat.name?.[0]?.family ?? ""}`.trim();
      await prisma.patient.upsert({
        where: { id: pat.id },
        update: { name: pName, birthDate: pat.birthDate ? new Date(pat.birthDate) : null },
        create: { id: pat.id, name: pName, birthDate: pat.birthDate ? new Date(pat.birthDate) : null }
      });

      const encBundle = encs.entry ?? [];
      for (const e of encBundle) {
        const r = e.resource;
        await prisma.encounter.upsert({
          where: { id: r.id },
          update: {
            start: r.period?.start ? new Date(r.period.start) : null,
            end: r.period?.end ? new Date(r.period.end) : null,
            type: r.type?.[0]?.text ?? null,
            patientId: pat.id
          },
          create: {
            id: r.id,
            start: r.period?.start ? new Date(r.period.start) : null,
            end: r.period?.end ? new Date(r.period.end) : null,
            type: r.type?.[0]?.text ?? null,
            patientId: pat.id
          }
        });
      }

      const obsBundle = obs.entry ?? [];
      for (const o of obsBundle) {
        const r = o.resource;
        const qty = r.valueQuantity;
        await prisma.observation.upsert({
          where: { id: r.id },
          update: {
            code: r.code?.text ?? r.code?.coding?.[0]?.display ?? null,
            valueNum: qty?.value ?? null,
            unit: qty?.unit ?? null,
            issued: r.issued ? new Date(r.issued) : null,
            patientId: pat.id
          },
          create: {
            id: r.id,
            code: r.code?.text ?? r.code?.coding?.[0]?.display ?? null,
            valueNum: qty?.value ?? null,
            unit: qty?.unit ?? null,
            issued: r.issued ? new Date(r.issued) : null,
            patientId: pat.id
          }
        });
      }

      end({ status_code: "200" });
      return reply.send({ ok: true, patientId: pat.id, encounters: encBundle.length, observations: obsBundle.length });
    } catch (err:any) {
      req.log.error(err);
      end({ status_code: "500" });
      return reply.status(500).send({ ok: false, error: err.message });
    }
  });
};
