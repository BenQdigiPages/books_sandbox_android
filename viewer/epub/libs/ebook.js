var startTime = Date.now();
var processFlag = 0 ;
var storedSelections = [];
var baseCfi ='';
var bConsoleVis = true;
var bShowConsoleLog = true;
var bShowTouchEvent = true;
var bOnlyShowStartAndEnd = false;
var cfis = [];
var currentPage;

function eBook(tag, options) {
    this.options = $.extend({
        key: null,
        url: "../books/benchmark/real_file/Orig/sample_reflowable_002/"
    },options);
    // html tags
    this.container = $(tag);
    this.b_t = $("header title"); // book_title
    this.b_a = $("#book_area"); // book_area
    this.host = window.location.host+"/ebookviewer";
    this.navbar = this.container.find('.reader');
    this.menu_trigger = this.container.find(".btn-menu");
    this.slider = $("#paginate")[0];
    // Data
    this.bookmark = [];
    this.score_list = [];
    this.hot_score = [];
    this.notes = [];
    this.annotate = {};
    this.key = this.options.key;
    this.total_pages = 0;
    this.has_subitem = false;
    this.sub_index = 0;
    this.count_page = false;
    this.current_page = 1;
    this.current_chapter = 0;
    this.last_page = 0;
    this.search_result = [];
    this.go_progress = false;
    this.search_index = 0;
    this.search_string = "";
    this.layout = "double";
    this.loader = [];
    this.load_setting = false;
    this.is_loading = true;
    this.loading_index = 0;
    this.navbar_toggle = false;
    this.mouse_move = false;
    this.mouse_down = false;
    this.mouse_down_info = null;
    this.has_selection = false;
    this.prev = $(".arrow_icon1, .arrow_1");
    this.next = $(".arrow_icon2, .arrow_2");
    this.font  = { size: "16px", line: "20px"};
    this.current_color = 0;
    this.light_mouse_down = false;
    this.current_font = this.font;
    this.current_scroll;
    this.scale_ary = [ 0.6, 0.8, 1.0, 1.2, 1.4];
    this.current_scale = 2;

    var _this = this;

    this.menu_trigger.click($.proxy(this._OpenMenu,this));
    this.container.click($.proxy(this._CloseMenu,this));

    $("header a").click(function(){
        if(!$(this).data("target")==false)
            $($(this).data("target")).show();
    });

    $(".color-selector").change(function(){
        var ul = $(this).next("ul.list");
        if(this.value=="") {
            ul.find("li:hidden").show();
        } else {
            ul.find("li").show();
            ul.find("li:not(."+this.value+")").hide();
        }
    });

    $(".big").click(function(){
        $(this).toggleClass("active");
        var elem = document.getElementById('player');;
        if($(this).hasClass("active")) {
            if (elem.requestFullscreen)
                elem.requestFullscreen();
            else if (elem.msRequestFullscreen)
                elem.msRequestFullscreen();
            else if (elem.mozRequestFullScreen)
                elem.mozRequestFullScreen();
            else if (elem.webkitRequestFullScreen)
                elem.webkitRequestFullScreen();
        } else {
            if (document.cancelFullScreen)
                document.cancelFullScreen();
            else if (elem.msRequestFullscreen)
                document.msCancelFullscreen();
            else if (elem.mozRequestFullScreen)
                document.mozCancelFullScreen();
            else if (elem.webkitRequestFullscreen)
                document.webkitCancelFullScreen();
        }
    });

    $("input[name='menu_like']").change(function(){
        _this._AddMark($("input[name='menu_like']:checked").val());
    });

    $(".accordings > .according-head").click(function(){
        var href= $(this).data("target");
        if( $(this).data("type")=="according" ) {
            if($(this).find(".arrow").hasClass("fa-chevron-up")) {
                $(this).find(".arrow").addClass("fa-chevron-down").removeClass("fa-chevron-up");
                $(href).removeClass("show").slideUp();
            } else {
                $(this).find(".arrow").removeClass("fa-chevron-down").addClass("fa-chevron-up");
                $(href).slideDown().addClass("show").siblings(".according-body:visible").slideUp().removeClass("show")
                    .prev().find(".arrow").removeClass("fa-chevron-up").addClass("fa-chevron-down");
            }
        } else if($(this).data("type")=="modal") {
            _this._OpenModal(href);
        }
    });
    $("#note button.save").click(function(){
        _this._UpdateNote();
    });

    $("#menu_list").on("click","a",function(e){
        if($(this).hasClass("toggle")) {
            if($(this).hasClass("open"))  $(this).siblings("ul.list").slideUp();
            else $(this).siblings("ul.list").slideDown();

            $(this).toggleClass("open").find("i").toggleClass("fa-angle-down");
        } else {
            _this.current_page = $(this).data("page");
            Book.goto($(this).data("href"));
            $("#menu_list").hide();
        }
    });
    $("#delete").on("click","button[type='submit']", function(){
        var type =  $("#delete").find("input[name='type']").val();
        var idx =  $("#delete").find("input[name='index']").val();
        if(type=="mark") _this._DeleteMark(idx);
        if(type=="score") _this._DeleteScore(idx);
        if(type=="annotate") _this._DeleteAnnotate();

        $("#delete").find("em").not(".hidden").addClass("hidden");
        $("#delete").hide();
    });

    $("#mark-list").on("click","span",function(e){
        if( !$(this).data("href")==false ) {
            var href = $(this).data("href");
            _this.count_page = true;
            Book.goto(href);
        }
    }).on("click",".fa-trash-o",function(e){
        var idx = $("#mark-list li").index($(this).parents("li"));
        $("#delete").find("input[name='type']").val("bookmark").end()
            .find("input[name='index']").val(idx).end()
            .find("em.mark").removeClass("hidden").end()
            .show();
    });

    $("#notes").on("click","i.fa-star-o",function () {
        var li = $(this).parents("li");
        var idx = $("#notes li").index(li);
        _this._LikeHotFeedBack(li, idx-1);
    }).on("click","a",function(){
        var li = $(this).parents("li");
        var idx = $("#notes li").index(li);
        _this._ShowNote(idx);
    });

    $("#keywords").keydown(function(e){
        if(e.keyCode==13) {
            _this.search_string = this.value;
            _this.search_result = [];
            _this.search_index = 0;
            // $("#submit").hide();
            // $("#reset").show();
            $("#search-result").find(".title").html("搜索中...");
            _this._SubmitKeyword(this.value);
        }
    });
    $("#submit").click(function(){
        _this.search_string = $("#keywords").val();
        _this.search_result = [];
        _this.search_index = 0;
        var idoc = _this.iframe.contentDocument || _this.iframe.contentWindow.document; // For IE.
        $(idoc.body).unhighlight();
        // $("#submit").hide();
        // $("#reset").show();
        $("#search-result").find(".title").html("搜索中...");
        _this._SubmitKeyword($("#keywords").val());
    });
    $("#reset").click(function(){
        _this.search_string = "";
        _this.search_result = [];
        _this.search_index = 0;
        $("#submit").show();
        $("#reset").hide();
        $("#search-result").empty();
    });
    $("#search-result").on("click","a", function(){
        Book.displayChapter($(this).data("href"));
    });
    $("#popup3").find("input").change(function(){
        if(this.name=="update" && this.checked)
            _this._UpdateScore();
        if(this.name=="publish" && this.checked)
            _this._PublishScore();
    }).find("i.fa-trash-o").click(function(){
        _this._DeleteScore();
    });

    $("#popup2").find("input").change(function() {
        if(this.name=="update" && this.checked)
            _this._UpdateAnnotate();
        if(this.name=="publish" && this.checked)
            _this._PublishAnnotate();
    }).find(".fa-trash-o").click(function(){
        $("#delete").find("input[name='type']").val("annotate").end()
            .find("input[name='index']").val(0).end()
            .find("em.annotate").removeClass("hidden").end()
            .show();
    });

    $("input[name='bookcolor']").change(function(){
        _this._SetScore($("input[name='bookcolor']:checked").val(), false);
    })
    $("#bookline").on("click","a",function(){
        _this._SetScore("green",true);
    });
    $("#bookline").find(".fa-times").click(function(){
        _this._closeContextMenu();
    });
    // 樣式調整
    $("#lighting").mousedown(function(){
        _this.light_mouse_down = true;
    });
    $("#lighting").change(function(){
        var num = (100-this.value)/100;
        $("#window-light").css("opacity",num);
    })
    $("#lighting").mousemove(function(){
        if(_this.light_mouse_down) {
            var num = (100-this.value)/100;
            $("#window-light").css("opacity",num);
        }
    });
    $("#lighting").mouseup(function(){
        _this.light_mouse_down = false;
    });
    $("a[name='font']").click(function(){
        _this._SetFontSize(this.className);
    });
    $("input[name='view']").change(function(){
        _this._SetLayout($("input[name='view']:checked").val());
    });
   $("input[name='color']").click(function(){
        _this._SetTheme($("input[name='color']:checked").val());
    });
    $("#score-list").on("click","span",function(){
        if(!$(this).data("href")==false) {
            var href = $(this).data("href");
            Book.displayChapter($(this).data("href"));
        }
    }).on('click',".fa-trash-o", function(){
        var idx = $("#score-list").find("li").index($(this).parents("li"));
        $("#delete").find("input[name='type']").val("score").end()
            .find("input[name='index']").val(idx).end()
            .find("em.score").removeClass("hidden").end()
            .show();
    }).on("change","input",function(){
        var idx = $("#score-list").find("li").index($(this).parents("li"));
        if(this.name=="update" && this.checked)
            _this._UpdateScore(idx+1);
        if(this.name=="publish" && this.checked)
            _this._PublishScore(idx+1);
    }).on("keypress","textarea",function () {
        $(this).parents("li").find("input[name='update']")[0].checked = false;
    });
    this._renderBook();
}

