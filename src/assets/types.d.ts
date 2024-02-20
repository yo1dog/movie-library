export interface Movie {
  id: string;
  title: string;
  titleSortStr: string;
  setName: string;
  setNameSortStr: string;
  year: string;
  premiereDateISOStr: string;
  plot: string;
  tagline: string;
  rating: string;
  genres: string[];
  directorNames: string[];
  actorNames: string[];
  studioNames: string[];
  hasSubtitles: boolean;
  runtimeMinutes: number;
  thumbURL: string;
  logoURL: string;
  keyartURL: string;
  videoFilepath: string;
}

export interface TVShow {
  id: string;
  title: string;
  titleSortStr: string;
  episodeOrderingType: 'default' | 'dvd';
  year: string;
  premiereDateISOStr: string;
  plot: string;
  rating: string;
  genres: string[];
  runtimeMinutes: number;
  actorNames: string[];
  studioNames: string[];
  thumbURL: string;
  logoURL: string;
  posterURL: string;
  seasons: Season[];
}

export interface Season {
  seasonNumber: number;
  episodes: Episode[];
}

export interface Episode {
  id: string;
  title: string;
  seasonNumber: number;
  episodeNumber: number;
  dvdEpisodeNumber: number;
  specialSeasonNumber: number;
  specialEpisodeNumber: number;
  specialAfterSeasonNumber: number;
  episodeOrd: number;
  airedDateISOStr: string;
  year: string;
  plot: string;
  runtimeMinutes: number;
  directorNames: string[];
  actorNames: string[];
  thumbURL: string;
  videoFilepath: string;
}

export interface Config {
 enableGridNavWrap?: boolean;
 enableMouseAtStart?: boolean;
 movies: Partial<Movie>[];
 tvShows: (Omit<Partial<TVShow>, 'seasons'> & {seasons?: (Omit<Partial<Season>, 'episodes'> & {episodes?: Partial<Episode>[]})[]})[];
}

export interface CustomWindow {
  movieLibraryConfig?: Config;
  movieLibraryFilter?: (movie: Movie) => boolean;
  movieLibrarySort?: (movieA: Movie, movieB: Movie) => number;
}
