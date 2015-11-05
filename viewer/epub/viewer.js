var Viewer = {};
var is_loading = true;
var loading_index = 0;
var currentPage = 0;
var total_pages = 0;
var iframe;
var highlights = [];
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
    UpdateBookNote({
        type: "bookmark",
        chapter: current_chapter.spinePos,
        cfi: current_chapter.cfi,
        href: current_chapter.href,
        page: current_page,
        color: $(this).parent("li")[0].className,
        action: "add"
    });
});

$("input[name='bookcolor']").change(function(argument) {
    setHighlight($("input[name='bookcolor']:checked").val());
});

$("#bookline").on("click","a.note",function(){
    if(!current_highlight) {
        callNote = true;
        setHighlight("red");
    } else {
        App.onAnnotateHighlight(current_highlight.uuid);
    }
}).on("click","a.share", function(){
    App.onShareHighlight(current_highlight.uuid);
}).on("click",".fa-times", function(){
    closeContextMenu();
});

$("#popup3").find("input[name='update']").click(function(){
    $("#popup3").hide();
});

Viewer.loadBook = function(url, legacy) {
    App.onToggleToolbar(false);
    toolbar = false;
    alert("loadBook: "+url+", legacy: "+legacy);
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
    if (isIOSDevice || isAndroidDevice) {
        return ["single", "side_by_side"];
    }
    return ["single", "side_by_side", "continuous"];
};

///
/// Get current page layout mode
///
/// @mode: string - either "single", "side_by_side" or "continuous"
///
Viewer.getLayoutMode = function(mode) {
    alert("getLayoutMode: "+mode);
    if(mode=="continuous") {
        layout = "scroll";
        scollmode = true;
    } else {
        layout = (mode=="single")?"single":"double";
    }
    SetLayout();
};


///
/// Set page layout mode
///
/// @mode: string - either "single", "side_by_side" or "continuous"
///
Viewer.setLayoutMode = function(mode) {
    alert("setLayoutMode: "+mode);
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
    return ["", Book.renderer.currentChapter.cfi, current_page, total_pages];
};

///
/// Goto the given link in this ebook
///
/// @link: string - target file link (relative to base url)
///
Viewer.gotoLink = function(link) {
    alert("gotoLink"+link);
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
    alert("gotoPosition: "+cfi);
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
    alert("toggleBookmark: "+color);
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
        BookData.bookmark.push(cur);
        $(".bookmark").removeClass('red').removeClass('yellow').removeClass('blue').addClass(color);
    }
//    window.alert("Viewer.toggleBookmark=" + color)
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
//var myElement = document.getElementById('book_container');
//var mc = new Hammer(myElement);
//mc.get('pan').set({ direction: Hammer.DIRECTION_ALL });
//mc.on("panup pandown tap press", function(ev) {
//    if(ev.type=="tap") {
//
//    } else {
//        if( layout!="scroll" || change_page ) return false;
//
//        var scroll = myElement.scrollTop;
//
//        if(ev.type=="panup") { // Down
//            if( scroll+myElement.clientHeight>=myElement.scrollHeight) {
//                window.alert("go next");
//                $(".next_page").click();
//            }
//        } else { // Up
//            if( scroll==0 ) {
//                window.alert("go prev");
//                $(".prev_page").click();
//            }
//        }
//        position = scroll;
//    }
//});

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


        // 設定字體
        SetFont();
        // 設定背景
        SetBackground();
    });
    // 設定CSS檔
    Book.on('renderer:chapterDisplayed', function(location){
        var idoc = iframe.contentDocument || iframe.contentWindow.document; // For IE.
        // var link = document.createElement('link');
        
        // link.setAttribute("rel","stylesheet");
        // link.setAttribute("type","text/css");
        // link.setAttribute("href", host+"/(ROOTVIEWER)/epub/libs/book.css");

        // idoc.head.appendChild(link);

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
        change_page = false;

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
        BookData.toc = RenderToc(toc, null, 0);
        App.onChangeTOC(BookData.toc);
    });
}

