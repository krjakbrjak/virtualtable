Displaying a collection of items on a web page is generally easy. But in some cases, the collection can have a huge number of items. Of course, adding millions of divs would hang the browser. There are some implementations available, but they seemed to be heavy, bringing in unnecessary dependencies.

Very often, we have to deal with data represented as a collection of items of the same type, and it is straightforward to display them in some sort of list view. Of course, this depends a lot on the language in use and the framework. Usually, one takes the class that represents the list view, configures the data source, and whenever a particular item needs to be rendered, the framework will fetch the data for that item, usually identified by the index, and eventually return it to the part of the code that is rendering it. For example, if someone were to develop a C++ application with the help of the Qt framework, they would use a subclass of [QAbstractItemModel](https://doc.qt.io/qt-6/qabstractitemmodel.html) as the data source and a subclass of [QAbstractItemView](https://doc.qt.io/qt-6/qabstractitemview.html) for rendering. The critical part here is to make the rendering part as efficient as possible, especially when dealing with a large number of items. Similar libraries exist for other languages as well (or even something that is implemented by their standard libraries).

It is a little different for web views. Typically, people use features like infinite scrolling or pagination. The precise position of the scrollbar and its mapping to a particular element are not important, as seen on social network pages or online shops. Search results are often presented in an order that may not make much sense, and users usually scroll through the pages until they find a specific item. However, what if someone is working with a dataset of a certain size, where items are sorted in a specific order within that set, and the user knows approximately where the item of interest is located? In this case, we need a scrollbar that allows navigation to that item in the fastest way possible.

Let's take a look at how it can be implemented in code. We draw all items but hide those that cannot fit on the screen. This can be achieved by setting the [overflow](https://developer.mozilla.org/en-US/docs/Web/CSS/overflow) property to scroll or auto and limiting the [height](https://developer.mozilla.org/en-US/docs/Web/CSS/height) of the element to a certain value:

```html
<div class="scrolldiv">
    ...
</div>
```
```css
.scrolldiv {
    overflow: auto;
    height: XXXpx;
}
```

In this case, we will have a scrollbar that allows us to scroll the items up and down (If only vertical scrolling is desired then the property is [overflow-y](https://developer.mozilla.org/en-US/docs/Web/CSS/overflow-y)). However, this is inefficient because we would need to store all rendered items in memory.

The way libraries and frameworks solve this is by rendering only the number of items that fit the screen plus some extra items. Whenever we scroll up or down, we can calculate, based on the scroll position and the number of items that fit the screen, the new offset. Then, the entire collection can be rotated, ensuring that only the items that fit the screen need to be rendered. This logic requires two changes:

1. There should be JS/TS code providing data at an offset (that corresponds to the first element of the page).
2. There should be extra logic taking care of the scrollbar - there are now only a limited number of items rendered, but the scrollbar still should correspond to the whole data set.

The data store is straightforward to implement and can be represented with the following interface:
```ts
interface Result<Type> {
    from: number;
    items: Array<Type>;
    totalCount: number;
}

export interface DataSource<T> {
    fetch(index: number, count: number): Promise<Result<T>>;
}
```

The part with the scrollbar is trickier. For that, two separate elements are required: the first, `content`, to display the items, and the second, `scrolldiv`, to show the scrollbar of the right size. `scrolldiv`'s position is absolute, and it is placed exactly on top of `content`. However, to show the scrollbar, the `overflow` property is set to `scroll`, and another empty element is added to it with the `height` property set to the total number of items times the height of a single element:

```html
<div class="wrapper">
    <div class="content">...</div>
    <div class="scrolldiv">
        <div></div>
    </div>
</div>
``` 
```css
.wrapper {
    position: relative;
}
.content {
    overflow: hidden;
    height: 100%;
    width: 100%;
}
.scrolldiv {
    position: absolute;
    overflow: scroll;
    top: 0;
    left: 0;
    bottom: 0;
    height: 100%;
    width: 100%;
}
.scrolldiv > div {
    height: XXXpx;
    width: 100%;
}
```
