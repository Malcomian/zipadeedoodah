#!/usr/bin/env node

const color = require('kleur')
const project = require('./package.json')
const prompts = require('prompts')
const yargs = require('yargs-parser')
const fs = require('fs')
const path = require('path')
const { DateTime, Duration } = require('luxon')
const bytes = require('bytes')
const tar = require('tar')
const _ = require('lodash')
const match = require('picomatch').isMatch

// whether to launch into the menus directly
var menu = false

// a reusable variable for measuring durations of some functions
var beginning = 0

// location of a loaded configuration file
var configuration_file = ''

// for relative (./) file autocomplete
var relative_search_files = []
var relative_filtered_files = []

// for local file autocomplete
var local_search_files = []
var local_filtered_files = []

// default options class
class Options {
  constructor() {
    this.output = '../<cwd>_<timestamp>'
    this.include = ['**/*']
    this.exclude = []
    this.archive_directory = '../'
    this.timestamp_format = 'yyyy-LL-dd_HH-mm-ss_ZZZ'
    this.comment = false
    this.prompt = false
  }
}

// options object
var options = new Options()

// get arguments
var args = yargs(process.argv)

// either launch the menus or run the archiver
autorun()

// Function Definitions

function autorun() {
  // parse arguments
  parse_args()
  // run prompts menus if either the prompt or menu flags were explicitly set
  if (options.prompt === true || menu === true) {
    console.clear()
    welcome()
    return main('')
  }
  // run prompts menus if there are no extra given arguments
  let keys = Object.keys(args)
  // the positional "_" key is always present
  if (keys.length < 2) {
    console.clear()
    welcome()
    return main('')
  }
  // otherwise, run the archiver
  archive()
}

function parse_args() {
  if ('h' in args) {
    console.clear()
    welcome()
    let lines = help()
    lines.forEach(line => {
      console.log(line)
    })
    process.exit()
  }

  if ('m' in args) {
    menu = true
  }

  if ('f' in args) {
    // get options from file
    let location = path.resolve(args['f'])
    options = JSON.parse(fs.readFileSync(location).toString())
    configuration_file = location
  }

  if ('x' in args) {
    // override exclusion patterns
    if (type_of(args['x']) === 'array') {
      options.exclude = args['x']
    } else {
      options.exclude = []
      options.exclude.push(args['x'])
    }
  }

  if ('i' in args) {
    // override inclusion patterns
    if (type_of(args['i']) === 'array') {
      options.include = args['i']
    } else {
      options.include = []
      options.include.push(args['i'])
    }
  }

  if ('t' in args) {
    // override timestamp options
    options.timestamp_format = args['t']
  }

  if ('o' in args) {
    // override output filename
    options.output = args['o']
  }

  if ('a' in args) {
    // override archive directory
    options.archive_directory = args['a']
  }

  if ('c' in args) {
    // override comment prompt
    options.comment = true
  }

  if ('p' in args) {
    // override menu prompt
    options.prompt = true
  }

  // save a file directly
  if ('s' in args) {
    if (args['s'] === true) {
      if (configuration_file !== '') save('')
    } else {
      configuration_file = path.resolve(args['s'])
      save('')
    }
    process.exit()
  }
}

// Main Menu Functions

/**
 * main menu
 * @param {string} message clears the console if undefined
 */
async function main(message) {
  if (message !== '') console.clear()
  let choices = [
    menu_item('Make Archive', 'Make a new archive'),
    menu_item('Configuration', 'Edit, load, or save configuration options'),
    menu_item('Recover', 'Recover files from archive'),
    menu_item('About', 'About this script'),
    menu_item('Exit', 'Exit script'),
  ]

  let response = await prompts({
    type: 'autocomplete',
    name: 'answer',
    message: 'Main Menu:',
    choices,
    suggest: fuzzy
  })
  let { answer } = response
  switch (answer) {
    case 'Make Archive':
      return archive()
      break;
    case 'Configuration':
      return menu_configuration()
      break;
    case 'Recover':
      return menu_recover_select()
      break;
    case 'About':
      return menu_about()
      break;
    case 'Exit':
    default:
      console.clear()
      process.exit()
      break;
  }
}

