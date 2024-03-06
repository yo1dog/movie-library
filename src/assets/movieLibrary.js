'use strict';
function load() {


// ------------------------
// Config
// ------------------------
const GRID_NUM_COLUMNS = 5;
const PLAYER_CONTROLS_TIMEOUT_MS = 3000;
const PLAYER_CONTROLS_TIMEOUT_PLAY_MS = 1000;
const PLAYER_SKIP_SMALL_DURATION_S = 10;
const PLAYER_SKIP_MEDIUM_DURATION_S = 30;
const PLAYER_SKIP_LARGE_DURATION_S = 5*60;
const MEANINGFUL_CONTINUOUS_PLAY_DURATION_S = 60;
/** @type {Config} */
const config = {
  enableGridNavWrap: true,
  enableMouseAtStart: true,
  enableFullscreenToggle: true,
  movies: [],
  tvShows: [],
  fontURLs: [],
};
// ------------------------

/** @type {Record<string, string>} */
const RATING_IMG_URL_DICT = {
  'g': 'assets/rating-g.png',
  'pg': 'assets/rating-pg.png',
  'pg13': 'assets/rating-pg13.png',
  'r': 'assets/rating-r.png',
  'tvy': 'assets/rating-tvy.png',
  'tvy7': 'assets/rating-tvy7.png',
  'tvg': 'assets/rating-tvg.png',
  'tvpg': 'assets/rating-tvpg.png',
  'tv14': 'assets/rating-tv14.png',
  'tvma': 'assets/rating-tvma.png',
};
/** @param {string} rating  */
function getRatingImgURL(rating) {
  return RATING_IMG_URL_DICT[
    rating
    .toLowerCase()
    .replace(/^rating/, '')
    .replace(/[ -]/, '')
  ];
}

/** @typedef {'BACK'|'SELECT'|'LEFT'|'RIGHT'|'UP'|'DOWN'|'DIGIT'} KeyAction  */
/** @type {Record<string, KeyAction>} */
const KEY_ACTION_DICT = {
  'Escape': 'BACK',
  'Backspace': 'BACK',
  'Space': 'SELECT',
  ' ': 'SELECT',
  'Enter': 'SELECT',
  'ArrowLeft': 'LEFT',
  'ArrowRight': 'RIGHT',
  'ArrowUp': 'UP',
  'ArrowDown': 'DOWN',
};
for (let i = 0; i <=9; ++i) {
  KEY_ACTION_DICT[i.toString()] = 'DIGIT';
}

/** @typedef {import('./types').Movie} Movie */
/** @typedef {import('./types').TVShow} TVShow */
/** @typedef {import('./types').Season} Season */
/** @typedef {import('./types').Episode} Episode */
/** @typedef {import('./types').CustomWindow} CustomWindow */
/** @typedef {import('./types').Config} Config */
/** @typedef {import('./lib/libass-wasm-4.1.0/subtitles-octopus')} SubtitlesOctopus */

/**
 * @typedef NavListItemDef
 * @property {string} [slug]
 * @property {HTMLElement} [elem]
 * @property {HTMLElement} [interactiveElem]
 * @property {(event: KeyboardEvent | MouseEvent | undefined, navItem: NavListItem) => void} [action]
 * @property {boolean} [isDisabled]
 * @property {DisabledAction} [disabledAction]
 */
/**
 * @typedef NavListItem
 * @property {string} [slug]
 * @property {HTMLElement} [elem]
 * @property {HTMLElement} [interactiveElem]
 * @property {(event: KeyboardEvent | MouseEvent | undefined, navItem: NavListItem) => void} [action]
 * @property {number} index
 * @property {number} x
 * @property {number} y
 * @property {boolean} isDisabled
 * @property {DisabledAction} disabledAction
 */

const DIRECTION = /** @type {const} */({
  LEFT: 1,
  RIGHT: 2,
  UP: 3,
  DOWN: 4,
});
/** @typedef {DIRECTION[keyof typeof DIRECTION]} Direction */
const DISABLED_ACTION = /** @type {const} */({
  STOP: 0,
  ...DIRECTION,
  SKIP: 5,
  WRAP: 6,
});
/** @typedef {DISABLED_ACTION[keyof typeof DISABLED_ACTION]} DisabledAction */

const navController = (() => {
  let isKeyboardNavActive = false;
  const _switchToMouseNavListener = useMouseNav;
  function useMouseNav() {
    if (isKeyboardNavActive) {
      document.documentElement.classList.remove('keyboardNav');
      document.documentElement.classList.add('mouseNav');
      window.removeEventListener('mousemove', _switchToMouseNavListener);
      isKeyboardNavActive = false;
    }
  }
  function useKeyboardNav() {
    if (!isKeyboardNavActive) {
      // NOTE: Chrome (bug?) prevents the cursor from changing until after the first mouse event.
      document.documentElement.classList.add('keyboardNav');
      document.documentElement.classList.remove('mouseNav');
      window.addEventListener('mousemove', _switchToMouseNavListener);
      isKeyboardNavActive = true;
    }
  }
  /** @param {boolean} [withKeyboardNav] */
  function init(withKeyboardNav) {
    if (withKeyboardNav) {
      useKeyboardNav();
    }
    else {
      isKeyboardNavActive = true;
      useMouseNav();
    }
  }
  return {
    init,
    getIsKeyboardNavActive: () => isKeyboardNavActive,
    useMouseNav,
    useKeyboardNav,
  };
})();

// Simple class for managing navigation state for a list or grid of items.
class NavigatableList {
  /**
   * @param {NavListItemDef[]} itemDefs
   * @param {number} [gridNumColumns]
   * @param {boolean} [enableWrap]
   */
  constructor(itemDefs, gridNumColumns, enableWrap) {
    if (itemDefs.length === 0) throw new Error(`No items given.`);
    
    this.numColumns = gridNumColumns || itemDefs.length;
    this.numRows = Math.ceil(itemDefs.length / this.numColumns);
    this.enableWrap = enableWrap ?? false;
    
    // For each given item, calculate some values and add it to the list.
    /** @type {NavListItem[]} */
    this.items = [];
    for (let i = 0; i < itemDefs.length; ++i) {
      /** @type {NavListItem} */
      const item = {
        slug: itemDefs[i].slug,
        elem: itemDefs[i].elem,
        interactiveElem: itemDefs[i].interactiveElem || itemDefs[i].elem,
        action: itemDefs[i].action,
        index: i,
        x: i % this.numColumns,
        y: Math.floor(i / this.numColumns),
        isDisabled: false,
        disabledAction: itemDefs[i].disabledAction || DISABLED_ACTION.STOP,
      };
      if (itemDefs[i].isDisabled) {
        NavigatableList.#setItemIsDisabled(item, true);
      }
      
      // Add listeners for mouse events.
      item.interactiveElem?.addEventListener('click', event => {
        this.setActiveItem(item.index, false);
        item.action?.(event, item);
      });
      item.interactiveElem?.addEventListener('mouseenter', () => {
        this.setActiveItem(item.index, false);
      });
      
      this.items.push(item);
    }
    
    /** @type {NavListItem | undefined} */
    this.activeItem = undefined;
    this.activeItemIsHidden = false;
  }
  
  /**
   * Changes the active item relative to the current active item while constrained to the grid.
   * @param {Direction} direction
   */
  move(direction) {
    if (!this.activeItem) {
      this.setActiveItem(0);
      return;
    }
    
    let index = this.activeItem.index;
    let x = this.activeItem.x;
    let y = this.activeItem.y;
    const visitedIndexes = [index];
    const yOverflowMaxIndex = this.items.length - 1 - this.numColumns;
    
    // eslint-disable-next-line no-constant-condition
    while (true) {
      switch (direction) {
        case DIRECTION.LEFT:
          if (x === 0) {
            if (!this.enableWrap || y === 0) {
              return;
            }
            x = this.items.length - 1;
            --y;
          }
          else {
            --x;
          }
          --index;
          break;
        case DIRECTION.RIGHT:
          if (index === this.items.length - 1) {
            return;
          }
          if (x === this.numColumns - 1) {
            if (!this.enableWrap || y === this.numRows - 1) {
              return;
            }
            x = 0;
            ++y;
          }
          else {
            ++x;
          }
          ++index;
          break;
        case DIRECTION.UP:
          if (y === 0) {
            return;
          }
          --y;
          index -= this.numColumns;
          break;
        case DIRECTION.DOWN:
          if (y === this.numRows - 1) {
            return;
          }
          ++y;
          if (index > yOverflowMaxIndex) {
            x -= index - yOverflowMaxIndex;
            index = this.items.length - 1;
          }
          else {
            index += this.numColumns;
          }
        break;
      }
      
      if (visitedIndexes.includes(index)) {
        return;
      }
      
      const item = this.items[index];
      if (!item.isDisabled) {
        break;
      }
      
      if (item.disabledAction === DISABLED_ACTION.STOP) {
        return;
      }
      else if (item.disabledAction === DISABLED_ACTION.WRAP) {
        // if (!this.enableWrap) {
        //   return;
        // }
        if (direction !== DIRECTION.RIGHT) {
          direction = DIRECTION.LEFT;
        }
      }
      else if (item.disabledAction !== DISABLED_ACTION.SKIP) {
        direction = item.disabledAction;
      }
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
      this.activeItem.elem?.classList.remove('active');
    }
    
    this.activeItem = newActiveItem;
    
    if (this.activeItem && !this.activeItemIsHidden) {
      this.activeItem.elem?.classList.add('active');
      if (scroll) {
        this.activeItem.elem?.scrollIntoView({
          // Smooth scrolling momentum in Chrome stops after each scroll command, so it becomes very
          // jumpy and lags behind.
          //behavior: isFirefox? 'smooth' : 'instant',
          behavior: 'smooth',
          block: 'nearest',
          inline: 'nearest',
        });
      }
    }
  }
  
  /**
   * @param {NavListItem} item 
   * @param {boolean} isDisabled 
   */
  static #setItemIsDisabled(item, isDisabled) {
    item.isDisabled = isDisabled;
    item.elem?.classList.toggle('disabled', isDisabled);
  }
  
  /**
   * @param {number} index 
   * @param {boolean} isDisabled
   */
  setItemIsDisabled(index, isDisabled) {
    NavigatableList.#setItemIsDisabled(this.items[index], isDisabled);
  }
  
  /** @param {KeyboardEvent | MouseEvent} [event] */
  performActiveAction(event) {
    if (!this.activeItem) return;
    if (this.activeItem.isDisabled) return;
    this.activeItem.action?.(event, this.activeItem);
    return this.activeItem;
  }
  
  /** @param {string} slug  */
  activateAndPerformSlug(slug) {
    const index = this.items.findIndex(x => x.slug === slug);
    if (index === -1) return;
    this.setActiveItem(index);
    return this.performActiveAction();
  }
  
  hideActiveItem() {
    this.activeItem?.elem?.classList.remove('active');
    this.activeItemIsHidden = true;
  }
  unhideActiveItem() {
    this.activeItem?.elem?.classList.add('active');
    this.activeItemIsHidden = false;
  }
}

