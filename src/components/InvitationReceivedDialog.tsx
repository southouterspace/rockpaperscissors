import { useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";
import { useWebSocketContext } from "@/providers/websocket-provider";
import { useGameStore } from "@/stores/game-store";
import { Button } from "./ui/8bit/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "./ui/8bit/drawer";

export function InvitationReceivedDialog() {
  const { send } = useWebSocketContext();
  const navigate = useNavigate();
  const pendingInvitation = useGameStore((state) => state.pendingInvitation);
  const setPendingInvitation = useGameStore(
    (state) => state.setPendingInvitation
  );

  const handleAccept = useCallback(() => {
    if (pendingInvitation) {
      send({
        type: "acceptInvitation",
        roomCode: pendingInvitation.roomCode,
        fromId: pendingInvitation.fromId,
      });
      setPendingInvitation(null);
      navigate({
        to: "/play/$roomCode",
        params: { roomCode: pendingInvitation.roomCode },
      });
    }
  }, [pendingInvitation, send, setPendingInvitation, navigate]);

  const handleDecline = useCallback(() => {
    if (pendingInvitation) {
      send({
        type: "declineInvitation",
        roomCode: pendingInvitation.roomCode,
        fromId: pendingInvitation.fromId,
      });
      setPendingInvitation(null);
    }
  }, [pendingInvitation, send, setPendingInvitation]);

  const isOpen = pendingInvitation !== null;

  return (
    <Drawer onOpenChange={(open) => !open && handleDecline()} open={isOpen}>
      <DrawerContent>
        <DrawerHeader className="text-center">
          <DrawerTitle>GAME INVITE</DrawerTitle>
          <DrawerDescription>
            {pendingInvitation?.fromName} invited you to play!
          </DrawerDescription>
        </DrawerHeader>
        <div className="px-4 py-4 text-center">
          <p className="text-muted-foreground text-sm">
            Best of {pendingInvitation?.settings.bestOf} |{" "}
            {pendingInvitation?.settings.shotClock}s shot clock
          </p>
        </div>
        <DrawerFooter>
          <Button className="w-full" onClick={handleAccept}>
            ACCEPT
          </Button>
          <DrawerClose asChild>
            <Button
              className="w-full"
              onClick={handleDecline}
              variant="outline"
            >
              DECLINE
            </Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
