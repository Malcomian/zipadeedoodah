# Zipadeedoodah

A simple CLI zip utility based on glob patterns with minimal setup.

This package can be installed globally and invoked with `zipadeedoodah` and requires a couple command line arguments.

```bash
npm install -g zipadeedoodah
```

This utility uses [Archiver](https://www.npmjs.com/package/archiver) with mostly just the basic options checked. It relies on just a few variadic user inputs based on glob patterns to include or ignore files and folders for the archive.

## Usage

```text
  -V, --version               output the version number
  -o, --output <output>       Relative path of output file (no ext)
  -g, --globs <globs...>      Glob patterns
  -i, --ignores [ignores...]  Ignore patterns
  -d, --dot                   Include dotfiles
  -l, --level [number]        Compression level (0-9)
  -c, --comment [comment]     Comment (skips prompt)
  -h, --help                  display help for command
```

A couple of replacement keywords are available for the filename output. `<cwd>`, which represents the name of the current working directory that the command was run in, and `<timestamp>`, which adds a timestamp in the format `yyyy-mm-dd_hour-min-sec`.

The user is also prompted for a comment for the archive, which will be added to the end of the archive name.

## Example

Create an archive alongside the current directory with all files and folders of the current directory with the name of the current working directory followed by a timestamp, which excludes the `node_modules` `.git` folders and `.gitignore` file, includes other dotfiles, and archives at the highest compression level.

```bash
zipadeedoodah -o "../<cwd>_<timestamp>" -g "*/**" "*.*" -d -i "node_modules" ".git/**" ".gitignore" -l 9
```
