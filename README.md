# @sequencemedia/gulp-sass

Sass for Gulp

This project is a fork of gulp-sass `v5.1.0` refactored in ESM and updated with latest dependencies

## Installation

Install a Sass compiler such as [Dart Sass][] and `@sequencemedia/gulp-sass`

```sh
npm i -D sass @sequencemedia/gulp-sass
```

### Usage

```javascript
import dartSass from 'sass';
import gulpSass from '@sequencemedia/gulp-sass';

const sass = gulpSass(dartSass)
```

[Dart Sass]: https://sass-lang.com/dart-sass
