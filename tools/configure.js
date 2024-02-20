const fs = require('fs');
const path = require('path');
const {XMLParser} = require('fast-xml-parser');

const enableGridNavWrap = false;
const enableMouseAtStart = false;

/**
 * @typedef {{_text?: string; _attr?: Record<string, string>;} & {[key: string]: XMLNode[] | undefined}} XMLNode
 */

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  allowBooleanAttributes: true,
  alwaysCreateTextNode: true,
  isArray: () => true,
  textNodeName: '_text',
  attributesGroupName: '_attr',
  attributeNamePrefix: '',
});

/** @typedef {import('../src/assets/types').Config} Config */
/** @typedef {import('../src/assets/types').Movie} Movie */
/** @typedef {import('../src/assets/types').TVShow} TVShow */
/** @typedef {import('../src/assets/types').Episode} Episode */

createConfig();
function createConfig() {
  /** @type {Movie[]} */
  const movies = [];
  const movieNFOMatches = traverseDir('/mnt/m/Movies/', 2, dirent => dirent.name.endsWith('.nfo'));
  
  console.log(`${movieNFOMatches.length} movie NFO files.`);
  
  for (let i = 0; i < movieNFOMatches.length; ++i) {
    const match = movieNFOMatches[i];
    console.log(`${i+1}/${movieNFOMatches.length} - ${path.basename(match.dir)}`);
    const movie = loadMovie(match.dirent, match.dir, match.siblingDirents);
    if (movie) movies.push(movie);
  }
  
  console.log(`${movies.length} movies`);
  
  /** @type {TVShow[]} */
  const tvShows = [];
  const tvShowNFOMatches = traverseDir('/mnt/m/TV/', 2, dirent => dirent.name.endsWith('.nfo'));
  
  console.log(`${tvShowNFOMatches.length} TV Show NFO files.`);
  
  for (let i = 0; i < tvShowNFOMatches.length; ++i) {
    const match = tvShowNFOMatches[i];
    console.log(`${i+1}/${tvShowNFOMatches.length} - ${path.basename(match.dir)}`);
    const tvShow = loadTVShow(match.dirent, match.dir, match.siblingDirents);
    if (tvShow) tvShows.push(tvShow);
  }
  
  console.log(`${tvShows.length} TV Shows`);
  
  /** @typedef {Config} */
  const config = {
    enableGridNavWrap,
    enableMouseAtStart,
    movies,
    tvShows,
  };
  const configJSON = JSON.stringify(config, (key, val) => !val || (Array.isArray(val) && val.length === 0)? undefined : val);
  const configJS = 'window.movieLibraryConfig = ' + configJSON + ';';
  fs.writeFileSync(path.join(__dirname, '..', 'src', 'config.js'), configJS, 'utf8');
}

/**
 * @param {fs.Dirent} nfoDirent 
 * @param {string} dir 
 * @param {fs.Dirent[]} dirents 
 * @returns {Movie | undefined} 
 */