const menuScreenTemplate = /** @type {HTMLTemplateElement} */(requireElem('#menuScreenTemplate'));
const gridScreenTemplate = /** @type {HTMLTemplateElement} */(requireElem('#gridScreenTemplate'));
const detailScreenTemplate = /** @type {HTMLTemplateElement} */(requireElem('#detailScreenTemplate'));
const tvShowScreenTemplate = /** @type {HTMLTemplateElement} */(requireElem('#tvShowScreenTemplate'));
const pinScreenTemplate = /** @type {HTMLTemplateElement} */(requireElem('#pinScreenTemplate'));
const playerScreenTemplate = /** @type {HTMLTemplateElement} */(requireElem('#playerScreenTemplate'));

/** @type {Screen[]} */
const screens = [];
/** @type {string[]} */
let deeplinkSlugs = [];

class Screen {
  /** @type {(() => void) | undefined} */
  #onHideStartCB;
  
  /**
   * @param {HTMLElement} elem 
   */
  constructor(elem) {
    this.elem = elem;
    this.transitionAnimation = new Animation(new KeyframeEffect(
      elem,
      {opacity: [0, 1]},
      {
        duration: 200,
        easing: 'ease-out',
        // NOTE: Do not use fill: 'forward' or 'both' as the opacity gets stuck at 99% instead of
        // 100% in Chrome.
      }
    ));
    this.transitionAnimationIsReversed = false;
    this.isShown = false;
    this.isClosed = false;
  }
  
  #playTransitionAnimationForward() {
    if (this.transitionAnimationIsReversed) {
      this.transitionAnimation.reverse();
      this.transitionAnimationIsReversed = false;
    }
    else {
      this.transitionAnimation.play();
    }
  }
  #playTransitionAnimationBackward() {
    if (this.transitionAnimationIsReversed) {
      this.transitionAnimation.play();
    }
    else {
      this.transitionAnimation.reverse();
      this.transitionAnimationIsReversed = true;
    }
  }
  
  /**
   * @param {KeyboardEvent} event
   * @param {string | undefined} keyAction
   * @returns {0|1|2}
   */
  handleKey(event, keyAction) {
    return 0;
  }
  
  /** @param {string} slug */
  handleDeeplinkSlug(slug) {
    // noop
  }
  
  /**
   * @returns {this}
   */
  show() {
    if (this.isShown) return this;
    if (this.isClosed) throw new Error(`Cannot show a screen that has been closed.`);
    document.body.appendChild(this.elem);
    
    const index = screens.indexOf(this);
    if (index > 0) {
      screens.splice(index, 1);
    }
    screens.unshift(this);
    this.elem.inert = false;
    if (screens.length > 1) {
      screens[1].elem.inert = true;
    }
    
    if (screens.length > 0) {
      this.#playTransitionAnimationForward();
    }
    this.isShown = true;
    
    // TODO: Hack to auto close Pin screen
    if (screens[1] instanceof PinScreen) {
      const pinScreen = screens[1];
      this.transitionAnimation.addEventListener('finish', () => {
        pinScreen.close();
      });
    }
    
    if (deeplinkSlugs.length > 0) {
      const slug = /** @type {typeof deeplinkSlugs[number]} */(deeplinkSlugs.shift());
      this.handleDeeplinkSlug(slug);
      deeplinkSlugs = [];
    }
    
    return this;
  }
  
  /** @param {(() => void) | undefined} cb */
  setOnHideStartCB(cb) {
    this.#onHideStartCB = cb;
  }
  
  hide() {
    if (screens.length === 1) return;
    if (!this.isShown) return;
    const index = screens.indexOf(this);
    if (index === -1) return;
    screens.splice(index, 1);
    
    this.elem.inert = true;
    if (index === 0 && screens.length > 0) {
      // Should never happen, but ensure hidden and closed screens never become uninert.
      if (screens[0].isShown && !screens[0].isClosed) {
        screens[0].elem.inert = false;
      }
    }
    
    this.isShown = false;
    this.#onHideStartCB?.();
    
    if (!this.transitionAnimation.currentTime) {
      return;
    }
    
    this.#playTransitionAnimationBackward();
    
    // TODO: Hack to auto close Pin screen
    if (screens[0] instanceof PinScreen) {
      screens[0].close();
    }
    
    return true;
  }
  
  close() {
    if (screens.length === 1) return;
    this.isClosed = true;
    const didPlayAnimation = this.hide();
    if (didPlayAnimation) {
      this.transitionAnimation.addEventListener('finish', () => {
        this.elem.remove();
      });
    }
    else {
      this.elem.remove();
    }
  }
}

/**
 * @typedef MenuItem
 * @property {string} title
 * @property {string} [imageURL]
 * @property {() => void} action
 */

class MenuScreen extends Screen {
  /**
   * @param {MenuItem[]} menuItems
   * @param {boolean} [incBack]
   */
  constructor(menuItems, incBack) {
    const frag = /** @type {DocumentFragment} */(menuScreenTemplate.content.cloneNode(true));
    const screenElem = requireElem('main', frag);
    const gridElem = requireElem('.grid', screenElem);
    const gridItemTemplate = /** @type {HTMLTemplateElement} */(gridElem.getElementsByTagName('TEMPLATE')[0]);
    
    // TODO: hack
    if (incBack) {
      menuItems.unshift({
        title: 'Back',
        action: () => this.close(),
      });
    }
    
    gridElem.style.gridTemplateColumns = `repeat(${menuItems.length}, minmax(auto, 25vw))`;
    
    /** @type {NavListItemDef[]} */
    const navItems = [];
    for (const menuItem of menuItems) {
      const gridItemNode = /** @type {DocumentFragment} */(gridItemTemplate.content.cloneNode(true));
      const gridItemElem = requireElem('.gridItem', gridItemNode);
      const gridItemTileElem = requireElem('.gridItemTile', gridItemNode);
      const gridItemTextElem = requireElem('.gridItemText', gridItemNode);
      const gridItemImgElem = /**@type {HTMLImageElement} */(requireElem('.gridItemImg', gridItemNode));
      
      // TODO: hack
      if (incBack && menuItem === menuItems[0]) {
        const template = document.createElement('template');
        template.innerHTML = '<svg class="gridItemSvg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 122.88 108.06"><path d="M63.94,24.28a14.28,14.28,0,0,0-20.36-20L4.1,44.42a14.27,14.27,0,0,0,0,20l38.69,39.35a14.27,14.27,0,0,0,20.35-20L48.06,68.41l60.66-.29a14.27,14.27,0,1,0-.23-28.54l-59.85.28,15.3-15.58Z"/></svg>';
        const svgElem = requireElem('svg', template.content);
        gridItemTextElem.insertAdjacentElement('afterend', svgElem);
        gridItemTextElem.remove();
        gridItemImgElem.remove();
      }
      
      gridItemTextElem.innerText = menuItem.title;
      
      if (menuItem.imageURL) {
        gridItemImgElem.src = menuItem.imageURL;
      }
      else {
        gridItemImgElem.remove();
      }
      
      gridElem.appendChild(gridItemElem);
      navItems.push({
        slug: menuItem.title,
        elem: gridItemElem,
        interactiveElem: gridItemTileElem,
        action: () => menuItem.action(),
      });
    }
    
    const navList = new NavigatableList(navItems);
    navList.setActiveItem(0, false);
    
    super(screenElem);
    this.navList = navList;
  }
  
  /**
   * @param {KeyboardEvent} event
   * @param {string | undefined} keyAction
   */
  handleKey(event, keyAction) {
    switch (keyAction) {
      case 'BACK':
        if (event.repeat) return 2;
        this.close();
        return 2;
      case 'SELECT':
        if (event.repeat) return 2;
        this.navList.performActiveAction(event);
        return 1;
      case 'LEFT':
        this.navList.move(DIRECTION.LEFT);
        return 1;
      case 'RIGHT':
        this.navList.move(DIRECTION.RIGHT);
        return 1;
    }
    return super.handleKey(event, keyAction);
  }
  
  /** @param {string} slug  */
  handleDeeplinkSlug(slug) {
    this.navList.activateAndPerformSlug(slug);
  }
}

class GridScreen extends Screen {
  /**
   * @param {MenuItem[]} menuItems
   * @param {boolean} [enableWrap]
   */
  constructor(menuItems, enableWrap) {
    const frag = /** @type {DocumentFragment} */(gridScreenTemplate.content.cloneNode(true));
    const screenElem = requireElem('main', frag);
    const gridElem = requireElem('.grid', screenElem);
    const gridItemTemplate = /** @type {HTMLTemplateElement} */(gridElem.getElementsByTagName('TEMPLATE')[0]);
    
    gridElem.style.gridTemplateColumns = `repeat(${GRID_NUM_COLUMNS}, minmax(0, 1fr))`;
    
    /** @type {NavListItemDef[]} */
    const navItems = [];
    
    // TODO: hack
    menuItems.unshift({
      title: 'Back',
      action: () => this.close(),
    });
    for (const menuItem of menuItems) {
      const gridItemNode = /** @type {DocumentFragment} */(gridItemTemplate.content.cloneNode(true));
      const gridItemElem = requireElem('.gridItem', gridItemNode);
      const gridItemTileElem = requireElem('.gridItemTile', gridItemNode);
      const gridItemTextElem = requireElem('.gridItemText', gridItemNode);
      const gridItemImgElem = /**@type {HTMLImageElement} */(requireElem('.gridItemImg', gridItemNode));
      
      // TODO: hack
      if (menuItem === menuItems[0]) {
        const template = document.createElement('template');
        template.innerHTML = '<svg class="gridItemSvg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 122.88 108.06"><path d="M63.94,24.28a14.28,14.28,0,0,0-20.36-20L4.1,44.42a14.27,14.27,0,0,0,0,20l38.69,39.35a14.27,14.27,0,0,0,20.35-20L48.06,68.41l60.66-.29a14.27,14.27,0,1,0-.23-28.54l-59.85.28,15.3-15.58Z"/></svg>';
        const svgElem = requireElem('svg', template.content);
        gridItemTextElem.insertAdjacentElement('afterend', svgElem);
        gridItemTextElem.remove();
        gridItemImgElem.remove();
      }
      
      gridItemTextElem.innerText = menuItem.title;
      
      if (menuItem.imageURL) {
        gridItemImgElem.src = menuItem.imageURL;
      }
      // else if (menuItem.logoURL) {
      //   gridItemImgElem.src = menuItem.logoURL;
      //   gridItemImgElem.style.objectFit = 'contain';
      //   gridItemImgElem.style.padding = '5%';
      //   gridItemTextElem.remove();
      // }
      else {
        gridItemImgElem.remove();
      }
      
      gridElem.appendChild(gridItemElem);
      navItems.push({
        slug: menuItem.title,
        elem: gridItemElem,
        interactiveElem: gridItemTileElem,
        action: () => menuItem.action()
      });
    }
    
    const navList = new NavigatableList(navItems, GRID_NUM_COLUMNS, enableWrap);
    navList.setActiveItem(0, false);
    
    super(screenElem);
    this.navList = navList;
  }
  
