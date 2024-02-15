import * as fs from 'fs/promises';
import * as path from 'path';
import {posixToWin} from './utils/tools.js';

interface Show {
  name: string;
  videoFilepaths: string[];
  initalOrder: number;
  isEpisodic: boolean;
  weight: number;
}

const rootDir = '/mnt/m/TV/';

const showDefs: {
  name: string;
  isKids: boolean;
  isEpisodic: boolean;
}[] = [
//{name: 'Adventure Time Distant Lands',           isKids: true,  isEpisodic: false},
  {name: 'Adventure Time With Finn And Jake',      isKids: true,  isEpisodic: true },
  {name: 'Aqua Teen Hunger Force',                 isKids: false, isEpisodic: false},
  {name: 'Batman Beyond',                          isKids: true,  isEpisodic: true },
  {name: 'Batman The Animated Series',             isKids: true,  isEpisodic: true },
  {name: 'Bob\'s Burgers',                         isKids: false, isEpisodic: true },
  {name: 'Codename Kids Next Door',                isKids: true,  isEpisodic: false},
  {name: 'Courage the Cowardly Dog',               isKids: true,  isEpisodic: false},
  {name: 'Cowboy Bebop',                           isKids: false, isEpisodic: true },
  {name: 'Death Note',                             isKids: false, isEpisodic: true },
  {name: 'Ed, Edd n Eddy',                         isKids: true,  isEpisodic: false},
  {name: 'FLCL',                                   isKids: false, isEpisodic: true },
  {name: 'Ghost in the Shell',                     isKids: false, isEpisodic: true },
  {name: 'Grimm\'s Fairy Tales',                   isKids: true,  isEpisodic: false},
  {name: 'Gurren Lagann',                          isKids: false, isEpisodic: true },
  {name: 'Justice League (Series)' ,               isKids: true,  isEpisodic: true },
  {name: 'King of the Hill',                       isKids: false, isEpisodic: true },
  {name: 'Looney Tunes',                           isKids: true,  isEpisodic: false},
  {name: 'Metalocalypse',                          isKids: false, isEpisodic: false},
  {name: 'Moral Orel',                             isKids: false, isEpisodic: true },
  {name: 'Robot Chicken',                          isKids: false, isEpisodic: false},
  {name: 'Sailor Moon',                            isKids: true,  isEpisodic: true },
  {name: 'Samurai Jack',                           isKids: true,  isEpisodic: true },
  {name: 'Scooby-Doo Where Are You!' ,             isKids: true,  isEpisodic: false},
  {name: 'Squidbillies',                           isKids: false, isEpisodic: false},
  {name: 'Superman The Animated Series',           isKids: true,  isEpisodic: true },
  {name: 'Teen Titans',                            isKids: true,  isEpisodic: true },
  {name: 'The Boondocks',                          isKids: false, isEpisodic: true },
  {name: 'The Flintstones',                        isKids: true,  isEpisodic: false},
  {name: 'The Grim Adventures of Billy & Mandy',   isKids: true,  isEpisodic: false},
  {name: 'The Jetsons',                            isKids: true,  isEpisodic: false},
  {name: 'The Powerpuff Girls',                    isKids: true,  isEpisodic: true },
  {name: 'Tim and Eric Awesome Show, Great Job!' , isKids: false, isEpisodic: false},
  {name: 'Tom and Jerry',                          isKids: true,  isEpisodic: false},
  {name: 'Yogi Bear',                              isKids: true,  isEpisodic: false},
];

const isKidsFilter = false;

const shows: Show[] = [];

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
  console.log(posixToWin(show.videoFilepaths[videoIndex]));
  show.videoFilepaths.splice(videoIndex, 1);
  
  if (show.videoFilepaths.length === 0) {
    shows.splice(showIndex, 1);
    recalcWeights();
  }
}
