import { useQuery } from "@tanstack/react-query";

interface HealthResponse {
  ok: boolean;
  timestamp: number;
}

export function useHealth() {
  return useQuery({
    queryKey: ["health"],
    queryFn: async (): Promise<HealthResponse> => {
      const response = await fetch("/api/health");
      if (!response.ok) {
        throw new Error("Health check failed");
      }
      return response.json();
    },
  });
}
