import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { GameRooms } from "@/components/GameRooms";
import { CreateRoomDialog } from "@/components/GameSetup";
import { Layout, LayoutFooter, LayoutHeader } from "@/components/Layout";
import { PageTitle } from "@/components/PageTitle";
import { Button } from "@/components/ui/8bit/button";
import { CardContent } from "@/components/ui/8bit/card";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/8bit/drawer";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/8bit/input-otp";
import { useWebSocketContext } from "@/providers/websocket-provider";
import { useGameStore } from "@/stores/game-store";

export const Route = createFileRoute("/lobby")({
  component: LobbyComponent,
});

function LobbyComponent() {
  const { send } = useWebSocketContext();
  const navigate = useNavigate();
  const roomCode = useGameStore((state) => state.roomCode);
  const playerName = useGameStore((state) => state.playerName);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isJoinDrawerOpen, setIsJoinDrawerOpen] = useState(false);
  const [joinCode, setJoinCode] = useState("");

  // Track the initial roomCode on mount to avoid navigating if already set
  const initialRoomCodeRef = useRef(roomCode);

  // Redirect to home if no player name is set
  useEffect(() => {
    if (!playerName) {
      navigate({ to: "/" });
    }
  }, [playerName, navigate]);

  // Navigate to game room only when roomCode changes from null to a value
  useEffect(() => {
    if (roomCode && roomCode !== initialRoomCodeRef.current) {
      navigate({ to: "/play/$roomCode", params: { roomCode } });
    }
  }, [roomCode, navigate]);

  // Show loading while redirecting
  if (!playerName) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  function handleCreateRoom() {
    setIsCreateDialogOpen(true);
  }

  function handleJoinRoom(code: string) {
    if (code.length === 6) {
      send({ type: "joinRoom", roomCode: code.toUpperCase(), asPlayer: true });
      setIsJoinDrawerOpen(false);
      setJoinCode("");
    }
  }

  function handleJoinCodeChange(value: string) {
    const upperValue = value.toUpperCase();
    setJoinCode(upperValue);
    if (upperValue.length === 6) {
      handleJoinRoom(upperValue);
    }
  }

  function handleJoinRoomFromList(code: string) {
    send({ type: "joinRoom", roomCode: code, asPlayer: true });
  }

  function handleOpenJoinDrawer() {
    setJoinCode("");
    setIsJoinDrawerOpen(true);
  }

  return (
    <>
      <Layout>
        <LayoutHeader className="flex-row items-center justify-between">
          <PageTitle title="LOBBY" />
        </LayoutHeader>
        <CardContent className="flex flex-1 flex-col gap-4">
          <GameRooms onJoinRoom={handleJoinRoomFromList} />
        </CardContent>
        <LayoutFooter>
          <Button className="w-full" onClick={handleCreateRoom}>
            NEW GAME
          </Button>
          <Button
            className="w-full"
            onClick={handleOpenJoinDrawer}
            variant="outline"
          >
            JOIN GAME
          </Button>
        </LayoutFooter>
      </Layout>

      <CreateRoomDialog
        onOpenChange={setIsCreateDialogOpen}
        open={isCreateDialogOpen}
      />

      <Drawer onOpenChange={setIsJoinDrawerOpen} open={isJoinDrawerOpen}>
        <DrawerContent>
          <DrawerHeader className="text-center">
            <DrawerTitle>JOIN GAME</DrawerTitle>
          </DrawerHeader>
          <div className="flex justify-center px-4 py-4">
            <InputOTP
              inputMode="text"
              maxLength={6}
              onChange={handleJoinCodeChange}
              pattern="^[a-zA-Z0-9]*$"
              value={joinCode}
            >
              <InputOTPGroup>
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
                <InputOTPSlot index={3} />
                <InputOTPSlot index={4} />
                <InputOTPSlot index={5} />
              </InputOTPGroup>
            </InputOTP>
          </div>
          <DrawerFooter>
            <DrawerClose asChild>
              <Button className="w-full" variant="outline">
                CANCEL
              </Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </>
  );
}
