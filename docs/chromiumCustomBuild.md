NOTE: A premade chromium build with AC3 and other extended codec support can be downloaded from:
https://github.com/StaZhu/enable-chromium-hevc-hardware-decoding/releases


# Setup

Start with but stop before `fetch chromium`:
https://chromium.googlesource.com/chromium/src/+/main/docs/windows_build_instructions.md

Make sure to use the `--no-history` with `fetch chromium` and stop following after this and continue bellow.

# Get latest stable source

Based on:
https://www.chromium.org/developers/how-tos/get-the-code/working-with-release-branches/

Fetch the latest branch. Replace `BRANCH` with the branch given on the site bellow (click the (i) icon next to the build number in the table that matches the build number in the green "Stable" header.) This is a lot faster than fetching the whole repo.
https://chromiumdash.appspot.com/releases?platform=Android

```
git fetch https://chromium.googlesource.com/chromium/src.git +refs/branch-heads/BRANCH --depth 1
```

Then run sync to update and match submodules:
```
gclient sync --with_branch_heads --with_tags
```

# Apply source patch

```
git apply chromium.patch
```

# Create build

Replace `VERSION` with a new version number to avoid colbering things. Good canidate is the Chromium milestone you are building from.
```
gn gen out\MovieLibraryVERSION
```

Copy build args and apply them.
```
copy args.gn out\MovieLibraryVERSION\
gn args out\MovieLibraryVERSION
```

# Build

```
autoninja -C out\MovieLibraryVERSION chrome
```
