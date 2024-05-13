function applyMagnitude(Y) {
  let yLabel = "";
  const lowerBound = d3.quantile(Y, 0.1);
  if (lowerBound > 0) {
    const digits = parseInt(Math.floor(Math.log10(lowerBound) / 3.0));
    if (digits > 1 && digits < 4) {
      // TODO Don't use yet
      // magnitude = Math.pow(10, digits * 3);
      // yLabel = digits == 2 ? "Millions" : "Billions";
    }
  }

  if (magnitude != 1.0) {
    Y = Y.map((d) => d / magnitude);
  }
  return Y;
}
