// Illustrated Toronto skyline for the homepage hero. Inline SVG (same
// approach as the logo and category icons): no image request, crisp at every
// width, and tinted to sit behind text without hurting contrast. Two building
// layers give depth; the CN Tower and dome echo the real waterfront without
// copying any photo.

export function TorontoSkyline({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 1440 300"
      preserveAspectRatio="xMidYMax slice"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {/* Distant layer */}
      <g fill="#C7DCEE">
        <rect x="0" y="150" width="70" height="150" />
        <rect x="80" y="120" width="55" height="180" />
        <rect x="145" y="165" width="70" height="135" />
        <rect x="225" y="95" width="60" height="205" />
        <rect x="295" y="140" width="50" height="160" />
        <rect x="355" y="110" width="70" height="190" />
        <rect x="435" y="160" width="55" height="140" />
        <rect x="500" y="85" width="65" height="215" />
        <rect x="575" y="135" width="55" height="165" />
        <rect x="640" y="105" width="60" height="195" />
        <rect x="710" y="150" width="55" height="150" />
        <rect x="775" y="95" width="65" height="205" />
        <rect x="850" y="140" width="55" height="160" />
        <rect x="915" y="115" width="60" height="185" />
        <rect x="1120" y="120" width="60" height="180" />
        <rect x="1190" y="90" width="65" height="210" />
        <rect x="1265" y="140" width="55" height="160" />
        <rect x="1330" y="110" width="70" height="190" />
        <rect x="1405" y="155" width="35" height="145" />
      </g>

      {/* Near layer */}
      <g fill="#A6C3DC">
        <rect x="30" y="190" width="80" height="110" />
        <rect x="125" y="215" width="70" height="85" />
        <rect x="210" y="175" width="75" height="125" />
        <rect x="300" y="205" width="65" height="95" />
        <rect x="380" y="160" width="80" height="140" />
        <rect x="475" y="200" width="70" height="100" />
        <rect x="560" y="170" width="75" height="130" />
        <rect x="650" y="210" width="65" height="90" />
        <rect x="730" y="180" width="80" height="120" />
        <rect x="825" y="220" width="70" height="80" />
        <rect x="905" y="185" width="75" height="115" />
        {/* Rogers Centre dome */}
        <path d="M1112 300a82 62 0 0 0-164 0z" />
        <rect x="1150" y="195" width="75" height="105" />
        <rect x="1240" y="170" width="80" height="130" />
        <rect x="1335" y="205" width="70" height="95" />
      </g>

      {/* Window hints on the near layer */}
      <g fill="#C7DCEE">
        <rect x="395" y="175" width="10" height="10" />
        <rect x="415" y="175" width="10" height="10" />
        <rect x="395" y="195" width="10" height="10" />
        <rect x="575" y="185" width="10" height="10" />
        <rect x="595" y="185" width="10" height="10" />
        <rect x="1255" y="185" width="10" height="10" />
        <rect x="1275" y="185" width="10" height="10" />
        <rect x="1255" y="205" width="10" height="10" />
      </g>

      {/* CN Tower */}
      <g fill="#7FA5C4">
        <rect x="1042" y="128" width="12" height="172" />
        <path d="M1030 300h36l-6-96h-24z" opacity="0.35" />
        <ellipse cx="1048" cy="112" rx="26" ry="13" />
        <ellipse cx="1048" cy="106" rx="17" ry="7" fill="#6E97B8" />
        <rect x="1045" y="52" width="6" height="52" />
        <rect x="1046.5" y="24" width="3" height="30" />
      </g>
    </svg>
  );
}
