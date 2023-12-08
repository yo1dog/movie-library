global.window = {};
require('../src/config');
const fs = require('fs');
const {basename} = require('path');
const path = require('path');
const srcDir = path.join(__dirname, '..', 'src');
const bundleDir = path.join(__dirname, '..', 'tmp', 'bundle');

fs.mkdirSync(path.join(bundleDir, 'assets'), {recursive: true});
const assetDir = path.join(srcDir, 'assets');
const assetFilenames = fs.readdirSync(assetDir);
for (const filename of assetFilenames) {
  fs.copyFileSync(path.join(assetDir, filename), path.join(bundleDir, 'assets', filename));
}

fs.copyFileSync(path.join(srcDir, 'movieLibrary.html'), path.join(bundleDir, 'movieLibrary.html'));
fs.mkdirSync(path.join(bundleDir, 'local'), {recursive: true});

const config = global.window.movieLibraryConfig;
for (let i = 0; i < config.movies.length; ++i) {
  const movie = config.movies[i];
  if (!movie.thumbURL || !movie.keyartURL) {
    config.movies.splice(i, 1);
    --i;
    continue;
  }
  
  const keys = ['thumbURL', 'logoURL', 'keyartURL'];
  for (const key of keys) {
    if (!movie[key]) continue;
    const filepath = movie[key].replace('file:///M:\\', '/mnt/m/');
    const filename = basename(filepath);
    try {
      fs.copyFileSync(filepath, path.join(bundleDir, 'local', filename), fs.constants.COPYFILE_EXCL);
    } catch(err) {
      if (err.code !== 'EEXIST') {
        throw err;
      }
    }
    movie[key] = './local/' + filename;
  }
  movie.videoFilepath = "http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4"
}

fs.writeFileSync(
  path.join(bundleDir, 'config.js'),
  'window.movieLibraryConfig = ' + JSON.stringify(config, null, 2)
);
