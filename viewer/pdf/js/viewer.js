Viewer = {};
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
/// @legacy: bool - true if legacy mode is needed
///
Viewer.loadBook = function(url, legacy) {

    console.log("lookBook url= "+ url + ", legacy= "+legacy);
    downloadlink = url;

    if(DEBUG_CHROME_DEV_TOOL) {
        console.time('Viewer.loadBook()');
        console.timeStamp('Viewer.loadBook()');
    }
    // turn on streaming for App
    PDFJS.disableRange = false;
    PDFJS.disableStream = false;
    PDFJS.disableAutoFetch = true;
    //PDFJS.verbosity = PDFJS.VERBOSITY_LEVELS.infos;

    var pdfFile;

    parseContainerFile(url).then(function(opf) {
          console.log("opf: "+opf);
          opfFile = url+ opf;  //keep in global
          getfilename(opfFile).then(function(paths) {
             if (paths.drm != null) {
                 //TODO: parse herf to get DRM path
                 drmFile = url+ "DRM/drm.xml";
                 loadDRM().then(function(drm){
                     if (!canRead()) {
                         window.alert("此書目前無法閱讀");
                         $("#book_loading").fadeOut();
                         return;
                      }
                      window.setInterval(loadDRM,  10*60*1000); //10mins
                      pdfFile = url + paths.pdf;
                      renderBook(pdfFile, legacy);
                 } , function (reason) {
                     console.log(reason); //fail to get DRM
                     window.alert(reason);
                     pdfFile = url + paths.pdf;
                     renderBook(pdfFile, legacy); //temp, still render it without drm file
                 });
       	     } else {
       	         //DO NOTHING?
       	         //no drm file define in opf
       	         pdfFile = url + paths.pdf;
       	         renderBook(pdfFile, legacy);
       	     }
          }, function(reason) {
             console.log("Fail getfilename "+reason); //fail to get filename
             window.alert(reason);
          });
    }, function(reason) {  //parseContainerFile fail case
           console.log("Fail parseContainerFile "+reason);
           window.alert(reason);
    });
}

///
/// Set the text appearance
///
/// @text_size: int - in pt unit
/// @[r, g, b] - text color
///
Viewer.setTextAppearance = function(text_size, text_color) {
    // epub only
}

///
/// Set page background color
///
/// @[r, g, b] - page background color
///
Viewer.setBackgroundColor = function(rgb) {
    // epub only
}

///
/// Set page background image
///
/// @image_url - page background image url
///
Viewer.setBackgroundImage = function(image_url) {
    // epub only
}

///
/// Get an array of available page layout modes for this book
///
/// @mode: string - either "single", "side_by_side" or "continuous"
///
Viewer.getAvailableLayoutModes = function() {
    if (isIOSDevice || isAndroidDevice) {
        return ["single", "side_by_side"];
    }
    return ["single", "side_by_side", "continuous"];
}

///
/// Get current page layout mode
///
/// @mode: string - either "single", "side_by_side" or "continuous"
///
Viewer.getLayoutMode = function() {
    return currentLayoutMode;
}

///
/// Notify viewer that the book is trial.
/// Need to create the trial page in the end.
///
///@book_info: Json object - related book infomations in trial page
///
Viewer.enableTrialPage = function(info) {
    isTrial=true;
    $('#popup4').find('.popImg').attr("src", downloadlink + "book_cover.jpg");
	$('#popup4').find('.bookTitle').html(info.c_title);
	$('#popup4').find('.creator').html(info.author);
	$('#popup4').find('.publisher').html(info.publisher_name);
	$('#popup4').find('.pubdate').html(info.publish_date);
	$('#popup4').find('.identifier').html(info.isbn);
	$('#popup4').find('.format').html(info.book_format);
	$('#popup4').find('.edition').html(info.cur_version);

    $('#popup4').find('.popupLink').click(function(){
    	App.onGoToBookIntro();
    });
    $('#popup4').find('.share').click(function(){
    	App.onShareBookInfo();
    });
}

