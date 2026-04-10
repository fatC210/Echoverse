const EchoverseLogo = ({ size = 32, className = "" }: { size?: number; className?: string }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 120 120"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    {/* Outer ring - echo ripple 3 */}
    <circle cx="60" cy="60" r="56" stroke="hsl(var(--accent))" strokeWidth="1.5" strokeOpacity="0.15" />
    {/* Middle ring - echo ripple 2 */}
    <circle cx="60" cy="60" r="42" stroke="hsl(var(--accent))" strokeWidth="1.5" strokeOpacity="0.3" />
    {/* Inner ring - echo ripple 1 */}
    <circle cx="60" cy="60" r="28" stroke="hsl(var(--accent))" strokeWidth="2" strokeOpacity="0.5" />
    
    {/* Core waveform - stylized sound wave */}
    <path
      d="M32 60 Q36 60 38 52 Q40 44 42 60 Q44 76 46 60 Q48 44 50 38 Q52 32 54 60 Q56 88 58 60 Q60 32 62 28 Q64 24 66 60 Q68 96 70 60 Q72 24 74 38 Q76 52 78 60 Q80 68 82 60 Q84 52 86 58 Q88 64 90 60"
      stroke="hsl(var(--accent))"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
    
    {/* Accent dots at wave peaks */}
    <circle cx="54" cy="60" r="2" fill="hsl(var(--accent))" fillOpacity="0.8" />
    <circle cx="62" cy="28" r="2.5" fill="hsl(var(--accent))" />
    <circle cx="70" cy="60" r="2" fill="hsl(var(--accent))" fillOpacity="0.8" />
    
    {/* Small orbital dot */}
    <circle cx="60" cy="4" r="2" fill="hsl(var(--accent))" fillOpacity="0.6">
      <animateTransform
        attributeName="transform"
        type="rotate"
        from="0 60 60"
        to="360 60 60"
        dur="12s"
        repeatCount="indefinite"
      />
    </circle>
  </svg>
);

export default EchoverseLogo;
