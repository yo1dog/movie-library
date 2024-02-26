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

/**
 * @typedef NavListItemDef
 * @property {string} [slug]
 * @property {HTMLElement} [elem]
 * @property {(event: KeyboardEvent | MouseEvent | undefined, navItem: NavListItem) => void} [action]
 * @property {boolean} [isDisabled]
 */
/**
 * @typedef NavListItem
 * @property {string} [slug]
 * @property {HTMLElement} [elem]
 * @property {(event: KeyboardEvent | MouseEvent | undefined, navItem: NavListItem) => void} [action]
 * @property {number} index
 * @property {number} x
 * @property {number} y
 * @property {boolean} isDisabled
 */

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
  return {
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
        action: itemDefs[i].action,
        index: i,
        x: i % this.numColumns,
        y: Math.floor(i / this.numColumns),
        isDisabled: false,
      };
      if (itemDefs[i].isDisabled) {
        NavigatableList.#setItemIsDisabled(item, true);
      }
      
      // Add listeners for mouse events.
      item.elem?.addEventListener('click', event => {
        this.setActiveItem(item.index, false);
        item.action?.(event, item);
      });
      item.elem?.addEventListener('mouseenter', () => {
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
   * @param {number} dx
   * @param {number} dy
   */
  move(dx, dy) {
    if (!this.activeItem) {
      this.setActiveItem(0);
      return;
    }
    
    let index = this.activeItem.index;
    let x = this.activeItem.x;
    let y = this.activeItem.y;
    do {
      if (this.enableWrap) {
        index += dx + (dy * this.numColumns);
        if (index < 0) {
          index = 0;
          break;
        }
        if (index > this.items.length - 1) {
          index = this.items.length - 1;
          break;
        }
      }
      else {
        const lastIndex = index;
        x += dx;
        y += dy;
        if (x < 0) x = 0;
        if (y < 0) y = 0;
        if (x > this.numColumns - 1) x = this.numColumns - 1;
        if (y > this.numRows    - 1) y = this.numRows    - 1;
        index = (y * this.numColumns) + x;
        if (index > this.items.length - 1) index = this.items.length - 1;
        if (index === lastIndex) break;
      }
    }
    while (this.items[index].isDisabled);
    
    if (this.items[index].isDisabled) {
      return;
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
        elem: gridItemTileElem,
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
        this.navList.move(-1, 0);
        return 1;
      case 'RIGHT':
        this.navList.move(1, 0);
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
   */
  constructor(menuItems) {
    const frag = /** @type {DocumentFragment} */(gridScreenTemplate.content.cloneNode(true));
    const screenElem = requireElem('main', frag);
    const gridElem = requireElem('.grid', screenElem);
    const gridItemTemplate = /** @type {HTMLTemplateElement} */(gridElem.getElementsByTagName('TEMPLATE')[0]);
    
    gridElem.style.gridTemplateColumns = `repeat(${GRID_NUM_COLUMNS}, 1fr)`;
    
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
        elem: gridItemTileElem,
        action: () => menuItem.action()
      });
    }
    
    const navList = new NavigatableList(navItems, GRID_NUM_COLUMNS);
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
        this.navList.move(-1, 0);
        return 1;
      case 'RIGHT':
        this.navList.move(1, 0);
        return 1;
      case 'UP':
        this.navList.move(0, -1);
        return 1;
      case 'DOWN':
        this.navList.move(0, 1);
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
      action: () => movie.videoFilepath && playVideo(movie.videoFilepath)
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
        this.navList.move(-1, 0);
        return 1;
      case 'RIGHT':
        this.navList.move(1, 0);
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
   */
  constructor(tvShow) {
    const frag = /** @type {DocumentFragment} */(tvShowScreenTemplate.content.cloneNode(true));
    const screenElem = requireElem('main', frag);
    
    const screenBodyElem = requireElem('.screenBody', frag);
    const detailBackgroundImgElem = /** @type {HTMLImageElement} */(requireElem('.detailBackgroundImgContainer img', screenElem));
    const detailLogoElem = /** @type {HTMLImageElement} */(requireElem('.detailLogo', screenElem));
    const ratingImgElem = /** @type {HTMLImageElement} */(requireElem('.ratingImg', screenElem));
    const mediaYearElem = requireElem('.mediaYear', screenElem);
    const episodeCountElem = requireElem('.episodeCount', screenElem);
    // const detailTopPanelDesc = requireElem('.detailTopPanelDesc', screenElem);
    const seasonTemplate = /** @type {HTMLTemplateElement} */(screenElem.getElementsByTagName('TEMPLATE')[0]);
    
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
    
    if (tvShow.rating) {
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
    
    /** @type {NavListItemDef[]} */
    const navItems = [];
    /** @type {string[]} */
    const videoFilepaths = [];
    const playlistState = getPlaylistState(`tvshow-${tvShow.id}`);
    
    let totalEpisodeCount = 0;
    for (const season of tvShow.seasons) {
      totalEpisodeCount += season.episodes.length;
      
      const remainder = navItems.length % GRID_NUM_COLUMNS;
      if (remainder > 0) {
        for (let i = remainder; i < GRID_NUM_COLUMNS; ++i) {
          navItems.push({isDisabled: true});
        }
      }
      
      const seasonFrag = /** @type {DocumentFragment} */(seasonTemplate.content.cloneNode(true));
      const seasonElem = requireElem('.season', seasonFrag);
      const gridElem = requireElem('.grid', seasonElem);
      const gridItemTemplate = /** @type {HTMLTemplateElement} */(gridElem.getElementsByTagName('TEMPLATE')[0]);
      
      gridElem.style.gridTemplateColumns = `repeat(${GRID_NUM_COLUMNS}, 1fr)`;
      
      const detailNavItemElem = requireElem('.detailNavItem', seasonFrag);
      detailNavItemElem.innerText = season.seasonNumber === 0? 'Specials' : `Season ${season.seasonNumber}`;
      
      screenBodyElem.appendChild(seasonElem);
      
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
        
        const isSpecial = !episode.seasonNumber;
        if (isSpecial) {
          gridItemEpisodeNumElem.classList.add('special');
          gridItemEpisodeNumElem.innerText = 'SPECIAL: ';
        }
        else if (episode.episodeNumber) {
          if (episode.multiepisodeBases.length > 0) {
            gridItemEpisodeNumElem.innerText = episode.multiepisodeBases.map(x =>
              (x.seasonNumber !== episode.seasonNumber? `s${x.seasonNumber}e` : '')
              + x.episodeNumber.toString()
            ).join(',') + '. ';
          }
          else {
            gridItemEpisodeNumElem.innerText = `${episode.episodeNumber}. `;
          }
        }
        else {
          gridItemEpisodeNumElem.remove();
        }
        
        if (episode.multiepisodeBases.length > 0) {
          const normalizedTitles = episode.multiepisodeBases.map(x => x.title.replace(/\s*\(?(p|part)?\s*\d+\)?$/, ''));
          let allSameTitle = true;
          for (let i = 1; i < normalizedTitles.length; ++i) {
            if (normalizedTitles[i] !== normalizedTitles[0]) {
              allSameTitle = false;
              break;
            }
          }
          if (allSameTitle) {
            gridItemTitleElem.innerText = normalizedTitles[0];
          }
          else {
            gridItemTitleElem.innerText = episode.multiepisodeBases.map(x => x.title).join(' / ');
          }
        }
        else {
          gridItemTitleElem.innerText = episode.title;
        }
        
        if (episode.runtimeMinutes) {
          gridItemRuntimeElem.innerHTML = `&nbsp;`;
          gridItemRuntimeElem.innerText += `(${episode.runtimeMinutes}m)`;
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
        
        const playlistVideoIndex = videoFilepaths.length;
        videoFilepaths.push(episode.videoFilepath);
        
        if (playlistState.videoIndex > playlistVideoIndex) {
          gridItemElem.classList.add('watched');
        }
        
        gridElem.appendChild(gridItemElem);
        navItems.push({
          slug: episode.id,
          elem: gridItemTileElem,
          action: () => {
            if (playlistState.videoIndex !== playlistVideoIndex) {
              playlistState.videoIndex = playlistVideoIndex;
              playlistState.videoElapsedSec = 0;
              savePlaylistState(playlistState);
            }
            new PlayerScreen(videoFilepaths, playlistState).show();
          }
        });
      }
    }
    
    episodeCountElem.innerText = `${totalEpisodeCount} episode${totalEpisodeCount !== 1? 's' : ''}`;
    
    const navList = new NavigatableList(navItems, GRID_NUM_COLUMNS, true);
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
        this.navList.move(-1, 0);
        return 1;
      case 'RIGHT':
        this.navList.move(1, 0);
        return 1;
      case 'UP':
        if (this.navList.activeItem?.y === 0) {
          this.elem.scrollTo({
            behavior: 'smooth',
            top: 0
          });
          return 1;
        }
        this.navList.move(0, -1);
        return 1;
      case 'DOWN':
        this.navList.move(0, 1);
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
        this.numpadNavList.move(-1, 0);
        return 1;
      case 'RIGHT':
        this.focusNumpad();
        this.numpadNavList.move(1, 0);
        return 1;
      case 'UP':
        this.focusNumpad();
        this.numpadNavList.move(0, -1);
        return 1;
      case 'DOWN':
        this.focusNumpad();
        this.numpadNavList.move(0, 1);
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

class PlayerScreen extends Screen {
  /**
   * @param {string | string[]} videoFilepaths 
   * @param {PlaylistState} [playlistState] 
   */
  constructor(videoFilepaths, playlistState) {
    if (!Array.isArray(videoFilepaths)) {
      videoFilepaths = [videoFilepaths];
    }
    /** @type {number} */
    let curVideoIndex;
    /** @type {boolean} */
    let isWaiting; // TODO: Should track this with video elem prop instead?
    
    const frag = /** @type {DocumentFragment} */(playerScreenTemplate.content.cloneNode(true));
    const screenElem = requireElem('main', frag);
    const videoElem = /** @type {HTMLVideoElement} */(requireElem('video', screenElem));
    const playerElem = requireElem('.player', screenElem);
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
      {elem: previousButtonElem, action: () => {
        setVideoIndex(curVideoIndex - 1);
      }},
      {elem: rewindButtonElem, action: event => {
        setVideoTime(videoElem.currentTime - calcPlayerSkipDurS(event));
      }},
      {elem: playPauseButtonElem, action: () => {
        togglePlayPause();
      }},
      {elem: fastForwardButtonElem, action: event => {
        setVideoTime(videoElem.currentTime + calcPlayerSkipDurS(event));
      }},
      {elem: nextButtonElem, action: () => {
        setVideoIndex(curVideoIndex + 1);
      }},
    ];
    
    if (videoFilepaths.length === 1) {
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
    
    const _setVideoElemCurrentTime = debounce(100, timeSec => {videoElem.currentTime = timeSec;});
    /**
     * @param {number} timeSec 
     * @param {boolean} [skipUpdateScrubberValue] 
     */
    function setVideoTime(timeSec, skipUpdateScrubberValue) {
      if (isNaN(videoElem.duration)) return;
      timeSec = Math.max(Math.min(timeSec, videoElem.duration || 0), 0);
      _setVideoElemCurrentTime(timeSec);
      updateVideoTimeUI(timeSec, skipUpdateScrubberValue);
    } 
    /**
     * @param {number} timeSec 
     * @param {boolean} [skipUpdateScrubberValue] 
     */
    function updateVideoTimeUI(timeSec, skipUpdateScrubberValue) {
      let prct = (timeSec / videoElem.duration) * 100;
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
      return !videoElem.paused && !videoElem.ended;
    }
    function updatePlayPauseUI() {
      if (getIsPlaying()) {
        playSVG.style.display = 'none';
        //const isWaiting = videoElem.readyState < videoElem.HAVE_FUTURE_DATA;
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
        playSVG.style.color = videoElem.error? 'red' : '';
      }
    }
    function togglePlayPause() {
      if (getIsPlaying()) {
        videoElem.pause();
        activateControls();
      }
      else {
        void videoElem.play();
        extendControls(PLAYER_CONTROLS_TIMEOUT_PLAY_MS);
      }
    }
    
    deactivateControls();
    updatePlayPauseUI();
    updateVideoTimeUI(0);
    updateVideoDurationUI(0);
    
    const updatePlaylistState = playlistState? debounce(1000, () => {
      playlistState.videoIndex = curVideoIndex;
      playlistState.videoElapsedSec = videoElem.currentTime || 0;
      savePlaylistState(playlistState);
    }) : () => {/*noop*/};
    
    videoElem.addEventListener('loadedmetadata', () => {
      updateVideoTimeUI(videoElem.currentTime);
      updatePlayPauseUI();
    });
    videoElem.addEventListener('durationchange', () => {
      updateVideoDurationUI(videoElem.duration);
      updatePlayPauseUI();
    });
    videoElem.addEventListener('timeupdate', () => {
      updateVideoTimeUI(videoElem.currentTime);
      updatePlaylistState();
    });
    videoElem.addEventListener('play', () => {
      updatePlayPauseUI();
    });
    videoElem.addEventListener('pause', () => updatePlayPauseUI());
    videoElem.addEventListener('error', () => updatePlayPauseUI());
    videoElem.addEventListener('waiting', () => {
      isWaiting = true;
      updatePlayPauseUI();
    });
    videoElem.addEventListener('playing', () => {
      isWaiting = false;
      updatePlayPauseUI();
    });
    videoElem.addEventListener('ended', () => {
      updatePlayPauseUI();
      setVideoIndex(curVideoIndex + 1);
    });
    
    videoElem.addEventListener('click', () => togglePlayPause());
    
    scrubberElem.addEventListener('mousedown', () => {
      selectScrubber();
      extendControls();
    });
    scrubberElem.addEventListener('input', () => {
      setVideoTime((scrubberElem.valueAsNumber / 100) * videoElem.duration, true);
    });
    scrubberElem.addEventListener('keydown', event => {
      // Prevent all keyboard events from reaching this input.
      event.preventDefault();
      return false;
    });
    
    playerElem.addEventListener('mousemove', debounce(100, () => activateControls()));
    
    // new SubtitlesOctopus({
    //   video: videoElem,
    //   subUrl: new URL('./assets/test.ass', window.location.href).href,
    //   workerUrl: './assets/lib/libass-wasm-4.1.0/subtitles-octopus-worker.js',
    //   legacyWorkerUrl: './assets/lib/libass-wasm-4.1.0/subtitles-octopus-worker-legacy.js',
    //   debug: true
    // });
    
    /** @param {number} targetIndex */
    function setVideoIndex(targetIndex) {
      targetIndex = Math.max(Math.min(targetIndex, videoFilepaths.length - 1), 0);
      if (curVideoIndex === targetIndex) return;
      
      curVideoIndex = targetIndex;
      const videoFilepath = videoFilepaths[curVideoIndex];
      
      if (prevNavListItemIndex !== -1) {
        navList.setItemIsDisabled(prevNavListItemIndex, curVideoIndex <= 0);
      }
      if (nextNavListItemIndex !== -1) {
        navList.setItemIsDisabled(nextNavListItemIndex, curVideoIndex >= videoFilepaths.length - 1);
      }
      
      updateVideoTimeUI(0);
      updateVideoDurationUI(0);
      isWaiting = true;
      videoElem.src = /^(\.|http)/.test(videoFilepath)? videoFilepath : 'file://' + videoFilepath;
      videoElem.load();
      void videoElem.play();
      updatePlayPauseUI();
    }
    
    setVideoIndex(playlistState?.videoIndex || 0);
    if (playlistState?.videoElapsedSec) {
      videoElem.currentTime = playlistState.videoElapsedSec;
    }
    
    super(screenElem);
    this.videoElem = videoElem;
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
          this.setVideoTime(this.videoElem.currentTime - this.calcPlayerSkipDurS(event));
          this.extendControls();
          return 2;
        }
        
        if (!this.getIsControlsActive() || !navController.getIsKeyboardNavActive()) {
          this.navList.setActiveItem(this.playPauseNavListIndex);
        }
        this.activateControls();
        this.navList.move(-1, 0);
        return 1;
      case 'RIGHT':
        if (this.getIsScrubberActive()) {
          this.setVideoTime(this.videoElem.currentTime + this.calcPlayerSkipDurS(event));
          this.extendControls();
          return 2;
        }
        
        if (!this.getIsControlsActive() || !navController.getIsKeyboardNavActive()) {
          this.navList.setActiveItem(this.playPauseNavListIndex);
        }
        this.activateControls();
        this.navList.move(1, 0);
        return 1;
    }
    return super.handleKey(event, keyAction);
  }
}

function init() {
  const errorAlertElem = requireElem('#errorAlert');
  
  const cWindow = /** @type {CustomWindow} */(window);
  const {movieLibraryConfig} = cWindow;
  if (!movieLibraryConfig) {
    errorAlertElem.innerText = 'Error: Configuration does not exist or is not able to be loaded. Check the console.';
    return;
  }
  
  const movies = (movieLibraryConfig.movies || []).map(x => {
    /** @type {Movie} */
    const movie = {
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
      thumbURL: x.thumbURL || (x.videoFilepath || '').replace(/^\/mnt\/m\//, 'file:///M:\\').replaceAll('/', '\\').replace(/\.(mp4|mkv|avi)$/, '-landscape.jpg'),
      logoURL: x.logoURL || '',
      keyartURL: x.keyartURL || '',
      videoFilepath: x.videoFilepath || '',
    };
    return movie;
  });
  
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
  
  const tvShows = (movieLibraryConfig.tvShows || []).map(x => {
    /** @type {TVShow} */
    const tvShow = {
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
      posterURL: x.posterURL || '',
      seasons: (x.seasons || []).map(x => {
        /** @type {Season} */
        const season = {
          seasonNumber: x.seasonNumber || 0,
          episodes: (x.episodes || []).map(x => {
            /** @param {Partial<import('./types').EpisodeBase>} x */
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
              thumbURL: x.thumbURL || (x.videoFilepath || '').replace(/^\/mnt\/m\//, 'file:///M:\\').replaceAll('/', '\\').replace(/\.(mp4|mkv|avi)$/, '-thumb.jpg'),
              videoFilepath: x.videoFilepath || '',
              multiepisodeBases: (x.multiepisodeBases || []).map(mapEpisodeBase),
            };
            return episode;
          })
        };
        return season;
      }),
    };
    return tvShow;
  });
  
  if (!movieLibraryConfig.enableMouseAtStart) {
    navController.useKeyboardNav();
  }
  
  deeplinkSlugs = (
    window.location.hash.substring(1)
    .split('/')
    .map(x => decodeURIComponent(x))
  );
  
  const testPaths = Array(10).fill(0).map((_,i) => `C:\\Users\\Mike\\Downloads\\thing${i+1}.mp4`);
  const tvPaths = String.raw`
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
M:\TV\Death Note\Season 01\01.33 - Scorn.mp4
M:\Bumpers\bumpworthy\3647 - Flip's Tips - Tornado.mp4
M:\Bumpers\bumpworthy\7697 - Flashing Maintenance Light.mp4
M:\Bumpers\Ambient Swim Bumpers\bump51.mp4
M:\TV\The Boondocks\Season 03\03.02 - Bitches to Rags.mp4
M:\Bumpers\bumpworthy\5731 - Toonami InuYasha Back 2.mp4
M:\Bumpers\Ambient Swim Bumpers\bump241.mp4
M:\TV\King of the Hill\Season 02\02.20 - Junkie Business.mp4
M:\Bumpers\bumpworthy\4973 - Ted Turner Commencement Speech.mp4
M:\Bumpers\Ambient Swim Bumpers\bump1518.mp4
M:\TV\Ghost in the Shell\Season 02\02.06 - Excavation.mp4
M:\Bumpers\bumpworthy\1378 - Kim at the Tokyo Anime Fair.mp4
M:\Bumpers\bumpworthy\497 - AcTN Window.mp4
M:\Bumpers\bumpworthy\7232 - Tweets Oct 06 2013 Pt 1.mp4
M:\Bumpers\Ambient Swim Bumpers\bump1166.mp4
M:\TV\Ghost in the Shell\Season 02\02.07 - 239 Pu - 94.mp4
M:\Bumpers\bumpworthy\1617 - Massive Clearance.mp4
M:\Bumpers\Ambient Swim Bumpers\bump1180.mp4
M:\TV\Squidbillies\Season 03\03.09 - Condition Demolition!.mp4
M:\Bumpers\bumpworthy\126 - We Want In.mp4
M:\Bumpers\Ambient Swim Bumpers\bump1275.mp4
M:\TV\The Boondocks\Season 03\03.03 - The Red Ball.mp4
M:\Bumpers\bumpworthy\8517 - Toonami 3.0 Space Dandy 8.mp4
M:\Bumpers\bumpworthy\1583 - For The Troops.mp4
M:\Bumpers\bumpworthy\4628 - Eastern Seaboard ISS Image.mp4
M:\Bumpers\Ambient Swim Bumpers\bump1109.mp4
M:\TV\King of the Hill\Season 02\02.21 - Life in the Fast Lane Bobby's Saga.mp4
M:\Bumpers\bumpworthy\635 - Bump Strike is Back.mp4
M:\Bumpers\Ambient Swim Bumpers\bump179.mp4
M:\TV\Robot Chicken\Season 01\Robot Chicken S01E07 - A Piece of the Action.mkv
M:\Bumpers\bumpworthy\4827 - PSA - Cat Throwing Distance.mp4
M:\Bumpers\Ambient Swim Bumpers\bump1298.mp4
M:\TV\Tim and Eric Awesome Show, Great Job!\Season 05\05.06 - Lucky.mp4
M:\Bumpers\bumpworthy\6805 - A-1 White Greatest Idea Ever.mp4
M:\Bumpers\bumpworthy\4292 - AS Character Face Swaps.mp4
M:\Bumpers\bumpworthy\1613 - Old Gregg.mp4
M:\Bumpers\Ambient Swim Bumpers\bump149.mp4
M:\TV\Aqua Teen Hunger Force\Season 03\03.04 - Gee Whiz.mp4
M:\Bumpers\bumpworthy\1123 - Portuguese Wave Farm.mp4
M:\Bumpers\bumpworthy\5494 - Tweets Sep 30 2012 Pt 1.mp4
M:\Bumpers\bumpworthy\8680 - Toonami 3.0 Cowboy Bebop 1.mp4
M:\Bumpers\Ambient Swim Bumpers\bump1342.mp4
M:\TV\Metalocalypse\Season 01\01.03 - Birthdayface.mp4
M:\Bumpers\bumpworthy\7616 - Toonami 2.0 IGPX 34.mp4
M:\Bumpers\bumpworthy\1148 - Shotglass Travels - Year Two.mp4
M:\Bumpers\bumpworthy\8526 - Facebook Plans for Second Network.mp4
M:\Bumpers\Ambient Swim Bumpers\bump10.mp4
M:\TV\Robot Chicken\Season 04\04.09 - But Not in That Way.mp4
M:\Bumpers\bumpworthy\8423 - Want to See Our Tiny Gentleman.mp4
M:\Bumpers\bumpworthy\8411 - Toonami 3.0 Space Dandy 3.mp4
M:\Bumpers\bumpworthy\1379 - PSA - Your Cat.mp4
M:\Bumpers\Ambient Swim Bumpers\bump1057.mp4
M:\TV\Metalocalypse\Season 04\04.11 - Breakup Klok.mp4
M:\Bumpers\bumpworthy\8396 - Toonami 3.0 Naruto 5.mp4
M:\Bumpers\bumpworthy\1782 - Rare Apology.mp4
M:\Bumpers\Ambient Swim Bumpers\bump522.mp4
M:\TV\Squidbillies\Season 09\09.04 - Ink is Thicker Than Blood, Which is Thicker Than Water.mp4
M:\Bumpers\bumpworthy\8364 - Coast to Coast Crowd Wave Pt 2.mp4
M:\Bumpers\Ambient Swim Bumpers\bump1414.mp4
M:\TV\Death Note\Season 01\01.34 - Vigilance.mp4
M:\Bumpers\bumpworthy\772 - Marine Hierarchy.mp4
M:\Bumpers\bumpworthy\7057 - Molyneux's Digital Cube.mp4
M:\Bumpers\bumpworthy\5416 - RIP Max the Cat.mp4
M:\Bumpers\Ambient Swim Bumpers\bump971.mp4
M:\TV\Tim and Eric Awesome Show, Great Job!\Season 05\05.01 - Comedy.mp4
M:\Bumpers\bumpworthy\388 - Holidays - Beard Family 1.mp4
M:\Bumpers\bumpworthy\6908 - SDCC 2013 Fun House Pics.mp4
M:\Bumpers\Ambient Swim Bumpers\bump271.mp4
M:\TV\Ghost in the Shell\Season 02\02.08 - Fake Food.mp4
M:\Bumpers\bumpworthy\794 - Ringtones.mp4
M:\Bumpers\bumpworthy\2057 - Adult Swim is for Conan.mp4
M:\Bumpers\bumpworthy\3466 - Animated Logo - Mine Carts.mp4
M:\Bumpers\Ambient Swim Bumpers\bump168.mp4
M:\TV\King of the Hill\Season 02\02.22 - Peggy's Turtle Song.mp4
M:\Bumpers\bumpworthy\7753 - Toonami 2.0 IGPX 43.mp4
M:\Bumpers\bumpworthy\6652 - Toonami 2.0 FMAB 03.mp4
M:\Bumpers\bumpworthy\3415 - Anime Transport v2.mp4
M:\Bumpers\Ambient Swim Bumpers\bump209.mp4
M:\TV\The Boondocks\Season 03\03.04 - Stinkmeaner 3 The Hateocracy.mp4
M:\Bumpers\bumpworthy\6478 - Toonami 2.0 Now Bleach 01.mp4
M:\Bumpers\bumpworthy\1682 - Stewie is Gay.mp4
M:\Bumpers\bumpworthy\5897 - Toonami InuYasha Next 07.mp4
M:\Bumpers\Ambient Swim Bumpers\bump1201.mp4
M:\TV\Aqua Teen Hunger Force\Season 02\02.19 - Frat Aliens.mp4
M:\Bumpers\bumpworthy\7695 - Fish in a Tank Fan Bump.mp4
M:\Bumpers\Ambient Swim Bumpers\bump1055.mp4
M:\TV\Ghost in the Shell\Season 02\02.09 - Ambivalence.mp4
M:\Bumpers\bumpworthy\1657 - Needless Big Words.mp4
M:\Bumpers\Ambient Swim Bumpers\bump618.mp4
M:\TV\Metalocalypse\Season 03\03.02 - Tributeklok.mp4
M:\Bumpers\bumpworthy\8397 - Toonami 3.0 Naruto 6.mp4
M:\Bumpers\bumpworthy\7429 - Toonami 2.0 Cowboy Bebop Marathon Intro.mp4
M:\Bumpers\Ambient Swim Bumpers\bump871.mp4
M:\TV\Tim and Eric Awesome Show, Great Job!\Season 01\01.01 - Dads.mp4
M:\Bumpers\bumpworthy\7116 - Toonami 2.0 IGPX 21.mp4
M:\Bumpers\bumpworthy\5628 - Toonami InuYasha Next 01 v1.mp4
M:\Bumpers\Ambient Swim Bumpers\bump1449.mp4
M:\TV\Death Note\Season 01\01.35 - Malice.mp4
M:\Bumpers\bumpworthy\6851 - Toonami 2.0 Naruto To Ads 04.mp4
M:\Bumpers\bumpworthy\2546 - Science Essay - The Moon.mp4
M:\Bumpers\Ambient Swim Bumpers\bump1155.mp4
M:\TV\Robot Chicken\Season 07\07.05 - Legion of Super-Gyros.mp4
M:\Bumpers\bumpworthy\6889 - Fog Blast.mp4
M:\Bumpers\bumpworthy\6919 - SDCC 2013 Yes or No Pics.mp4
M:\Bumpers\bumpworthy\4416 - Pollo de Robot Facts.mp4
M:\Bumpers\Ambient Swim Bumpers\bump1103.mp4
M:\TV\Squidbillies\Season 06\06.04 - The Big E.mp4
M:\Bumpers\bumpworthy\7220 - Returned Wallet Experiment.mp4
M:\Bumpers\Ambient Swim Bumpers\bump230.mp4
M:\TV\The Boondocks\Season 03\03.05 - Smokin' With Cigarettes.mp4
M:\Bumpers\bumpworthy\7219 - Idiot World Map.mp4
M:\Bumpers\bumpworthy\3236 - Eagleheart Stats 1.mp4
M:\Bumpers\Ambient Swim Bumpers\bump807.mp4
M:\TV\King of the Hill\Season 02\02.23 - Propane Boom I.mp4
M:\Bumpers\bumpworthy\3678 - Owls - Hiding in Tree.mp4
M:\Bumpers\bumpworthy\482 - ATHF Clips.mp4
M:\Bumpers\Ambient Swim Bumpers\bump1484.mp4
M:\TV\Metalocalypse\Season 02\02.05 - Dethfashion.mp4
M:\Bumpers\bumpworthy\1386 - Baby Kudzu.mp4
M:\Bumpers\bumpworthy\4382 - Itsyourface Viewer Bump.mp4
M:\Bumpers\bumpworthy\711 - And the ShotGlass winner is.mp4
M:\Bumpers\Ambient Swim Bumpers\bump195.mp4
M:\TV\Aqua Teen Hunger Force\Season 08\08.03 - Intervention.mp4
M:\Bumpers\bumpworthy\6933 - Apologize for Overuse of Word.mp4
M:\Bumpers\Ambient Swim Bumpers\bump303.mp4
M:\TV\Metalocalypse\Season 04\04.07 - Dethcamp.mp4
M:\Bumpers\bumpworthy\1730 - AFC Games.mp4
M:\Bumpers\Ambient Swim Bumpers\bump1087.mp4
M:\TV\Ghost in the Shell\Season 02\02.10 - Trial.mp4
M:\Bumpers\bumpworthy\2603 - Schedule Change Conclusion.mp4
M:\Bumpers\bumpworthy\7172 - Toonami 2.0 Intro 32.mp4
M:\Bumpers\bumpworthy\6020 - Toonami Now FMA Brotherhood 09.mp4
M:\Bumpers\Ambient Swim Bumpers\bump1159.mp4
M:\TV\Squidbillies\Season 05\05.04 - Young, Dumb and Full of Gums.mp4
M:\Bumpers\bumpworthy\4993 - Toonami Cowboy Bebop Back 1.mp4
M:\Bumpers\Ambient Swim Bumpers\bump544.mp4
M:\TV\Robot Chicken\Season 02\02.13 - Metal Militia.mp4
M:\Bumpers\bumpworthy\2306 - No More Big Words.mp4
M:\Bumpers\bumpworthy\1777 - Movie Poster Fonts.mp4
M:\Bumpers\bumpworthy\7184 - Toonami 2.0 Akira To Ads 4.mp4
M:\Bumpers\Ambient Swim Bumpers\bump1106.mp4
M:\TV\Death Note\Season 01\01.36 - 1.28.mp4
M:\Bumpers\bumpworthy\6878 - Toonami 2.0 IGPX 11.mp4
M:\Bumpers\bumpworthy\1242 - Buy ATHF Vol. 6.mp4
M:\Bumpers\Ambient Swim Bumpers\bump1097.mp4
M:\TV\Tim and Eric Awesome Show, Great Job!\Season 03\03.04 - Spagett.mp4
M:\Bumpers\bumpworthy\670 - Futurama - Bending Shadows v3.mp4
M:\Bumpers\bumpworthy\6102 - A Series of Very Young Explosions.mp4
M:\Bumpers\bumpworthy\856 - Dear Kid Robot.mp4
M:\Bumpers\Ambient Swim Bumpers\bump1508.mp4
M:\TV\King of the Hill\Season 03\03.01 - Propane Boom II Death of a Propane Salesman.mp4
M:\Bumpers\bumpworthy\5876 - Tweets Dec 23 2012.mp4
M:\Bumpers\bumpworthy\4060 - EmotionallyVague Research 1.mp4
M:\Bumpers\Ambient Swim Bumpers\bump769.mp4
M:\TV\The Boondocks\Season 03\03.06 - The Fundraiser.mp4
M:\Bumpers\bumpworthy\2173 - Freaknik - Awards.mp4
M:\Bumpers\bumpworthy\4144 - Adult Swim Timeline 4.mp4
M:\Bumpers\bumpworthy\2286 - Aqua Teen or Bed.mp4
M:\Bumpers\Ambient Swim Bumpers\bump482.mp4
M:\TV\Robot Chicken\Season 09\09.08 - We Don't See Much of That in 1940's America.mp4
M:\Bumpers\bumpworthy\6288 - Meow Meow - Mecha Cat 2.mp4
M:\Bumpers\Ambient Swim Bumpers\bump765.mp4
M:\TV\King of the Hill\Season 03\03.02 - And They Call It Bobby Love.mp4
M:\Bumpers\bumpworthy\8498 - Toonami 3.0 Bleach 8.mp4
M:\Bumpers\Ambient Swim Bumpers\bump1491.mp4
M:\TV\Aqua Teen Hunger Force\Season 06\06.09 - The Last Last One Forever and Ever.mp4
M:\Bumpers\bumpworthy\7807 - If You Were a Spider Question.mp4
M:\Bumpers\Ambient Swim Bumpers\bump1446.mp4
M:\TV\Aqua Teen Hunger Force\Season 03\03.01 - Video Ouija.mp4
M:\Bumpers\bumpworthy\573 - Ghostface Killah.mp4
M:\Bumpers\bumpworthy\5342 - Corddry Ready to Tweet.mp4
M:\Bumpers\Ambient Swim Bumpers\bump409.mp4
M:\TV\Squidbillies\Season 04\04.10 - Not Without My Cash Cow!.mp4
M:\Bumpers\bumpworthy\258 - Science Department.mp4
M:\Bumpers\bumpworthy\7601 - Behold the Snow Falcon.mp4
M:\Bumpers\bumpworthy\7817 - Tweets Mar 23 2014 Pt 2.mp4
M:\Bumpers\Ambient Swim Bumpers\bump620.mp4
M:\TV\Ghost in the Shell\Season 02\02.11 - Affection.mp4
M:\Bumpers\bumpworthy\1058 - RC Season 3.5.mp4
M:\Bumpers\Ambient Swim Bumpers\bump953.mp4
M:\TV\The Boondocks\Season 03\03.07 - Pause.mp4
M:\Bumpers\bumpworthy\227 - Mermaid Murder.mp4
M:\Bumpers\Ambient Swim Bumpers\bump1434.mp4
M:\TV\Death Note\Season 01\01.37 - New World.mp4
  `.split('\n').map(x => x.trim()).filter(x => x);
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
  
  new MenuScreen([{
    title: 'Kids',
    action: () => new GridScreen(movies.map(movie => ({
      title: movie.title,
      imageURL: movie.thumbURL,
      action: () => new DetailScreen(movie).show()
    }))).show()
   }, {
    title: 'Parents',
    action: () => new PinScreen('1141', () =>
      new MenuScreen([{
        title: 'Movies',
        action: () => new GridScreen(parentMovies.map(movie => ({
          title: movie.title,
          imageURL: movie.thumbURL,
          action: () => new DetailScreen(movie).show()
        }))).show()
      }, {
        title: 'Shows',
        action: () => new GridScreen(tvShows.map(tvShow => ({
          title: tvShow.title,
          imageURL: tvShow.thumbURL,
          action: () => new TVShowScreen(tvShow).show()
        }))).show()
      }, {
        title: 'TV',
        action: () => new PlayerScreen(
          tvPaths,
          getPlaylistState('tv-adult'),
        ).show()
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

/** @param {string} filepath */
function playVideo(filepath) {
  // const url = 'movielib.player://' + filepath;
  // console.log('Playing', url);
  // window.open(url, '_self');
  new PlayerScreen(filepath).show();
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
    };
  }
  
  playlistStateCache.set(playlistStateID, state);
  return state;
}
/** @param {PlaylistState} playlistState */
function savePlaylistState(playlistState) {
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
 * @returns {(...args: T) => void}
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

init();
} window.addEventListener('DOMContentLoaded', () => load());