'use strict'

const stdin = process.stdin
const stderr = process.stderr

let read = {
  hide: ask => read.raw(ask, false),
  mask: ask => read.raw(ask, true),
  raw: (ask, maskAfter) => {
    // masking isn't available without setRawMode
    if (!stdin.setRawMode) return read.notty(ask)
    return new Promise(function (resolve, reject) {
      const ansi = require('ansi-escapes')

      let input = ''
      stderr.write(ansi.eraseLine)
      stderr.write(ansi.cursorLeft)
      stderr.write(ask)
      stdin.resume()
      stdin.setRawMode(true)

      function stop () {
        if (maskAfter) {
          stderr.write(
            ansi.cursorHide +
              ansi.cursorLeft +
              ask +
              input.replace(/./g, '*') +
              '\n' +
              ansi.cursorShow)
        } else {
          stderr.write('\n')
        }
        stdin.removeListener('data', fn)
        stdin.setRawMode(false)
        stdin.pause()
      }

      function enter () {
        if (input.length === 0) return
        stop()
        resolve(input)
      }

      function ctrlc () {
        reject(new Error('SIGINT'))
        stop()
      }

      function backspace () {
        if (input.length === 0) return
        input = input.substr(0, input.length - 1)
        stderr.write(ansi.cursorBackward(1))
        stderr.write(ansi.eraseEndLine)
      }

      function newchar (c) {
        input += c
        stderr.write(maskAfter ? c : '*'.repeat(c.length))
      }

      let fn = function (c) {
        switch (c) {
          case '\u0004': // Ctrl-d
          case '\r':
          case '\n':
            return enter()
          case '\u0003': // Ctrl-c
            return ctrlc()
          default:
            // backspace
            if (c.charCodeAt(0) === 127) return backspace()
            else return newchar(c)
        }
      }
      stdin.on('data', fn)
    })
  },
  notty: ask => {
    return new Promise((resolve, reject) => {
      const spawn = require('cross-spawn')
      stderr.write(ask)
      let output = spawn.sync('/bin/sh.exe',
        ['-c', 'read -s PASS && echo $PASS'], {
          stdio: ['inherit', 'pipe', 'inherit'],
          encoding: 'utf8'
        })
      console.dir(output)
      if (output.error) return reject(output.error)
      resolve(output.stdout.trim())
    })
  },
  show: ask => {
    return new Promise(resolve => {
      stderr.write(ask)
      stdin.resume()
      stdin.once('data', data => {
        // stdin.unref() // needed in cygwin
        stdin.pause()
        resolve(data.trim())
      })
    })
  }
}

/**
 * prompt -- Prompt for a password
 * @module password-prompt
 * @example
 * let prompt = require('password-prompt')
 * let password = prompt('password: ')
 * // password: ******
 * @param {string} [ask] - prompt output
 * @param {Object} [options]
 * @returns {Promise<string>} input from user
 */
function prompt (ask, options) {
  options = Object.assign({
    method: 'mask'
  }, options)
  stdin.setEncoding('utf8')
  return read[options.method](ask)
  .then(input => input || prompt(ask))
}

module.exports = prompt