  /**
   * @param {KeyboardEvent} event
   * @param {string | undefined} keyAction
   */
  handleKey(event, keyAction) {
    switch (keyAction) {
      case 'BACK':
        if (event.repeat) return 2;
        this.close();
        return 2;
      case 'SELECT':
        if (event.repeat) return 2;
        this.navList.performActiveAction(event);
        return 1;
      case 'LEFT':
        this.navList.move(DIRECTION.LEFT);
        return 1;
      case 'RIGHT':
        this.navList.move(DIRECTION.RIGHT);
        return 1;
      case 'UP':
        this.navList.move(DIRECTION.UP);
        return 1;
      case 'DOWN':
        this.navList.move(DIRECTION.DOWN);
        return 1;
    }
    return super.handleKey(event, keyAction);
  }
  
  /** @param {string} slug  */
  handleDeeplinkSlug(slug) {
    this.navList.activateAndPerformSlug(slug);
  }
}

class DetailScreen extends Screen {
  /**
   * @param {Movie} movie 
   */
  constructor(movie) {
    const frag = /** @type {DocumentFragment} */(detailScreenTemplate.content.cloneNode(true));
    const screenElem = requireElem('main', frag);
    
    const backButtonElem = requireElem('.backButton', screenElem);
    const playButtonElem = requireElem('.playButton', screenElem);
    const detailBackgroundImgElem = /** @type {HTMLImageElement} */(requireElem('.detailBackgroundImgContainer img', screenElem));
    const detailLogoElem = /** @type {HTMLImageElement} */(requireElem('.detailLogo', screenElem));
    const ratingImgElems = /** @type {HTMLImageElement[]} */(Array.from(screenElem.querySelectorAll('.ratingImg')));
    const closedCaptionsImgElem = /** @type {HTMLImageElement} */(requireElem('.closedCaptionsImg', screenElem));
    const movieYearElems = /** @type {HTMLElement[]} */(Array.from(screenElem.querySelectorAll('.mediaYear')));
    const runtimeElems = /** @type {HTMLElement[]} */(Array.from(screenElem.querySelectorAll('.runtime')));
    const generesElems = /** @type {HTMLElement[]} */(Array.from(screenElem.querySelectorAll('.generes')));
    const detailTopPanelDesc = requireElem('.detailTopPanelDesc', screenElem);
    const movieTitleElem = requireElem('.mediaTitle', screenElem);
    const directorsElem = requireElem('.directors', screenElem);
    const starringElem = requireElem('.starring', screenElem);
    const starringContainerElem = /** @type {HTMLElement} */(starringElem.parentElement);
    const starTemplate = /** @type {HTMLTemplateElement} */(starringContainerElem.getElementsByTagName('TEMPLATE')[0]);
    
    detailBackgroundImgElem.src = movie.keyartURL;
    detailLogoElem.alt = movie.title;
    detailLogoElem.src = movie.logoURL;
    
    for (const imgElem of [detailLogoElem, detailBackgroundImgElem]) {
      if (!imgElem.complete) {
        imgElem.classList.add('loading');
        imgElem.addEventListener('load',  () => imgElem.classList.remove('loading'));
        imgElem.addEventListener('error', () => imgElem.classList.remove('loading'));
      }
    }
    
    ratingImgElems.forEach(x => {
      if (movie.rating === 'na') {
        x.style.display = 'none';
      }
      const url = movie.rating? getRatingImgURL(movie.rating) : '';
      x.src = url;
      x.alt = movie.rating;
      if (!url) x.style.height = 'auto';
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
        child.remove();
      }
    }
    
    const numStars = Math.min(movie.actorNames?.length || 0, 6);
    for (let i = 0; i < numStars; ++i) {
      const starNode = /** @type {DocumentFragment} */(starTemplate.content.cloneNode(true));
      requireElem('p', starNode).innerText = movie.actorNames[i];
      starringContainerElem.appendChild(starNode);
    }
    
    const navList = new NavigatableList([{
      elem: backButtonElem,
      action: () => this.close()
    }, {
      elem: playButtonElem,
      action: () => new PlayerScreen({
        videoURL: movie.videoURL,
        sasSubtitleAssURL: movie.sasSubtitleAssURL,
        title: movie.title,
      }).show()
    }]);
    navList.setActiveItem(1, false);
    
    super(screenElem);
    this.navList = navList;
  }
  
  /**
   * @param {KeyboardEvent} event
   * @param {string | undefined} keyAction
   */
  handleKey(event, keyAction) {
    switch (keyAction) {
      case 'BACK':
        if (event.repeat) return 2;
        this.close();
        return 2;
      case 'SELECT':
        if (event.repeat) return 2;
        this.navList.performActiveAction(event);
        return 1;
      case 'LEFT':
        this.navList.move(DIRECTION.LEFT);
        return 1;
      case 'RIGHT':
        this.navList.move(DIRECTION.RIGHT);
        return 1;
      case 'UP':
        if (event.repeat) return 2;
        this.elem.scrollTo({
          behavior: 'smooth',
          top: 0
        });
        return 1;
      case 'DOWN':
        if (event.repeat) return 2;
        this.elem.scrollTo({
          behavior: 'smooth',
          top: this.elem.scrollHeight
        });
        return 1;
    }
    return super.handleKey(event, keyAction);
  }
}

class TVShowScreen extends Screen {
  /**
   * @param {TVShow} tvShow 
   * @param {boolean} [enableWrap]
   */
  constructor(tvShow, enableWrap) {
    const frag = /** @type {DocumentFragment} */(tvShowScreenTemplate.content.cloneNode(true));
    const screenElem = requireElem('main', frag);
    
    const backButtonElem = requireElem('.backButton', screenElem);
    const playButtonElem = requireElem('.playButton', screenElem);
    const playButtonLabelElem = requireElem('span', playButtonElem);
    const detailBackgroundImgElem = /** @type {HTMLImageElement} */(requireElem('.detailBackgroundImgContainer img', screenElem));
    const detailLogoElem = /** @type {HTMLImageElement} */(requireElem('.detailLogo', screenElem));
    const ratingImgElem = /** @type {HTMLImageElement} */(requireElem('.ratingImg', screenElem));
    const mediaYearElem = requireElem('.mediaYear', screenElem);
    const episodeCountElem = requireElem('.episodeCount', screenElem);
    // const detailTopPanelDesc = requireElem('.detailTopPanelDesc', screenElem);
    const seasonsContainerElem = requireElem('.seasonsContainer', screenElem);
    const seasonTemplate = /** @type {HTMLTemplateElement} */(screenElem.getElementsByTagName('TEMPLATE')[0]);
    
    const playlistState = getPlaylistState(`tvshow-${tvShow.id}`);
    
    /** @type {{episode: Episode; gridItemElem: HTMLElement}[]} */
    const playlistEpisodes = [];
    /** @type {PlaylistItem[]} */
    const playlistItems = [];
    
    detailBackgroundImgElem.src = tvShow.posterURL;
    detailLogoElem.alt = tvShow.title;
    detailLogoElem.src = tvShow.logoURL;
    
    for (const imgElem of [detailLogoElem, detailBackgroundImgElem]) {
      if (!imgElem.complete) {
        imgElem.classList.add('loading');
        imgElem.addEventListener('load',  () => imgElem.classList.remove('loading'));
        imgElem.addEventListener('error', () => imgElem.classList.remove('loading'));
      }
    }
    
    if (tvShow.rating && tvShow.rating !== 'na') {
      const ratingImgURL = getRatingImgURL(tvShow.rating) || '';
      ratingImgElem.src = ratingImgURL;
      ratingImgElem.alt = tvShow.rating;
      if (!ratingImgURL) ratingImgElem.style.height = 'auto';
    }
    else {
      ratingImgElem.remove();
    }
    
    mediaYearElem.innerText = tvShow.year;
    // detailTopPanelDesc.innerText = tvShow.plot;
    
    /** @param {number} [playlistIndex] */
    function startPlayer(playlistIndex) {
      new PlayerScreen(playlistItems, {
        playlistState,
        delayStateUpdate: true,
        initalPlaylistPosition: (
          playlistIndex === undefined || playlistIndex === playlistState.videoIndex
          ? undefined
          : {index: playlistIndex}
        )
      })
      .show()
      .setOnHideStartCB(() => updatePlaylistStateUI());
    }
    
    function updatePlaylistStateUI() {
      // if (playlistState.videoIndex === 0 && playlistState.videoElapsedSec === 0) {
      //   playButtonLabelElem.innerText = 'START';
      // }
      // else {
      //   let label = 'RESUME';
      //   const episode = playlistEpisodes[playlistState.videoIndex]?.episode;
      //   if (episode) {
      //     label += ` S${episode.seasonNumber}:E${episode.episodeNumber}`;
      //   }
      //   playButtonLabelElem.innerText = label;
      // }
      playButtonLabelElem.innerText = (
        playlistState.videoIndex === 0 && playlistState.videoElapsedSec === 0
        ? 'START'
        : 'RESUME'
      );
      
      for (let i = 0; i < playlistEpisodes.length; ++i) {
        playlistEpisodes[i].gridItemElem.classList.toggle(
          'watched',
          playlistState.videoIndex > i
        );
      }
    }
    
    /** @type {NavListItemDef[]} */
    const navItems = [{
      elem: backButtonElem,
      action: () => this.close()
    }, {
      elem: playButtonElem,
      action: () => startPlayer()
    }];
    while (navItems.length % GRID_NUM_COLUMNS > 0) {
      navItems.push({
        isDisabled: true,
        disabledAction: DISABLED_ACTION.WRAP,
      });
    }
    
    for (const season of tvShow.seasons) {
      while (navItems.length % GRID_NUM_COLUMNS > 0) {
        navItems.push({
          isDisabled: true,
          disabledAction: DISABLED_ACTION.WRAP
        });
      }
      
      const seasonFrag = /** @type {DocumentFragment} */(seasonTemplate.content.cloneNode(true));
      const seasonElem = requireElem('.season', seasonFrag);
      const gridElem = requireElem('.grid', seasonElem);
      const gridItemTemplate = /** @type {HTMLTemplateElement} */(gridElem.getElementsByTagName('TEMPLATE')[0]);
      
      gridElem.style.gridTemplateColumns = `repeat(${GRID_NUM_COLUMNS}, minmax(0, 1fr))`;
      
      const detailNavItemElem = requireElem('.detailNavItem', seasonFrag);
      detailNavItemElem.innerText = season.seasonNumber === 0? 'Specials' : `Season ${season.seasonNumber}`;
      
      seasonsContainerElem.appendChild(seasonElem);
      
      for (const episode of season.episodes) {
        const gridItemNode = /** @type {DocumentFragment} */(gridItemTemplate.content.cloneNode(true));
        const gridItemElem = requireElem('.gridItem', gridItemNode);
        const gridItemTileElem = requireElem('.gridItemTile', gridItemNode);
        const gridItemImgElem = /**@type {HTMLImageElement} */(requireElem('.gridItemImg', gridItemNode));
        const gridItemEpisodeNumElem = requireElem('.gridItemTitleContainer .episodeNum', gridItemNode);
        const gridItemTitleElem = requireElem('.gridItemTitleContainer .title', gridItemNode);
        const gridItemRuntimeElem = requireElem('.gridItemTitleContainer .runtime', gridItemNode);
        // const gridItemDescriptionElem = requireElem('.gridItemDescription', gridItemNode);
        
        if (episode.thumbURL) {
          gridItemImgElem.src = episode.thumbURL;
        }
        else {
          gridItemImgElem.remove();
        }
        
        let playerSubtitle;
        if (episode.seasonNumber === 0) {
          playerSubtitle = 'SPECIAL: ';
          gridItemEpisodeNumElem.innerText = 'SPECIAL: ';
          gridItemEpisodeNumElem.classList.add('special');
        }
        else {
          const episodeNumStr = formatEpisodeNum(episode);
          if (episodeNumStr) {
            playerSubtitle = `S${episode.seasonNumber}:E${episodeNumStr} `;
            gridItemEpisodeNumElem.innerText = `${episodeNumStr}. `;
          }
          else {
            playerSubtitle = '';
            gridItemEpisodeNumElem.remove();
          }
        }
        
        const episodeTitleStr = formatEpisodeTitle(episode);
        playerSubtitle += episodeTitleStr;
        gridItemTitleElem.innerText = episodeTitleStr;
        
        if (episode.runtimeMinutes) {
          gridItemRuntimeElem.innerText += ` (${episode.runtimeMinutes}m)`;
        }
        else {
          gridItemRuntimeElem.remove();
        }
        
        // if (!episode.plot) {
        //   gridItemDescriptionElem.remove();
        // }
        // else {
        //   gridItemDescriptionElem.innerText = episode.plot;
        // }
        
        const playlistIndex = playlistEpisodes.length;
        playlistEpisodes.push({
          episode,
          gridItemElem
        });
        
        playlistItems.push({
          videoURL: episode.videoURL,
          sasSubtitleAssURL: episode.sasSubtitleAssURL,
          title: tvShow.title,
          subtitle: playerSubtitle,
        });
        
        gridElem.appendChild(gridItemElem);
        navItems.push({
          slug: episode.id,
          elem: gridItemElem,
          interactiveElem: gridItemTileElem,
          action: () => startPlayer(playlistIndex)
        });
      }
    }
    
    updatePlaylistStateUI();
    
    episodeCountElem.innerText = `${playlistEpisodes.length} episode${playlistEpisodes.length !== 1? 's' : ''}`;
    
    const navList = new NavigatableList(navItems, GRID_NUM_COLUMNS, enableWrap);
    navList.setActiveItem(1, false);
    
    super(screenElem);
    this.navList = navList;
  }
  
