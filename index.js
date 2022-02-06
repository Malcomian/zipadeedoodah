#!/usr/bin/env node

const color = require('picocolors')

console.log('  ____  _              __           __             __     __ ')
console.log(' /_  / (_)__  ___ ____/ /__ ___ ___/ /__  ___  ___/ /__ _/ / ')
console.log('  / /_/ / _ \\/ _ `/ _  / -_) -_) _  / _ \\/ _ \\/ _  / _ `/ _ \\')
console.log(' /___/_/ .__/\\_,_/\\_,_/\\__/\\__/\\_,_/\\___/\\___/\\_,_/\\_,_/_//_/')
console.log('      /_/                                                    ')
console.log('')
console.log(`version ${color.yellow(require('./package.json').version)}`)

if (process.argv.length > 2) {
  // optional prompts
  var prompt = false
  var comment = false
  if (process.argv.includes('-c') || process.argv.includes('--comment')) comment = true
  if (process.argv.includes('-p') || process.argv.includes('--prompt')) prompt = true
  if (prompt == true && comment == false) {
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
        zip()
      }
    })
  } else {
    zip()
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

function zip(args) {
  const start = new Date().getTime()

  const Command = require('commander').Command
  const program = new Command()

  program.name('zipadeedoodah')
  program.version(require('./package.json').version)

  program.option('-o, --output <output>', 'Relative path of output file (no ext)')
  program.option('-c, --comment [comment]', 'Comment')
  program.option('-p, --prompt', 'Prompt for comment')
  program.option('-g, --globs <globs...>', 'Glob patterns')
  program.option('-i, --ignores [ignores...]', 'Ignore patterns')
  program.option('-d, --dot', 'Include dotfiles')
  program.option('-l, --level [number]', 'Compression level (0-9)')

  if (args == undefined) {
    program.parse(process.argv)
  } else {
    program.parse(args)
  }

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
    process.exit()
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

  var output = fs.createWriteStream(opts['output'])

  var directories = 0
  var files = 0

  console.log(`Archiving ${color.yellow(path.resolve(opts['output']))} at compression level ${color.yellow(opts['level'])}...`)

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
    return DateTime.fromMillis(Date.now()).toFormat('YYYY-MM-DD_HH-mm-ss')
  }
}
