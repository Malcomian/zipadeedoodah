# Zipadeedoodah

A command line utility for archiving and recovering files. Features guided menus via [prompts](https://www.npmjs.com/package/prompts), glob pattern matching via [picomatch](https://www.npmjs.com/package/picomatch), loading and saving of configuration files, and some useful methods for extracting archived files.

This script mostly uses the [tar](https://www.npmjs.com/package/tar) package to read, write, and extract `.tgz` archives. It's meant to be a kind of project backup manager and recovery tool.

## Installation

The package can be installed globally.

```shell
npm install -g zipadeedoodah
```

## Usage

The utility can be invoked with the `npx` command. If no extra arguments are given, then the script will launch into a series of menus.

```shell
npx zipadeedoodah
```

A variety of arguments can be passed to the script:

```text
-h  display helpful information
-f  load a configuration file
-a  archive directory location
-o  output filename pattern
-i  one or more include patterns
-x  one or more exclude patterns
-t  timestamp format
-c  only prompt for comment
-p  full menu prompts
-m  launch menu prompts without overriding options
-s  save configuration to a file or overwrite a loaded file
```

### Default Options

The following represents the default configuration options in javascript object notation:

```json
{
  "output": "../<cwd>_<timestamp>",
  "include": [
    "**/*"
  ],
  "exclude": [],
  "archive_directory": "../",
  "timestamp_format": "yyyy-LL-dd_HH-mm-ss_ZZZ",
  "comment": false,
  "prompt": false
}
```

### Option Descriptions

**output:** `../<cwd>_<timestamp>` This basically means that the output archive will be saved in the parent directory. The `<cwd>` tag will be replaced with the "current working directory" name. There's another tag, `<version>`, which can place your project's version number, too. The `<timestamp>` tag will be replaced with a given timestamp pattern. Archives are saved as `.tgz` files, or "g-zipped tarballs" which has some decent compression and archives fairly quickly.

**include:** `["**/*"]` Multiple patterns can be accepted. By default, it uses the pattern `**/*` which means "everything in all directories" - which is actually different than a single star pattern `*` which would only get everything in the base directory. The script will not include files inside of folders recursively by default, so an appropriate globstar pattern is needed to archive files within subdirectories. The script uses [picomatch](https://www.npmjs.com/package/picomatch) for include and exclude patterns. For example, a pattern `**/*.png` would include any `.png` file in any folder.

**exclude:** `[]` There are no exclusion patterns by default, so this property starts as an empty array. The menus can help add filepaths and patterns to this array. To exclude a folder and everything within it, use a globstar pattern - for example, to exclude a project's `node_modules` folder, use the pattern `node_modules/**` or, to exclude all `node_modules` folders and their contents in the entire folder structure, use `**/node_modules/**`.

**archive_directory:** `../` This option is only used with the recovery method given in this script - the recovery script will look at this relative location for archives, which are presumed to be archives of the current project directory. By default, it is set to the parent directory, as represented by the pattern `../`. Changing this to a different directory like `../_archive/` can be useful for keeping other projects more organized. Note that this input needs to end with a slash and must represent an existing directory.

**timestamp_format:** `yyyy-LL-dd_HH-mm-ss_ZZZ` This is a custom format that uses standard [luxon tokens](https://moment.github.io/luxon/#/formatting?id=table-of-tokens) to construct a timestamp that gets inserted in the output filename.

**comment:** `false` If this property is set to `true`, the script will prompt for a comment and append it to the output filename.

**prompt:** `false` When set to `true`, the script will launch into the full menu prompts. By default, it will not launch these menus - but only if there are also other runtime arguments given.

## Examples

Make an archive in the parent directory that consists of all the files in the current folder except the following folders and their contents: `node_modules`, `dist`, and `.git`. Because this script often needs to use globstar patterns, make sure that any argument value that contains them is wrapped with quotes. Otherwise, node will actually pass a whole directory list into the argument.

```shell
npx zipadeedoodah -x "node_modules/**" -x "dist/**" -x ".git/**" -c
```

Given a valid configuration file `zip.json` in the current directory, create an archive according to its contents:

```shell
npx zipadeedoodah -f ./zip.json
```

Using the same file, also override the comment prompt option to ensure the script prompts for a comment:

```shell
npx zipadeedoodah -f ./zip.json -c
```

Instead of passing the `-p` argument to launch into the menu prompts, the `-m` argument can be passed to launch into the menus without changing any configuration options. This can be relevant for when you'd rather save or edit configuration files.

In addition, the `-s` flag can save a configuration out to a file directly instead of using the menus. This allows a configuration file to be defined and saved with a single command. Even an existing configuration file can be read and have some of its properties overwritten. If a file has already been loaded, then passing the `-s` flag will save it in the same place.

The following command loads a configuration file `./zip.json`, sets the comment flag to true, then saves it in the same location.

```shell
npx zipadeedoodah -f ./zip.json -c -s
```

## Recover

The script will look in a directory specified in the `archive_directory` property and display a list of any `.tgz` archive files within it. Selecting one will open another menu with a variety of available methods. In general, the "Extract" methods will only extract files from the archive into the current directory. The "Restore" methods will try to mirror the file and folder structure within the archive by deleting project files in the current directory that don't exist in similar locations within the archive. The "Newer" methods will only copy newer files from the archive and the "Some" methods offer a multiline autocomplete selection prompt for selecting only "some" files and folders to extract or restore.

Loaded configuration settings are still relevant when using the "Restore" methods. Exclusion patterns will still be applied - this prevents files and folders that were (presumably) ignored when creating the archive from being deleted in the project as the script restores the file structure from the archive.

**Extract:** Copies files from the archive into the current directory. Similar files will be overwritten in the current directory.

**Extract Newer:** Extracts all newer files into the current project directory. Can be useful when migrating a project from one machine to another or for recovering deleted files without damaging newer files.

**Extract Some:** A multiline autocomplete selection prompt to help select some files to extract.

**Extract Some Newer:** A multiline autocomplete selection prompt to extract only newer files.

**Restore:** Extracts all files in the archive into the current directory, but also deletes any files within the current directory that do not exist within the archive. Useful for "restoring" a project completely. Extracted files will overwrite similar files in the current directory.

**Restore Newer:** Extracts all newer files and also deletes project files not present in the archive.

**Restore Some:** A multiline autocomplete selection prompt to extract files and also delete project files not present in the archive - but only if a directory was selected for extraction. So, if any folder is selected for extraction, then all the files within that folder inside the archive will be extracted and any files within the project folder that do not exist within the archived folder will be deleted.

**Restore Some Newer:** A multiline autocomplete selection prompt to extract only newer files and also delete project files not present in similar paths within the archive.

**Delete:** deletes the selected archive.
