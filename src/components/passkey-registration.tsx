import { useState } from "react";
import { Button } from "@/components/ui/8bit/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/8bit/dialog";
import { Spinner } from "@/components/ui/8bit/spinner";
import { toast } from "@/hooks/use-toast";
import { registerPasskey } from "@/lib/passkeys";
import { useGameStore } from "@/stores/game-store";

interface PasskeyRegistrationProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PasskeyRegistration({
  open,
  onOpenChange,
}: PasskeyRegistrationProps) {
  const playerId = useGameStore((state) => state.playerId);
  const setHasPasskey = useGameStore((state) => state.setHasPasskey);
  const [isRegistering, setIsRegistering] = useState(false);

  async function handleRegister() {
    if (!playerId) {
      toast({
        title: "Error",
        description: "You must be logged in to register a passkey",
        variant: "destructive",
      });
      return;
    }

    setIsRegistering(true);

    const result = await registerPasskey(playerId);

    setIsRegistering(false);

    if (result.success) {
      setHasPasskey(true);
      onOpenChange(false);
      toast({
        title: "Success",
        description: "Your account has been saved with a passkey!",
      });
    } else {
      toast({
        title: "Registration failed",
        description: result.error || "Failed to register passkey",
        variant: "destructive",
      });
    }
  }

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center text-2xl">
            SAVE YOUR ACCOUNT
          </DialogTitle>
          <DialogDescription className="text-center">
            Register a passkey to save your progress and access your account
            from any device. Passkeys are secure and easy to use - no passwords
            required!
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-2 py-4">
          <p className="text-center text-muted-foreground text-sm">
            Your account will be linked to your device&apos;s biometric
            authentication (fingerprint, face, or PIN).
          </p>

          {isRegistering && (
            <div className="flex items-center gap-2">
              <Spinner />
              <span className="text-muted-foreground">
                Waiting for authentication...
              </span>
            </div>
          )}
        </div>

        <DialogFooter className="flex gap-2 sm:justify-center">
          <Button disabled={isRegistering} onClick={handleRegister}>
            {isRegistering ? "REGISTERING..." : "SAVE WITH PASSKEY"}
          </Button>
          <Button
            disabled={isRegistering}
            onClick={() => onOpenChange(false)}
            variant="outline"
          >
            CANCEL
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
