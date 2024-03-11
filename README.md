# Movie Library (BETA)

A super simple frontend for browsing movies.

- Displays your list of movies.
- Plays your movies with whatever player you want (like VLC).
- Supports keyboard navigation (and thus remotes I assume).
- That's it. No mess. No fuss. No coconuts.


## Requirements

- A browser.


https://user-images.githubusercontent.com/1504597/218681879-0660249c-68f3-4276-b63a-0b10d7962ae0.mp4


## Setup

- Download `movieLibrary#.#.#.zip` from the [latest release](https://github.com/yo1dog/movie-library/releases/latest) and extract the files.
- Just open the HTML files in your browser.
- The list of movies and their attributes is pulled from a local `config.js` file. This file can be created manually or generated. An example file can be found [here](./src/config.example.js).
- To generate the config file, use `configure.html` and follow the instructions.
- When generating the config file, I suggest using tinyMediaManager to manage metadata and image files (v3 is free).
- To launch the player program from the browser, a custom URL protocol must be registered. Use `playerScripts.html` and follow the instructions.
- You can download skins for VLC if you do not like the default interface (or use a different player entirely).
- The config generator and player scripts are built for Windows (for now).
- Works best in FireFox as it handles scrolling better.
- You can specify custom filtering and sorting functions by creating a local `custom.js` file. An example file can be found [here](./src/custom.example.js).

## Source

Everything outside of `src` is only used for linting.
