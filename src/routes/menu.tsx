import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { type GameSettings, GameSetupDrawer } from "@/components/GameSetup";
import { Layout, LayoutFooter, LayoutHeader } from "@/components/Layout";
import { MenuTitle } from "@/components/MenuTitle";
import { Button } from "@/components/ui/8bit/button";
import { useGameStore } from "@/stores/game-store";

export const Route = createFileRoute("/menu")({
  component: MenuComponent,
});

function MenuComponent() {
  const navigate = useNavigate();
  const playerName = useGameStore((state) => state.playerName);
  const setSoloGame = useGameStore((state) => state.setSoloGame);

  const [isSoloDrawerOpen, setIsSoloDrawerOpen] = useState(false);

  // Redirect to FTE if no player name is set
  useEffect(() => {
    if (!playerName) {
      navigate({ to: "/" });
    }
  }, [playerName, navigate]);

  function handleStartSolo(settings: GameSettings) {
    setSoloGame({
      round: 1,
      playerScore: 0,
      computerScore: 0,
      winsNeeded: settings.winsNeeded,
      shotClock: settings.shotClock,
      isActive: true,
    });
    setIsSoloDrawerOpen(false);
    navigate({ to: "/play/solo" });
  }

  // Show loading while redirecting
  if (!playerName) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <>
      <Layout>
        <LayoutHeader>
          <MenuTitle description={`Hello, ${playerName}.`} title="Main Menu" />
        </LayoutHeader>
        <LayoutFooter>
          <Button
            className="w-[calc(100%-12px)]"
            onClick={() => navigate({ to: "/lobby" })}
          >
            MULTIPLAYER
          </Button>
          <Button
            className="w-[calc(100%-12px)]"
            onClick={() => setIsSoloDrawerOpen(true)}
          >
            SOLO
          </Button>
          <Button
            className="w-[calc(100%-12px)]"
            onClick={() => navigate({ to: "/leaderboard" })}
            variant="secondary"
          >
            LEADERBOARD
          </Button>
        </LayoutFooter>
      </Layout>

      <GameSetupDrawer
        onOpenChange={setIsSoloDrawerOpen}
        onSubmit={handleStartSolo}
        open={isSoloDrawerOpen}
        showPrivateToggle={false}
        submitLabel="START"
        title="SOLO PLAY"
      />
    </>
  );
}