eBook.prototype = {
    _GetBookInfo: function() {
        var data = {};
        data.book_uni_id = 0;
        data.cms_token = 'guest_fjadsioffkladsjfl';
        $.get("http://bookapi.booksdev.benqguru.com:8080/V1.1/CMSAppApi/BookInfo",data,function(r){
            $(".bookTitle").html(r.c_title);
            $(".creator").html(r.author);
            $(".publisher").html(r.publisher_title);
            $(".edition").html(r.edition);
            $(".identifier").html(r.isbn);
            $(".format").html(r.book_format);
            $(".pubdate").html(r.publish_date);
        });
    },
    _GetHotScore: function () {
        var _this = this;
        var data = {};
        // data.last_updated_time = moment().format();
        data.book_uni_id = 0;
        data.version = 0;
        data.offset = 0;
        data.page_size = 100;
        data.cms_token = 'guest_fjadsioffkladsjfl';

        $.get("http://bookapi.booksdev.benqguru.com:8080/V1.1/CMSAppApi/ListHotBookHighLight",data,function(r){
            console.log(r," - 取得熱門畫線");
            if(r.records.length){
                _this.hot_score = r.records;
                _this._RenderHotScore();
            } else {
                $("#notes .no").addClass("show");
            }
            _this._GetHotFeedback();
        },"json");
    },
    _RenderHotScore: function () {
        $("label[for='operate5']").find(".num").html(this.hot_score.length);
        $("#hot-score").find("li:lt(1)").remove();
        $.each(this.hot_score, function (k, v) {
            var li = $("#hot_score_temp > li").clone();
            li.find("strong").after(v.text);

            $("#hot-score").append(li);
        });
    },
    _GetHotFeedback: function () {
        var _this = this;
        var data = {};
        // data.last_updated_time = moment().format();
        data.book_uni_id = 0;
        data.offset = 0;
        data.page_size = 100;
        data.cms_token = 'guest_fjadsioffkladsjfl';

        $.get("http://bookapi.booksdev.benqguru.com:8080/V1.1/CMSAppApi/ListHotBookFeedBack",data,function(r){
                console.log(r," - 取得熱門心得");
                if(r.records.length){
                    _this.notes = r.records;
                    _this._RenderHotFeedBack();
                } else {
                    $("#notes .no").addClass("show");
                }
        },"json");
    },
    _RenderHotFeedBack: function () {
        $("label[for='operate6']").find(".num").html(this.notes.length);
        $("#notes").find("li:lt(1)").remove();
        $.each(this.notes, function (k, v) {
            var li = $("#hot_feedback_temp > li").clone();
            li.attr({
                "data-uuid": v.uuid,
                "data-book_format": v.book_format,
                "data-book_uni_id": v.book_uni_id,
                "data-updated_time": v.updated_time
            }).find("strong.nickname").html("暱稱："+v.author_nick).end()
                .find("i.fa-star-o").html(v.like).end()
                .find("a strong").after(v.note);
            if(v.like_status) {
                li.find("i.fa-star-o").removeClass("fa-star-o").addClass("fa-star");
                li.find("input[name='like']")[0].checked = true;
            }
            $("#notes").append(li);
        });
    },
    _LikeHotFeedBack: function (li, idx) {
        var likes = Number(li.find("i.fa-star-o").html());
        var data = {};
        data.records.uuid = li.data("uuid");
        data.records.type = "feedback";
        data.records.action = "edit";
        data.records.book_format = li.data("book_format");
        data.records.book_uni_id = li.data("book_uni_id");
        data.cms_token = 'guest_fjadsioffkladsjfl';

        $.get("http://bookapi.booksdev.benqguru.com:8080/V1.1/CMSAppApi/LikeHotBookFeedBack",data,function(r){
            if( !r.result ) {
                alert("按讚失敗！");
            } else {
                _this.notes[idx].like = likes+1;
                _this.notes[idx].like_status = true;
                li.find("i.fa-star-o").addClass("fa-star").removeClass("fa-star-o").html(likes+1);
            }
        },"json");
    },
    _GetReadProgress: function() {
        var _this = this;
        var data = {};
        data.book_uni_id = 1;
        $.get("http://bookapi.booksdev.benqguru.com:8080/V1.1/CMSAppApi/BookReadProgress", data,function(r){
            _this.count_page = true;
            Book.displayChapter(r.bookmark);
        },"json");
    },
    _SaveReadProgress: function() {
        if(!Book.renderer.currentChapter.cfi) return false;
        var _this = this;
        var data = {};
        var cfi = Book.renderer.currentChapter.cfi.split(/[(|)]/g);
        data.book_uni_id = 1;
        data.bookmark = cfi[1];
        data.percentage = Math.floor(this.current_page/this.total_pages*100);
        data.cms_token = 'guest_fjadsioffkladsjfl';

        $.post("http://bookapi.booksdev.benqguru.com:8080/V1.1/CMSAppApi/BookReadProgress", data,function(r){
            if(!r.result) console.log("儲存進度失敗，錯誤內容："+r['􏰊􏱒􏱒􏰌􏱒􏱕􏳋􏰊􏱺􏱺􏰇􏰉􏰊error_message']);
            else console.log("儲存進度成功");
        },"json");
    },
    _GetMemberReadSetting: function() {
        var _this = this;
        var data = {};
        data.cms_token = 'guest_fjadsioffkladsjfl';

        // $.get("http://bookapi.booksdev.benqguru.com:8080/V1.1/CMSAppApi/MemberReadSetting", data,function(r){
        //     if(!r['error_code']) {
        //         _this.load_setting = true;
        //         var layout = r.page_view=="dual_page"?"double":"single";
        //         _this._SetLayout(layout);
        //         _this._SetFontSize(r.font_size);
        //         $("input[name='view']").removeAttr("checked");
        //         $("input[value='"+layout+"']")[0].checked = true;
        //         console.log("樣式讀取成功");
        //     } else {
        //         console.log("樣式讀取失敗，錯誤內容："+r['􏰊􏱒􏱒􏰌􏱒􏱕􏳋􏰊􏱺􏱺􏰇􏰉􏰊error_message']);
        //     }
        // },"json");
    },
    _SaveMemberReadSetting: function() {
        var _this = this;
        var data = {};
        data.page_view = this.layout=="double"?"dual_page":"single_page";
        data.font_size = this.current_font.size;
        data.cms_token = 'guest_fjadsioffkladsjfl';

        $.ajax({
            url: "http://bookapi.booksdev.benqguru.com:8080/V1.1/CMSAppApi/MemberReadSetting",
            data: data,
            method: "PUT",
        }).done(function(r){
            if(!r.result) console.log("儲存樣式失敗，錯誤內容："+r['􏰊􏱒􏱒􏰌􏱒􏱕􏳋􏰊􏱺􏱺􏰇􏰉􏰊error_message']);
            else console.log("儲存樣式成功");
        });
    },
    _renderBook: function() {
        var _this = this;
        this._GetBookInfo();

        if(!this.options.key==false) decode = this.options.key;
        // load epub
        this._GetHotScore();
        if(!this.bookmark.length) $("#mark-list .no").addClass("show");
        if(!this.score_list.length) $("#score-list .no").addClass("show");
        if(!this.annotate) $("#annotate-list .no").addClass("show");

        Book = ePub(this.options.url, {
            spreads: false,
            restore: true,
            fixedLayout: true
        });

        Book.renderTo("book_area");

        if(localStorage["cfis"] && JSON.parse(localStorage["cfis"]).length > 0){
            cfis = JSON.parse(localStorage["cfis"]);
        }
        // 設定字體
        Book.setStyle("font-size", this.current_font.size);
        Book.setStyle("line-height", this.current_font.line);
        // 設定上下頁 click 事件
        Book.on("book:ready",function(){
            _this.iframe = _this.b_a.find('iframe')[0];

            _this.prev.click(function(){
                _this.current_page--;
                Book.prevPage();
            });
            _this.next.click(function(){
                if(_this.last_page>0) _this.last_page--;
                else _this.current_page++;
                Book.nextPage();
            });
        });
        // 設定CSS檔
        Book.on('renderer:chapterDisplayed', function(location){
            var idoc = _this.iframe.contentDocument || _this.iframe.contentWindow.document; // For IE.
            var link = document.createElement('link');

            link.setAttribute("rel","stylesheet");
            link.setAttribute("type","text/css");
            link.setAttribute("href","book.css");

            idoc.head.appendChild(link);
        });
        // 取得選取內容
        Book.on('renderer:selected', function(selectedRange){
            var idoc = _this.iframe.contentDocument || _this.iframe.contentWindow.document; // For IE.
            if(_this.navbar_toggle) {
                _this.navbar.removeClass("show");
                _this.navbar_toggle = false;
            }
            if(selectedRange.type!="Range") {
                $('#bookline').hide();
                return;
            }

            range = selectedRange.getRangeAt(0);

            if((range.endOffset - range.startOffset)>0){
                $('#bookline').show();
            }
        });

        // 取得書名
        Book.getMetadata().then(function(){
            $("img.cover").attr("src",Book.cover);
            /*
            $.each(Book.metadata, function(k,v){
                if(k=="identifier") {
                    v = v.split(":");
                    v.reverse();
                    v = v[0];
                }
                $("."+k).html(v);
            });
            */
        });

        Book.on('renderer:locationChanged', function(location){
            if(_this.is_loading) {
                var list = Book.spine;
                var current = Book.renderer.currentChapter;
                var data = list[_this.loading_index];

                if( _this.loading_index<list.length ) {
                    if(current.href==data.href) {
                        var per_page = ($(window).width()>768 && _this.layout=="double")?Math.ceil(current.pages/2):current.pages;
                        _this.loader[_this.loading_index] = {
                            o_p: current.pages,
                            pages: per_page,
                            data: data
                        };
                        _this.total_pages += per_page;
                        $("#index-list").find("a[data-href='"+data.href+"']").attr("data-page",_this.total_pages);
                        _this.loading_index++;
                    }
                    Book.goto(data.href);
                } else {
                    _this.is_loading = false;
                    _this.loading_index = 0;
                    $("#book_loading").fadeOut();
                    $(".total_pages").html(_this.total_pages);
                    _this._RenderSlider();

                    Book.goto(list[0].href);
                }
            } else {
                if(!_this.load_setting) _this._GetMemberReadSetting();
                if(!_this.go_progress) {
                    _this._GetReadProgress();
                } else {
                    var idoc = _this.iframe.contentDocument || _this.iframe.contentWindow.document; // For IE.

                    $(idoc).find("img").click(function(){
                        $.fancybox({
                            padding: 0, href: this.src,
                        });
                    });

                    if( _this.last_page>0 ) _this.next.click();
                    // _this._FindChapter();
                }

                _this._FindChapter();

                if( _this.current_page==1 ) {
                    _this.prev.hide();
                } else if ( _this.current_page==_this.total_pages ) {
                    _this.next.hide();
                } else {
                    _this.next.show();
                    _this.prev.show();
                }
            }
        });

        Book.on('renderer:chapterDisplayed', function(){
            // debugger;
            _this._FindChapter();
        });

        Book.getToc().then(function(toc){
            var tree = _this._RenderIndex(toc, null);
            $("#menu_list ul").append(tree, null);
        });

        Book.on("book:pageChanged",function(location){
            // debugger;
        });
    },
    _RenderIndex: function(ary, parent) {
        var _this = this;
        var ul = $("<ul/>").addClass("list");
        var btn = $("<a/>").addClass("toggle pull-right").html("<i class='fa fa-angle-left'></i>");

        $.each(ary, function(k, v){
            var li = $("<li/>").append(
                $("<a/>",{"data-href":v.href}).html(v.label)
            );
            if( this.subitems.length ) {
                var subitem = _this._RenderIndex(this.subitems);
                li.append(btn).append(subitem);
            }
            ul.append(li);
        });

        return ul;
    },
    _SetSlider: function() {
        var _this = this;
        var total = 0;
        if(this.layout=="scroll") {
            this.total_pages = Book.spine.length;
        } else {
            $.each(this.loader, function(k, v){
                v.pages = ($(window).width()>768 && _this.layout=="double")?Math.ceil(v.o_p/2):v.o_p;
                total += v.pages;
            });
            this.total_pages = total;
        }

        $(".total_pages").html(_this.total_pages);
        $("#paginate").attr("max", this.total_pages);
    },
    _RenderSlider: function() { // 顯示 slider
        var _this = this;

        this.slider.setAttribute("type", "range");
        this.slider.setAttribute("min", 1);
        this.slider.setAttribute("max", this.total_pages);
        this.slider.setAttribute("step", 1);
        this.slider.setAttribute("value", 1);

        this.slider.addEventListener("change", $.proxy(this._ChangePage,this), false);
        this.slider.addEventListener("mousedown", function(){
            this.mouse_down = true;
            $(".page-buble").show();
        }, false);
        this.slider.addEventListener("mousemove", function(){
            if(this.mouse_down) $(".current_page").html(this.value);
        }, false);
        this.slider.addEventListener("mouseup", function(){
            this.mouse_down = false;
            $(".page-buble").hide();
        }, false);
    },
    _ChangePage: function(event) {
        this.current_page = event.target.value;
        var r = this._CountChapter(event.target.value);

        this.current_chapter = r.chapter;
        this.last_page = r.last;

        Book.goto(this.loader[r.chapter].data.href);
    },
    _FindChapter: function() {
        var _this = this,
            type = $(window).width()>768?"desktop":"mobile",
            current = Book.renderer.currentChapter,
            chapter_idx = 0,
            num = 0;

        $.each(this.bookmark, function(k, v){
            if(type==v.type && (v.cfi==current.cfi || v.href==current.href )) {
                $("#bookmark").addClass(v.color);
                $("input[name='menu_like'][value='"+v.color+"']")[0].checked = true;
            } else {
                $("#bookmark").removeClass(v.color);
                $("input[name='menu_like']:checked")[0].checked = false;
            }
        });

        var r = this._CountChapter(this.current_page);
        var label = this._SearchLabel(Book.toc, this.loader[this.current_chapter].data.href);
        var idoc = this.iframe.contentDocument || this.iframe.contentWindow.document; // For IE.

        this.current_chapter = r.chapter;
        $("#paginate").val(this.current_page);

        if(this.layout=="scroll") this._SetScroll();
        if(this.search_string!="" && this.search_string!=null) {
            $(idoc.body).unhighlight();
            $(idoc.body).highlight(this.search_string);
        }
        if(this.score_list.length) {
            for(var i in this.score_list) {
                if(this.score_list[i].href==current.href) {
                    this._HighlightWords(this.score_list[i].range, this.score_list[i].color);
                }
            }
        }
        $("#book-index").find("li").eq(this.current_chapter).addClass("active").siblings(".active").removeClass("active");
        $("#current_chapter").html(label);
        $(".current_page").html(this.current_page);

        if(this.go_progress && !this.is_loading) this._SaveReadProgress();
        if(!this.go_progress && !this.is_loading) this.go_progress = true;
    },
    _SetScroll: function() {
        var _this = this;
        var idoc = this.iframe.contentDocument || this.iframe.contentWindow.document; // For IE.

        if(this.current_page!=0 && this.current_page!=this.total_pages) {
            if(this.current_scroll = 'up')
                idoc.body.scrollTop = idoc.body.scrollHeight-this.b_a.find("iframe").height()-1;
            if(this.current_scroll = 'down')
                idoc.body.scrollTop = 1;
        }

        idoc.addEventListener("scroll",function(e){
            if(this.body.scrollTop<=0) {
                _this.current_scroll = "up";
                _this.prev.click();
            }
            if(_this.b_a.find("iframe").height()+this.body.scrollTop >= this.body.scrollHeight ) {
                _this.current_scroll = "down";
                _this.next.click();
            }
        });
    },
    _CountChapter: function(v) {
        var _this = this,
            val = v,
            pages = 0;
            chapter_idx = 0,
            num = 0;

        $.each(this.loader,function(k, v){
            var p = this.pages;
            pages+=p;

            if(_this.count_page && v.data.href==Book.renderer.currentChapter.href) {
                _this.current_page = pages;
            }

            if( (num+p>=_this.current_page && !_this.count_page) || (_this.count_page && v.data.href==Book.renderer.currentChapter.href) ) {
                chapter_idx = _this.current_page==1?0:k;
                return false;
            } else {
                val -= p;  // 算出章節下還有幾頁
                num += p;  // 算出在哪一章節
            }
        });

        this.count_page = false;

        return {
            chapter: chapter_idx,
            last: val-1
        };
    },
    _SearchLabel: function(ary,href) {
        var _this = this;
        var r = null;
        $.each(ary, function(k, v){
            if(v.href==href) {
                r = v.label;
            } else if(v.subitems.length && _this._SearchLabel(v.subitems, href)) {
                r = _this._SearchLabel(v.subitems, href);
            }
        });

        return r;
    },
    _OpenMenu: function() {
        this.navbar.addClass("show");
        this.navbar_toggle = true;
    },
    _CloseMenu: function(event) {
        if( !this.mouse_down && event.target.tagName!="input" && this.navbar_toggle && !$(event.target).hasClass("btn-menu") && !$(event.target).parents().hasClass("navbar") ) {
            this.navbar.removeClass("show");
            this.navbar_toggle = false;
        }
    },
    _closeContextMenu: function() {
        var idoc = this.iframe.contentDocument || this.iframe.contentWindow.document; // For IE.
        var selection = idoc.getSelection();
        selection.removeAllRanges();

        $("#bookline").removeClass("show");
    },
    _getSelection: function(){
        var idoc = this.iframe.contentDocument || this.iframe.contentWindow.document; // For IE.
        var cfi = new EPUBJS.EpubCFI();
        var rangeToSelect = idoc.getSelection();

        if(!rangeToSelect.rangeCount) return false;

        var tr = rangeToSelect.getRangeAt(0);
        var cfiStr = cfi.generateCfiFromRange(tr, baseCfi) ;

        if(cfiStr.indexOf("epubcfi(") === 0 && cfiStr[cfiStr.length-1] === ")") {
            cfiStr = cfiStr.slice(8, cfiStr.length-1)
        }

        var scfi = cfi.generateCfiFromRangeAnchor(rangeToSelect, baseCfi) ;
        var ecfi = cfi.generateCfiFromRangeExtent(rangeToSelect, baseCfi) ;
        $('#scfi').html('start: ' + scfi);
        $('#ecfi').html('end: ' + ecfi);

        return {str: cfiStr, range:tr };
    },
    _AddMark: function(color) {
        var now = new Date();
        var current = Book.renderer.currentChapter;
        $("#bookmark").addClass(color);

        this.bookmark.push({
            type: $(window).width()>768?"desktop":"mobile",
            cfi: current.cfi,
            color: color,
            href: current.href,
            label: this._SearchLabel(Book.toc, current.href)
        });

        if(this.bookmark.length) {
            $("#mark-list .no").removeClass("show");
            $("label[for='operate3']").find(".num").html(this.bookmark.length);
        }
        $("#menu_like").hide();
        $("input[name='menu_like']:checked")[0].checked = false;
        this._RenderBookmark();
    },
    _DeleteMark: function(idx) {
        this.bookmark.splice(idx-1, 1);
        $("#mark-list").find("li").eq(idx).remove();

        $("label[for='operate3']").find(".num").html(this.bookmark.length);
    },
    _RenderBookmark: function() {
        var ul = $("#mark-list");
        ul.find("li:lt(1)").remove();

        $.each(this.bookmark, function(k, v){
            ul.append(
                $("<li/>").addClass(v.color).append(
                    $("<span/>").addClass("btn").html('<i class="fa fa-trash-o"> 刪除</i>')
                ).append(
                    $("<span/>",{ "data-href": v.href }).html("<strong>章節</strong>"+v.label)
                )
            );
        });
    },
    _SetLayout: function(layout) {
        var _this = this;
        var idoc = this.iframe.contentDocument || this.iframe.contentWindow.document; // For IE.
        this.layout = layout;
        // idoc.removeEventListener("scroll");
        switch(layout) {
            case "single":
                 this.b_a.css({
                    "max-width": 600,
                    marginLeft: "auto",
                    marginRight: "auto"
                });
                break;
            case "double":
                this.b_a.css({
                    "max-width": "none",
                    marginLeft: 20,
                    marginRight: 20
                });
                break;
            case "scroll":
                scollmode = true;
                this.b_a.css({
                    "max-width": 600,
                    marginLeft: "auto",
                    marginRight: "auto"
                });
                this._SetScroll();
                break;
        }

        this._SetSlider();
    },
    _SetTheme: function(theme) {
        var idoc = this.iframe.contentDocument || this.iframe.contentWindow.document; // For IE.
        this.container[0].className = theme;
        switch(theme) {
            case "default":
                Book.setStyle('color', "#000");
                Book.setStyle('background', "#FFF");
                break;
            case "classic":
                Book.setStyle('color', "#5b422a");
                Book.setStyle('background', "#f4efe3");
                break;
            case "night":
                Book.setStyle('color', "rgb(200,200,200)");
                Book.setStyle('background', "rgb(100,100,100)");
                break;
        }
        this.current_color = theme;
    },
    _SetFontSize: function(s) {
        if((this.current_scale+1 == this.scale_ary.length && s=="bigger") || (this.current_scale == 0  && s=="smaller"))
            return false;

        switch(s) {
            case "bigger":
                this.current_scale++;
                var scale = this.scale_ary[this.current_scale];
                this.current_font = {
                    size: (16*scale).toFixed(1)+"px",
                    line: (20*scale).toFixed(1)+"px"
                }
                break;
            case "smaller":
                this.current_scale--;
                var scale = this.scale_ary[this.current_scale];
                this.current_font = {
                    size: (16*scale).toFixed(1)+"px",
                    line: (20*scale).toFixed(1)+"px"
                }
                break;
                break;
        }

        Book.setStyle("font-size", this.current_font.size);
        Book.setStyle("line-height", this.current_font.line);
    },
    _SubmitKeyword: function(val) {
        this.search_index++;
        var _this = this;
        var result_container = $("#search-result");
        var spine = Book.spine[this.search_index];
        // debugger;
        if(this.search_index+1>=Book.spine.length) {
            result_container.find("li:lt(1)").remove();
            if(!this.search_result.length) {
                result_container.find(".title").html("共搜尋到 0 筆");
            } else {
                result_container.find(".title").html('共搜尋到 <span class="num">'+this.search_result.length+'</span> 筆');

                $.each(this.search_result, function(k, v){
                    var li;
                    if(!$("a[data-href='"+v.data.cfi+"']").length) {
                        $.each(Book.toc, function(k2,v2){
                            if(v.data.href==v2.href)
                                li = $("<li/>").html("<a data-href='"+v.data.cfi+"'>"+v2.label+"</a>").append(
                                    $("<ul/>").addClass("list show")
                                );
                        });
                    } else {
                        li = $("a[data-href='"+v.data.cfi+"']:eq(0)").parents("li");
                    }
                    li.find("ul.list").append(
                        $("<li/>").html("<a data-href='"+v.data.cfi+"'>"+val+"</a>")
                    );
                    result_container.append(li);
                });
            }
        } else {
            $.ajax({
                url: spine.url,
                data: "json"
            }).done(function(r){
                var text = $(r).text();
                if($(r).text().search(/\S/g)>-1)
                    _this._SearchWord(text, val, spine);
                _this._SubmitKeyword(val);
            });
        }
    },
    _SearchWord: function(text, val, data) {
        var pos = text.search(val);

        if(pos>-1) {
            this.search_result.push({
                pos: pos, data: data
            });
            var str = text.slice(pos+val.length);
            this._SearchWord(str, val, data);
        }

        return;
    },
    _SetScore: function(color, note) {
        var selection = this._getSelection();
        var idoc = this.iframe.contentDocument || this.iframe.contentWindow.document; // For IE.
        var is_same = false;
        for(i in this.score_list) {
            if(this.score_list[i].cfi==selection.str) is_same = true;
        }
        if( !is_same) {
            this.score_list.push({
                range: selection.range,
                cfi: selection.str,
                href: Book.renderer.currentChapter.href,
                color: !color?"":color
            });

            if( note ) {
                var r_content = selection.range.cloneContents();
                var r_content = r_content.textContent.replace(/\n/g,"");
                $("#popup3").find(".page").text(this.current_page).end()
                    .find(".chapter_info").text(r_content).end()
                    .find("input").val(this.score_list.length-1).end()
                    .fadeIn();
            } else {
                this._RenderScore();
            }

            this._HighlightWords(selection.range, color);
            this._closeContextMenu();
        }
    },
    _HighlightWords: function(content, color) {
        var idoc = this.iframe.contentDocument || this.iframe.contentWindow.document; // For IE.
        var r_content = content.cloneContents();
        var r_content = r_content.textContent.split(/\n/g);
        var h_ary = [];
        for(var i in r_content) {
            if(r_content[i].search(/\s/g)>-1) {
                var temp = r_content[i].split(/\s/g);
                for(var j in temp) {
                    if(temp[j]!="") h_ary.push(temp[j]);
                }
            } else {
                h_ary.push(r_content[i]);
            }
        }
        $(idoc.body).highlight(h_ary,{ className: "highlight "+color });
    },
    _RenderScore: function() {
        if( this.score_list.length ) $("#score-list .no").removeClass("show");
        else  $("#score-list .no").addClass("show");

        var ul = $("#score-list");
        ul.find("li:lt(1)").remove();

        var edit = $("<label/>").append('<input type="checkbox" name="update">').append('<i class="fa fa-pencil"> <b>已</b>儲存編輯</i>');
        var publish = $("<label/>").append('<input type="checkbox" name="publish">').append('<i class="fa fa-folder-o"> <b>已</b>公開</i>');
        var del = '<i class="fa fa-trash-o"> 刪除</i>';
        var s_fb = $("<a/>",{
            href: "https://www.facebook.com/sharer/sharer.php?u=http%3A%2F%2Fwww.books.com.tw&t=",
            target: "_blank", title: "Share on Facebook",
            onclick: "window.open('https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(document.URL) + '&t=' + encodeURIComponent(document.URL)); return false;"
        }).html('<i class="fa fa-facebook-square fa-2x"></i>');
        var s_twitter = $("<a/>",{
            href: "https://twitter.com/intent/tweet?source=http%3A%2F%2Fwww.books.com.tw&text=:%20http%3A%2F%2Fwww.books.com.tw",
            target: "_blank", title: "Tweet",
            onclick: "window.open('https://twitter.com/intent/tweet?text=' + encodeURIComponent(document.title) + ':%20' + encodeURIComponent(document.URL)); return false;"
        }).html('<i class="fa fa-twitter-square fa-2x"></i>');
        var s_gplus = $("<a/>",{
            href: "https://plus.google.com/share?url=http%3A%2F%2Fwww.books.com.tw",
            target: "_blank", title: "Share on Google+",
            onclick: "window.open('https://plus.google.com/share?url=' + encodeURIComponent(document.URL)); return false;"
        }).html('<i class="fa fa-google-plus-square fa-2x"></i>');
        var s_mail = $("<a/>",{
            href: "mailto:?subject=&body=:%20http%3A%2F%2Fwww.books.com.tw",
            target: "_blank", title: "Email",
            onclick: "window.open('mailto:?subject=' + encodeURIComponent(document.title) + '&body=' +  encodeURIComponent(document.URL)); return false;"
        }).html('<i class="fa fa-envelope-square fa-2x"></i>');

        $.each(this.score_list, function(k, v){
            var str = v.range.commonAncestorContainer.textContent?v.range.commonAncestorContainer.textContent:v.range.commonAncestorContainer.innerText;
            var li = $("<li/>",{ class: v.color }).append(
                $("<span/>",{ "data-href": v.cfi }).append("<strong>畫線</strong>").append(str)
            ).append(
                $("<span/>").append("<strong>筆記</strong>").append("<textarea name='content'></textarea>")
            ).append(
                $("<span/>",{ class:"btn" })
                    .append(del).append(edit).append(publish)
                    .append(s_fb).append(s_twitter).append(s_gplus).append(s_mail)
            );
            ul.append(li);
            if( !v.note==false ) li.find("textarea")[0].value = v.note;
        });

        $("label[for='operate1']").find('.num').html(this.score_list.length);
    },
    _UpdateScore: function(idx) {
        if(!idx && idx !=0) {
            var idx = $("#popup3").find("input").val();
            this.score_list[idx].note = $("#popup3").find("textarea")[0].value;
        } else {
            this.score_list[idx].note = $("#score-list li").eq(idx).find("textarea")[0].value;
        }
        this._RenderScore();
    },
    _PublishScore: function(idx) {
        if(!idx) $("#popup3").find("input[name='index']").val();
        var nickname = prompt("暱稱");
        var now = new Date();
        if (nickname != null) {
            this.score_list[idx].nickname = nickname;
            this.score_list[idx].date = now.getFullYear()+"/"+(now.getMonth()+1)+"/"+now.getDate();
            $("#popup3 .nickname").html(nickname);
        } else {
            return false;
        }
    },
    _DeleteScore: function(idx) {
        if(!idx) var idx = $("#popup3").find("input[name='index']").val();
        $("#score-list").find("li").eq(idx).remove();
        this.score_list.splice(idx, 1);
        $("label[for='operate1']").find('.num').html(this.score_list.length);
    },
    _DeleteAnnotate: function() {
        this.annotate = null;
    },
    _UpdateAnnotate: function() {
        this.annotate.content = $("#popup2").find("textarea")[0].value;
    },
    _PublishAnnotate: function() {
        var nickname = prompt("暱稱");
        var now = new Date();
        if (nickname != null) {
            this.annotate.nickname = nickname;
            this.annotate.date = now.getFullYear()+"/"+(now.getMonth()+1)+"/"+now.getDate();
            $("#popup2 .nickname").html(nickname);
        } else {
            return false;
        }
    },
    _ShowNote: function(idx) {
        var data = this.notes[idx];
        var time = data.updated_time.split("T");

        $("#popup1").find(".nickname").html(data.author_nick).end()
            .find(".date").html(time[0]).end()
            .find(".content").html(data.note).end()
            .show();
    }
};

