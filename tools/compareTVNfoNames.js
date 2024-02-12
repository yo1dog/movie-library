const fs = require('fs');
const path = require('path');

const dirInput = process.argv[2];
if (!dirInput) {
  console.error(`Usage: node compareNfoNames.js dir && git diff --color-words=. --no-index -U0 /tmp/orig /tmp/expected | grep '^Season'`);
  process.exit(1);
}
const dir = path.resolve(dirInput);

const nfos = [];
const filenames = fs.readdirSync(dir);
for (const filename of filenames) {
  if (filename.startsWith('Season ')) {
    const seasonDir = filename;
    const filenames = fs.readdirSync(path.join(dir, seasonDir));
    for (const filename of filenames) {
      if (filename.endsWith('.nfo')) {
        nfos.push({
          filepath: path.join(dir, seasonDir, filename),
          name: seasonDir + '/' + path.basename(filename).slice(0, -4)
        });
      }
    }
  }
}

const results = nfos.map(nfo => {
  const nfoStr = fs.readFileSync(nfo.filepath, 'utf8');
  const seasonMatch = /<season>(\d+)<\/season>/.exec(nfoStr);
  const episodeMatches = Array.from(nfoStr.matchAll(/<episode>(\d+)<\/episode>/g));
  const titleMatches = Array.from(nfoStr.matchAll(/<title>([^<]+)<\/title>/g));
  
  if (!seasonMatch) return [nfo.name, 'Error: Unable to extract season.'];
  if (episodeMatches.length === 0) return [nfo.name, 'Error: Unable to extract episode.'];
  if (titleMatches.length === 0) return [nfo.name, 'Error: Unable to extract title.'];
  
  const season = seasonMatch[1];
  const episodes = episodeMatches.map(x => x[1]);
  const titles = titleMatches.map(x => x[1].replaceAll('&amp;', '&'));
  
  const expectedName = (
    `Season ${season.padStart(2, '0')}/` +
    `S${season.padStart(2, '0')}` +
    episodes.map(episode => `E${episode.padStart(2, '0')}`).join('') +
    ' - ' +
    titles.map(title => makeFilenameFriendly(title)).join(' - ')
  );
  return [nfo.name, expectedName];
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
