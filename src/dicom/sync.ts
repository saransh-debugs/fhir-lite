import { fetch } from "undici";
import { prisma } from "../db.js";

interface OrthancInstance {
  ID: string;
  ParentStudy: string;
  ParentSeries: string;
  MainDicomTags: {
    SOPInstanceUID?: string;
    PatientID?: string;
    StudyDate?: string;
    Modality?: string;
    [key: string]: string | undefined;  // Allow other DICOM tags
  };
}

interface OrthancChanges {
  Changes: Array<{
    ChangeType: string;
    ID: string;
  }>;
  Last: number;
}

const BASE = process.env.ORTHANC_BASE || "http://localhost:8042";
const auth = "Basic " + Buffer.from(`${process.env.ORTHANC_USER||"orthanc"}:${process.env.ORTHANC_PASS||"orthanc"}`).toString("base64");

let last = 0;
export async function pollOrthancChanges() {
  const r = await fetch(`${BASE}/changes?since=${last}`, { headers: { Authorization: auth } });
  if (!r.ok) throw new Error(`changes failed: ${r.status}`);
  const data = await r.json() as OrthancChanges;
  last = data.Last;
  for (const ev of data.Changes || []) {
    if (ev.ChangeType === "NewInstance") {
      // Fetch instance → series → study → patient information
      const inst = await (await fetch(`${BASE}/instances/${ev.ID}`, { headers: { Authorization: auth } })).json() as OrthancInstance;
      const tags = inst.MainDicomTags;
      await prisma.$transaction([
        prisma.dicomStudy.upsert({
          where: { studyInstanceUID: inst.ParentStudy },
          update: { patientId: tags.PatientID || null, studyDate: tags.StudyDate || null },
          create: { studyInstanceUID: inst.ParentStudy, patientId: tags.PatientID || null, studyDate: tags.StudyDate || null }
        }),
        prisma.dicomSeries.upsert({
          where: { seriesInstanceUID: inst.ParentSeries },
          update: { modality: tags.Modality || null, studyInstanceUID: inst.ParentStudy },
          create: { seriesInstanceUID: inst.ParentSeries, modality: tags.Modality || null, studyInstanceUID: inst.ParentStudy }
        }),
        prisma.dicomInstance.upsert({
          where: { sopInstanceUID: tags.SOPInstanceUID || ev.ID },
          update: { seriesInstanceUID: inst.ParentSeries, studyInstanceUID: inst.ParentStudy },
          create: { sopInstanceUID: tags.SOPInstanceUID || ev.ID, seriesInstanceUID: inst.ParentSeries, studyInstanceUID: inst.ParentStudy }
        })
      ]);
    }
  }
}