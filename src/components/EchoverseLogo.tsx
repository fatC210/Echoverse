const EchoverseLogo = ({ size = 32, className = "" }: { size?: number; className?: string }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 120 120"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    {/* Outer echo arc - top */}
    <path d="M28 38 A40 40 0 0 1 92 38" stroke="hsl(var(--accent))" strokeWidth="2" strokeLinecap="round" strokeOpacity="0.2" />
    {/* Outer echo arc - bottom */}
    <path d="M28 82 A40 40 0 0 0 92 82" stroke="hsl(var(--accent))" strokeWidth="2" strokeLinecap="round" strokeOpacity="0.2" />
    
    {/* Mid echo arc - top */}
    <path d="M36 44 A30 30 0 0 1 84 44" stroke="hsl(var(--accent))" strokeWidth="2" strokeLinecap="round" strokeOpacity="0.35" />
    {/* Mid echo arc - bottom */}
    <path d="M36 76 A30 30 0 0 0 84 76" stroke="hsl(var(--accent))" strokeWidth="2" strokeLinecap="round" strokeOpacity="0.35" />

    {/* Inner echo arc - top */}
    <path d="M44 50 A18 18 0 0 1 76 50" stroke="hsl(var(--accent))" strokeWidth="2.5" strokeLinecap="round" strokeOpacity="0.55" />
    {/* Inner echo arc - bottom */}
    <path d="M44 70 A18 18 0 0 0 76 70" stroke="hsl(var(--accent))" strokeWidth="2.5" strokeLinecap="round" strokeOpacity="0.55" />

    {/* Center core - solid circle */}
    <circle cx="60" cy="60" r="8" fill="hsl(var(--accent))" fillOpacity="0.9" />
    {/* Core highlight */}
    <circle cx="58" cy="58" r="3" fill="hsl(var(--accent))" fillOpacity="0.3" />
    
    {/* Tiny accent dots */}
    <circle cx="26" cy="60" r="1.5" fill="hsl(var(--accent))" fillOpacity="0.4" />
    <circle cx="94" cy="60" r="1.5" fill="hsl(var(--accent))" fillOpacity="0.4" />
  </svg>
);

export default EchoverseLogo;
