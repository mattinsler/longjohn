module.exports = function(grunt) {
  
  grunt.loadNpmTasks('grunt-contrib-coffee');

  // Project configuration.
  grunt.initConfig({
    pkg: '<json:package.json>',
    coffee: {
      compile: {
        files: {
          'dist/longjohn.js': 'lib/longjohn.coffee'
        }
      }
    }
  });
  
  // Default task.
  grunt.registerTask('default', 'coffee');
};