async function archive() {
  let filename = ''
  if (options.comment) {
    // if a comment prompt is given...
    let response = await prompts({
      type: 'text',
      message: 'Comment:',
      name: 'comment'
    })
    let { comment } = response
    if (comment !== '') comment = ` - ${comment}`
    filename = `${parse_filename(options.output)}${comment}.tgz`
  } else {
    // if no comment prompt...
    filename = `${parse_filename(options.output)}.tgz`
  }

  // start timer
  beginning = process.hrtime()

  let base = `${path.resolve('.')}${path.sep}`

  let files = get_all_files(base).map(file => {
    // get rid of base filenames
    let name = file.split(base)[1]
    return name
  }).filter(file => {
    // inclusions
    let include = false
    options.include.forEach(item => {
      if (include) return
      if (match(file, item, { dot: true }) === true) include = true
    })
    // exclusions
    let exclude = false
    options.exclude.forEach(item => {
      if (exclude) return
      if (match(file, item, { dot: true }) === true) exclude = true
    })
    if (include && !exclude) return true
    return false
  }).map(file => {
    // prepend names that start with @ with a "./" (a requirement for tar to work for those names)
    if (file.startsWith('@')) file = `./${file}`
    return file
  })

  // run the archive creator
  await tar.c({
    file: filename,
    z: true,
    noDirRecurse: true
  }, files)

  // display some information
  let elapsed = since(beginning)
  let s = 'y'
  if (files.length > 1) s = 'ies'
  console.log(`...added ${color.cyan(files.length)} entr${s} to archive`)
  console.log(`...wrote ${color.yellow(filename)}`)
  let size = fs.lstatSync(path.resolve(`${filename}`)).size
  console.log(`Size: ${color.yellow(bytes(size))}`)
  console.log(`Finished in ${color.cyan(elapsed.s)}s ${color.cyan(elapsed.ms)}ms!`)
}

async function menu_configuration() {
  console.clear()
  if (configuration_file !== '') console.log(`loaded ${color.yellow(configuration_file)}:`)
  let choices = [
    menu_item('...', 'Go back'),
    menu_item('view', 'view current configuration as JSON'),
    menu_item('load', 'load configuration file'),
    menu_item('save', 'save configuration file'),
    menu_item('save as', 'save configuration in new file'),
    menu_item('output', 'output filename (string)'),
    menu_item('include', 'include patterns (array)'),
    menu_item('exclude', 'exclude patterns (array)'),
    menu_item('archive directory', 'change archive directory (string)'),
    menu_item('timestamp format', 'luxon timestamp format (string)'),
    menu_item('comment', 'prompt for comment (boolean)'),
    menu_item('prompt', 'open these prompt menus (boolean)'),
  ]
  let response = await prompts({
    type: 'autocomplete',
    name: 'answer',
    message: 'Configuration Menu',
    choices,
    suggest: fuzzy
  })
  let { answer } = response
  switch (answer) {
    case '...':
      return main()
      break;
    case 'view':
      return menu_configuration_view()
      break;
    case 'load':
      return menu_configuration_load()
      break;
    case 'save':
      if (configuration_file === '') return save_as()
      return save()
      break;
    case 'save as':
      return save_as()
      break;
    case 'output':
      return menu_configuration_edit('output')
      break;
    case 'include':
      return menu_configuration_edit('include')
      break;
    case 'exclude':
      return menu_configuration_edit('exclude')
      break;
    case 'archive directory':
      return menu_configuration_edit('archive_directory')
      break;
    case 'timestamp format':
      return menu_configuration_edit('timestamp_format')
      break;
    case 'comment':
      return menu_configuration_edit('comment')
      break;
    case 'prompt':
      return menu_configuration_edit('prompt')
      break;
    default:
      break;
  }
}

async function menu_configuration_view() {
  console.clear()
  let contents = JSON.stringify(options, null, 2)
  console.log(contents)
  let response = await prompts({
    type: 'confirm',
    name: 'answer',
    message: '...continue?...',
    initial: true
  })
  return menu_configuration()
}

