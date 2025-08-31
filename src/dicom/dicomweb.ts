import { fetch } from "undici";
import FormData from "form-data";

const ORTHANC_BASE = process.env.ORTHANC_BASE || "http://orthanc:8042";
const DICOMWEB = `${ORTHANC_BASE}/dicom-web`;

function authHeaders() {
  const u = process.env.ORTHANC_USER || "orthanc";
  const p = process.env.ORTHANC_PASS || "orthanc";
  const b64 = Buffer.from(`${u}:${p}`).toString("base64");
  return { Authorization: `Basic ${b64}` };
}

export async function stow(dicomBuffers: Buffer[]) {
  const url = `${DICOMWEB}/studies`;
  const form = new FormData();
  dicomBuffers.forEach((buf, i) =>
    form.append(`file${i}`, buf, { filename: `obj${i}.dcm`, contentType: "application/dicom" })
  );
  const res = await fetch(url, {
    method: "POST",
    headers: { ...authHeaders(), ...form.getHeaders() },
    body: form as any
  });
  if (!res.ok) throw new Error(`STOW failed: ${res.status} ${await res.text()}`);
  return res.json();
}

export async function qidoStudies(params: Record<string,string>) {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${DICOMWEB}/studies?${qs}`, { headers: { ...authHeaders(), Accept: "application/json" } });
  if (!res.ok) throw new Error(`QIDO failed: ${res.status} ${await res.text()}`);
  return res.json();
}

export async function wadoFrame(studyUID: string, seriesUID: string, instanceUID: string, frame = 1) {
  const url = `${DICOMWEB}/studies/${studyUID}/series/${seriesUID}/instances/${instanceUID}/frames/${frame}`;
  const res = await fetch(url, {
    headers: { ...authHeaders(), Accept: "image/png" }
  });
  if (!res.ok) throw new Error(`WADO frame failed: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  return buf;
}
