'use strict';
function load() {

const MAX_NUM_PREVIEW_MOVIES = 50;

/**
 * @typedef Movie
 * @property {string} title
 * @property {string} sortStr
 * @property {string} [year]
 * @property {string} [plot]
 * @property {string} [tagline]
 * @property {string} [rating]
 * @property {string[]} genres
 * @property {string[]} directorNames
 * @property {string[]} actorNames
 * @property {boolean} [hasSubtitles]
 * @property {number} [runtimeMinutes]
 * @property {string} [thumbURL]
 * @property {string} [logoURL]
 * @property {string} [keyartURL]
 * @property {string} [videoFilepath]
 */

/**
 * @param {string} selectors
 * @param {ParentNode} [parent]
 */
function requireElem(selectors, parent) {
  const elem = (parent || document).querySelector(selectors);
  if (!elem) throw new Error(`Unable to find element: ${selectors}`);
  return /** @type {HTMLElement} */(elem);
}
/**
 * @template T
 * @param {(T | null | undefined)[]} items
 * @return {T[]}
 */
function filterFalsey(items) {
  return /** @type {T[]} */(items.filter(x => x));
}

const fileInputElem = /** @type {HTMLInputElement} */(requireElem('#fileInput'));
const rootDirInputElem = /** @type {HTMLInputElement} */(requireElem('#rootDirInput'));
const enableGridNavWrapCheckElem = /** @type {HTMLInputElement} */(requireElem('#enableGridNavWrapCheck'));
const enableMouseAtStartCheckElem = /** @type {HTMLInputElement} */(requireElem('#enableMouseAtStartCheck'));
const generateButtonElem = requireElem('#generateButton');
const logElem = /** @type {HTMLTextAreaElement} */(requireElem('#log'));
const configPreviewElem = /** @type {HTMLTextAreaElement} */(requireElem('#configPreview'));
const previewTableElem = /** @type {HTMLTableElement} */(requireElem('#previewTable'));
const downloadLinkElem = /** @type {HTMLAnchorElement} */(requireElem('#downloadLink'));

generateButtonElem.addEventListener('click', () => void generateConfig());
populateDownloadLink();

async function generateConfig() {
  clearLog();
  populateConfigPreview('');
  populatePreviewTable([]);
  populateDownloadLink();
  
  const fileList = fileInputElem.files;
  const rootDir = rootDirInputElem.value.replace(/[/\\]+$/, ''); // Trim trailing path separator.
  
  log(`Files: ${fileList?.length || 0}`);
  log(`Root dir: ${rootDir}`);
  if (!fileList?.length || !rootDir) {
    log(`Files or root dir missing.`);
    return;
  }
  
  const files = Array.from(fileList).filter(x =>
    !/(^|[/\\])\./.test(x.name) // Ignore dot files and folders.
  );
  const nfoFiles = files.filter(x => x.name.endsWith('.nfo'));
  log(`NFO files: ${nfoFiles.length}`);
  
  const domParser = new DOMParser();
  /** @type {Movie[]} */
  const movies = [];
  for (const nfoFile of nfoFiles) {
    const nfoBaseFilename = nfoFile.name.slice(0, -4);
    
    const xmlStr = await nfoFile.text();
    /** @type {XMLDocument} */
    const xmlDoc = domParser.parseFromString(xmlStr, 'text/xml');
    const movieNode = xmlDoc.getElementsByTagName('movie')[0];
    if (!movieNode) {
      continue;
    }
    
    /** @type {Movie} */
    const movie = {};
    movie.title = movieNode.getElementsByTagName('title')[0]?.textContent || nfoBaseFilename;
    movie.sortStr = genSortStr(movie.title);
    movie.year = movieNode.getElementsByTagName('year')[0]?.textContent || undefined;
    movie.plot = movieNode.getElementsByTagName('plot')[0]?.textContent || undefined;
    movie.tagline = movieNode.getElementsByTagName('tagline')[0]?.textContent || undefined;
    movie.rating = movieNode.getElementsByTagName('mpaa')[0]?.textContent || undefined;
    movie.genres = filterFalsey(Array.from(movieNode.getElementsByTagName('genre')).map(x => x.textContent)).slice(0, 10);
    movie.directorNames = filterFalsey(Array.from(movieNode.getElementsByTagName('director')).map(x => x.textContent)).slice(0, 10);
    movie.actorNames = filterFalsey(Array.from(movieNode.querySelectorAll('actor name')).map(x => x.textContent)).slice(0, 10);
    movie.hasSubtitles = filterFalsey(Array.from(movieNode.querySelectorAll('subtitle language'))).length > 0;
    const runtimeMinutesStr = movieNode.getElementsByTagName('runtime')[0]?.textContent;
    movie.runtimeMinutes = runtimeMinutesStr? parseInt(runtimeMinutesStr, 10) : undefined;
    
    const thumbFilename = nfoBaseFilename + '-thumb.jpg';
    const thumbFile = files.find(x => x.name === thumbFilename);
    movie.thumbURL = thumbFile && getFileURL(thumbFile, rootDir);
    
    const logoFilename = nfoBaseFilename + '-clearlogo.png';
    const logoFile = files.find(x => x.name === logoFilename);
    movie.logoURL = logoFile && getFileURL(logoFile, rootDir);
    
    const keyartFilename = nfoBaseFilename + '-keyart.jpg';
    const keyartFile = files.find(x => x.name === keyartFilename);
    movie.keyartURL = keyartFile && getFileURL(keyartFile, rootDir);
    
    const videoFile = files.find(file => {
      // Find a file with the same base filename as the NFO file.
      const fileBaseFilename = file.name.substring(0, file.name.lastIndexOf('.'));
      return fileBaseFilename === nfoBaseFilename && file !== nfoFile;
    });
    if (videoFile) {
      movie.videoFilepath = rootDir + '\\' + videoFile.webkitRelativePath;
    }
    else {
      log(`Unable to find video file for ${nfoFile.webkitRelativePath}`);
    }
    
    movies.push(movie);
  }
  
  movies.sort((a, b) => a.sortStr.localeCompare(b.sortStr));
  
  log(`Movies: ${movies.length}`);
  
  const configJSON = JSON.stringify({
    enableGridNavWrap: enableGridNavWrapCheckElem.checked,
    enableMouseAtStart: enableMouseAtStartCheckElem.checked,
    movies
  }, null, 2);
  
  populatePreviewTable(movies);
  populateConfigPreview(configJSON);
  populateDownloadLink(configJSON);
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
 * @param {File } file 
 * @param {string} rootDir 
 */
function getFileURL(file, rootDir) {
  return 'file:///' + rootDir + '\\' + file.webkitRelativePath;
}

/** @param {Movie[]} movies */
function populatePreviewTable(movies) {
  while (previewTableElem.rows.length > 1) {
    previewTableElem.deleteRow(1);
  }
  
  const numPreviewMovies = Math.min(movies.length, MAX_NUM_PREVIEW_MOVIES);
  for (let i = 0; i < numPreviewMovies; ++i) {
    const movie = movies[i];
    const rowElem = previewTableElem.insertRow();
    rowElem.insertCell().innerText = movie.title;
    rowElem.insertCell().innerText = movie.videoFilepath || '<empty>';
    
    if (movie.thumbURL) {
      const imgElem = document.createElement('img');
      imgElem.src = movie.thumbURL;
      imgElem.alt = `Failed to load: ${movie.thumbURL}`;
      // const imgLink = document.createElement('a');
      // imgLink.href = movie.thumbURL;
      // imgLink.target = '_blank';
      // imgLink.appendChild(img);
      rowElem.insertCell().appendChild(imgElem);
    }
    else {
      rowElem.insertCell().innerText = '<empty>';
    }
  }
  
  const numRemainingMovies = movies.length - numPreviewMovies;
  if (numRemainingMovies > 0) {
    const rowElem = previewTableElem.insertRow();
    const cellElem = rowElem.insertCell();
    cellElem.colSpan = 3;
    cellElem.innerText = `${numRemainingMovies} more...`;
  }
}
/** @param {string} [configJSON] */
function populateConfigPreview(configJSON) {
  configPreviewElem.value = configJSON || '';
}
/** @param {string} [configJSON] */
function populateDownloadLink(configJSON) {
  if (configJSON) {
    const configJS = 'window.movieLibraryConfig = ' + configJSON + ';';
    const configBlob = new Blob([configJS], {type: 'text/plain'});
    downloadLinkElem.download = 'config.js';
    downloadLinkElem.href = URL.createObjectURL(configBlob);
  }
  else {
    downloadLinkElem.download = '';
    downloadLinkElem.href = `javascript:alert('You must generate the config first.')`;
  }
}

/** @param {string} str */
function log(str) {
  console.log(str);
  logElem.value += str + '\n';
}
function clearLog() {
  logElem.value = '';
}

} window.addEventListener('DOMContentLoaded', () => load());