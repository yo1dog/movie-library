'use strict';
function load() {

const diffString = window.diffString;

/**
 * @typedef Video
 * @property {string} filename
 * @property {string} filepath
 * @property {string} thumbFilename
 * @property {string} thumbFilepath
 * @property {number} ord
 * @property {boolean} isSpecial
 */

/**
 * @typedef Thumb
 * @property {string} filename
 * @property {string} filepath
 * @property {number} ord
 */

const tableElem = /** @type {HTMLTableSectionElement} */(document.getElementById('fileTable'));
const skippedTableElem = /** @type {HTMLTableSectionElement} */(document.getElementById('skippedTable'));
const separatorTableElem = /** @type {HTMLTableSectionElement} */(document.getElementById('separator'));
const outputElem = /** @type {HTMLTextAreaElement} */(document.getElementById('output'));
document.getElementById('copyOutputButton')?.addEventListener('click', () => {
  outputElem.select();
  void navigator.clipboard.writeText(outputElem.value);
});

let draggedThumbIndex = -1;

/** @type {Video[]} */
let videos = [];
/** @type {Thumb[]} */
let thumbs = [];

/** @type {Video[]} */
let skippedVideos = [];
/** @type {Thumb[]} */
let skippedThumbs = [];

const videoInputElem = /** @type {HTMLInputElement} */(document.getElementById('videoInput'));
const thumbInputElem = /** @type {HTMLInputElement} */(document.getElementById('thumbInput'));
document.getElementById('loadButton')?.addEventListener('click', () => void loadData());
document.getElementById('removeSpecialsButton')?.addEventListener('click', () => void removeSpecials());
async function loadData() {
  videos = [];
  thumbs = [];
  skippedVideos = [];
  skippedThumbs = [];
  
  const videoFileList = videoInputElem.files;
  if (!videoFileList?.length) {
    throw new Error(`Videos missing.`);
  }
  const thumbFileList = thumbInputElem.files;
  if (!thumbFileList?.length) {
    throw new Error(`Thumbs missing.`);
  }
  
  const videoFiles1 = Array.from(videoFileList).filter(x =>
    !/(^|[/\\])\./.test(x.webkitRelativePath) // Ignore dot files and folders.
  );
  const videoFiles = videoFiles1.filter(x =>
    x.name.endsWith('.mp4') ||
    x.name.endsWith('.mkv') ||
    x.name.endsWith('.avi')
  );
  
  const thumbFiles1 = Array.from(thumbFileList).filter(x =>
    !/(^|[/\\])\./.test(x.webkitRelativePath) // Ignore dot files and folders.
  );
  const thumbFiles = thumbFiles1.filter(x =>
    x.name.endsWith('.jpg')
  );
  
  for (const videoFile of videoFiles) {
    const match = /^[Ss]?(\d+)[.Ee](\d+)/.exec(videoFile.name);
    
    const seasonNum = match? parseInt(match[1], 10) || 0 : 0;
    const episodeNum = match? parseInt(match[2], 10) || 0 : 0;
    const ord = (seasonNum * 1_0000) + episodeNum;
    
    const filename = videoFile.name;
    const filepath = videoFile.webkitRelativePath;
    const thumbFilename = filename.substring(0, filename.lastIndexOf('.')) + '-thumb.jpg';
    const thumbFilepath = filepath.substring(0, filepath.lastIndexOf('.')) + '-thumb.jpg';
    
    videos.push({
      filename,
      filepath,
      thumbFilename,
      thumbFilepath,
      ord,
      isSpecial: !seasonNum,
    });
  }
  videos.sort((a, b) => a.ord - b.ord);
  
  for (const thumbFile of thumbFiles) {
    const match = /^[Ss]?(\d+)[.Ee](\d+)/.exec(thumbFile.name);
    
    const seasonNum = match? parseInt(match[1], 10) || 0 : 0;
    const episodeNum = match? parseInt(match[2], 10) || 0 : 0;
    const ord = (seasonNum * 1_0000) + episodeNum;
    
    thumbs.push({
      filename: thumbFile.name,
      filepath: thumbFile.webkitRelativePath,
      ord,
    });
  }
  thumbs.sort((a, b) => a.ord - b.ord);
  
  fillTable();
}

function removeSpecials() {
  let newIndex = 0;
  for (let i = 0; i < videos.length; ++i) {
    const video = videos[i];
    if (!video.isSpecial) continue;
    
    videos.splice(i, 1);
    while (newIndex < skippedVideos.length && skippedVideos[newIndex].ord < video.ord) {
      ++newIndex;
    }
    skippedVideos.splice(newIndex, 0, video);
    --i;
  }
  fillTable();
}

function fillTable() {
  const rowCount = Math.max(videos.length, thumbs.length);
  while (tableElem.rows.length > rowCount) {
    tableElem.deleteRow(-1);
  }
  while (tableElem.rows.length < rowCount) {
    const i = tableElem.rows.length;
    const rowElem = tableElem.insertRow();
    /*const videoNameCellElem = */rowElem.insertCell();
    const videoButtonCellElem =   rowElem.insertCell();
    const thumbNameCellElem =     rowElem.insertCell();
    const thumbButtonCellElem =   rowElem.insertCell();
    const diffCellElem =          rowElem.insertCell();
    
    const videoButton = document.createElement('button');
    videoButton.innerText = '-';
    // eslint-disable-next-line no-loop-func
    videoButton.addEventListener('click', () => {
      const video = videos.splice(i, 1)[0];
      let newIndex = 0;
      while (newIndex < skippedVideos.length && skippedVideos[newIndex].ord < video.ord) {
        ++newIndex;
      }
      skippedVideos.splice(newIndex, 0, video);
      fillTable();
    });
    videoButtonCellElem.appendChild(videoButton);
    
    const thumbButton = document.createElement('button');
    thumbButton.innerText = '-';
    // eslint-disable-next-line no-loop-func
    thumbButton.addEventListener('click', () => {
      skippedThumbs.push(thumbs.splice(i, 1)[0]);
      fillTable();
    });
    thumbButtonCellElem.appendChild(thumbButton);
    
    // eslint-disable-next-line no-loop-func
    thumbNameCellElem.addEventListener('dragstart', () => {draggedThumbIndex = i;});
    thumbNameCellElem.addEventListener('dragover', event => event.preventDefault());
    //thumbCellElem.addEventListener('dragover', event => moveDraggedFileMapping(event, i));
    thumbNameCellElem.addEventListener('drop', event => moveDraggedThumb(event, i));
    
    diffCellElem.className = 'diff';
    
    if (i % 2 === 1) {
      rowElem.classList.add('odd');
    }
  }
  
  for (let i = 0; i < rowCount; ++i) {
    const rowElem = tableElem.rows[i];
    const videoNameCellElem   = rowElem.cells[0];
    const videoButtonCellElem = rowElem.cells[1];
    const thumbNameCellElem   = rowElem.cells[2];
    const thumbButtonCellElem = rowElem.cells[3];
    const diffCellElem        = rowElem.cells[4];
    
    const video = i < videos.length? videos[i] : undefined;
    const thumb = i < thumbs.length? thumbs[i] : undefined;
    
    videoNameCellElem.innerText = video?.filename || '\u00A0';
    videoButtonCellElem.classList.toggle('hidden', !video);
    
    thumbNameCellElem.innerText = thumb? '░ ' + thumb.filename : '\u00A0';
    thumbNameCellElem.draggable = Boolean(thumb);
    thumbNameCellElem.classList.toggle('draggable', Boolean(thumb));
    thumbButtonCellElem.classList.toggle('hidden', !thumb);
    
    diffCellElem.replaceChildren();
    if (!video || !thumb) {
      diffCellElem.innerText = '\u00A0';
    }
    else {
      const diffComponents = diffString(thumb.filename, video.thumbFilename);
      for (const diffComponent of diffComponents) {
        const spanElem = document.createElement('span');
        spanElem.className = diffComponent.added? 'diffAdd' : diffComponent.removed? 'diffRemove' : '';
        spanElem.innerText = diffComponent.value || '';
        diffCellElem.append(spanElem);
      }
    }
  }
  
  const skippedRowCount = Math.max(skippedVideos.length, skippedThumbs.length);
  while (skippedTableElem.rows.length > skippedRowCount) {
    skippedTableElem.deleteRow(-1);
  }
  while (skippedTableElem.rows.length < skippedRowCount) {
    const i = skippedTableElem.rows.length;
    const rowElem = skippedTableElem.insertRow();
    /*const videoNameCellElem = */rowElem.insertCell();
    const videoButtonCellElem =   rowElem.insertCell();
    /*const thumbNameCellElem = */rowElem.insertCell();
    const thumbButtonCellElem =   rowElem.insertCell();
    /*const diffCellElem = */     rowElem.insertCell();
    
    const videoButton = document.createElement('button');
    videoButton.innerText = '+';
    // eslint-disable-next-line no-loop-func
    videoButton.addEventListener('click', () => {
      const video = skippedVideos.splice(i, 1)[0];
      let newIndex = 0;
      while (newIndex < videos.length && videos[newIndex].ord < video.ord) {
        ++newIndex;
      }
      videos.splice(newIndex, 0, video);
      fillTable();
    });
    videoButtonCellElem.appendChild(videoButton);
    
    const thumbButton = document.createElement('button');
    thumbButton.innerText = '+';
    // eslint-disable-next-line no-loop-func
    thumbButton.addEventListener('click', () => {
      thumbs.push(skippedThumbs.splice(i, 1)[0]);
      fillTable();
    });
    thumbButtonCellElem.appendChild(thumbButton);
  }
  
  for (let i = 0; i < skippedRowCount; ++i) {
    const rowElem = skippedTableElem.rows[i];
    const videoNameCellElem =   rowElem.cells[0];
    const videoButtonCellElem = rowElem.cells[1];
    const thumbNameCellElem =   rowElem.cells[2];
    const thumbButtonCellElem = rowElem.cells[3];
    const video = i < skippedVideos.length? skippedVideos[i] : undefined;
    const thumb = i < skippedThumbs.length? skippedThumbs[i] : undefined;
    
    videoNameCellElem.innerText = video?.filename || '\u00A0';
    thumbNameCellElem.innerText = thumb?.filename || '\u00A0';
    videoButtonCellElem.classList.toggle('hidden', !video);
    thumbButtonCellElem.classList.toggle('hidden', !thumb);
  }
  
  separatorTableElem.style.visibility = skippedRowCount > 0? 'visible' : 'collapse';
  
  outputElem.value = '';
  let outputStr = '';
  
  const numMappings = Math.min(videos.length, thumbs.length);
  for (let i = 0; i < numMappings; ++i) {
    const video = videos[i];
    const thumb = thumbs[i];
    
    let origFilepath = '/mnt/m/' + thumb.filepath;
    const newFilepath = '/mnt/m/TV/' + video.thumbFilepath;
    if (origFilepath === newFilepath) {
      continue;
    }
    
    if (origFilepath.toLowerCase() === newFilepath.toLowerCase()) {
      const tempFilepath = `${origFilepath}-temp`;
      outputStr += `mv -v "/mnt/m/temp/${origFilepath.replace(/\$/g, '\\$')}" "${tempFilepath.replace(/\$/g, '\\$')}";\n`;
      origFilepath = tempFilepath;
    }
    
    outputStr += `mv -v \\\n  "${origFilepath.replace(/\$/g, '\\$')}" \\\n  "${newFilepath.replace(/\$/g, '\\$')}";\n`;
  }
  
  outputElem.value = outputStr;
}

/**
 * @param {Event} event 
 * @param {number} targetIndex 
 */
function moveDraggedThumb(event, targetIndex) {
  if (draggedThumbIndex === -1) return;
  const fromIndex = draggedThumbIndex;
  const toIndex = targetIndex;
  
  if (fromIndex === toIndex) return;
  event.preventDefault();
  
  const dir = toIndex > fromIndex? 1 : -1;
  const temp = thumbs[fromIndex];
  for (let j = fromIndex; j !== toIndex; j += dir) {
    thumbs[j] = thumbs[j + dir];
  }
  thumbs[toIndex] = temp;
  
  draggedThumbIndex = toIndex;
  fillTable();
}

fillTable();

} window.addEventListener('DOMContentLoaded', () => load());