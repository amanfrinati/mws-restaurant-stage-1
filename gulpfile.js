var gulp = require('gulp');
var sass = require('gulp-sass');
var autoprefixer = require('gulp-autoprefixer');
var browserSync = require('browser-sync').create();
// var eslint = require('gulp-eslint');
// var jasmine = require('gulp-jasmine-phantom');
var concat = require('gulp-concat');
var cleanCSS = require('gulp-clean-css');
// var uglify = require('gulp-uglify');
var browserify = require('browserify');
var source = require('vinyl-source-stream');
// var sourcemaps = require('gulp-sourcemaps');

gulp.task('default', ['copy-html', 'copy-fonts', 'copy-images', 'styles', 'script-main', 'script-restaurant'], function() {
  gulp.watch('sass/**/*.scss', ['styles']);
  gulp.watch(['*.html', 'sw.js'], ['html-watch']);
  gulp.watch('js/*.js', ['js-watch']);

  browserSync.init({
    server: './dist',
    notify: false
  });
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

gulp.task('styles', function () {
  gulp.src([
    'sass/styles.scss',
    'sass/regular.scss',
    'sass/solid.scss'
  ])
    .pipe(sass().on('error', sass.logError))
    .pipe(autoprefixer({
      browsers: ['last 2 versions']
    }))
    .pipe(concat('styles.css'))
    .pipe(cleanCSS({ compatibility: 'ie8' }))
    .pipe(gulp.dest('dist/css/'))
    .pipe(browserSync.stream());
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
