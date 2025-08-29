import { fetch } from "undici";

const BASE = process.env.FHIR_BASE_URL ?? "https://hapi.fhir.org/baseR4";

interface Patient {
  id: string;
  name?: {
    text?: string;
    given?: string[];
    family?: string;
  }[];
  birthDate?: string;
}

interface Encounter {
  id: string;
  period?: {
    start?: string;
    end?: string;
  };
  type?: {
    text?: string;
  }[];
}

interface Observation {
  id: string;
  code?: {
    text?: string;
    coding?: {
      display?: string;
    }[];
  };
  valueQuantity?: {
    value?: number;
    unit?: string;
  };
  issued?: string;
}

interface Bundle<T> {
  entry?: {
    resource: T;
  }[];
}

export async function fetchPatient(id: string): Promise<Patient> {
  const r = await fetch(`${BASE}/Patient/${id}`);
  if (!r.ok) throw new Error(`Patient ${id} not found`);
  return r.json() as Promise<Patient>;
}

export async function fetchEncounters(patientId: string): Promise<Bundle<Encounter>> {
  const r = await fetch(`${BASE}/Encounter?patient=${patientId}&_sort=date&_count=100`);
  if (!r.ok) throw new Error("Encounters fetch failed");
  return r.json() as Promise<Bundle<Encounter>>;
}

export async function fetchObservations(patientId: string): Promise<Bundle<Observation>> {
  const r = await fetch(`${BASE}/Observation?subject=${patientId}&_sort=-date&_count=200`);
  if (!r.ok) throw new Error("Observations fetch failed");
  return r.json() as Promise<Bundle<Observation>>;
}
