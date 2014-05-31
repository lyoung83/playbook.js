#!/usr/bin/env node

var fs = require('fs'),
  compressor = require('node-minify');

new compressor.minify({
  type: 'gcc',
  fileIn: 'playbook.js',
  fileOut: 'playbook.min.js',
  callback: function (err) {
    if (err) {
      console.log(err);
    } else {
      console.log("JS minified successfully.");
    }
  }
});

