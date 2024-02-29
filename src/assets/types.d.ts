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
  clearartURL: string;
  videoURL: string;
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
  clearartURL: string;
  posterURL: string;
  seasons: Season[];
}

export interface Season {
  seasonNumber: number;
  episodes: Episode[];
}

export interface EpisodeBase {
  id: string;
  title: string;
  seasonNumber: number;
  episodeNumber: number;
  dvdEpisodeNumber: number;
  specialSeasonNumber: number;
  specialEpisodeNumber: number;
  specialAfterSeasonNumber: number;
  airedDateISOStr: string;
  year: string;
  plot: string;
  runtimeMinutes: number;
  directorNames: string[];
  actorNames: string[];
}
export interface Episode extends EpisodeBase {
  episodeOrd: number;
  thumbURL: string;
  videoURL: string;
  multiepisodeBases: EpisodeBase[];
}

type PartialDeep<T> = T extends any[]? PartialDeep<T[number]>[] : T extends object? {[P in keyof T]?: PartialDeep<T[P]>} : T;
export interface Config {
 enableGridNavWrap: boolean;
 enableMouseAtStart: boolean;
 enableFullscreenToggle: boolean;
 movies: PartialDeep<Movie>[];
 tvShows: PartialDeep<TVShow>[];
}

export interface CustomWindow {
  movieLibraryConfig?: Partial<Config>;
  movieLibraryFilter?: (movie: Movie) => boolean;
  movieLibrarySort?: (movieA: Movie, movieB: Movie) => number;
  tvShowLibrarySort?: (tvShowA: TVShow, tvShowB: TVShow) => number;
}
