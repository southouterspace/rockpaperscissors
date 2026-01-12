import { QueryClientProvider } from "@tanstack/react-query";
import { createRootRoute, Outlet } from "@tanstack/react-router";
import { Toaster } from "@/components/ui/toaster";
import { queryClient } from "@/lib/query-client";
import { WebSocketProvider } from "@/providers/websocket-provider";

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  return (
    <QueryClientProvider client={queryClient}>
      <WebSocketProvider>
        <div className="flex h-dvh flex-col bg-background pt-safe pb-safe text-foreground">
          <main className="container mx-auto flex flex-1 flex-col overflow-hidden p-4">
            <Outlet />
          </main>
          <Toaster />
        </div>
      </WebSocketProvider>
    </QueryClientProvider>
  );
}
