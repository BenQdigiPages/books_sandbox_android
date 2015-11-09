var Viewer = {};
var is_loading = true;
var loading_index = 0;
var currentPage = 0;
var total_pages = 0;
var iframe;
var highlights = [];
var bookmarks = [];
var position = 0;
var current_chapter = null;
var current_highlight_idx = 0;
var current_highlight = null;
var change_page = false;
var current_page = 1;
var loader = [];
var toolbar = false;
var book_uni_id;
var host = window.location.origin;
var callNote = false;
var current_data;
var search_index = 0;
var keyword = "";
var search_result = [];

var ua = navigator.userAgent;
var isIOSDevice = /iP(hone|od|ad)/g.test(ua);
var isAndroidDevice = /Android/g.test(ua);

// searchText
// onChangePage
// onTrackAction

// onRequestHighlights
// onAddHighlight
// onUpdateHighlight
// onRemoveHighlight
// onShareHighlight
// onAnnotateHighlight
// onRequestBookmarks
// onAddBookmark
// onUpdateBookmark
// onRemoveBookmark
// onSearchResult

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

$(".bookmark li a").click(function(){ 
    var bm = document.querySelector(".bookmark");
    var li = $(this).parent('li');

    if(bm.className.search(/[red|yellow|blue]/)>-1) {
        for(var i in bookmarks) {
            if( bookmarks[i].href==current_chapter.href )
                current_data = bookmarks[i];
        }
    } 
    console.log(current_data);
    if(li.hasClass("del") && !current_data==false) {
        UpdateBookNote({
            type: "bookmark",
            uuid: current_data.uuid,
            chapter: current_data.spinePos,
            cfi: current_data.cfi,
            href: current_data.href,
            page: current_page,
            spine: current_data.spine,
            color: current_data.color,
            action: "del"
        });    
    } else {
        if(!current_data) 
            UpdateBookNote({
                type: "bookmark",
                chapter: current_chapter.spinePos,
                cfi: current_chapter.cfi,
                href: current_chapter.href,
                page: current_page,
                color: $(this).parent("li")[0].className,
                action: "add"
            });
        else
            UpdateBookNote({
                type: "bookmark",
                uuid: current_data.uuid,
                chapter: current_data.spinePos,
                cfi: current_data.cfi,
                href: current_chapter.href,
                page: current_data.page,
                color: $(this).parent("li")[0].className,
                spine: current_data.spine,
                action: "edit"
            });    
    }
});

$("input[name='bookcolor']").change(function(argument) {
    setHighlight($("input[name='bookcolor']:checked").val());
});

$("#bookline").on("click","a.note",function(){
    setHighlightWithNote();
}).on("click","a.share", function(){
    App.onShareHighlight(current_data.uuid);
}).on("click",".del", function(){
    UpdateBookNote({
        type: "highlight", 
        uuid: current_data.uuid, 
        chapter: current_data.spinePos, 
        range: current_data.range, 
        cfi: current_data.cfi, 
        href: current_data.href, 
        highlight_text: current_data.highlight_text, 
        page: current_data.page, 
        color: current_data.color,
        action: "del"
    });
}).on("click",".fa-times", function(){
    closeContextMenu();
});

$("#popup3").find("input[name='update']").click(function(){
    $("#popup3").hide();
    App.onAnnotateHighlight(current_data.uuid);
}).end().find(".fa-trash-o").click(function(){
    var uuid = $("#popup3").find('input[name="uuid"]').val();

});

Viewer.loadBook = function(url, legacy) {
    App.onToggleToolbar(false);
    toolbar = false;
    RenderBook(url);
};

///
/// Get current text font scale size
///
/// @scale: double - 1.0 is original size
///
Viewer.getFontScale = function(scale) {
    alert("getFontScale: "+scale);
    return 1.0;
};

///
/// Set text font scale size
///
/// @scale: double - 1.0 is original size
///
Viewer.setTextAppearance = function(size, rgb) {
    alert("setFontScale: "+size+","+rgb);
    current_font.size = size;
    current_font.line = (current_font.size*1.5).toFixed(1);
    SetFont();
};

///
/// Get page background color
///
/// @[r, g, b] - page background color
///
Viewer.getBackgroundColor = function(rgb) {
   alert("getBackgroundColor: "+rgb);
   BookData.bg = r;
};

