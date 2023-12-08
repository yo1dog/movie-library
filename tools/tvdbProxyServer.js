void (async () => {
  const authToken = await getAuthToken();
  const server = require('http').createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Expose-Headers', '*');
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Methods', '*');
      res.setHeader('Access-Control-Allow-Headers', '*');
      res.setHeader('Allow', 'GET,POST');
      res.writeHead(200);
      res.end('GET,POST');
      return;
    }
    
    const url = new URL(req.url, `http://${req.headers.host}`);
    const seriesID = url.searchParams.get('seriesID');
    if (!seriesID) {
      res
      .writeHead(400, {'Content-Type': 'application/json'})
      .end(JSON.stringify({error: ['id missing']}));
      return;
    }
    
    getEpisodesData(authToken, seriesID)
    .then(episodes => {
      res.writeHead(200, {'Content-Type': 'application/json'});
      res.end(JSON.stringify({episodes}));
    })
    .catch(err => {
      res.writeHead(500, {'Content-Type': 'application/json'});
      res.end(JSON.stringify({error: err.stack.split('\n')}));
    });
  });
  
  const hostname = '127.0.0.1';
  const port = 8001;
  server.listen(port, hostname, () => {
    console.log(`Server listening on http://${hostname}:${port}`);
  });
})();

async function makeRequest(path, {body, authToken}) {
  return new Promise((resolve, reject) => {
    const postData = body? Buffer.from(JSON.stringify(body), 'utf8') : undefined;
    const req = require('https').request(new URL(path, `https://api.thetvdb.com`), {
      method: postData? 'POST' : 'GET',
      headers: {
        ...(authToken? {
          authorization: `Bearer ${authToken}`
        } : {}),
        ...(postData? {
        'Content-Type': 'application/json',
        'Content-Length': postData.byteLength,
        } : {})
      }
    }, (res) => {
      let resBodyStr = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        resBodyStr += chunk;
      });
      res.on('end', () => {
        if (res.statusCode !== 200) return reject(new Error(`Non-200 response code: ${res.statusCode}\n${resBodyStr}`));
        return resolve(JSON.parse(resBodyStr));
      });
    });
    if (postData) req.write(postData);
    req.end();
  });
}

async function getAuthToken() {
  const resBody = await makeRequest('/login', {body: {apiKey: 'A7613F5C1482A540'}});
  const authToken = resBody.token;
  if (!authToken) throw new Error(`Token missing from response body:\n${JSON.stringify(resBody, null, 2)}`);
  return authToken;
}

async function getEpisodesData(authToken, seriesID) {
  let pageNum = 1;
  let episodes = [];
  while (pageNum) {
    const resBody = await makeRequest(`/series/${seriesID}/episodes?page=${pageNum}`, {authToken});
    episodes = episodes.concat(resBody.data);
    pageNum = resBody.links.next;
  }
  return episodes;
}
