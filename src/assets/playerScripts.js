'use strict';
function load() {
  
/**
 * @param {string} selectors
 * @param {ParentNode} [parent]
 */
function requireElem(selectors, parent) {
  const elem = (parent || document).querySelector(selectors);
  if (!elem) throw new Error(`Unable to find element: ${selectors}`);
  return /** @type {HTMLElement} */(elem);
}

const rootDirInputElem = /** @type {HTMLInputElement} */(requireElem('#rootDirInput'));
const generateButtonElem = requireElem('#generateButton');
const downloadFilepathElem = requireElem('#downloadFilepath');
const regDownloadLinkElem = /** @type {HTMLAnchorElement} */(requireElem('#regDownloadLink'));
const vbsDownloadLinkElem = /** @type {HTMLAnchorElement} */(requireElem('#vbsDownloadLink'));
const ps1DownloadLinkElem = /** @type {HTMLAnchorElement} */(requireElem('#ps1DownloadLink'));
const testInputElem = /** @type {HTMLInputElement} */(requireElem('#testInput'));
const testButtonElem = requireElem('#testButton');

populateDownloadLinks();
generateButtonElem.addEventListener('click', () => {
  populateDownloadLinks();
  const rootDir = rootDirInputElem.value.replace(/[/\\]+$/, ''); // Trim trailing path separator.
  if (!rootDir) return;
  populateDownloadLinks(rootDir);
});

testButtonElem.addEventListener('click', () => {
  const filepath = testInputElem.value;
  if (!filepath) return;
  window.open('movielib.player://' + filepath, '_self');
});

/** @param {string} [rootDir] */
function populateDownloadLinks(rootDir) {
  if (rootDir) {
    const regStr = generateREG(rootDir);
    const vbsStr = generateVBS(rootDir);
    const ps1Str = generatePS1(rootDir);
    
    downloadFilepathElem.innerText = rootDir + '\\';
    regDownloadLinkElem.href = URL.createObjectURL(new Blob([regStr], {type: 'text/plain'}));
    vbsDownloadLinkElem.href = URL.createObjectURL(new Blob([vbsStr], {type: 'text/plain'}));
    ps1DownloadLinkElem.href = URL.createObjectURL(new Blob([ps1Str], {type: 'text/plain'}));
  }
  else {
    downloadFilepathElem.innerText = '...';
    regDownloadLinkElem.href = `javascript:alert('You must generate the scripts first.')`;
    vbsDownloadLinkElem.href = `javascript:alert('You must generate the scripts first.')`;
    ps1DownloadLinkElem.href = `javascript:alert('You must generate the scripts first.')`;
  }
}

/** @param {string} rootDir */
function generateREG(rootDir) {
  return (
`Windows Registry Editor Version 5.00

[HKEY_CLASSES_ROOT\\movielib.player]
@="URL:VLC Silent"
"URL Protocol"=""

[HKEY_CLASSES_ROOT\\movielib.player\\shell\\open\\command]
@="C:\\\\Windows\\\\System32\\\\wscript.exe \\"${rootDir.replace(/\\/g, '\\\\')}\\\\movielib.player.vbs\\" \\"%1\\""
`
);}

/** @param {string} rootDir */
function generateVBS(rootDir) {
  return (
`CreateObject("Wscript.Shell").Run """C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe"" -File ""${rootDir}\\movielib.player.ps1"" """ & WScript.Arguments(0) & """", 0
`
);}

/** @param {string} rootDir */
function generatePS1(rootDir) {
  return (
`Add-Type -AssemblyName System.Web
$filepath = [System.Web.HttpUtility]::UrlDecode($args[0]) -replace '^movielib\\.player://|/$',''
& "C:\\Program Files (x86)\\VideoLAN\\VLC\\vlc.exe" --fullscreen --video-on-top --no-video-title-show --play-and-exit --one-instance $filepath
`
);}

} window.addEventListener('DOMContentLoaded', () => load());