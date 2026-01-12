import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { Layout, LayoutHeader } from "@/components/Layout";
import { PageTitle } from "@/components/PageTitle";
import { Badge } from "@/components/ui/8bit/badge";
import { CardContent } from "@/components/ui/8bit/card";
import { Skeleton } from "@/components/ui/8bit/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/8bit/table";
import { useGameStore } from "@/stores/game-store";

export const Route = createFileRoute("/leaderboard")({
  component: LeaderboardComponent,
});

interface LeaderboardEntry {
  id: string;
  name: string;
  elo: number;
  wins: number;
  losses: number;
  draws: number;
  rank: number;
}

function useLeaderboard() {
  return useQuery({
    queryKey: ["leaderboard"],
    queryFn: async (): Promise<LeaderboardEntry[]> => {
      const response = await fetch("/api/leaderboard");
      if (!response.ok) {
        throw new Error("Failed to fetch leaderboard");
      }
      return response.json();
    },
  });
}

function getRankBadge(rank: number): React.ReactNode {
  if (rank === 1) {
    return (
      <Badge className="bg-yellow-500 text-black hover:bg-yellow-600">
        1ST
      </Badge>
    );
  }
  if (rank === 2) {
    return (
      <Badge className="bg-gray-300 text-black hover:bg-gray-400">2ND</Badge>
    );
  }
  if (rank === 3) {
    return (
      <Badge className="bg-amber-600 text-white hover:bg-amber-700">3RD</Badge>
    );
  }
  return <span className="text-muted-foreground">{rank}</span>;
}

function LeaderboardComponent() {
  const { useNavigate } = Route;
  const navigate = useNavigate();
  const playerId = useGameStore((state) => state.playerId);
  const playerName = useGameStore((state) => state.playerName);
  const { data: leaderboard, isLoading, error } = useLeaderboard();

  // Redirect to home if no player name is set
  useEffect(() => {
    if (!playerName) {
      navigate({ to: "/" });
    }
  }, [playerName, navigate]);

  // Show loading while redirecting
  if (!playerName) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <Layout maxWidth="3xl">
      <LayoutHeader className="flex-row items-center justify-between">
        <PageTitle title="LEADERS" />
      </LayoutHeader>
      <CardContent>
        {error && (
          <p className="text-center text-destructive">
            Failed to load leaderboard
          </p>
        )}

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[80px]">RANK</TableHead>
              <TableHead>PLAYER</TableHead>
              <TableHead className="text-center">ELO</TableHead>
              <TableHead className="text-center">W</TableHead>
              <TableHead className="text-center">L</TableHead>
              <TableHead className="text-center">D</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading &&
              [1, 2, 3, 4, 5].map((i) => (
                <TableRow key={i}>
                  <TableCell>
                    <Skeleton className="h-6 w-12" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-6 w-32" />
                  </TableCell>
                  <TableCell className="text-center">
                    <Skeleton className="mx-auto h-6 w-12" />
                  </TableCell>
                  <TableCell className="text-center">
                    <Skeleton className="mx-auto h-6 w-8" />
                  </TableCell>
                  <TableCell className="text-center">
                    <Skeleton className="mx-auto h-6 w-8" />
                  </TableCell>
                  <TableCell className="text-center">
                    <Skeleton className="mx-auto h-6 w-8" />
                  </TableCell>
                </TableRow>
              ))}

            {!isLoading &&
              leaderboard &&
              leaderboard.length > 0 &&
              leaderboard.map((entry) => {
                const isCurrentUser = entry.id === playerId;
                return (
                  <TableRow
                    className={
                      isCurrentUser ? "bg-primary/10 font-semibold" : ""
                    }
                    key={entry.id}
                  >
                    <TableCell>{getRankBadge(entry.rank)}</TableCell>
                    <TableCell>
                      {entry.name}
                      {isCurrentUser && (
                        <Badge className="ml-2" variant="secondary">
                          YOU
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-center">{entry.elo}</TableCell>
                    <TableCell className="text-center text-green-500">
                      {entry.wins}
                    </TableCell>
                    <TableCell className="text-center text-red-500">
                      {entry.losses}
                    </TableCell>
                    <TableCell className="text-center text-yellow-500">
                      {entry.draws}
                    </TableCell>
                  </TableRow>
                );
              })}

            {!isLoading && (!leaderboard || leaderboard.length === 0) && (
              <TableRow>
                <TableCell className="text-center" colSpan={6}>
                  <p className="text-muted-foreground">
                    No players found. Be the first to play!
                  </p>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Layout>
  );
}
