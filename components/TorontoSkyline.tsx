// Illustrated Toronto skyline for the homepage hero. Inline SVG (same
// approach as the logo and category icons): no image request, crisp at every
// width, tinted to sit behind text without hurting contrast.
//
// Composition notes, learned from a bad first version: the strip renders with
// preserveAspectRatio "slice" inside a fixed-height band, so at very wide
// viewports the scene is cropped horizontally around the CENTER. Everything
// that must stay visible (the CN Tower, the dome) therefore lives near
// x=1000 of 2000, and the 2000-wide canvas with low buildings (≤170 of 220)
// keeps the scale modest — buildings read as a distant skyline, not blocks.

export function TorontoSkyline({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 2000 220"
      preserveAspectRatio="xMidYMax slice"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {/* Distant layer */}
      <g fill="#CBDFEF">
        <rect x="0" y="130" width="70" height="90" />
        <rect x="85" y="110" width="55" height="110" />
        <rect x="155" y="140" width="65" height="80" />
        <rect x="235" y="95" width="60" height="125" />
        <rect x="310" y="125" width="55" height="95" />
        <rect x="380" y="105" width="65" height="115" />
        <rect x="460" y="135" width="55" height="85" />
        <rect x="530" y="90" width="60" height="130" />
        <rect x="605" y="120" width="55" height="100" />
        <rect x="675" y="100" width="60" height="120" />
        <rect x="750" y="130" width="55" height="90" />
        <rect x="820" y="95" width="60" height="125" />
        <rect x="1120" y="100" width="60" height="120" />
        <rect x="1195" y="125" width="55" height="95" />
        <rect x="1265" y="90" width="65" height="130" />
        <rect x="1345" y="120" width="55" height="100" />
        <rect x="1415" y="105" width="60" height="115" />
        <rect x="1490" y="135" width="55" height="85" />
        <rect x="1560" y="95" width="65" height="125" />
        <rect x="1640" y="125" width="55" height="95" />
        <rect x="1710" y="110" width="60" height="110" />
        <rect x="1785" y="140" width="55" height="80" />
        <rect x="1855" y="115" width="60" height="105" />
        <rect x="1930" y="135" width="70" height="85" />
      </g>

      {/* Near layer */}
      <g fill="#ACC8DF">
        <rect x="40" y="160" width="75" height="60" />
        <rect x="130" y="175" width="65" height="45" />
        <rect x="215" y="150" width="70" height="70" />
        <rect x="300" y="170" width="60" height="50" />
        <rect x="375" y="145" width="70" height="75" />
        <rect x="460" y="168" width="62" height="52" />
        <rect x="540" y="152" width="68" height="68" />
        <rect x="625" y="172" width="60" height="48" />
        <rect x="700" y="148" width="70" height="72" />
        <rect x="785" y="165" width="64" height="55" />
        <rect x="862" y="150" width="66" height="70" />
        {/* Rogers Centre dome, just left of the tower */}
        <path d="M1092 220a64 46 0 0 0-128 0z" />
        <rect x="1130" y="158" width="66" height="62" />
        <rect x="1210" y="145" width="70" height="75" />
        <rect x="1295" y="168" width="62" height="52" />
        <rect x="1372" y="150" width="68" height="70" />
        <rect x="1455" y="172" width="60" height="48" />
        <rect x="1530" y="148" width="70" height="72" />
        <rect x="1615" y="165" width="64" height="55" />
        <rect x="1692" y="152" width="66" height="68" />
        <rect x="1773" y="170" width="60" height="50" />
        <rect x="1848" y="155" width="68" height="65" />
        <rect x="1930" y="172" width="70" height="48" />
      </g>

      {/* Window hints on a few near buildings */}
      <g fill="#CBDFEF">
        <rect x="390" y="158" width="8" height="8" />
        <rect x="406" y="158" width="8" height="8" />
        <rect x="390" y="174" width="8" height="8" />
        <rect x="715" y="160" width="8" height="8" />
        <rect x="731" y="160" width="8" height="8" />
        <rect x="1225" y="158" width="8" height="8" />
        <rect x="1241" y="158" width="8" height="8" />
        <rect x="1225" y="174" width="8" height="8" />
        <rect x="1545" y="160" width="8" height="8" />
        <rect x="1561" y="160" width="8" height="8" />
      </g>

      {/* CN Tower — centred so no viewport crop can cut it off */}
      <g fill="#84A9C7">
        <rect x="995" y="88" width="10" height="132" />
        <path d="M985 220h30l-5-70h-20z" opacity="0.35" />
        <ellipse cx="1000" cy="76" rx="21" ry="10" />
        <ellipse cx="1000" cy="71" rx="13" ry="5.5" fill="#739CBD" />
        <rect x="997.5" y="34" width="5" height="38" />
        <rect x="999" y="12" width="2.5" height="24" />
      </g>
    </svg>
  );
}
