// (async () => {
//   let page = 0;
//   while (true) {
//     ++page;
//     console.error(`Page ${page}`);
//     const res = await fetch(`https://www.bumpworthy.com/api/filter_bumps?page=${page}&sort=dateadded&sortdir=Asc`);
//     if (!res.ok) {
//       console.error(res.status);
//       console.error(await res.text());
//       break;
//     }
//     const body = /** @type {{page: number; results: {id: number; name: string}[]}} */(await res.json());
//     if (body.results.length === 0) {
//       break;
//     }
    
//     process.stdout.write((JSON.stringify(body) + ',\n'));
//   }
//   console.error('Done');
// })()
// .catch(err => {
//   console.error(err);
//   process.exit(1);
// });

const all = require('../tmp/bumpworthyList.json');
for (let i = all.length; i > 0;) {
  const r = Math.floor(Math.random() * i);
  --i;
  const temp = all[i];
  all[i] = all[r];
  all[r] = temp;
}

require('fs').writeFileSync(
  './tmp/bumpworthyDL.ps1',
  all.map(x =>
    `Invoke-WebRequest 'https://www.bumpworthy.com/download/video/${x[0]}' -OutFile "M:\\Bumpers\\bumpworthy\\${x[0]} - ${makeFilenameFriendly(x[1]).replace(/[`"'$()%{}[\]]/g, s => '`'+s)}.mp4"`
  ).join('\n'),
  'utf8'
);

/** @param {string} str */
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
    .substring(0, 115)
    .replace(/[\s.]+$/, '')
    .replace(/^\s+/, '')
  );
}
