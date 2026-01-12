import { useNavigate } from "@tanstack/react-router";
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
import { toast } from "@/components/ui/8bit/toast";
import { loginWithPasskey } from "@/lib/passkeys";
import { useGameStore } from "@/stores/game-store";

interface PasskeyLoginProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PasskeyLogin({ open, onOpenChange }: PasskeyLoginProps) {
  const navigate = useNavigate();
  const setHasPasskey = useGameStore((state) => state.setHasPasskey);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  async function handleLogin() {
    setIsAuthenticating(true);

    const result = await loginWithPasskey();

    setIsAuthenticating(false);

    if (result.success) {
      setHasPasskey(true);
      onOpenChange(false);
      toast({
        title: "Welcome back!",
        description: "Successfully logged in with passkey.",
      });
      navigate({ to: "/lobby" });
    } else {
      toast({
        title: "Login failed",
        description: result.error || "Failed to authenticate",
        variant: "destructive",
      });
    }
  }

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center text-2xl">
            WELCOME BACK
          </DialogTitle>
          <DialogDescription className="text-center">
            Login with your passkey to continue playing. Your device will prompt
            you for biometric authentication.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-2 py-4">
          {isAuthenticating && (
            <div className="flex items-center gap-2">
              <Spinner />
              <span className="text-muted-foreground">
                Waiting for authentication...
              </span>
            </div>
          )}
        </div>

        <DialogFooter className="flex gap-2 sm:justify-center">
          <Button disabled={isAuthenticating} onClick={handleLogin}>
            {isAuthenticating ? "AUTHENTICATING..." : "LOGIN WITH PASSKEY"}
          </Button>
          <Button
            disabled={isAuthenticating}
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
