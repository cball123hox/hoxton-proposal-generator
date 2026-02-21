const noop = () => {}

export const logger = {
  log: import.meta.env.DEV ? console.log.bind(console) : noop,
  warn: import.meta.env.DEV ? console.warn.bind(console) : noop,
  error: import.meta.env.DEV ? console.error.bind(console) : noop,
}
