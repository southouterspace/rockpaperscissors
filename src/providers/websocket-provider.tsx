import { useQueryClient } from "@tanstack/react-query";
import { createContext, type ReactNode, useContext } from "react";
import { InvitationReceivedDialog } from "@/components/InvitationReceivedDialog";
import { useGameSocket } from "@/hooks/use-game-socket";
import type { ConnectionStatus } from "@/hooks/use-websocket";
import type { ClientMessage } from "@/types/messages";

interface WebSocketContextValue {
  send: (message: ClientMessage) => void;
  connectionStatus: ConnectionStatus;
  disconnect: () => void;
}

const WebSocketContext = createContext<WebSocketContextValue | null>(null);

export function useWebSocketContext(): WebSocketContextValue {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error(
      "useWebSocketContext must be used within a WebSocketProvider"
    );
  }
  return context;
}

interface WebSocketProviderProps {
  children: ReactNode;
}

export function WebSocketProvider({ children }: WebSocketProviderProps) {
  const queryClient = useQueryClient();
  const { send, connectionStatus, disconnect } = useGameSocket({ queryClient });

  return (
    <WebSocketContext.Provider value={{ send, connectionStatus, disconnect }}>
      {children}
      <InvitationReceivedDialog />
    </WebSocketContext.Provider>
  );
}