  /**
   * @param {KeyboardEvent} event
   * @param {string | undefined} keyAction
   */
  handleKey(event, keyAction) {
    switch (keyAction) {
      case 'BACK':
        if (event.repeat) return 2;
        this.close();
        return 2;
      case 'SELECT':
        if (event.repeat) return 2;
        this.navList.performActiveAction(event);
        return 1;
      case 'LEFT':
        this.navList.move(DIRECTION.LEFT);
        return 1;
      case 'RIGHT':
        this.navList.move(DIRECTION.RIGHT);
        return 1;
      case 'UP':
        if (this.navList.activeItem?.y === 0) {
          this.elem.scrollTo({
            behavior: 'smooth',
            top: 0
          });
          return 1;
        }
        else if (this.navList.activeItem?.y === 1) {
          // when moving from the episode grid to the button controls, always select back button
          this.navList.setActiveItem(0);
        }
        else {
          this.navList.move(DIRECTION.UP);
        }
        return 1;
      case 'DOWN':
        if (this.navList.activeItem?.y === 0) {
          // when moving from the button controls to the episode grid, always select the first episode
          this.navList.setActiveItem(this.navList.numColumns);
        }
        else {
          this.navList.move(DIRECTION.DOWN);
        }
        return 1;
    }
    return super.handleKey(event, keyAction);
  }
  
  /** @param {string} slug  */
  handleDeeplinkSlug(slug) {
    this.navList.activateAndPerformSlug(slug);
  }
}

class PinScreen extends Screen {
  /**
   * @param {string} pin 
   * @param {() => void} action 
   */
  constructor(pin, action) {
    if (pin.length === 0) throw new Error(`Pin cannot be empty.`);
    const frag = /** @type {DocumentFragment} */(pinScreenTemplate.content.cloneNode(true));
    const screenElem = requireElem('main', frag);
    
    const pinContainerElem = requireElem('.pinContainer', screenElem);
    const pinCharTemplate = /** @type {HTMLTemplateElement} */(pinContainerElem.getElementsByTagName('TEMPLATE')[0]);
    const pinCharInfos = [];
    for (let i = 0; i < pin.length; ++i) {
      const pinCharFrag = /** @type {DocumentFragment} */(pinCharTemplate.content.cloneNode(true));
      const pinCharElem = requireElem('.pinChar', pinCharFrag);
      const badAnimationDelay = 250 + (i * Math.max(50, 200 / pin.length));
      pinCharInfos.push({
        elem: pinCharElem,
        badAnimationDelay,
        badAnimation: new Animation(new KeyframeEffect(
          requireElem('.dot', pinCharElem),
          {opacity: [1, 0]},
          {
            duration: 200,
            easing: 'ease-out',
            fill: 'backwards',
            delay: badAnimationDelay
          }
        ))
      });
      pinContainerElem.appendChild(pinCharElem);
    }
    
    const pinNavList = new NavigatableList(pinCharInfos.map(x => ({
      elem: x.elem,
      action: () => {/*noop*/}
    })));
    pinNavList.setActiveItem(0);
    
    const numpadElem = requireElem('.numpad', screenElem);
    /** @type {NavListItemDef[]} */
    const numpadNavListItems = [];
    for (let digit = 0; digit < 10; ++digit) {
      numpadNavListItems.push({
        elem: requireElem(`.numpad${digit}`, numpadElem),
        action: () => this.addPinChar(digit.toString())
      });
    }
    /** @type {NavListItemDef} */
    const numpadBackListItem = {
      elem: requireElem(`.numpadBack`, numpadElem),
      action: () => {
        if (this.pinInputStr.length === 0) {
          this.close();
        }
        else {
          this.removePinChar();
        }
      }
    };
    
    const numpadNavList = new NavigatableList([
      ...numpadNavListItems.slice(1, 10),
      numpadBackListItem,
      numpadNavListItems[0]
    ], 3);
    numpadNavList.setActiveItem(0);
    
    super(screenElem);
    this.pin = pin;
    this.pinInputStr = '';
    this.pinNavList = pinNavList;
    this.numpadNavList = numpadNavList;
    this.pinCharInfos = pinCharInfos;
    this.action = action;
    
    this.isNumpadFocused = true;
    this.focusPin();
  }
  
  focusNumpad() {
    if (this.isNumpadFocused) return;
    this.pinNavList.hideActiveItem();
    this.numpadNavList.unhideActiveItem();
    this.isNumpadFocused = true;
  }
  focusPin() {
    if (!this.isNumpadFocused) return;
    this.pinNavList.unhideActiveItem();
    this.numpadNavList.hideActiveItem();
    this.numpadNavList.setActiveItem(-1);
    this.isNumpadFocused = false;
  }
  
  /** @param {string} char */
  addPinChar(char) {
    this.pinInputStr += char;
    
    if (this.pinInputStr.length === 1) {
      for (const pinCharInfo of this.pinCharInfos) {
        if (pinCharInfo.badAnimation.playState === 'running') {
          pinCharInfo.badAnimation.currentTime = Math.max(
            pinCharInfo.badAnimationDelay,
            Number(pinCharInfo.badAnimation.currentTime)
          );
        }
      }
    }
    
    this.pinCharInfos[this.pinInputStr.length - 1]?.elem.classList.add('filled');
    this.pinCharInfos[this.pinInputStr.length - 1]?.elem.classList.remove('bad');
    this.pinCharInfos[this.pinInputStr.length - 1]?.badAnimation.cancel();
    this.pinNavList.setActiveItem(this.pinInputStr.length);
    
    if (this.pinInputStr.length < this.pin.length) return;
    if (this.pinInputStr === this.pin) {
      this.action();
    }
    else {
      this.pinInputStr = '';
      for (const pinCharInfo of this.pinCharInfos) {
        pinCharInfo.elem.classList.remove('filled');
        pinCharInfo.elem.classList.add('bad');
        pinCharInfo.badAnimation.currentTime = 0;
        pinCharInfo.badAnimation.play();
      }
      this.pinNavList.setActiveItem(0);
    }
  }
  removePinChar() {
    if (this.pinInputStr.length === 0) {
      this.pinNavList.setActiveItem(0);
      return;
    }
    this.pinInputStr = this.pinInputStr.slice(0, -1);
    this.pinCharInfos[this.pinInputStr.length].elem.classList.remove('filled');
    this.pinNavList.setActiveItem(this.pinInputStr.length);
  }
  
