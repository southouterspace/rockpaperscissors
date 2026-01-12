interface MenuIconProps {
  size?: number;
  className?: string;
}

export function MenuIcon({ size = 16, className }: MenuIconProps) {
  // 8x8 pixel grid - 3 horizontal lines (hamburger menu)
  const pixelSize = size / 8;

  const pixels = [
    // Top line - row 1
    { x: 1, y: 1 }, { x: 2, y: 1 }, { x: 3, y: 1 }, { x: 4, y: 1 }, { x: 5, y: 1 }, { x: 6, y: 1 },
    // Middle line - row 3
    { x: 1, y: 3 }, { x: 2, y: 3 }, { x: 3, y: 3 }, { x: 4, y: 3 }, { x: 5, y: 3 }, { x: 6, y: 3 },
    // Bottom line - row 5
    { x: 1, y: 5 }, { x: 2, y: 5 }, { x: 3, y: 5 }, { x: 4, y: 5 }, { x: 5, y: 5 }, { x: 6, y: 5 },
  ];

  return (
    <svg
      className={className}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      width={size}
      xmlns="http://www.w3.org/2000/svg"
    >
      {pixels.map((p, i) => (
        <rect
          fill="currentColor"
          height={pixelSize}
          key={i}
          width={pixelSize}
          x={p.x * pixelSize}
          y={p.y * pixelSize}
        />
      ))}
    </svg>
  );
}
