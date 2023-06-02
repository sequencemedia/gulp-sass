import path from 'path'
import {
  Transform
} from 'stream'
import chalk from 'chalk'
import PluginError from 'plugin-error'
import replaceExtension from 'replace-ext'
import stripAnsi from 'strip-ansi'
import cloneDeep from 'lodash.clonedeep'
import vinylSourceMaps from 'vinyl-sourcemaps-apply'

const PLUGIN_NAME = 'gulp-sass'

const MISSING_COMPILER_MESSAGE = `
gulp-sass no longer has a default Sass compiler; please set one yourself.
Both the "sass" and "node-sass" packages are permitted.
For example, in your gulpfile:

  import sass from 'sass'
  import gulpSass from 'gulp-sass'

  gulpSass(sass)
`
const STREAMING_NOT_SUPPORTED_MESSAGE = 'Streaming not supported'

const streamTransform = (transform) => new Transform({ transform, objectMode: true })

/**
 * Handles returning the file to the stream
 */
function filePush (file, sassObject, done) {
  // Build Source Maps!
  if (sassObject.map) {
    // Transform map into JSON
    const sassMap = JSON.parse(sassObject.map.toString())
    // Grab the stdout and transform it into stdin
    const sassMapFile = sassMap.file.replace(/^stdout$/, 'stdin')
    // Grab the base filename that's being worked on
    const sassFileSrc = file.relative
    // Grab the path portion of the file that's being worked on
    const sassFileSrcPath = path.dirname(sassFileSrc)

    if (sassFileSrcPath) {
      const sourceFileIndex = sassMap.sources.indexOf(sassMapFile)
      // Prepend the path to all files in the sources array except the file that's being worked on
      sassMap.sources = sassMap.sources.map((source, index) => (
        index === sourceFileIndex
          ? source
          : path.join(sassFileSrcPath, source)
      ))
    }

    // Remove 'stdin' from souces and replace with filenames!
    sassMap.sources = sassMap.sources.filter((src) => src !== 'stdin' && src)

    // Replace the map file with the original filename (but new extension)
    sassMap.file = replaceExtension(sassFileSrc, '.css')

    // Apply the map
    vinylSourceMaps(file, sassMap)
  }

  file.contents = sassObject.css
  file.path = replaceExtension(file.path, '.css')

  if (file.stat) {
    file.stat.atime = file.stat.mtime = file.stat.ctime = new Date()
  }

  done(null, file)
}

/**
 * Handles error message
 */
function handleError (error, file, done) {
  const filePath = (error.file === 'stdin' ? file.path : error.file) || file.path
  const relativePath = path.relative(process.cwd(), filePath)
  const message = `${chalk.underline(relativePath)}\n${error.formatted}`

  error.messageFormatted = message
  error.messageOriginal = error.message
  error.message = stripAnsi(message)
  error.relativePath = relativePath

  return done(new PluginError(PLUGIN_NAME, error))
}

/**
 * Main Gulp Sass function
 */

// eslint-disable-next-line arrow-body-style
function gulpSass (options, sync) {
  return streamTransform((file, encoding, done) => {
    if (file.isNull()) {
      done(null, file)
      return
    }

    if (file.isStream()) {
      done(new PluginError(PLUGIN_NAME, STREAMING_NOT_SUPPORTED_MESSAGE))
      return
    }

    if (path.basename(file.path).startsWith('_')) {
      done()
      return
    }

    if (!file.contents.length) {
      file.path = replaceExtension(file.path, '.css')
      done(null, file)
      return
    }

    const opts = cloneDeep(options || {})
    opts.data = file.contents.toString()

    // We set the file path here so that libsass can correctly resolve import paths
    opts.file = file.path

    // Ensure `indentedSyntax` is true if a `.sass` file
    if (path.extname(file.path) === '.sass') {
      opts.indentedSyntax = true
    }

    // Ensure file's parent directory in the include path
    if (opts.includePaths) {
      if (typeof opts.includePaths === 'string') {
        opts.includePaths = [opts.includePaths]
      }
    } else {
      opts.includePaths = []
    }

    opts.includePaths.unshift(path.dirname(file.path))

    // Generate Source Maps if the source-map plugin is present
    if (file.sourceMap) {
      opts.sourceMap = file.path
      opts.omitSourceMapUrl = true
      opts.sourceMapContents = true
    }

    if (sync !== true) {
      /**
       * Async Sass render
       */
      gulpSass.compiler.render(opts, (error, obj) => {
        if (error) {
          handleError(error, file, done)
          return
        }

        filePush(file, obj, done)
      })
    } else {
      /**
       * Sync Sass render
       */
      try {
        filePush(file, gulpSass.compiler.renderSync(opts), done)
      } catch (error) {
        handleError(error, file, done)
      }
    }
  })
}

/**
 * Sync Sass render
 */
gulpSass.sync = (options) => gulpSass(options, true)

/**
 * Log errors nicely
 */
gulpSass.logError = function logError (error) {
  const message = (
    new PluginError(
      PLUGIN_NAME,
      error.messageFormatted
    )
  ).toString()

  process.stderr.write(`${message}\n`)
  this.emit('end')
}

export default (compiler) => {
  if (!compiler || !compiler.render) {
    const message = (
      new PluginError(
        PLUGIN_NAME,
        MISSING_COMPILER_MESSAGE,
        {
          showProperties: false
        }
      )
    ).toString()

    process.stderr.write(`${message}\n`)
    process.exit(1)
  }

  gulpSass.compiler = compiler
  return gulpSass
}
