import { useEffect } from "react";
import { useWebSocketContext } from "@/providers/websocket-provider";
import { useGameStore } from "@/stores/game-store";
import { Button } from "./ui/8bit/button";
import { Card } from "./ui/8bit/card";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "./ui/8bit/drawer";

interface OnlineUsersDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function OnlineUsersDrawer({
  open,
  onOpenChange,
}: OnlineUsersDrawerProps) {
  const { send } = useWebSocketContext();
  const sessionId = useGameStore((state) => state.sessionId);
  const onlineUsers = useGameStore((state) => state.onlineUsers);
  // Request online users when drawer opens
  useEffect(() => {
    if (open) {
      send({ type: "getOnlineUsers" });
    }
  }, [open, send]);

  // Filter out self and users already in games
  const availableUsers = onlineUsers.filter(
    (user) => user.id !== sessionId && !user.inRoom && !user.pendingInvitation
  );

  return (
    <Drawer onOpenChange={onOpenChange} open={open}>
      <DrawerContent>
        <DrawerHeader className="text-center">
          <DrawerTitle>INVITE PLAYER</DrawerTitle>
          <DrawerDescription>
            Select a player to invite to your game
          </DrawerDescription>
        </DrawerHeader>
        <div className="flex flex-col gap-2 px-4 py-4">
          {availableUsers.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">
              NO PLAYERS AVAILABLE
            </p>
          ) : (
            availableUsers.map((user) => (
              <Card
                className="flex items-center justify-between p-3"
                key={user.id}
              >
                <span className="font-medium">{user.name}</span>
              </Card>
            ))
          )}
        </div>
        <DrawerFooter>
          <DrawerClose asChild>
            <Button className="w-full" variant="outline">
              CLOSE
            </Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
