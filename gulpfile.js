var gulp = require('gulp');
// var del = require('del');
var sass = require('gulp-sass');
var autoprefixer = require('gulp-autoprefixer');
var browserSync = require('browser-sync').create();
// var eslint = require('gulp-eslint');
// var jasmine = require('gulp-jasmine-phantom');
// var concat = require('gulp-concat');
// var uglify = require('gulp-uglify');
// var gm = require('gulp-gm');
var browserify = require('gulp-browserify');

gulp.task('default', ['copy-html', 'copy-images', 'styles', 'script-main', 'script-restaurant'], function() {
  gulp.watch('sass/**/*.scss', ['styles']);
  gulp.watch('/index.html', ['copy-html']);
  gulp.watch('js/*.js', ['js-watch']);
  gulp.watch('/restaurant.html', ['copy-html']);
  gulp.watch('./dist/index.html').on('change', browserSync.reload);

  browserSync.init({
    server: './dist'
  });
});

// gulp.task('clean', function (done) {
//   del(['dist'], done);
// });

gulp.task('copy-html', () => {
  gulp.src([
    '*.html',
    'sw.js'
  ])
    .pipe(gulp.dest('./dist'));
});

gulp.task('copy-images', () => {
  gulp.src('images/*')
    .pipe(gulp.dest('dist/images'));
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

// gulp.task('lint', function () {
//   return gulp.src(['js/**/*.js'])
//     // eslint() attaches the lint output to the eslint property
//     // of the file object so it can be used by other modules.
//     .pipe(eslint())
//     // eslint.format() outputs the lint results to the console.
//     // Alternatively use eslint.formatEach() (see Docs).
//     .pipe(eslint.format())
//     // To have the process exit with an error code (1) on
//     // lint error, return the stream and pipe to failOnError last.
//     .pipe(eslint.failOnError());
// });

// Basic usage
gulp.task('script-main', function () {
  // Single entry point to browserify
  gulp.src('js/main.js')
    .pipe(browserify({
      insertGlobals: true
    }))
    .pipe(gulp.dest('./dist/js'));
});

gulp.task('script-restaurant', function() {
  gulp.src('js/restaurant_info.js')
    .pipe(browserify({
      insertGlobals: true
    }))
    .pipe(gulp.dest('./dist/js'));
});

// create a task that ensures the `js` task is complete before
// reloading browsers
gulp.task('js-watch', ['script-main', 'script-restaurant'], function (done) {
  browserSync.reload();
  done();
});