function loadMovie(nfoDirent, dir, dirents) {
  const nfoFilepath = path.join(dir, nfoDirent.name);
  const baseFilename = path.basename(nfoDirent.name, path.extname(nfoDirent.name));
  
  /** @type {XMLNode} */
  const xml = xmlParser.parse(fs.readFileSync(nfoFilepath));
  const node = xml.movie?.[0];
  if (!node) {
    console.log(`Unable to find movie XML node for: ${nfoFilepath}`);
    return;
  }
  
  const videoFile = dirents.find(dirent =>
    path.basename(dirent.name, path.extname(dirent.name)) === baseFilename
  );
  if (!videoFile) {
    console.log(`Unable to find video file for: ${nfoFilepath}`);
    return;
  }
  
  const title = node.title?.[0]._text || baseFilename;
  const setName = node.set?.[0]._text || '';
  /** @type {Movie} */
  const movie = {
    id: (
      node.uniqueid?.find(x => x._attr?.type === 'tvdb') ||
      node.uniqueid?.find(x => x._attr?.type === 'imdb') ||
      node.uniqueid?.[0]
    )?._text || nfoFilepath,
    title,
    titleSortStr: genSortStr(title),
    setName,
    setNameSortStr: setName && genSortStr(setName),
    year: node.year?.[0]._text || '',
    premiereDateISOStr: node.premiered?.[0]._text || '',
    plot: node.plot?.[0]._text || '',
    tagline: node.tagline?.[0]._text || '',
    rating: node.mpaa?.[0]._text || '',
    runtimeMinutes: parseInt(node.runtime?.[0]._text || '', 10),
    genres: filterFalsey(node.genre?.map(x => x._text)).slice(0, 10) || [],
    directorNames: filterFalsey(node.director?.map(x => x._text)).slice(0, 10) || [],
    actorNames: filterFalsey(node.credits?.map(x => x._text)).slice(0, 10) || [],
    studioNames: filterFalsey(node.studio?.map(x => x._text)).slice(0, 10) || [],
    hasSubtitles: (node.fileinfo?.[0]?.streamdetails?.[0]?.subtitle?.length || 0) > 0,
    thumbURL: buildFileURL(dir, dirents.find(x => x.name === `${baseFilename}-landscape.jpg`)),
    logoURL: buildFileURL(dir, dirents.find(x => x.name === `${baseFilename}-clearlogo.png`)),
    keyartURL: buildFileURL(dir, dirents.find(x => x.name === `${baseFilename}-keyart.jpg`)),
    videoFilepath: path.join(dir, videoFile.name),
  };
  return movie;
}

/**
 * @param {fs.Dirent} nfoDirent 
 * @param {string} dir 
 * @param {fs.Dirent[]} dirents 
 * @returns {TVShow | undefined} 
 */
