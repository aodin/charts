export const percentFormatter = new Intl.NumberFormat("en-US", {
  style: "percent",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  signDisplay: "exceptZero",
});

export const priceFmt = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export const smallPriceFmt = new Intl.NumberFormat("en-US", {
  maximumSignificantDigits: 3,
});

export const magFormatter = new Intl.NumberFormat("en-US", {
  notation: "compact",
  compactDisplay: "short",
  minimumFractionDigits: 1,
  maximumFractionDigits: 2,
});

export const percentAxisFormatter = new Intl.NumberFormat("en-US", {
  style: "percent",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
  signDisplay: "exceptZero",
});

export const preciseFormatter = new Intl.NumberFormat("en-US", {
  notation: "compact",
  compactDisplay: "short",
  minimumFractionDigits: 2,
  maximumFractionDigits: 3,
});

export const volume = function (value) {
  if (!value) return; // Never show 0
  if (value >= 1e9) {
    return `${value / 1e9}B`; // Show billions
  }
  return `${value / 1e6}M`; // Show millions
};