///
/// Set page layout mode
///
/// @mode: string - either "single", "side_by_side" or "continuous"
///
Viewer.setLayoutMode = function(mode) {

    console.log("Viewer.setLayoutMode=" + mode);
    //TODO: check ChapterLimit
    if (!canRead()){
    	window.alert("此書無法閱讀");
    	return;
    }

    if (mode === currentLayoutMode) {
        return;
    }

    var isReady = customEventsManager['onDelayedPageDIVsReady'].isReady;
    if (mode === "single") {
        if(isReady) {
            setLayoutModeSingle();
        } else {
            customEventsManager['onDelayedPageDIVsReady'].doTask(setLayoutModeSingle);
        }
    } else if (mode === "side_by_side"){
        if(isReady) {
            setLayoutModeSideBySide();
        } else {
            customEventsManager['onDelayedPageDIVsReady'].doTask(setLayoutModeSideBySide);
        }
    } else {
        if(isReady) {
            setLayoutModeSingle();
        } else {
            customEventsManager['onDelayedPageDIVsReady'].doTask(setLayoutModeSingle);
        }
    }

    function setLayoutModeSingle() {
        currentLayoutMode = mode;
        console.log("setLayoutMode:single");

        // NOTE : We must do page number transform before following actions
        PageAnimation.onTwoPageModeToOnePageMode();

        TwoPageViewMode.disable();
        //Phoebe add, for update page number
        updateToolBar();
        //[HW] update bookmark icon
        updateBookmarkIcon();
    }

    function setLayoutModeSideBySide() {
        currentLayoutMode = mode;
        console.log("setLayoutMode:side_by_side");

        // NOTE : We must do page number transform before following actions
        PageAnimation.onOnePageModeToTwoPageMode();

        TwoPageViewMode.enable();
        //Phoebe add, for update page number
        updateToolBar();
        //[HW] update bookmark icon
        updateBookmarkIcon();
    }
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
    return ["", currentPageNum, currentPageNum, pdfDoc.numPages]
}

///
/// Goto the given link in this ebook
///
/// @link: string - target file link (relative to base url)
///
Viewer.gotoLink = function(link) {
   //TODO: check ChapterLimit
    if (!canRead()){
    	window.alert("此書無法閱讀");
    	return;
    }
   var index = parseInt(link);
   var dest = pdfOutlineArray[index].outline.dest;
   PDFViewerApplication.pdfLinkService.navigateTo(dest);
}

///
/// Goto the given position in this ebook
///
/// @cfi: string - epub cfi
///
Viewer.gotoPosition = function(cfi) {
    if(DEBUG_CHROME_DEV_TOOL) {
        console.time('Viewer.gotoPosition()');
        console.timeStamp('Viewer.gotoPosition()');
    }

    var regex = /^[0-9]*$/;
    //PDF doesn't support cfi, check if cfi is page number.
    if (regex.test(cfi)) {
        var isReady = customEventsManager['onDelayedPageDIVsReady'].isReady;
        if (isReady) {
            if ((cfi > 1) && (cfi <= pdfDoc.numPages)){
                currentPageNum = cfi;
                PDFViewerApplication.page = currentPageNum;
            }
        } else {
            viewerPageNum = parseInt(cfi);
        }
    }

    if(DEBUG_CHROME_DEV_TOOL) {
        console.timeEnd('Viewer.gotoPosition()');
    }
}

