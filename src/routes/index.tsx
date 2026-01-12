import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Layout, LayoutFooter, LayoutHeader } from "@/components/Layout";
import { MenuTitle } from "@/components/MenuTitle";
import { Button } from "@/components/ui/8bit/button";
import { Input } from "@/components/ui/8bit/input";
import { useWebSocketContext } from "@/providers/websocket-provider";
import { useGameStore } from "@/stores/game-store";

export const Route = createFileRoute("/")({
  component: HomeComponent,
});

function getInviteRoom(): string | null {
  try {
    return sessionStorage.getItem("rps_invite_room");
  } catch {
    return null;
  }
}

function clearInviteRoom(): void {
  try {
    sessionStorage.removeItem("rps_invite_room");
  } catch {
    // Storage not available
  }
}

function HomeComponent() {
  const [name, setName] = useState("");
  const { send, connectionStatus } = useWebSocketContext();
  const navigate = useNavigate();
  const storedPlayerName = useGameStore((state) => state.playerName);
  const setPlayerName = useGameStore((state) => state.setPlayerName);

  const isNameValid = name.trim().length >= 1 && name.trim().length <= 20;
  const isConnected = connectionStatus === "connected";

  // Redirect returning players to menu (or pending room if they were invited)
  useEffect(() => {
    if (storedPlayerName && isConnected) {
      send({ type: "setName", name: storedPlayerName });
      const inviteRoom = getInviteRoom();
      if (inviteRoom) {
        clearInviteRoom();
        navigate({ to: "/play/$roomCode", params: { roomCode: inviteRoom } });
      } else {
        navigate({ to: "/menu" });
      }
    }
  }, [storedPlayerName, isConnected, navigate, send]);

  function handleContinue() {
    if (!(isNameValid && isConnected)) {
      return;
    }
    const trimmedName = name.trim();
    setPlayerName(trimmedName);
    send({ type: "setName", name: trimmedName });
    // Navigate to pending room if invited, otherwise to menu
    const inviteRoom = getInviteRoom();
    if (inviteRoom) {
      clearInviteRoom();
      navigate({ to: "/play/$roomCode", params: { roomCode: inviteRoom } });
    } else {
      navigate({ to: "/menu" });
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && isNameValid && isConnected) {
      handleContinue();
    }
  }

  // Don't show FTE if we have a stored name (we're redirecting)
  if (storedPlayerName) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <Layout>
      <LayoutHeader>
        <MenuTitle title="ROCK PAPER SCISSORS" />
      </LayoutHeader>
      <LayoutFooter className="gap-2">
        <div className="flex w-full flex-col gap-2">
          <label className="text-sm" htmlFor="player-name">
            ENTER YOUR NAME
          </label>
          <Input
            autoComplete="off"
            id="player-name"
            maxLength={20}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Player"
            type="text"
            value={name}
          />
        </div>
        <Button
          className="w-[calc(100%-12px)]"
          disabled={!(isNameValid && isConnected)}
          onClick={handleContinue}
        >
          CONTINUE
        </Button>
        {connectionStatus === "connecting" && (
          <p className="text-center text-muted-foreground text-sm">
            CONNECTING...
          </p>
        )}
        {connectionStatus === "disconnected" && (
          <p className="text-center text-destructive text-sm">
            DISCONNECTED - RETRYING...
          </p>
        )}
      </LayoutFooter>
    </Layout>
  );
}