async function menu_configuration_load() {
  console.clear()
  reload_relative_search_files()
  let response = await prompts({
    type: 'autocomplete',
    name: 'answer',
    message: 'Load Configuration File',
    choices: relative_filtered_files,
    suggest: autocomplete_relative_files
  })
  let { answer } = response
  if (!answer.endsWith('.json')) {
    console.log(`Cannot parse ${color.yellow(answer)}`)
    return main('')
  }
  // set some temporary variables to check keys on target json file
  let temp_configuration_file = path.resolve(answer)
  let temp = JSON.parse(fs.readFileSync(temp_configuration_file))
  let temp_keys = JSON.stringify(Object.keys(temp))
  let keys = JSON.stringify(Object.keys(options))
  if (keys !== temp_keys) {
    console.log(`Incorrect configuraiton options format ${color.yellow(answer)}`)
    return main('')
  }
  configuration_file = temp_configuration_file
  options = temp
  console.log(`Loaded configuration options file ${color.yellow(answer)}`)
  return main('')
}

/**
 * not really a menu - switches between menus for different data types
 * @param {string} key key of configuration options object
 */
async function menu_configuration_edit(key) {
  let type = type_of(options[key])
  switch (type) {
    case 'array':
      return menu_edit_list(key)
      break;
    case 'string':
      return edit_string(key)
      break;
    case 'boolean':
      return edit_boolean(key)
      break;
    default:
      break;
  }
}

async function edit_string(key) {
  console.clear()
  let response = await prompts({
    type: 'text',
    name: 'answer',
    message: `${key} (string):`,
    initial: options[key]
  })
  let { answer } = response
  options[key] = answer
  return menu_configuration()
}

async function edit_boolean(key) {
  console.clear()
  let response = await prompts({
    type: 'toggle',
    name: 'answer',
    message: `${key} (boolean):`,
    initial: options[key],
    active: 'true',
    inactive: 'false'
  })
  let { answer } = response
  options[key] = answer
  return menu_configuration()
}

/**
 * menu for editing an array of values
 * @param {string} key key of configuration options object
 */
async function menu_edit_list(key) {
  console.clear()
  let choices = [
    menu_item('...', 'Go back'),
    menu_item('View', 'view list'),
    menu_item('Add', 'add item'),
    menu_item('Change', 'change item'),
    menu_item('Remove', 'remove item'),
    menu_item('Replace', 'replace entire list'),
    menu_item('Clear', 'clears list'),
  ]
  let response = await prompts({
    type: 'autocomplete',
    name: 'answer',
    message: `${key}:`,
    choices
  })
  let { answer } = response
  switch (answer) {
    case '...':
      return menu_configuration()
      break;
    case 'View':
      return menu_edit_list_view(key)
      break;
    case 'Add':
      return menu_edit_list_add(key)
      break;
    case 'Change':
      return menu_edit_list_change(key)
      break;
    case 'Remove':
      return menu_edit_list_remove(key)
      break;
    case 'Replace':
      return menu_edit_list_replace(key)
      break;
    case 'Clear':
      options[key] = []
      return menu_edit_list(key)
      break;
    default:
      break;
  }
}

async function menu_edit_list_change(key) {
  console.clear()
  let choices = [
    menu_item('...', 'Go back'),
    ...options[key].map(item => {
      return menu_item(item, `(${type_of(item)})`)
    })
  ]
  let response = await prompts({
    type: 'autocomplete',
    name: 'answer',
    message: `${key} (change):`,
    choices
  })
  let { answer } = response
  if (answer === '...') return menu_edit_list(key)
  let index = options[key].indexOf(answer)
  return menu_edit_list_change_item(key, index)
}

async function menu_edit_list_change_item(key, index) {
  console.clear()
  let response = await prompts({
    type: 'text',
    name: 'answer',
    message: `${key} (change):`,
    initial: options[key][index]
  })
  let { answer } = response
  options[key][index] = answer
  return menu_edit_list(key)
}

