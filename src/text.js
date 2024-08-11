export function className(value) {
  // Sanitize the given string so it can be used as a class name
  value = String(value).trim();
  if (!value) return value;

  // Class names cannot contain spaces
  value = value.replace(" ", "_");

  // Class names cannot start with a number
  if (!isNaN(value.charAt(0))) {
    value = "_" + value;
  }

  return value;
}
