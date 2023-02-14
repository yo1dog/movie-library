'use strict';
function load() {


// ------------------------
// Config
// ------------------------
const GRID_NUM_COLUMNS = 5;
let ENABLE_GRID_NAV_WRAP = false;
// ------------------------


/** @type {Record<string, string>} */
const RATING_IMG_URL_DICT = {
  'Rated G': 'assets/rating-g.png',
  'Rated PG': 'assets/rating-pg.png',
  'Rated PG-13': 'assets/rating-pg-13.png',
  'Rated R': 'assets/rating-r.png',
};

/**
 * @typedef Config
 * @property {boolean} [enableGridNavWrap]
 * @property {boolean} [enableMouseAtStart]
 * @property {Movie[]} movies
 */

/**
 * @typedef Movie
 * @property {string} title
 * @property {string} year
 * @property {string} plot
 * @property {string} tagline
 * @property {string} rating
 * @property {string[]} genres
 * @property {string[]} directorNames
 * @property {string[]} actorNames
 * @property {boolean} hasSubtitles
 * @property {number} runtimeMinutes
 * @property {string} thumbURL
 * @property {string} logoURL
 * @property {string} keyartURL
 * @property {string} [videoFilepath]
 */

/**
 * @typedef NavController
 * @property {(key: string) => boolean} handleKey
 */

/**
 * @typedef NavListItemRaw
 * @property {HTMLElement} elem
 * @property {() => void} action
 */
/**
 * @typedef NavListItem
 * @property {HTMLElement} elem
 * @property {() => void} action
 * @property {number} index
 * @property {number} x
 * @property {number} y
 */

// Simple class for managing navigation state for a list or grid of items.
class NavigatableList {
  /**
   * @param {NavListItemRaw[]} rawItems
   * @param {number} [gridNumColumns]
   */
  constructor(rawItems, gridNumColumns) {
    if (rawItems.length === 0) throw new Error(`No items given.`);
    
    this.numColumns = gridNumColumns || rawItems.length;
    this.numRows = Math.ceil(rawItems.length / this.numColumns);
    
    // For each given item, calculate some values and add it to the list.
    /** @type {NavListItem[]} */
    this.items = [];
    for (let i = 0; i < rawItems.length; ++i) {
      /** @type {NavListItem} */
      const item = {
        elem: rawItems[i].elem,
        action: rawItems[i].action,
        index: i,
        x: i % this.numColumns,
        y: Math.floor(i / this.numColumns),
      };
      
      // Add listeners for mouse events.
      item.elem.addEventListener('click', () => {
        this.setActiveItem(item.index, false);
        item.action();
      });
      item.elem.addEventListener('mouseenter', () => {
        this.setActiveItem(item.index, false);
      });
      
      this.items.push(item);
    }
    
    /** @type {NavListItem | undefined} */
    this.activeItem = undefined;
  }
  
  /**
   * Changes the active item relative to the current active item while constrained to the grid.
   * @param {number} dx
   * @param {number} dy
   */
  move(dx, dy) {
    let index;
    if (ENABLE_GRID_NAV_WRAP) {
      index = (this.activeItem?.index || 0) + dx + (dy * this.numColumns);
      if (index < 0) index = 0;
      if (index > this.items.length - 1) index = this.items.length - 1;
    }
    else {
      let x = (this.activeItem?.x || 0) + dx;
      let y = (this.activeItem?.y || 0) + dy;
      if (x < 0) x = 0;
      if (x > this.numColumns - 1) x = this.numColumns - 1;
      if (y < 0) y = 0;
      if (y > this.numRows - 1) y = this.numRows - 1;
      
      index = (y * this.numColumns) + x;
      if (index > this.items.length - 1) index = this.items.length - 1;
    }
    
    this.setActiveItem(index);
  }
  
  /**
   * @param {number} index
   * @param {boolean} [scroll]
   */
  setActiveItem(index, scroll = true) {
    const newActiveItem = this.items[index];
    if (this.activeItem === newActiveItem) {
      return;
    }
    
    if (this.activeItem) {
      this.activeItem.elem.classList.remove('active');
    }
    
    this.activeItem = newActiveItem;
    
    if (this.activeItem) {
      this.activeItem.elem.classList.add('active');
      if (scroll) {
        this.activeItem.elem.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'nearest',
        });
      }
    }
  }
}

/**
 * @param {string} selectors
 * @param {ParentNode} [parent]
 */
function requireElem(selectors, parent) {
  const elem = (parent || document).querySelector(selectors);
  if (!elem) throw new Error(`Unable to find element: ${selectors}`);
  return /** @type {HTMLElement} */(elem);
}