async function menu_edit_list_replace(key) {
  console.clear()
  let response = await prompts({
    type: 'list',
    name: 'answer',
    message: 'Enter a comma-separated string:',
    separator: ','
  })
  let { answer } = response
  // reset array
  options[key] = []
  answer.forEach(item => {
    // ignore blanks
    if (item === '') return
    // push result
    options[key].push(item)
  })
  return menu_edit_list(key)
}

async function menu_edit_list_remove(key) {
  console.clear()
  let choices = [
    menu_item('...', 'Go back'),
    ...options[key].map(item => {
      return menu_item(item, `(${type_of(item)})`)
    })
  ]
  let response = await prompts({
    type: 'autocomplete',
    name: 'answer',
    message: `${key} (remove):`,
    choices
  })
  let { answer } = response
  if (answer === '...') return menu_edit_list(key)
  let index = options[key].indexOf(answer)
  options[key].splice(index, 1)
  return menu_edit_list(key)
}

async function menu_edit_list_add(key) {
  console.clear()
  let choices = [
    menu_item('...', 'Go back'),
    menu_item('path', 'existing file path name'),
    menu_item('list', 'append a comma-separated list'),
    menu_item('string', 'any string'),
    menu_item('number', 'any number'),
    menu_item('boolean', 'true or false'),
  ]
  let response = await prompts({
    type: 'autocomplete',
    name: 'answer',
    message: `${key} (add):`,
    choices
  })
  let { answer } = response
  switch (answer) {
    case '...':
      return menu_edit_list(key)
      break;
    case 'path':
      return menu_edit_list_add_filepath(key)
      break;
    case 'list':
      return menu_edit_list_add_list(key)
      break;
    case 'string':
      return menu_edit_list_add_string(key)
      break;
    default:
      break;
  }
}

async function menu_edit_list_add_list(key) {
  console.clear()
  let response = await prompts({
    type: 'list',
    name: 'answer',
    message: 'Enter a comma-separated string:',
    separator: ','
  })
  let { answer } = response
  answer.forEach(item => {
    // ignore blanks
    if (item === '') return
    // don't add duplicates
    if (options[key].includes(item)) return
    // push result
    options[key].push(item)
  })
  return menu_edit_list(key)
}

async function menu_edit_list_add_string(key) {
  console.clear()
  let response = await prompts({
    type: 'text',
    name: 'answer',
    message: `${key} (string):`,
    validate(value) {
      if (value.length < 1) return 'Please enter a string!'
      return true
    }
  })
  let { answer } = response
  options[key].push(answer)
  menu_edit_list(key)
}

async function menu_edit_list_view(key) {
  console.clear()
  let choices = [
    menu_item('...', 'Go back'),
    ...options[key].map(item => {
      return menu_item(item, `(${type_of(item)})`)
    })
  ]
  let response = await prompts({
    type: 'select',
    name: 'answer',
    message: `${key} (view):`,
    choices
  })
  return menu_edit_list(key)
}

async function menu_edit_list_add_filepath(key) {
  console.clear()
  reload_local_search_files()
  let response = await prompts({
    type: 'autocomplete',
    name: 'answer',
    message: `${key} (path):`,
    choices: local_filtered_files,
    suggest: autocomplete_local_files
  })
  let { answer } = response
  if (answer === '...') return menu_edit_list(key)
  options[key].push(answer)
  menu_edit_list(key)
}

async function menu_about() {
  console.clear()
  welcome()
  let lines = help()
  let choices = []
  lines.forEach(line => {
    if (line === '') line = ' '
    choices.push(menu_item(line, ''))
  })

  let response = await prompts({
    type: 'select',
    name: 'answer',
    message: '...continue?...',
    choices
  })
  return main()
}

function save(exit) {
  let contents = JSON.stringify(options, null, 2)
  fs.writeFileSync(configuration_file, contents)
  console.log(`wrote ${color.yellow(configuration_file)}`)
  if (exit === undefined) return main('')
}

async function save_as() {
  console.clear()
  let response = await prompts({
    type: 'text',
    name: 'answer',
    message: 'Save Configuraiton File'
  })
  let { answer } = response
  configuration_file = path.resolve(answer)
  return save()
}

// Recovery Functions

