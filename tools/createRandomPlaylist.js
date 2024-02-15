const fs = require('fs/promises');
const path = require('path');

/**
 * @typedef ShowDef
 * @property {string} name
 * @property {boolean} isKids
 * @property {boolean} isEpisodic
 */
/**
 * @typedef Show
 * @property {string} name
 * @property {string[]} videoFilepaths
 * @property {number} initalOrder
 * @property {boolean} isEpisodic
 * @property {number} weight
 */

const rootDir = '/mnt/m/TV/';
const kidsBumperDir = '/mnt/m/Bumpers/CN City Bumpers';
const adultBumperDir = '/mnt/m/Bumpers/Ambient Swim Bumpers';

/** @type {ShowDef[]} */
const showDefs = [
//{name: 'Adventure Time Distant Lands',             isKids: true,  isEpisodic: false},
  {name: 'Adventure Time With Finn And Jake',        isKids: true,  isEpisodic: true },
  {name: 'Aqua Teen Hunger Force',                   isKids: false, isEpisodic: false},
  {name: 'Batman Beyond',                            isKids: true,  isEpisodic: true },
  {name: 'Batman The Animated Series',               isKids: true,  isEpisodic: true },
  {name: 'Bob\'s Burgers',                           isKids: false, isEpisodic: true },
  {name: 'Codename Kids Next Door',                  isKids: true,  isEpisodic: false},
  {name: 'Courage the Cowardly Dog',                 isKids: true,  isEpisodic: false},
  {name: 'Cowboy Bebop',                             isKids: false, isEpisodic: true },
  {name: 'Death Note',                               isKids: false, isEpisodic: true },
  {name: 'Ed, Edd n Eddy',                           isKids: true,  isEpisodic: false},
  {name: 'FLCL',                                     isKids: false, isEpisodic: true },
  {name: 'Ghost in the Shell - Stand Alone Complex', isKids: false, isEpisodic: true },
  {name: 'Grimm\'s Fairy Tales',                     isKids: true,  isEpisodic: false},
  {name: 'Gurren Lagann',                            isKids: false, isEpisodic: true },
  {name: 'Justice League (Series)' ,                 isKids: true,  isEpisodic: true },
  {name: 'King of the Hill',                         isKids: false, isEpisodic: true },
  {name: 'Looney Tunes',                             isKids: true,  isEpisodic: false},
  {name: 'Metalocalypse',                            isKids: false, isEpisodic: false},
  {name: 'Robot Chicken',                            isKids: false, isEpisodic: false},
  {name: 'Sailor Moon',                              isKids: true,  isEpisodic: true },
  {name: 'Samurai Jack',                             isKids: true,  isEpisodic: true },
  {name: 'Scooby-Doo Where Are You!' ,               isKids: true,  isEpisodic: false},
  {name: 'Squidbillies',                             isKids: false, isEpisodic: false},
  {name: 'Superman The Animated Series',             isKids: true,  isEpisodic: true },
  {name: 'Teen Titans',                              isKids: true,  isEpisodic: true },
  {name: 'The Boondocks',                            isKids: false, isEpisodic: true },
  {name: 'The Flintstones',                          isKids: true,  isEpisodic: false},
  {name: 'The Grim Adventures of Billy & Mandy',     isKids: true,  isEpisodic: false},
  {name: 'The Jetsons',                              isKids: true,  isEpisodic: false},
  {name: 'The Powerpuff Girls',                      isKids: true,  isEpisodic: true },
  {name: 'Tim and Eric Awesome Show, Great Job!' ,   isKids: false, isEpisodic: false},
  {name: 'Tom and Jerry',                            isKids: true,  isEpisodic: false},
  {name: 'Yogi Bear',                                isKids: true,  isEpisodic: false},
];

const isKidsFilter = false;

