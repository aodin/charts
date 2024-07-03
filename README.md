Charts
======

Modular [D3.js](https://d3js.org) charts. View a live demo at https://aodin.github.io/charts/.

Install with:

```
npm i @aodin/charts
```

Chart are designed as extensible classes with basic defaults. Extend the existing classes to alter behaviors.

```js
import { LineChart } from "@aodin/charts";

export class Example extends LineChart {
  // Parse an array of objects from the values property instead of an array of arrays
  parseX(data) {
    return d3.map(data.values, (d) => d3.isoParse(d.x));
  }

  parseY(data) {
    return d3.map(data.values, (d) => d.y);
  }

  parseZ(data) {
    return d3.map(data.values, (d) => d.z);
  }
}
```

There are also pre-built files in `/dist/`. These charts expect an array of arrays as the data parameter, e.g. `[[x, y, z]...]`. They can be called with:

```js
charts.Line(data).render("#element");
```

See [examples](/examples) for example line, area, bar, pie, and OHLCV candlestick charts.


### Development

Test with: `npm test`

Build `dist` files with: `npm run dist`

Happy hacking!

aodin, 2024
