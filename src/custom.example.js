(() => {
/** @type {import('./assets/types').CustomWindow} */
const cwindow = {
  movieLibraryFilter: (movie) => ['Rated G', 'Rated PG'].includes(movie.rating),
  // Sort movies in sets by release date.
  movieLibrarySort: (a, b) => (
    a.setName && a.setName === b.setName
    ? a.premiereDateISOStr.localeCompare(b.premiereDateISOStr)
    : (a.setNameSortStr || a.titleSortStr).localeCompare(b.setNameSortStr || b.titleSortStr)
  )
};

Object.assign(window, cwindow);
})();