///
/// Set page background color
///
/// @[r, g, b] - page background color
///
Viewer.setBackgroundColor = function(rgb) {
    alert("setBackgroundColor: "+rgb);
    BookData.bg = rgb;
    SetBackground();
};

Viewer.setBackgroundImage = function(img) {
    alert("setBackgroundColor: "+img);
    BookData.bg = img;
    SetBackground();
}

///
/// Get an array of available page layout modes for this book
///
/// @mode: string - either "single", "side_by_side" or "continuous"
///
Viewer.getAvailableLayoutModes = function() {
    return ["single", "continuous"];
};

///
/// Get current page layout mode
///
/// @mode: string - either "single", "side_by_side" or "continuous"
///
Viewer.getLayoutMode = function() {
    return layout;
};


///
/// Set page layout mode
///
/// @mode: string - either "single", "side_by_side" or "continuous"
///
Viewer.setLayoutMode = function() {
    // alert("setLayoutMode: "+mode);
    if(mode=="continuous") {
        layout = "scroll";
        scollmode = true;
    } else {
        layout = mode=="single"?"single":"double";
    }
    SetLayout();
};

///
/// Get current position in the ebook
///
/// @chapter: string - an opaque to represent current chapter
/// @cfi: string - epub cfi
/// @current_page: int - page number of current page
/// @total_pages: int - total number of pages
///
Viewer.getCurrentPosition = function() {
    var toc = getTOC(BookData.toc, Book.renderer.currentChapter.href);
    return [toc.label, Book.renderer.currentChapter.cfi, Book.renderer.currentChapter.spinePos, BookData.toc.length];
};

///
/// Goto the given link in this ebook
///
/// @link: string - target file link (relative to base url)
///
Viewer.gotoLink = function(link) {
    // alert("gotoLink"+link);
    if(!Book==false)
        Book.goto(link);
//    window.alert("Viewer.gotoLink=" + link)
};

///
/// Goto the given position in this ebook
///
/// @cfi: string - epub cfi
///
Viewer.gotoPosition = function(cfi) {
    // alert("gotoPosition: "+cfi);
    if(!Book==false) {
        Book.displayChapter(cfi);
    }
//    window.alert("Viewer.gotoPosition=" + cfi)
};

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
    // alert("toggleBookmark: "+color);
    if(!BookData.bookmark) BookData.bookmark = [];
    var cur = Book.renderer.currentChapter;

    if(!color) {
        var idx;
        for(var i in BookData.bookmark) {
            var v = BookData.bookmark[i];
            if(v.cfi==cur.cfi) idx = i;
        }
        BookData.bookmark.splice(idx, 1);
    } else {
        BookData.bookmark.push({
            href: !current_data.cfi?'':current_data.href,
            cfi: !current_data.cfi?'':current_data.cfi,
            is_public: !current_data.is_public?"N":current_data.is_public,
            chapter: current_data.chapter,
            color: color,
            spine: current_data.spinePos
        });

        $(".bookmark").removeClass('red').removeClass('yellow').removeClass('blue').addClass(color);
    }

};

///
/// Search text and mark the found text, the search is case-insensitive
/// viewer should call App.onSearchFound in response
///
/// @keyword: string or null - the keyword to be found,
///     or null to cancel search mode
///
Viewer.searchText = function(keyword) {
    window.alert("Viewer.searchText=" + keyword)
};

$(".highlight_list").on("click", "a", function(){
    var cfi = $(this).data("cfi");
    Viewer.gotoPosition(cfi);
});

$(".bookmark_list").on("click", "a", function(){
    var cfi = $(this).data("cfi");
    Viewer.gotoPosition(cfi);
});

function DoScroll(){
    if( layout!="scroll" || change_page==true ) return false;

    var scroll = $('body').scrollTop();

    if(scroll>position) { // Down
        if( scroll+$(window).height()>=$('body')[0].scrollHeight ) {
            change_page = true;
            $(".next_page").click();
        }
    } else { // Up
        if( scroll==0 ) {
            change_page = true;
            $(".prev_page").click();
        }
    }

    position = scroll;
}