const errorAlertElem = requireElem('#errorAlert');
const gridWindowElem = requireElem('#gridWindow');
const detailWindowElem = requireElem('#detailWindow');
const backButtonElem = requireElem('#backButton');
const playButtonElem = requireElem('#playButton');
const detailBackgroundImgElem = /** @type {HTMLImageElement} */(requireElem('#detailBackgroundImgContainer img'));
const detailLogoElem = /** @type {HTMLImageElement} */(requireElem('#detailLogo'));
const ratingImgElems = /** @type {HTMLImageElement[]} */(Array.from(document.getElementsByName('ratingImg')));
const closedCaptionsImgElem = /** @type {HTMLImageElement} */(requireElem('#closedCaptionsImg'));
const movieYearElems = Array.from(document.getElementsByName('movieYear'));
const runtimeElems = Array.from(document.getElementsByName('runtime'));
const generesElems = Array.from(document.getElementsByName('generes'));
const detailTopPanelDesc = requireElem('#detailTopPanelDesc');
const movieTitleElem = requireElem('#movieTitle');
const directorsElem = requireElem('#directors');
const starringElem = requireElem('#starring');
const starringContainerElem = /** @type {HTMLElement} */(starringElem.parentElement);
const starTemplate = /** @type {HTMLTemplateElement} */(starringContainerElem.getElementsByTagName('TEMPLATE')[0]);
const gridElem = requireElem('#grid');
const gridItemTemplate = /** @type {HTMLTemplateElement} */(gridElem.getElementsByTagName('TEMPLATE')[0]);

/** @type {NavigatableList} */ let detailButtonsNavList;
/** @type {NavigatableList} */ let gridNavList;
/** @type {Movie | undefined} */ let selectedMovie;

/** @type {NavController} */
const gridWindowNavController = {
  handleKey(key) {
    switch (key) {
      case 'Enter':
        gridNavList.activeItem?.action();
        return true;
      case 'ArrowLeft':
        gridNavList.move(-1, 0);
        return true;
      case 'ArrowRight':
        gridNavList.move(1, 0);
        return true;
      case 'ArrowUp':
        gridNavList.move(0, -1);
        return true;
      case 'ArrowDown':
        gridNavList.move(0, 1);
        return true;
    }
    return false;
  }
};
/** @type {NavController} */
const detailWindowNavController = {
  handleKey(key) {
    switch (key) {
      case 'Enter':
        detailButtonsNavList.activeItem?.action();
        return true;
      case 'ArrowLeft':
        detailButtonsNavList.move(-1, 0);
        return true;
      case 'ArrowRight':
        detailButtonsNavList.move(1, 0);
        return true;
      case 'ArrowUp':
        detailWindowElem.scrollTo({
          behavior: 'smooth',
          top: 0
        });
        return true;
      case 'ArrowDown':
        detailWindowElem.scrollTo({
          behavior: 'smooth',
          top: detailWindowElem.scrollHeight
        });
        return true;
      case 'Escape':
        hideDetailWindow();
        return true;
    }
    return false;
  }
};
let activeNavController = gridWindowNavController;

function init() {
  hideDetailWindow();
  
  const {movieLibraryConfig} = /** @type {{movieLibraryConfig?: Config}} */(window);
  if (!movieLibraryConfig) {
    errorAlertElem.innerText = 'Error: Configuration does not exist or is not able to be loaded. Check the console.';
    return;
  }
  
  /** @type {Movie[]} */
  const movies = [];
  for (const movie of Array.isArray(movieLibraryConfig.movies)? movieLibraryConfig.movies : []) {
    movies.push({
      title: movie.title || '',
      year: movie.year || '',
      plot: movie.plot || '',
      tagline: movie.tagline || '',
      rating: movie.rating || '',
      genres: movie.genres || [],
      directorNames: movie.directorNames || [],
      actorNames: movie.actorNames || [],
      hasSubtitles: movie.hasSubtitles || false,
      runtimeMinutes: movie.runtimeMinutes || 0,
      thumbURL: movie.thumbURL || '',
      logoURL: movie.logoURL || '',
      keyartURL: movie.keyartURL || '',
      videoFilepath: movie.videoFilepath || undefined,
    });
  }
  
  if (!movies.length) {
    errorAlertElem.innerText = 'Error: Configuration contains no movies.';
    return;
  }
  
  ENABLE_GRID_NAV_WRAP = movieLibraryConfig.enableGridNavWrap ?? ENABLE_GRID_NAV_WRAP;
  
  if (!movieLibraryConfig.enableMouseAtStart) {
    disableMouse();
  }
  
  // Setup detail window buttons.
  detailButtonsNavList = new NavigatableList([{
    elem: backButtonElem,
    action: () => hideDetailWindow()
  }, {
    elem: playButtonElem,
    action: () => selectedMovie?.videoFilepath && playVideo(selectedMovie.videoFilepath)
  }]);
  detailButtonsNavList.setActiveItem(1, false);
  
  for (const imgElem of [detailLogoElem, detailBackgroundImgElem]) {
    imgElem.addEventListener('load',  () => imgElem.classList.remove('loading'));
    imgElem.addEventListener('error', () => imgElem.classList.remove('loading'));
  }
  
  // Populate the movie grid and setup grid navigation controls.
  gridElem.style.gridTemplateColumns = `repeat(${GRID_NUM_COLUMNS}, 1fr)`;
  
  /** @type {NavListItemRaw[]} */
  const navItems = [];
  for (const movie of movies) {
    const gridItemNode = /** @type {DocumentFragment} */(gridItemTemplate.content.cloneNode(true));
    const gridItemElem = requireElem('.gridItem', gridItemNode);
    const gridItemTextElem = requireElem('.gridItemText', gridItemNode);
    const gridItemImgElem = /**@type {HTMLImageElement} */(requireElem('.gridItemImg', gridItemNode));
    
    gridItemTextElem.innerText = movie.title;
    
    if (movie.thumbURL) {
      gridItemImgElem.src = movie.thumbURL;
    }
    else {
      gridItemImgElem.parentElement?.removeChild(gridItemImgElem);
    }
    
    gridElem.appendChild(gridItemElem);
    
    navItems.push({
      elem: gridItemElem,
      action: () => selectMovie(movie)
    });
  }
  
  gridNavList = new NavigatableList(navItems, GRID_NUM_COLUMNS);
  gridNavList.setActiveItem(0);
  
  // Register key listener.
  window.addEventListener('keydown', event => {
    const wasCaught = activeNavController.handleKey(event.key);
    if (wasCaught) {
      disableMouse();
      event.preventDefault();
      return false;
    }
  });
  
  errorAlertElem.style.display = 'none';
}

