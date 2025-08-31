// k6/wado-frames.js
import http from "k6/http"; 
import { check, sleep } from "k6";
export const options = { vus: 20, duration: "60s" };
const base = "http://localhost:8080";
const qs = `studyUID=${__ENV.STUDY}&seriesUID=${__ENV.SERIES}&instanceUID=${__ENV.INSTANCE}&frame=1`;
export default function () {
  const r = http.get(`${base}/dicom/wado/frame?${qs}`);
  check(r, { "200": res => res.status === 200 });
  sleep(0.1);
}
