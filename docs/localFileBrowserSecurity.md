ASS subtitle rendering is done via [SubtitlesOctopus](https://github.com/libass/JavascriptSubtitlesOctopus). SubtitlesOctopus fetches various files "over the network". Namely, the WebWorker `subtitles-octopus-worker.js` which then fetches the WASM binary `subtitles-octopus-worker.wasm` and the fonts.

There are several security context restrictions in play that make serving assets from `file://` difficult:
1. Cross-origin requets require CORS headers.
2. The origin of `file://` is always unique. Meaning a request from any `file://` to `file://` is always concidered cross-origin and blocked.
3. While Web Workers *should* be able to be loaded cross-origin with CORS, they can't? https://stackoverflow.com/a/25495206/2544290

The `--allow-file-access-from-files` flag should fix #2 by treating `file://` origin as not unique. This means all `file://` requests should have the same origin and CORS is not required. However, it does not work for requests made from Web Workers for some reason.

Instead, the `--disable-web-security` flag fixes #1 by not enforcing any cross-origin restrictions. However, **the `--user-data-dir=` flag must also be set!** Otherwise, this flag is ignored.

Important to note: **CLI flags are ignored if an existing process tree is used**. For Chrome/Edge, it seems flags are only applied on the first execution. If the process is started under an existing process tree - which normally occurs if Chrome/Edge is already running in the background - the flags are ignored. However, process trees are unique for each user data directory. Therefore, specifying the `--user-data-dir=` flag with a unique value will force a new process tree to be created and your flags to be applied despite any instances that may already be running (assuming the specified user data directory is distinct from the ones used by the running instances).

You can use `chrome://version/` or `edge://version/` to see the flags that are being used.

Putting it all together we get (PowerShell):
```powershell
& "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --disable-web-security --user-data-dir="$($env:LOCALAPPDATA)\Microsoft\Edge\Movie Library User Data" "file://M:/Movie Library/movieLibrary.html"
```
