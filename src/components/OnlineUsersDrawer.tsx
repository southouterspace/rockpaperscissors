import { useCallback, useEffect, useState } from "react";
import { useWebSocketContext } from "@/providers/websocket-provider";
import { useGameStore } from "@/stores/game-store";
import { Button } from "@/components/ui/8bit/button";
import { Card } from "@/components/ui/8bit/card";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/8bit/drawer";

interface OnlineUsersDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  showInvite?: boolean;
}

export function OnlineUsersDrawer({
  open,
  onOpenChange,
  showInvite = false,
}: OnlineUsersDrawerProps) {
  const { send } = useWebSocketContext();
  const sessionId = useGameStore((state) => state.sessionId);
  const onlineUsers = useGameStore((state) => state.onlineUsers);
  const [invitedUsers, setInvitedUsers] = useState<Set<string>>(new Set());

  // Request online users when drawer opens
  useEffect(() => {
    if (open) {
      send({ type: "getOnlineUsers" });
      setInvitedUsers(new Set());
    }
  }, [open, send]);

  const handleInvite = useCallback(
    (userId: string) => {
      send({ type: "invitePlayer", targetId: userId });
      setInvitedUsers((prev) => new Set(prev).add(userId));
    },
    [send]
  );

  // Filter out self and users already in games
  const availableUsers = onlineUsers.filter(
    (user) => user.id !== sessionId && !user.inRoom && !user.pendingInvitation
  );

  return (
    <Drawer onOpenChange={onOpenChange} open={open}>
      <DrawerContent>
        <DrawerHeader className="text-center">
          <DrawerTitle>PLAYERS ONLINE</DrawerTitle>
          <DrawerDescription>
            {availableUsers.length} players online now
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
                {showInvite && (
                  <Button
                    disabled={invitedUsers.has(user.id)}
                    onClick={() => handleInvite(user.id)}
                    size="sm"
                    variant={invitedUsers.has(user.id) ? "secondary" : "default"}
                  >
                    {invitedUsers.has(user.id) ? "INVITED" : "INVITE"}
                  </Button>
                )}
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