/** @param {Movie} movie */
function populateDetailWindow(movie) {
  detailBackgroundImgElem.src = movie.keyartURL;
  detailLogoElem.alt = movie.title;
  detailLogoElem.src = movie.logoURL;
  
  if (!detailBackgroundImgElem.complete) detailBackgroundImgElem.classList.add('loading');
  if (!detailLogoElem.complete) detailLogoElem.classList.add('loading');
  
  ratingImgElems.forEach(x => {
    x.src = movie.rating? RATING_IMG_URL_DICT[movie.rating] : '';
    x.alt = movie.rating;
  });
  closedCaptionsImgElem.style.display = movie.hasSubtitles? '' : 'none';
  movieYearElems.forEach(x => (x.innerText = movie.year));
  runtimeElems.forEach(x => (x.innerText =
   (movie.runtimeMinutes >= 60? Math.floor(movie.runtimeMinutes / 60).toString() + 'h ' : '') +
   (movie.runtimeMinutes % 60).toString() + 'm'
  ));
  generesElems.forEach(x => (x.innerText = movie.genres.join(', ')));
  detailTopPanelDesc.innerText = movie.plot;
  movieTitleElem.innerText = movie.title;
  directorsElem.innerText = movie.directorNames.join(', ');
  
  for (const child of Array.from(starringContainerElem.children)) {
    if (child !== starringElem) {
      starringContainerElem.removeChild(child);
    }
  }
  
  const numStars = Math.min(movie.actorNames?.length || 0, 6);
  for (let i = 0; i < numStars; ++i) {
    const starNode = /** @type {DocumentFragment} */(starTemplate.content.cloneNode(true));
    requireElem('p', starNode).innerText = movie.actorNames[i];
    starringContainerElem.appendChild(starNode);
  }
}

function showDetailWindow() {
  detailWindowElem.classList.remove('hidden');
  detailWindowElem.scrollTo({top: 0, behavior: 'auto'});
  detailButtonsNavList.setActiveItem(1, false);
  gridWindowElem.style.pointerEvents = 'none';
  activeNavController = detailWindowNavController;
}
function hideDetailWindow() {
  detailWindowElem.classList.add('hidden');
  detailButtonsNavList?.setActiveItem(1, false);
  gridWindowElem.style.pointerEvents = '';
  activeNavController = gridWindowNavController;
}

/** @param {Movie} movie */
function selectMovie(movie) {
  if (selectedMovie !== movie) {
    selectedMovie = movie;
    populateDetailWindow(selectedMovie);
  }
  showDetailWindow();
}

/** @param {string} filepath */
function playVideo(filepath) {
  const url = 'movielib.player://' + filepath;
  console.log('Playing', url);
  window.open(url, '_self');
}

let isMouseEnabled = true;
function enableMouse() {
  if (!isMouseEnabled) {
    document.documentElement.classList.remove('disableMouse');
    window.removeEventListener('mousemove', enableMouse);
    isMouseEnabled = true;
  }
}
function disableMouse() {
  if (isMouseEnabled) {
    // NOTE: Chrome (bug?) prevents the cursor from changing until after the first mouse event.
    document.documentElement.classList.add('disableMouse');
    window.addEventListener('mousemove', enableMouse);
    isMouseEnabled = false;
  }
}

init();
} window.addEventListener('DOMContentLoaded', () => load());