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
  'Rated G': 'assets/rating-g.png',
  'Rated PG': 'assets/rating-pg.png',
  'Rated PG-13': 'assets/rating-pg13.png',
  'Rated R': 'assets/rating-r.png',
};

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

/**
 * @typedef CustomWindow
 * @property {Config} [movieLibraryConfig]
 * @property {(movie: Movie) => boolean} [movieLibraryFilter]
 * @property {(movieA: Movie, movieB: Movie) => number} [movieLibrarySort]
 */

/**
 * @typedef Config
 * @property {boolean} [enableGridNavWrap]
 * @property {boolean} [enableMouseAtStart]
 * @property {Movie[]} movies
 */

/**
 * @typedef Movie
 * @property {string} title
 * @property {string} titleSortStr
 * @property {string} setName
 * @property {string} setNameSortStr
 * @property {string} year
 * @property {string} premiereDateISOStr
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
 * @property {string} videoFilepath
 */

/**
 * @typedef NavListItemRaw
 * @property {HTMLElement} elem
 * @property {(event?: KeyboardEvent | MouseEvent) => void} action
 */
/**
 * @typedef NavListItem
 * @property {HTMLElement} elem
 * @property {(event?: KeyboardEvent | MouseEvent) => void} action
 * @property {number} index
 * @property {number} x
 * @property {number} y
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
   * @param {NavListItemRaw[]} rawItems
   * @param {number} [gridNumColumns]
   * @param {boolean} [enableWrap]
   */
  constructor(rawItems, gridNumColumns, enableWrap) {
    if (rawItems.length === 0) throw new Error(`No items given.`);
    
    this.numColumns = gridNumColumns || rawItems.length;
    this.numRows = Math.ceil(rawItems.length / this.numColumns);
    this.enableWrap = enableWrap ?? false;
    
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
      item.elem.addEventListener('click', event => {
        this.setActiveItem(item.index, false);
        item.action(event);
      });
      item.elem.addEventListener('mouseenter', () => {
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
    
    let index;
    if (this.enableWrap) {
      index = this.activeItem.index + dx + (dy * this.numColumns);
      if (index < 0) index = 0;
      if (index > this.items.length - 1) index = this.items.length - 1;
    }
    else {
      let x = this.activeItem.x + dx;
      let y = this.activeItem.y + dy;
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
    
    if (this.activeItem && !this.activeItemIsHidden) {
      this.activeItem.elem.classList.add('active');
      if (scroll) {
        this.activeItem.elem.scrollIntoView({
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
  
  hideActiveItem() {
    this.activeItem?.elem.classList.remove('active');
    this.activeItemIsHidden = true;
  }
  unhideActiveItem() {
    this.activeItem?.elem.classList.add('active');
    this.activeItemIsHidden = false;
  }
}

const menuScreenTemplate = /** @type {HTMLTemplateElement} */(requireElem('#menuScreenTemplate'));
const gridScreenTemplate = /** @type {HTMLTemplateElement} */(requireElem('#gridScreenTemplate'));
const detailScreenTemplate = /** @type {HTMLTemplateElement} */(requireElem('#detailScreenTemplate'));
const pinScreenTemplate = /** @type {HTMLTemplateElement} */(requireElem('#pinScreenTemplate'));
const playerScreenTemplate = /** @type {HTMLTemplateElement} */(requireElem('#playerScreenTemplate'));

/** @type {Screen[]} */
const screens = [];

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
 * @property {(screen: Screen) => void} action
 */

class MenuScreen extends Screen {
  /**
   * @param {MenuItem[]} menuItems
   */
  constructor(menuItems) {
    const frag = /** @type {DocumentFragment} */(menuScreenTemplate.content.cloneNode(true));
    const screenElem = requireElem('main', frag);
    const gridElem = requireElem('.grid', screenElem);
    const gridItemTemplate = /** @type {HTMLTemplateElement} */(gridElem.getElementsByTagName('TEMPLATE')[0]);
    
    /** @type {NavListItemRaw[]} */
    const navItems = [];
    for (const menuItem of menuItems) {
      const gridItemNode = /** @type {DocumentFragment} */(gridItemTemplate.content.cloneNode(true));
      const gridItemElem = requireElem('.gridItem', gridItemNode);
      const gridItemTextElem = requireElem('.gridItemText', gridItemNode);
      const gridItemImgElem = /**@type {HTMLImageElement} */(requireElem('.gridItemImg', gridItemNode));
      
      gridElem.style.gridTemplateColumns = `repeat(${menuItems.length}, minmax(auto, 25vw))`;
      
      gridItemTextElem.innerText = menuItem.title;
      
      if (menuItem.imageURL) {
        gridItemImgElem.src = menuItem.imageURL;
      }
      else {
        gridItemImgElem.remove();
      }
      
      gridElem.appendChild(gridItemElem);
      navItems.push({
        elem: gridItemElem,
        action: () => menuItem.action(this),
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
        this.navList.activeItem?.action(event);
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
    
    /** @type {NavListItemRaw[]} */
    const navItems = [];
    
    // TODO: hack
    menuItems.unshift({
      title: 'Back',
      action: () => this.close(),
    });
    for (const menuItem of menuItems) {
      const gridItemNode = /** @type {DocumentFragment} */(gridItemTemplate.content.cloneNode(true));
      const gridItemElem = requireElem('.gridItem', gridItemNode);
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
      else {
        gridItemImgElem.remove();
      }
      
      gridElem.appendChild(gridItemElem);
      navItems.push({
        elem: gridItemElem,
        action: () => menuItem.action(this)
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
        this.navList.activeItem?.action(event);
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
    const movieYearElems = /** @type {HTMLElement[]} */(Array.from(screenElem.querySelectorAll('.movieYear')));
    const runtimeElems = /** @type {HTMLElement[]} */(Array.from(screenElem.querySelectorAll('.runtime')));
    const generesElems = /** @type {HTMLElement[]} */(Array.from(screenElem.querySelectorAll('.generes')));
    const detailTopPanelDesc = requireElem('.detailTopPanelDesc', screenElem);
    const movieTitleElem = requireElem('.movieTitle', screenElem);
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
      const url = movie.rating? RATING_IMG_URL_DICT[movie.rating] : '';
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
        this.navList.activeItem?.action(event);
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

class PinScreen extends Screen {
  /**
   * @param {string} pin 
   * @param {(screen: Screen) => void} action 
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
    /** @type {NavListItemRaw[]} */
    const numpadNavListItems = [];
    for (let digit = 0; digit < 10; ++digit) {
      numpadNavListItems.push({
        elem: requireElem(`.numpad${digit}`, numpadElem),
        action: () => this.addPinChar(digit.toString())
      });
    }
    /** @type {NavListItemRaw} */
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
      this.action(this);
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
          this.numpadNavList.activeItem?.action(event);
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
}

class PlayerScreen extends Screen {
  /**
   * @param {string} videoFilepath 
   */
  constructor(videoFilepath) {
    const frag = /** @type {DocumentFragment} */(playerScreenTemplate.content.cloneNode(true));
    const screenElem = requireElem('main', frag);
    const videoElem = /** @type {HTMLVideoElement} */(requireElem('video', screenElem));
    const playerElem = /** @type {HTMLInputElement} */(requireElem('.player', screenElem));
    const scrubberElem = /** @type {HTMLInputElement} */(requireElem('.playerScrubber', screenElem));
    const timeElem = requireElem('.playerTime', screenElem);
    const durationElem = requireElem('.playerDuration', screenElem);
    const stopButtonElem = /** @type {HTMLButtonElement} */(requireElem('.playerStopButton', screenElem));
    const previousButtonElem = /** @type {HTMLButtonElement} */(requireElem('.playerPreviousButton', screenElem));
    const rewindButtonElem = /** @type {HTMLButtonElement} */(requireElem('.playerRewindButton', screenElem));
    const playPauseButtonElem = /** @type {HTMLButtonElement} */(requireElem('.playerPlayPauseButton', screenElem));
    const playSVG = requireElem('.playSVG', playPauseButtonElem);
    const pauseSVG = requireElem('.pauseSVG', playPauseButtonElem);
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
    
    const navList = new NavigatableList([
      {elem: stopButtonElem, action: () =>
        this.close()
      },
      {elem: previousButtonElem, action: () => {
        // noop
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
        // noop
      }},
    ]);
    const playPauseNavListIndex = navList.items.findIndex(x => x.elem === playPauseButtonElem);
    const allowRepeatNavItems = navList.items.filter(x => x.elem === fastForwardButtonElem || x.elem === rewindButtonElem);
    
    let isControlsActive = false;
    let isScrubberActive = false;
    /** @type {number | undefined} */
    let controlsTimeoutID;
    
    /** @param {number} [durationMS] */
    function activateControls(durationMS) {
      isControlsActive = true;
      playerElem.classList.remove('hiddenControls');
      if (controlsTimeoutID) clearTimeout(controlsTimeoutID);
      controlsTimeoutID = setTimeout(deactivateControls, durationMS || PLAYER_CONTROLS_TIMEOUT_MS);
    }
    function deactivateControls() {
      isControlsActive = false;
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
      timeSec = Math.max(Math.min(timeSec, videoElem.duration), 0);
      _setVideoElemCurrentTime(timeSec);
      updateVideoTimeUI(timeSec, skipUpdateScrubberValue);
    } 
    /**
     * @param {number} timeSec 
     * @param {boolean} [skipUpdateScrubberValue] 
     */
    function updateVideoTimeUI(timeSec, skipUpdateScrubberValue) {
      if (!skipUpdateScrubberValue) scrubberElem.valueAsNumber = (timeSec / videoElem.duration) * 100;
      scrubberElem.style.setProperty('--value', `${(timeSec / videoElem.duration) * 100}%`);
      timeElem.innerText = formatDuration(timeSec);
    }
    function getIsPlaying() {
      return !videoElem.paused && !videoElem.ended;
    }
    function updatePlayPauseUI() {
      if (getIsPlaying()) {
        playSVG.style.display = 'none';
        pauseSVG.style.display = '';
      }
      else {
        playSVG.style.display = '';
        pauseSVG.style.display = 'none';
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
    
    videoElem.src = 'file://' + videoFilepath;
    
    videoElem.addEventListener('loadedmetadata', () => {
      updateVideoTimeUI(videoElem.currentTime);
      updatePlayPauseUI();
    });
    videoElem.addEventListener('durationchange', () => {
      durationElem.innerText = formatDuration(videoElem.duration);
    });
    videoElem.addEventListener('timeupdate', () => {
      updateVideoTimeUI(videoElem.currentTime);
    });
    videoElem.addEventListener('play',  () => updatePlayPauseUI());
    videoElem.addEventListener('pause', () => updatePlayPauseUI());
    videoElem.addEventListener('ended', () => updatePlayPauseUI());
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
    
    activateControls();
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
              this.navList.activeItem.action(event);
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
  
  /** @type {Movie[]} */
  let movies = [];
  for (const movie of Array.isArray(movieLibraryConfig.movies)? movieLibraryConfig.movies : []) {
    movies.push({
      title: movie.title || '',
      titleSortStr: movie.titleSortStr || '',
      setName: movie.setName || '',
      setNameSortStr: movie.setNameSortStr || '',
      year: movie.year || '',
      premiereDateISOStr: movie.premiereDateISOStr || '',
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
      videoFilepath: movie.videoFilepath || '',
    });
  }
  
  if (!movies.length) {
    errorAlertElem.innerText = 'Error: Configuration contains no movies.';
    return;
  }
  
  if (cWindow.movieLibraryFilter) {
    movies = movies.filter(cWindow.movieLibraryFilter);
  }
  
  if (!movies.length) {
    errorAlertElem.innerText = 'Error: No movies remaining after filtering.';
    return;
  }
  
  if (cWindow.movieLibrarySort) {
    movies.sort(cWindow.movieLibrarySort);
  }
  
  if (!movieLibraryConfig.enableMouseAtStart) {
    navController.useKeyboardNav();
  }
  
  new MenuScreen([{
    title: 'Movies',
    action: () => new GridScreen(movies.map(movie => ({
      title: movie.title,
      imageURL: movie.thumbURL,
      action: () => new DetailScreen(movie).show()
    }))).show()
  }, {
    title: 'TV',
    action: () => new PinScreen('1111', () =>
      new GridScreen([
        {title: 'Test1', action: () => new PlayerScreen(`C:\\Users\\Mike\\Downloads\\test.mp4`).show()},
        {title: 'Test2', action: () => new PlayerScreen(`C:\\Users\\Mike\\Downloads\\test2.mp4`).show()},
        {title: 'Test3', action: () => new PlayerScreen(`M:\\TV\\Ambient Swim\\bumps\\bump${Math.floor(Math.random()*1521)}.mp4`).show()},
        //{title: 'Test4', action: () => new PlayerScreen(`C:\\Users\\Mike\\Downloads\\The Office (US) (2005) - S01E01 - Pilot (1080p AMZN WEB-DL x265 LION).mkv`).show()},
      ]).show()
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