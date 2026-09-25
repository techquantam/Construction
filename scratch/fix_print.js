const fs = require('fs');
const file = 'frontend/src/app/(dashboard)/reports/page.tsx';
let data = fs.readFileSync(file, 'utf8');

// Remove the blank page HTML chunks
data = data.replace(/<div className="print-page print-blank-page">[\s\S]*?<\/div>\s*<\/div>/g, '');

// Remove the CSS class definition
data = data.replace(/\.print-blank-page\s*{[^}]*}/g, '');

fs.writeFileSync(file, data);
console.log('Fixed blank pages in print layout.');
