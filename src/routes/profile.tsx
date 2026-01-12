import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { PasskeyRegistration } from "@/components/passkey-registration";
import { Avatar, AvatarFallback } from "@/components/ui/8bit/avatar";
import { Badge } from "@/components/ui/8bit/badge";
import { Button } from "@/components/ui/8bit/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/8bit/card";
import { Input } from "@/components/ui/8bit/input";
import { Skeleton } from "@/components/ui/8bit/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/8bit/table";
import { toast } from "@/hooks/use-toast";
import { useGameStore } from "@/stores/game-store";

export const Route = createFileRoute("/profile")({
  component: ProfileComponent,
});

interface UserProfile {
  id: string;
  name: string;
  elo: number;
  wins: number;
  losses: number;
  draws: number;
}

interface UserRank {
  userId: string;
  rank: number;
  elo: number;
  totalPlayers: number;
}

interface MatchHistoryItem {
  id: string;
  opponent: string;
  result: "win" | "loss" | "draw";
  userScore: number;
  opponentScore: number;
  isSolo: boolean;
  createdAt: string;
}

function useUserProfile(userId: string | null) {
  return useQuery({
    queryKey: ["user", userId],
    queryFn: async (): Promise<UserProfile> => {
      if (!userId) {
        throw new Error("Not authenticated");
      }
      const response = await fetch(`/api/users/${userId}`);
      if (!response.ok) {
        throw new Error("Failed to fetch user profile");
      }
      return response.json();
    },
    enabled: !!userId,
  });
}

function useUserRank(userId: string | null) {
  return useQuery({
    queryKey: ["userRank", userId],
    queryFn: async (): Promise<UserRank> => {
      if (!userId) {
        throw new Error("Not authenticated");
      }
      const response = await fetch(`/api/leaderboard/rank/${userId}`);
      if (!response.ok) {
        throw new Error("Failed to fetch rank");
      }
      return response.json();
    },
    enabled: !!userId,
  });
}

function useMatchHistory(userId: string | null, limit: number) {
  return useQuery({
    queryKey: ["matchHistory", userId, limit],
    queryFn: async (): Promise<MatchHistoryItem[]> => {
      if (!userId) {
        throw new Error("Not authenticated");
      }
      const response = await fetch(
        `/api/users/${userId}/matches?limit=${limit}`
      );
      if (!response.ok) {
        throw new Error("Failed to fetch match history");
      }
      return response.json();
    },
    enabled: !!userId,
  });
}