async function menu_recover_select() {
  console.clear()
  let now = Date.now()
  let choices = []
  fs.readdirSync(path.resolve(options.archive_directory), { withFileTypes: true }).forEach(item => {
    let result = {}
    result.title = `../${item.name}`
    result.value = result.title
    if (!item.isFile()) return
    if (!item.name.endsWith('.tgz')) return
    let stats = fs.lstatSync(path.resolve(`${options.archive_directory}${item.name}`))
    let then = stats.birthtimeMs
    let elapsed = Duration.fromMillis(Math.floor((now - then) / 1000) * 1000).rescale().toHuman({ listStyle: 'narrow', unitDisplay: 'narrow' }) + ' ago'
    result.description = elapsed
    choices.push(result)
  })
  choices.reverse()
  choices.unshift(menu_item('...', 'Go back'))
  let response = await prompts({
    type: 'autocomplete',
    name: 'answer',
    message: 'Select file',
    choices,
    suggest: fuzzy
  })
  let { answer } = response
  switch (answer) {
    case '...':
      return main()
      break;
    default:
      return menu_recover(answer)
      break;
  }
}

/**
 * archive menu
 * @param {string} location file location
 */
async function menu_recover(location) {
  console.clear()
  let choices = [
    menu_item('...', 'Go back'),
    menu_item('Extract', 'extracts all files from archive'),
    menu_item('Extract Newer', 'extracts only newer files from archive'),
    menu_item('Extract Some', 'a multiline selection to extract files'),
    menu_item('Extract Some Newer', 'a multiline selection to extract only newer files'),
    menu_item('Restore', 'extracts all files and deletes project files not present in archive'),
    menu_item('Restore Newer', 'extracts all newer files but also deletes project files not present in archive'),
    menu_item('Restore Some', 'a multiline selection to extract files and also delete project files not present in selected archived directories'),
    menu_item('Restore Some Newer', 'a multiline selection to extract some newer files and also delete project files not present in selected archived directories'),
    menu_item('Delete', 'delete the selected archive'),
  ]
  let response = await prompts({
    type: 'autocomplete',
    name: 'answer',
    message: `${location}`,
    choices,
    suggest: fuzzy
  })
  let { answer } = response
  switch (answer) {
    case '...':
      return main()
      break;
    case 'Extract':
      beginning = process.hrtime()
      return extract_archive(location, false)
      break;
    case 'Extract Newer':
      beginning = process.hrtime()
      return extract_archive(location, true)
      break;
    case 'Extract Some':
      return extract_some(location, false)
      break;
    case 'Extract Some Newer':
      return extract_some(location, true)
      break;
    case 'Restore':
      beginning = process.hrtime()
      return restore_archive(location, false)
      break;
    case 'Restore Newer':
      beginning = process.hrtime()
      return restore_archive(location, true)
      break;
    case 'Restore Some':
      return restore_some(location, false)
      break;
    case 'Restore Some Newer':
      return restore_some(location, true)
      break;
    case 'Delete':
      fs.unlinkSync(path.resolve(location))
      console.log(`deleted ${location}`)
      return main()
      break;
    default:
      break;
  }
}

/**
 * extracts an archive into the current working directory
 * @param {string} file archive filepath
 * @param {boolean} newer whether to copy over newer files
 */
async function extract_archive(file, newer) {
  await tar.x({
    file,
    newer
  })
  let elapsed = since(beginning)
  console.log(`finished in ${color.cyan(elapsed.s)}s ${color.cyan(elapsed.ms)}ms`)
}

/**
 * extracts individual files from an archive
 * @param {string} file archive filepath
 * @param {boolean} newer whether to copy over newer files
 */
async function extract_some(file, newer) {
  console.clear()
  let mode = ''
  if (newer) mode = 'newer'
  // read from archive...
  let files = []
  await tar.t({
    file,
    onentry(entry) {
      files.push(entry.path)
    }
  })
  let choices = files.map(item => {
    return menu_item(item)
  })
  let response = await prompts({
    type: 'autocompleteMultiselect',
    name: 'answer',
    message: `Extract ${mode} files:`,
    choices,
    suggest: fuzzy
  })

  let beginning = process.hrtime()

  let { answer } = response

  // return if nothing was selected
  if (type_of(answer) === 'undefined') {
    console.log(`no files selected`)
    return menu_recover(file)
  }

  await tar.x({
    file,
    newer
  }, answer)

  let elapsed = since(beginning)
  console.log(`finished in ${color.cyan(elapsed.s)}s ${color.cyan(elapsed.ms)}ms`)
}

