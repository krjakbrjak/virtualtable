# virtualtable

![status](https://github.com/krjakbrjak/virtualtable/workflows/React%20VirtualTable%20component%20CI/badge.svg)

An implementation of a table displaying large data sets. See [doc](./docs/doc.md) for more details.

<p align="center">
<img src="./demo.gif" alt="VirtualTable demo" width="560" />
</p>

## Getting Started

Make sure you have [Yarn](https://classic.yarnpkg.com/en/docs/install/) installed.

Install dependencies and build the package:

```bash
yarn install
yarn build
```

The demo resolves the package from `dist`, so it will not start until the build
has run at least once.

Run the demo:

```bash
cd demo
yarn install
yarn start
```

The app will be available at `localhost:9001`. The "Simulate outage" toggle in
the demo breaks the data source, so you can watch the failure handling work.

## Installation

```bash
npm install @krjakbrjak/virtualtable
# or
yarn add @krjakbrjak/virtualtable
```

## Usage

```jsx
import { VirtualTable } from '@krjakbrjak/virtualtable';

class Items {
    // Returns `count` items starting at `index`, plus the size of the
    // whole collection.
    fetch(index, count) {
        return fetch(`/api/items?offset=${index}&limit=${count}`).then((r) => r.json());
    }
}

const source = new Items();

<VirtualTable
    fetcher={source}
    renderer={(item) => (item ? <Row item={item} /> : <Skeleton />)}
/>;
```

The table has no height of its own, so give the element that contains it one.

### Rows are all one height

The table measures the first row and reuses that height for every other one.
Scroll position, how many rows are fetched, and which row the pointer is over
are all derived from that single measurement, so rows have to render at a
consistent height. A placeholder that is shorter than a loaded row is the usual
way to get this wrong; so is text long enough to wrap onto a second line.

Rows are clipped to the measured height, so a row that renders taller loses its
overflow rather than pushing the rows below it out of step.

The measurement is kept up to date rather than taken once, so a table may be
mounted inside a dropdown, a collapsed panel or an inactive tab: nothing has a
size in there, and the rows appear when the container is first shown. A row that
later changes height, or a viewport that is resized, is picked up the same way,
and the collection is fetched again at the page size that then applies.

## Props

| Prop         | Type                                    | Default    | Description                                                                       |
| ------------ | --------------------------------------- | ---------- | --------------------------------------------------------------------------------- |
| `fetcher`    | `DataSource<Type>`                      | _required_ | Supplies the items, a page at a time.                                             |
| `renderer`   | `(item) => ReactNode`                   | _required_ | Renders one row. Called with `undefined` while the row's page is still loading.    |
| `style`      | `Style`                                 | none       | Class names for row states, see [Styling](#styling-virtualtable).                 |
| `striped`    | `boolean`                               | `false`    | Shades every other row, by position in the collection rather than on screen.       |
| `selectable` | `boolean`                               | `true`     | Whether clicking a row selects it, see [Selection](#selection).                    |
| `onSelected` | `(index: number, item: Type) => void`   | none       | Called once per selection, with the selected item.                                |
| `onRowClick` | `(index, item \| undefined) => void`    | none       | Called on every click, the already selected row included.                          |
| `aria-label` | `string`                                | none       | Names the list for assistive technology.                                           |
| `onError`    | `(page: number, error: unknown) => void`| none       | Called every time a page fails to load, retries included.                         |

Replacing `fetcher` discards the current collection and starts again, so build it
once rather than inline in the render.

### Data source

```ts
interface Result<Type> {
    from: number; // index the items start at
    items: Array<Type>;
    totalCount: number; // size of the whole collection
}

interface DataSource<Type> {
    fetch(index: number, count: number): Promise<Result<Type>>;
}
```

`fetch` is also called with a count of 1 before anything is rendered, to measure
how tall a row is.

### Selection

`onSelected` reports the row the user clicked. If that row's page has not been
fetched yet the call is deferred until it has, so the item is always supplied
rather than the index alone. Only one call is made per selection.

The table is focusable and drives a cursor from the keyboard: the arrows move
it one row, PageUp and PageDown one screen, Home and End to the ends, and Enter
or Space commits it — the same as clicking the row. The cursor is not the
selection: moving through the rows selects nothing until it is committed. It is
rendered with the `hover` class, and reported to assistive technology through
`aria-activedescendant`; the table itself is a `listbox` of `option` rows, so
pass `aria-label` to name it.

`onRowClick` reports the click itself, every time, including a click on the row
that is already selected. It is not deferred, so the item is `undefined` when
the row's page has not been loaded, the same as in the renderer. This is the one
to use for anything that is not single select: a toggle, a second click meaning
"confirm", or a selection of several rows.

A table whose selection is managed outside it does not need the internal one at
all. `selectable={false}` turns it off: clicks are still reported through
`onRowClick`, but no row is marked as selected, `onSelected` is never called,
and the `select` class is never applied.

### Failures

A page that fails to load is retried for as long as it is on screen, with the
delay doubling from one second up to a ceiling of thirty. There is no attempt
limit, because nothing on the client can know when a source recovers; a source
that comes back is picked up on the next attempt without the consumer doing
anything. Retries are only scheduled for pages in view, so scrolling away stops
them and scrolling back resumes them.

`onError` fires on every failure, so expect repeated calls for the same page
during an outage rather than one per page. Failures of the row-measuring fetch
described above are reported against page 0.

A failed row is passed to `renderer` as `undefined`, the same as one that is
still loading. If the very first fetch fails, nothing is rendered at all, since
the size of the collection is only learned from a successful response.

## Styling VirtualTable

To style the VirtualTable, supply a CSS module with the following optional class names:

- `item`: Applied to each table item.
- `hover`: Applied when an item is hovered.
- `select`: Applied when an item is selected.

Example CSS module (`MyTableStyles.module.css`):

```css
.item { /* base item styles */ }
.hover { /* hover styles */ }
.select { /* selected item styles */ }
```

Example usage:

```jsx
import styles from './MyTableStyles.module.css';

<VirtualTable style={styles} ... />
```

See [index.module.css](/demo/src/index.module.css) from the [demo](/demo/).

### Markup

The table renders plain `div`s and brings its own stylesheet, which is bundled
into the JavaScript and needs no separate import. It has no dependencies beyond
React, and expects no framework CSS in the page.

Every rule it ships is scoped under its own root class, so importing the table
does not restyle anything around it. The flip side is that the page owns its own
globals: a host that wants `box-sizing: border-box` everywhere has to say so.

The class names below are what the table puts on its own elements. They are
there to be styled or selected in a test, though rows are better addressed
through the `style` prop above.

| Class             | Element                                                    |
| ----------------- | ---------------------------------------------------------- |
| `vt-root`         | Outermost element.                                          |
| `vt-viewport`     | The element that scrolls.                                   |
| `vt-spacer`       | Carries the height of the whole collection.                 |
| `vt-window`       | The rows currently mounted, moved into place as it scrolls. |
| `vt-list`         | Wraps the rows.                                             |
| `vt-row`          | One row.                                                    |
| `vt-row-striped`  | Every other row, when `striped` is set.                     |
| `vt-probe`        | The hidden row the height is measured on.                   |