function loadTVShow(nfoDirent, dir, dirents) {
  const nfoFilepath = path.join(dir, nfoDirent.name);
  
  /** @type {XMLNode} */
  const xml = xmlParser.parse(fs.readFileSync(nfoFilepath));
  const node = xml.tvshow?.[0];
  if (!node) {
    console.log(`Unable to find tvshow XML node for: ${nfoFilepath}`);
    return;
  }
  
  const title = node.title?.[0]._text || path.dirname(dir);
  /** @type {TVShow} */
  const tvShow = {
    id: (
      node.uniqueid?.find(x => x._attr?.type === 'tvdb') ||
      node.uniqueid?.find(x => x._attr?.type === 'imdb') ||
      node.uniqueid?.[0]
    )?._text || nfoFilepath,
    title,
    titleSortStr: genSortStr(title),
    episodeOrderingType: node.sortorder?.[0]._text === 'dvd'? 'dvd' : 'default',
    year: node.year?.[0]._text || '',
    premiereDateISOStr: node.premiered?.[0]._text || '',
    plot: node.plot?.[0]._text || '',
    rating: node.mpaa?.[0]._text || '',
    runtimeMinutes: parseInt(node.runtime?.[0]._text || '', 10),
    genres: filterFalsey(node.genre?.map(x => x._text)).slice(0, 10) || [],
    actorNames: filterFalsey(node.credits?.map(x => x._text)).slice(0, 10) || [],
    studioNames: filterFalsey(node.studio?.map(x => x._text)).slice(0, 10) || [],
    thumbURL: buildFileURL(dir, dirents.find(x => x.name === `landscape.jpg`)),
    logoURL: buildFileURL(dir, dirents.find(x => x.name === `clearlogo.png`)),
    posterURL: buildFileURL(dir, dirents.find(x => x.name === `poster.jpg`)),
    seasons: [],
  };
  
  const episodeNFOMatches = traverseDir(dir, 1, (dirent, depth) => (depth > 0 || dirent.name !== 'tvshow.nfo') && dirent.name.endsWith('.nfo'));
  
  for (const episodeNFOMatch of episodeNFOMatches) {
    const nfoDirent = episodeNFOMatch.dirent;
    const dir = episodeNFOMatch.dir;
    const dirents = episodeNFOMatch.siblingDirents;
    
    const nfoFilepath = path.join(dir, nfoDirent.name);
    const baseFilename = path.basename(nfoDirent.name, path.extname(nfoDirent.name));
    
    /** @type {XMLNode} */
    const xml = xmlParser.parse(fs.readFileSync(nfoFilepath));
    const nodes = (xml.episodedetails || []).concat(xml.multiepisodenfo?.[0].episodedetails || []);
    if (!nodes.length) {
      console.log(`Unable to find episodedetails XML node for: ${nfoFilepath}`);
      return;
    }
    
    const videoFile = dirents.find(dirent =>
      path.basename(dirent.name, path.extname(dirent.name)) === baseFilename
    );
    if (!videoFile) {
      console.log(`Unable to find video file for: ${nfoFilepath}`);
      return;
    }
    
    /** @type {Omit<Episode, 'episodeOrd' | 'thumbURL' | 'videoFilepath'>[]} */
    const partialEpisodes = [];
    for (const node of nodes) {
      partialEpisodes.push({
        id: (
          node.uniqueid?.find(x => x._attr?.type === 'tvdb') ||
          node.uniqueid?.find(x => x._attr?.type === 'imdb') ||
          node.uniqueid?.[0]
        )?._text || nfoFilepath,
        title: node.title?.[0]._text || baseFilename,
        seasonNumber: parseInt(node.season?.[0]._text || '', 10) || 0,
        episodeNumber: parseInt(node.episode?.[0]._text || '', 10) || 0,
        dvdEpisodeNumber: parseInt(node.dvdepnumber?.[0]._text || '', 10) || 0,
        specialSeasonNumber: parseInt(node.displayseason?.[0]._text || '', 10) || 0,
        specialEpisodeNumber: parseInt(node.displayepisode?.[0]._text || '', 10) || 0,
        specialAfterSeasonNumber: parseInt(node.displayafterseason?.[0]._text || '', 10) || 0,
        airedDateISOStr: node.aired?.[0]._text || '',
        year: node.year?.[0]._text || '',
        plot: node.plot?.[0]._text || '',
        runtimeMinutes: parseInt(node.runtime?.[0]._text || '', 10),
        directorNames: filterFalsey(node.director?.map(x => x._text)).slice(0, 10) || [],
        actorNames: filterFalsey(node.credits?.map(x => x._text)).slice(0, 10) || [],
      });
    }
    
    const thumbURL = buildFileURL(dir, dirents.find(x => x.name === `${baseFilename}-thumb.jpg`));
    const videoFilepath = path.join(dir, videoFile.name);
    
    /** @type {Episode} */
    let episode;
    if (partialEpisodes.length === 1) {
      episode = {
        ...partialEpisodes[0],
        episodeOrd: 0,
        thumbURL,
        videoFilepath
      };
    }
    else {
      episode = {
        id: partialEpisodes.map(x => x.id).join('/'),
        title: partialEpisodes.map(x => x.title).join(' / '),
        seasonNumber: partialEpisodes[0].seasonNumber,
        episodeNumber: partialEpisodes[0].episodeNumber,
        dvdEpisodeNumber: partialEpisodes[0].dvdEpisodeNumber,
        specialSeasonNumber: partialEpisodes[0].specialSeasonNumber,
        specialEpisodeNumber: partialEpisodes[0].specialEpisodeNumber,
        specialAfterSeasonNumber: partialEpisodes[0].specialAfterSeasonNumber,
        episodeOrd: 0,
        airedDateISOStr: partialEpisodes[0].airedDateISOStr,
        year: partialEpisodes[0].year,
        plot: partialEpisodes.map(x => `S${x.seasonNumber}.E${x.episodeNumber} ${x.title}:\n${x.plot}`).join('\n\n'),
        runtimeMinutes: partialEpisodes.map(x => x.runtimeMinutes).reduce((sum, x) => sum + x),
        directorNames: partialEpisodes.map(x => x.directorNames).reduce((arr, x) => arr.concat(x)).filter((x, i, a) => a.indexOf(x) === i),
        actorNames: partialEpisodes.map(x => x.actorNames).reduce((arr, x) => arr.concat(x)).filter((x, i, a) => a.indexOf(x) === i),
        thumbURL,
        videoFilepath,
      };
    }
    
    const seasonNum = episode.seasonNumber;
    const episodeNum = episode.episodeNumber;
    const dvdEpisodeNum = episode.dvdEpisodeNumber;
    const airAfterSeasonNum = episode.specialAfterSeasonNumber;
    const airBeforeSeasonNum = episode.specialSeasonNumber;
    const airBeforeEpisodeNum = episode.specialEpisodeNumber;
    
    const seasonOrdNum = (
      tvShow.episodeOrderingType === 'dvd'? seasonNum :
      airAfterSeasonNum? airAfterSeasonNum + 0.5 :
      airBeforeSeasonNum? (airBeforeEpisodeNum <= 1? airBeforeSeasonNum - 0.5 : airBeforeSeasonNum) :
      seasonNum
    );
    const episodeOrd = (
      tvShow.episodeOrderingType === 'dvd'? dvdEpisodeNum :
      airBeforeEpisodeNum
      ? (airBeforeEpisodeNum - 1) * 1000 + episodeNum
      : episodeNum * 1000
    );
    episode.episodeOrd = episodeOrd;
    
    let season = tvShow.seasons.find(x => x.seasonNumber === seasonOrdNum);
    if (!season) {
      season = {
        seasonNumber: seasonOrdNum,
        episodes: [],
      };
      tvShow.seasons.push(season);
    }
    season.episodes.push(episode);
  }
  
  tvShow.seasons.sort((a, b) => a.seasonNumber - b.seasonNumber);
  for (const season of tvShow.seasons) {
    season.episodes.sort((a, b) => a.episodeOrd - b.episodeOrd);
  }
  
  return tvShow;
}

