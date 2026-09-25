const fs = require('fs');
const file = 'frontend/src/app/(dashboard)/reports/page.tsx';
let data = fs.readFileSync(file, 'utf8');

// Replace html, body print CSS
data = data.replace(
  /html, body \{\s*display: block !important;\s*height: auto !important;\s*min-height: 0 !important;\s*overflow: visible !important;\s*background: white !important;\s*color: black !important;\s*font-family: var\(--font-geist-sans\), var\(--font-noto-devanagari\), 'Nirmala UI', sans-serif !important;\s*\}/g,
  `html, body {
              display: block !important;
              height: auto !important;
              min-height: 0 !important;
              width: 100% !important;
              min-width: 100% !important;
              margin: 0 !important;
              padding: 0 !important;
              overflow: visible !important;
              background: white !important;
              color: black !important;
              font-family: var(--font-geist-sans), var(--font-noto-devanagari), 'Nirmala UI', sans-serif !important;
            }`
);

fs.writeFileSync(file, data);
console.log('Fixed CSS in print layout.');
