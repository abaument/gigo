/**
 * The learning loop as a closed circuit: run, check, memory, next prompt,
 * then round again. Pure SVG, no animation beyond a slow dash travelling
 * along the circle, so it reads exactly the same on a still screenshot.
 *
 * Server component: nothing here needs the client.
 */

const R = 128;
const CX = 190;
const CY = 190;

const ANGLES = [-90, 0, 90, 180]; // top, right, bottom, left

function point(angleDeg: number, radius = R) {
  const a = (angleDeg * Math.PI) / 180;
  return { x: CX + radius * Math.cos(a), y: CY + radius * Math.sin(a) };
}

export function LearningLoop({
  steps,
  center,
  still = false,
}: {
  steps: { title: string; note: string }[];
  center: string;
  /** no travelling dash (projector safe mode) */
  still?: boolean;
}) {
  return (
    <div className="grid gap-8 sm:grid-cols-[minmax(0,380px)_minmax(0,1fr)] sm:items-center">
      <svg viewBox="0 0 380 380" className="mx-auto w-full max-w-[340px]" role="img" aria-label={center}>
        <defs>
          <marker
            id="loopArrow"
            viewBox="0 0 10 10"
            refX="6"
            refY="5"
            markerWidth="5"
            markerHeight="5"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="rgba(212,168,83,0.75)" />
          </marker>
        </defs>

        {/* the circuit */}
        <circle
          cx={CX}
          cy={CY}
          r={R}
          fill="none"
          stroke="rgba(212,168,83,0.22)"
          strokeWidth={1.4}
        />
        {!still && (
          <circle
            cx={CX}
            cy={CY}
            r={R}
            fill="none"
            stroke="rgba(212,168,83,0.85)"
            strokeWidth={1.6}
            strokeLinecap="round"
            strokeDasharray="26 778"
            className="motion-safe:animate-[loop-travel_7s_linear_infinite]"
          />
        )}

        {/* direction arrows between the nodes */}
        {ANGLES.map((angle) => {
          const from = point(angle + 26);
          const to = point(angle + 62);
          return (
            <path
              key={angle}
              d={`M ${from.x} ${from.y} A ${R} ${R} 0 0 1 ${to.x} ${to.y}`}
              fill="none"
              stroke="rgba(212,168,83,0.55)"
              strokeWidth={1.4}
              markerEnd="url(#loopArrow)"
            />
          );
        })}

        {/* nodes */}
        {ANGLES.map((angle, i) => {
          const p = point(angle);
          return (
            <g key={angle}>
              <circle cx={p.x} cy={p.y} r={26} fill="#1a1310" stroke="rgba(212,168,83,0.55)" strokeWidth={1.4} />
              <text
                x={p.x}
                y={p.y + 5}
                textAnchor="middle"
                fontSize="15"
                fontWeight="600"
                fill="#d4a853"
                style={{ fontFamily: 'Source Code Pro, monospace' }}
              >
                {String(i + 1).padStart(2, '0')}
              </text>
            </g>
          );
        })}

        <text
          x={CX}
          y={CY + 5}
          textAnchor="middle"
          fontSize="13"
          letterSpacing="3"
          fill="rgba(245,239,230,0.45)"
          style={{ fontFamily: 'Source Code Pro, monospace', textTransform: 'uppercase' }}
        >
          {center}
        </text>
      </svg>

      <ol className="space-y-3">
        {steps.map((step, i) => (
          <li key={step.title} className="flex gap-4 rounded-lg border border-bark bg-coffee/50 px-4 py-3">
            <span className="font-body text-[11px] tabular-nums text-amber pt-1">
              {String(i + 1).padStart(2, '0')}
            </span>
            <span className="min-w-0">
              <span className="block font-display text-base text-cream">{step.title}</span>
              <span className="block font-accent text-xs text-taupe">{step.note}</span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
