/**
 * FortiGate-style SVG icon set for Sonaro Gate sidebar.
 * Designed to match FortiOS 7.x web UI icon aesthetic exactly.
 * All icons: 14×14 viewBox, thin stroke lines, no fill (currentColor).
 */

import { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

const base = (size = 14): React.SVGAttributes<SVGSVGElement> => ({
  width: size,
  height: size,
  viewBox: '0 0 14 14',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
});

/* ── 1. Dashboard ─────────────────────────────────────────────────────────
   Speedometer with needle + tick marks — identical to FortiGate dashboard icon */
export function FgDashboard({ size = 14, ...props }: IconProps) {
  return (
    <svg {...base(size)} {...props}>
      {/* Outer arc (bottom open) */}
      <path d="M2 10 A5 5 0 1 1 12 10" strokeWidth={1.2} />
      {/* Tick marks */}
      <line x1="7" y1="2" x2="7" y2="3.2" strokeWidth={1} />
      <line x1="2.8" y1="3.7" x2="3.6" y2="4.4" strokeWidth={1} />
      <line x1="11.2" y1="3.7" x2="10.4" y2="4.4" strokeWidth={1} />
      <line x1="1.5" y1="7" x2="2.7" y2="7" strokeWidth={1} />
      <line x1="12.5" y1="7" x2="11.3" y2="7" strokeWidth={1} />
      {/* Needle pointing upper-right */}
      <line x1="7" y1="7" x2="10" y2="4.5" strokeWidth={1.3} stroke="currentColor" />
      {/* Center pivot */}
      <circle cx="7" cy="7" r="0.8" fill="currentColor" stroke="none" />
    </svg>
  );
}

/* ── 2. Security Fabric ───────────────────────────────────────────────────
   FortiGate's signature starburst/asterisk with 6 radiating arms + dots at tips */
export function FgSecurityFabric({ size = 14, ...props }: IconProps) {
  return (
    <svg {...base(size)} {...props}>
      {/* 6 radiating lines from center */}
      <line x1="7" y1="7" x2="7" y2="1.5" />
      <line x1="7" y1="7" x2="11.6" y2="4.25" />
      <line x1="7" y1="7" x2="11.6" y2="9.75" />
      <line x1="7" y1="7" x2="7" y2="12.5" />
      <line x1="7" y1="7" x2="2.4" y2="9.75" />
      <line x1="7" y1="7" x2="2.4" y2="4.25" />
      {/* Dots at each tip */}
      <circle cx="7" cy="1.5" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="11.6" cy="4.25" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="11.6" cy="9.75" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="7" cy="12.5" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="2.4" cy="9.75" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="2.4" cy="4.25" r="0.9" fill="currentColor" stroke="none" />
      {/* Center dot */}
      <circle cx="7" cy="7" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

/* ── 3. FortiView / Traffic Analysis ─────────────────────────────────────
   Binoculars shape — same as FortiGate FortiView icon */
export function FgFortiView({ size = 14, ...props }: IconProps) {
  return (
    <svg {...base(size)} {...props}>
      {/* Left lens */}
      <circle cx="4" cy="8.5" r="2.5" />
      {/* Right lens */}
      <circle cx="10" cy="8.5" r="2.5" />
      {/* Bridge connecting both */}
      <path d="M6.5 8.5 L7.5 8.5" strokeWidth={1.4} />
      {/* Barrels going up */}
      <path d="M2.5 8.5 L2.5 4.5 Q2.5 3.5 3.5 3.5 L5 3.5" />
      <path d="M11.5 8.5 L11.5 4.5 Q11.5 3.5 10.5 3.5 L9 3.5" />
      {/* Top grip */}
      <path d="M5 3.5 Q7 2.5 9 3.5" />
    </svg>
  );
}

/* ── 4. Network ───────────────────────────────────────────────────────────
   Network topology: center hub with 4 nodes — FortiGate Network icon style */
export function FgNetwork({ size = 14, ...props }: IconProps) {
  return (
    <svg {...base(size)} {...props}>
      {/* Center node */}
      <rect x="5.5" y="5.5" width="3" height="3" rx="0.5" fill="currentColor" stroke="none" />
      {/* Top node */}
      <rect x="5.5" y="1" width="3" height="2" rx="0.4" />
      {/* Bottom node */}
      <rect x="5.5" y="11" width="3" height="2" rx="0.4" />
      {/* Left node */}
      <rect x="1" y="5.5" width="2" height="3" rx="0.4" />
      {/* Right node */}
      <rect x="11" y="5.5" width="2" height="3" rx="0.4" />
      {/* Connecting lines */}
      <line x1="7" y1="5.5" x2="7" y2="3" />
      <line x1="7" y1="8.5" x2="7" y2="11" />
      <line x1="5.5" y1="7" x2="3" y2="7" />
      <line x1="8.5" y1="7" x2="11" y2="7" />
    </svg>
  );
}

/* ── 5. Routing ───────────────────────────────────────────────────────────
   Forked path with arrow — matches FortiGate routing icon */
export function FgRouting({ size = 14, ...props }: IconProps) {
  return (
    <svg {...base(size)} {...props}>
      {/* Entry line from left */}
      <line x1="1.5" y1="7" x2="4.5" y2="7" />
      {/* Split to two paths */}
      <path d="M4.5 7 Q5.5 7 6 4.5 L10.5 4.5" />
      <path d="M4.5 7 Q5.5 7 6 9.5 L10.5 9.5" />
      {/* Arrows on right ends */}
      <polyline points="9,3 10.5,4.5 9,6" />
      <polyline points="9,8 10.5,9.5 9,11" />
    </svg>
  );
}

/* ── 6. Policy & Objects ──────────────────────────────────────────────────
   Layered documents/rulebook — FortiGate Policy & Objects style */
export function FgPolicyObjects({ size = 14, ...props }: IconProps) {
  return (
    <svg {...base(size)} {...props}>
      {/* Back layer */}
      <rect x="3.5" y="2.5" width="8" height="9.5" rx="0.8" strokeDasharray="none" opacity={0.4} />
      {/* Main document */}
      <rect x="2" y="1.5" width="8" height="10" rx="0.8" />
      {/* Rule lines */}
      <line x1="4" y1="5" x2="8" y2="5" strokeWidth={1} />
      <line x1="4" y1="7" x2="8" y2="7" strokeWidth={1} />
      <line x1="4" y1="9" x2="6.5" y2="9" strokeWidth={1} />
    </svg>
  );
}

/* ── 7. Traffic Shaping ───────────────────────────────────────────────────
   Bandwidth throttle / funnel — FortiGate traffic shaping icon */
export function FgTrafficShaping({ size = 14, ...props }: IconProps) {
  return (
    <svg {...base(size)} {...props}>
      {/* Horizontal bars decreasing = shaping/QoS */}
      <rect x="1.5" y="2" width="11" height="1.5" rx="0.4" fill="currentColor" stroke="none" />
      <rect x="2.5" y="5" width="8" height="1.5" rx="0.4" fill="currentColor" stroke="none" />
      <rect x="4" y="8" width="6" height="1.5" rx="0.4" fill="currentColor" stroke="none" />
      <rect x="5" y="11" width="4" height="1.5" rx="0.4" fill="currentColor" stroke="none" />
    </svg>
  );
}

/* ── 8. Security Profiles ─────────────────────────────────────────────────
   Shield with inner lock — FortiGate Security Profiles icon */
export function FgSecurityProfiles({ size = 14, ...props }: IconProps) {
  return (
    <svg {...base(size)} {...props}>
      {/* Shield outer */}
      <path d="M7 1.5 L12.5 3.5 L12.5 7.5 Q12.5 11 7 12.5 Q1.5 11 1.5 7.5 L1.5 3.5 Z" />
      {/* Inner lock body */}
      <rect x="5.2" y="7" width="3.6" height="3" rx="0.5" />
      {/* Lock shackle */}
      <path d="M5.7 7 L5.7 5.8 Q5.7 4.5 7 4.5 Q8.3 4.5 8.3 5.8 L8.3 7" />
    </svg>
  );
}

/* ── 9. VPN ───────────────────────────────────────────────────────────────
   Tunnel with padlock — FortiGate VPN icon */
export function FgVPN({ size = 14, ...props }: IconProps) {
  return (
    <svg {...base(size)} {...props}>
      {/* Padlock body */}
      <rect x="3.5" y="6.5" width="7" height="5.5" rx="0.8" />
      {/* Shackle */}
      <path d="M5 6.5 L5 4.8 Q5 2.5 7 2.5 Q9 2.5 9 4.8 L9 6.5" />
      {/* Keyhole */}
      <circle cx="7" cy="9" r="1" />
      <line x1="7" y1="10" x2="7" y2="11" strokeWidth={1.2} />
    </svg>
  );
}

/* ── 10. User & Device ────────────────────────────────────────────────────
   Person silhouette + device indicator — FortiGate User & Device icon */
export function FgUserDevice({ size = 14, ...props }: IconProps) {
  return (
    <svg {...base(size)} {...props}>
      {/* Head */}
      <circle cx="7" cy="4" r="2.2" />
      {/* Body/shoulders */}
      <path d="M2.5 12.5 Q2.5 8.5 7 8.5 Q11.5 8.5 11.5 12.5" />
      {/* Small device tag bottom-right */}
      <rect x="9" y="9" width="3.5" height="2.5" rx="0.4" fill="currentColor" stroke="none" opacity={0.7} />
    </svg>
  );
}

/* ── 11. WiFi & Switch Controller ────────────────────────────────────────
   WiFi signal arcs + switch port dots — FortiGate WiFi icon */
export function FgWifi({ size = 14, ...props }: IconProps) {
  return (
    <svg {...base(size)} {...props}>
      {/* Three WiFi arcs */}
      <path d="M2 6.5 Q7 1 12 6.5" />
      <path d="M3.8 8.3 Q7 4.5 10.2 8.3" />
      <path d="M5.5 10 Q7 8 8.5 10" />
      {/* Center dot */}
      <circle cx="7" cy="12" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

/* ── 12. Log & Report ─────────────────────────────────────────────────────
   Bar chart with ascending bars — FortiGate Log & Report icon */
export function FgLogReport({ size = 14, ...props }: IconProps) {
  return (
    <svg {...base(size)} {...props}>
      {/* Baseline */}
      <line x1="1.5" y1="12" x2="12.5" y2="12" strokeWidth={1} />
      {/* Bars */}
      <rect x="2" y="8" width="2.2" height="4" rx="0.3" fill="currentColor" stroke="none" />
      <rect x="5.2" y="5.5" width="2.2" height="6.5" rx="0.3" fill="currentColor" stroke="none" />
      <rect x="8.4" y="3" width="2.2" height="9" rx="0.3" fill="currentColor" stroke="none" />
      {/* Trend line overlay */}
      <polyline points="3.1,8 6.3,5.5 9.5,3" strokeWidth={0.8} stroke="currentColor" strokeDasharray="1.5 1" fill="none" />
    </svg>
  );
}

/* ── 13. Monitor ──────────────────────────────────────────────────────────
   Desktop monitor screen — FortiGate Monitor icon */
export function FgMonitor({ size = 14, ...props }: IconProps) {
  return (
    <svg {...base(size)} {...props}>
      {/* Screen bezel */}
      <rect x="1.5" y="2" width="11" height="8" rx="1" />
      {/* Inner screen */}
      <rect x="2.5" y="3" width="9" height="6" rx="0.4" fill="currentColor" stroke="none" opacity={0.15} />
      {/* Stand stem */}
      <line x1="7" y1="10" x2="7" y2="12" />
      {/* Stand base */}
      <line x1="4.5" y1="12" x2="9.5" y2="12" />
      {/* Activity dot */}
      <circle cx="10.5" cy="5.5" r="0.8" fill="currentColor" stroke="none" opacity={0.8} />
    </svg>
  );
}

/* ── 14. System ───────────────────────────────────────────────────────────
   Gear/cog — FortiGate System icon, centered at (7,7), 6 teeth */
export function FgSystem({ size = 14, ...props }: IconProps) {
  // 12-point gear: alternating outer(r=5) and inner(r=3.2) at 30° steps
  // Points: (7+r*sin θ, 7-r*cos θ) for θ = 0,30,60,...,330
  const pts: string[] = [];
  for (let i = 0; i < 12; i++) {
    const r = i % 2 === 0 ? 5 : 3.2;
    const θ = (i * 30 * Math.PI) / 180;
    pts.push(`${(7 + r * Math.sin(θ)).toFixed(2)},${(7 - r * Math.cos(θ)).toFixed(2)}`);
  }
  return (
    <svg {...base(size)} {...props}>
      <polygon points={pts.join(' ')} strokeWidth={0.8} />
      <circle cx="7" cy="7" r="2" />
    </svg>
  );
}

/* ── 15. Collapse (Chevron left/right arrows) ─────────────────────────────*/
export { ChevronsLeft, ChevronsRight, ChevronDown, ChevronRight } from 'lucide-react';