///
/// Toggle the bookmark in the current page.
///
/// If a valid tag is specified, viewer should call App.onAddBookmark
/// or App.onUpdateBookmark in response.
///
/// If null is specified, viewer should call App.onRemoveBookmark in response,
/// or do nothing if there is currently no bookmark
///
/// @color: string or null
///     color - the bookmark color, either "red", "yellow" or "blue"
///     null - to remove current bookmark
///
Viewer.toggleBookmark = function(color, page_offset) {
    if(DEBUG_CHROME_DEV_TOOL) {
        console.time('Viewer.toggleBookmark()');
        console.timeStamp('Viewer.toggleBookmark()');
    }

    if (TwoPageViewMode.active) {
        if (page_offset == 0) { //left page
            if (color !== null) {
                UpdateBookmark(currentPageNum, color);
                $("#bookmark_left")[0].className = "bookmark " + color;
            } else {
                var bookmark = null;
                if ((bookmark = isBookmarkExist(currentPageNum)) !== null) {
                    App.onRemoveBookmark(bookmark.uuid);
                    var index = savedBookmarks.indexOf(bookmark);
                    delete savedBookmarks[index];
                    $("#bookmark_left")[0].className = "bookmark_icon ";
                }
            }
        } else if (page_offset == 1) { //right page
            if (color !== null) {
                UpdateBookmark(currentPageNum + 1, color);
                $("#bookmark")[0].className = "bookmark " + color;
            } else {
                var bookmark = null;
                if ((bookmark = isBookmarkExist(currentPageNum + 1)) !== null) {
                    App.onRemoveBookmark(bookmark.uuid);
                    var index = savedBookmarks.indexOf(bookmark);
                    delete savedBookmarks[index];
                    $("#bookmark")[0].className = "bookmark_icon ";
                }
            }
        }
    } else {
        if (color !== null) {
            UpdateBookmark(currentPageNum, color);
            $("#bookmark")[0].className = "bookmark " + color;
        } else {
            //Remove bookmark in current page.
            var bookmark = null;
            if ((bookmark = isBookmarkExist(currentPageNum)) !== null) {
                App.onRemoveBookmark(bookmark.uuid);
                var index = savedBookmarks.indexOf(bookmark);
                delete savedBookmarks[index];
                $("#bookmark")[0].className = "bookmark_icon ";
            }
        }
    }

    if(DEBUG_CHROME_DEV_TOOL) {
        console.timeEnd('Viewer.toggleBookmark()');
    }
}

///
/// Notify viewer that bookmarks is modified.
///
/// @list_bookmarks: Json array - an array of object to represent bookmarks
///
Viewer.updateBookmarks = function(list_bookmarks) {
    RequestBookmarksCallback(list_bookmarks);
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

//Henry add, trigger change page from app has better performance
Viewer.gotoPrevious =function(){
    PageAnimation.onPrevPage();
}

Viewer.gotoNext = function(){
    PageAnimation.onNextPage();
}

// [Bruce] interact.js
Viewer.gesturableOnStart = function(scale,ds) {
    var event = {x0:PageAnimation.gestureX0,
                 y0:PageAnimation.gestureY0,
                 scale:parseFloat(scale),
                 ds:parseFloat(ds),
                 target:PageAnimation.getCurrentPageDiv()};
    PageAnimation.callback_interact_gesturable_onstart(event);
}

Viewer.gesturableOnMove = function(scale,ds) {
    var event = {x0:PageAnimation.gestureX0,
                 y0:PageAnimation.gestureY0,
                 scale:parseFloat(scale),
                 ds:parseFloat(ds),
                 target:PageAnimation.getCurrentPageDiv()};
    PageAnimation.callback_interact_gesturable_onmove(event);
}

Viewer.gesturableOnEnd = function(scale,ds) {
    var event = {x0:PageAnimation.gestureX0,
                 y0:PageAnimation.gestureY0,
                 scale:parseFloat(scale),
                 ds:parseFloat(ds),
                 target:PageAnimation.getCurrentPageDiv()};
    PageAnimation.callback_interact_gesturable_onend(event);

    PageAnimation.gestureX0 = 0;
    PageAnimation.gestureY0 = 0;
}

Viewer.draggableOnMove = function(dx,dy) {
    var event = {dx:parseFloat(dx),
                 dy:parseFloat(dy),
                 target:PageAnimation.getCurrentPageDiv()};
    PageAnimation.callback_interact_draggable_onmove(event);
}

Viewer.draggableOnEnd = function() {
    var event = {target:PageAnimation.getCurrentPageDiv()};
    PageAnimation.callback_interact_draggable_onend(event);
}
// End : [Bruce]