function xor_string(str, key) {
    var xored = "";
    var keys = key.split("");
    var key_length = keys.length;

    // str = Base64.decode(str);
    for (i = 0; i < str.length; i++) {
        var key_index = i - (parseInt(i / key_length, 10) * key_length);
        //var destr = String.fromCharCode(keys[key_index] ^ str.charCodeAt(i));
        var destr = String.fromCharCode(keys[key_index] ^ str.charCodeAt(i));
        // destr = Base64.decode(destr);
        xored = xored + stringToHex(destr);
        // console.log('index:', i,
        //     'enStr:', str.charAt(i), 'd2hStrCode:', d2h(str.charCodeAt(i)),
        //     'key:', keys[key_index],
        //     'result:', destr, 'hexResult:', stringToHex(destr));
    }

    return hexToString(xored);
}


function d2h(d) {
    return d.toString(16);
}

function h2d(h) {
    return parseInt(h, 16);
}

function stringToHex(tmp) {
    var str = '',
        i = 0,
        tmp_len = tmp.length,
        c;

    for (; i < tmp_len; i += 1) {
        c = tmp.charCodeAt(i);
        str += d2h(c) + ' ';
    }
    return str;
}

function hexToString(tmp) {
    var arr = tmp.split(' ');

    var str = '',
        i = 0,
        arr_len = arr.length,
        c;

    for (; i < arr_len; i += 1) {
        c = String.fromCharCode(h2d(arr[i]));
        str += c;
    }

    return str;
}
function getBinary(file){
    var xhr = new XMLHttpRequest();
    xhr.open("GET", file, false);
    xhr.overrideMimeType("text/plain; charset=x-user-defined");
    xhr.send(null);
    return xhr.responseText;
}

