function* closestIndexes(scale, index) {
  const domain = scale.domain();
  const domainLength = domain.length;

  if (index < 0 || index >= domainLength) {
    throw new Error(
      "Index out of bounds. Please provide an index within the scale's domain range.",
    );
  }

  let left = index - 1;
  let right = index + 1;

  yield scale(domain[index]);

  while (left >= 0 || right < domainLength) {
    if (left >= 0) {
      yield scale(domain[left]);
      left--;
    }
    if (right < domainLength) {
      yield scale(domain[right]);
      right++;
    }
  }
}

// Example usage:
const scale = d3
  .scaleOrdinal()
  .domain(["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k"])
  .range([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);

const index = 5;
const generator = closestIndexes(scale, index);

for (const item of generator) {
  console.log(item);
}