/**
 * removes project files not present in an archive and then extracts the archive
 * @param {string} file archive filepath
 * @param {boolean} newer whether to copy over newer files
 */
async function restore_archive(file, newer) {
  let archived = []
  await tar.t({
    file,
    onentry(entry) {
      archived.push(entry.path)
    }
  })

  let base = `${path.resolve('.')}${path.sep}`

  // get a list of project files
  let files = get_all_files(base).map(file => {
    return file.split(base)[1]
  }).map(file => {
    if (file.startsWith('@')) return `./${file}`
    return file
  }).filter(file => {
    // filter based on exclusion patterns
    let exclude = false
    options.exclude.forEach(item => {
      if (exclude) return
      if (match(file, item, { dot: true }) === true) exclude = true
    })
    return !exclude
  })
  // change path separator if on windows
  if (path.sep === '\\') files = files.map(file => {
    if (file.includes('\\')) return file.split('\\').join('/')
    return file
  })

  // find the difference and reverse it because it's easier to delete files in reverse order
  let diff = _.difference(files, archived).reverse()

  let s = ''
  if (diff > 1) s = 's'
  console.log(`Removing ${color.cyan(diff.length)} project file${s} not found in archive...`)

  diff.forEach(file => {
    let filepath = ''
    // sometimes files can start with "./"
    if (file.startsWith('./')) {
      filepath = path.resolve(file)
    } else {
      filepath = path.resolve(`./${file}`)
    }
    if (!fs.existsSync(filepath)) return
    let stats = fs.lstatSync(filepath)
    if (stats.isDirectory()) {
      fs.rmdirSync(filepath)
    } else {
      fs.rmSync(filepath)
    }
  })

  // also extract the project files
  extract_archive(file, newer)
}

/**
 * removes project files not present in an archive and then extracts the archive
 * @param {string} file archive filepath
 * @param {boolean} newer whether to copy over newer files
 */
async function restore_some(file, newer) {
  console.clear()
  let mode = ''
  if (newer) mode = 'newer'
  let archived = []
  await tar.t({
    file,
    onentry(entry) {
      archived.push(entry.path)
    }
  })
  let choices = archived.map(item => {
    return menu_item(item)
  })
  let response = await prompts({
    type: 'autocompleteMultiselect',
    name: 'answer',
    message: `Restore ${mode} files:`,
    choices,
    suggest: fuzzy
  })

  let beginning = process.hrtime()

  let { answer } = response

  if (type_of(answer) === 'undefined') {
    console.log(`no files selected`)
    return menu_recover(file)
  }

  let remove = []

  // delete files that aren't present in the archive
  answer.forEach(item => {
    let filename = item
    if (!item.startsWith('./')) filename = `./${filename}`
    let filepath = path.resolve(item)
    // if the path doesn't exist in the project, continue
    if (!fs.existsSync(filepath)) return
    let stats = fs.lstatSync(filepath)
    // continue if it's not a directory
    if (!stats.isDirectory()) return
    // try to find files within the directory that aren't in the archive
    let some_files = get_all_files(filename).map(some => {
      if (some.includes('\\')) return some.split('\\').join('/').split('./')[1]
      return some.split('./')[1]
    }).filter(some => {
      // filter based on exclusion patterns
      let exclude = false
      options.exclude.forEach(pattern => {
        if (exclude) return
        if (match(some, pattern, { dot: true }) === true) exclude = true
      })
      return !exclude
    }).reverse().filter(some => {
      return !archived.includes(some)
    })
    remove = [...remove, ...some_files]
  })

  // make sure all files are unique
  remove = _.uniq(remove)

  let s = ''
  if (remove > 1) s = 's'
  console.log(`Removing ${color.cyan(remove.length)} project file${s} not found in archive...`)

  // remove files and folders
  remove.forEach(item => {
    let filename = item
    if (!item.startsWith('./')) filename = `./${filename}`
    let filepath = path.resolve(item)
    if (fs.lstatSync(filepath).isDirectory()) {
      fs.rmdirSync(filepath)
    } else {
      fs.rmSync(filepath)
    }
  })

  await tar.x({
    file,
    newer
  }, answer)

  let elapsed = since(beginning)
  console.log(`finished in ${color.cyan(elapsed.s)}s ${color.cyan(elapsed.ms)}ms`)
}

