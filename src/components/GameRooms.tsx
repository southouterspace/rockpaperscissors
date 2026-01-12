import { useQuery } from "@tanstack/react-query";
import { GameCard } from "@/components/GameCard";
import { Skeleton } from "@/components/ui/8bit/skeleton";

interface PublicRoom {
  roomCode: string;
  hostName: string;
  playerCount: number;
  maxPlayers: number;
  winsNeeded: number;
  status: string;
}

function useRooms() {
  return useQuery({
    queryKey: ["rooms"],
    queryFn: async (): Promise<PublicRoom[]> => {
      const response = await fetch("/api/rooms");
      if (!response.ok) {
        throw new Error("Failed to fetch rooms");
      }
      return response.json();
    },
    refetchInterval: 5000,
  });
}

interface GameRoomsProps {
  onJoinRoom: (roomCode: string) => void;
}

export function GameRooms({ onJoinRoom }: GameRoomsProps) {
  const { data: rooms, isLoading, error } = useRooms();

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (error) {
    return <p className="text-center text-destructive">FAILED TO LOAD ROOMS</p>;
  }

  if (!rooms || rooms.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="text-lg text-muted-foreground">NO ROOMS FOUND</p>
        <p className="mt-2 text-muted-foreground text-sm">
          Create a new game or join with a code!
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-y-auto">
      {rooms.map((room) => (
        <GameCard
          hostName={room.hostName}
          isFull={room.playerCount >= room.maxPlayers}
          isPlaying={room.status === "playing"}
          key={room.roomCode}
          onJoin={() => onJoinRoom(room.roomCode)}
          winsNeeded={room.winsNeeded}
        />
      ))}
    </div>
  );
}