function RenderBook(url) {
    Book = ePub(url, {
        spreads: false,
        restore: true,
        fixedLayout: true
    });

    Book.renderTo("book_area");
    // 設定上下頁 click 事件
    Book.on("book:ready",function(){
        iframe = $("#book_area").find('iframe')[0];
        var idoc = iframe.contentDocument || iframe.contentWindow.document; // For IE.

        $('.prev_page').click(function(){
//            $(window).unbind("scroll", DoScroll));
            currentPage--;
            Book.prevPage();
        });
        $(".next_page").click(function(){
//            $(window).unbind("scroll", DoScroll);
            currentPage++;
            Book.nextPage();
        });

        App.onRequestHighlights("renderHighlight");
        App.onRequestBookmarks('renderBookmark');

        // 設定字體
        SetFont();
        // 設定背景
        SetBackground();
        Viewer.searchText("DEAD");
        // App.onSearchResult("DEAD",result);
        submitKeyword("DEAD");
    });
    // 設定CSS檔
    Book.on('renderer:chapterDisplayed', function(location){
        var idoc = iframe.contentDocument || iframe.contentWindow.document; // For IE.
        var link = document.createElement('link');
        
        link.setAttribute("rel","stylesheet");
        link.setAttribute("type","text/css");
        link.setAttribute("href", host+"/(ASSETS)/epub/libs/book.css");

        idoc.head.appendChild(link);

        $(idoc.body).click(function(){ 
            toolbar = !toolbar;
            if(toolbar) 
                App.onToggleToolbar(true); 
            else 
                App.onToggleToolbar(false); 
        });

        if(scollmode) {
            iframe.style.height = iframe.contentWindow.document.body.scrollHeight;

            if($(iframe).height()<$(window).height())
                $("#book_area").height($(window).height()).scrollTop(1);
            else
                $("#book_area").height($(iframe).height()+50).scrollTop(1);
        }
//
        for(var i in highlights) {
            var item = highlights[i];
            HighlightWords(item.cfi, item.color, item.uuid);
        }

        change_page = false;
        SetBookmark();
        submitKeyword("DEAD");
    });

    Book.on('renderer:chapterDisplayed', function(){
        // debugger;
        for (var i = 0; i<highlights; i++) {
            HighlightWords(highlights[i].cfi, highlights[i].color, highlights[i].id);
        };
    });

    Book.on('renderer:locationChanged', function(location){
        current_chapter = Book.renderer.currentChapter;
        current_page = Book.renderer.currentRenderedPage();

        $(idoc).find("img").click(function(){
            $.fancybox({
                padding: 0, href: this.src,
            });
        });
//        if( currentPage==1 ) {
//            $('.prev_page').hide();
//        } else if ( currentPage==total_pages ) {
//            $('.next_page').hide();
//        } else {
//            $('.next_page').show();
//            $('.prev_page').show();
//        }
        App.onTrackAction("locationChanged", current_chapter.cfi);

        if(layout=="scroll"){
            change_page = false;
            position = 0;
            $("#book_area").scrollTop(1);
        }

    });

    Book.on('renderer:selected', function(selectedRange){

        if(selectedRange.type!="Range") {
            $('#bookline').hide();
            return;
        }

        range = selectedRange.getRangeAt(0);

        if((range.endOffset - range.startOffset)>0){
            var tag = $(range.endContainer.parentElement);
            var top_dis = tag.position().top;
            var top = top_dis>$('body').height()?tag.position().top:top_dis;
            var left = tag.position().left+$("#book_area").position().left;
            
            if(!$("#bookline .del").hasClass("hidden"))
                $("#bookline .del").addClass("hidden");

            $('#bookline').show().find("div").css({ top:top_dis, left:left });
        }
    });

    Book.getMetadata().then(function(){
        BookData.title = Book.metadata.bookTitle;
        App.onChangeTitle(BookData.title);
    });

    Book.getToc().then(function(toc){
        // console.log(toc);
        // App.onChangeTOC(toc);
        BookData.toc = RenderToc(toc, null, 0);
        // console.log(BookData.toc);
        App.onChangeTOC(BookData.toc);
    });
}

function RenderToc(toc, ary, lv) {
    var result = !ary?[]:ary;

    $.each(toc, function(k,v){
        result.push({
            cfi: this.cfi,
            href: this.href,
            id: this.id,
            label: this.label,
            parent: this.parent,
            subitems: this.subitems,
            title: this.label,
            url: this.href,
            link: this.href,
            level: lv,
        });

        if(this.subitems.length) result = result.concat(RenderToc(this.subitems, [], lv+1));
    });

    return result;
}

function SetFont() {
    // alert(current_font.size);
    Book.setStyle("font-size", current_font.size+"px");
    Book.setStyle("line-height", current_font.line+"px");
}

