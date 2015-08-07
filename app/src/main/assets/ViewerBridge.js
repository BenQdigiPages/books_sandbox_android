/*
 * Android can not pass object and array, so we need to override it to convert
 * some of the function parameters to JSON
 */
App = Object.create(_App);

App.onChangeTOC = function(toc_entry_array) {
    _App.onChangeTOC(JSON.stringify(toc_entry_array));
};

App.onAddHighlight = function(chapter, highlight, callback) {
    _App.onAddHighlight(chapter, JSON.stringify(highlight), callback);
};

App.onUpdateHighlight = function(highlight) {
    _App.onUpdateHighlight(JSON.stringify(highlight));
};

App.onAddBookmark = function(chapter, bookmark, callback) {
    _App.onAddBookmark(chapter, JSON.stringify(bookmark), callback);
};

App.onUpdateBookmark = function(bookmark) {
    _App.onUpdateBookmark(JSON.stringify(bookmark));
};

App.onSearchResult = function(keyword, result_array) {
    _App.onSearchResult(keyword, JSON.stringify(result_array));
};
