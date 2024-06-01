Charts
======

Modular [D3.js](https://d3js.org) chart components.

Chart are designed as extensible classes with basic defaults. Extend the existing classes to alter behaviors.

```js
import { Line } from "charts/line";

export class Example extends Line {
  // Parse an array of objects instead of an array of arrays
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

Charts:

* Line
* Area
* Bar
* Candlestick

Components:

* Time-series formats
* Hover interactions
* HTML legends and tooltips
* Animations

See [examples](/examples) for more.

Happy hacking!

aodin, 2024
