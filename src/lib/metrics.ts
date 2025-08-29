import client from "prom-client";

export const registry = new client.Registry();
client.collectDefaultMetrics({ register: registry });

export const httpDuration = new client.Histogram({
  name: "http_request_duration_seconds",
  help: "Duration of HTTP requests",
  labelNames: ["method","route","status_code"],
  buckets: [0.025,0.05,0.1,0.2,0.5,1,2]
});
registry.registerMetric(httpDuration);

export const cacheHits = new client.Counter({
  name: "cache_hits_total",
  help: "Redis cache hits",
  labelNames: ["route"]
});
registry.registerMetric(cacheHits);

export const cacheMisses = new client.Counter({
  name: "cache_misses_total",
  help: "Redis cache misses",
  labelNames: ["route"]
});
registry.registerMetric(cacheMisses);
