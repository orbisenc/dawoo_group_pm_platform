import { Injectable } from "@nestjs/common";

type RouteMetric = {
  count: number;
  errors: number;
  durationsMs: number[];
};

const MAX_DURATION_SAMPLES = 2_000;

@Injectable()
export class MetricsService {
  private readonly startedAt = Date.now();
  private readonly routes = new Map<string, RouteMetric>();

  record(method: string, path: string, statusCode: number, durationMs: number): void {
    const key = `${method.toUpperCase()} ${this.normalizePath(path)}`;
    const metric = this.routes.get(key) ?? { count: 0, errors: 0, durationsMs: [] };
    metric.count += 1;
    if (statusCode >= 500) metric.errors += 1;
    metric.durationsMs.push(durationMs);
    if (metric.durationsMs.length > MAX_DURATION_SAMPLES) metric.durationsMs.shift();
    this.routes.set(key, metric);
  }

  renderPrometheus(): string {
    const lines = [
      "# HELP project_hub_uptime_seconds API process uptime in seconds.",
      "# TYPE project_hub_uptime_seconds gauge",
      `project_hub_uptime_seconds ${Math.floor((Date.now() - this.startedAt) / 1_000)}`,
      "# HELP project_hub_http_requests_total Total HTTP requests.",
      "# TYPE project_hub_http_requests_total counter",
      "# HELP project_hub_http_errors_total Total HTTP responses with status 500 or higher.",
      "# TYPE project_hub_http_errors_total counter",
      "# HELP project_hub_http_duration_p95_ms Rolling p95 response duration in milliseconds.",
      "# TYPE project_hub_http_duration_p95_ms gauge",
    ];

    for (const [key, metric] of [...this.routes.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      const separator = key.indexOf(" ");
      const method = key.slice(0, separator);
      const path = key.slice(separator + 1);
      const labels = `method="${method}",path="${path}"`;
      lines.push(`project_hub_http_requests_total{${labels}} ${metric.count}`);
      lines.push(`project_hub_http_errors_total{${labels}} ${metric.errors}`);
      lines.push(`project_hub_http_duration_p95_ms{${labels}} ${this.percentile95(metric.durationsMs)}`);
    }

    return `${lines.join("\n")}\n`;
  }

  private percentile95(values: number[]): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.max(0, Math.ceil(sorted.length * 0.95) - 1);
    return Number((sorted[index] ?? 0).toFixed(2));
  }

  private normalizePath(path: string): string {
    return path
      .split("?")[0]!
      .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi, ":id")
      .replace(/\/\d+(?=\/|$)/g, "/:id");
  }
}
