var gulp = require('gulp');
var del = require('del');
var sass = require('gulp-sass');
var autoprefixer = require('gulp-autoprefixer');
var browserSync = require('browser-sync').create();
var eslint = require('gulp-eslint');
// var jasmine = require('gulp-jasmine-phantom');
// var concat = require('gulp-concat');
// var uglify = require('gulp-uglify');
// var gm = require('gulp-gm');
// var browserify = require('gulp-browserify');

var browserify = require('browserify');
var babelify = require('babelify');
var source = require('vinyl-source-stream');
var buffer = require('vinyl-buffer');
var sourcemaps = require('gulp-sourcemaps');
var util = require('gulp-util');

gulp.task('default', ['copy-html', 'copy-fonts', 'copy-images', 'styles', 'script-main', 'script-restaurant'], function() {
  gulp.watch('sass/**/*.scss', ['styles']);
  gulp.watch(['*.html', 'sw.js'], ['html-watch']);
  gulp.watch('js/*.js', ['js-watch']);

  browserSync.init({
    server: './dist',
    notify: false
  });
});

gulp.task('clean', function (done) {
  del(['dist'], done);
});

gulp.task('copy-html', () => {
  gulp.src([
    '*.html',
    'sw.js',
    'manifest.json'
  ])
    .pipe(gulp.dest('./dist'));
});

gulp.task('copy-images', () => {
  gulp.src([
    'images/*'
  ])
    .pipe(gulp.dest('dist/images'));
});

gulp.task('copy-fonts', () => {
  gulp.src([
    'fonts/*'
  ])
    .pipe(gulp.dest('dist/fonts'));
});

// gulp.task('resize-images', () => {
//   gulp.src('img/*')
//     .pipe(gm((gmfile) => {
//       gmfile.
//     }))
//     .pipe(gulp.dest('dist/images'))
// });

gulp.task('styles', function () {
  gulp.src('sass/**/*.scss')
    .pipe(sass().on('error', sass.logError))
    .pipe(autoprefixer({
      browsers: ['last 2 versions']
    }))
    .pipe(gulp.dest('dist/css'))
    .pipe(browserSync.stream());
});

gulp.task('lint', function () {
  return gulp.src(['js/*.js'])
    // eslint() attaches the lint output to the eslint property
    // of the file object so it can be used by other modules.
    .pipe(eslint())
    // eslint.format() outputs the lint results to the console.
    // Alternatively use eslint.formatEach() (see Docs).
    .pipe(eslint.format())
    // To have the process exit with an error code (1) on
    // lint error, return the stream and pipe to failOnError last.
    .pipe(eslint.failOnError());
});

// Basic usage
gulp.task('script-main', function() {
  return browserify({ entries: './js/main.js', debug: true })
    // .transform(babelify)
    .bundle()
    .pipe(source('main.js'))
    .pipe(gulp.dest('dist/js'));
});

gulp.task('script-restaurant', function() {
  return browserify({ entries: './js/restaurant_info.js', debug: true })
    // .transform(babelify)
    .bundle()
    .pipe(source('restaurant_info.js'))
    .pipe(gulp.dest('dist/js'));
});

// create a task that ensures the `js` task is complete before
// reloading browsers
gulp.task('js-watch', ['script-main', 'script-restaurant'], function (done) {
  browserSync.reload();
  done();
});

gulp.task('html-watch', ['copy-html'], function (done) {
  browserSync.reload();
  done();
});
