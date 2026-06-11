// scripts/generate-icons.js
// Run once: node scripts/generate-icons.js
// Requires: npm install --save-dev sharp
const sharp = require('sharp');
const path  = require('path');

const ASSETS = path.join(__dirname, '..', 'assets');

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"   stop-color="#130c24"/>
      <stop offset="28%"  stop-color="#261450"/>
      <stop offset="58%"  stop-color="#7a2a5a"/>
      <stop offset="76%"  stop-color="#c0502e"/>
      <stop offset="90%"  stop-color="#e87c2e"/>
      <stop offset="100%" stop-color="#f5a020"/>
    </linearGradient>
    <linearGradient id="sea" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"   stop-color="#163850"/>
      <stop offset="100%" stop-color="#0a1624"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="63%" r="42%">
      <stop offset="0%"   stop-color="#f5b040" stop-opacity="0.65"/>
      <stop offset="55%"  stop-color="#e87030" stop-opacity="0.28"/>
      <stop offset="100%" stop-color="#e87030" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <!-- Sky -->
  <rect width="1024" height="1024" fill="url(#sky)"/>
  <!-- Horizon glow -->
  <rect width="1024" height="1024" fill="url(#glow)"/>
  <!-- Sea -->
  <rect y="645" width="1024" height="379" fill="url(#sea)"/>

  <!-- Sun (upper half visible above horizon) -->
  <circle cx="512" cy="645" r="96" fill="#f9c830"/>
  <!-- Cover lower half of sun with sea color -->
  <rect x="406" y="645" width="212" height="100" fill="#163850"/>

  <!-- Sun reflection on water -->
  <ellipse cx="512" cy="678" rx="68" ry="13" fill="#f9c830" opacity="0.22"/>
  <ellipse cx="512" cy="706" rx="44" ry="8"  fill="#f9c830" opacity="0.13"/>

  <!-- Island silhouette -->
  <ellipse cx="512" cy="650" rx="230" ry="32" fill="#0e1a0e"/>

  <!-- Palm trunk (gently curved) -->
  <path d="M 500 650 C 504 614 509 580 514 556 C 517 543 520 532 523 520"
        stroke="#0b1307" stroke-width="19" fill="none" stroke-linecap="round"/>

  <!-- Palm fronds -->
  <path d="M 521 524 C 498 506 470 508 449 519 C 466 524 489 530 511 539" fill="#0c2a0c"/>
  <path d="M 525 526 C 550 508 575 510 591 523 C 573 527 549 533 525 541" fill="#0c2a0c"/>
  <path d="M 521 522 C 511 496 498 469 490 447 C 502 465 515 491 523 517" fill="#0c2a0c"/>
  <path d="M 525 522 C 540 496 554 471 568 451 C 553 469 537 493 525 519" fill="#0c2a0c"/>
  <path d="M 518 527 C 486 516 457 527 440 545 C 458 539 487 535 514 540" fill="#0a200a"/>
  <path d="M 527 529 C 559 518 587 529 604 548 C 586 541 557 537 528 542" fill="#0a200a"/>

  <!-- Crescent moon -->
  <circle cx="790" cy="118" r="34" fill="#f2e8c0"/>
  <circle cx="806" cy="108" r="28" fill="#2a1450"/>

  <!-- Stars -->
  <circle cx="200" cy="130" r="4"   fill="#f0e8d0" opacity="0.90"/>
  <circle cx="340" cy="78"  r="3"   fill="#f0e8d0" opacity="0.75"/>
  <circle cx="700" cy="98"  r="4"   fill="#f0e8d0" opacity="0.85"/>
  <circle cx="840" cy="172" r="3"   fill="#f0e8d0" opacity="0.70"/>
  <circle cx="148" cy="242" r="2.5" fill="#f0e8d0" opacity="0.60"/>
  <circle cx="870" cy="68"  r="3"   fill="#f0e8d0" opacity="0.65"/>
  <circle cx="460" cy="54"  r="2"   fill="#f0e8d0" opacity="0.50"/>
  <circle cx="620" cy="165" r="2"   fill="#f0e8d0" opacity="0.45"/>
</svg>`;

async function main() {
  const buf = Buffer.from(SVG);

  await sharp(buf).png().toFile(`${ASSETS}/icon.png`);
  console.log('✓ assets/icon.png (1024×1024)');

  await sharp(buf).png().toFile(`${ASSETS}/adaptive-icon.png`);
  console.log('✓ assets/adaptive-icon.png (1024×1024)');

  await sharp(buf).resize(512, 512).png().toFile(`${ASSETS}/splash-icon.png`);
  console.log('✓ assets/splash-icon.png (512×512)');

  await sharp(buf).resize(48, 48).png().toFile(`${ASSETS}/favicon.png`);
  console.log('✓ assets/favicon.png (48×48)');

  console.log('\nAll icons generated.');
}

main().catch(err => { console.error(err); process.exit(1); });
