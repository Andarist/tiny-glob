const fs = require('fs');
const globrex = require('globrex');
const globalyzer = require('globalyzer');
const { join, resolve, relative } = require('path');
const { promisify } = require('util');

const isWin = process.platform === 'win32';
const isHidden = /(^|(\\+|\/))\.[^(\\+|\/)\.]/g;
const giveup = rgx => !rgx || rgx === '/^((?:[^\\]*(?:\\|$))*)$/' || rgx === '/^((?:[^\\/]*(?:\\/|$))*)$/';
const readdir = promisify(fs.readdir);

const CACHE = {};

async function walk(output, prefix, lexer, opts, dirname='', level=0) {
  console.log('-----------');
  console.log('DIRNAME', dirname);
  const rgx = lexer.segments[level];
  console.log('RGX', rgx);
  const dir = join(opts.cwd, prefix, dirname);
  console.log('DIR', dir);
  const files = await readdir(dir);
  console.log('FILES', files);
  const { dot, filesOnly } = opts;

  let i=0, len=files.length, file;
  let fullpath, relpath, stats, isMatch;

  for (; i < len; i++) {
    fullpath = join(dir, file=files[i]);
    relpath = dirname ? join(dirname, file) : file;
    if (!dot && isHidden.test(relpath)) continue;
    isMatch = lexer.regex.test(relpath);
    if ((stats=CACHE[relpath]) === void 0) {
      CACHE[relpath] = stats = fs.lstatSync(fullpath);
    }

    if (!stats.isDirectory()) {
      if (isMatch) {
        console.log('> IS FILE MATCH', relpath, opts.cwd);
        console.log('->', fullpath);
        console.log('->', relative(opts.cwd, fullpath));
        output.push(relative(opts.cwd, fullpath));
        console.log('->', output);
      }
      continue;
    }

    if (rgx && !rgx.test(file)) continue;
    !filesOnly && isMatch && output.push(join(prefix, relpath));

    await walk(output, prefix, lexer, opts, relpath, giveup(rgx) ? null : level + 1);
  }
}

/**
 * Find files using bash-like globbing.
 * All paths are normalized compared to node-glob.
 * @param {String} str Glob string
 * @param {String} [options.cwd='.'] Current working directory
 * @param {Boolean} [options.dot=false] Include dotfile matches
 * @param {Boolean} [options.absolute=false] Return absolute paths
 * @param {Boolean} [options.filesOnly=false] Do not include folders if true
 * @param {Boolean} [options.flush=false] Reset cache object
 * @returns {Array} array containing matching files
 */
module.exports = async function (str, opts={}) {
  let glob = globalyzer(str);

  if (!glob.isGlob) return fs.existsSync(str) ? [str] : [];
  if (opts.flush) CACHE = {};

  let matches = [];
  opts.cwd = opts.cwd || '.';
  let { path } = globrex(glob.glob, { filepath:true, globstar:true, extended:true });

  console.log('> INPUT', str);
  console.log('> GLOBAL', glob);
  console.log('> path.regex', path.regex);
  console.log('> path.segments', path.segments);

  await walk(matches, glob.base, path, opts, '.', 0);

  return opts.absolute ? matches.map(x => resolve(opts.cwd, x)) : matches;
};
