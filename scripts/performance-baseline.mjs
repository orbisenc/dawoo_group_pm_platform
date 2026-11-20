const baseUrl = (process.env.PERF_BASE_URL ?? "http://127.0.0.1:4000").replace(/\/$/, "");
const paths = (process.env.PERF_PATHS ?? "/api/v1/health,/api/v1/health/ready")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const totalRequests = Number(process.env.PERF_REQUESTS ?? "500");
const concurrency = Number(process.env.PERF_CONCURRENCY ?? "20");
const p95LimitMs = Number(process.env.PERF_P95_LIMIT_MS ?? "500");
const bearerToken = process.env.PERF_BEARER_TOKEN?.trim();

for (const [name, value] of Object.entries({ totalRequests, concurrency, p95LimitMs })) {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${name} 값은 0보다 큰 숫자여야 합니다.`);
}

const results = [];

for (const path of paths) {
  const durations = [];
  let failures = 0;
  let nextIndex = 0;
  const runWorker = async () => {
    while (nextIndex < totalRequests) {
      nextIndex += 1;
      const startedAt = performance.now();
      try {
        const response = await fetch(`${baseUrl}${path}`, {
          headers: bearerToken ? { authorization: `Bearer ${bearerToken}` } : undefined,
        });
        if (!response.ok) failures += 1;
        await response.arrayBuffer();
      } catch {
        failures += 1;
      } finally {
        durations.push(performance.now() - startedAt);
      }
    }
  };

  await Promise.all(Array.from({ length: Math.min(concurrency, totalRequests) }, runWorker));
  durations.sort((a, b) => a - b);
  const percentile = (ratio) => durations[Math.max(0, Math.ceil(durations.length * ratio) - 1)] ?? 0;
  results.push({
    path,
    requests: totalRequests,
    concurrency,
    failures,
    p50Ms: Number(percentile(0.5).toFixed(2)),
    p95Ms: Number(percentile(0.95).toFixed(2)),
    p99Ms: Number(percentile(0.99).toFixed(2)),
  });
}

console.log(JSON.stringify({ measuredAt: new Date().toISOString(), baseUrl, p95LimitMs, results }, null, 2));

const failed = results.filter((result) => result.failures > 0 || result.p95Ms > p95LimitMs);
if (failed.length > 0) {
  console.error(`성능 게이트 실패: ${failed.map((result) => result.path).join(", ")}`);
  process.exitCode = 1;
}
