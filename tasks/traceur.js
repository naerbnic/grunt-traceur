/*
* grunt-traceur
* https://github.com/aaron/grunt
*
* Copyright (c) 2013 Aaron Frost
* Licensed under the MIT license.
*/

'use strict';
var fs = require('fs');
var path = require('path');
var compiler = require('../lib/compiler');
var Promise = require('es6-promise').Promise;
var RUNTIME_PATH = (function () {
  return require('traceur').RUNTIME_PATH;
})();

function asyncCompile(content, options) {
  return compiler.compile(content, options);
}

function assertPromise(b, msg) {
  return new Promise(function(resolve, reject) {
    if (b) {
      resolve();
    } else {
      reject(Error(msg));
    }
  });
}

/*
* Compiles one file
*/
function compileOne (grunt, compile, src, dest, options) {
  return assertPromise(src.length == 1,
      'source MUST be a single file OR multiple files using expand:true. ' +
      'Check out the README.')
    .then(function() {
      src = src[0];
      var content = grunt.file.read(src).toString('utf8');
      options.filename = src;
      if (options.moduleNames) {
        options.moduleName = [path.dirname(dest), path.sep, path.basename(dest, path.extname(dest))].join('');
      }
      return compile(content, options);
    })
    .then(function(result) {
      if (options.includeRuntime) {
        result[0] = fs.readFileSync(RUNTIME_PATH) + result[0];
      }
      if (options.sourceMaps) {
        var sourceMapName = path.basename(src) + '.map';
        var sourceMapPath = path.join(dest, '..',  sourceMapName);
        result[0] += '//# sourceMappingURL=' + sourceMapName + '\n';
        grunt.file.write(sourceMapPath, result[1]);
        grunt.log.debug('SourceMap written to "' + sourceMapName + '"');
      }
      grunt.file.write(dest, result[0], {
        encoding: 'utf8'
      });
      grunt.log.debug('Compiled successfully to "' + dest + '"');
      grunt.log.ok(src + ' -> ' + dest);
    })
    .catch(function(err) {
      grunt.log.error(src + ' -> ' + dest);
      grunt.log.error('ERRORS:');
      grunt.log.error(err);
    });
}

module.exports = function(grunt) {
  grunt.registerMultiTask('traceur',
    'Compile ES6 JavaScript to ES5 JavaScript', function() {
      var options = this.options({
        moduleNames: true
      });
      grunt.log.debug('using options: ' + JSON.stringify(options));
      var done = this.async();
      // we use a flag so that every errors are printed out
      // instead of quitting at the first one
      var success = true;
      var server, compile;

      if (options.spawn) {
        server = compiler.server();
        compile = server.compile;
      } else {
        compile = asyncCompile;
      }
      delete options.spawn;
      if (!this.files.length) {
        grunt.log.error('none of the listed sources are valid');
        success = false;
      }
      Promise
        .all(this.files.map(function (group) {
          return compileOne(grunt, compile, group.src, group.dest, options)
            .catch(function (e) {
              grunt.log.error(e.message);
              success = false;
            });
        }))
        .then(function () {
          if (server) {
            server.stop();
          }
          done(success);
        });
    });
};