function SetBackground() {
    var bg = BookData.bg;
    if(typeof BookData.bg == "object") {
        if(bg[0]==255 && bg[1]==255 && bg[2]==255) {
            document.querySelector("body").className = 'default';
            Book.setStyle('color',"#000");
        }  
        if(bg[0]==0 && bg[1]==0 && bg[2]==0) {
            document.querySelector("body").className = 'night';
            Book.setStyle('color',"#FFF");
        }
    } else {
        Book.setStyle('color',"#000");
        document.querySelector("body").className = 'paper1';
    }

    App.onToggleToolbar(false);
    toolbar = false;
}

function GetReadProgress() {
    var _this = this;
    var data = {};
    data.book_uni_id = book_uni_id;

    $.get("http://appapi.booksdev.benqguru.com:8080/V1.2/CMSAPIApp/BookReadProgress", data,function(ref){
        var r = (typeof ref =="string")?JSON.parse(ref):ref;

        if(!r.error_code) {
            $("#book_loading").fadeOut();
        } else {
            alert(r.error_message);
        }
    },"json");
}

function SetLayout() {
    switch(layout) {
        case "scroll":
            $("#book_area").css({
                "max-width": 600,
                marginLeft: "auto",
                marginRight: "auto",
                overflow: "auto"
            });
            break;
        case "single":
        case "double":
            $("#book_area").css({
                "max-width": 600,
                marginLeft: "auto",
                marginRight: "auto",
                overflow: "hidden"
            });
            break;
    }
    App.onToggleToolbar(false);
    toolbar = false;
}

function setHighlightWithNote() {
    if(!current_data) {
        var selection = GetSelection();
        var idoc = iframe.contentDocument || iframe.contentWindow.document; // For IE.
        
        current_data = {
            color: "red",
            cfi: selection.str,
            uuid: guid(),
            href: Book.renderer.currentChapter.href,
            highlight_text: selection.range.toString(),
            page: current_page,
            cfi: selection.str,
            page: current_page,
            range: selection.range,
            action: "add"
        };
    } else {
        current_data.action = 'edit';
    }

    $("#popup3").find(".page").text(current_data.page).end()
        .find(".chapter_info").text(current_data.text).end()
        .find("input[name='uuid']").val(current_data.uuid).end()
        .find("input[name='action']").val(current_data.action).end()
        .fadeIn();

    closeContextMenu();
}

function setHighlight(color) {
    alert("start set highlight");
    if( !current_data ) {
        var selection = GetSelection();
        var idoc = iframe.contentDocument || iframe.contentWindow.document; // For IE.
        var is_same = false;
        // var r_content = selection.range.cloneContents();
        // if(callNote) alert("after add, need onAnnotateHighlight");
        UpdateBookNote({
            type: "highlight",
            chapter: current_chapter.spinePos,
            range: selection.range,
            cfi: selection.str,
            href: Book.renderer.currentChapter.href,
            highlight_text: selection.range.toString(),
            page: current_page,
            color: color,
            action: "add"
        });
    } else {
        UpdateBookNote({
            type: "highlight", 
            uuid: current_data.uuid, 
            chapter: current_data.spinePos, 
            range: current_data.range, 
            cfi: current_data.cfi, 
            href: current_data.href, 
            highlight_text: current_data.highlight_text, 
            page: current_data.page, 
            color: color,
            action: "edit"
        });
    }
}

function UpdateBookNote(options) {
    
    var data = {
            uuid: !options.uuid?guid():options.uuid,
            book_uni_id: "12345",
            version: "V001.01",
            type: options.type,
            href: !options.cfi?'':options.href,
            cfi: !options.cfi?'':options.cfi,
            is_public: !options.is_public?"N":options.is_public,
            action: options.action,
            updated_time: moment().format()
        };

    if(options.type=="bookmark") {
        data.chapter = options.chapter;
        data.color = options.color;
        data.spine = current_chapter.spinePos;
    }
    if(options.type=="highlight") {
        data.color = options.color;
        data.chapter = options.chapter;
        data.highlight_text = options.highlight_text;
        data.text = !options.note?'':options.note;
    }
    // if(options.type=="feedback") {
    //     data.records[0].note = options.note;
    //     data.records[0].author_nick = options.author_nick;
    // }

    alert(options.type+"/"+options.action);
    current_data = data;
    
    switch(options.type) {
        case "feedback":
            UpdateFeedBack(data);
            break;
        case "bookmark":
            if(options.action=="add") {
                App.onAddBookmark(data, 'updateBookmark');
            } else if(options.action=="edit") {
                App.onUpdateBookmark(data);
                updateBookmark(data);
            } else {
                App.onRemoveBookmark(data.uuid);
                updateBookmark(data);
            }
            break;
        case "highlight":
            
            if(options.action=="add") {
                App.onAddHighlight(data, "UpdateHighlight");
            } else if(options.action=="edit") {
                App.onUpdateHighlight(data);
                UpdateHighlight(data);
            } else if(options.action=="del") {
                App.onRemoveHighlight(data.uuid);
                UpdateHighlight(data);
            }
            break;
    }
}

