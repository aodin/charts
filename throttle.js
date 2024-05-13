export function throttle(fn, timeout) {
  var free = true;
  return function () {
    if (free) {
      fn.apply(this, arguments);
      free = false;
      setTimeout(() => {
        free = true;
      }, timeout);
    }
  };
}
