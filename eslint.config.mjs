import merge from '@sequencemedia/eslint-config-standard/merge'
import globals from 'globals'

export default (
  merge({
    files: [
      '**/*.{cjs,mjs}'
    ],
    languageOptions: {
      globals: {
        ...globals.node
      }
    }
  })
)