  /**
   * @param {KeyboardEvent} event
   * @param {string | undefined} keyAction
   */
  handleKey(event, keyAction) {
    switch (event.key) {
      case 'Backspace':
        this.removePinChar();
        return 2;
    }
    switch (keyAction) {
      case 'BACK':
        if (event.repeat) return 2;
        this.close();
        return 2;
      case 'SELECT':
        if (event.repeat) return 2;
        if (this.isNumpadFocused) {
          this.numpadNavList.performActiveAction(event);
        }
        else {
          this.focusNumpad();
        }
        return 1;
      case 'LEFT':
        this.focusNumpad();
        this.numpadNavList.move(DIRECTION.LEFT);
        return 1;
      case 'RIGHT':
        this.focusNumpad();
        this.numpadNavList.move(DIRECTION.RIGHT);
        return 1;
      case 'UP':
        this.focusNumpad();
        this.numpadNavList.move(DIRECTION.UP);
        return 1;
      case 'DOWN':
        this.focusNumpad();
        this.numpadNavList.move(DIRECTION.DOWN);
        return 1;
      case 'DIGIT':
        this.focusPin();
        this.addPinChar(event.key);
        return 1;
    }
    return super.handleKey(event, keyAction);
  }
  
  /** @param {string} slug  */
  handleDeeplinkSlug(slug) {
    if (slug !== 'x') return;
    this.action();
  }
}

/**
 * @typedef VideoPlayerSingleton
 * @property {HTMLElement} videoPlayerSingletonElem
 * @property {HTMLVideoElement} videoElem
 * @property {SubtitlesOctopus} subOctopus
 */

class VideoPlayerSingletonRef {
  /** @type {VideoPlayerSingleton | undefined} */
  static #singleton;
  static #curRef = new VideoPlayerSingletonRef();
  
