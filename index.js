#!/usr/bin/env node

const color = require('picocolors')

const project = require('./package.json')

console.log('  ____  _              __           __             __     __ ')
console.log(' /_  / (_)__  ___ ____/ /__ ___ ___/ /__  ___  ___/ /__ _/ / ')
console.log('  / /_/ / _ \\/ _ `/ _  / -_) -_) _  / _ \\/ _ \\/ _  / _ `/ _ \\')
console.log(' /___/_/ .__/\\_,_/\\_,_/\\__/\\__/\\_,_/\\___/\\___/\\_,_/\\_,_/_//_/')
console.log('      /_/                                                    ')
console.log('')
console.log(`version ${color.yellow(project.version)}`)

// if any arguments are given, check args for prompts and comments
if (process.argv.length > 2) {
  // optional prompts
  if (check_args(process.argv)) {
    var inquirer = require('inquirer')
    inquirer.prompt([
      {
        type: 'input',
        name: 'comment',
        message: 'Comment',
      }
    ]).then(answers => {
      if (answers.comment.length > 0) {
        let args = process.argv
        args.push('--comment')
        args.push(answers.comment)
        zip(args)
      } else {
        zip(process.argv)
      }
    })
  } else {
    zip(process.argv)
  }
} else {
  // full prompts
  var inquirer = require('inquirer')
  inquirer.prompt([
    {
      type: 'input',
      name: 'output',
      message: `Output file`,
      default: `../<cwd>_<timestamp>`
    },
    {
      type: 'input',
      name: 'comment',
      message: `Comment`
    },
    {
      type: 'input',
      name: 'globs',
      message: `Include patterns`,
      default: `"*/**" "*.*"`
    },
    {
      type: 'input',
      name: 'ignores',
      message: `Ignore patterns`,
      default: `"node_modules/**" ".git/**"`
    },
    {
      type: 'list',
      name: 'dot',
      message: `Include dotfiles?`,
      choices: [
        'Yes',
        'No'
      ]
    },
    {
      type: 'input',
      name: 'level',
      message: 'Compression Level (0-9)',
      default: 9,
    }
  ]).then(answers => {
    let args = process.argv
    let keys = Object.keys(answers)
    keys.forEach(key => {
      switch (key) {
        case 'globs':
          {
            args.push(`--${key}`)
            let str = `${answers[key]}`
            let regex = new RegExp(/"(.*?)"/g)
            let items = str.match(regex)
            if (items != null) items.forEach(item => args.push(item.split('"').join('')))
          }
          break;
        case 'ignores':
          {
            args.push(`--${key}`)
            let str = `${answers[key]}`
            let regex = new RegExp(/"(.*?)"/g)
            let items = str.match(regex)
            if (items != null) items.forEach(item => args.push(item.split('"').join('')))
          }
          break;
        case 'dot':
          args.push(`--${key}`)
          break;
        default:
          args.push(`--${key}`)
          args.push(`${answers[key]}`)
          break;
      }
    })
    zip(args)
  })
}

/**
 * checks arguments for a comment or a prompt flag
 * @param {[string]} args array of arguments
 * @returns {boolean}
 */
function check_args(args) {
  const parsed = require('yargs-parser')(args)

  let prompt = false
  let comment = false
  
  let keys = Object.keys(parsed)

  // set prompt to true if prompt flag is set
  if (keys.includes('prompt')) {
    if (parsed['prompt'] === true) prompt = true
  }
  if (keys.includes('p')) {
    if (parsed['p'] === true) prompt = true
  }

  // set comment to true if it exists and isn't merely a flag
  if (keys.includes('comment')) {
    if (typeof parsed['comment'] !== 'boolean') comment = true
  }
  if (keys.includes('c')) {
    if (typeof parsed['c'] !== 'boolean') comment = true
  }

  if (prompt === true && comment === false) return true
  return false
}

/**
 * zip files and folders based on arguments
 * @param {[string]} args array of arguments
 */
