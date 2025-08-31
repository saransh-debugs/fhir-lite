import { FastifyPluginAsync } from "fastify";
import { prisma } from "../db.js";
import { httpDuration } from "../lib/metrics.js";
import { toImagingStudy } from "../lib/fhir-imaging.js";

export const imagingStudyRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Params: { patientId: string }; Querystring: { fhirId?: string } }>(
    "/:patientId",
    async (req, reply) => {
      const end = httpDuration.startTimer({ method: "GET", route: "/imaging-study", status_code: "" });
      try {
        const { patientId } = req.params;
        const fhirId =
          req.query.fhirId ??
          (await prisma.patient.findFirst({ where: { id: patientId } }))?.id ??
          patientId;

        const studies = await prisma.dicomStudy.findMany({
          where: { patientId },
          include: {
            series: {
              include: { instances: true },
            },
          },
          orderBy: { studyInstanceUID: "asc" },
        });

        const payload = studies.map((s) =>
          toImagingStudy(fhirId.replace(/^Patient\//, ""), {
            studyInstanceUID: s.studyInstanceUID,
            series: s.series.map((se) => ({
              seriesInstanceUID: se.seriesInstanceUID,
              instances: se.instances.map((i) => ({ sopInstanceUID: i.sopInstanceUID })),
            })),
          })
        );

        end({ status_code: "200" });
        return reply.send({ patientId, fhirId, count: payload.length, imagingStudies: payload });
      } catch (e: any) {
        end({ status_code: "500" });
        return reply.code(500).send({ ok: false, error: e.message });
      }
    }
  );
};
