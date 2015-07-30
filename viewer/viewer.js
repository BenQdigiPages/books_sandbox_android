var Viewer = {}

///
/// Load ebook from server url
/// App will act as transparent proxy, and provides offline content
/// if available
///
/// App may request legacy mode, which can not handle partial GET.
/// If legacy mode is activated, Viewer should put "Range" header in
/// query parameter "_Range_", and issue normal HTTP GET request.
///
/// @url: string - base url of ebook
/// @legacy: bool - true if legecy mode is needed
///
Viewer.loadBook = function(url, legacy) {
//    window.alert("Viewer.loadBook=" + url)
}

///
/// Get current text font scale size
///
/// @scale: double - 1.0 is original size
///
Viewer.getFontScale = function() {
    return 1.0;
}

///
/// Set text font scale size
///
/// @scale: double - 1.0 is original size
///
Viewer.setFontScale = function(scale) {

}

///
/// Get page background color
///
/// @[r, g, b] - page background color
///
Viewer.getBackgroundColor = function() {
    return [0, 0, 0];
}

///
/// Set page background color
///
/// @[r, g, b] - page background color
///
Viewer.setBackgroundColor = function(rgb) {
    window.alert("Viewer.setBackgroundColor=" + rgb)
}

///
/// Get an array of available page layout modes for this book
///
/// @mode: string - either "single", "side_by_side" or "continuous"
///
Viewer.getAvailableLayoutModes = function() {
    return ["single", "side_by_side", "continuous"];
}

///
/// Get current page layout mode
///
/// @mode: string - either "single", "side_by_side" or "continuous"
///
Viewer.getLayoutMode = function() {
    return "single";
}

///
/// Set page layout mode
///
/// @mode: string - either "single", "side_by_side" or "continuous"
///
Viewer.setLayoutMode = function(mode) {
    window.alert("Viewer.setLayoutMode=" + mode)
}

///
/// Get current position in the ebook
///
/// @chapter: string - an opaque to represent current chapter
/// @cfi: string - epub cfi
/// @current_page: int - page number of current page
/// @total_pages: int - total number of pages
///
Viewer.getCurrentPosition = function() {
    return ["ooxx", "oooxxx", 1, 100]
}

///
/// Goto the given link in this ebook
///
/// @link: string - target file link (relative to base url)
///
Viewer.gotoLink = function(link) {
    window.alert("Viewer.gotoLink=" + link)
}

///
/// Goto the given position in this ebook
///
/// @cfi: string - epub cfi
///
Viewer.gotoPosition = function(cfi) {
    window.alert("Viewer.gotoPosition=" + cfi)
}

///
/// Toggle the bookmark in the current page.
///
/// If a valid [r, g, b] is specified, viewer should call App.onAddBookmark
/// or App.onUpdateBookmark in response.
///
/// If null is specified, viewer should call App.onRemoveBookmark in response,
/// or do nothing if there is currently no bookmark
///
/// @color: [r, g, b] or null
///     [r, g, b] - the bookmark indicator color,
///     null - to remove current bookmark
///
Viewer.toggleBookmark = function(color) {
    window.alert("Viewer.toggleBookmark=" + color)
}

///
/// Search text and mark the found text, the search is case-insensitive
/// viewer should call App.onSearchFound in response
///
/// @keyword: string or null - the keyword to be found,
///     or null to cancel search mode
///
Viewer.searchText = function(keyword) {
    window.alert("Viewer.searchText=" + keyword)
}

