/*
 * Android can not pass object and array, so we need to override it to convert
 * some of the function parameters to JSON
 */
App = Object.create(AndroidApp);

App.onChangeTOC = function(toc_entry_array) {
    AndroidApp.onChangeTOC(JSON.stringify(toc_entry_array));
};

App.onAddHighlight = function(chapter, highlight, callback) {
    AndroidApp.onAddHighlight(chapter, JSON.stringify(highlight), callback);
};

App.onUpdateHighlight = function(highlight) {
    AndroidApp.onUpdateHighlight(JSON.stringify(highlight));
};

App.onAddBookmark = function(chapter, bookmark, callback) {
    AndroidApp.onAddBookmark(chapter, JSON.stringify(bookmark), callback);
};

App.onUpdateBookmark = function(bookmark) {
    AndroidApp.onUpdateBookmark(JSON.stringify(bookmark));
};

App.onSearchResult = function(keyword, result_array) {
    AndroidApp.onSearchResult(keyword, JSON.stringify(result_array));
};