function updateBookmark(data) {
    switch(current_data.action) {
        case "add":
            alert("add bookmark: "+data);
            var id = bookmarks.length;
            bookmarks.push({
                uuid: data,
                type: current_data.type,
                href: !current_data.cfi?'':current_data.href,
                cfi: !current_data.cfi?'':current_data.cfi,
                is_public: !current_data.is_public?"N":current_data.is_public,
                chapter: current_data.chapter,
                color: current_data.color,
                spine: current_data.spinePos
            });

            $(".bookmark").removeClass("red").removeClass("yellow").removeClass("blue").addClass(current_data.color);

            break;
        case "edit":
            var idx = 0;
            for(var i in bookmarks) {
                if(bookmarks[i].uuid==current_data.uuid)
                    bookmarks[i].color = current_data.color;
            }

            $(".bookmark").removeClass("red").removeClass("yellow").removeClass("blue").addClass(current_data.color);

            break;
        case "del":

            this.unHighlightWords(current_data.uuid);

            for(var i in bookmarks) {
                if(bookmarks[i].uuid==current_data.uuid) {
                    bookmarks.splice(i, 1);
                    break;
                }
            }

            if(current_chapter.href==current_data.href)
                $(".bookmark").removeClass(current_data.color);

            break;
    }

    document.querySelector("#selectbookmark").checked = false;
    // renderBookmarkList();
    current_data = null;
}

function GetSelection() {

    var idoc = iframe.contentDocument || iframe.contentWindow.document; // For IE.
    var cfi = new EPUBJS.EpubCFI();
    var rangeToSelect = idoc.getSelection();
    var tr = rangeToSelect.getRangeAt(0);
    var cfiStr = cfi.generateCfiFromRange(range, Book.renderer.currentChapterCfiBase) ;

    if(cfiStr.indexOf("epubcfi(") === 0 && cfiStr[cfiStr.length-1] === ")") {
        cfiStr = cfiStr.slice(8, cfiStr.length-1)
    }

    return { str: cfiStr, range: tr };
}

function UpdateHighlight(data) {
    var idoc = iframe.contentDocument || iframe.contentWindow.document; // For IE.

    switch(current_data.action) {
        case "add":
            alert("add highlight:"+data);
            var id = highlights.length;
            highlights.push({
                uuid: data,
                range: current_data.range,
                highlight_text: current_data.highlight_text,
                chapter: current_data.chapter,
                cfi: current_data.cfi,
                page: current_data.page,
                note: !current_data.note?"":current_data.note,
                href: current_data.href,
                color: current_data.color
            }); 

            HighlightWords(current_data.cfi, current_data.color, data);
            break;
        case "edit":
            var idx = 0;
            for(var i in highlights) {
                if(highlights[i].uuid==current_data.uuid)
                    idx = i;
            }

            if(current_data.is_public=="Y") {
                highlights[idx].is_public = true;
                highlights[idx].nickname = current_data.author_nick;
                highlights[idx].date = moment().format();
                $("#popup3 .nickname").html(current_data.author_nick);
            } else {
                highlights[idx].is_public = false;
            }
            
            var idoc = iframe.contentDocument || iframe.contentWindow.document; // For IE.
            $(idoc.body).find("span#"+current_data.uuid)[0].className = "highlight "+current_data.color;

            break;
        case "del":
            var idx;
            UnHighlightWords(current_data.uuid);

            for(var i in highlights) {
                if(highlights[i].uuid==current_data.uuid) {
                    highlights.splice(i, 1);
                    break;
                }
            }
            $(idoc.body).unhighlight();
            for(var i in highlights) {
                if(highlights[i].href==Book.renderer.currentChapter.href) {
                    HighlightWords(highlights[i].cfi, highlights[i].color, i);
                }
            }
            break;
    }
    
    if(callNote) App.onAnnotateHighlight(current_data.uuid);

    callNote = false;
    current_data = null;
    closeContextMenu();
}

