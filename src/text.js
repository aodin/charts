
const invalidChars = /[^a-zA-Z0-9_-]/g;
const invalidStart = /^[^a-zA-Z_]/;

export function className(value) {
  // Sanitize the given string so it can be used as a class name
  // Spaces will be replaced with underscores, other invalid characters will be removed
  value = String(value).trim().replaceAll(" ", "_").replace(invalidChars, "");

  // Prepend an underscore if the name starts will an invalid character
  if (invalidStart.test(value)) {
    value = '_' + value;
  }
  return value;
}
