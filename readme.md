# Zipadeedoodah

A CLI for zipping files based on glob patterns with optional prompts and arguments.

This package can be installed globally and invoked with `npx zipadeedoodah` and requires a couple command line arguments.

```bash
npm install -g zipadeedoodah
```

This utility uses [Archiver](https://www.npmjs.com/package/archiver) with mostly just the basic options checked. It relies on just a few variadic user inputs based on glob patterns to include or ignore files and folders for the archive.

If no arguments are passed to this script, a full set of [Inquirer](https://www.npmjs.com/package/inquirer) prompts will guide the user through the creation of the archive. But if the prompt flag is set and there's no comment specified, the script will prompt for a comment.

## Usage

```text
  -V, --version               output the version number
  -o, --output <output>       Relative path of output file (no ext)
  -c, --comment [comment]     Comment
  -p, --prompt                Prompt for comment
  -g, --globs <globs...>      Glob patterns
  -i, --ignores [ignores...]  Ignore patterns
  -d, --dot                   Include dotfiles
  -l, --level [number]        Compression level (0-9)
  -h, --help                  display help for command
```

A couple of replacement keywords are available for the filename output. `<cwd>`, which represents the name of the current working directory that the command was run in, and `<timestamp>`, which adds a timestamp in the format `yyyy-mm-dd_hour-min-sec`. If the user specifies or fills in a prompt for a comment, that comment will be added to the end of the archive name.

## Examples

The following example will create an archive alongside the current directory with all files and folders of the current directory with the name of the current working directory followed by a timestamp, which excludes the `node_modules` `.git` folders and `.gitignore` file, includes other dotfiles, archives at the highest compression level, and will prompt for a comment.

```bash
npx zipadeedoodah -o "../<cwd>_<timestamp>" -g "*/**" "*.*" -d -i "node_modules/**" ".git/**" -l 9 -p
```

The above example is almost identical to the default options given in the full prompts. To trigger the full set of prompts, run the following command.

```bash
npx zipadeedoodah
```

The prompts will then appear - but it is important to note that the glob patterns and ignore patterns require each of their respective patterns to be encapsulated inside double quotes. For example, this is the default glob patterns prompt input `"*/**" "*.*"` and this is the default ignore patterns prompt input `"node_modules/**" ".git/**"`.
