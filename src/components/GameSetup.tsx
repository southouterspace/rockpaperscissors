import { useState } from "react";
import { MenuTitle } from "@/components/MenuTitle";
import { Button } from "@/components/ui/8bit/button";
import {
  Drawer,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
} from "@/components/ui/8bit/drawer";
import { Slider } from "@/components/ui/8bit/slider";
import { Switch } from "@/components/ui/8bit/switch";
import { useWebSocketContext } from "@/providers/websocket-provider";

export interface GameSettings {
  winsNeeded: number;
  shotClock: number;
  isPublic: boolean;
}

interface GameSetupDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (settings: GameSettings) => void;
  title?: string;
  submitLabel?: string;
  showPrivateToggle?: boolean;
  disabled?: boolean;
}

export function GameSetupDrawer({
  open,
  onOpenChange,
  onSubmit,
  title = "NEW GAME",
  submitLabel = "CREATE",
  showPrivateToggle = true,
  disabled = false,
}: GameSetupDrawerProps) {
  const [winsNeeded, setWinsNeeded] = useState<number>(7);
  const [shotClock, setShotClock] = useState<number>(30);
  const [isPublic, setIsPublic] = useState<boolean>(true);

  function handleSubmit() {
    onSubmit({ winsNeeded, shotClock, isPublic });
  }

  function handleBack() {
    onOpenChange(false);
  }

  return (
    <Drawer onOpenChange={onOpenChange} open={open}>
      <DrawerContent className="mx-auto sm:max-w-md">
        <DrawerHeader>
          <MenuTitle align="center" title={title} />
        </DrawerHeader>

        <div className="flex flex-col gap-8 px-4 py-4">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <label className="text-sm" htmlFor="first-to">
                FIRST TO
              </label>
              <span className="font-bold text-sm">{winsNeeded}</span>
            </div>
            <Slider
              defaultValue={[winsNeeded]}
              id="first-to"
              max={21}
              min={2}
              onValueChange={(value) => setWinsNeeded(value[0])}
              step={1}
            />
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <label className="text-sm" htmlFor="shot-clock">
                SHOT CLOCK
              </label>
              <span className="font-bold text-sm">
                {shotClock === 0 ? "OFF" : `${shotClock} SEC`}
              </span>
            </div>
            <Slider
              defaultValue={[shotClock]}
              id="shot-clock"
              max={60}
              min={0}
              onValueChange={(value) => setShotClock(value[0])}
              step={5}
            />
          </div>

          {showPrivateToggle && (
            <div className="flex items-center justify-between">
              <label className="text-sm" htmlFor="private-room">
                PRIVATE ROOM
              </label>
              <Switch
                checked={!isPublic}
                id="private-room"
                onCheckedChange={(checked) => setIsPublic(!checked)}
              />
            </div>
          )}
        </div>

        <DrawerFooter className="flex-col gap-2">
          <Button
            className="w-[calc(100%-12px)]"
            disabled={disabled}
            onClick={handleSubmit}
          >
            {submitLabel}
          </Button>
          <Button
            className="w-[calc(100%-12px)]"
            onClick={handleBack}
            variant="outline"
          >
            BACK
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

// Convenience wrapper for multiplayer room creation
interface CreateRoomDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateRoomDialog({
  open,
  onOpenChange,
}: CreateRoomDialogProps) {
  const { send, connectionStatus } = useWebSocketContext();
  const isConnected = connectionStatus === "connected";

  function handleSubmit(settings: GameSettings) {
    if (!isConnected) {
      return;
    }

    const bestOf = settings.winsNeeded * 2 - 1;
    send({
      type: "createRoom",
      bestOf,
      winsNeeded: settings.winsNeeded,
      shotClock: settings.shotClock,
      isPublic: settings.isPublic,
    });
    onOpenChange(false);
  }

  return (
    <GameSetupDrawer
      disabled={!isConnected}
      onOpenChange={onOpenChange}
      onSubmit={handleSubmit}
      open={open}
    />
  );
}