  /** @param {VideoPlayerSingleton} singleton */
  static init(singleton) {
    if (this.#singleton) throw new Error(`Initialized twice.`);
    this.#singleton = singleton;
    singleton.videoElem.addEventListener('loadedmetadata', ev => this.#curRef.onloadedmetadata?.(ev));
    singleton.videoElem.addEventListener('durationchange', ev => this.#curRef.ondurationchange?.(ev));
    singleton.videoElem.addEventListener('timeupdate', ev => this.#curRef.ontimeupdate?.(ev));
    singleton.videoElem.addEventListener('seeking', ev => this.#curRef.onseeking?.(ev));
    singleton.videoElem.addEventListener('seeked', ev => this.#curRef.onseeked?.(ev));
    singleton.videoElem.addEventListener('play', ev => this.#curRef.onplay?.(ev));
    singleton.videoElem.addEventListener('pause', ev => this.#curRef.onpause?.(ev));
    singleton.videoElem.addEventListener('error', ev => this.#curRef.onerror?.(ev));
    singleton.videoElem.addEventListener('waiting', ev => this.#curRef.onwaiting?.(ev));
    singleton.videoElem.addEventListener('playing', ev => this.#curRef.onplaying?.(ev));
    singleton.videoElem.addEventListener('ended', ev => this.#curRef.onended?.(ev));
  }
  
  static takeRef() {
    if (!this.#singleton) {
      throw new Error(`Attempting to take reference before init.`);
    }
    this.#curRef.#singletonRef = /** @type {any}*/(null);
    this.#curRef = new VideoPlayerSingletonRef();
    this.#curRef.#singletonRef = this.#singleton;
    return this.#curRef;
  }
  
  
  /** @type {VideoPlayerSingleton} */
  #singletonRef = /** @type {any}*/(null);
  
  unref() {
    this.#singletonRef = /** @type {any}*/(null);
    if (VideoPlayerSingletonRef.#curRef === this) {
      VideoPlayerSingletonRef.#curRef = new VideoPlayerSingletonRef();
    }
  }
  
  hasRef() {
    return this.#singletonRef? true : false;
  }
  
  /** @param {HTMLElement} parentElem */
  attach(parentElem) {
    parentElem.appendChild(this.#singletonRef.videoPlayerSingletonElem);
  }
  
  /** @type {null | ((...args: Parameters<NonNullable<HTMLVideoElement['onloadedmetadata']>>) => void)} */ onloadedmetadata = null;
  /** @type {null | ((...args: Parameters<NonNullable<HTMLVideoElement['ondurationchange']>>) => void)} */ ondurationchange = null;
  /** @type {null | ((...args: Parameters<NonNullable<HTMLVideoElement['ontimeupdate']>>) => void)} */ ontimeupdate = null;
  /** @type {null | ((...args: Parameters<NonNullable<HTMLVideoElement['onseeking']>>) => void)} */ onseeking = null;
  /** @type {null | ((...args: Parameters<NonNullable<HTMLVideoElement['onseeked']>>) => void)} */ onseeked = null;
  /** @type {null | ((...args: Parameters<NonNullable<HTMLVideoElement['onplay']>>) => void)} */ onplay = null;
  /** @type {null | ((...args: Parameters<NonNullable<HTMLVideoElement['onpause']>>) => void)} */ onpause = null;
  /** @type {null | ((...args: Parameters<NonNullable<HTMLVideoElement['onerror']>>) => void)} */ onerror = null;
  /** @type {null | ((...args: Parameters<NonNullable<HTMLVideoElement['onwaiting']>>) => void)} */ onwaiting = null;
  /** @type {null | ((...args: Parameters<NonNullable<HTMLVideoElement['onplaying']>>) => void)} */ onplaying = null;
  /** @type {null | ((...args: Parameters<NonNullable<HTMLVideoElement['onended']>>) => void)} */ onended = null;

  get currentTime() {return this.#singletonRef.videoElem.currentTime;}
  set currentTime(currentTime) {this.#singletonRef.videoElem.currentTime = currentTime;}
  get duration() {return this.#singletonRef.videoElem.duration;}
  get ended() {return this.#singletonRef.videoElem.ended;}
  get error() {return this.#singletonRef.videoElem.error;}
  get paused() {return this.#singletonRef.videoElem.paused;}
  get readyState() {return this.#singletonRef.videoElem.readyState;}
  get src() {return this.#singletonRef.videoElem.src;}
  set src(src) {this.#singletonRef.videoElem.src = src;}
  
  load() {this.#singletonRef.videoElem.load();}
  pause() {this.#singletonRef.videoElem.pause();}
  play() {return this.#singletonRef.videoElem.play();}
  
  /** @param {string} url */
  setSubTrackByUrl(url) {this.#singletonRef.subOctopus.setTrackByUrl(url);}
  freeSubTrack() {this.#singletonRef.subOctopus.freeTrack();}
  clearSubs() {
    /** @type {HTMLCanvasElement} */
    const canvasElem = this.#singletonRef.subOctopus.canvas;
    canvasElem.style.display = 'none';
  }
}

/**
 * @typedef PlaylistItem
 * @property {string} videoURL
 * @property {string} [sasSubtitleAssURL]
 * @property {string} [title]
 * @property {string} [subtitle]
 */

class PlayerScreen extends Screen {
  /**
   * @param {PlaylistItem | PlaylistItem[]} _playlistItems 
   * @param {object} [options] 
   * @param {PlaylistState} [options.playlistState] 
   * @param {boolean} [options.delayStateUpdate] 
   * @param {{index: number; startSec?: number}} [options.initalPlaylistPosition] 
   */
  constructor(_playlistItems, options = {}) {
    const {playlistState} = options;
    const stateUpdateReqContinuousPlayDurSec = options.delayStateUpdate? MEANINGFUL_CONTINUOUS_PLAY_DURATION_S : 0;
    const initalPlaylistPosition = options.initalPlaylistPosition || (
      playlistState? {
        index: playlistState.videoIndex,
        startSec: playlistState.videoElapsedSec,
      } : {
        index: 0
      }
    );
    
    const playlistItems = Array.isArray(_playlistItems)? _playlistItems : [_playlistItems];
    
    /** @type {number} */
    let curPlaylistIndex;
    /** @type {boolean} */
    let isWaiting; // TODO: Should track this with video elem prop instead?
    
    let canUpdateState = stateUpdateReqContinuousPlayDurSec === 0;
    let playDurAnchorTimeSec = -2;
    //let playDurSec = 0;
    
    const frag = /** @type {DocumentFragment} */(playerScreenTemplate.content.cloneNode(true));
    const screenElem = requireElem('main', frag);
    const playerElem = requireElem('.player', screenElem);
    const videoPlayerSingletonContainerElem = requireElem('.videoPlayerSingletonContainer', screenElem);
    const playerHeaderElem = requireElem('.playerHeader', screenElem);
    const headerBackElem = requireElem('.playerHeader > div', screenElem);
    const titleElem = requireElem('.playerTitle', screenElem);
    const subtitleElem = requireElem('.playerSubtitle', screenElem);
    const controlsElem = /** @type {HTMLInputElement} */(requireElem('.playerControls', screenElem));
    const scrubberElem = /** @type {HTMLInputElement} */(requireElem('.playerScrubber', screenElem));
    const timeElem = requireElem('.playerTime', screenElem);
    const durationElem = requireElem('.playerDuration', screenElem);
    const stopButtonElem = /** @type {HTMLButtonElement} */(requireElem('.playerStopButton', screenElem));
    const previousButtonElem = /** @type {HTMLButtonElement} */(requireElem('.playerPreviousButton', screenElem));
    const rewindButtonElem = /** @type {HTMLButtonElement} */(requireElem('.playerRewindButton', screenElem));
    const playPauseButtonElem = /** @type {HTMLButtonElement} */(requireElem('.playerPlayPauseButton', screenElem));
    const playSVG = requireElem('.playSVG', playPauseButtonElem);
    const pauseSVG = requireElem('.pauseSVG', playPauseButtonElem);
    const loadingSVG = requireElem('.loadingSVG', playPauseButtonElem);
    const fastForwardButtonElem = /** @type {HTMLButtonElement} */(requireElem('.playerFastForwardButton', screenElem));
    const nextButtonElem = /** @type {HTMLButtonElement} */(requireElem('.playerNextButton', screenElem));
    const fullscreenButtonElem = /** @type {HTMLButtonElement} */(requireElem('.playerFullscreenButton', screenElem));
    
    const videoRef = VideoPlayerSingletonRef.takeRef();
    videoRef.attach(videoPlayerSingletonContainerElem);
    
    /** @param {KeyboardEvent | MouseEvent} [event] */
    function calcPlayerSkipDurS(event) {
      if (!event) {
        return PLAYER_SKIP_SMALL_DURATION_S;
      }
      if (event.shiftKey && event.ctrlKey) {
        return PLAYER_SKIP_LARGE_DURATION_S;
      }
      if (event.shiftKey || event.ctrlKey) {
        return PLAYER_SKIP_MEDIUM_DURATION_S;
      }
      return PLAYER_SKIP_SMALL_DURATION_S;
    }
    
    /** @type {NavListItemDef[]} */
    const navListItems = [
      {elem: stopButtonElem, action: () =>
        this.close()
      },
      {elem: previousButtonElem, disabledAction: DISABLED_ACTION.SKIP, action: () => {
        setPlaylistIndex(curPlaylistIndex - 1);
      }},
      {elem: rewindButtonElem, action: event => {
        setVideoTime(videoRef.currentTime - calcPlayerSkipDurS(event));
      }},
      {elem: playPauseButtonElem, action: () => {
        togglePlayPause();
      }},
      {elem: fastForwardButtonElem, action: event => {
        setVideoTime(videoRef.currentTime + calcPlayerSkipDurS(event));
      }},
      {elem: nextButtonElem, disabledAction: DISABLED_ACTION.SKIP, action: () => {
        setPlaylistIndex(curPlaylistIndex + 1);
      }}
    ];
    
    if (config.enableFullscreenToggle) {
      navListItems.push(
        {elem: fullscreenButtonElem, action: () => {
          toggleFullscreen();
        }},
      );
    }
    else {
      fullscreenButtonElem.style.display = 'none';
    }
    
    headerBackElem.addEventListener('click', event => {
      this.close();
      event.stopPropagation(); // Prevent toggling play/pause.
    });
    
    if (playlistItems.length === 1) {
      navListItems.splice(navListItems.findIndex(x => x.elem === previousButtonElem), 1);
      navListItems.splice(navListItems.findIndex(x => x.elem === nextButtonElem), 1);
      previousButtonElem.remove();
      nextButtonElem.remove();
      stopButtonElem.style.gridColumnStart = (parseInt(stopButtonElem.style.gridColumnStart, 10) + 1).toString();
    }
    
    const navList = new NavigatableList(navListItems);
    const prevNavListItemIndex = navList.items.findIndex(x => x.elem === previousButtonElem);
    const nextNavListItemIndex = navList.items.findIndex(x => x.elem === nextButtonElem);
    const playPauseNavListIndex = navList.items.findIndex(x => x.elem === playPauseButtonElem);
    const allowRepeatNavItems = navList.items.filter(x => x.elem === fastForwardButtonElem || x.elem === rewindButtonElem);
    if (navController.getIsKeyboardNavActive()) {
      navList.setActiveItem(playPauseNavListIndex);
    }
    
    let isControlsActive = false;
    let isScrubberActive = false;
    /** @type {number | undefined} */
    let controlsTimeoutID;
    
    /** @param {number} [durationMS] */
    function activateControls(durationMS) {
      isControlsActive = true;
      controlsElem.inert = false;
      playerElem.classList.remove('hiddenControls');
      if (controlsTimeoutID) clearTimeout(controlsTimeoutID);
      controlsTimeoutID = setTimeout(deactivateControls, durationMS || PLAYER_CONTROLS_TIMEOUT_MS);
    }
    function deactivateControls() {
      isControlsActive = false;
      controlsElem.inert = true;
      playerElem.classList.add('hiddenControls');
      unselectScrubber();
    }
    /** @param {number} [durationMS] */
    function extendControls(durationMS) {
      if (isControlsActive) {
        activateControls(durationMS);
      }
    }
    function selectScrubber() {
      isScrubberActive = true;
      scrubberElem.classList.add('active');
    }
    function unselectScrubber() {
      isScrubberActive = false;
      scrubberElem.classList.remove('active');
    }
    
    const setVideoElemCurrentTimeDebounced = debounce(100, timeSec => {
      if (!videoRef.hasRef()) return;
      videoRef.currentTime = timeSec;
    });
    /**
     * @param {number} timeSec 
     * @param {boolean} [skipUpdateScrubberValue] 
     */
    function setVideoTime(timeSec, skipUpdateScrubberValue) {
      if (isNaN(videoRef.duration)) return;
      timeSec = Math.max(Math.min(timeSec, videoRef.duration || 0), 0);
      setVideoElemCurrentTimeDebounced(timeSec);
      updateVideoTimeUI(timeSec, skipUpdateScrubberValue);
    } 
    /**
     * @param {number} timeSec 
     * @param {boolean} [skipUpdateScrubberValue] 
     */
    function updateVideoTimeUI(timeSec, skipUpdateScrubberValue) {
      let prct = (timeSec / videoRef.duration) * 100;
      if (isNaN(prct)) prct = 0;
      
      if (!skipUpdateScrubberValue) scrubberElem.valueAsNumber = prct;
      scrubberElem.style.setProperty('--value', `${prct}%`);
      timeElem.innerText = formatDuration(timeSec);
    }
    /**
     * @param {number} durationS 
     */
    function updateVideoDurationUI(durationS) {
      durationElem.innerText = formatDuration(durationS);
    }
    function getIsPlaying() {
      return !videoRef.paused && !videoRef.ended;
    }
    function updatePlayPauseUI() {
      if (getIsPlaying()) {
        playSVG.style.display = 'none';
        //const isWaiting = videoRef.readyState < videoRef.HAVE_FUTURE_DATA;
        if (isWaiting) {
          pauseSVG.style.display = 'none';
          loadingSVG.style.display = '';
        }
        else {
          pauseSVG.style.display = '';
          loadingSVG.style.display = 'none';
        }
      }
      else {
        playSVG.style.display = '';
        pauseSVG.style.display = 'none';
        loadingSVG.style.display = 'none';
        playSVG.style.color = videoRef.error? 'red' : '';
      }
    }
    function togglePlayPause() {
      if (getIsPlaying()) {
        videoRef.pause();
        activateControls();
      }
      else {
        void videoRef.play();
        extendControls(PLAYER_CONTROLS_TIMEOUT_PLAY_MS);
      }
    }
    function toggleFullscreen() {
      if (!config.enableFullscreenToggle) return;
      if (document.fullscreenElement) {
        void document.exitFullscreen();
      }
      else {
        void document.body.requestFullscreen({navigationUI: 'hide'});
      }
    }
    const savePlaylistStateDebounced = playlistState? debounce(1000, () => savePlaylistState(playlistState)) : debouceNOOP();
    function updatePlaylistState() {
      if (!playlistState) return;
      if (canUpdateState) {
        playlistState.videoIndex = curPlaylistIndex;
        playlistState.videoElapsedSec = videoRef.currentTime || 0;
        playlistState.videoElapsedPct = (videoRef.currentTime / videoRef.duration) * 100;
        savePlaylistStateDebounced();
      }
      else {
        if (playDurAnchorTimeSec === -1) {
          playDurAnchorTimeSec = videoRef.currentTime;
        }
        else if (playDurAnchorTimeSec >= 0) {
          //playDurSec += timeSec - playDurAnchorTimeSec;
          //playDurAnchorTimeSec = timeSec;
          const continuousPlayDurSec = videoRef.currentTime - playDurAnchorTimeSec;
          if (continuousPlayDurSec >= stateUpdateReqContinuousPlayDurSec) {
            canUpdateState = true;
          }
        }
      }
    }
    
    deactivateControls();
    updatePlayPauseUI();
    updateVideoTimeUI(0);
    updateVideoDurationUI(0);
    
    videoRef.onloadedmetadata = () => {
      updateVideoTimeUI(videoRef.currentTime);
      updatePlayPauseUI();
    };
    videoRef.ondurationchange = () => {
      updateVideoDurationUI(videoRef.duration);
      updatePlayPauseUI();
    };
    videoRef.ontimeupdate = () => {
      updateVideoTimeUI(videoRef.currentTime);
      updatePlaylistState();
    };
    videoRef.onseeking = () => {
      playDurAnchorTimeSec = -2;
    };
    videoRef.onseeked = () => {
      playDurAnchorTimeSec = -1;
    };
    videoRef.onplay = () => {
      updatePlayPauseUI();
    };
    videoRef.onpause = () => updatePlayPauseUI();
    videoRef.onerror = () => updatePlayPauseUI();
    videoRef.onwaiting = () => {
      isWaiting = true;
      updatePlayPauseUI();
    };
    videoRef.onplaying = () => {
      playDurAnchorTimeSec = -1;
      isWaiting = false;
      updatePlayPauseUI();
    };
    videoRef.onended = () => {
      updatePlayPauseUI();
      setPlaylistIndex(curPlaylistIndex + 1);
    };
    
    playerHeaderElem.addEventListener('click', () => togglePlayPause());
    videoPlayerSingletonContainerElem.addEventListener('click', () => togglePlayPause());
    
    playerHeaderElem.addEventListener('dblclick', () => toggleFullscreen());
    videoPlayerSingletonContainerElem.addEventListener('dblclick', () => toggleFullscreen());
    
    scrubberElem.addEventListener('mousedown', () => {
      selectScrubber();
      extendControls();
    });
    scrubberElem.addEventListener('input', () => {
      setVideoTime((scrubberElem.valueAsNumber / 100) * videoRef.duration, true);
    });
    scrubberElem.addEventListener('keydown', event => {
      // Prevent all keyboard events from reaching this input.
      event.preventDefault();
      return false;
    });
    
    playerElem.addEventListener('mousemove', debounce(100, () => activateControls()));
    
    /** @param {number} playlistIndex */
    function setPlaylistIndex(playlistIndex) {
      playlistIndex = Math.max(Math.min(playlistIndex, playlistItems.length - 1), 0);
      if (curPlaylistIndex === playlistIndex) return;
      
      curPlaylistIndex = playlistIndex;
      const playlistItem = playlistItems[curPlaylistIndex];
      
      if (prevNavListItemIndex !== -1) {
        navList.setItemIsDisabled(prevNavListItemIndex, curPlaylistIndex <= 0);
      }
      if (nextNavListItemIndex !== -1) {
        navList.setItemIsDisabled(nextNavListItemIndex, curPlaylistIndex >= playlistItems.length - 1);
      }
      
      titleElem.innerText = playlistItem.title || '';
      subtitleElem.innerText = playlistItem.subtitle || '';
      titleElem.classList.toggle('hidden', !playlistItem.title);
      subtitleElem.classList.toggle('hidden', !playlistItem.title || !playlistItem.subtitle);
      
      updateVideoTimeUI(0);
      updateVideoDurationUI(0);
      isWaiting = true;
      videoRef.src = playlistItem.videoURL;
      videoRef.load();
      //void videoRef.play();
      updatePlayPauseUI();
      
      videoRef.freeSubTrack();
      if (playlistItem.sasSubtitleAssURL) {
        videoRef.setSubTrackByUrl(playlistItem.sasSubtitleAssURL);
      }
    }
    
    setPlaylistIndex(initalPlaylistPosition.index);
    if (initalPlaylistPosition.startSec) {
      setVideoElemCurrentTimeDebounced(initalPlaylistPosition.startSec);
      setVideoElemCurrentTimeDebounced.flush();
    }
    
    // Prevent subtitles from previous video from flashing.
    videoRef.clearSubs();
    
    super(screenElem);
    this.videoRef = videoRef;
    this.navList = navList;
    this.playPauseNavListIndex = playPauseNavListIndex;
    /** @param {NavListItem} navItem */
    this.allowRepeatNavItems = allowRepeatNavItems;
    this.togglePlayPause = togglePlayPause;
    this.setVideoTime = setVideoTime;
    this.activateControls = activateControls;
    this.deactivateControls = deactivateControls;
    this.extendControls = extendControls;
    this.getIsControlsActive = () => isControlsActive;
    this.selectScrubber = selectScrubber;
    this.unselectScrubber = unselectScrubber;
    this.getIsScrubberActive = () => isScrubberActive;
    this.getIsPlaying = getIsPlaying;
    this.calcPlayerSkipDurS = calcPlayerSkipDurS;
    this.flushSavedPlaylistState = () => {
      savePlaylistStateDebounced.flush();
    };
  }
  
  show() {
    this.activateControls();
    return super.show();
  }
  
  /**
   * @param {KeyboardEvent} event
   * @param {string | undefined} keyAction
   */
  handleKey(event, keyAction) {
    switch (keyAction) {
      case 'BACK':
        if (event.repeat) return 2;
        if (this.getIsControlsActive()) {
          this.deactivateControls();
        }
        else {
          this.activateControls();
          this.navList.setActiveItem(this.playPauseNavListIndex);
        }
        return 1;
      case 'SELECT':
        if (this.getIsControlsActive() && navController.getIsKeyboardNavActive()) {
          if (this.getIsScrubberActive()) {
            if (event.repeat) return 2;
            this.togglePlayPause();
          }
          else {
            if (this.navList.activeItem) {
              if (event.repeat && !this.allowRepeatNavItems.includes(this.navList.activeItem)) {
                return 2;
              }
              this.navList.performActiveAction(event);
            }
          }
          this.extendControls();
        }
        else {
          if (event.repeat) return 2;
          this.togglePlayPause();
          this.navList.setActiveItem(this.playPauseNavListIndex);
        }
        return 2;
      case 'UP':
        this.activateControls();
        this.selectScrubber();
        this.navList.setActiveItem(-1, false);
        return 2;
      case 'DOWN':
        if (!this.getIsControlsActive() || !navController.getIsKeyboardNavActive()) {
          this.navList.setActiveItem(this.playPauseNavListIndex);
        }
        this.activateControls();
        
        if (this.getIsScrubberActive()) {
          this.unselectScrubber();
          this.navList.setActiveItem(this.playPauseNavListIndex);
        }
        return 1;
      case 'LEFT':
        if (this.getIsScrubberActive()) {
          this.setVideoTime(this.videoRef.currentTime - this.calcPlayerSkipDurS(event));
          this.extendControls();
          return 2;
        }
        
        if (!this.getIsControlsActive() || !navController.getIsKeyboardNavActive()) {
          this.navList.setActiveItem(this.playPauseNavListIndex);
        }
        this.activateControls();
        this.navList.move(DIRECTION.LEFT);
        return 1;
      case 'RIGHT':
        if (this.getIsScrubberActive()) {
          this.setVideoTime(this.videoRef.currentTime + this.calcPlayerSkipDurS(event));
          this.extendControls();
          return 2;
        }
        
        if (!this.getIsControlsActive() || !navController.getIsKeyboardNavActive()) {
          this.navList.setActiveItem(this.playPauseNavListIndex);
        }
        this.activateControls();
        this.navList.move(DIRECTION.RIGHT);
        return 1;
    }
    return super.handleKey(event, keyAction);
  }
  
  /** @param {Parameters<Screen['close']>} args */
  close(...args) {
    super.close(...args);
    this.flushSavedPlaylistState();
    this.videoRef.unref();
  }
}

function init() {
  const errorAlertElem = requireElem('#errorAlert');
  
  const cWindow = /** @type {CustomWindow} */(window);
  if (!cWindow.movieLibraryConfig) {
    errorAlertElem.innerText = 'Error: Configuration does not exist or is not able to be loaded. Check the console.';
    return;
  }
  for (const key in cWindow.movieLibraryConfig) {
    // @ts-expect-error
    if (cWindow.movieLibraryConfig[key] !== undefined) config[key] = cWindow.movieLibraryConfig[key];
  }
  config.movies = (cWindow.movieLibraryConfig.movies || []).map(x => /**@satisfies {Movie}*/({
    id: x.id || '',
    title: x.title || '',
    titleSortStr: x.titleSortStr || '',
    setName: x.setName || '',
    setNameSortStr: x.setNameSortStr || '',
    year: x.year || '',
    premiereDateISOStr: x.premiereDateISOStr || '',
    plot: x.plot || '',
    tagline: x.tagline || '',
    rating: x.rating || '',
    genres: x.genres || [],
    directorNames: x.directorNames || [],
    actorNames: x.actorNames || [],
    studioNames: x.studioNames || [],
    hasSubtitles: x.hasSubtitles || false,
    runtimeMinutes: x.runtimeMinutes || 0,
    thumbURL: x.thumbURL || '',
    logoURL: x.logoURL || '',
    keyartURL: x.keyartURL || '',
    clearartURL: x.clearartURL || '',
    sasSubtitleAssURL: x.sasSubtitleAssURL || '',
    videoURL: x.videoURL || '',
  }));
  config.tvShows = (cWindow.movieLibraryConfig.tvShows || []).map(x => /** @satisfies {TVShow} */({
    id: x.id || '',
    title: x.title || '',
    titleSortStr: x.titleSortStr || '',
    episodeOrderingType: x.episodeOrderingType || 'default',
    year: x.year || '',
    premiereDateISOStr: x.premiereDateISOStr || '',
    plot: x.plot || '',
    rating: x.rating || '',
    genres: x.genres || [],
    runtimeMinutes: x.runtimeMinutes || 0,
    actorNames: x.actorNames || [],
    studioNames: x.studioNames || [],
    thumbURL: x.thumbURL || '',
    logoURL: x.logoURL || '',
    clearartURL: x.clearartURL || '',
    posterURL: x.posterURL || '',
    seasons: (x.seasons || []).map(x => /** @satisfies {Season} */({
      seasonNumber: x.seasonNumber || 0,
      episodes: (x.episodes || []).map(x => {
        /** @param {typeof x | NonNullable<(typeof x)['multiepisodeBases']>[number]} x */
        const mapEpisodeBase = (x) => ({
          id: x.id || '',
          title: x.title || '',
          seasonNumber: x.seasonNumber || 0,
          episodeNumber: x.episodeNumber || 0,
          dvdEpisodeNumber: x.dvdEpisodeNumber || 0,
          specialSeasonNumber: x.specialSeasonNumber || 0,
          specialEpisodeNumber: x.specialEpisodeNumber || 0,
          specialAfterSeasonNumber: x.specialAfterSeasonNumber || 0,
          airedDateISOStr: x.airedDateISOStr || '',
          year: x.year || '',
          plot: x.plot || '',
          runtimeMinutes: x.runtimeMinutes || 0,
          directorNames: x.directorNames || [],
          actorNames: x.actorNames || [],
        });
        /** @type {Episode} */
        const episode = {
          ...mapEpisodeBase(x),
          episodeOrd: x.episodeOrd || 0,
          thumbURL: x.thumbURL || '',
          sasSubtitleAssURL: x.sasSubtitleAssURL || '',
          videoURL: x.videoURL || '',
          multiepisodeBases: (x.multiepisodeBases || []).map(mapEpisodeBase),
        };
        return episode;
      })
    }))
  }));
  
  const {movies, tvShows} = config;
  
  if (!movies.length) {
    errorAlertElem.innerText = 'Error: Configuration contains no movies.';
    return;
  }
  
  /** @type {Movie[]} */
  const parentMovies = [];
  if (cWindow.movieLibraryFilter) {
    for (let i = 0; i < movies.length; ++i) {
      if (!cWindow.movieLibraryFilter(movies[i])) {
        parentMovies.push(movies[i]);
        movies.splice(i, 1);
        --i;
      }
    }
  }
  
  if (!movies.length) {
    errorAlertElem.innerText = 'Error: No movies remaining after filtering.';
    return;
  }
  
  if (cWindow.movieLibrarySort) {
    movies.sort(cWindow.movieLibrarySort);
  }
  
  if (cWindow.tvShowLibrarySort) {
    tvShows.sort(cWindow.tvShowLibrarySort);
  }
  
  navController.init(!config.enableMouseAtStart);
  
  deeplinkSlugs = (
    window.location.hash.substring(1)
    .split('/')
    .map(x => decodeURIComponent(x))
  );
  
  const videoPlayerSingletonElem = requireElem('#videoPlayerSingleton');
  const videoElem = /** @type {HTMLVideoElement} */(requireElem('video', videoPlayerSingletonElem));
  
  // For ASS subtitle rendering to work in Chrome/Edge, see README.md
  /** @type {SubtitlesOctopus} */
  // @ts-expect-error
  // eslint-disable-next-line no-undef
  const subOctopus = new SubtitlesOctopus({
    video: videoElem,
    workerUrl: './assets/lib/libass-wasm-4.1.0/subtitles-octopus-worker.js',
    legacyWorkerUrl: './assets/lib/libass-wasm-4.1.0/subtitles-octopus-worker-legacy.js',
    subContent: `[V4+ Styles]\n[Events]`,
    fonts: config.fontURLs
  });
  
  VideoPlayerSingletonRef.init({
    videoPlayerSingletonElem,
    videoElem,
    subOctopus
  });
  
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const testPaths = Array(10).fill(0).map((_,i) => `C:\\Users\\Mike\\Downloads\\thing${i+1}.mp4`);
  const tvPlaylistItems = String.raw`
M:\Bumpers\bumpworthy\7177 - Toonami 2.0 Akira To Ads 1.mp4
M:\Bumpers\bumpworthy\3546 - Eagleheart Stats 2.mp4
M:\Bumpers\bumpworthy\2367 - Television Closed.mp4
M:\Bumpers\Ambient Swim Bumpers\bump1169.mp4
M:\TV\Robot Chicken\Season 04\04.11 - We Are a Humble Factory.mp4
M:\Bumpers\bumpworthy\5984 - AS Picks for Super Bowl XLVII.mp4
M:\Bumpers\Ambient Swim Bumpers\bump270.mp4
M:\TV\Squidbillies\Season 11\11.07 - Tortuga de Mentiras.mp4
M:\Bumpers\bumpworthy\5413 - Voting Via the Internet.mp4
M:\Bumpers\bumpworthy\1560 - Punch Bay.mp4
M:\Bumpers\Ambient Swim Bumpers\bump1232.mp4
M:\TV\Death Note\Season 01\01.32 - Selection.mp4
M:\Bumpers\bumpworthy\7340 - Toonami 2.0 FLCL 09.mp4
M:\Bumpers\Ambient Swim Bumpers\bump147.mp4
  `.split('\n').map(x => x.trim()).filter(x => x).map(x => ({videoURL: 'file:///' + x.replace(/^\/mnt\/(.)\//, (_,x) => x.toUpperCase() + ':\\').replaceAll('/', '\\')}));
  // for (let i = 0; i < tvPaths.length - 1; ++i) {
  //   const count = 1 + Math.floor(Math.random() * 3);
  //   const stop = i + count;
  //   for (; i < stop; ++i) {
  //     tvPaths.splice(i + 1, 0, `https://www.bumpworthy.com/download/video/${Math.floor(Math.random() * 6000)}`);
  //   }
  // }
  
  // new MenuScreen([{
  //   title: 'Movies',
  //   action: () => new GridScreen(movies.map(movie => ({
  //     title: movie.title,
  //     imageURL: movie.thumbURL,
  //     action: () => new DetailScreen(movie).show()
  //   }))).show()
  // }, {
  //   title: 'TV',
  //   action: () => new PinScreen('1111', () =>
  //     new GridScreen([
  //       {title: 'Test1', action: () => new PlayerScreen(`C:\\Users\\Mike\\Downloads\\test.mp4`).show()},
  //       {title: 'Test2', action: () => new PlayerScreen(`C:\\Users\\Mike\\Downloads\\test2.mp4`).show()},
  //       {title: 'Test3', action: () => new PlayerScreen(`M:\\TV\\Ambient Swim\\bumps\\bump${Math.floor(Math.random()*1521)}.mp4`).show()},
  //       {title: 'Test4', action: () => new PlayerScreen(`C:\\Users\\Mike\\Downloads\\The Office (US) (2005) - S01E01 - Pilot (1080p AMZN WEB-DL x265 LION).mkv`).show()},
  //       {title: 'Test5', action: () => new PlayerScreen(tvPaths/*, getPlaylistState('test-tv2')*/).show()},
  //     ]).show()
  //   ).show()
  // }]).show();
  
  // const exampleEpisode = tvShows.find(x => x.title.startsWith('One-Punch Man'))?.seasons.flatMap(s => s.episodes).find(x => x.title.startsWith('The Shadow That Snuck Up Too Close'));
  // new PlayerScreen({
  //   videoURL: exampleEpisode?.videoURL,
  //   sasSubtitleAssURL: exampleEpisode?.sasSubtitleAssURL,
  // }).show();
  
  new MenuScreen([{
    title: 'Kids',
    action: () => new GridScreen(movies.map(movie => ({
      title: movie.title,
      imageURL: movie.thumbURL,
      action: () => new DetailScreen(movie).show()
    })), config.enableGridNavWrap).show()
   }, {
    title: 'Parents',
    action: () => new PinScreen('1141', () =>
      new MenuScreen([{
        title: 'Movies',
        action: () => new GridScreen(parentMovies.map(movie => ({
          title: movie.title,
          imageURL: movie.thumbURL,
          action: () => new DetailScreen(movie).show()
        })), config.enableGridNavWrap).show()
      }, {
        title: 'Shows',
        action: () => new GridScreen(tvShows.map(tvShow => ({
          title: tvShow.title,
          imageURL: tvShow.thumbURL,
          action: () => new TVShowScreen(tvShow, config.enableGridNavWrap).show()
        })), config.enableGridNavWrap).show()
      }, {
        title: 'TV',
        action: () => new PlayerScreen(tvPlaylistItems, {
          playlistState: getPlaylistState('tv-adult')
        }).show()
      }], true).show()
    ).show()
  }]).show();
  
  // Register key listener.
  window.addEventListener('keydown', event => {
    // Should never happen, but ensure hidden and closed screens are never sent keys.
    const screen = screens[0];
    if (!screen || !screen.isShown || screen.isClosed) {
      return;
    }
    
    const keyAction = KEY_ACTION_DICT[event.key];
    const caughtState = screen.handleKey(event, keyAction);
    if (caughtState) {
      if (caughtState !== 2) {
        navController.useKeyboardNav();
      }
      event.preventDefault();
      return false;
    }
  });
  
  // Prevent any element from ever recieving focus. This prevents inputs from consuming key events.
  window.addEventListener('focusin', event => {
    if (event.target !== document.body) {
      /** @type {HTMLElement} */(event.target)?.blur?.();
    }
  });
  
  errorAlertElem.style.display = 'none';
}

// function loadGridLastActiveItemIndex() {
//   const indexStr = localStorage.getItem('lastGridActiveItemIndex');
//   if (!indexStr) return;
//   const index = parseInt(indexStr, 10);
//   if (isNaN(index) || index < 0) return;
//   return index;
// }
// /** @param {number | undefined} index */
// function saveGridLastActiveItemIndex(index) {
//   if (index === undefined || index < 0) return;
//   localStorage.setItem('lastGridActiveItemIndex', index.toString());
// }

/**
 * @typedef PlaylistState
 * @property {string} id
 * @property {number} videoIndex
 * @property {number} videoElapsedSec
 * @property {number} videoElapsedPct
 */

/** @type {Map<string, PlaylistState>} */
const playlistStateCache = new Map();

/** @param {string} playlistStateID */
function getPlaylistState(playlistStateID) {
  let state = playlistStateCache.get(playlistStateID);
  if (state) return state;
  
  const stateJSON = localStorage.getItem(`playlistState_${playlistStateID}`);
  if (stateJSON) {
    try {
      state = JSON.parse(stateJSON);
    } catch(err) {/* noop */}
  }
  
  if (!state) {
    state = {
      id: playlistStateID,
      videoIndex: 0,
      videoElapsedSec: 0,
      videoElapsedPct: 0,
    };
  }
  
  playlistStateCache.set(playlistStateID, state);
  return state;
}
/** @param {PlaylistState} playlistState */
function savePlaylistState(playlistState) {
  console.log('saved');
  localStorage.setItem(`playlistState_${playlistState.id}`, JSON.stringify(playlistState));
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

/**
 * @template {any[]} T
 * @param {number} delayMS 
 * @param {(...args: T) => void} fn 
 * @returns {((...args: T) => void) & {flush: () => void}}
 */
function debounce(delayMS, fn) {
  let isDelayed = false;
  /** @type {T | undefined} */
  let pendingArgs = undefined;
  /** @param {T} args */
  const debounced = (...args) => {
    if (isDelayed) {
      pendingArgs = args;
    }
    else {
      isDelayed = true;
      setTimeout(() => {
        isDelayed = false;
        if (pendingArgs) {
          const args = pendingArgs;
          pendingArgs = undefined;
          debounced(...args);
        }
      }, delayMS);
      fn(...args);
    }
  };
  function flush() {
    if (pendingArgs) {
      isDelayed = false;
      const args = pendingArgs;
      pendingArgs = undefined;
      debounced(...args);
    }
  }
  debounced.flush = flush;
  return debounced;
}
/** @returns {(() => void) & {flush: () => void}} */
function debouceNOOP() {
  const debounced = () => {/*noop*/};
  debounced.flush = () => {/*noop*/};
  return debounced;
}

const MINUTE = 60;
const HOUR = 60 * MINUTE;

/** @param {number} durationS */
function formatDuration(durationS) {
  let secs = Math.floor(durationS);
  const hours = Math.floor(secs / HOUR);
  secs -= hours * HOUR;
  const mins = Math.floor(secs / MINUTE);
  secs -= mins * MINUTE;
  
  let str = '';
  if (hours > 0) {
    str += hours.toString() + ':';
    if (mins < 10) str += '0';
  }
  str += mins.toString() + ':';
  if (secs < 10) str += '0';
  str += secs;
  return str;
}

/**
 * @param {Episode} episode 
 */
function formatEpisodeNum(episode) {
  if (episode.multiepisodeBases.length === 0) {
    if (!episode.episodeNumber) return;
    return episode.episodeNumber.toString();
  }
  
  let episodeNumStr = episode.multiepisodeBases[0].episodeNumber.toString();
  let didSkip = false;
  for (let i = 1; i < episode.multiepisodeBases.length; ++i) {
    const cur = episode.multiepisodeBases[i];
    const prv = episode.multiepisodeBases[i - 1];
    
    if (cur.seasonNumber === prv.seasonNumber && cur.episodeNumber === prv.episodeNumber + 1) {
      didSkip = true;
      continue;
    }
    
    if (didSkip) {
      episodeNumStr += '-' + prv.episodeNumber;
    }
    didSkip = false;
    
    episodeNumStr += ', ';
    
    if (cur.seasonNumber !== prv.seasonNumber) {
      episodeNumStr += `S${cur.seasonNumber}:E`;
    }
    episodeNumStr += cur.episodeNumber;
  }
  if (didSkip) {
    episodeNumStr += '-' + episode.multiepisodeBases[episode.multiepisodeBases.length - 1].episodeNumber;
  }
  
  return episodeNumStr;
}

/**
 * @param {Episode} episode 
 */
function formatEpisodeTitle(episode) {
  if (episode.multiepisodeBases.length === 0) {
    return episode.title;
  }
  
  const normalizedTitles = episode.multiepisodeBases.map(x => x.title.replace(/\s*\(?(p|part)?\s*\d+\)?$/, ''));
  let allSameTitle = true;
  for (let i = 1; i < normalizedTitles.length; ++i) {
    if (normalizedTitles[i] !== normalizedTitles[0]) {
      allSameTitle = false;
      break;
    }
  }
  
  if (allSameTitle) {
    return normalizedTitles[0];
  }
  
  return episode.multiepisodeBases.map(x => x.title).join(' / ');
}

init();
} window.addEventListener('DOMContentLoaded', () => load());