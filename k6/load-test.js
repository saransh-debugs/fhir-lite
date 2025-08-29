import http from 'k6/http';
import { sleep, check } from 'k6';
export let options = { vus: 20, duration: '60s' };

const base = 'http://localhost:8080';
const patient = __ENV.PATIENT_ID || 'example';
export default function () {
  const res = http.get(`${base}/timeline/${patient}?days=30&page=1&size=20`);
  check(res, { 'status 200': (r) => r.status === 200 });
  sleep(0.1);
}