// Autocomplete Functions

function reload_relative_search_files() {
  relative_search_files = []
  fs.readdirSync(path.resolve('.'), { withFileTypes: true }).forEach(item => {
    if (item.name === undefined) return
    let title = `./${item.name}`
    if (item.isFile()) {
      if (item.name.endsWith('.json')) return relative_search_files.push(menu_item(title, color.green('(json)')))
      return relative_search_files.push(menu_item(title, color.cyan('(file)')))
    }
    if (item.isDirectory()) relative_search_files.push(menu_item(title, color.yellow('(dir)')))
  })
  relative_filtered_files = [menu_item('...', 'Go back'), ...relative_search_files]
}

/**
 * @param {string} input
 * @param {[prompts.Choice]} choices
 * @returns {[prompts.Choice]}
 */
function autocomplete_relative_files(input, choices) {
  if (input.endsWith('/') || input === '.') {
    if (fs.existsSync(path.resolve(input))) {
      relative_search_files = []
      let files = fs.readdirSync(path.resolve(input), { withFileTypes: true })
      files.forEach(item => {
        let result = {}
        if (input === './' || input === '.') {
          result.title = `./${item.name}`
        } else {
          result.title = `${input}${item.name}`
        }
        result.value = result.title
        if (item.isFile()) {
          if (item.name.endsWith('.json')) {
            result.description = color.green('(json)')
          } else {
            result.description = color.cyan('(file)')
          }
        }
        if (item.isDirectory()) result.description = color.yellow('(dir)')
        relative_search_files.push(result)
      })
      relative_filtered_files = [...relative_search_files]
    }
  } else {
    // filter the files but non-destructively
    relative_filtered_files = relative_search_files.filter((item) => item.title.startsWith(input))
  }
  return [menu_item('...', 'Go back'), ...relative_filtered_files]
}

function reload_local_search_files() {
  local_search_files = []
  fs.readdirSync(path.resolve('.'), { withFileTypes: true }).forEach(item => {
    if (item.name === undefined) return
    let title = item.name
    if (item.isFile()) {
      if (item.name.endsWith('.json')) return local_search_files.push(menu_item(title, color.green('(json)')))
      return local_search_files.push(menu_item(title, color.cyan('(file)')))
    }
    if (item.isDirectory()) local_search_files.push(menu_item(title, color.yellow('(dir)')))
  })
  local_filtered_files = [menu_item('...', 'Go back'), ...local_search_files]
}

/**
 * @param {string} input
 * @param {[prompts.Choice]} choices
 * @returns {[prompts.Choice]}
 */
function autocomplete_local_files(input, choices) {
  if (input.endsWith('/') || input === '') {
    if (fs.existsSync(path.resolve(input))) {
      local_search_files = []
      let files = fs.readdirSync(path.resolve(input), { withFileTypes: true })
      files.forEach(item => {
        let result = {}
        if (input === '/' || input === '') {
          result.title = `${item.name}`
        } else {
          result.title = `${input}${item.name}`
        }
        result.value = result.title
        if (item.isFile()) {
          if (item.name.endsWith('.json')) {
            result.description = color.green('(json)')
          } else {
            result.description = color.cyan('(file)')
          }
        }
        if (item.isDirectory()) result.description = color.yellow('(dir)')
        local_search_files.push(result)
      })
      local_filtered_files = [...local_search_files]
    }
  } else {
    // filter the files but non-destructively
    local_filtered_files = local_search_files.filter((item) => item.title.startsWith(input))
  }
  return [menu_item('...', 'Go back'), ...local_filtered_files]
}