function UnHighlightWords(uuid) {
    console.log("UnHighlightWords: "+uuid);
    var idoc = iframe.contentDocument || iframe.contentWindow.document; // For IE.
    var span =  $(idoc.body).find("span#"+uuid);

    span.replaceWith(span.html());
}

function HighlightWords(content, color, uuid) {
    console.log("HighlightWords: "+content+", "+color+", "+uuid);

    var idoc = iframe.contentDocument || iframe.contentWindow.document; // For IE.
    var cfi = new EPUBJS.EpubCFI();
    var range = cfi.generateRangeFromCfi(content,idoc);
    var span = document.createElement("span");

    span.id = uuid;
    span.setAttribute("class","highlight "+color);
    // span.setAttribute("id",uuid);
    range.surroundContents(span);

    span.onclick = function() {
        for(var i in highlights) {
            if(highlights[i].uuid == this.id) 
            current_data = highlights[i];
        }
        
        console.log(current_data);

        $("#bookline").find("input[name='bookcolor']").removeAttr("checked");
        $("#bookline").find("input[value='"+current_data.color+"']")[0].checked = true;
        $("#bookline").find(".del").removeClass("hidden");
        $("#bookline").addClass("show");
    }
}
function closeContextMenu() {
    var idoc = iframe.contentDocument || iframe.contentWindow.document; // For IE.
    var selection = idoc.getSelection();
    selection.removeAllRanges();

    if($("input[name='bookcolor']:checked").length)
        $("input[name='bookcolor']:checked")[0].checked = false;

    $("#bookline").removeClass("show");
}

function guid() {
  function s4() {
    return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
  }
  return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
}

function renderBookmark(data) {
    alert("bookmarks: "+data.length);
    bookmarks = data;
}

function renderHighlight(data) {
    alert("highlights: "+data.length);
    highlights = data;
}

function SetBookmark() {
    $(".bookmark").removeClass("red");
    $(".bookmark").removeClass("yellow");
    $(".bookmark").removeClass("blue");
    
    for(var i in bookmarks ) {
        var item = bookmarks[i];
        if(current_chapter.id==item.id) {
            $(".bookmark").addClass(item.color);
        }
    }
}

function getTOC(ary, href) {
    var r = 0;

    for(var i in ary) {
        var item = ary[i];
        if( item.href==href ) {
            r = item;
            break;
        }

        if( item.subitems.length ) {
            r = getTOC(item.subitems, href);
            if(r!=0) break;
        }
    }

    return r;
}

function submitKeyword(value) {
    search_index++;
    keyword = value;
    var result_container = $("#search-result");
    var spine = Book.spine[search_index];
    // debugger;
    if(search_index+1>Book.spine.length) {
        
        console.log(search_result);

        if(!search_result.length) {
            result_container.find(".title").html("共搜尋到 0 筆");
        } else {
            result_container.find(".title").html('共搜尋到 <span class="num">'+this.search_result.length+'</span> 筆');
            $.each(this.search_result, function(k, v){
                var li;
                // if(!$("a[data-href='"+v.data.cfi+"']").length) {
                //     $.each(toc, function(k2,v2){
                //         if(v.data.href==v2.href)
                //             li = $("<li/>").html("<a data-href='"+v.data.cfi+"'>"+v2.label+"</a>").append(
                //                 $("<ul/>").addClass("list show")
                //             );
                //     });
                // } else {
                    
                // }
                li = $("a[data-href='"+v.data.cfi+"']:eq(0)").parents("li");
                li.find("ul.list").append(
                    $("<li/>").html("<a data-href='"+v.data.cfi+"'>"+v.text+"</a>")
                );
                li.highlight(val);
                result_container.append(li);
            });
        }
    } else {
        $.ajax({
            url: spine.url,
            data: "json"
        }).done(function(r){
            var doc = $.parseXML(r);
            searchWord($(doc.body), val, spine);
            submitKeyword(val);
        });
    }
}
function searchWord(elm, val, data) {
    console.log("searchWord");
    elm.children().each(function(){
        if(this.children.length) {
            searchWord($(this), val, data);
        } else {
            var pos = this.innerHTML.search(val);

            if(pos>-1) {
                search_result.push({
                    pos: pos, data: data, text: this.innerHTML
                });
            }
        }
    });

    return;
}