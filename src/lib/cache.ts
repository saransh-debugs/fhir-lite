import Redis from "ioredis";
export const redis = new Redis(process.env.REDIS_URL!);
export const ttlSeconds = 60;
export const key = (p: string) => `fhirpulse:${p}`;