function useUpdateName() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      userId,
      name,
    }: {
      userId: string;
      name: string;
    }): Promise<UserProfile> => {
      const response = await fetch(`/api/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!response.ok) {
        throw new Error("Failed to update name");
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["user", data.id], data);
    },
  });
}

function getResultBadge(result: "win" | "loss" | "draw") {
  if (result === "win") {
    return (
      <Badge className="bg-green-500 text-white" variant="default">
        W
      </Badge>
    );
  }
  if (result === "loss") {
    return (
      <Badge className="bg-red-500 text-white" variant="default">
        L
      </Badge>
    );
  }
  return (
    <Badge className="bg-gray-500 text-white" variant="default">
      D
    </Badge>
  );
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

interface StatItemProps {
  label: string;
  value: number | string;
  colorClass?: string;
  isLoading: boolean;
}

function StatItem({ label, value, colorClass = "", isLoading }: StatItemProps) {
  return (
    <div className="flex flex-col">
      <span className="text-muted-foreground text-xs">{label}</span>
      {isLoading ? (
        <Skeleton className="mx-auto h-8 w-12" />
      ) : (
        <span className={`font-bold text-2xl ${colorClass}`}>{value}</span>
      )}
    </div>
  );
}

function MatchHistoryContent({
  isLoading,
  matches,
}: {
  isLoading: boolean;
  matches: MatchHistoryItem[] | undefined;
}) {
  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (!matches || matches.length === 0) {
    return (
      <p className="text-center text-muted-foreground">NO MATCHES PLAYED YET</p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>OPPONENT</TableHead>
          <TableHead className="text-center">RESULT</TableHead>
          <TableHead className="text-center">SCORE</TableHead>
          <TableHead className="text-right">DATE</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {matches.map((match) => (
          <TableRow key={match.id}>
            <TableCell className="font-medium">
              {match.isSolo ? "Computer" : match.opponent}
            </TableCell>
            <TableCell className="text-center">
              {getResultBadge(match.result)}
            </TableCell>
            <TableCell className="text-center">
              {match.userScore} - {match.opponentScore}
            </TableCell>
            <TableCell className="text-right text-muted-foreground text-sm">
              {formatDate(match.createdAt)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function ProfileComponent() {
  const navigate = useNavigate();
  const playerId = useGameStore((state) => state.playerId);
  const setPlayerName = useGameStore((state) => state.setPlayerName);
  const hasPasskey = useGameStore((state) => state.hasPasskey);

  const { data: profile, isLoading: profileLoading } = useUserProfile(playerId);
  const { data: rankData, isLoading: rankLoading } = useUserRank(playerId);
  const updateNameMutation = useUpdateName();

  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState("");
  const [showPasskeyDialog, setShowPasskeyDialog] = useState(false);
  const [matchLimit, setMatchLimit] = useState(5);

  const { data: matchHistory, isLoading: matchHistoryLoading } =
    useMatchHistory(playerId, matchLimit);

  const isLoading = profileLoading || rankLoading;

  function handleStartEditing() {
    setNewName(profile?.name || "");
    setEditingName(true);
  }

  function handleCancelEditing() {
    setEditingName(false);
    setNewName("");
  }

  async function handleSaveName() {
    if (!(playerId && newName.trim())) {
      return;
    }

    try {
      const updated = await updateNameMutation.mutateAsync({
        userId: playerId,
        name: newName.trim(),
      });
      setPlayerName(updated.name);
      setEditingName(false);
      toast({
        title: "Success",
        description: "Name updated successfully!",
      });
    } catch {
      toast({
        title: "Error",
        description: "Failed to update name",
        variant: "destructive",
      });
    }
  }

  function handleBackToLobby() {
    navigate({ to: "/lobby" });
  }

  function handleShowMore() {
    setMatchLimit((prev) => prev + 10);
  }

  // Show login prompt if not authenticated
  if (!playerId) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">PROFILE</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            <p className="text-center text-muted-foreground">
              Login to view your profile
            </p>
          </CardContent>
          <CardFooter className="flex justify-center">
            <Button onClick={() => navigate({ to: "/" })}>GO TO LOGIN</Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // Calculate win rate
  const totalGames = (profile?.wins ?? 0) + (profile?.losses ?? 0);
  const winRate =
    totalGames > 0 ? Math.round(((profile?.wins ?? 0) / totalGames) * 100) : 0;

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center gap-2 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-2xl">PROFILE</CardTitle>
            <Button onClick={handleBackToLobby} size="sm" variant="outline">
              BACK
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-2">
          {/* Avatar and Name */}
          <div className="flex flex-col items-center gap-3">
            {isLoading ? (
              <Skeleton className="h-20 w-20 rounded-full" />
            ) : (
              <Avatar className="h-20 w-20">
                <AvatarFallback className="text-2xl">
                  {profile?.name.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            )}

            {editingName ? (
              <div className="flex flex-col items-center gap-2">
                <Input
                  className="w-48 text-center"
                  maxLength={20}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Enter name"
                  value={newName}
                />
                <div className="flex gap-2">
                  <Button
                    disabled={updateNameMutation.isPending}
                    onClick={handleSaveName}
                    size="sm"
                  >
                    SAVE
                  </Button>
                  <Button
                    onClick={handleCancelEditing}
                    size="sm"
                    variant="outline"
                  >
                    CANCEL
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                {isLoading ? (
                  <Skeleton className="h-6 w-32" />
                ) : (
                  <span className="font-bold text-xl">{profile?.name}</span>
                )}
                <Button
                  onClick={handleStartEditing}
                  size="sm"
                  variant="outline"
                >
                  EDIT
                </Button>
              </div>
            )}
          </div>

          {/* ELO and Rank */}
          <div className="flex items-center gap-4">
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <Badge className="text-lg" variant="default">
                ELO: {profile?.elo ?? 1000}
              </Badge>
            )}
            {rankLoading ? (
              <Skeleton className="h-6 w-20" />
            ) : (
              <span className="text-muted-foreground">
                RANK #{rankData?.rank ?? "?"} of {rankData?.totalPlayers ?? "?"}
              </span>
            )}
          </div>

          {/* Stats */}
          <div className="grid w-full grid-cols-4 gap-4 text-center">
            <StatItem
              colorClass="text-green-500"
              isLoading={isLoading}
              label="WINS"
              value={profile?.wins ?? 0}
            />
            <StatItem
              colorClass="text-red-500"
              isLoading={isLoading}
              label="LOSSES"
              value={profile?.losses ?? 0}
            />
            <StatItem
              colorClass="text-yellow-500"
              isLoading={isLoading}
              label="DRAWS"
              value={profile?.draws ?? 0}
            />
            <StatItem
              isLoading={isLoading}
              label="WIN %"
              value={`${winRate}%`}
            />
          </div>
        </CardContent>
        {!hasPasskey && (
          <CardFooter className="flex justify-center">
            <Button
              onClick={() => setShowPasskeyDialog(true)}
              variant="outline"
            >
              SAVE ACCOUNT
            </Button>
          </CardFooter>
        )}
      </Card>

      {/* Match History */}
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-xl">MATCH HISTORY</CardTitle>
        </CardHeader>
        <CardContent>
          <MatchHistoryContent
            isLoading={matchHistoryLoading}
            matches={matchHistory}
          />
        </CardContent>
        {matchHistory && matchHistory.length >= matchLimit && (
          <CardFooter className="flex justify-center">
            <Button onClick={handleShowMore} variant="outline">
              SHOW MORE
            </Button>
          </CardFooter>
        )}
      </Card>

      <PasskeyRegistration
        onOpenChange={setShowPasskeyDialog}
        open={showPasskeyDialog}
      />
    </div>
  );
}