/** @param {string} title */
function genSortStr(title) {
  const prefixes = [
    'A ','An ','D\'','D`','Das ','Der ','Des ','Die ','Du ','D´','Ein ','Eine ','L\'','L`','La ','Le ','Les ','L´','The ','Un ','Une '
  ];
  for (const prefix of prefixes) {
    if (title.startsWith(prefix)) {
      return title.substring(prefix.length) + ', ' + prefix;
    }
  }
  return title;
}

/**
 * @param {string} dir 
 * @param {fs.Dirent | undefined} dirent 
 */
function buildFileURL(dir, dirent) {
  if (!dirent) return '';
  return 'file:///' + posixToWin(path.join(dir, dirent.name));
}

/**
 * @template T
 * @param {(T | null | undefined)[] | undefined} items
 * @return {T[]}
 */
function filterFalsey(items) {
  if (!items) return [];
  return /** @type {T[]} */(items.filter(x => x));
}

/**
 * @typedef TraverseMatch
 * @property {fs.Dirent} dirent
 * @property {string} dir
 * @property {fs.Dirent[]} siblingDirents
 */
/**
 * @param {string} dir 
 * @param {number} maxDepth 
 * @param {(dirent: fs.Dirent, depth: number) => boolean} predicate 
 * @param {number} [_curDepth] 
 * @param {TraverseMatch[]} [_matches] 
 * @returns {TraverseMatch[]}
 */
function traverseDir(dir, maxDepth, predicate, _curDepth = 0, _matches = []) {
  const dirents = fs.readdirSync(dir, {withFileTypes: true});
  
  let didMatch = false;
  const dirDirents = [];
  for (const dirent of dirents) {
    if (dirent.name.startsWith('.')) {
      continue;
    }
    if (dirent.isDirectory()) {
      dirDirents.push(dirent);
      continue;
    }
    if (!predicate(dirent, _curDepth)) {
      continue;
    }
    
    const match = {dirent, dir, siblingDirents: dirents};
    _matches.push(match);
    didMatch = true;
  }
  
  if (didMatch || _curDepth >= maxDepth) {
    return _matches;
  }
  
  for (const dirent of dirDirents) {
    traverseDir(path.join(dir, dirent.name), maxDepth, predicate, _curDepth + 1, _matches);
  }
  return _matches;
}

/** @param {string} posix */
function posixToWin(posix) {
  return posix.replace(/^\/mnt\/(.)\//, (_,x) => x.toUpperCase() + ':\\').replaceAll('/', '\\');
}