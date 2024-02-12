const fs = require('fs');
const path = require('path');

const dirInput = process.argv[2];
if (!dirInput) {
  console.error(`Usage: node compareNfoNames.js dir && git diff --color-words=. --no-index -U0 /tmp/orig /tmp/expected | grep '^Season'`);
  process.exit(1);
}
const dir = path.resolve(dirInput);

const folderNames = (
  fs.readdirSync(dir, {withFileTypes: true})
  .filter(x => x.isDirectory)
  .map(x => x.name)
);

const results = folderNames.map(folderName => {
  const nfoStr = fs.readFileSync(
    path.join(dir, folderName, folderName + '.nfo'),
    'utf8'
  );
  
  const titleMatch = /<title>([^<]+)<\/title>/.exec(nfoStr);
  const yearMatch = /<year>(\d+)<\/year>/.exec(nfoStr);
  
  if (!titleMatch) return [folderName, 'Error: Unable to extract title.'];
  if (!yearMatch) return [folderName, 'Error: Unable to extract year.'];
  
  const title = titleMatch[1].replaceAll('&amp;', '&');
  const yearStr = yearMatch[1];
  
  const expectedName = makeFilenameFriendly(title) + ` (${yearStr})`;
  return [folderName, expectedName];
});

fs.writeFileSync('/tmp/orig', results.map(x => x[0]).join('\n'), 'utf8');
fs.writeFileSync('/tmp/expected', results.map(x => x[1]).join('\n'), 'utf8');

function makeFilenameFriendly(str) {
  return (
    str
    .normalize('NFKD')
    .replace(/[’`]/g, `'`)
    .replace(/\s*[|:]\s*/g, ' - ')
    .replace(/[–]/g, '-')
    .replace(/[/]/g, '-')
    .replace(/[<>:"/\\|?*]+/g, '')
    .replace(/[^ -~]+/g, '')
    .replace(/[\s.]+$/, '')
    .replace(/^\s+/, '')
  );
}