function zip(args) {
  const start = new Date().getTime()

  const Command = require('commander').Command
  const program = new Command()

  program.name('zipadeedoodah')
  program.version(project.version)

  program.option('-o, --output <output>', 'Relative path of output file (no ext)')
  program.option('-c, --comment [comment]', 'Comment')
  program.option('-p, --prompt', 'Prompt for comment')
  program.option('-g, --globs <globs...>', 'Glob patterns')
  program.option('-i, --ignores [ignores...]', 'Ignore patterns')
  program.option('-d, --dot', 'Include dotfiles')
  program.option('-l, --level [number]', 'Compression level (0-9)')

  program.parse(args)

  // get the options passed to the program
  var opts = program.opts()

  // initialize errors array
  var errors = []

  if (opts['output'] === undefined) errors.push('Please define an output file path!')
  if (opts['globs'] === undefined) errors.push('Please define at least one glob pattern!')
  if (opts['level'] < 0 || opts['level'] > 9 || !Number.isInteger(Number(opts['level']))) errors.push('Compression level must be an integer value from 0 to 9')

  // if there's any errors, log them and exit
  if (errors.length > 0) {
    errors.forEach((error) => console.log(error))
    process.exit(1)
  }

  const path = require('path')
  const bytes = require('bytes')
  const fs = require('fs')
  const archiver = require('archiver')

  if (opts['level'] === undefined) opts['level'] = 9

  var archive = archiver('zip', {
    zlib: {
      level: Number(opts['level'])
    }
  })

  class Keyword {
    constructor(name, value) {
      this.name = name
      this.value = value
    }
  }

  var keywords = []
  keywords.push(new Keyword('<timestamp>', getTimestamp()))
  keywords.push(new Keyword('<cwd>', process.cwd().split(path.sep).pop()))

  keywords.forEach((keyword) => {
    if (opts['output'].includes(keyword.name)) opts['output'] = opts['output'].replace(keyword.name, keyword.value)
  })

  if (opts['comment'] !== undefined && opts['comment'].length > 0) opts['output'] += ` - ${opts['comment']}`
  opts['output'] += '.zip'
  
  // if the output directory doesn't exist, throw an error and quit
  let target = path.parse(path.resolve(opts['output']))
  if (!fs.existsSync(target.dir)) {
    console.error(`Output folder ${color.yellow(target.dir)} does not exist!`)
    console.log(`Exiting...`)
    return process.exit(1)
  }

  var output = fs.createWriteStream(opts['output'])

  output.on('error', (error) => {
    throw error
  })

  var directories = 0
  var files = 0

  console.log(`Archiving ${color.yellow(target.dir + path.sep + target.base)} at compression level ${color.yellow(opts['level'])}...`)

  archive.on('entry', (entry) => {
    if (entry.stats.isFile()) files++
    if (entry.stats.isDirectory()) directories++
  })

  archive.on('finish', () => {
    let plural_files = ''
    if (files > 1 || files == 0) plural_files = 's'
    let plural_directories = 'y'
    if (directories > 1 || directories == 0) plural_directories = 'ies'
    console.log(`Archived ${color.yellow(files)} file${plural_files} and ${color.yellow(directories)} director${plural_directories}`)
    var end = new Date().getTime()
    var elapsed = end - start
    console.log(`Wrote ${color.yellow(bytes(archive.pointer()))} in ${color.yellow(elapsed)}ms`)
  })

  archive.on('error', (error) => {
    throw error
  })

  archive.pipe(output)

  // initialize glob_config object to pass to the archive glob
  var glob_config = {}
  if (opts['ignores'] !== undefined) glob_config.ignore = opts['ignores']
  if (opts['dot'] !== undefined) glob_config.dot = true

  archive.glob(opts['globs'], glob_config)

  // finalize file
  archive.finalize()

  function getTimestamp() {
    const { DateTime } = require('luxon')
    return DateTime.fromMillis(Date.now()).toFormat('yyyy-LL-dd_HH-mm-ss')
  }
}