function base64Encode(str) {
    var CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    var out = "", i = 0, len = str.length, c1, c2, c3;
    while (i < len) {
        c1 = str.charCodeAt(i++) & 0xff;
        if (i == len) {
            out += CHARS.charAt(c1 >> 2);
            out += CHARS.charAt((c1 & 0x3) << 4);
            out += "==";
            break;
        }
        c2 = str.charCodeAt(i++);
        if (i == len) {
            out += CHARS.charAt(c1 >> 2);
            out += CHARS.charAt(((c1 & 0x3)<< 4) | ((c2 & 0xF0) >> 4));
            out += CHARS.charAt((c2 & 0xF) << 2);
            out += "=";
            break;
        }
        c3 = str.charCodeAt(i++);
        out += CHARS.charAt(c1 >> 2);
        out += CHARS.charAt(((c1 & 0x3) << 4) | ((c2 & 0xF0) >> 4));
        out += CHARS.charAt(((c2 & 0xF) << 2) | ((c3 & 0xC0) >> 6));
        out += CHARS.charAt(c3 & 0x3F);
    }
    return out;
}
(function($) {
    'use strict';
    $.fn.eBook = function(options) {
        var _self = $(this);
        var conf = {
            name: "uploder",
            multiple: false
        };
        var settings = $.extend(conf, options);

        return this.each(function() {
            var book = new eBook(_self, settings);
        });
    }
})(jQuery);
