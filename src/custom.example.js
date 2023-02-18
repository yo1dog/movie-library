(() => {
/**
 * @typedef CustomWindow
 * @property {(movie: Movie) => boolean} [movieLibraryFilter]
 * @property {(movieA: Movie, movieB: Movie) => number} [movieLibrarySort]
 */

/**
 * @typedef Movie
 * @property {string} title
 * @property {string} sortStr
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

/** @type {CustomWindow} */
const cwindow = {
  movieLibraryFilter: (movie) => ['Rated G', 'Rated PG'].includes(movie.rating)
};

Object.assign(window, cwindow);
})();
