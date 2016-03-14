/*
 * Android can not pass object and array, so we need to override it to convert
 * some of the function parameters to JSON
 */
App = {};

App.bookmarkIconUrl = {
    "red": "file:///android_res/drawable/img_pinklabel.png",
    "yellow": "file:///android_res/drawable/img_yellowlabel.png",
    "blue": "file:///android_res/drawable/img_bluelabel.png",
}

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

App.onToggleLoading = function(visible) {
    _App.onToggleLoading(visible);
}

App.onToggleActionMode = function(visible, color) {
    _App.onToggleActionMode(visible, color);
};

App.onToggleThumbnailbar = function(visible) {
    _App.onToggleThumbnailbar(visible);
}

App.onRequestHighlights = function(callback) {
    _App.onRequestHighlights(callback);
};

App.onAddHighlight = function(highlight, callback) {
    _App.onAddHighlight(JSON.stringify(highlight), callback);
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

App.onRequestBookmarks = function(callback) {
    _App.onRequestBookmarks(callback);
};

App.onAddBookmark = function(bookmark, callback) {
    _App.onAddBookmark(JSON.stringify(bookmark), callback);
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

App.onGoToBookIntro = function() {
    _App.onGoToBookIntro();
};

App.onShareBookInfo = function() {
    _App.onShareBookInfo();
};

App.getPageDirection = function(callback) {
    _App.getPageDirection(callback);
};

App.onLog = function(tag, msg) {
    _App.onLog(tag, msg);
};

App.setControlEnable = function(enable) {
    _App.setControlEnable(enable);
};

App.onToggleTouchEnable = function(enable) {
    _App.onToggleTouchEnable(enable);
};

App.showPageDircetionTip = function(pageDirection) {
    _App.showPageDircetionTip(pageDirection);
};