(async () => {

const bumperDir = isKidsFilter? kidsBumperDir : adultBumperDir;
const bumperFilepaths = (
  (await fs.readdir(bumperDir, {withFileTypes: true}))
  .filter(x => x.isFile && (x.name.endsWith('.mp4') || x.name.endsWith('.mkv')))
  .map(x => path.join(bumperDir, x.name))
);
for (let i = bumperFilepaths.length; i > 0;) {
  const r = Math.floor(Math.random() * i);
  --i;
  const temp = bumperFilepaths[i];
  bumperFilepaths[i] = bumperFilepaths[r];
  bumperFilepaths[r] = temp;
}

/** @type {Show[]} */
const shows = [];

for (const showDef of showDefs) {
  if (showDef.isKids !== isKidsFilter) continue;
  const showDir = path.join(rootDir, showDef.name);
  
  const filepaths = [];
  const dirents = await fs.readdir(showDir, {withFileTypes: true});
  for (const dirent of dirents) {
    if (dirent.isFile()) {
      filepaths.push(path.join(showDir, dirent.name));
    }
    else if (dirent.isDirectory()) {
      const seasonDir = path.join(showDir, dirent.name);
      const dirents = await fs.readdir(seasonDir, {withFileTypes: true});
      for (const dirent of dirents) {
        if (!dirent.isFile()) continue;
        if (!dirent.name.endsWith('.mp4') && !dirent.name.endsWith('.mkv')) continue;
        if (dirent.name.startsWith('temp')) continue;
        filepaths.push(path.join(seasonDir, dirent.name));
      }
    }
  }
  
  const videoFilepaths = (
    filepaths
    .filter(x => x.endsWith('.mp4') || x.endsWith('.mkv'))
    .sort()
  );
  if (videoFilepaths.length === 0) {
    continue;
  }
  
  shows.push({
    name: showDef.name,
    isEpisodic: showDef.isEpisodic,
    initalOrder: Math.random(),
    videoFilepaths,
    weight: 0,
  });
}

let totalNumVideos = 0;
for (const show of shows) {
  totalNumVideos += show.videoFilepaths.length;
  console.error(`${show.name}:`, show.videoFilepaths.length);
}
console.error('Total:', totalNumVideos);

shows.sort((a, b) => a.initalOrder - b.initalOrder);

function resetWeights() {
  for (const show of shows) show.weight = 1/shows.length;
}
function recalcWeights() {
  let totalWeight = 0;
  for (const show of shows) totalWeight += show.weight;
  for (const show of shows) show.weight = show.weight/totalWeight;
}

resetWeights();
const shrinkFactor = 0.15;

let bumperIndex = 0;
while (shows.length > 0) {
  const rand = Math.random();
  
  let offset = 0;
  let totalWeight = 0;
  let i;
  for (i = 0; i < shows.length - 1; ++i) {
    offset += shows[i].weight;
    if (rand < offset) break;
    totalWeight = offset; 
  }
  
  // Reduce chosen show's weight.
  shows[i].weight *= shrinkFactor;
  const showIndex = i;
  
  // Redistribute weight.
  while (i < shows.length) {
    totalWeight += shows[i].weight;
    ++i;
  }
  for (let j = 0; j < shows.length; ++j) {
    shows[j].weight = shows[j].weight / totalWeight;
  }
  
  const show = shows[showIndex];
  
  // Pick a video from the show.
  const videoIndex = show.isEpisodic? 0 : Math.floor(Math.random() * show.videoFilepaths.length);
  const videoFilepath = show.videoFilepaths[videoIndex];
  show.videoFilepaths.splice(videoIndex, 1);
  
  const bumperFilepath = bumperFilepaths[bumperIndex];
  bumperIndex = (bumperIndex + 1) % bumperFilepaths.length;
  
  console.log(posixToWin(bumperFilepath));
  console.log(posixToWin(videoFilepath));
  
  if (show.videoFilepaths.length === 0) {
    shows.splice(showIndex, 1);
    recalcWeights();
  }
}

})()
.catch(err => {
  console.error(err);
  process.exit(1);
});


/** @param {string} posix */
function posixToWin(posix) {
  return posix.replace(/^\/mnt\/(.)\//, (_,/**@type {string} */x) => x.toUpperCase() + ':\\').replaceAll('/', '\\');
}
