'use strict';
function load() {

const diffString = window.diffString;

/**
 * @typedef Episode
 * @property {number} seasonNum
 * @property {number} episodeNum
 * @property {string} name
 * @property {number} ord
 */

/**
 * @typedef LocalFile
 * @property {string} filename
 * @property {string} filenameExt
 * @property {string} filepath
 * @property {number} ord
 */

/**
 * @typedef EpisodeMapping
 * @property {Episode} episode
 * @property {number} fileSpan
 * @property {number} rowIndex
 */
/**
 * @typedef FileMapping
 * @property {LocalFile} localFile
 * @property {number} episodeSpan
 * @property {number} rowIndex
 * @property {string} [outputFilename]
 * @property {string} [outputFilepath]
 * @property {string} [errorMsg]
 */

/**
 * @typedef TVDBEpisode
 * @property {number} id
 * @property {string | null} imdbId
 * @property {string} episodeName
 * @property {number | null} airedSeason
 * @property {number | null} airedEpisodeNumber
 * @property {number | null} dvdSeason
 * @property {number | null} dvdEpisodeNumber
 * @property {number | null} absoluteNumber
 * @property {number | null} airsAfterSeason
 * @property {number | null} airsBeforeSeason
 * @property {number | null} airsBeforeEpisode
 */

const tableElem = /** @type {HTMLTableSectionElement} */(document.getElementById('fileTable'));
const skippedTableElem = /** @type {HTMLTableSectionElement} */(document.getElementById('skippedTable'));
const separatorTableElem = /** @type {HTMLTableSectionElement} */(document.getElementById('separator'));
const outputElem = /** @type {HTMLTextAreaElement} */(document.getElementById('output'));
document.getElementById('copyOutputButton')?.addEventListener('click', () => {
  outputElem.select();
  void navigator.clipboard.writeText(outputElem.value);
});

let draggedFileMappingIndex = -1;

/** @type {EpisodeMapping[]} */
let episodeMappings = [];
/** @type {FileMapping[]} */
let fileMappings = [];

/** @type {Episode[]} */
let skippedEpisodes = [];
/** @type {LocalFile[]} */
let skippedFiles = [];

const formatSeasonNum  = (/** @type {number} */seasonNum ) => 'S' + seasonNum .toString().padStart(2, '0');
const formatEpisodeNum = (/** @type {number} */episodeNum) => 'E' + episodeNum.toString().padStart(2, '0');
/**
 * @param {number} seasonNum 
 * @param {number} episodeNum 
 */
function formatSeasonEpisode(seasonNum, episodeNum) {
  return formatSeasonNum(seasonNum) + formatEpisodeNum(episodeNum);
}

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

// ['A','B','C','D','E','F','G/H','I','J pt1','J pt2','K'].forEach((x, i) => {
//   const episodeNum = (x.charCodeAt(0) - 'A'.charCodeAt(0)) + 1;
//   episodeMappings.push({
//     episode: {
//       seasonNum: 1,
//       episodeNum,
//       name: `Ep ${x}`,
//       ord: i
//     },
//     fileSpan: 1,
//     rowIndex: i
//   });
// });
// ['A','B/C','D','E pt1','E pt2','F','G','H','I','J','K'].forEach((x, i) => {
//   const episodeNum = (x.charCodeAt(0) - 'A'.charCodeAt(0)) + 1;
//   fileMappings.push({
//     localFile: {
//       filename: `${formatSeasonEpisode(1, episodeNum)} - Ep ${x}.mp4`,
//       filenameExt: '.mp4',
//       seasonNum: 1,
//       episodeNum,
//       name: `Ep ${x}`,
//     },
//     episodeSpan: 1,
//     rowIndex: i,
//     outputFilename: ''
//   });
// });

const fileInputElem = /** @type {HTMLInputElement} */(document.getElementById('fileInput'));
const tvdbSeriesIDInput = /** @type {HTMLInputElement} */(document.getElementById('tvdbSeriesID'));
const orderingInput = /** @type {HTMLSelectElement} */(document.getElementById('orderingInput'));
document.getElementById('fetchButton')?.addEventListener('click', () => void refreshData());
document.getElementById('removeSpecialsButton')?.addEventListener('click', () => void removeSpecials());
async function refreshData() {
  episodeMappings = [];
  fileMappings = [];
  skippedEpisodes = [];
  skippedFiles = [];
  
  const fileList = fileInputElem.files;
  if (!fileList?.length) {
    throw new Error(`Files missing.`);
  }
  
  const files = Array.from(fileList).filter(x =>
    !/(^|[/\\])\./.test(x.webkitRelativePath) // Ignore dot files and folders.
  );
  const videoFiles = files.filter(x =>
    x.name.endsWith('.mp4') ||
    x.name.endsWith('.mkv') ||
    x.name.endsWith('.avi')
  );
  
  const tvdbSeriesID = tvdbSeriesIDInput.value;
  const res = await fetch(`http://localhost:8001/?seriesID=${tvdbSeriesID}`);
  if (!res.ok) throw new Error(`Non-200 response.`);
  /** @type {TVDBEpisode[]} */
  const tvdbEpisodes = (await res.json()).episodes;
  
  const sortStyle = orderingInput.value;
  for (const tvdbEpisode of tvdbEpisodes) {
    let seasonNum;
    let episodeNum;
    let ord;
    
    if (sortStyle === 'air') {
      seasonNum = tvdbEpisode.airedSeason || 0;
      episodeNum = tvdbEpisode.airedEpisodeNumber || 0;
      ord = (
        ((
          tvdbEpisode.airsBeforeSeason? (tvdbEpisode.airsBeforeSeason * 10) + (tvdbEpisode.airsBeforeEpisode? 2 : 1) :
          tvdbEpisode.airsAfterSeason? (tvdbEpisode.airsAfterSeason * 10) + 3 :
          ((tvdbEpisode.airedSeason || 0) * 10) + 2
        ) * 1_0000) +
        (
          tvdbEpisode.airsBeforeEpisode? (tvdbEpisode.airsBeforeEpisode * 10) + 1 :
          ((tvdbEpisode.airedEpisodeNumber || 0) * 10) + 2
        )
      );
    }
    else if (sortStyle === 'dvd') {
      seasonNum = tvdbEpisode.dvdSeason || 0;
      episodeNum = tvdbEpisode.dvdEpisodeNumber || 0;
      ord = (
        ((tvdbEpisode.dvdSeason || 0) * 1_000) +
        (tvdbEpisode.dvdEpisodeNumber || 0)
      );
    }
    else {
      seasonNum = 1;
      episodeNum = tvdbEpisode.absoluteNumber || 0;
      ord = tvdbEpisode.absoluteNumber || 0;
    }
    
    episodeMappings.push({
      episode: {
        seasonNum,
        episodeNum,
        name: tvdbEpisode.episodeName,
        ord
      },
      fileSpan: 1,
      rowIndex: -1
    });
  }
  episodeMappings.sort((a, b) => a.episode.ord - b.episode.ord);
  
  for (const videoFile of videoFiles) {
    const match = /^S?(\d+)([.E](\d+))?/.exec(videoFile.name);
    fileMappings.push({
      localFile: {
        filename: videoFile.name,
        filenameExt: /\.[^/\\.]+$/.exec(videoFile.name)?.[0] || '',
        filepath: videoFile.webkitRelativePath,
        ord: !match? 0 : match[3]? (parseInt(match[1], 10) * 1_000) + parseInt(match[3], 10) : parseInt(match[1], 10)
      },
      episodeSpan: 1,
      rowIndex: -1,
    });
  }
  fileMappings.sort((a, b) => a.localFile.ord - b.localFile.ord);
  
  recalcTablePositions();
  fillTable();
}

function removeSpecials() {
  for (let i = 0; i < episodeMappings.length; ++i) {
    const episode = episodeMappings[i].episode;
    if (!episode.seasonNum) {
      episodeMappings.splice(i, 1);
      skippedEpisodes.push(episode);
      --i;
    }
  }
  recalcTablePositions();
  fillTable();
}

function fillTable() {
  tableElem.replaceChildren();
  
  const eRowCount = episodeMappings.length === 0? 0 : episodeMappings[episodeMappings.length - 1].rowIndex + episodeMappings[episodeMappings.length - 1].fileSpan;
  const fRowCount = fileMappings.length === 0? 0 : fileMappings[fileMappings.length - 1].rowIndex + fileMappings[fileMappings.length - 1].episodeSpan;
  const rowCount = Math.max(eRowCount, fRowCount);
  for (let i = 0; i < rowCount; ++i) {
    tableElem.insertRow();
  }
  
  for (let i = 0; i < episodeMappings.length; ++i) {
    const episodeMapping = episodeMappings[i];
    const episode = episodeMapping.episode;
    const rowElem = tableElem.rows[episodeMapping.rowIndex];
    
    const cellElems = [
      rowElem.insertCell(),
      rowElem.insertCell(),
      rowElem.insertCell(),
    ];
    for (const cellElem of cellElems) cellElem.rowSpan = episodeMapping.fileSpan;
    
    const increaseSpanButton = document.createElement('button');
    const decreaseSpanButton = document.createElement('button');
    increaseSpanButton.innerText = '+';
    decreaseSpanButton.innerText = '-';
    
    increaseSpanButton.addEventListener('click', () => {
      episodeMapping.fileSpan += 1;
      recalcTablePositions();
      fillTable();
    });
    // eslint-disable-next-line no-loop-func
    decreaseSpanButton.addEventListener('click', () => {
      episodeMapping.fileSpan -= 1;
      if (episodeMapping.fileSpan < 1) {
        episodeMappings.splice(i, 1);
        skippedEpisodes.push(episodeMapping.episode);
      }
      recalcTablePositions();
      fillTable();
    });
    
    cellElems[0].append(increaseSpanButton);
    cellElems[1].append(decreaseSpanButton);
    cellElems[2].innerText = `${formatSeasonEpisode(episode.seasonNum, episode.episodeNum)} - ${episode.name}`;
    
    if (episodeMapping.fileSpan > 1) {
      for (let j = 0; j < episodeMapping.fileSpan; ++j) {
        tableElem.rows[episodeMapping.rowIndex + j].insertCell().innerText = `pt${j + 1}`;
      }
    }
    else {
      cellElems[2].colSpan = 2;
    }
  }
  
  for (let i = eRowCount; i < rowCount; ++i) {
    const cellElem = tableElem.rows[i].insertCell();
    cellElem.colSpan = 4;
    cellElem.innerText = '\u00A0';
  }
  
  for (let i = 0; i < fileMappings.length; ++i) {
    const fileMapping = fileMappings[i];
    const localFile = fileMapping.localFile;
    const rowElem = tableElem.rows[fileMapping.rowIndex];
    
    const cellElems = [
      rowElem.insertCell(),
      rowElem.insertCell(),
      rowElem.insertCell(),
      rowElem.insertCell(),
    ];
    for (const cellElem of cellElems) cellElem.rowSpan = fileMapping.episodeSpan;
    
    const increaseSpanButton = document.createElement('button');
    const decreaseSpanButton = document.createElement('button');
    increaseSpanButton.innerText = '+';
    decreaseSpanButton.innerText = '-';
    
    increaseSpanButton.addEventListener('click', () => {
      fileMapping.episodeSpan += 1;
      recalcTablePositions();
      fillTable();
    });
    // eslint-disable-next-line no-loop-func
    decreaseSpanButton.addEventListener('click', () => {
      fileMapping.episodeSpan -= 1;
      if (fileMapping.episodeSpan < 1) {
        fileMappings.splice(i, 1);
        skippedFiles.push(fileMapping.localFile);
      }
      recalcTablePositions();
      fillTable();
    });
    
    cellElems[0].innerText = '░ ' + localFile.filename;
    cellElems[0].draggable = true;
    cellElems[0].classList.add('draggable');
    
    // eslint-disable-next-line no-loop-func
    cellElems[0].addEventListener('dragstart', () => {draggedFileMappingIndex = i;});
    //cellElems[0].addEventListener('dragover', event => moveDraggedFileMapping(event, i));
    cellElems[0].addEventListener('dragover', event => event.preventDefault());
    cellElems[0].addEventListener('drop', event => moveDraggedFileMapping(event, i));
    
    cellElems[1].append(increaseSpanButton);
    cellElems[2].append(decreaseSpanButton);
    
    cellElems[3].className = 'diff';
    if (fileMapping.errorMsg) {
      const spanElem = document.createElement('span');
      spanElem.className = 'error';
      spanElem.innerText = fileMapping.errorMsg;
      cellElems[3].append(spanElem);
    }
    else if (fileMapping.outputFilename) {
      const diffComponents = diffString(fileMapping.localFile.filename, fileMapping.outputFilename);
      for (const diffComponent of diffComponents) {
        const spanElem = document.createElement('span');
        spanElem.className = diffComponent.added? 'diffAdd' : diffComponent.removed? 'diffRemove' : '';
        spanElem.innerText = diffComponent.value || '';
        cellElems[3].append(spanElem);
      }
    }
  }
  
  for (let i = fRowCount; i < rowCount; ++i) {
    const rowElem = tableElem.rows[i];
    const cellElems = [
      rowElem.insertCell(),
      rowElem.insertCell(),
    ];
    cellElems[0].colSpan = 3;
    
    //cellElem.addEventListener('dragover', event => moveDraggedFileMapping(event, fileMappings.length - 1));
    cellElems[0].addEventListener('dragover', event => event.preventDefault());
    // eslint-disable-next-line no-loop-func
    cellElems[0].addEventListener('drop', event => moveDraggedFileMapping(event, fileMappings.length - 1));
    
    cellElems[1].innerText = 'Error: missing file';
  }
  
  for (let r = 0, e = 0, f = 0, isOdd = true; r < tableElem.rows.length; ++r) {
    const episodeMapping = e < episodeMappings.length? episodeMappings[e] : undefined;
    const fileMapping = f < fileMappings.length? fileMappings[f] : undefined;
    
    if (
      (episodeMapping?.rowIndex === r || r >= eRowCount) &&
      (fileMapping?.rowIndex === r || r >= fRowCount)
    ) {
      isOdd = !isOdd;
    }
    
    if (isOdd) {
      tableElem.rows[r].classList.add('odd');
    }
    
    if (episodeMapping?.rowIndex === r) ++e;
    if (fileMapping?.rowIndex === r) ++f;
  }
  
  
  skippedTableElem.replaceChildren();
  
  for (let i = 0; i < skippedEpisodes.length; ++i) {
    const episode = skippedEpisodes[i];
    const rowElem = skippedTableElem.insertRow();
    const cellElems = [
      rowElem.insertCell(),
      rowElem.insertCell(),
      rowElem.insertCell(),
    ];
    
    const increaseSpanButton = document.createElement('button');
    const decreaseSpanButton = document.createElement('button');
    increaseSpanButton.innerText = '+';
    decreaseSpanButton.innerText = '-';
    
    // eslint-disable-next-line no-loop-func
    increaseSpanButton.addEventListener('click', () => {
      episodeMappings.push({
        episode,
        fileSpan: 1,
        rowIndex: -1
      });
      skippedEpisodes.splice(i, 1);
      recalcTablePositions();
      fillTable();
    });
    
    decreaseSpanButton.disabled = true;
    
    cellElems[0].append(increaseSpanButton);
    cellElems[1].append(decreaseSpanButton);
    cellElems[2].innerText = `${formatSeasonEpisode(episode.seasonNum, episode.episodeNum)} - ${episode.name}`;
    cellElems[2].colSpan = 2;
  }
  for (let i = skippedEpisodes.length; i < skippedFiles.length; ++i) {
    const rowElem = skippedTableElem.insertRow();
    rowElem.insertCell().colSpan = 4;
  }
  
  for (let i = 0; i < skippedFiles.length; ++i) {
    const localFile = skippedFiles[i];
    const rowElem = skippedTableElem.rows[i];
    const cellElems = [
      rowElem.insertCell(),
      rowElem.insertCell(),
      rowElem.insertCell(),
      rowElem.insertCell(),
    ];
    
    const increaseSpanButton = document.createElement('button');
    const decreaseSpanButton = document.createElement('button');
    increaseSpanButton.innerText = '+';
    decreaseSpanButton.innerText = '-';
    
    // eslint-disable-next-line no-loop-func
    increaseSpanButton.addEventListener('click', () => {
      fileMappings.push({
        localFile,
        episodeSpan: 1,
        rowIndex: -1,
      });
      skippedFiles.splice(i, 1);
      recalcTablePositions();
      fillTable();
    });
    
    decreaseSpanButton.disabled = true;
    
    cellElems[0].innerText = localFile.filename;
    cellElems[1].append(increaseSpanButton);
    cellElems[2].append(decreaseSpanButton);
  }
  for (let i = skippedFiles.length; i < skippedEpisodes.length; ++i) {
    const rowElem = skippedTableElem.rows[i];
    rowElem.insertCell().colSpan = 3;
    rowElem.insertCell();
  }
  
  separatorTableElem.style.visibility = skippedTableElem.rows.length > 0? 'visible' : 'collapse';
  
  /** @type {string[]} */
  const seasonDirs = [];
  outputElem.value = '';
  let outputStr = '';
  for (const fileMapping of fileMappings) {
    if (!fileMapping.outputFilepath) {
      outputStr = 'See errors above.';
      break;
    }
    let origFilepath = fileMapping.localFile.filepath.replace(/^.+?\//, '');
    const newFilepath = fileMapping.outputFilepath;
    if (origFilepath !== newFilepath) {
      // @ts-ignore
      const seasonDir = /^[^/]+/.exec(newFilepath)[0];
      if (!seasonDirs.includes(seasonDir)) {
        outputStr += `mkdir -p "${seasonDir}";\n`;
        seasonDirs.push(seasonDir);
      }
      if (origFilepath.toLowerCase() === newFilepath.toLowerCase()) {
        const tempFilepath = `${origFilepath}-temp`;
        outputStr += `mv -vn "${origFilepath.replace(/\$/g, '\\$')}" "${tempFilepath.replace(/\$/g, '\\$')}";\n`;
        origFilepath = tempFilepath;
      }
      outputStr += `mv -vn \\\n  "${origFilepath.replace(/\$/g, '\\$')}" \\\n  "${newFilepath.replace(/\$/g, '\\$')}";\n`;
    }
  }
  outputElem.value = outputStr;
}

/**
 * @param {Event} event 
 * @param {number} targetIndex 
 */
function moveDraggedFileMapping(event, targetIndex) {
  if (draggedFileMappingIndex === -1) return;
  const fromIndex = draggedFileMappingIndex;
  const toIndex = targetIndex;
  
  if (fromIndex === toIndex) return;
  event.preventDefault();
  
  const dir = toIndex > fromIndex? 1 : -1;
  const temp = fileMappings[fromIndex];
  for (let j = fromIndex; j !== toIndex; j += dir) {
    fileMappings[j] = fileMappings[j + dir];
  }
  fileMappings[toIndex] = temp;
  
  draggedFileMappingIndex = toIndex;
  recalcTablePositions();
  fillTable();
}

function recalcTablePositions() {
  episodeMappings.sort((a, b) => a.episode.ord - b.episode.ord);
  skippedEpisodes.sort((a, b) => a.ord - b.ord);
  
  let rowIndex = 0;
  for (const episodeMapping of episodeMappings) {
    episodeMapping.rowIndex = rowIndex;
    rowIndex += episodeMapping.fileSpan;
  }
  
  let episodeMappingIndex = 0;
  rowIndex = 0;
  for (const fileMapping of fileMappings) {
    fileMapping.rowIndex = rowIndex;
    let errorMsg;
    let outputFilename;
    let seasonNum = 0;
    const rowIndexEnd = rowIndex + fileMapping.episodeSpan;
    
    if (episodeMappingIndex >= episodeMappings.length) {
      outputFilename = '';
      errorMsg = 'Error: missing episode';
      rowIndex += fileMapping.episodeSpan;
    }
    else if (fileMapping.episodeSpan === 1) {
      const episodeMapping = episodeMappings[episodeMappingIndex];
      const episode = episodeMapping.episode;
      outputFilename = formatSeasonEpisode(episode.seasonNum, episode.episodeNum);
      outputFilename += ` - ${episode.name}`;
      if (episodeMapping.fileSpan !== 1) {
        outputFilename += ` pt${(rowIndex - episodeMapping.rowIndex) + 1}`;
      }
      seasonNum = episode.seasonNum;
      
      ++rowIndex;
      if (rowIndex === episodeMapping.rowIndex + episodeMapping.fileSpan) {
        ++episodeMappingIndex;
      }
    }
    else {
      seasonNum = episodeMappings[episodeMappingIndex].episode.seasonNum;
      outputFilename = formatSeasonNum(seasonNum);
      
      let episodeNamesStr = '';
      while (rowIndex < rowIndexEnd) {
        if (episodeMappingIndex >= episodeMappings.length) {
          errorMsg = `Error: missing episode`;
          break;
        }
        
        const episodeMapping = episodeMappings[episodeMappingIndex];
        if (episodeMapping.fileSpan > 1) {
          errorMsg = `Error: overlapping spans`;
          break;
        }
        
        const episode = episodeMapping.episode;
        if (episode.seasonNum !== seasonNum) {
          errorMsg = `Error: multiple seasons`;
          break;
        }
        
        outputFilename += 'E' + episode.episodeNum.toString().padStart(2, '0');
        if (episodeNamesStr.length > 0) {
          episodeNamesStr += ' - ';
        }
        episodeNamesStr += episode.name;
        
        ++rowIndex;
        ++episodeMappingIndex;
      }
      if (rowIndex < rowIndexEnd) {
        rowIndex = rowIndexEnd;
        while (
          episodeMappingIndex < episodeMappings.length
          && episodeMappings[episodeMappingIndex].rowIndex + episodeMappings[episodeMappingIndex].fileSpan <= rowIndexEnd
        ) {
          ++episodeMappingIndex;
        }
      }
      else {
        outputFilename += ` - ${episodeNamesStr}`;
      }
    }
    
    if (errorMsg) {
      fileMapping.errorMsg = errorMsg;
      fileMapping.outputFilename = undefined;
      fileMapping.outputFilepath = undefined;
    }
    else {
      outputFilename = makeFilenameFriendly(outputFilename) + fileMapping.localFile.filenameExt;
      fileMapping.errorMsg = undefined;
      fileMapping.outputFilename = outputFilename;
      fileMapping.outputFilepath = `Season ${seasonNum.toString().padStart(2, '0')}/${outputFilename}`;
    }
  }
}

recalcTablePositions();
fillTable();

} window.addEventListener('DOMContentLoaded', () => load());