function GetReadProgress() {

}

function RenderToc(toc, ary, lv) {
    var result = !ary?[]:ary;

    $.each(toc, function(k,v){
        result.push({
            title: this.label,
            url: this.href,
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
    if(typeof bg == "object") {
        Book.setStyle('background',"rgb("+bg[0]+","+bg[1]+","+bg[2]+")");

        if(bg[0]==255 && bg[1]==255 && bg[2]==255) {
    //        window.alert('default');
            $("#book_container, #book_area").css({"background": "rgb("+bg[0]+","+bg[1]+","+bg[2]+")", 'color':"#fff"});
            Book.setStyle('color',"#000");
        }  
        if(bg[0]==0 && bg[1]==0 && bg[2]==0) {
    //        window.alert('night');
            $("#book_container, #book_area").css({"background": "rgb("+bg[0]+","+bg[1]+","+bg[2]+")", 'color':"#000"});
            Book.setStyle('color',"#FFF");
        }
    } else {
        Book.setStyle('background', bg);
        Book.setStyle('color',"#000");
        $("#book_container, #book_area").css({"background":bg, 'color':"#000"});
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
    if(!current_highlight) {
        var selection = GetSelection();
        var idoc = iframe.contentDocument || iframe.contentWindow.document; // For IE.
        var r_content = selection.range.toString();

        current_highlight_idx = "";
        current_highlight = {
            text: r_content,
            color: "green",
            cfi: selection.str,
            page: current_page,
            range: selection.range
        };
    }

    $("#popup3").find(".page").text(current_highlight.page).end()
        .find(".chapter_info").text(current_highlight.text).end()
        .find("input[name='index']").val(current_highlight_idx).end()
        .find("input[name='uuid']").val(current_highlight.uuid).end()
        .find("input[name='action']").val(current_highlight_idx==""?"add":"edit").end()
        .fadeIn();

    closeContextMenu();
}

function setHighlight(color) {
    alert("start set highlight");
    if( !current_highlight ) {
        var selection = GetSelection();
        var idoc = iframe.contentDocument || iframe.contentWindow.document; // For IE.
        var is_same = false;
        // var r_content = selection.range.cloneContents();
        if(callNote) alert("after add, need onAnnotateHighlight");
        UpdateBookNote({
            type: "highlight",
            chapter: current_chapter.spinePos,
            range: selection.range,
            cfi: selection.str,
            href: Book.renderer.currentChapter.href,
            text: selection.range.toString(),
            page: current_page,
            color: color,
            action: "add"
        });
    } else {
        current_highlight.color = color;
        UpdateBookNote(current_chapter);
    }
}

function UpdateBookNote(options) {
    
    var data = {};
    data.records = [{
            uuid: guid(),
            book_uni_id: "12345",
            version: "V001.01",
            type: options.type,
            href: !options.cfi?'':options.href,
            cfi: !options.cfi?'':options.cfi,
            is_public: !options.is_public?"N":options.is_public,
            action: options.action,
            updated_time: moment().format()
        }];

    if(options.type=="bookmark") {
        data.records[0].chapter = options.chapter;
        data.records[0].color = options.color;
        data.records[0].spine = current_chapter.spinePos;
    }
    if(options.type=="highlight") {
        data.records[0].color = options.color;
        data.records[0].chapter = options.chapter;
        data.records[0].highlight_text = options.text;
        data.records[0].text = !options.note?'':options.note;
    }
    // if(options.type=="feedback") {
    //     data.records[0].note = options.note;
    //     data.records[0].author_nick = options.author_nick;
    // }

    // $.ajax({
    //     url: this.apihost+"/V1.2/CMSAPIApp/MemberEpubBookNote",
    //     type : "POST",
    //     contentType : "application/json" ,
    //     data: JSON.stringify(data),
    //     dataType : "json",
    // }).done(function(ref){
    //     var r = (typeof ref =="string")?JSON.parse(ref):ref;
    //     if(!r.error_code) {
    //         switch(options.type) {
    //             case "feedback":
    //                 $this.updateFeedBack(options);
    //                 break;
    //             case "highlight":
    //                 $this.updateHighlight(options);
    //                 break;
    //             case "bookmark":
    //                 $this.updateBookmark(options);
    //                 break;
    //         }
    //     } else {
    //         console.log(r.error_message);
    //     }
    // });
    
    alert(options.type+"/"+options.action);

    switch(options.type) {
        case "feedback":
            UpdateFeedBack(data);
            break;
        case "bookmark":
            App.onAddBookmark(data, 'updateBookmark');
            break;
        case "highlight":
            // UpdateHighlight(data);
            if(options.action=="add") {
                // alert(App.onAddHighlight);
                alert("call App.onAddHighlight");
                // UpdateHighlight(data);
                App.onAddHighlight(data, UpdateHighlight);
            } else if(options.action=="edit") {
                // App.onUpdateHighlight(data)
                alert(App.onUpdateHighlight);
                UpdateHighlight(data);
            }
            break;
    }
}

function updateBookmark(data) {
    alert("update bookmark");
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
    alert("show highlight");
    var idoc = iframe.contentDocument || iframe.contentWindow.document; // For IE.

    switch(data.action) {
        case "add":
            var id = highlights.length;
            highlights.push({
                id: id,
                uuid: data.uuid,
                range: data.range,
                text: data.text,
                chapter: data.chapter,
                cfi: data.cfi,
                page: data.page,
                note: !data.note?"":data.note,
                href: data.href,
                color: data.color
            });
            HighlightWords(data.cfi, data.color, id);
            break;
        case "edit":
            var idx = data.idx;

            highlights[idx].note = data.note;

            if(data.is_public=="Y") {
                highlights[idx].is_public = true;
                highlights[idx].nickname = data.author_nick;
                highlights[idx].date = moment().format();
                $("#popup3 .nickname").html(data.author_nick);
            } else {
                highlights[idx].is_public = false;
            }
            
            var idoc = iframe.contentDocument || iframe.contentWindow.document; // For IE.
            $(idoc.body).find("span#highlight-"+idx)[0].className = "highlights "+data.color;

            break;
        case "del":
            var idx;
            UnHighlightWords(data.id);

            for(var i in highlights) {
                if(highlights[i].id==data.id) {
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
    
    if(callNote) App.onAnnotateHighlight(data.uuid);

    callNote = false;
    current_highlight = null;
    closeContextMenu();
}

function UnHighlightWords(idx) {
    var idoc = iframe.contentDocument || iframe.contentWindow.document; // For IE.
    var idx = idx;
    var span =  $(idoc.body).find("span#highlight-"+idx);

    span.replaceWith(span.html());
}

function HighlightWords(content, color, idx) {
    var idoc = iframe.contentDocument || iframe.contentWindow.document; // For IE.
    var cfi = new EPUBJS.EpubCFI();
    var range = cfi.generateRangeFromCfi(content,idoc);
    var h = highlights[idx];
    var span = document.createElement("span");

    span.id = "highlight-"+idx;
    span.setAttribute("class","highlight "+color);
    span.setAttribute("data-uuid"," "+h.uuid);
    range.surroundContents(span);

    span.onclick = function() {
        var id = this.id.split("-");
        current_highlight = highlights[id[1]];

        $("#bookline").find("input[name='bookcolor']").removeAttr("checked");
        $("#bookline").find("input[value='"+current_highlight.color+"']")[0].checked = true;
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
    alert("get bookmark 1");
}

function renderBookmark2(data) {
    alert("get bookmark 2");
}

function renderHighlight(data) {
    alert("get heghlight");
}
window.onload = function() {
    App.onRequestHighlights("renderHighlight");
    App.onRequestBookmarks(renderBookmark);
    App.onRequestBookmarks('renderBookmark2');
}
