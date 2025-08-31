import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import multipart from "@fastify/multipart";  // Add this import
import { stow, qidoStudies, wadoFrame } from "../dicom/dicomweb.js";
import { httpDuration } from "../lib/metrics.js";


export const dicomRoutes: FastifyPluginAsync = async (app) => {
  // Upload via multipart (DICOM files)
  app.post("/dicom/stow", async (req, reply) => {
    const end = httpDuration.startTimer({ method: "POST", route: "/dicom/stow", status_code: "" });
    try {
      const mp: any = await req.parts();
      const chunks: Buffer[] = [];
      for await (const part of mp) {
        if (part.file) {
          const bufs: Buffer[] = [];
          for await (const c of part.file) bufs.push(c as Buffer);
          chunks.push(Buffer.concat(bufs));
        }
      }
      const result = await stow(chunks);
      end({ status_code: "200" });
      return reply.send({ ok: true, result });
    } catch (e:any) {
      end({ status_code: "500" });
      return reply.status(500).send({ ok: false, error: e.message });
    }
  });

  // Search studies (QIDO)
  app.get("/dicom/qido/studies", async (req, reply) => {
    const end = httpDuration.startTimer({ method: "GET", route: "/dicom/qido/studies", status_code: "" });
    try {
      const allowed = ["PatientID","StudyDate","StudyInstanceUID","limit"];
      const params = Object.fromEntries(Object.entries(req.query as any).filter(([k]) => allowed.includes(k)));
      const result = await qidoStudies(params as any);
      end({ status_code: "200" });
      return reply.send(result);
    } catch (e:any) { end({ status_code: "500" }); return reply.status(500).send({ ok:false, error: e.message }); }
  });

  // Retrieve a rendered frame (PNG)
  app.get("/dicom/wado/frame", async (req, reply) => {
    const end = httpDuration.startTimer({ method: "GET", route: "/dicom/wado/frame", status_code: "" });
    try {
      const q = z.object({
        studyUID: z.string(), seriesUID: z.string(), instanceUID: z.string(), frame: z.string().optional()
      }).parse(req.query);
      const buf = await wadoFrame(q.studyUID, q.seriesUID, q.instanceUID, q.frame ? Number(q.frame) : 1);
      reply.header("Content-Type", "image/png");
      end({ status_code: "200" });
      return reply.send(buf);
    } catch (e:any) { end({ status_code: "500" }); return reply.status(500).send({ ok:false, error: e.message }); }
  });

  app.post("/dicom/anonymize", async (req, reply) => {
    const end = httpDuration.startTimer({ method: "POST", route: "/dicom/anonymize", status_code: "" });
    try {
      const body = req.body as {
        instanceId?: string;
        studyId?: string;
        replace?: Record<string, string>;
      };
      if (!body?.instanceId && !body?.studyId) {
        end({ status_code: "400" });
        return reply.code(400).send({ ok: false, error: "instanceId or studyId required" });
      }

      const target = body.instanceId ? `instances/${body.instanceId}` : `studies/${body.studyId}`;
      const b64 = Buffer.from(
        `${process.env.ORTHANC_USER}:${process.env.ORTHANC_PASS}`
      ).toString("base64");

      const res = await fetch(`${process.env.ORTHANC_BASE}/${target}/anonymize`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${b64}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ Replace: body.replace || {}, Keep: ["StudyDescription"] }),
      });

      if (!res.ok) {
        end({ status_code: String(res.status) });
        return reply.code(500).send({ ok: false, error: await res.text() });
      }
      const json = await res.json();
      end({ status_code: "200" });
      return reply.send(json);
    } catch (e: any) {
      end({ status_code: "500" });
      return reply.code(500).send({ ok: false, error: e.message });
    }
  });
};
