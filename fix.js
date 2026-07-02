const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

// Normalize CRLF to LF
content = content.replace(/\r\n/g, '\n');

// Find the index of the corrupted button
const corruptStartAnchor = 'onClick={() => setSaleStockType("old")}\n                          </div>';
const startIndex = content.indexOf(corruptStartAnchor);

if (startIndex === -1) {
  console.error("Error: Could not find corruptStartAnchor!");
  process.exit(1);
}

// Find the start of the button tag containing the corrupt anchor
const buttonStartIndex = content.lastIndexOf('<button', startIndex);
if (buttonStartIndex === -1) {
  console.error("Error: Could not find <button preceding corruptStartAnchor!");
  process.exit(1);
}

// Find the end anchor: the closing tag of the second auto button
const endAnchor = '({totalS} {language === "kh" ? "គ្រឿង" : "pcs"})</span>\n                              </button>';
const endIndex = content.indexOf(endAnchor, startIndex);

if (endIndex === -1) {
  console.error("Error: Could not find endAnchor!");
  process.exit(1);
}

const finalReplaceEnd = endIndex + endAnchor.length;

// Remove the entire range from buttonStartIndex to finalReplaceEnd
const fixedContent = content.substring(0, buttonStartIndex) + content.substring(finalReplaceEnd);

fs.writeFileSync('src/App.tsx', fixedContent, 'utf8');
console.log("Successfully cleaned up the corrupted block in App.tsx!");