/**
 * fuzzy case insensitive match
 * @param {string} input
 * @param {[prompts.Choice]} choices
 * @returns {[prompts.Choice]}
 */
function fuzzy(input, choices) {
  if (!input) return choices
  return choices.filter(item => { return item.title.toLowerCase().includes(input.toLowerCase()) })
}

// Helper Functions

/**
 * 
 * @param {any} thing any variable to test
 * @returns {('bigint'|'boolean'|'function'|'number'|'object'|'string'|'symbol'|'undefined'|'array')}
 */
function type_of(thing) {
  if (Array.isArray(thing)) return 'array'
  return typeof thing
}

/**
 * create a prompt menu item for select-type prompts
 * @param {string} title also used as the value
 * @param {string} description optional description
 */
function menu_item(title, description) {
  let value = title
  if (description === undefined) return { title, value }
  return { title, value, description }
}

/**
 * inserts "cwd" and "timestamp" variables in a given filename
 * @param {string} name filename to parse
 */
function parse_filename(name) {
  let result = name
  if (result.includes('<cwd>')) result = result.split('<cwd>').join(cwd())
  if (result.includes('<version>')) result = result.split('<version>').join(project.version)
  if (result.includes('<timestamp>')) result = result.split('<timestamp>').join(get_time_string(Date.now()))
  return result
}

function cwd() {
  return path.parse(process.cwd()).name
}

/**
 * Parse a time string from a date number
 * - yyyy-LL-dd_HH-mm-ss ZZZZ ZZ
 * @param {number} time time, presumably from Date.now()
 * @returns {string}
 */
function get_time_string(time) {
  return DateTime.fromMillis(time).toFormat(options.timestamp_format)
}

/**
 * get all files and directories from a given directory
 * - directories end with a path separator
 * @param {string} dir starting directory (must end with a path separator)
 * @returns {[string]}
 */
function get_all_files(dir) {
  let files = []
  let filenames = fs.readdirSync(dir, { withFileTypes: true })
  filenames.forEach(file => {
    if (file.isDirectory()) {
      let dirname = `${dir}${file.name}${path.sep}`
      files.push(dirname)
      files = files.concat(get_all_files(dirname))
    } else {
      let filename = `${dir}${file.name}`
      files.push(filename)
    }
  })
  return files
}

/**
 * log accurate time
 * @param {number} beginning beginning hrtime
 */
function since(beginning) {
  let elapsed = process.hrtime(beginning)
  let s = elapsed[0]
  let ms = (elapsed[1] / 1000000).toFixed(3)
  return { s, ms }
}

function welcome() {
  console.log('  ____  _              __           __             __     __ ')
  console.log(' /_  / (_)__  ___ ____/ /__ ___ ___/ /__  ___  ___/ /__ _/ / ')
  console.log('  / /_/ / _ \\/ _ `/ _  / -_) -_) _  / _ \\/ _ \\/ _  / _ `/ _ \\')
  console.log(' /___/_/ .__/\\_,_/\\_,_/\\__/\\__/\\_,_/\\___/\\___/\\_,_/\\_,_/_//_/')
  console.log('      /_/                                                    ')
  console.log('')
}

function help() {
  let markup = `
Project Name:  ${color.yellow(project.name)}
Version:       ${color.yellow(project.version)}
Author:        ${color.yellow(project.author)}
Description:   ${color.yellow(project.description)}
Repository:    ${color.cyan('https://github.com/Malcomian/zipadeedoodah')}

Command Line Arguments:

-h  ${color.grey('display helpful information')}
-f  ${color.grey('load a configuration file')}
-a  ${color.grey('archive directory location')}
-o  ${color.grey('output filename pattern')}
-i  ${color.grey('one or more include patterns')}
-x  ${color.grey('one or more exclude patterns')}
-t  ${color.grey('timestamp format')}
-c  ${color.grey('only prompt for comment')}
-p  ${color.grey('full menu prompts')}
-m  ${color.grey('launch menu prompts without overriding options')}
-s  ${color.grey('save configuration to a file or overwrite a loaded file')}
  `
  let lines = markup.split('\n')
  lines.shift()
  return lines
}
