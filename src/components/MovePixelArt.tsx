import type { Move } from "@/types/messages";

interface MovePixelArtProps {
  move: Move;
  size?: number;
}

const PIXEL_SIZE = 3;
const GRID_SIZE = 32; // 32x32 grid of 3px pixels = 96x96

// Helper to create a pixel
function Pixel({ x, y, color }: { x: number; y: number; color: string }) {
  return (
    <rect
      fill={color}
      height={PIXEL_SIZE}
      width={PIXEL_SIZE}
      x={x * PIXEL_SIZE}
      y={y * PIXEL_SIZE}
    />
  );
}

// Rock: A rounded boulder shape
function RockPixelArt() {
  const pixels: { x: number; y: number; color: string }[] = [];
  const darkGray = "#374151";
  const midGray = "#6b7280";
  const lightGray = "#9ca3af";

  // Rock shape - oval/rounded boulder
  // Top highlight row
  for (let x = 12; x <= 19; x++) pixels.push({ x, y: 8, color: lightGray });

  // Upper section
  for (let x = 10; x <= 21; x++) pixels.push({ x, y: 9, color: lightGray });
  for (let x = 9; x <= 22; x++)
    pixels.push({ x, y: 10, color: x < 12 ? midGray : lightGray });
  for (let x = 8; x <= 23; x++)
    pixels.push({ x, y: 11, color: x < 11 ? midGray : lightGray });

  // Middle section
  for (let y = 12; y <= 17; y++) {
    for (let x = 7; x <= 24; x++) {
      let color = midGray;
      if (x < 10) color = darkGray;
      else if (x > 21) color = lightGray;
      else if (y < 14) color = lightGray;
      pixels.push({ x, y, color });
    }
  }

  // Lower section
  for (let x = 8; x <= 23; x++)
    pixels.push({ x, y: 18, color: x > 20 ? midGray : darkGray });
  for (let x = 9; x <= 22; x++) pixels.push({ x, y: 19, color: darkGray });
  for (let x = 10; x <= 21; x++) pixels.push({ x, y: 20, color: darkGray });
  for (let x = 12; x <= 19; x++) pixels.push({ x, y: 21, color: darkGray });

  return (
    <svg
      height={96}
      viewBox="0 0 96 96"
      width={96}
      xmlns="http://www.w3.org/2000/svg"
    >
      {pixels.map((p, i) => (
        <Pixel color={p.color} key={i} x={p.x} y={p.y} />
      ))}
    </svg>
  );
}

// Paper: A sheet of paper with fold
function PaperPixelArt() {
  const pixels: { x: number; y: number; color: string }[] = [];
  const white = "#f9fafb";
  const lightGray = "#e5e7eb";
  const midGray = "#d1d5db";
  const shadow = "#9ca3af";

  // Main paper body
  for (let y = 6; y <= 25; y++) {
    for (let x = 8; x <= 23; x++) {
      // Skip the folded corner area
      if (y < 11 && x > 18) continue;

      let color = white;
      // Left edge shadow
      if (x === 8) color = lightGray;
      // Bottom edge shadow
      if (y === 25) color = lightGray;
      // Some lines on paper
      if (y === 12 && x >= 10 && x <= 21) color = midGray;
      if (y === 15 && x >= 10 && x <= 21) color = midGray;
      if (y === 18 && x >= 10 && x <= 17) color = midGray;

      pixels.push({ x, y, color });
    }
  }

  // Folded corner triangle
  for (let x = 19; x <= 23; x++) pixels.push({ x, y: 6, color: midGray });
  for (let x = 19; x <= 23; x++)
    pixels.push({ x, y: 7, color: x === 19 ? shadow : midGray });
  for (let x = 19; x <= 23; x++)
    pixels.push({ x, y: 8, color: x <= 20 ? shadow : midGray });
  for (let x = 19; x <= 23; x++)
    pixels.push({ x, y: 9, color: x <= 21 ? shadow : midGray });
  for (let x = 19; x <= 23; x++)
    pixels.push({ x, y: 10, color: x <= 22 ? shadow : midGray });

  return (
    <svg
      height={96}
      viewBox="0 0 96 96"
      width={96}
      xmlns="http://www.w3.org/2000/svg"
    >
      {pixels.map((p, i) => (
        <Pixel color={p.color} key={i} x={p.x} y={p.y} />
      ))}
    </svg>
  );
}

// Scissors: Open scissors
function ScissorsPixelArt() {
  const pixels: { x: number; y: number; color: string }[] = [];
  const red = "#dc2626";
  const darkRed = "#991b1b";
  const silver = "#d1d5db";
  const darkSilver = "#9ca3af";
  const black = "#374151";

  // Left handle (red oval)
  for (let x = 6; x <= 10; x++) pixels.push({ x, y: 6, color: red });
  for (let x = 5; x <= 11; x++)
    pixels.push({ x, y: 7, color: x === 5 ? darkRed : red });
  for (let x = 5; x <= 11; x++)
    pixels.push({ x, y: 8, color: x === 5 ? darkRed : red });
  for (let x = 5; x <= 11; x++)
    pixels.push({ x, y: 9, color: x === 5 ? darkRed : red });
  for (let x = 6; x <= 10; x++) pixels.push({ x, y: 10, color: darkRed });

  // Right handle (red oval)
  for (let x = 21; x <= 25; x++) pixels.push({ x, y: 6, color: red });
  for (let x = 20; x <= 26; x++)
    pixels.push({ x, y: 7, color: x === 26 ? darkRed : red });
  for (let x = 20; x <= 26; x++)
    pixels.push({ x, y: 8, color: x === 26 ? darkRed : red });
  for (let x = 20; x <= 26; x++)
    pixels.push({ x, y: 9, color: x === 26 ? darkRed : red });
  for (let x = 21; x <= 25; x++) pixels.push({ x, y: 10, color: darkRed });

  // Left blade going down-right
  for (let i = 0; i < 8; i++) {
    const x = 10 + i;
    const y = 11 + i;
    pixels.push({ x, y, color: silver });
    pixels.push({ x: x + 1, y, color: darkSilver });
  }

  // Right blade going down-left
  for (let i = 0; i < 8; i++) {
    const x = 21 - i;
    const y = 11 + i;
    pixels.push({ x, y, color: silver });
    pixels.push({ x: x - 1, y, color: darkSilver });
  }

  // Center pivot screw
  for (let x = 15; x <= 16; x++) {
    for (let y = 14; y <= 15; y++) {
      pixels.push({ x, y, color: black });
    }
  }

  // Blade tips
  pixels.push({ x: 18, y: 19, color: silver });
  pixels.push({ x: 19, y: 20, color: silver });
  pixels.push({ x: 20, y: 21, color: darkSilver });

  pixels.push({ x: 13, y: 19, color: silver });
  pixels.push({ x: 12, y: 20, color: silver });
  pixels.push({ x: 11, y: 21, color: darkSilver });

  return (
    <svg
      height={96}
      viewBox="0 0 96 96"
      width={96}
      xmlns="http://www.w3.org/2000/svg"
    >
      {pixels.map((p, i) => (
        <Pixel color={p.color} key={i} x={p.x} y={p.y} />
      ))}
    </svg>
  );
}

export function MovePixelArt({ move }: MovePixelArtProps) {
  switch (move) {
    case "rock":
      return <RockPixelArt />;
    case "paper":
      return <PaperPixelArt />;
    case "scissors":
      return <ScissorsPixelArt />;
  }
}
