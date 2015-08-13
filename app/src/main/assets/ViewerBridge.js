/*
 * Android can not pass object and array, so we need to override it to convert
 * some of the function parameters to JSON
 */
App = {};

App.onChangeView = function(offset_x, offset_y, scale) {
    _App.onChangeView(offset_x, offset_y, scale);
};

App.onChangeTitle = function(title) {
    _App.onChangeTitle(title);
}

App.onChangeTOC = function(toc_entry_array) {
    _App.onChangeTOC(JSON.stringify(toc_entry_array));
};

App.onChangePage = function(chapter, cfi, current_page, total_pages) {
    _App.onChangePage(chapter, cfi, current_page, total_pages);
};

App.onTrackAction = function(action, cfi) {
    _App.onTrackAction(action, cfi);
};

App.onToggleToolbar = function(visible) {
    _App.onToggleToolbar(visible);
};

App.onRequestHighlights = function(chapter, callback) {
    _App.onRequestHighlights(chapter, callback);
};

App.onAddHighlight = function(chapter, highlight, callback) {
    _App.onAddHighlight(chapter, JSON.stringify(highlight), callback);
};

App.onUpdateHighlight = function(highlight) {
    _App.onUpdateHighlight(JSON.stringify(highlight));
};

App.onRemoveHighlight = function(uuid) {
    _App.onRemoveHighlight(uuid);
};

App.onShareHighlight = function(uuid) {
    _App.onShareHighlight(uuid);
};

App.onAnnotateHighlight = function(uuid) {
    _App.onAnnotateHighlight(uuid);
};

App.onRequestBookmarks = function(chapter, callback) {
    _App.onRequestBookmarks(chapter, callback);
};

App.onAddBookmark = function(chapter, bookmark, callback) {
    _App.onAddBookmark(chapter, JSON.stringify(bookmark), callback);
};

App.onUpdateBookmark = function(bookmark) {
    _App.onUpdateBookmark(JSON.stringify(bookmark));
};

App.onRemoveBookmark = function(uuid) {
    _App.onRemoveBookmark(uuid);
};

App.onSearchResult = function(keyword, result_array) {
    _App.onSearchResult(keyword, JSON.stringify(result_array));
};
