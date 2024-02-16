const fs = require('fs/promises');
const path = require('path');

/**
 * @typedef BumperConfigDef
 * @property {string} dir
 * @property {number} min
 * @property {number} max
 */
/**
 * @typedef BumperConfig
 * @property {number} min
 * @property {number} max
 * @property {number} index
 * @property {string[]} filepaths
 */
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
/** @type {BumperConfigDef[]} */
const kidsBumperConfigDefs = [
  {dir: '/mnt/m/Bumpers/CN City Bumpers', min: 1, max: 1},
];
/** @type {BumperConfigDef[]} */
const adultBumperConfigDefs = [
  {dir: '/mnt/m/Bumpers/bumpworthy', min: 1, max: 3},
  {dir: '/mnt/m/Bumpers/Ambient Swim Bumpers', min: 1, max: 1},
];

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

/** @type {import('./ffprobe').FFprobeProbeResult[]} */
const ffprobes = JSON.parse(await fs.readFile('/mnt/m/metadata/ffprobes.json', 'utf8'));
/** @param {string} dir */
function getVideoFilepaths(dir) {
  const prefix = dir + '/';
  const filepaths = [];
  for (const ffprobe of ffprobes) {
    if (ffprobe.format?.filename.startsWith(prefix)) {
      filepaths.push(ffprobe.format.filename);
    }
  }
  return filepaths;
}

// const videoFilepathCacheFilepath = path.join(__dirname, '..', 'tmp', 'videoFilepathCache.json');
// /** @type {Record<string, string[]>} */
// let videoFilepathCache;
// try {
//   videoFilepathCache = JSON.parse(await fs.readFile(videoFilepathCacheFilepath, 'utf8'));
// } catch (err) {/*noop*/}

// /** @param {string} dir */
// async function getVideoFilepaths(dir) {
//   if (videoFilepathCache[dir]) {
//     return videoFilepathCache[dir];
//   }
  
//   const filepaths = [];
//   const dirents = await fs.readdir(dir, {withFileTypes: true});
//   for (const dirent of dirents) {
//     if (dirent.isFile()) {
//       if (!dirent.name.endsWith('.mp4')) continue;
//       if (!dirent.name.endsWith('.mkv')) continue;
//       if (!dirent.name.endsWith('.api')) continue;
//       filepaths.push(path.join(dir, dirent.name));
//     }
//     else if (dirent.isDirectory()) {
//       const subDir = path.join(dir, dirent.name);
//       const dirents = await fs.readdir(subDir, {withFileTypes: true});
//       for (const dirent of dirents) {
//         if (!dirent.isFile()) continue;
//         if (!dirent.name.endsWith('.mp4')) continue;
//         if (!dirent.name.endsWith('.mkv')) continue;
//         if (!dirent.name.endsWith('.api')) continue;
//         filepaths.push(path.join(subDir, dirent.name));
//       }
//     }
//   }
  
//   videoFilepathCache[dir] = filepaths;
//   await fs.writeFile(videoFilepathCacheFilepath, JSON.stringify(videoFilepathCache), 'utf8');
//   return filepaths;
// }

const bumperConfigDefs = isKidsFilter? kidsBumperConfigDefs : adultBumperConfigDefs;
/** @type {BumperConfig[]} */
const bumperConfigs = [];
for (const bumperConfigDef of bumperConfigDefs) {
  const {dir, min, max} = bumperConfigDef;
  const filepaths = getVideoFilepaths(dir);
  
  bumperConfigs.push({
    min,
    max,
    index: 0,
    filepaths,
  });
}

/** @type {Show[]} */
const shows = [];

for (const showDef of showDefs) {
  if (showDef.isKids !== isKidsFilter) continue;
  const showDir = path.join(rootDir, showDef.name);
  
  const videoFilepaths = getVideoFilepaths(showDir);
  if (videoFilepaths.length === 0) {
    continue;
  }
  
  videoFilepaths.sort();
  
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
  
  for (const bumperConfig of bumperConfigs) {
    const count = bumperConfig.min + Math.floor(Math.random() * (1 + bumperConfig.max - bumperConfig.min));
    for (let i = 0; i < count; ++i) {
      if (bumperConfig.index === 0) {
        fisherYatesShuffle(bumperConfig.filepaths);
      }
      
      const filepath = bumperConfig.filepaths[bumperConfig.index];
      bumperConfig.index = (bumperConfig.index + 1) % bumperConfig.filepaths.length;
      console.log(posixToWin(filepath));
    }
  }
  
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

/**
 * @template T
 * @param {T[]} arr
 */
function fisherYatesShuffle(arr) {
  for (let i = arr.length; i > 0;) {
    const r = Math.floor(Math.random() * i);
    --i;
    const temp = arr[i];
    arr[i] = arr[r];
    arr[r] = temp;
  }
  return arr;
}
