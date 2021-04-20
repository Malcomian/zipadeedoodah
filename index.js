#!/usr/bin/env node

var comment = ''
const readline = require('readline')
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})
rl.question('Comment for this archive (optional):', (answer) => {
  if (answer) {
    comment = answer
  }
  zip()
  rl.close()
})

function zip() {
  const start_time = new Date().getTime()

  const Command = require('commander').Command
  const program = new Command()

  program.name('zipadeedoodah')
  program.version(require('./package.json').version)

  program.option('-o, --output <output>', 'Relative path of output file (no ext)')
  program.option('-g, --globs <globs...>', 'Glob patterns')
  program.option('-i, --ignores [ignores...]', 'Ignore patterns')
  program.option('-d, --dot', 'Include dotfiles')
  program.option('-l, --level [number]', 'Compression level (0-9)')

  program.parse(process.argv)

  // get the options passed to the program
  var opts = program.opts()

  // initialize errors array
  var errors = []

  if (opts['output'] === undefined) errors.push('Please define an output file path!')
  if (opts['globs'] === undefined) errors.push('Please define at least one glob pattern!')

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
  keywords.push(new Keyword('<cwd>', process.cwd().split('\\').pop()))

  keywords.forEach((keyword) => {
    if (opts['output'].includes(keyword.name)) opts['output'] = opts['output'].replace(keyword.name, keyword.value)
  })

  if (comment.length > 0) opts['output'] += ` - ${comment}`
  opts['output'] += '.zip'

  var output = fs.createWriteStream(opts['output'])

  var directories = 0
  var files = 0

  console.log(`Archiving ${path.resolve(opts['output'])} at compression level ${opts['level']}...`)

  archive.on('entry', (entry) => {
    if (entry.stats.isFile()) files++
    if (entry.stats.isDirectory()) directories++
  })

  archive.on('finish', () => {
    let plural_files = ''
    if (files > 1 || files == 0) plural_files = 's'
    let plural_directories = 'y'
    if (directories > 1 || directories == 0) plural_directories = 'ies'
    console.log(`Archived ${files} file${plural_files} and ${directories} director${plural_directories}`)
    var end_time = new Date().getTime()
    var elapsed = end_time - start_time
    console.log(`Wrote ${bytes(archive.pointer())} in ${elapsed}ms`)
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
    let now = new Date().getTime()
    let yyyy = new Intl.DateTimeFormat('en', { year: 'numeric' }).format(now)
    let mm = new Intl.DateTimeFormat('en', { month: '2-digit' }).format(now)
    let dd = new Intl.DateTimeFormat('en', { day: '2-digit' }).format(now)
    let hour = new Intl.DateTimeFormat('en', { hour: '2-digit', hour12: false }).format(now)
    let min = new Intl.DateTimeFormat('en', { minute: '2-digit' }).format(now)
    let sec = new Intl.DateTimeFormat('en', { second: '2-digit' }).format(now)
    return `${yyyy}-${mm}-${dd}_${hour}-${min}-${sec}`
  }
}
