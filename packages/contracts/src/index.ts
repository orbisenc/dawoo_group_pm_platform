export type ServiceState = "정상" | "오류";

export interface ApiHealthResponse {
  service: "PROJECT HUB API";
  status: ServiceState;
  version: string;
  timestamp: string;
}

export interface DependencyHealth {
  database: ServiceState;
  redis: ServiceState;
  objectStorage: ServiceState;
}

export interface ApiReadinessResponse extends ApiHealthResponse {
  dependencies: DependencyHealth;
}

export const isApiHealthResponse = (value: unknown): value is ApiHealthResponse => {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<ApiHealthResponse>;
  return (
    candidate.service === "PROJECT HUB API" &&
    candidate.status === "정상" &&
    typeof candidate.version === "string" &&
    typeof candidate.timestamp === "string"
  );
};
