var toolBarVisible = true,
    thumbnailBarVisible = false,
    currentLayoutMode = "single",
    tmpBookmark = null,
    savedBookmarks = [],
    toc = [], //[HW]
    pdfOutlineArray = null,
    drmFile,
    viewerPageNum = 1,
    $viewerOwl,
    $viewThumbnailOwl;
var DEBUG_CHROME_DEV_TOOL = true;
var DRM = {}; //esther
var downloadlink; //Henry add
var opfFile;  //Henry add
var isTrial = false; //Henry add, for check trial book or not
var direct_reverse = false;  //Henry add, for book direct reverse
var PAGE_DIRECTION_LEFT = 0;
var PAGE_DIRECTION_RIGHT = 1;

var ua = navigator.userAgent;
var isIOSDevice = /iP(hone|od|ad)/g.test(ua);
var isAndroidDevice = /Android/g.test(ua);

var customEventsManager =  {
        "onURLReady"                       : new ViewerObserver(),
        "onAppInitialized"                 : new ViewerObserver(),
        "onDocumentReady"                  : new ViewerObserver(),
        "onMetadataReady"                  : new ViewerObserver(),
        "onOutlineReady"                   : new ViewerObserver(),
        "onOwlLayoutReady"                 : new ViewerObserver(),
        "onThumbnailExternalLinkReady"     : new ViewerObserver(),
        "onFirstPageRendered"              : new ViewerObserver(),
        "onViewerOwlReady"                 : new ViewerObserver(),
        "onThumbnailViewOwlReady"          : new ViewerObserver(),
        "onDelayedPageDIVsReady"           : new ViewerObserver(),
        "onPageDirectionReady"             : new ViewerObserver(),

        doAfterMultiReady     : function customEventsManager_setMultiReady(mulityReadyArray,readyToDo){
            var mulityReadyPromises = [],
                item_name;
            for (var i = 0, len = mulityReadyArray.length; i < len; i++) {
                item_name = mulityReadyArray[i];
                mulityReadyPromises.push(this[item_name].promise);
            }
            Promise.all(mulityReadyPromises).then(readyToDo);
        },
};

var PageAnimation =  {
        // Used for carousel index
        get currentCarouselIndex() {
            return (this._currentCarouselIndex | 0);
        },
        set currentCarouselIndex(val) {
          if (val === undefined || isNaN(val))  {
            return;
          }
          // Correct if reverse direction
          if(direct_reverse) {
              var isTwoPageMode = TwoPageViewMode.active;
              var ModifiedCarouselIndex;
              if(isTwoPageMode) {
                  ModifiedCarouselIndex = Math.floor(this.containerUpperBound/2) - val;
              } else {
                  ModifiedCarouselIndex = this.containerUpperBound - val;
              }
              val = ModifiedCarouselIndex;
          }

          if (TwoPageViewMode.active){
              /*  PATTERN : 
                  _currentCarouselIndex                 :   0    1    2    3    4     5     ...
                  _currentContainerIndex                :   1    3    5    7    9     11    ...
                  pageNumber                            :  []1  2 3  4 5  6 7  8 9   10 11  ...
                  _currentCarouselIndex(single page)    :    0  1 2  3 4  5 6  7 8    9 10  ...
                  _currentContainerIndex(single page)   :    0  1 2  3 4  5 6  7 8    9 10  ... 
              */
              this._currentCarouselIndex = val;
              this._currentContainerIndex = val*2 + 1;
              if (this._currentCarouselIndex == 0){
                  this._currentPageNum = 1;
              } else {
                  this._currentPageNum = this._currentCarouselIndex*2;
              }
          }else {
              /*  PATTERN : 
                  _currentCarouselIndex  : 0 1 2 3 4 5  ...
                  _currentContainerIndex : 0 1 2 3 4 5  ...
                  pageNumber             : 1 2 3 4 5 6  ...
              */
              this._currentCarouselIndex = val;
              this._currentContainerIndex = val;
              this._currentPageNum = this._currentCarouselIndex + 1;
          }
        }, 

        get currentPageNum() {
            return this._currentPageNum;
        },
        set currentPageNum(val) {
            // Dont allow set from here , do nothing
        },

        get nextPageNum() {
            // Check value
            if (TwoPageViewMode.active){
                if(this._currentPageNum === this.containerUpperBound) {
                    return this._currentPageNum;
                }
            } else {
                if(this._currentContainerIndex === this.containerUpperBound) {
                    return this._currentPageNum;
                }
            }
            return (this._currentPageNum + 1);
        },
        set nextPageNum(val) {
            // Dont allow set from here , do nothing
        },

        get totalPageNum() {
            return this._totalPageLength;
        },
        set totalPageNum(val) {
            this.containerUpperBound = val - 1;
            this._totalPageLength = val;
        },

        get gestureX0() {
            return (this._gestureX0 | 0);
        },
        set gestureX0(val) {
          if (val === undefined || isNaN(val)) {
            return;
          }
          this._gestureX0 = val;
        },

        get gestureY0() {
            return (this._gestureY0 | 0);
        },
        set gestureY0(val) {
          if (val === undefined || isNaN(val))  {
            return;
          }
          this._gestureY0 = val;
        },

        getPageDiv     : function PageAnimation_getPageDiv(index){
            //reset current page scale to 1
            if (TwoPageViewMode.active){
                return this.divContainer[index];
            }else {
                return this.divContainer[index].div;
            }
        },
        getCurrentPageDiv     : function PageAnimation_getCurrentPageDiv(){
            return this.getPageDiv(this._currentContainerIndex);
        },

        onAppReady     : function customPageManager_onAppReady(){
            this._currentCarouselIndex = 0;
            this._currentContainerIndex = 0;
            this._currentPageNum = 1;

            // NOTE : We assume the first mode is single
            this.divContainer = PDFViewerApplication.pdfViewer._pages;
            this.stepDelta = 1;

            this.containerUpperBound = PDFViewerApplication.pdfViewer._pages.length - 1;
            this.containerLowerBound = 0;
        },

        // Used for page number
        onBeforePageChange     : function PageAnimation_onBeforePageChange(){
            //[Phoebe]Fix issue #717 Action:LEAVE_PAGE
            App.onTrackAction("LEAVE_PAGE", this._currentPageNum.toString());

            //reset current page scale to 1
            var currentPageDiv = this.getPageDiv(this._currentContainerIndex);
            PageAnimation.applyTransformWithValue(currentPageDiv,{x:0,y:0,scale:1});
        },
        onAfterPageChange     : function PageAnimation_onAfterPageChange(){
            var currentPageDiv;
            var rightPageDiv;

            // Left page
            if(this._currentContainerIndex > this.containerLowerBound) {
                var leftPageDiv = this.getPageDiv(this._currentContainerIndex - this.stepDelta);
            }

            // Current page
            currentPageDiv = this.getPageDiv(this._currentContainerIndex);
            PageAnimation.applyTransformOriginWithString(currentPageDiv,{x:'50%',y:'50%'});

            //[translate][apply]
            this.setPageTranslate(currentPageDiv,0,0);
            this.applyTransform(currentPageDiv);

            // Right page
            if(this._currentContainerIndex < this.containerUpperBound) {
                rightPageDiv = this.getPageDiv(this._currentContainerIndex + this.stepDelta);
            }
        },

        onTwoPageModeToOnePageMode     : function PageAnimation_onTwoPageModeToOnePageMode(){
            this._currentContainerIndex = this._currentContainerIndex - 2;
            this._currentCarouselIndex = this._currentContainerIndex;

            this.divContainer = PDFViewerApplication.pdfViewer._pages;
            this.stepDelta = 1;

            this.containerUpperBound = this._totalPageLength - 1;
            this.containerLowerBound = 0;
        },
        onOnePageModeToTwoPageMode     : function PageAnimation_onOnePageModeToTwoPageMode(){
            //reset current page scale to 1 before change to TwoPageMode
            var currentPageDiv = this.getPageDiv(this._currentContainerIndex);
            PageAnimation.applyTransformWithValue(currentPageDiv,{x:0,y:0,scale:1});

            //[Phoebe]Add for new twoPageViewMode(Page: []1  23  45  67  89 ...)
            var previousCarouselIndex = this._currentCarouselIndex;
            var currentCarouselIndex;
            if (previousCarouselIndex ==0){
                currentCarouselIndex = 0;
                this._currentContainerIndex = 1;
                this._currentPageNum = 1;
            }else{
                this._currentContainerIndex = (previousCarouselIndex % 2) === 0 ? (previousCarouselIndex + 1) : (previousCarouselIndex + 2);
                currentCarouselIndex = Math.ceil(previousCarouselIndex / 2);
                this._currentPageNum = currentCarouselIndex*2;
            }
            this._currentCarouselIndex = currentCarouselIndex;
            
            this.divContainer = TwoPageViewMode.containers;
            this.stepDelta = 2;

            // NOTE : We assume the first mode is single
            this.containerUpperBound = (this.containerUpperBound % 2) === 0 ? (this.containerUpperBound + 1) : (this.containerUpperBound + 2);
            this.containerLowerBound = 1;
        },

        onPrevPage     : function PageAnimation_onPrevPage(){
            //TODO: check ChapterLimit
            if (!canRead()){
               window.alert("此書無法閱讀");
               return;
            }

            var previousPage = this._currentContainerIndex - this.stepDelta;
            if(previousPage < this.containerLowerBound) {
                return;
            }
            hideToolbarAndFooter();

            if(direct_reverse) {
                var isTwoPageMode = TwoPageViewMode.active;
                var ModifiedCarouselIndex;
                if(isTwoPageMode) {
                    ModifiedCarouselIndex = Math.floor(this.containerUpperBound/2) - this._currentCarouselIndex;
                } else {
                    ModifiedCarouselIndex = this.containerUpperBound - this._currentCarouselIndex;
                }
                $viewerOwl.trigger('to.owl.carousel', [ModifiedCarouselIndex + 1,200,true]);
            } else {
                $viewerOwl.trigger('to.owl.carousel', [this._currentCarouselIndex - 1,200,true]);
            }
        },
        onNextPage     : function PageAnimation_onNextPage(){
            if (!canRead()){
               window.alert("此書無法閱讀");
               return;
            }
            var nextPage = this._currentContainerIndex + this.stepDelta;
            if (nextPage > this.containerUpperBound) {
                //Henry add, for intro page
                if(isTrial){
                    $('#popup4').show();
                    //Henry add, hide titlebar and footer when intro page show
                    hideToolbarAndFooter();
                    // When into trail page , we will disable the function of page change by sliding.
                    App.onToggleTouchEnable(false);
                }
                return;
            }
            hideToolbarAndFooter();
            // NOTE : We should use carousel index to trigger carousel
            if(direct_reverse) {
                var isTwoPageMode = TwoPageViewMode.active;
                var ModifiedCarouselIndex;
                if(isTwoPageMode) {
                    ModifiedCarouselIndex = Math.floor(this.containerUpperBound/2) - this._currentCarouselIndex;
                } else {
                    ModifiedCarouselIndex = this.containerUpperBound - this._currentCarouselIndex;
                }
                $viewerOwl.trigger('to.owl.carousel', [ModifiedCarouselIndex - 1,200,true]);
            } else {
                $viewerOwl.trigger('to.owl.carousel', [this._currentCarouselIndex + 1,200,true]);
            }
        },

        gotoPage     : function PageAnimation_gotoPage(targetPageProp){
            if (!canRead()){
               window.alert("此書無法閱讀");
               return;
            }
            var targetCarouselIndex = this._currentCarouselIndex;
            var targetContainerIndex;
            var isTwoPageMode = TwoPageViewMode.active;

            /*  PATTERN : 
                _currentCarouselIndex                 :   0    1    2    3    4     5     ...
                _currentContainerIndex                :   1    3    5    7    9     11    ...
                pageNumber                            :  []1  2 3  4 5  6 7  8 9   10 11  ...
                _currentCarouselIndex(single page)    :    0  1 2  3 4  5 6  7 8    9 10  ...
                _currentContainerIndex(single page)   :    0  1 2  3 4  5 6  7 8    9 10  ... 
            */
            if(targetPageProp.pageNum !== undefined ) {
                if(isTwoPageMode) {
                    targetCarouselIndex = Math.floor(targetPageProp.pageNum / 2);
                    targetContainerIndex = targetCarouselIndex*2 + 1;
                } else {
                    targetCarouselIndex = targetPageProp.pageNum - 1;
                    targetContainerIndex = targetCarouselIndex;
                }
                // Check value
                if(targetContainerIndex < this.containerLowerBound ||
                    targetContainerIndex > this.containerUpperBound) {
                    return;
                }
            }else if(targetPageProp.carouselIndex !== undefined ){
                if(isTwoPageMode) {
                    if(targetPageProp.isIncomingTwoPageMode) {
                        targetCarouselIndex = targetPageProp.carouselIndex;
                    } else {
                        targetCarouselIndex = Math.ceil(targetPageProp.carouselIndex / 2);
                    }
                } else {
                    if(targetPageProp.isIncomingTwoPageMode) {
                        //TODO
                    } else {
                        targetCarouselIndex = targetPageProp.carouselIndex;
                    }
                }
            }
            //hideToolbarAndFooter();  //Fix #2051, manipulate on footer shouldn't hide it, e.g drag
            // NOTE : We should use carousel index to trigger carousel
            if(direct_reverse) {
                var ModifiedCarouselIndex;
                if(isTwoPageMode) {
                    ModifiedCarouselIndex = Math.floor(this.containerUpperBound/2) - targetCarouselIndex;
                } else {
                    ModifiedCarouselIndex = this.containerUpperBound - targetCarouselIndex;
                }
                $viewerOwl.trigger('to.owl.carousel', [ModifiedCarouselIndex,200,true]);
            } else {
                $viewerOwl.trigger('to.owl.carousel', [targetCarouselIndex,200,true]);
            }
        },

        EXCEED_LEFT   : 1,   //0001
        EXCEED_RIGHT  : 1<<1,//0010
        EXCEED_TOP    : 1<<2,//0100
        EXCEED_BOTTOM : 1<<3,//1000
        ALL_MASK : (1 | 1<<1 | 1<<2 | 1<<3),//1111

        PAGE_BOUNDARY : 0.10,
        PAGE_CHANGE_THRESHOLD : 0.03,

        isExceedLeftOrRightPageBoundary	: function PageAnimation_isExceedLeftOrRightPageBoundary(scaleElement) {
            var boundingRect = scaleElement.getBoundingClientRect();
            var leftExceedSpace = Math.abs(boundingRect.left);
            var originalWidth = scaleElement.offsetWidth;
            var totalExceedSpace = Math.abs(boundingRect.width - originalWidth);

            // Right > Left
            if(boundingRect.left > 0) {
                var rightExceedSpace = totalExceedSpace + leftExceedSpace;
                if(rightExceedSpace > ((totalExceedSpace / boundingRect.width ) + this.PAGE_BOUNDARY ) * boundingRect.width) {
                    return this.EXCEED_RIGHT;
                }
            // Left > Right
            } else if (leftExceedSpace > totalExceedSpace){
                if(leftExceedSpace > ((totalExceedSpace / boundingRect.width ) + this.PAGE_BOUNDARY ) * boundingRect.width) {
                    return this.EXCEED_LEFT;
                }
            }
            return 0;
        },

        isExceedTopOrBottomPageBoundary	: function PageAnimation_isExceedTopOrBottomPageBoundary(scaleElement) {
            var boundingRect = scaleElement.getBoundingClientRect();
            var topExceedSpace = Math.abs(boundingRect.top);
            var originalHeight = scaleElement.offsetHeight;
            var totalExceedSpace = Math.abs(boundingRect.height - originalHeight);

            // Bottom > Top
            if(boundingRect.top > 0) {
                var bottomExceedSpace = totalExceedSpace + topExceedSpace;
                if(bottomExceedSpace > ((totalExceedSpace / boundingRect.height ) + this.PAGE_BOUNDARY ) * boundingRect.height) {
                    return this.EXCEED_BOTTOM;
                }
            // Top > Bottom
            } else if (topExceedSpace > totalExceedSpace){
                if(topExceedSpace > ((totalExceedSpace / boundingRect.height ) + this.PAGE_BOUNDARY ) * boundingRect.height) {
                    return this.EXCEED_TOP;
                }
            }
            return 0;
        },

        isExceedLeftOrRightPageChangeThreshold	: function PageAnimation_isExceedLeftOrRightPageChangeThreshold(scaleElement) {
            var boundingRect = scaleElement.getBoundingClientRect();
            var leftExceedSpace = Math.abs(boundingRect.left);
            var originalWidth = scaleElement.offsetWidth;
            var totalExceedSpace = Math.abs(boundingRect.width - originalWidth);

            // Right > Left
            if(boundingRect.left > 0) {
                var rightExceedSpace = totalExceedSpace + leftExceedSpace;
                if(rightExceedSpace > ((totalExceedSpace / boundingRect.width ) + this.PAGE_CHANGE_THRESHOLD ) * boundingRect.width) {
                    return this.EXCEED_RIGHT;
                }
            // Left > Right
            } else if (leftExceedSpace > totalExceedSpace){
                if(leftExceedSpace > ((totalExceedSpace / boundingRect.width ) + this.PAGE_CHANGE_THRESHOLD ) * boundingRect.width) {
                    return this.EXCEED_LEFT;
                }
            }
            return 0;
        },
        setPageTranslate: function PageAnimation_setPageTranslate(scaleElement,savedX,savedY) {
            scaleElement.setAttribute('translate-x', savedX);
            scaleElement.setAttribute('translate-y', savedY);
        },
        getPageTranslate: function PageAnimation_getPageTranslate(scaleElement) {
            var x = (parseFloat(scaleElement.getAttribute('translate-x')) || 0);
            var y = (parseFloat(scaleElement.getAttribute('translate-y')) || 0);
            return {x:x,y:y};
        },
        setPageScale: function PageAnimation_setPageScale(scaleElement,scale) {
            scaleElement.setAttribute('transform-scale', scale);
        },
        getPageScale: function PageAnimation_getPageScale(scaleElement) {
            var scale_string = scaleElement.getAttribute('transform-scale');
            var scale = parseFloat(scale_string);
            if(isNaN(scale)) {
                return 1;
            } else {
                return scale;
            }
        },
        applyTransform: function PageAnimation_applyTransform(scaleElement) {
            var translateValue = this.getPageTranslate(scaleElement);
            var scale = this.getPageScale(scaleElement);

            scaleElement.style.webkitTransform =
            scaleElement.style.transform =
            'translate(' + translateValue.x + 'px, ' + translateValue.y + 'px)' + 'scale(' + scale + ')';
        },
        applyTransformWithValue: function PageAnimation_applyTransformWithValue(scaleElement,transformPacket) {
            var translateValue = this.getPageTranslate(scaleElement);
            var savedScale = this.getPageScale(scaleElement);

            var x;
            var y;
            var scale;

            if(transformPacket.x !== undefined) {
                x = transformPacket.x;
            } else {
                x = translateValue.x;
            }

            if(transformPacket.y !== undefined) {
                y = transformPacket.y;
            } else {
                y = translateValue.y;
            }

            if(transformPacket.scale !== undefined) {
                scale = transformPacket.scale;
            } else {
                scale = savedScale;
            }

            scaleElement.style.webkitTransform =
            scaleElement.style.transform =
            'translate(' + x + 'px, ' + y + 'px)' + 'scale(' + scale + ')';
        },
        applyTransformOriginWithString: function PageAnimation_applyTransformOriginWithString(scaleElement,transformPacket) {
            scaleElement.style.MozTransformOrigin =
            scaleElement.style.webkitTransformOrigin =
            scaleElement.style.transformOrigin =
            transformPacket.x + ' ' + transformPacket.y;
        },

        //[Bruce] interact.js
        callback_interact_gesturable_onstart: function callback_interact_gesturable_onstart(event) {
            // Determining ratio of displayed dimensions to "actual" dimensions
            var scaleElement = event.target;

            //[translate][reset]
            PageAnimation.applyTransformWithValue(scaleElement,{x:0,y:0});

            //************Below is try to get the position of current touch point related to non-transformed div
            var boundingRect = scaleElement.getBoundingClientRect();
            var dimRatio = scaleElement.clientWidth / boundingRect.width;
            //var scale = boundingRect.width / scaleElement.clientWidth;

            //**** (1) Get the touch point related to tranformed div
            //var transfromedX = event.x0 + scaleElement.offsetLeft * scale - boundingRect.left;
            //var transfromedY = event.y0 + scaleElement.offsetTop * scale - boundingRect.top;
            var transfromedX = event.x0 + scaleElement.offsetLeft - boundingRect.left;
            var transfromedY = event.y0 + scaleElement.offsetTop - boundingRect.top;

            //**** (2) Restore to the original coordinate system
            var oriX = transfromedX*dimRatio;
            var oriY = transfromedY*dimRatio;

            PageAnimation.applyTransformOriginWithString(scaleElement,{x:oriX + 'px',y:oriY + 'px'});

            //[translate][restore]
            PageAnimation.applyTransform(scaleElement);
        },

        callback_interact_gesturable_onmove: function callback_interact_gesturable_onmove(event) {
            var scaleElement = event.target;
            var boundingRect = scaleElement.getBoundingClientRect();
            var currentScale = boundingRect.width / scaleElement.clientWidth;

            var baseScale = currentScale/(event.scale - event.ds);
            var tempScale  = Math.max(baseScale * event.scale,1);

            //[translate/scale][restore]
            PageAnimation.setPageScale(scaleElement,tempScale);
            PageAnimation.applyTransform(scaleElement);
        },

        callback_interact_gesturable_onend: function callback_interact_gesturable_onend(event) {
            var scaleElement = event.target;
            var boundingRect = scaleElement.getBoundingClientRect();

            //**********(1) Set this scale to all divs of pages
            var scale = PageAnimation.getPageScale(scaleElement);
            for (var uid in PageAnimation.divContainer) {
                PageAnimation.setPageScale(PageAnimation.getPageDiv(uid),scale);
            }

            //**********(2) We must capture current left/top immediately
            //[translate][save]
            var targetBoundingLeft = boundingRect.left;
            var targetBoundingTop = boundingRect.top;

            //**********(3) Restore css transform translate
            // Because we want to base on these left/top and then do correct related with targetBoundingLeft/targetBoundingTop
            //[translate][reset]
            PageAnimation.applyTransformWithValue(scaleElement,{x:0,y:0});

            PageAnimation.applyTransformOriginWithString(scaleElement,{x:'',y:''});

            //[translate][caculate]
            boundingRect = scaleElement.getBoundingClientRect();
            var boundingLeftFixValue = targetBoundingLeft - boundingRect.left;
            var boundingTopFixValue = targetBoundingTop - boundingRect.top;

            //**********(4) Apply boundingLeftFixValue/boundingTopFixValue meet targetBoundingLeft/targetBoundingTop
            //[translate][restore]
            PageAnimation.setPageTranslate(scaleElement,boundingLeftFixValue,boundingTopFixValue);
            PageAnimation.applyTransform(scaleElement);

            //**********(5) If the left / right / top / bottom is exceed the boundary , we must correct it .
            // Check whether it is exceed the boundary
            var mode = PageAnimation.isExceedLeftOrRightPageBoundary(scaleElement);
            mode |= PageAnimation.isExceedTopOrBottomPageBoundary(scaleElement);
            if((mode & PageAnimation.ALL_MASK) !== 0) {
                boundingRect = scaleElement.getBoundingClientRect();
                targetBoundingLeft = boundingRect.left;
                targetBoundingTop = boundingRect.top;
                if((mode & PageAnimation.EXCEED_LEFT) !== 0) {
                    targetBoundingLeft = 0 - Math.abs(boundingRect.width - scaleElement.offsetWidth);
                } else if((mode & PageAnimation.EXCEED_RIGHT) !== 0) {
                    targetBoundingLeft = 0;
                } else if((mode & PageAnimation.EXCEED_TOP) !== 0) {
                    targetBoundingTop = 0 - Math.abs(boundingRect.height - scaleElement.offsetHeight);
                } else if((mode & PageAnimation.EXCEED_BOTTOM) !== 0) {
                    targetBoundingTop = 0;
                }
                boundingLeftFixValue = targetBoundingLeft - boundingRect.left;
                boundingTopFixValue = targetBoundingTop - boundingRect.top;
                PageAnimation.setPageTranslate(scaleElement,boundingLeftFixValue,boundingTopFixValue);
                PageAnimation.applyTransform(scaleElement);
            }
        },

        callback_interact_draggable_onmove: function callback_interact_draggable_onmove(event) {
            var scaleElement = event.target;
            var oriValue = PageAnimation.getPageTranslate(scaleElement);
            // keep the dragged position in the data-x/data-y attributes
            var x = oriValue.x + event.dx;
            var y = oriValue.y + event.dy;

            // Try to translate the element
            PageAnimation.applyTransformWithValue(scaleElement,{x:x,y:y});

            // Check whether it is exceed the boundary
            var mode = PageAnimation.isExceedLeftOrRightPageBoundary(scaleElement);
            mode |= PageAnimation.isExceedTopOrBottomPageBoundary(scaleElement);
            if((mode & PageAnimation.ALL_MASK) !== 0) {
                PageAnimation.setPageTranslate(scaleElement,oriValue.x,oriValue.y);
                PageAnimation.applyTransform(scaleElement);
                return;
            }
            PageAnimation.setPageTranslate(scaleElement,x,y);
            PageAnimation.applyTransform(scaleElement);
        },

        callback_interact_draggable_onend: function callback_interact_draggable_onend(event) {
            var scaleElement = event.target;
            var mode = PageAnimation.isExceedLeftOrRightPageChangeThreshold(scaleElement);

            if((mode & PageAnimation.EXCEED_LEFT) !== 0) {
                PageAnimation.onNextPage();
            } else if((mode & PageAnimation.EXCEED_RIGHT) !== 0) {
                PageAnimation.onPrevPage();
            }
        },
        //End : [Bruce]
};

function loadDRM() {
	console.log("loadDRM");
	return new Promise(function(resolve, reject){
   		getContent(drmFile).then(function(drm) {
          		parseDRM(drm);
          		resolve(drm);
   		},function(reason) {
          		console.log(reason);
          		reject(new Error("loadDRM fail "+reason));
          	});
    	});//new Promise
}

function parseDRM (drm) {
        var doc= bytesToString(drm);
        doc = doc.substr(doc.indexOf("<"));
        $xml = $($.parseXML(doc));
        $.each($xml.find("DRM")[0].childNodes, function(k,v){
            if(!v.localName==false && v.childNodes.length) {
                if(v.childNodes.length>1) {
                    var data = {};
                     for(var i in v.childNodes) {
                           var v2 = v.childNodes[i];
                            if(!v2.localName==false) {
                                 var value = v2.childNodes.length?v2.childNodes[0].data:null;
                                 if (value == "Y")
                                 	data[v2.localName] = true;
                                 else if (value == "N")
                                 	data[v2.localName] = false;
                                 else
                                 	data[v2.localName] = value;
                            }
		     }
                     DRM[v.localName] = data;
                } else {
                     DRM[v.localName] = v.childNodes[0].data;
                }
            }
        });
}

//TODO: check all items in ReadLimit
function canRead() {
    if(!DRM.ReadLimit)
    	return true;
    var s_str = DRM.ReadLimit.StartTime.split("T");
    var e_str = DRM.ReadLimit.EndTime.split("T");
    var start = new Date(s_str[0]+" "+s_str[1]);
    var end = new Date(e_str[0]+" "+e_str[1]);
    var today = new Date();
    if(today.valueOf()<start.valueOf() || today.valueOf()>end.valueOf())
    	return false;
    return true;
}

function ViewerObserver() {
    this.isReady = false;
    this.confirmThisIsReady = null;
    this.promise = new Promise(function (resolve) {
        this.confirmThisIsReady = resolve;
    }.bind(this));
    this.doTask = function viewerObserver_doTask(readyToDo){
        this.promise.then(readyToDo);
    };
    // Update internal state
    this.promise.then(function(){
        this.isReady = true;
    }.bind(this));
}

function onViewerCarouselInitialized() {
    console.log("(onViewerCarouselInitialized)");
    customEventsManager["onViewerOwlReady"].confirmThisIsReady();
    $('.number_twopage').hide();
}

function onThumbnailViewCarouselInitialized() {
    console.log("(onThumbnailViewCarouselInitialized)");
    customEventsManager["onThumbnailViewOwlReady"].confirmThisIsReady();
}

function onURL_and_AppReady(resultOutput) {
    var args =  resultOutput[0];
    var url =  args[0];
    var legacy =  args[1];

    if(DEBUG_CHROME_DEV_TOOL) {
        console.time('onURL_and_AppReady()');
        console.timeStamp('onURL_and_AppReady()');
    }

    // Init PageAnimation
    PageAnimation.onAppReady();

    //Set listener before open file
    customEventsManager["onMetadataReady"].doTask(onMetadataReady);
    customEventsManager['onOutlineReady'].doTask(onOutlineReady);
    customEventsManager['onDocumentReady'].doTask(onDocumentReady);
    customEventsManager['onFirstPageRendered'].doTask(onFirstPageRendered);
    customEventsManager['onDelayedPageDIVsReady'].doTask(onDelayedPageDIVsReady);

    /**
     * Asynchronously downloads PDF.
     */
    // Open
    console.log("PDFViewerApplication open url: "+ url);
    PDFViewerApplication.open(url, 0 , null , null , null , legacy);

    //Request bookmarks from app when book is loaded.
    App.onRequestBookmarks("RequestBookmarksCallback");

    if(DEBUG_CHROME_DEV_TOOL) {
        console.timeEnd('onURL_and_AppReady()');
    }
}

function onDelayedPageDIVsReady() {
    console.log('onDelayedPageDIVsReady()');

    //Phoebe, fix issue #581,#130
    PageAnimation.gotoPage({pageNum:viewerPageNum});
}

function onFirstPageRendered() {
    console.log('onFirstPageRendered()');
    //Phoebe, fix bug#212, invisible toolbar, footer after 3 secs. when first load.
    setTimeout(function(){
       hideToolbarAndFooter();
    }, 3000);

    if(direct_reverse) {
        App.showPageDircetionTip(PAGE_DIRECTION_RIGHT);
    } else {
        App.showPageDircetionTip(PAGE_DIRECTION_LEFT);
    }

    // Set this page forcefully to let Carousel to start run
    //PageAnimation.gotoPage({pageNum:PageAnimation.currentPageNum});

    //Henry add here
    getThumbnailList(opfFile).then(function(thumbnailNames) {
        customEventsManager["onThumbnailExternalLinkReady"].confirmThisIsReady(thumbnailNames);
    }, function(reason) {
        console.log("Fail _getThumbnailList" + reason);
    });

    
}

function onDocumentReady(pdfDocument) {
    console.log("(onDocumentReady)");
    $("#book_loading").fadeOut(); //Henry add
    PageAnimation.totalPageNum = pdfDocument.numPages;
    UIComponentHandler();  //Henry add
}

function UIComponentHandler() {
    if(DEBUG_CHROME_DEV_TOOL) {
        console.time('UIComponentHandler()');
        console.timeStamp('UIComponentHandler()');
    }
    //initOwl
    // Listen to owl events:
    $viewerOwl.on('changed.owl.carousel',
        function callback(event) {
            if (!(TwoPageViewMode.inProcess)){
                // Must do befroe index is changed
                PageAnimation.onBeforePageChange();
                PageAnimation.currentCarouselIndex = event.item.index;
                // Update current page number
                PDFViewerApplication.page = PageAnimation.currentPageNum;
                PageAnimation.onAfterPageChange();
            }
    });

    //Handle pdf view canvas click event.
    $('#viewerContainer').click(function () {
        toolBarVisible = !(toolBarVisible);
        if (toolBarVisible) {
            if (thumbnailBarVisible) {
                $('#thumbnailView').show();
                App.onToggleThumbnailbar(true);
            }
            $('#footer').show();
            //Henry add, when toolbar raised, page number have to refresh
            //Phoebe add for show 2 page numbers at twoPageViewMode, bug#214
            if (TwoPageViewMode.active) {
              $('.number').hide();
              $('.number_twopage').css("display","block");
              //[Phoebe]Add for new twoPageViewMode(Page: []1  23  45  67  89 ...)
              if (PageAnimation.currentPageNum == 1){
                  document.getElementById('current_page_now').textContent = "";
                  document.getElementById('pages_hyphen').textContent = "";
                  document.getElementById('current_page_next').textContent = "1";
              }else {
                  document.getElementById('current_page_next').textContent = (PageAnimation.currentPageNum === PageAnimation.nextPageNum)? PageAnimation.currentPageNum:PageAnimation.nextPageNum;
                  document.getElementById('pages_hyphen').textContent = (PageAnimation.currentPageNum === PageAnimation.nextPageNum)? (""):("-");
                  document.getElementById('current_page_now').textContent = PageAnimation.currentPageNum;
              }

            } else {
              $('.number_twopage').hide();
              $('.number').show();
              document.getElementById('current_page').textContent = PageAnimation.currentPageNum;
            }
            if(!direct_reverse)
                document.getElementById('paginate').value = PageAnimation.currentPageNum;
            else
                document.getElementById('paginate_reverse').value = -PageAnimation.currentPageNum;
            //[HW]
            $("#bookmark").css("top",40);
            $("#bookmark_left").css("top",40);
            //[Phoebe]Fix issue #717 Action:CLICK_POPUP_MENU
            App.onTrackAction("CLICK_POPUP_MENU",PageAnimation.currentPageNum.toString());

        } else {
            if (thumbnailBarVisible) {
                $('#thumbnailView').hide();
                App.onToggleThumbnailbar(false);
            }
            $('#footer').hide();
            //[HW]
            $("#bookmark").css("top",0);
            $("#bookmark_left").css("top",0);
        }
        App.onToggleToolbar(toolBarVisible);
    });

    document.getElementById('current_page').textContent = PageAnimation.currentPageNum;
    if(!direct_reverse){
        document.getElementById('paginate').value = PageAnimation.currentPageNum;
        document.getElementById('paginate').max = PageAnimation.totalPageNum;
    }else{
        document.getElementById('paginate_reverse').value = -PageAnimation.currentPageNum;
        document.getElementById('paginate_reverse').min = -(PageAnimation.totalPageNum);
    }
    document.getElementById('total_pages').textContent = PageAnimation.totalPageNum;
    document.getElementById('total_pages_twopage').textContent = PageAnimation.totalPageNum;
    //Henry modify for next/previous page
    $('.arrow_icon1').on('click',function(e){
           $(".arrow_icon1").css('transition','');
           $(".arrow_icon1").css('opacity',1);
           
            if(!direct_reverse)
                PageAnimation.onPrevPage();
            else
                PageAnimation.onNextPage();

           $(".arrow_icon1").css('transition','opacity 0.5s');
           $(".arrow_icon1").css('opacity',0);
    });

    $('.arrow_icon2').on('click',function(e){
           $(".arrow_icon2").css('transition','');
           $(".arrow_icon2").css('opacity',1);
           
            if(!direct_reverse)
                PageAnimation.onNextPage();
            else
                PageAnimation.onPrevPage();

           $(".arrow_icon2").css('transition','opacity 0.5s');
           $(".arrow_icon2").css('opacity',0);
    });

    //Henry add, for support undo button
    $(".undo").on('click', function() {
             //TODO: check ChapterLimit
            if (!canRead()){
    		window.alert("此書無法閱讀");
    		return;
            }
            PDFViewerApplication.undoPage(PageAnimation.currentPageNum);
    });
    $(".undo").on('touchstart', function(e) {
         $(".undo").addClass("press");
    });
    $(".undo").on('touchend', function(e) {
         $(".undo").removeClass("press");
    });

    //To handle paginate bar here
    $('#paginate, #paginate_reverse').on('touchstart',function(){
        PDFViewerApplication.historyPage = PageAnimation.currentPageNum;
    });
    $('#paginate').on('input', function(event) {
            //TODO: check ChapterLimit
            if (!canRead()){
    		window.alert("此書無法閱讀");
    		document.getElementById('paginate').value = PageAnimation.currentPageNum;
        	return false;
            }
            var page = parseInt(event.target.value,10);
            //[Phoebe]Fix issue #717 Action:PROGRESSBAR_JUMP_PAGE
            App.onTrackAction("PROGRESSBAR_JUMP_PAGE",page.toString());

            PageAnimation.gotoPage({pageNum:page});
    });
    $('#paginate_reverse').on('input', function(event) {
            //TODO: check ChapterLimit
            if (!canRead()){
    		window.alert("此書無法閱讀");
    		document.getElementById('paginate_reverse').value = -(PageAnimation.currentPageNum);
        	return false;
            }
            var page = Math.abs(parseInt(event.target.value,10));
            //[Phoebe]Fix issue #717 Action:PROGRESSBAR_JUMP_PAGE
            App.onTrackAction("PROGRESSBAR_JUMP_PAGE",page.toString());
            PageAnimation.gotoPage({pageNum:page});
    });

    //document.getElementById('thumbnailbtn').addEventListener('click',
    $(".thumbnailbtn").on('click', function() {
            thumbnailBarVisible = !(thumbnailBarVisible);
            if (thumbnailBarVisible) {
                $('#thumbnailView').show();
                PDFViewerApplication.refreshThumbnailViewer();
            } else {
                $('#thumbnailView').hide();
            }
            App.onToggleThumbnailbar(thumbnailBarVisible);
    });

    // When trial page is closed
    $(".fa.fa-times.close").on('click', function () { 
        $('#popup4').hide();
        App.onToggleTouchEnable(true);
    });

    var $parent = $("footer.bar");

    // Deal arrow_1 / press
    $parent.children("a.undo.arrow_1").on('touchstart', function(e) {
        $parent.children("a.undo.arrow_1").addClass("press");
    });
    $parent.children("a.undo.arrow_1").on('touchend', function(e) {
        $parent.children("a.undo.arrow_1").removeClass("press");
    });

    // Deal arrow_1 reverse / press
    $parent.children("a.undo.arrow_1.reverse").on('touchstart', function(e) {
        $parent.children("a.undo.arrow_1.reverse").addClass("press");
    });
    $parent.children("a.undo.arrow_1.reverse").on('touchend', function(e) {
        $parent.children("a.undo.arrow_1.reverse").removeClass("press");
    });

    // Deal thumbnailbtn / press
    $parent.children(".thumbnailbtn").on('touchstart', function(e) {
        $parent.children(".thumbnailbtn").addClass("press");
    });
    $parent.children(".thumbnailbtn").on('touchend', function(e) {
        $parent.children(".thumbnailbtn").removeClass("press");
    });

    // Deal thumbnailbtn reverse / press
    $parent.children(".thumbnailbtn.reverse").on('touchstart', function(e) {
        $parent.children(".thumbnailbtn.reverse").addClass("press");
    });
    $parent.children(".thumbnailbtn.reverse").on('touchend', function(e) {
        $parent.children(".thumbnailbtn.reverse").removeClass("press");
    });

    console.log("(UIComponentHandler)");

    if(DEBUG_CHROME_DEV_TOOL) {
        console.timeEnd('UIComponentHandler()');
    }
}
function hideToolbarAndFooter(){
    if (toolBarVisible) {
        if (thumbnailBarVisible) {
           $('#thumbnailView').hide();
           App.onToggleThumbnailbar(false);  //notify APP Thumbnailbar is hidden.
           thumbnailBarVisible = false; //always down Thumbnailbar
        }
        $('#footer').hide();
        toolBarVisible = !(toolBarVisible);
        App.onToggleToolbar(toolBarVisible);
    }
}
//callback title
function onMetadataReady(data) {
    var info = data.info, metadata = data.metadata;
    var pdfTitle;
    if (metadata && metadata.has('dc:title')) {
        var title = metadata.get('dc:title');
        // Ghostscript sometimes return 'Untitled', sets the title to 'Untitled'
        if (title !== 'Untitled') {
            pdfTitle = title;
        }
    }

    if (!pdfTitle && info && info['Title']) {
        pdfTitle = info['Title'];
    }

    if (pdfTitle) {
        App.onChangeTitle(pdfTitle);
    }
}

//callback TOC
function onOutlineReady(outline) {

    pdfOutlineArray = new Array();
    pdfStoreOutline(outline, 0);
    var tocarray = new Array();

    for (var i = 0, len = pdfOutlineArray.length; i < len; i++) {
        //[HW]
        var label = pdfOutlineArray[i].outline.title;
        var dest = pdfOutlineArray[i].outline.dest;
        PDFViewerApplication.pdfLinkService.getTocLink(dest, label);
        tocarray.push(
            {
                title:pdfOutlineArray[i].outline.title,
                link:i.toString(),
                level:pdfOutlineArray[i].level
            });
    }

    App.onChangeTOC(tocarray);

    function pdfStoreOutline(outline, level){
        if(!outline) return; //Henry add for avoid NPE
        for (var i = 0, len = outline.length; i < len; i++) {
            var item = outline[i];
            pdfOutlineArray.push({outline:item, level:level});
            if(item.items.length > 0){
                level++;
                pdfStoreOutline(item.items, level);
            }
            if( i == (len -1))
                level--;
        }
    }
}



function renderBook(url, legacy){
    console.log("PDF file:" + url);
    customEventsManager["onURLReady"].confirmThisIsReady([url,legacy]);
    customEventsManager.doAfterMultiReady(["onURLReady","onAppInitialized","onViewerOwlReady","onThumbnailViewOwlReady"],onURL_and_AppReady);

    if(DEBUG_CHROME_DEV_TOOL) {
        console.timeEnd('Viewer.loadBook()');
    }
}

function parseContainerFile(url){
      return new Promise(function(resolve, reject){
      //Samples:
      //<rootfile full-path="metadata.opf" media-type="application/oebps-package+xml"/>
      //<rootfile full-path="content.opf" media-type="application/oebps-package+xml"/>
       getContent(url+"META-INF/container.xml").then(function(container) {
             var doc= bytesToString(container);
             doc = doc.substr(doc.indexOf("<"));
             $xml = $($.parseXML(doc));
             var opfFile = $xml.find("rootfile").attr("full-path");
             resolve(opfFile);
       },function(reason) {
             console.log(reason);
             reject(new Error("parseContainerFile fail "+reason));
       });

      });//new Promise

}

function getfilename(opf) {
   	   return new Promise(function(resolve, reject){
           	getContent(opf).then(function(pdf) {
                  var doc= stringToUTF8String(bytesToString(pdf));  //special case for chinese
                  doc = doc.substr(doc.indexOf("<"));
                  $xml = $($.parseXML(doc));
                  var paths = {};
                  //TODO: using relative path against opf file
                  var temp = $xml.find("item#pdf").attr("href");
                  var n = temp.indexOf("PDF");
                  paths.pdf = temp.substr(n);
                  paths.drm = $xml.find("item#drm").attr("href");
                  resolve(paths);
           	},function(reason) {
                  console.log(reason);
                  reject(new Error("getfilename fail "+reason));
            });

       });//return new Promise
}

function getThumbnailList(opf) {
        var $this = this;
        return new Promise(function(resolve, reject){
        	getContent(opf).then(function(out) {
	            var doc= bytesToString(out);
	            doc = doc.substr(doc.indexOf("<"));
	        	  $xml = $($.parseXML(doc));
	            var thumbnailNames = [];
	            $.each($xml.find("item"),function() {
	                if (($(this).attr("media-type").indexOf("image"))!= -1) {
                       //TODO: using relative path against opf file
                       var temp = $(this).attr("href");
                       var n = temp.indexOf("THUMBNAIL");
                       var thumbnailPath = temp.substr(n);
                       thumbnailNames.push(downloadlink + thumbnailPath);
	                }
	            });
            	resolve(thumbnailNames);
        	},function(reason) {
                console.log(reason);
                reject(new Error("getThumbnailList fail "+reason));
          	});
        });//new Promise
}



//Phoebe add for show 2 page numbers at twoPageViewMode, bug#214
function updateToolBar(){
    if (toolBarVisible) {
        if (thumbnailBarVisible) {
            $('#thumbnailView').show();
        } else {
            $('#thumbnailView').hide();
        }
        $('#footer').show();
        //Henry add, when toolbar raised, page number have to refresh
        //Phoebe add for show 2 page numbers at twoPageViewMode, bug#214
        if (TwoPageViewMode.active) {
              $('.number').hide();
              $('.number_twopage').css("display","block");
              //[Phoebe]Add for new twoPageViewMode(Page: []1  23  45  67  89 ...)			  
              if (PageAnimation.currentPageNum == 1){
                  document.getElementById('current_page_now').textContent = "";
                  document.getElementById('pages_hyphen').textContent = "";
                  document.getElementById('current_page_next').textContent = "1"; 
              }else {
                  document.getElementById('current_page_next').textContent = (PageAnimation.currentPageNum === PageAnimation.nextPageNum)? PageAnimation.currentPageNum:PageAnimation.nextPageNum;
                  document.getElementById('pages_hyphen').textContent = (PageAnimation.currentPageNum === PageAnimation.nextPageNum)? (""):("-");
                  document.getElementById('current_page_now').textContent = PageAnimation.currentPageNum;
              }
        } else {
              $('.number_twopage').hide();
              $('.number').show();
              document.getElementById('current_page').textContent = PageAnimation.currentPageNum;
        }
        if(!direct_reverse)
            document.getElementById('paginate').value = PageAnimation.currentPageNum;
        else
            document.getElementById('paginate_reverse').value = -PageAnimation.currentPageNum;
        //[HW]
        $("#bookmark").css("top",40);
        $("#bookmark_left").css("top",40);
		
        //[Phoebe]Fix issue #717 Action:CLICK_POPUP_MENU
        App.onTrackAction("CLICK_POPUP_MENU",PageAnimation.currentPageNum.toString());
    }
}


function RequestBookmarksCallback(bookmarks) {
    console.log("RequestBookmarksCallback:" + JSON.stringify(bookmarks));
    savedBookmarks.length = 0;
    var r = (typeof bookmarks =="string")?JSON.parse(ref):bookmarks;
    for(var i in r) {
        var v = r[i];
        if(v.book_format === "pdf") {
            switch(v.type) {
                case "bookmark":
                    tempBookmark = {
                        "uuid": v.uuid,
                        "title": "",
                        "cfi": v.cfi,
                        "chapter": v.chapter,
                        "color": v.color
                    };
                    savedBookmarks.push(tempBookmark);
                    break;
            }
        }
    }
}

function AddBookmarkCallBack(uuid) {
    console.log("AddBookmarkCallBack uuid:" + uuid);
    //update uuid in tmpBookmark and push it to savedBookmarks.
    tmpBookmark['uuid'] = uuid;
    savedBookmarks.push(tmpBookmark);
    tmpBookmark = null;
}

///
/// Check if current page has bookmark in saved bookmarks.
/// return null if not found, or saved bookmark in current page if exist.
///
function isBookmarkExist() {
    for(var i in savedBookmarks) {
        if (savedBookmarks[i].cfi == PageAnimation.currentPageNum) {
            return savedBookmarks[i];
        }
    }
    return null;
}

//[HW] for Bookmark
function isBookmarkExist(cfi) {
    console.log("isBookmarkExist() cfi: " + cfi);
    for(var i in savedBookmarks) {
        if (savedBookmarks[i].cfi == cfi) {
            return savedBookmarks[i];
        }
    }
    return null;
}


//[HW] update Bookmark icon
function updateBookmarkIcon() {
    $("#bookmark")[0].className = "bookmark ";
    $("#bookmark_left")[0].className = "bookmark ";
    if (TwoPageViewMode.active) {
        if (direct_reverse) {
            //... 9 8  7 6  5 4  3 2  1 []
            for(var i in savedBookmarks) {
                if (savedBookmarks[i].cfi == PageAnimation.nextPageNum) {
                    color = savedBookmarks[i].color;
                    $("#bookmark_left")[0].className = "bookmark " + color;
                }
            }
            for(var i in savedBookmarks) {
                if (savedBookmarks[i].cfi == PageAnimation.currentPageNum) {
                    color = savedBookmarks[i].color;
                    $("#bookmark")[0].className = "bookmark " + color;
                }
            }
        } else {
            //[]1  2 3  4 5  6 7  8 9   10 11  ..
            for(var i in savedBookmarks) {
                if (savedBookmarks[i].cfi == PageAnimation.currentPageNum) {
                    color = savedBookmarks[i].color;
                    $("#bookmark_left")[0].className = "bookmark " + color;
                }
            }
            for(var i in savedBookmarks) {
                if (savedBookmarks[i].cfi == PageAnimation.nextPageNum) {
                    color = savedBookmarks[i].color;
                    $("#bookmark")[0].className = "bookmark " + color;
                }
            }
        }
    } else {
        for(var i in savedBookmarks) {
            if (savedBookmarks[i].cfi == PageAnimation.currentPageNum) {
                color = savedBookmarks[i].color;
                $("#bookmark")[0].className = "bookmark " + color;
            }
        }
    }
}

function UpdateBookmark(cfi, color) {
    var bookmark = null;
    if ((bookmark = isBookmarkExist(cfi)) !== null) {
        bookmark.color = color;
        App.onUpdateBookmark(bookmark);
    } else {
        //send tmp bookmark to app for getting uuid.
        var chapter = findTOCLabel(cfi);
        tmpBookmark = {
            "uuid": "",
            "title": "",
            "cfi": cfi,
            "chapter": chapter,
            "color": color
        };
        App.onAddBookmark(tmpBookmark,"AddBookmarkCallBack");
    }
}

function findTOCLabel(idx) { //[HW]
    var r = null;
    for(var i in toc) {
        var item = toc[i];
        if (!r) {
            r = item;
        }
        if (idx >= item.page) {
            r = item;
        }
    }
    if (r && r.label) {
        return r.label;
    } else {
        return idx;
    }
}

//Henry add
function getContent(url) {
        return new Promise(function(resolve, reject){
          var xhr = new XMLHttpRequest();
          xhr.open('GET', url);
          xhr.onreadystatechange = handler;
          xhr.responseType = 'arraybuffer';
          xhr.send();

          function handler() {
            if (this.readyState === this.DONE) {
              if (this.status === 200) {
              	var arrayBuffer = this.response;
                resolve(new Uint8Array(arrayBuffer));
              } else {
                reject(new Error(url + " failed with status: [" + this.status + "]"));
              }
            }
          };
        });
  }

//Henry add
function bytesToString(bytes) {
  assert(bytes !== null && typeof bytes === 'object' &&
         bytes.length !== undefined, 'Invalid argument for bytesToString');
  var length = bytes.length;
  var MAX_ARGUMENT_COUNT = 8192;
  if (length < MAX_ARGUMENT_COUNT) {
    return String.fromCharCode.apply(null, bytes);
  }
  var strBuf = [];
  for (var i = 0; i < length; i += MAX_ARGUMENT_COUNT) {
    var chunkEnd = Math.min(i + MAX_ARGUMENT_COUNT, length);
    var chunk = bytes.subarray(i, chunkEnd);
    strBuf.push(String.fromCharCode.apply(null, chunk));
  }
  return strBuf.join('');
}

function assert(cond, msg) {
  if (!cond) {
    error(msg);
  }
}

function stringToUTF8String(str) {
  return decodeURIComponent(escape(str));
}

/* ====================================================================================
 * Below are copy from PDF.js project viewer.js
 * ====================================================================================
 */

/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab: */
/* Copyright 2012 Mozilla Foundation
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/* globals PDFJS, PDFBug, FirefoxCom, Stats, Cache, ProgressBar,
           DownloadManager, getFileName, getPDFFileNameFromURL,
           PDFHistory, Preferences, SidebarView, ViewHistory, Stats,
           PDFThumbnailViewer, URL, noContextMenuHandler, SecondaryToolbar,
           PasswordPrompt, PDFPresentationMode, PDFDocumentProperties, HandTool,
           Promise, PDFLinkService, PDFOutlineView, PDFAttachmentView,
           OverlayManager, PDFFindController, PDFFindBar, PDFViewer,
           PDFRenderingQueue, PresentationModeState, parseQueryString,
           RenderingStates, UNKNOWN_SCALE, DEFAULT_SCALE_VALUE,
           IGNORE_CURRENT_POSITION_ON_ZOOM: true */

'use strict';

var DEFAULT_URL = 'test.pdf';
var DEFAULT_SCALE_DELTA = 1.01;
var MIN_SCALE = 0.25;
var MAX_SCALE = 10.0;
var VIEW_HISTORY_MEMORY = 20;
var SCALE_SELECT_CONTAINER_PADDING = 8;
var SCALE_SELECT_PADDING = 22;
var PAGE_NUMBER_LOADING_INDICATOR = 'visiblePageIsLoading';
var DISABLE_AUTO_FETCH_LOADING_BAR_TIMEOUT = 5000;

PDFJS.imageResourcesPath = '../images/';
PDFJS.workerSrc = 'dist/pdfjs/build/pdf.worker.js'; //against index.html
PDFJS.cMapUrl = '../cmaps/'; //against pdf.worker.js path
PDFJS.cMapPacked = true;

var mozL10n = document.mozL10n || document.webL10n;


var CSS_UNITS = 96.0 / 72.0;
var DEFAULT_SCALE_VALUE = 'auto';
var DEFAULT_SCALE = 1.0;
var UNKNOWN_SCALE = 0;
var MAX_AUTO_SCALE = 1.25;
var SCROLLBAR_PADDING = 40;
var VERTICAL_PADDING = 5;

// optimised CSS custom property getter/setter
var CustomStyle = (function CustomStyleClosure() {

  // As noted on: http://www.zachstronaut.com/posts/2009/02/17/
  //              animate-css-transforms-firefox-webkit.html
  // in some versions of IE9 it is critical that ms appear in this list
  // before Moz
  var prefixes = ['ms', 'Moz', 'Webkit', 'O'];
  var _cache = {};

  function CustomStyle() {}

  CustomStyle.getProp = function get(propName, element) {
    // check cache only when no element is given
    if (arguments.length === 1 && typeof _cache[propName] === 'string') {
      return _cache[propName];
    }

    element = element || document.documentElement;
    var style = element.style, prefixed, uPropName;

    // test standard property first
    if (typeof style[propName] === 'string') {
      return (_cache[propName] = propName);
    }

    // capitalize
    uPropName = propName.charAt(0).toUpperCase() + propName.slice(1);

    // test vendor specific properties
    for (var i = 0, l = prefixes.length; i < l; i++) {
      prefixed = prefixes[i] + uPropName;
      if (typeof style[prefixed] === 'string') {
        return (_cache[propName] = prefixed);
      }
    }

    //if all fails then set to undefined
    return (_cache[propName] = 'undefined');
  };

  CustomStyle.setProp = function set(propName, element, str) {
    var prop = this.getProp(propName);
    if (prop !== 'undefined') {
      element.style[prop] = str;
    }
  };

  return CustomStyle;
})();

var NullCharactersRegExp = /\x00/g;

function removeNullCharacters(str) {
  return str.replace(NullCharactersRegExp, '');
}

function getFileName(url) {
  var anchor = url.indexOf('#');
  var query = url.indexOf('?');
  var end = Math.min(
    anchor > 0 ? anchor : url.length,
    query > 0 ? query : url.length);
  return url.substring(url.lastIndexOf('/', end) + 1, end);
}

/**
 * Returns scale factor for the canvas. It makes sense for the HiDPI displays.
 * @return {Object} The object with horizontal (sx) and vertical (sy)
                    scales. The scaled property is set to false if scaling is
                    not required, true otherwise.
 */
function getOutputScale(ctx) {
  var devicePixelRatio = window.devicePixelRatio || 1;
  var backingStoreRatio = ctx.webkitBackingStorePixelRatio ||
                          ctx.mozBackingStorePixelRatio ||
                          ctx.msBackingStorePixelRatio ||
                          ctx.oBackingStorePixelRatio ||
                          ctx.backingStorePixelRatio || 1;
  var pixelRatio = devicePixelRatio / backingStoreRatio;
  return {
    sx: pixelRatio,
    sy: pixelRatio,
    scaled: pixelRatio !== 1
  };
}

/**
 * Scrolls specified element into view of its parent.
 * @param {Object} element - The element to be visible.
 * @param {Object} spot - An object with optional top and left properties,
 *               specifying the offset from the top left edge.
 * @param {boolean} skipOverflowHiddenElements - Ignore elements that have
 *   the CSS rule `overflow: hidden;` set. The default is false.
 */
function scrollIntoView(element, spot, skipOverflowHiddenElements) {
  // Assuming offsetParent is available (it's not available when viewer is in
  // hidden iframe or object). We have to scroll: if the offsetParent is not set
  // producing the error. See also animationStartedClosure.
  var parent = element.offsetParent;
  if (!parent) {
    console.error('offsetParent is not set -- cannot scroll');
    return;
  }
  var checkOverflow = skipOverflowHiddenElements || false;
  var offsetY = element.offsetTop + element.clientTop;
  var offsetX = element.offsetLeft + element.clientLeft;
  while (parent.clientHeight === parent.scrollHeight ||
         (checkOverflow && getComputedStyle(parent).overflow === 'hidden')) {
    if (parent.dataset._scaleY) {
      offsetY /= parent.dataset._scaleY;
      offsetX /= parent.dataset._scaleX;
    }
    offsetY += parent.offsetTop;
    offsetX += parent.offsetLeft;
    parent = parent.offsetParent;
    if (!parent) {
      return; // no need to scroll
    }
  }
  if (spot) {
    if (spot.top !== undefined) {
      offsetY += spot.top;
    }
    if (spot.left !== undefined) {
      offsetX += spot.left;
      parent.scrollLeft = offsetX;
    }
  }
  parent.scrollTop = offsetY;
}

/**
 * Scrolls specified element into view of its parent.
 * element {Object} The element to be visible.
 * spot {Object} An object with optional top and left properties,
 *               specifying the offset from the top left edge.
 */
function scrollIntoView_with_X_axis(element, spot) {
  // Assuming offsetParent is available (it's not available when viewer is in
  // hidden iframe or object). We have to scroll: if the offsetParent is not set
  // producing the error. See also animationStartedClosure.
  var parent = element.offsetParent;
  var offsetY = element.offsetTop + element.clientTop;
  var offsetX = element.offsetLeft + element.clientLeft;
  if (!parent) {
    console.error('offsetParent is not set -- cannot scroll');
    return;
  }
  while (parent.clientWidth === parent.scrollWidth) {
    if (parent.dataset._scaleY) {
      offsetY /= parent.dataset._scaleY;
      offsetX /= parent.dataset._scaleX;
    }
    offsetY += parent.offsetTop;
    offsetX += parent.offsetLeft;
    parent = parent.offsetParent;
    if (!parent) {
      return; // no need to scroll
    }
  }
  if (spot) {
    if (spot.top !== undefined) {
      offsetY += spot.top;
    }
    if (spot.left !== undefined) {
      offsetX += spot.left;
      parent.scrollLeft = offsetX;
    }
  }
  parent.scrollLeft = offsetX;
}

/**
 * Helper function to start monitoring the scroll event and converting them into
 * PDF.js friendly one: with scroll debounce and scroll direction.
 */
function watchScroll(viewAreaElement, callback) {
  var debounceScroll = function debounceScroll(evt) {
    if (rAF) {
      return;
    }
    // schedule an invocation of scroll for next animation frame.
    rAF = window.requestAnimationFrame(function viewAreaElementScrolled() {
      rAF = null;

      var currentY = viewAreaElement.scrollTop;
      var lastY = state.lastY;
      if (currentY !== lastY) {
        state.down = currentY > lastY;
      }
      state.lastY = currentY;
      callback(state);
    });
  };

  var state = {
    down: true,
    lastY: viewAreaElement.scrollTop,
    _eventHandler: debounceScroll
  };

  var rAF = null;
  viewAreaElement.addEventListener('scroll', debounceScroll, true);
  return state;
}

/**
 * Helper function to parse query string (e.g. ?param1=value&parm2=...).
 */
function parseQueryString(query) {
  var parts = query.split('&');
  var params = {};
  for (var i = 0, ii = parts.length; i < ii; ++i) {
    var param = parts[i].split('=');
    var key = param[0].toLowerCase();
    var value = param.length > 1 ? param[1] : null;
    params[decodeURIComponent(key)] = decodeURIComponent(value);
  }
  return params;
}

/**
 * Use binary search to find the index of the first item in a given array which
 * passes a given condition. The items are expected to be sorted in the sense
 * that if the condition is true for one item in the array, then it is also true
 * for all following items.
 *
 * @returns {Number} Index of the first array element to pass the test,
 *                   or |items.length| if no such element exists.
 */
function binarySearchFirstItem(items, condition) {
  var minIndex = 0;
  var maxIndex = items.length - 1;

  if (items.length === 0 || !condition(items[maxIndex])) {
    return items.length;
  }
  if (condition(items[minIndex])) {
    return minIndex;
  }

  while (minIndex < maxIndex) {
    var currentIndex = (minIndex + maxIndex) >> 1;
    var currentItem = items[currentIndex];
    if (condition(currentItem)) {
      maxIndex = currentIndex;
    } else {
      minIndex = currentIndex + 1;
    }
  }
  return minIndex; /* === maxIndex */
}

/**
 *  Approximates float number as a fraction using Farey sequence (max order
 *  of 8).
 *  @param {number} x - Positive float number.
 *  @returns {Array} Estimated fraction: the first array item is a numerator,
 *                   the second one is a denominator.
 */
function approximateFraction(x) {
  // Fast paths for int numbers or their inversions.
  if (Math.floor(x) === x) {
    return [x, 1];
  }
  var xinv = 1 / x;
  var limit = 8;
  if (xinv > limit) {
    return [1, limit];
  } else  if (Math.floor(xinv) === xinv) {
    return [1, xinv];
  }

  var x_ = x > 1 ? xinv : x;
  // a/b and c/d are neighbours in Farey sequence.
  var a = 0, b = 1, c = 1, d = 1;
  // Limiting search to order 8.
  while (true) {
    // Generating next term in sequence (order of q).
    var p = a + c, q = b + d;
    if (q > limit) {
      break;
    }
    if (x_ <= p / q) {
      c = p; d = q;
    } else {
      a = p; b = q;
    }
  }
  // Select closest of the neighbours to x.
  if (x_ - a / b < c / d - x_) {
    return x_ === x ? [a, b] : [b, a];
  } else {
    return x_ === x ? [c, d] : [d, c];
  }
}

function roundToDivide(x, div) {
  var r = x % div;
  return r === 0 ? x : Math.round(x - r + div);
}

/**
 * Generic helper to find out what elements are visible within a scroll pane.
 */
function getVisibleElements(scrollEl, views, sortByVisibility) {
  var top = scrollEl.scrollTop, bottom = top + scrollEl.clientHeight;
  var left = scrollEl.scrollLeft, right = left + scrollEl.clientWidth;

  function isElementBottomBelowViewTop(view) {
    var element = view.div;
    var elementBottom =
      element.offsetTop + element.clientTop + element.clientHeight;
    return elementBottom > top;
  }

  var visible = [], view, element;
  var currentHeight, viewHeight, hiddenHeight, percentHeight;
  var currentWidth, viewWidth;
  var firstVisibleElementInd = (views.length === 0) ? 0 :
    binarySearchFirstItem(views, isElementBottomBelowViewTop);

  for (var i = firstVisibleElementInd, ii = views.length; i < ii; i++) {
    view = views[i];
    element = view.div;
    currentHeight = element.offsetTop + element.clientTop;
    viewHeight = element.clientHeight;

    if (currentHeight > bottom) {
      break;
    }

    currentWidth = element.offsetLeft + element.clientLeft;
    viewWidth = element.clientWidth;
    if (currentWidth + viewWidth < left || currentWidth > right) {
      continue;
    }
    hiddenHeight = Math.max(0, top - currentHeight) +
      Math.max(0, currentHeight + viewHeight - bottom);
    percentHeight = ((viewHeight - hiddenHeight) * 100 / viewHeight) | 0;

    if (sortByVisibility && TwoPageViewMode.active) {  //Phoebe
        hiddenWidth = Math.max(0, left - currentWidth) +
                      Math.max(0, currentWidth + viewWidth - right);
        percentWidth = ((viewWidth - hiddenWidth) * 100 / viewWidth) | 0;

        percentHeight = Math.sqrt(percentHeight * percentWidth) | 0;
    }

    visible.push({
      id: view.id,
      x: currentWidth,
      y: currentHeight,
      view: view,
      percent: percentHeight
    });
  }

  var first = visible[0];
  var last = visible[visible.length - 1];

  if (sortByVisibility) {
    visible.sort(function(a, b) {
      var pc = a.percent - b.percent;
      if (Math.abs(pc) > 0.001) {
        return -pc;
      }
      return a.id - b.id; // ensure stability
    });
  }
  return {first: first, last: last, views: visible};
}

//[Bruce]
/**
 * Generic helper to find out what elements are visible within a scroll pane.
 */
function getVisibleElements_with_X_axis(scrollEl, views, sortByVisibility) {
  var top = scrollEl.scrollTop, bottom = top + scrollEl.clientHeight;
  var left = scrollEl.scrollLeft, right = left + scrollEl.clientWidth;

  function isElementRightSideExceedViewLeftSide(view) {
    //[Bruce] to compatible with owl/Carousel
    //var element = view.div;
    var element = view.div.offsetParent;
    var elementRightSide =
      element.offsetLeft + element.clientLeft + element.clientWidth;
    return elementRightSide > left;
  }

  var visible = [], view, element;
  var currentHeight, viewHeight;
  var currentWidth, viewWidth, hiddenWidth, percentWidth;
  var firstVisibleElementInd = (views.length === 0) ? 0 :
    binarySearchFirstItem(views, isElementRightSideExceedViewLeftSide);

  for (var i = firstVisibleElementInd, ii = views.length; i < ii; i++) {
    view = views[i];
    //[Bruce] to compatible with owl/Carousel
    //element = view.div;
    element = view.div.offsetParent;
    currentWidth = element.offsetLeft + element.clientLeft;
    viewWidth = element.clientWidth;

    if (currentWidth > right) {
      break;
    }

    currentHeight = element.offsetTop + element.clientTop;
    viewHeight = element.clientHeight;
    if (currentHeight + viewHeight < top || currentHeight > bottom) {
      continue;
    }
    hiddenWidth = Math.max(0, left - currentWidth) +
      Math.max(0, currentWidth + viewWidth - right);
    percentWidth = ((viewWidth - hiddenWidth) * 100 / viewWidth) | 0;

    visible.push({
      id: view.id,
      x: currentWidth,
      y: currentHeight,
      view: view,
      percent: percentWidth
    });
  }

  var first = visible[0];
  var last = visible[visible.length - 1];

  if (sortByVisibility) {
    visible.sort(function(a, b) {
      var pc = a.percent - b.percent;
      if (Math.abs(pc) > 0.001) {
        return -pc;
      }
      return a.id - b.id; // ensure stability
    });
  }
  return {first: first, last: last, views: visible};
}
//End : [Bruce]

/**
 * Event handler to suppress context menu.
 */
function noContextMenuHandler(e) {
  e.preventDefault();
}

/**
 * Returns the filename or guessed filename from the url (see issue 3455).
 * url {String} The original PDF location.
 * @return {String} Guessed PDF file name.
 */
function getPDFFileNameFromURL(url) {
  var reURI = /^(?:([^:]+:)?\/\/[^\/]+)?([^?#]*)(\?[^#]*)?(#.*)?$/;
  //            SCHEME      HOST         1.PATH  2.QUERY   3.REF
  // Pattern to get last matching NAME.pdf
  var reFilename = /[^\/?#=]+\.pdf\b(?!.*\.pdf\b)/i;
  var splitURI = reURI.exec(url);
  var suggestedFilename = reFilename.exec(splitURI[1]) ||
                           reFilename.exec(splitURI[2]) ||
                           reFilename.exec(splitURI[3]);
  if (suggestedFilename) {
    suggestedFilename = suggestedFilename[0];
    if (suggestedFilename.indexOf('%') !== -1) {
      // URL-encoded %2Fpath%2Fto%2Ffile.pdf should be file.pdf
      try {
        suggestedFilename =
          reFilename.exec(decodeURIComponent(suggestedFilename))[0];
      } catch(e) { // Possible (extremely rare) errors:
        // URIError "Malformed URI", e.g. for "%AA.pdf"
        // TypeError "null has no properties", e.g. for "%2F.pdf"
      }
    }
  }
  return suggestedFilename || 'document.pdf';
}

var ProgressBar = (function ProgressBarClosure() {

  function clamp(v, min, max) {
    return Math.min(Math.max(v, min), max);
  }

  function ProgressBar(id, opts) {
    this.visible = true;

    // Fetch the sub-elements for later.
    this.div = document.querySelector(id + ' .progress');

    // Get the loading bar element, so it can be resized to fit the viewer.
    this.bar = this.div.parentNode;

    // Get options, with sensible defaults.
    this.height = opts.height || 100;
    this.width = opts.width || 100;
    this.units = opts.units || '%';

    // Initialize heights.
    this.div.style.height = this.height + this.units;
    this.percent = 0;
  }

  ProgressBar.prototype = {

    updateBar: function ProgressBar_updateBar() {
      if (this._indeterminate) {
        this.div.classList.add('indeterminate');
        this.div.style.width = this.width + this.units;
        return;
      }

      this.div.classList.remove('indeterminate');
      var progressSize = this.width * this._percent / 100;
      this.div.style.width = progressSize + this.units;
    },

    get percent() {
      return this._percent;
    },

    set percent(val) {
      this._indeterminate = isNaN(val);
      this._percent = clamp(val, 0, 100);
      this.updateBar();
    },

    setWidth: function ProgressBar_setWidth(viewer) {
      if (viewer) {
        var container = viewer.parentNode;
        var scrollbarWidth = container.offsetWidth - viewer.offsetWidth;
        if (scrollbarWidth > 0) {
          this.bar.setAttribute('style', 'width: calc(100% - ' +
                                         scrollbarWidth + 'px);');
        }
      }
    },

    hide: function ProgressBar_hide() {
      if (!this.visible) {
        return;
      }
      this.visible = false;
      this.bar.classList.add('hidden');
      document.body.classList.remove('loadingInProgress');
    },

    show: function ProgressBar_show() {
      if (this.visible) {
        return;
      }
      this.visible = true;
      document.body.classList.add('loadingInProgress');
      this.bar.classList.remove('hidden');
    }
  };

  return ProgressBar;
})();



var DEFAULT_PREFERENCES = {
  showPreviousViewOnLoad: true,
  defaultZoomValue: '',
  sidebarViewOnLoad: 0,
  enableHandToolOnLoad: false,
  twoPageViewModeOnLoad: -1,
  enableWebGL: false,
  pdfBugEnabled: false,
  disableRange: false,
  disableStream: false,
  disableAutoFetch: true,
  disableFontFace: false,
  disableTextLayer: true,
  useOnlyCssZoom: true
};


var SidebarView = {
  NONE: 0,
  THUMBS: 1,
  OUTLINE: 2,
  ATTACHMENTS: 3
};

/**
 * Preferences - Utility for storing persistent settings.
 *   Used for settings that should be applied to all opened documents,
 *   or every time the viewer is loaded.
 */
var Preferences = {
  prefs: Object.create(DEFAULT_PREFERENCES),
  isInitializedPromiseResolved: false,
  initializedPromise: null,

  /**
   * Initialize and fetch the current preference values from storage.
   * @return {Promise} A promise that is resolved when the preferences
   *                   have been initialized.
   */
  initialize: function preferencesInitialize() {
    return this.initializedPromise =
        this._readFromStorage(DEFAULT_PREFERENCES).then(function(prefObj) {
      this.isInitializedPromiseResolved = true;
      if (prefObj) {
        this.prefs = prefObj;
      }
    }.bind(this));
  },

  /**
   * Stub function for writing preferences to storage.
   * NOTE: This should be overridden by a build-specific function defined below.
   * @param {Object} prefObj The preferences that should be written to storage.
   * @return {Promise} A promise that is resolved when the preference values
   *                   have been written.
   */
  _writeToStorage: function preferences_writeToStorage(prefObj) {
    return Promise.resolve();
  },

  /**
   * Stub function for reading preferences from storage.
   * NOTE: This should be overridden by a build-specific function defined below.
   * @param {Object} prefObj The preferences that should be read from storage.
   * @return {Promise} A promise that is resolved with an {Object} containing
   *                   the preferences that have been read.
   */
  _readFromStorage: function preferences_readFromStorage(prefObj) {
    return Promise.resolve();
  },

  /**
   * Reset the preferences to their default values and update storage.
   * @return {Promise} A promise that is resolved when the preference values
   *                   have been reset.
   */
  reset: function preferencesReset() {
    return this.initializedPromise.then(function() {
      this.prefs = Object.create(DEFAULT_PREFERENCES);
      return this._writeToStorage(DEFAULT_PREFERENCES);
    }.bind(this));
  },

  /**
   * Replace the current preference values with the ones from storage.
   * @return {Promise} A promise that is resolved when the preference values
   *                   have been updated.
   */
  reload: function preferencesReload() {
    return this.initializedPromise.then(function () {
      this._readFromStorage(DEFAULT_PREFERENCES).then(function(prefObj) {
        if (prefObj) {
          this.prefs = prefObj;
        }
      }.bind(this));
    }.bind(this));
  },

  /**
   * Set the value of a preference.
   * @param {string} name The name of the preference that should be changed.
   * @param {boolean|number|string} value The new value of the preference.
   * @return {Promise} A promise that is resolved when the value has been set,
   *                   provided that the preference exists and the types match.
   */
  set: function preferencesSet(name, value) {
    return this.initializedPromise.then(function () {
      if (DEFAULT_PREFERENCES[name] === undefined) {
        throw new Error('preferencesSet: \'' + name + '\' is undefined.');
      } else if (value === undefined) {
        throw new Error('preferencesSet: no value is specified.');
      }
      var valueType = typeof value;
      var defaultType = typeof DEFAULT_PREFERENCES[name];

      if (valueType !== defaultType) {
        if (valueType === 'number' && defaultType === 'string') {
          value = value.toString();
        } else {
          throw new Error('Preferences_set: \'' + value + '\' is a \"' +
                          valueType + '\", expected \"' + defaultType + '\".');
        }
      } else {
        if (valueType === 'number' && (value | 0) !== value) {
          throw new Error('Preferences_set: \'' + value +
                          '\' must be an \"integer\".');
        }
      }
      this.prefs[name] = value;
      return this._writeToStorage(this.prefs);
    }.bind(this));
  },

  /**
   * Get the value of a preference.
   * @param {string} name The name of the preference whose value is requested.
   * @return {Promise} A promise that is resolved with a {boolean|number|string}
   *                   containing the value of the preference.
   */
  get: function preferencesGet(name) {
    return this.initializedPromise.then(function () {
      var defaultValue = DEFAULT_PREFERENCES[name];

      if (defaultValue === undefined) {
        throw new Error('preferencesGet: \'' + name + '\' is undefined.');
      } else {
        var prefValue = this.prefs[name];

        if (prefValue !== undefined) {
          return prefValue;
        }
      }
      return defaultValue;
    }.bind(this));
  }
};


Preferences._writeToStorage = function (prefObj) {
  return new Promise(function (resolve) {
    localStorage.setItem('pdfjs.preferences', JSON.stringify(prefObj));
    resolve();
  });
};

Preferences._readFromStorage = function (prefObj) {
  return new Promise(function (resolve) {
    var readPrefs = JSON.parse(localStorage.getItem('pdfjs.preferences'));
    resolve(readPrefs);
  });
};


(function mozPrintCallbackPolyfillClosure() {
  if ('mozPrintCallback' in document.createElement('canvas')) {
    return;
  }
  // Cause positive result on feature-detection:
  HTMLCanvasElement.prototype.mozPrintCallback = undefined;

  var canvases;   // During print task: non-live NodeList of <canvas> elements
  var index;      // Index of <canvas> element that is being processed

  var print = window.print;
  window.print = function print() {
    if (canvases) {
      console.warn('Ignored window.print() because of a pending print job.');
      return;
    }
    try {
      dispatchEvent('beforeprint');
    } finally {
      canvases = document.querySelectorAll('canvas');
      index = -1;
      next();
    }
  };

  function dispatchEvent(eventType) {
    var event = document.createEvent('CustomEvent');
    event.initCustomEvent(eventType, false, false, 'custom');
    window.dispatchEvent(event);
  }

  function next() {
    if (!canvases) {
      return; // Print task cancelled by user (state reset in abort())
    }

    renderProgress();
    if (++index < canvases.length) {
      var canvas = canvases[index];
      if (typeof canvas.mozPrintCallback === 'function') {
        canvas.mozPrintCallback({
          context: canvas.getContext('2d'),
          abort: abort,
          done: next
        });
      } else {
        next();
      }
    } else {
      renderProgress();
      print.call(window);
      setTimeout(abort, 20); // Tidy-up
    }
  }

  function abort() {
    if (canvases) {
      canvases = null;
      renderProgress();
      dispatchEvent('afterprint');
    }
  }

  function renderProgress() {
    var progressContainer = document.getElementById('mozPrintCallback-shim');
    if (canvases && canvases.length) {
      var progress = Math.round(100 * index / canvases.length);
      var progressBar = progressContainer.querySelector('progress');
      var progressPerc = progressContainer.querySelector('.relative-progress');
      progressBar.value = progress;
      progressPerc.textContent = progress + '%';
      progressContainer.removeAttribute('hidden');
      progressContainer.onclick = abort;
    } else {
      progressContainer.setAttribute('hidden', '');
    }
  }

  var hasAttachEvent = !!document.attachEvent;

  window.addEventListener('keydown', function(event) {
    // Intercept Cmd/Ctrl + P in all browsers.
    // Also intercept Cmd/Ctrl + Shift + P in Chrome and Opera
    if (event.keyCode === 80/*P*/ && (event.ctrlKey || event.metaKey) &&
        !event.altKey && (!event.shiftKey || window.chrome || window.opera)) {
      window.print();
      if (hasAttachEvent) {
        // Only attachEvent can cancel Ctrl + P dialog in IE <=10
        // attachEvent is gone in IE11, so the dialog will re-appear in IE11.
        return;
      }
      event.preventDefault();
      if (event.stopImmediatePropagation) {
        event.stopImmediatePropagation();
      } else {
        event.stopPropagation();
      }
      return;
    }
    if (event.keyCode === 27 && canvases) { // Esc
      abort();
    }
  }, true);
  if (hasAttachEvent) {
    document.attachEvent('onkeydown', function(event) {
      event = event || window.event;
      if (event.keyCode === 80/*P*/ && event.ctrlKey) {
        event.keyCode = 0;
        return false;
      }
    });
  }

  if ('onbeforeprint' in window) {
    // Do not propagate before/afterprint events when they are not triggered
    // from within this polyfill. (FF/IE).
    var stopPropagationIfNeeded = function(event) {
      if (event.detail !== 'custom' && event.stopImmediatePropagation) {
        event.stopImmediatePropagation();
      }
    };
    window.addEventListener('beforeprint', stopPropagationIfNeeded, false);
    window.addEventListener('afterprint', stopPropagationIfNeeded, false);
  }
})();



var DownloadManager = (function DownloadManagerClosure() {

  function download(blobUrl, filename) {
    var a = document.createElement('a');
    if (a.click) {
      // Use a.click() if available. Otherwise, Chrome might show
      // "Unsafe JavaScript attempt to initiate a navigation change
      //  for frame with URL" and not open the PDF at all.
      // Supported by (not mentioned = untested):
      // - Firefox 6 - 19 (4- does not support a.click, 5 ignores a.click)
      // - Chrome 19 - 26 (18- does not support a.click)
      // - Opera 9 - 12.15
      // - Internet Explorer 6 - 10
      // - Safari 6 (5.1- does not support a.click)
      a.href = blobUrl;
      a.target = '_parent';
      // Use a.download if available. This increases the likelihood that
      // the file is downloaded instead of opened by another PDF plugin.
      if ('download' in a) {
        a.download = filename;
      }
      // <a> must be in the document for IE and recent Firefox versions.
      // (otherwise .click() is ignored)
      (document.body || document.documentElement).appendChild(a);
      a.click();
      a.parentNode.removeChild(a);
    } else {
      if (window.top === window &&
          blobUrl.split('#')[0] === window.location.href.split('#')[0]) {
        // If _parent == self, then opening an identical URL with different
        // location hash will only cause a navigation, not a download.
        var padCharacter = blobUrl.indexOf('?') === -1 ? '?' : '&';
        blobUrl = blobUrl.replace(/#|$/, padCharacter + '$&');
      }
      window.open(blobUrl, '_parent');
    }
  }

  function DownloadManager() {}

  DownloadManager.prototype = {
    downloadUrl: function DownloadManager_downloadUrl(url, filename) {
      if (!PDFJS.isValidUrl(url, true)) {
        return; // restricted/invalid URL
      }

      download(url + '#pdfjs.action=download', filename);
    },

    downloadData: function DownloadManager_downloadData(data, filename,
                                                        contentType) {
      if (navigator.msSaveBlob) { // IE10 and above
        return navigator.msSaveBlob(new Blob([data], { type: contentType }),
                                    filename);
      }

      var blobUrl = PDFJS.createObjectURL(data, contentType);
      download(blobUrl, filename);
    },

    download: function DownloadManager_download(blob, url, filename) {
      if (!URL) {
        // URL.createObjectURL is not supported
        this.downloadUrl(url, filename);
        return;
      }

      if (navigator.msSaveBlob) {
        // IE10 / IE11
        if (!navigator.msSaveBlob(blob, filename)) {
          this.downloadUrl(url, filename);
        }
        return;
      }

      var blobUrl = URL.createObjectURL(blob);
      download(blobUrl, filename);
    }
  };

  return DownloadManager;
})();





var DEFAULT_VIEW_HISTORY_CACHE_SIZE = 20;

/**
 * View History - This is a utility for saving various view parameters for
 *                recently opened files.
 *
 * The way that the view parameters are stored depends on how PDF.js is built,
 * for 'node make <flag>' the following cases exist:
 *  - FIREFOX or MOZCENTRAL - uses sessionStorage.
 *  - GENERIC or CHROME     - uses localStorage, if it is available.
 */
var ViewHistory = (function ViewHistoryClosure() {
  function ViewHistory(fingerprint, cacheSize) {
    this.fingerprint = fingerprint;
    this.cacheSize = cacheSize || DEFAULT_VIEW_HISTORY_CACHE_SIZE;
    this.isInitializedPromiseResolved = false;
    this.initializedPromise =
        this._readFromStorage().then(function (databaseStr) {
      this.isInitializedPromiseResolved = true;

      var database = JSON.parse(databaseStr || '{}');
      if (!('files' in database)) {
        database.files = [];
      }
      if (database.files.length >= this.cacheSize) {
        database.files.shift();
      }
      var index;
      for (var i = 0, length = database.files.length; i < length; i++) {
        var branch = database.files[i];
        if (branch.fingerprint === this.fingerprint) {
          index = i;
          break;
        }
      }
      if (typeof index !== 'number') {
        index = database.files.push({fingerprint: this.fingerprint}) - 1;
      }
      this.file = database.files[index];
      this.database = database;
    }.bind(this));
  }

  ViewHistory.prototype = {
    _writeToStorage: function ViewHistory_writeToStorage() {
      return new Promise(function (resolve) {
        var databaseStr = JSON.stringify(this.database);


        localStorage.setItem('database', databaseStr);
        resolve();
      }.bind(this));
    },

    _readFromStorage: function ViewHistory_readFromStorage() {
      return new Promise(function (resolve) {

        resolve(localStorage.getItem('database'));
      });
    },

    set: function ViewHistory_set(name, val) {
      if (!this.isInitializedPromiseResolved) {
        return;
      }
      this.file[name] = val;
      return this._writeToStorage();
    },

    setMultiple: function ViewHistory_setMultiple(properties) {
      if (!this.isInitializedPromiseResolved) {
        return;
      }
      for (var name in properties) {
        this.file[name] = properties[name];
      }
      return this._writeToStorage();
    },

    get: function ViewHistory_get(name, defaultValue) {
      if (!this.isInitializedPromiseResolved) {
        return defaultValue;
      }
      return this.file[name] || defaultValue;
    }
  };

  return ViewHistory;
})();


/**
 * Creates a "search bar" given a set of DOM elements that act as controls
 * for searching or for setting search preferences in the UI. This object
 * also sets up the appropriate events for the controls. Actual searching
 * is done by PDFFindController.
 */
var PDFFindBar = (function PDFFindBarClosure() {
  function PDFFindBar(options) {
    this.opened = false;
    this.bar = options.bar || null;
    this.toggleButton = options.toggleButton || null;
    this.findField = options.findField || null;
    this.highlightAll = options.highlightAllCheckbox || null;
    this.caseSensitive = options.caseSensitiveCheckbox || null;
    this.findMsg = options.findMsg || null;
    this.findResultsCount = options.findResultsCount || null;
    this.findStatusIcon = options.findStatusIcon || null;
    this.findPreviousButton = options.findPreviousButton || null;
    this.findNextButton = options.findNextButton || null;
    this.findController = options.findController || null;

    if (this.findController === null) {
      throw new Error('PDFFindBar cannot be used without a ' +
                      'PDFFindController instance.');
    }

    // Add event listeners to the DOM elements.
    var self = this;
    this.toggleButton.addEventListener('click', function() {
      self.toggle();
    });

    this.findField.addEventListener('input', function() {
      self.dispatchEvent('');
    });

    this.bar.addEventListener('keydown', function(evt) {
      switch (evt.keyCode) {
        case 13: // Enter
          if (evt.target === self.findField) {
            self.dispatchEvent('again', evt.shiftKey);
          }
          break;
        case 27: // Escape
          self.close();
          break;
      }
    });

    this.findPreviousButton.addEventListener('click', function() {
      self.dispatchEvent('again', true);
    });

    this.findNextButton.addEventListener('click', function() {
      self.dispatchEvent('again', false);
    });

    this.highlightAll.addEventListener('click', function() {
      self.dispatchEvent('highlightallchange');
    });

    this.caseSensitive.addEventListener('click', function() {
      self.dispatchEvent('casesensitivitychange');
    });
  }

  PDFFindBar.prototype = {
    dispatchEvent: function PDFFindBar_dispatchEvent(type, findPrev) {
      var event = document.createEvent('CustomEvent');
      event.initCustomEvent('find' + type, true, true, {
        query: this.findField.value,
        caseSensitive: this.caseSensitive.checked,
        highlightAll: this.highlightAll.checked,
        findPrevious: findPrev
      });
      return window.dispatchEvent(event);
    },

    updateUIState:
        function PDFFindBar_updateUIState(state, previous, matchCount) {
      var notFound = false;
      var findMsg = '';
      var status = '';

      switch (state) {
        case FindStates.FIND_FOUND:
          break;

        case FindStates.FIND_PENDING:
          status = 'pending';
          break;

        case FindStates.FIND_NOTFOUND:
          findMsg = mozL10n.get('find_not_found', null, 'Phrase not found');
          notFound = true;
          break;

        case FindStates.FIND_WRAPPED:
          if (previous) {
            findMsg = mozL10n.get('find_reached_top', null,
              'Reached top of document, continued from bottom');
          } else {
            findMsg = mozL10n.get('find_reached_bottom', null,
              'Reached end of document, continued from top');
          }
          break;
      }

      if (notFound) {
        this.findField.classList.add('notFound');
      } else {
        this.findField.classList.remove('notFound');
      }

      this.findField.setAttribute('data-status', status);
      this.findMsg.textContent = findMsg;

      this.updateResultsCount(matchCount);
    },

    updateResultsCount: function(matchCount) {
      if (!this.findResultsCount) {
        return; // no UI control is provided
      }

      // If there are no matches, hide the counter
      if (!matchCount) {
        this.findResultsCount.classList.add('hidden');
        return;
      }

      // Create the match counter
      this.findResultsCount.textContent = matchCount.toLocaleString();

      // Show the counter
      this.findResultsCount.classList.remove('hidden');
    },

    open: function PDFFindBar_open() {
      if (!this.opened) {
        this.opened = true;
        this.toggleButton.classList.add('toggled');
        this.bar.classList.remove('hidden');
      }
      this.findField.select();
      this.findField.focus();
    },

    close: function PDFFindBar_close() {
      if (!this.opened) {
        return;
      }
      this.opened = false;
      this.toggleButton.classList.remove('toggled');
      this.bar.classList.add('hidden');
      this.findController.active = false;
    },

    toggle: function PDFFindBar_toggle() {
      if (this.opened) {
        this.close();
      } else {
        this.open();
      }
    }
  };
  return PDFFindBar;
})();


var FindStates = {
  FIND_FOUND: 0,
  FIND_NOTFOUND: 1,
  FIND_WRAPPED: 2,
  FIND_PENDING: 3
};

var FIND_SCROLL_OFFSET_TOP = -50;
var FIND_SCROLL_OFFSET_LEFT = -400;

/**
 * Provides "search" or "find" functionality for the PDF.
 * This object actually performs the search for a given string.
 */
var PDFFindController = (function PDFFindControllerClosure() {
  function PDFFindController(options) {
    this.startedTextExtraction = false;
    this.extractTextPromises = [];
    this.pendingFindMatches = {};
    this.active = false; // If active, find results will be highlighted.
    this.pageContents = []; // Stores the text for each page.
    this.pageMatches = [];
    this.matchCount = 0;
    this.selected = { // Currently selected match.
      pageIdx: -1,
      matchIdx: -1
    };
    this.offset = { // Where the find algorithm currently is in the document.
      pageIdx: null,
      matchIdx: null
    };
    this.pagesToSearch = null;
    this.resumePageIdx = null;
    this.state = null;
    this.dirtyMatch = false;
    this.findTimeout = null;
    this.pdfViewer = options.pdfViewer || null;
    this.integratedFind = options.integratedFind || false;
    this.charactersToNormalize = {
      '\u2018': '\'', // Left single quotation mark
      '\u2019': '\'', // Right single quotation mark
      '\u201A': '\'', // Single low-9 quotation mark
      '\u201B': '\'', // Single high-reversed-9 quotation mark
      '\u201C': '"', // Left double quotation mark
      '\u201D': '"', // Right double quotation mark
      '\u201E': '"', // Double low-9 quotation mark
      '\u201F': '"', // Double high-reversed-9 quotation mark
      '\u00BC': '1/4', // Vulgar fraction one quarter
      '\u00BD': '1/2', // Vulgar fraction one half
      '\u00BE': '3/4', // Vulgar fraction three quarters
      '\u00A0': ' ' // No-break space
    };
    this.findBar = options.findBar || null;

    // Compile the regular expression for text normalization once
    var replace = Object.keys(this.charactersToNormalize).join('');
    this.normalizationRegex = new RegExp('[' + replace + ']', 'g');

    var events = [
      'find',
      'findagain',
      'findhighlightallchange',
      'findcasesensitivitychange'
    ];

    this.firstPagePromise = new Promise(function (resolve) {
      this.resolveFirstPage = resolve;
    }.bind(this));
    this.handleEvent = this.handleEvent.bind(this);

    for (var i = 0, len = events.length; i < len; i++) {
      window.addEventListener(events[i], this.handleEvent);
    }
  }

  PDFFindController.prototype = {
    setFindBar: function PDFFindController_setFindBar(findBar) {
      this.findBar = findBar;
    },

    reset: function PDFFindController_reset() {
      this.startedTextExtraction = false;
      this.extractTextPromises = [];
      this.active = false;
    },

    normalize: function PDFFindController_normalize(text) {
      var self = this;
      return text.replace(this.normalizationRegex, function (ch) {
        return self.charactersToNormalize[ch];
      });
    },

    calcFindMatch: function PDFFindController_calcFindMatch(pageIndex) {
      var pageContent = this.normalize(this.pageContents[pageIndex]);
      var query = this.normalize(this.state.query);
      var caseSensitive = this.state.caseSensitive;
      var queryLen = query.length;

      if (queryLen === 0) {
        // Do nothing: the matches should be wiped out already.
        return;
      }

      if (!caseSensitive) {
        pageContent = pageContent.toLowerCase();
        query = query.toLowerCase();
      }

      var matches = [];
      var matchIdx = -queryLen;
      while (true) {
        matchIdx = pageContent.indexOf(query, matchIdx + queryLen);
        if (matchIdx === -1) {
          break;
        }
        matches.push(matchIdx);
      }
      this.pageMatches[pageIndex] = matches;
      this.updatePage(pageIndex);
      if (this.resumePageIdx === pageIndex) {
        this.resumePageIdx = null;
        this.nextPageMatch();
      }

      // Update the matches count
      if (matches.length > 0) {
        this.matchCount += matches.length;
        this.updateUIResultsCount();
      }
    },

    extractText: function PDFFindController_extractText() {
      if (this.startedTextExtraction) {
        return;
      }
      this.startedTextExtraction = true;

      this.pageContents = [];
      var extractTextPromisesResolves = [];
      var numPages = this.pdfViewer.pagesCount;
      for (var i = 0; i < numPages; i++) {
        this.extractTextPromises.push(new Promise(function (resolve) {
          extractTextPromisesResolves.push(resolve);
        }));
      }

      var self = this;
      function extractPageText(pageIndex) {
        self.pdfViewer.getPageTextContent(pageIndex).then(
          function textContentResolved(textContent) {
            var textItems = textContent.items;
            var str = [];

            for (var i = 0, len = textItems.length; i < len; i++) {
              str.push(textItems[i].str);
            }

            // Store the pageContent as a string.
            self.pageContents.push(str.join(''));

            extractTextPromisesResolves[pageIndex](pageIndex);
            if ((pageIndex + 1) < self.pdfViewer.pagesCount) {
              extractPageText(pageIndex + 1);
            }
          }
        );
      }
      extractPageText(0);
    },

    handleEvent: function PDFFindController_handleEvent(e) {
      if (this.state === null || e.type !== 'findagain') {
        this.dirtyMatch = true;
      }
      this.state = e.detail;
      this.updateUIState(FindStates.FIND_PENDING);

      this.firstPagePromise.then(function() {
        this.extractText();

        clearTimeout(this.findTimeout);
        if (e.type === 'find') {
          // Only trigger the find action after 250ms of silence.
          this.findTimeout = setTimeout(this.nextMatch.bind(this), 250);
        } else {
          this.nextMatch();
        }
      }.bind(this));
    },

    updatePage: function PDFFindController_updatePage(index) {
      if (this.selected.pageIdx === index) {
        // If the page is selected, scroll the page into view, which triggers
        // rendering the page, which adds the textLayer. Once the textLayer is
        // build, it will scroll onto the selected match.
        this.pdfViewer.scrollPageIntoView(index + 1);
      }

      var page = this.pdfViewer.getPageView(index);
      if (page.textLayer) {
        page.textLayer.updateMatches();
      }
    },

    nextMatch: function PDFFindController_nextMatch() {
      var previous = this.state.findPrevious;
      var currentPageIndex = this.pdfViewer.currentPageNumber - 1;
      var numPages = this.pdfViewer.pagesCount;

      this.active = true;

      if (this.dirtyMatch) {
        // Need to recalculate the matches, reset everything.
        this.dirtyMatch = false;
        this.selected.pageIdx = this.selected.matchIdx = -1;
        this.offset.pageIdx = currentPageIndex;
        this.offset.matchIdx = null;
        this.hadMatch = false;
        this.resumePageIdx = null;
        this.pageMatches = [];
        this.matchCount = 0;
        var self = this;

        for (var i = 0; i < numPages; i++) {
          // Wipe out any previous highlighted matches.
          this.updatePage(i);

          // As soon as the text is extracted start finding the matches.
          if (!(i in this.pendingFindMatches)) {
            this.pendingFindMatches[i] = true;
            this.extractTextPromises[i].then(function(pageIdx) {
              delete self.pendingFindMatches[pageIdx];
              self.calcFindMatch(pageIdx);
            });
          }
        }
      }

      // If there's no query there's no point in searching.
      if (this.state.query === '') {
        this.updateUIState(FindStates.FIND_FOUND);
        return;
      }

      // If we're waiting on a page, we return since we can't do anything else.
      if (this.resumePageIdx) {
        return;
      }

      var offset = this.offset;
      // Keep track of how many pages we should maximally iterate through.
      this.pagesToSearch = numPages;
      // If there's already a matchIdx that means we are iterating through a
      // page's matches.
      if (offset.matchIdx !== null) {
        var numPageMatches = this.pageMatches[offset.pageIdx].length;
        if ((!previous && offset.matchIdx + 1 < numPageMatches) ||
            (previous && offset.matchIdx > 0)) {
          // The simple case; we just have advance the matchIdx to select
          // the next match on the page.
          this.hadMatch = true;
          offset.matchIdx = (previous ? offset.matchIdx - 1 :
                                        offset.matchIdx + 1);
          this.updateMatch(true);
          return;
        }
        // We went beyond the current page's matches, so we advance to
        // the next page.
        this.advanceOffsetPage(previous);
      }
      // Start searching through the page.
      this.nextPageMatch();
    },

    matchesReady: function PDFFindController_matchesReady(matches) {
      var offset = this.offset;
      var numMatches = matches.length;
      var previous = this.state.findPrevious;

      if (numMatches) {
        // There were matches for the page, so initialize the matchIdx.
        this.hadMatch = true;
        offset.matchIdx = (previous ? numMatches - 1 : 0);
        this.updateMatch(true);
        return true;
      } else {
        // No matches, so attempt to search the next page.
        this.advanceOffsetPage(previous);
        if (offset.wrapped) {
          offset.matchIdx = null;
          if (this.pagesToSearch < 0) {
            // No point in wrapping again, there were no matches.
            this.updateMatch(false);
            // while matches were not found, searching for a page
            // with matches should nevertheless halt.
            return true;
          }
        }
        // Matches were not found (and searching is not done).
        return false;
      }
    },

    /**
     * The method is called back from the text layer when match presentation
     * is updated.
     * @param {number} pageIndex - page index.
     * @param {number} index - match index.
     * @param {Array} elements - text layer div elements array.
     * @param {number} beginIdx - start index of the div array for the match.
     * @param {number} endIdx - end index of the div array for the match.
     */
    updateMatchPosition: function PDFFindController_updateMatchPosition(
        pageIndex, index, elements, beginIdx, endIdx) {
      if (this.selected.matchIdx === index &&
          this.selected.pageIdx === pageIndex) {
        var spot = {
          top: FIND_SCROLL_OFFSET_TOP,
          left: FIND_SCROLL_OFFSET_LEFT
        };
        scrollIntoView(elements[beginIdx], spot,
                       /* skipOverflowHiddenElements = */ true);
      }
    },

    nextPageMatch: function PDFFindController_nextPageMatch() {
      if (this.resumePageIdx !== null) {
        console.error('There can only be one pending page.');
      }
      do {
        var pageIdx = this.offset.pageIdx;
        var matches = this.pageMatches[pageIdx];
        if (!matches) {
          // The matches don't exist yet for processing by "matchesReady",
          // so set a resume point for when they do exist.
          this.resumePageIdx = pageIdx;
          break;
        }
      } while (!this.matchesReady(matches));
    },

    advanceOffsetPage: function PDFFindController_advanceOffsetPage(previous) {
      var offset = this.offset;
      var numPages = this.extractTextPromises.length;
      offset.pageIdx = (previous ? offset.pageIdx - 1 : offset.pageIdx + 1);
      offset.matchIdx = null;

      this.pagesToSearch--;

      if (offset.pageIdx >= numPages || offset.pageIdx < 0) {
        offset.pageIdx = (previous ? numPages - 1 : 0);
        offset.wrapped = true;
      }
    },

    updateMatch: function PDFFindController_updateMatch(found) {
      var state = FindStates.FIND_NOTFOUND;
      var wrapped = this.offset.wrapped;
      this.offset.wrapped = false;

      if (found) {
        var previousPage = this.selected.pageIdx;
        this.selected.pageIdx = this.offset.pageIdx;
        this.selected.matchIdx = this.offset.matchIdx;
        state = (wrapped ? FindStates.FIND_WRAPPED : FindStates.FIND_FOUND);
        // Update the currently selected page to wipe out any selected matches.
        if (previousPage !== -1 && previousPage !== this.selected.pageIdx) {
          this.updatePage(previousPage);
        }
      }

      this.updateUIState(state, this.state.findPrevious);
      if (this.selected.pageIdx !== -1) {
        this.updatePage(this.selected.pageIdx);
      }
    },

    updateUIResultsCount:
        function PDFFindController_updateUIResultsCount() {
      if (this.findBar === null) {
        throw new Error('PDFFindController is not initialized with a ' +
          'PDFFindBar instance.');
      }
      this.findBar.updateResultsCount(this.matchCount);
    },

    updateUIState: function PDFFindController_updateUIState(state, previous) {
      if (this.integratedFind) {
        FirefoxCom.request('updateFindControlState',
                           { result: state, findPrevious: previous });
        return;
      }
      if (this.findBar === null) {
        throw new Error('PDFFindController is not initialized with a ' +
                        'PDFFindBar instance.');
      }
      this.findBar.updateUIState(state, previous, this.matchCount);
    }
  };
  return PDFFindController;
})();


/**
 * Performs navigation functions inside PDF, such as opening specified page,
 * or destination.
 * @class
 * @implements {IPDFLinkService}
 */
var PDFLinkService = (function () {
  /**
   * @constructs PDFLinkService
   */
  function PDFLinkService() {
    this.baseUrl = null;
    this.pdfDocument = null;
    this.pdfViewer = null;
    this.pdfHistory = null;

    this._pagesRefCache = null;
  }

  PDFLinkService.prototype = {
    setDocument: function PDFLinkService_setDocument(pdfDocument, baseUrl) {
      this.baseUrl = baseUrl;
      this.pdfDocument = pdfDocument;
      this._pagesRefCache = Object.create(null);
    },

    setViewer: function PDFLinkService_setViewer(pdfViewer) {
      this.pdfViewer = pdfViewer;
    },

    setHistory: function PDFLinkService_setHistory(pdfHistory) {
      this.pdfHistory = pdfHistory;
    },

    /**
     * @returns {number}
     */
    get pagesCount() {
      return this.pdfDocument.numPages;
    },

    /**
     * @returns {number}
     */
    get page() {
      return this.pdfViewer.currentPageNumber;
    },

    /**
     * @param {number} value
     */
    set page(value) {
      this.pdfViewer.currentPageNumber = value;
    },

    /**
     * @param dest - The PDF destination object.
     */
    navigateTo: function PDFLinkService_navigateTo(dest) {
      var destString = '';
      var self = this;

      var goToDestination = function(destRef) {
        // dest array looks like that: <page-ref> </XYZ|FitXXX> <args..>
        var pageNumber = destRef instanceof Object ?
          self._pagesRefCache[destRef.num + ' ' + destRef.gen + ' R'] :
          (destRef + 1);
        if (pageNumber) {
          if (pageNumber > self.pagesCount) {
            pageNumber = self.pagesCount;
          }
          self.pdfViewer.scrollPageIntoView(pageNumber, dest);

          if (self.pdfHistory) {
            // Update the browsing history.
            self.pdfHistory.push({
              dest: dest,
              hash: destString,
              page: pageNumber
            });
          }
        } else {
          self.pdfDocument.getPageIndex(destRef).then(function (pageIndex) {
            var pageNum = pageIndex + 1;
            var cacheKey = destRef.num + ' ' + destRef.gen + ' R';
            self._pagesRefCache[cacheKey] = pageNum;
            goToDestination(destRef);
          });
        }
      };

      var destinationPromise;
      if (typeof dest === 'string') {
        destString = dest;
        destinationPromise = this.pdfDocument.getDestination(dest);
      } else {
        destinationPromise = Promise.resolve(dest);
      }
      destinationPromise.then(function(destination) {
        dest = destination;
        if (!(destination instanceof Array)) {
          return; // invalid destination
        }
        goToDestination(destination[0]);
      });
    },

    getTocLink: function PDFLinkService_getTocLink(dest, label) { //[HW]
      var destString = '';
      var self = this;

      var goToDestination = function(destRef) {
        // dest array looks like that: <page-ref> </XYZ|FitXXX> <args..>
        var pageNumber = destRef instanceof Object ?
          self._pagesRefCache[destRef.num + ' ' + destRef.gen + ' R'] :
          (destRef + 1);
        if (pageNumber) {
          if (pageNumber > self.pagesCount) {
            pageNumber = self.pagesCount;
          }
          var content = {
            'label': label,
            'page': pageNumber
          };
          toc.push(content);
          return pageNumber;
        } else {
          self.pdfDocument.getPageIndex(destRef).then(function (pageIndex) {
            var pageNum = pageIndex + 1;
            var cacheKey = destRef.num + ' ' + destRef.gen + ' R';
            self._pagesRefCache[cacheKey] = pageNum;
            goToDestination(destRef);
          });
        }
      };

      var destinationPromise;
      if (typeof dest === 'string') {
        destString = dest;
        destinationPromise = this.pdfDocument.getDestination(dest);
      } else {
        destinationPromise = Promise.resolve(dest);
      }
      destinationPromise.then(function(destination) {
        dest = destination;
        if (!(destination instanceof Array)) {
          return; // invalid destination
        }
        goToDestination(destination[0]);
      });
    },

    /**
     * @param dest - The PDF destination object.
     * @returns {string} The hyperlink to the PDF object.
     */
    getDestinationHash: function PDFLinkService_getDestinationHash(dest) {
      if (typeof dest === 'string') {
        return this.getAnchorUrl('#' + escape(dest));
      }
      if (dest instanceof Array) {
        var destRef = dest[0]; // see navigateTo method for dest format
        var pageNumber = destRef instanceof Object ?
          this._pagesRefCache[destRef.num + ' ' + destRef.gen + ' R'] :
          (destRef + 1);
        if (pageNumber) {
          var pdfOpenParams = this.getAnchorUrl('#page=' + pageNumber);
          var destKind = dest[1];
          if (typeof destKind === 'object' && 'name' in destKind &&
              destKind.name === 'XYZ') {
            var scale = (dest[4] || this.pdfViewer.currentScaleValue);
            var scaleNumber = parseFloat(scale);
            if (scaleNumber) {
              scale = scaleNumber * 100;
            }
            pdfOpenParams += '&zoom=' + scale;
            if (dest[2] || dest[3]) {
              pdfOpenParams += ',' + (dest[2] || 0) + ',' + (dest[3] || 0);
            }
          }
          return pdfOpenParams;
        }
      }
      return '';
    },

    /**
     * Prefix the full url on anchor links to make sure that links are resolved
     * relative to the current URL instead of the one defined in <base href>.
     * @param {String} anchor The anchor hash, including the #.
     * @returns {string} The hyperlink to the PDF object.
     */
    getAnchorUrl: function PDFLinkService_getAnchorUrl(anchor) {
      return (this.baseUrl || '') + anchor;
    },

    /**
     * @param {string} hash
     */
    setHash: function PDFLinkService_setHash(hash) {
      if (hash.indexOf('=') >= 0) {
        var params = parseQueryString(hash);
        // borrowing syntax from "Parameters for Opening PDF Files"
        if ('twopageview' in params) {
            TwoPageViewMode.hashParams = params.twopageview;
        }

        if ('nameddest' in params) {
          if (this.pdfHistory) {
            this.pdfHistory.updateNextHashParam(params.nameddest);
          }
          this.navigateTo(params.nameddest);
          return;
        }
        var pageNumber, dest;
        if ('page' in params) {
          pageNumber = (params.page | 0) || 1;
        }
        if ('zoom' in params) {
          // Build the destination array.
          var zoomArgs = params.zoom.split(','); // scale,left,top
          var zoomArg = zoomArgs[0];
          var zoomArgNumber = parseFloat(zoomArg);

          if (zoomArg.indexOf('Fit') === -1) {
            // If the zoomArg is a number, it has to get divided by 100. If it's
            // a string, it should stay as it is.
            dest = [null, { name: 'XYZ' },
                    zoomArgs.length > 1 ? (zoomArgs[1] | 0) : null,
                    zoomArgs.length > 2 ? (zoomArgs[2] | 0) : null,
                    (zoomArgNumber ? zoomArgNumber / 100 : zoomArg)];
          } else {
            if (zoomArg === 'Fit' || zoomArg === 'FitB') {
              dest = [null, { name: zoomArg }];
            } else if ((zoomArg === 'FitH' || zoomArg === 'FitBH') ||
                       (zoomArg === 'FitV' || zoomArg === 'FitBV')) {
              dest = [null, { name: zoomArg },
                      zoomArgs.length > 1 ? (zoomArgs[1] | 0) : null];
            } else if (zoomArg === 'FitR') {
              if (zoomArgs.length !== 5) {
                console.error('PDFLinkService_setHash: ' +
                              'Not enough parameters for \'FitR\'.');
              } else {
                dest = [null, { name: zoomArg },
                        (zoomArgs[1] | 0), (zoomArgs[2] | 0),
                        (zoomArgs[3] | 0), (zoomArgs[4] | 0)];
              }
            } else {
              console.error('PDFLinkService_setHash: \'' + zoomArg +
                            '\' is not a valid zoom value.');
            }
          }
        }
        if (dest) {
          this.pdfViewer.scrollPageIntoView(pageNumber || this.page, dest);
        } else if (pageNumber) {
          this.page = pageNumber; // simple page
        }
        if ('pagemode' in params) {
          var event = document.createEvent('CustomEvent');
          event.initCustomEvent('pagemode', true, true, {
            mode: params.pagemode,
          });
          this.pdfViewer.container.dispatchEvent(event);
        }
      } else if (/^\d+$/.test(hash)) { // page number
        this.page = hash;
      } else { // named destination
        if (this.pdfHistory) {
          this.pdfHistory.updateNextHashParam(unescape(hash));
        }
        this.navigateTo(unescape(hash));
      }
    },

    /**
     * @param {string} action
     */
    executeNamedAction: function PDFLinkService_executeNamedAction(action) {
      // See PDF reference, table 8.45 - Named action
      switch (action) {
        case 'GoBack':
          if (this.pdfHistory) {
            this.pdfHistory.back();
          }
          break;

        case 'GoForward':
          if (this.pdfHistory) {
            this.pdfHistory.forward();
          }
          break;

        case 'NextPage':
          //this.page++;
            PDFViewerApplication.nextPage();
          break;

        case 'PrevPage':
          //this.page--;
            PDFViewerApplication.previousPage();
          break;

        case 'LastPage':
          //this.page = this.pagesCount;
            this.page = PDFViewerApplication.lastPageNumber;
          break;

        case 'FirstPage':
          this.page = 1;
          break;

        default:
          break; // No action according to spec
      }

      var event = document.createEvent('CustomEvent');
      event.initCustomEvent('namedaction', true, true, {
        action: action
      });
      this.pdfViewer.container.dispatchEvent(event);
    },

    /**
     * @param {number} pageNum - page number.
     * @param {Object} pageRef - reference to the page.
     */
    cachePageRef: function PDFLinkService_cachePageRef(pageNum, pageRef) {
      var refStr = pageRef.num + ' ' + pageRef.gen + ' R';
      this._pagesRefCache[refStr] = pageNum;
    }
  };

  return PDFLinkService;
})();


var PDFHistory = (function () {
  function PDFHistory(options) {
    this.linkService = options.linkService;

    this.initialized = false;
    this.initialDestination = null;
    this.initialBookmark = null;
  }

  PDFHistory.prototype = {
    /**
     * @param {string} fingerprint
     * @param {IPDFLinkService} linkService
     */
    initialize: function pdfHistoryInitialize(fingerprint) {
      this.initialized = true;
      this.reInitialized = false;
      this.allowHashChange = true;
      this.historyUnlocked = true;
      this.isViewerInPresentationMode = false;

      this.previousHash = window.location.hash.substring(1);
      this.currentBookmark = '';
      this.currentPage = 0;
      this.updatePreviousBookmark = false;
      this.previousBookmark = '';
      this.previousPage = 0;
      this.nextHashParam = '';

      this.fingerprint = fingerprint;
      this.currentUid = this.uid = 0;
      this.current = {};

      var state = window.history.state;
      if (this._isStateObjectDefined(state)) {
        // This corresponds to navigating back to the document
        // from another page in the browser history.
        if (state.target.dest) {
          this.initialDestination = state.target.dest;
        } else {
          this.initialBookmark = state.target.hash;
        }
        this.currentUid = state.uid;
        this.uid = state.uid + 1;
        this.current = state.target;
      } else {
        // This corresponds to the loading of a new document.
        if (state && state.fingerprint &&
          this.fingerprint !== state.fingerprint) {
          // Reinitialize the browsing history when a new document
          // is opened in the web viewer.
          this.reInitialized = true;
        }
        this._pushOrReplaceState({fingerprint: this.fingerprint}, true);
      }

      var self = this;
      window.addEventListener('popstate', function pdfHistoryPopstate(evt) {
        if (!self.historyUnlocked) {
          return;
        }
        if (evt.state) {
          // Move back/forward in the history.
          self._goTo(evt.state);
          return;
        }

        // If the state is not set, then the user tried to navigate to a
        // different hash by manually editing the URL and pressing Enter, or by
        // clicking on an in-page link (e.g. the "current view" link).
        // Save the current view state to the browser history.

        // Note: In Firefox, history.null could also be null after an in-page
        // navigation to the same URL, and without dispatching the popstate
        // event: https://bugzilla.mozilla.org/show_bug.cgi?id=1183881

          if (self.uid === 0) {
          // Replace the previous state if it was not explicitly set.
            var previousParams = (self.previousHash && self.currentBookmark &&
            self.previousHash !== self.currentBookmark) ?
            {hash: self.currentBookmark, page: self.currentPage} :
            {page: 1};
          replacePreviousHistoryState(previousParams, function() {
            updateHistoryWithCurrentHash();
          });
        } else {
          updateHistoryWithCurrentHash();
        }
      }, false);


      function updateHistoryWithCurrentHash() {
        self.previousHash = window.location.hash.slice(1);
        self._pushToHistory({hash: self.previousHash}, false, true);
        self._updatePreviousBookmark();
      }

      function replacePreviousHistoryState(params, callback) {
        // To modify the previous history entry, the following happens:
        // 1. history.back()
        // 2. _pushToHistory, which calls history.replaceState( ... )
        // 3. history.forward()
        // Because a navigation via the history API does not immediately update
        // the history state, the popstate event is used for synchronization.
            self.historyUnlocked = false;

        // Suppress the hashchange event to avoid side effects caused by
        // navigating back and forward.
            self.allowHashChange = false;
        window.addEventListener('popstate', rewriteHistoryAfterBack);
        history.back();

        function rewriteHistoryAfterBack() {
          window.removeEventListener('popstate', rewriteHistoryAfterBack);
          window.addEventListener('popstate', rewriteHistoryAfterForward);
          self._pushToHistory(params, false, true);
          history.forward();
        }
        function rewriteHistoryAfterForward() {
          window.removeEventListener('popstate', rewriteHistoryAfterForward);
          self.allowHashChange = true;
            self.historyUnlocked = true;
          callback();
          }
        }

      function pdfHistoryBeforeUnload() {
        var previousParams = self._getPreviousParams(null, true);
        if (previousParams) {
          var replacePrevious = (!self.current.dest &&
          self.current.hash !== self.previousHash);
          self._pushToHistory(previousParams, false, replacePrevious);
          self._updatePreviousBookmark();
        }
        // Remove the event listener when navigating away from the document,
        // since 'beforeunload' prevents Firefox from caching the document.
        window.removeEventListener('beforeunload', pdfHistoryBeforeUnload,
                                   false);
      }

      window.addEventListener('beforeunload', pdfHistoryBeforeUnload, false);

      window.addEventListener('pageshow', function pdfHistoryPageShow(evt) {
        // If the entire viewer (including the PDF file) is cached in
        // the browser, we need to reattach the 'beforeunload' event listener
        // since the 'DOMContentLoaded' event is not fired on 'pageshow'.
        window.addEventListener('beforeunload', pdfHistoryBeforeUnload, false);
      }, false);

      window.addEventListener('presentationmodechanged', function(e) {
        self.isViewerInPresentationMode = !!e.detail.active;
      });
    },

    clearHistoryState: function pdfHistory_clearHistoryState() {
      this._pushOrReplaceState(null, true);
    },

    _isStateObjectDefined: function pdfHistory_isStateObjectDefined(state) {
      return (state && state.uid >= 0 &&
      state.fingerprint && this.fingerprint === state.fingerprint &&
      state.target && state.target.hash) ? true : false;
    },

    _pushOrReplaceState: function pdfHistory_pushOrReplaceState(stateObj,
                                                                replace) {
      if (replace) {
        window.history.replaceState(stateObj, '', document.URL);
      } else {
        window.history.pushState(stateObj, '', document.URL);
      }
    },

    get isHashChangeUnlocked() {
      if (!this.initialized) {
        return true;
      }
      return this.allowHashChange;
    },

    _updatePreviousBookmark: function pdfHistory_updatePreviousBookmark() {
      if (this.updatePreviousBookmark &&
        this.currentBookmark && this.currentPage) {
        this.previousBookmark = this.currentBookmark;
        this.previousPage = this.currentPage;
        this.updatePreviousBookmark = false;
      }
    },

    updateCurrentBookmark: function pdfHistoryUpdateCurrentBookmark(bookmark,
                                                                    pageNum) {
      if (this.initialized) {
        this.currentBookmark = bookmark.substring(1);
        this.currentPage = pageNum | 0;
        this._updatePreviousBookmark();
      }
    },

    updateNextHashParam: function pdfHistoryUpdateNextHashParam(param) {
      if (this.initialized) {
        this.nextHashParam = param;
      }
    },

    push: function pdfHistoryPush(params, isInitialBookmark) {
      if (!(this.initialized && this.historyUnlocked)) {
        return;
      }
      if (params.dest && !params.hash) {
        params.hash = (this.current.hash && this.current.dest &&
        this.current.dest === params.dest) ?
          this.current.hash :
          this.linkService.getDestinationHash(params.dest).split('#')[1];
      }
      if (params.page) {
        params.page |= 0;
      }
      if (isInitialBookmark) {
        var target = window.history.state.target;
        if (!target) {
          // Invoked when the user specifies an initial bookmark,
          // thus setting initialBookmark, when the document is loaded.
          this._pushToHistory(params, false);
          this.previousHash = window.location.hash.substring(1);
        }
        this.updatePreviousBookmark = this.nextHashParam ? false : true;
        if (target) {
          // If the current document is reloaded,
          // avoid creating duplicate entries in the history.
          this._updatePreviousBookmark();
        }
        return;
      }
      if (this.nextHashParam) {
        if (this.nextHashParam === params.hash) {
          this.nextHashParam = null;
          this.updatePreviousBookmark = true;
          return;
        } else {
          this.nextHashParam = null;
        }
      }

      if (params.hash) {
        if (this.current.hash) {
          if (this.current.hash !== params.hash) {
            this._pushToHistory(params, true);
          } else {
            if (!this.current.page && params.page) {
              this._pushToHistory(params, false, true);
            }
            this.updatePreviousBookmark = true;
          }
        } else {
          this._pushToHistory(params, true);
        }
      } else if (this.current.page && params.page &&
        this.current.page !== params.page) {
        this._pushToHistory(params, true);
      }
    },

    _getPreviousParams: function pdfHistory_getPreviousParams(onlyCheckPage,
                                                              beforeUnload) {
      if (!(this.currentBookmark && this.currentPage)) {
        return null;
      } else if (this.updatePreviousBookmark) {
        this.updatePreviousBookmark = false;
      }
      if (this.uid > 0 && !(this.previousBookmark && this.previousPage)) {
        // Prevent the history from getting stuck in the current state,
        // effectively preventing the user from going back/forward in
        // the history.
        //
        // This happens if the current position in the document didn't change
        // when the history was previously updated. The reasons for this are
        // either:
        // 1. The current zoom value is such that the document does not need to,
        //    or cannot, be scrolled to display the destination.
        // 2. The previous destination is broken, and doesn't actally point to a
        //    position within the document.
        //    (This is either due to a bad PDF generator, or the user making a
        //     mistake when entering a destination in the hash parameters.)
        return null;
      }
      if ((!this.current.dest && !onlyCheckPage) || beforeUnload) {
        if (this.previousBookmark === this.currentBookmark) {
          return null;
        }
      } else if (this.current.page || onlyCheckPage) {
        if (this.previousPage === this.currentPage) {
          return null;
        }
      } else {
        return null;
      }
      var params = {hash: this.currentBookmark, page: this.currentPage};
      if (this.isViewerInPresentationMode) {
        params.hash = null;
      }
      return params;
    },

    _stateObj: function pdfHistory_stateObj(params) {
      return {fingerprint: this.fingerprint, uid: this.uid, target: params};
    },

    _pushToHistory: function pdfHistory_pushToHistory(params,
                                                      addPrevious, overwrite) {
      if (!this.initialized) {
        return;
      }
      if (!params.hash && params.page) {
        params.hash = ('page=' + params.page);
      }
      if (addPrevious && !overwrite) {
        var previousParams = this._getPreviousParams();
        if (previousParams) {
          var replacePrevious = (!this.current.dest &&
          this.current.hash !== this.previousHash);
          this._pushToHistory(previousParams, false, replacePrevious);
        }
      }
      this._pushOrReplaceState(this._stateObj(params),
        (overwrite || this.uid === 0));
      this.currentUid = this.uid++;
      this.current = params;
      this.updatePreviousBookmark = true;
    },

    _goTo: function pdfHistory_goTo(state) {
      if (!(this.initialized && this.historyUnlocked &&
        this._isStateObjectDefined(state))) {
        return;
      }
      if (!this.reInitialized && state.uid < this.currentUid) {
        var previousParams = this._getPreviousParams(true);
        if (previousParams) {
          this._pushToHistory(this.current, false);
          this._pushToHistory(previousParams, false);
          this.currentUid = state.uid;
          window.history.back();
          return;
        }
      }
      this.historyUnlocked = false;

      if (state.target.dest) {
        this.linkService.navigateTo(state.target.dest);
      } else {
        this.linkService.setHash(state.target.hash);
      }
      this.currentUid = state.uid;
      if (state.uid > this.uid) {
        this.uid = state.uid;
      }
      this.current = state.target;
      this.updatePreviousBookmark = true;

      var currentHash = window.location.hash.substring(1);
      if (this.previousHash !== currentHash) {
        this.allowHashChange = false;
      }
      this.previousHash = currentHash;

      this.historyUnlocked = true;
    },

    back: function pdfHistoryBack() {
      this.go(-1);
    },

    forward: function pdfHistoryForward() {
      this.go(1);
    },

    go: function pdfHistoryGo(direction) {
      if (this.initialized && this.historyUnlocked) {
        var state = window.history.state;
        if (direction === -1 && state && state.uid > 0) {
          window.history.back();
        } else if (direction === 1 && state && state.uid < (this.uid - 1)) {
          window.history.forward();
        }
      }
    }
  };

  return PDFHistory;
})();


var SecondaryToolbar = {
  opened: false,
  previousContainerHeight: null,
  newContainerHeight: null,

  initialize: function secondaryToolbarInitialize(options) {
    this.toolbar = options.toolbar;
    this.presentationMode = options.presentationMode;
    this.twoPageViewMode = options.twoPageViewMode;
    //this.buttonContainer = this.toolbar.firstElementChild;

    // Define the toolbar buttons.
    this.toggleButton = options.toggleButton;
    this.presentationModeButton = options.presentationModeButton;
    this.openFile = options.openFile;
    this.print = options.print;
    this.download = options.download;
    this.viewBookmark = options.viewBookmark;
    this.firstPage = options.firstPage;
    this.lastPage = options.lastPage;
    this.pageRotateCw = options.pageRotateCw;
    this.pageRotateCcw = options.pageRotateCcw;
    this.onePageView = options.onePageView;
    this.twoPageView = options.twoPageView;
    this.documentPropertiesButton = options.documentPropertiesButton;

    // Attach the event listeners.
    var elements = [
      // Button to toggle the visibility of the secondary toolbar:
      { element: this.toggleButton, handler: this.toggle },
      // All items within the secondary toolbar
      // (except for toggleHandTool, hand_tool.js is responsible for it):
      { element: this.presentationModeButton,
        handler: this.presentationModeClick },
      { element: this.openFile, handler: this.openFileClick },
      { element: this.print, handler: this.printClick },
      { element: this.download, handler: this.downloadClick },
      { element: this.viewBookmark, handler: this.viewBookmarkClick },
      { element: this.firstPage, handler: this.firstPageClick },
      { element: this.lastPage, handler: this.lastPageClick },
      { element: this.pageRotateCw, handler: this.pageRotateCwClick },
      { element: this.pageRotateCcw, handler: this.pageRotateCcwClick },
      { element: this.onePageView, handler: this.twoPageViewMode.disable,
        scope: this.twoPageViewMode },
      { element: this.twoPageView, handler: this.twoPageViewMode.enable,
        scope: this.twoPageViewMode },
      { element: this.documentPropertiesButton,
        handler: this.documentPropertiesClick }
    ];

    for (var item in elements) {
      var element = elements[item].element;
      if (element) {
        element.addEventListener('click', elements[item].handler.bind(this));
      }
    }
  },

  // Event handling functions.
  presentationModeClick: function secondaryToolbarPresentationModeClick(evt) {
    PDFViewerApplication.requestPresentationMode();
    this.close();
  },

  openFileClick: function secondaryToolbarOpenFileClick(evt) {
    document.getElementById('fileInput').click();
    this.close();
  },

  printClick: function secondaryToolbarPrintClick(evt) {
    window.print();
    this.close();
  },

  downloadClick: function secondaryToolbarDownloadClick(evt) {
    PDFViewerApplication.download();
    this.close();
  },

  viewBookmarkClick: function secondaryToolbarViewBookmarkClick(evt) {
    this.close();
  },

  firstPageClick: function secondaryToolbarFirstPageClick(evt) {
    PDFViewerApplication.page = 1;
    this.close();
  },

  lastPageClick: function secondaryToolbarLastPageClick(evt) {
    if (PDFViewerApplication.pdfDocument) {
      PDFViewerApplication.page = PDFViewerApplication.pagesCount;
    }
    this.close();
  },

  pageRotateCwClick: function secondaryToolbarPageRotateCwClick(evt) {
    PDFViewerApplication.rotatePages(90);
  },

  pageRotateCcwClick: function secondaryToolbarPageRotateCcwClick(evt) {
    PDFViewerApplication.rotatePages(-90);
  },

  documentPropertiesClick: function secondaryToolbarDocumentPropsClick(evt) {
    PDFViewerApplication.pdfDocumentProperties.open();
    this.close();
  },

  // Misc. functions for interacting with the toolbar.
  setMaxHeight: function secondaryToolbarSetMaxHeight(container) {
    if (!container || !this.buttonContainer) {
      return;
    }
    this.newContainerHeight = container.clientHeight;
    if (this.previousContainerHeight === this.newContainerHeight) {
      return;
    }
    this.buttonContainer.setAttribute('style',
      'max-height: ' + (this.newContainerHeight - SCROLLBAR_PADDING) + 'px;');
    this.previousContainerHeight = this.newContainerHeight;
  },

  open: function secondaryToolbarOpen() {
    if (this.opened) {
      return;
    }
    this.opened = true;
    this.toggleButton.classList.add('toggled');
    this.toolbar.classList.remove('hidden');
  },

  close: function secondaryToolbarClose(target) {
    if (!this.opened) {
      return;
    } else if (target && !this.toolbar.contains(target)) {
      return;
    }
    this.opened = false;
    this.toolbar.classList.add('hidden');
    this.toggleButton.classList.remove('toggled');
  },

  toggle: function secondaryToolbarToggle() {
    if (this.opened) {
      this.close();
    } else {
      this.open();
    }
  }
};


var DELAY_BEFORE_RESETTING_SWITCH_IN_PROGRESS = 1500; // in ms
var DELAY_BEFORE_HIDING_CONTROLS = 3000; // in ms
var ACTIVE_SELECTOR = 'pdfPresentationMode';
var CONTROLS_SELECTOR = 'pdfPresentationModeControls';

/**
 * @typedef {Object} PDFPresentationModeOptions
 * @property {HTMLDivElement} container - The container for the viewer element.
 * @property {HTMLDivElement} viewer - (optional) The viewer element.
 * @property {PDFViewer} pdfViewer - The document viewer.
 * @property {PDFThumbnailViewer} pdfThumbnailViewer - (optional) The thumbnail
 *   viewer.
 * @property {Array} contextMenuItems - (optional) The menuitems that are added
 *   to the context menu in Presentation Mode.
 */

/**
 * @class
 */
var PDFPresentationMode = (function PDFPresentationModeClosure() {
  /**
   * @constructs PDFPresentationMode
   * @param {PDFPresentationModeOptions} options
   */
  function PDFPresentationMode(options) {
    this.container = options.container;
    this.viewer = options.viewer || options.container.firstElementChild;
    this.pdfViewer = options.pdfViewer;
    this.pdfThumbnailViewer = options.pdfThumbnailViewer || null;
    var contextMenuItems = options.contextMenuItems || null;

    this.active = false;
    this.args = null;
    this.contextMenuOpen = false;
    this.mouseScrollTimeStamp = 0;
    this.mouseScrollDelta = 0;

    if (contextMenuItems) {
      for (var i = 0, ii = contextMenuItems.length; i < ii; i++) {
        var item = contextMenuItems[i];
        item.element.addEventListener('click', function (handler) {
          this.contextMenuOpen = false;
          handler();
        }.bind(this, item.handler));
      }
    }
  }

  PDFPresentationMode.prototype = {
    /**
     * Request the browser to enter fullscreen mode.
     * @returns {boolean} Indicating if the request was successful.
     */
    request: function PDFPresentationMode_request() {
      if (this.switchInProgress || this.active ||
          !this.viewer.hasChildNodes()) {
        return false;
      }
      this._addFullscreenChangeListeners();
      this._setSwitchInProgress();
      this._notifyStateChange();

      if (this.container.requestFullscreen) {
        this.container.requestFullscreen();
      } else if (this.container.mozRequestFullScreen) {
        this.container.mozRequestFullScreen();
      } else if (this.container.webkitRequestFullscreen) {
        this.container.webkitRequestFullscreen(Element.ALLOW_KEYBOARD_INPUT);
      } else if (this.container.msRequestFullscreen) {
        this.container.msRequestFullscreen();
      } else {
        return false;
      }

      this.args = {
        page: this.pdfViewer.currentPageNumber,
        previousScale: this.pdfViewer.currentScaleValue,
      };

      return true;
    },

    /**
     * Switches page when the user scrolls (using a scroll wheel or a touchpad)
     * with large enough motion, to prevent accidental page switches.
     * @param {number} delta - The delta value from the mouse event.
     */
    mouseScroll: function PDFPresentationMode_mouseScroll(delta) {
      if (!this.active) {
        return;
      }
      var MOUSE_SCROLL_COOLDOWN_TIME = 50;
      var PAGE_SWITCH_THRESHOLD = 120;
      var PageSwitchDirection = {
        UP: -1,
        DOWN: 1
      };

      var currentTime = (new Date()).getTime();
      var storedTime = this.mouseScrollTimeStamp;

      // If we've already switched page, avoid accidentally switching again.
      if (currentTime > storedTime &&
          currentTime - storedTime < MOUSE_SCROLL_COOLDOWN_TIME) {
        return;
      }
      // If the scroll direction changed, reset the accumulated scroll delta.
      if ((this.mouseScrollDelta > 0 && delta < 0) ||
          (this.mouseScrollDelta < 0 && delta > 0)) {
        this._resetMouseScrollState();
      }
      this.mouseScrollDelta += delta;

      if (Math.abs(this.mouseScrollDelta) >= PAGE_SWITCH_THRESHOLD) {
        var pageSwitchDirection = (this.mouseScrollDelta > 0) ?
          PageSwitchDirection.UP : PageSwitchDirection.DOWN;
        var page = this.pdfViewer.currentPageNumber;
        this._resetMouseScrollState();

        // If we're at the first/last page, we don't need to do anything.
        if ((page === 1 && pageSwitchDirection === PageSwitchDirection.UP) ||
            (page === PDFViewerApplication.lastPageNumber &&//phoebe
             pageSwitchDirection === PageSwitchDirection.DOWN)) {
          return;
        }
        //this.pdfViewer.currentPageNumber = (page + pageSwitchDirection);
        if (pageFlipDirection > 0) {//phoebe
            PDFViewerApplication.nextPage();
        } else {
            PDFViewerApplication.previousPage();
        }

        this.mouseScrollTimeStamp = currentTime;
      }
    },

    get isFullscreen() {
      return !!(document.fullscreenElement ||
                document.mozFullScreen ||
                document.webkitIsFullScreen ||
                document.msFullscreenElement);
    },

    /**
     * @private
     */
    _notifyStateChange: function PDFPresentationMode_notifyStateChange() {
      var event = document.createEvent('CustomEvent');
      event.initCustomEvent('presentationmodechanged', true, true, {
        active: this.active,
        switchInProgress: !!this.switchInProgress
      });
      window.dispatchEvent(event);
    },

    /**
     * Used to initialize a timeout when requesting Presentation Mode,
     * i.e. when the browser is requested to enter fullscreen mode.
     * This timeout is used to prevent the current page from being scrolled
     * partially, or completely, out of view when entering Presentation Mode.
     * NOTE: This issue seems limited to certain zoom levels (e.g. page-width).
     * @private
     */
    _setSwitchInProgress: function PDFPresentationMode_setSwitchInProgress() {
      if (this.switchInProgress) {
        clearTimeout(this.switchInProgress);
      }
      this.switchInProgress = setTimeout(function switchInProgressTimeout() {
        this._removeFullscreenChangeListeners();
        delete this.switchInProgress;
        this._notifyStateChange();
      }.bind(this), DELAY_BEFORE_RESETTING_SWITCH_IN_PROGRESS);
    },

    /**
     * @private
     */
    _resetSwitchInProgress:
        function PDFPresentationMode_resetSwitchInProgress() {
      if (this.switchInProgress) {
        clearTimeout(this.switchInProgress);
        delete this.switchInProgress;
      }
    },

    /**
     * @private
     */
    _enter: function PDFPresentationMode_enter() {
      this.active = true;
      this._resetSwitchInProgress();
      this._notifyStateChange();
      this.container.classList.add(ACTIVE_SELECTOR);

      // Ensure that the correct page is scrolled into view when entering
      // Presentation Mode, by waiting until fullscreen mode in enabled.
      setTimeout(function enterPresentationModeTimeout() {
        this.pdfViewer.currentPageNumber = this.args.page;
        this.pdfViewer.currentScaleValue = 'page-fit';
      }.bind(this), 0);

      this._addWindowListeners();
      this._showControls();
      this.contextMenuOpen = false;
      this.container.setAttribute('contextmenu', 'viewerContextMenu');

      // Text selection is disabled in Presentation Mode, thus it's not possible
      // for the user to deselect text that is selected (e.g. with "Select all")
      // when entering Presentation Mode, hence we remove any active selection.
      window.getSelection().removeAllRanges();
    },

    /**
     * @private
     */
    _exit: function PDFPresentationMode_exit() {
      var page = this.pdfViewer.currentPageNumber;
      this.container.classList.remove(ACTIVE_SELECTOR);

      // Ensure that the correct page is scrolled into view when exiting
      // Presentation Mode, by waiting until fullscreen mode is disabled.
      setTimeout(function exitPresentationModeTimeout() {
        this.active = false;
        this._removeFullscreenChangeListeners();
        this._notifyStateChange();

        this.pdfViewer.currentScaleValue = this.args.previousScale;
        this.pdfViewer.currentPageNumber = page;
        this.args = null;
      }.bind(this), 0);

      this._removeWindowListeners();
      this._hideControls();
      this._resetMouseScrollState();
      this.container.removeAttribute('contextmenu');
      this.contextMenuOpen = false;

      if (this.pdfThumbnailViewer) {
        this.pdfThumbnailViewer.ensureThumbnailVisible(page);
      }
    },

    /**
     * @private
     */
    _mouseDown: function PDFPresentationMode_mouseDown(evt) {
      if (this.contextMenuOpen) {
        this.contextMenuOpen = false;
        evt.preventDefault();
        return;
      }
      if (evt.button === 0) {
        // Enable clicking of links in presentation mode. Please note:
        // Only links pointing to destinations in the current PDF document work.
        var isInternalLink = (evt.target.href &&
                              evt.target.classList.contains('internalLink'));
        if (!isInternalLink) {
          // Unless an internal link was clicked, advance one page.
          evt.preventDefault();
          //this.pdfViewer.currentPageNumber += (evt.shiftKey ? -1 : 1);
        if (evt.shiftKey) {
            PDFViewerApplication.previousPage();
        } else {
            PDFViewerApplication.nextPage();
        }

        }
      }
    },

    /**
     * @private
     */
    _contextMenu: function PDFPresentationMode_contextMenu() {
      this.contextMenuOpen = true;
    },

    /**
     * @private
     */
    _showControls: function PDFPresentationMode_showControls() {
      if (this.controlsTimeout) {
        clearTimeout(this.controlsTimeout);
      } else {
        this.container.classList.add(CONTROLS_SELECTOR);
      }
      this.controlsTimeout = setTimeout(function showControlsTimeout() {
        this.container.classList.remove(CONTROLS_SELECTOR);
        delete this.controlsTimeout;
      }.bind(this), DELAY_BEFORE_HIDING_CONTROLS);
    },

    /**
     * @private
     */
    _hideControls: function PDFPresentationMode_hideControls() {
      if (!this.controlsTimeout) {
        return;
      }
      clearTimeout(this.controlsTimeout);
      this.container.classList.remove(CONTROLS_SELECTOR);
      delete this.controlsTimeout;
    },

    /**
     * Resets the properties used for tracking mouse scrolling events.
     * @private
     */
    _resetMouseScrollState:
        function PDFPresentationMode_resetMouseScrollState() {
      this.mouseScrollTimeStamp = 0;
      this.mouseScrollDelta = 0;
    },

    /**
     * @private
     */
    _addWindowListeners: function PDFPresentationMode_addWindowListeners() {
      this.showControlsBind = this._showControls.bind(this);
      this.mouseDownBind = this._mouseDown.bind(this);
      this.resetMouseScrollStateBind = this._resetMouseScrollState.bind(this);
      this.contextMenuBind = this._contextMenu.bind(this);

      window.addEventListener('mousemove', this.showControlsBind);
      window.addEventListener('mousedown', this.mouseDownBind);
      window.addEventListener('keydown', this.resetMouseScrollStateBind);
      window.addEventListener('contextmenu', this.contextMenuBind);
    },

    /**
     * @private
     */
    _removeWindowListeners:
        function PDFPresentationMode_removeWindowListeners() {
      window.removeEventListener('mousemove', this.showControlsBind);
      window.removeEventListener('mousedown', this.mouseDownBind);
      window.removeEventListener('keydown', this.resetMouseScrollStateBind);
      window.removeEventListener('contextmenu', this.contextMenuBind);

      delete this.showControlsBind;
      delete this.mouseDownBind;
      delete this.resetMouseScrollStateBind;
      delete this.contextMenuBind;
    },

    /**
     * @private
     */
    _fullscreenChange: function PDFPresentationMode_fullscreenChange() {
      if (this.isFullscreen) {
        this._enter();
      } else {
        this._exit();
      }
    },

    /**
     * @private
     */
    _addFullscreenChangeListeners:
        function PDFPresentationMode_addFullscreenChangeListeners() {
      this.fullscreenChangeBind = this._fullscreenChange.bind(this);

      window.addEventListener('fullscreenchange', this.fullscreenChangeBind);
      window.addEventListener('mozfullscreenchange', this.fullscreenChangeBind);
      window.addEventListener('webkitfullscreenchange',
                              this.fullscreenChangeBind);
      window.addEventListener('MSFullscreenChange', this.fullscreenChangeBind);
    },

    /**
     * @private
     */
    _removeFullscreenChangeListeners:
        function PDFPresentationMode_removeFullscreenChangeListeners() {
      window.removeEventListener('fullscreenchange', this.fullscreenChangeBind);
      window.removeEventListener('mozfullscreenchange',
                                 this.fullscreenChangeBind);
      window.removeEventListener('webkitfullscreenchange',
                              this.fullscreenChangeBind);
      window.removeEventListener('MSFullscreenChange',
                                 this.fullscreenChangeBind);

      delete this.fullscreenChangeBind;
    }
  };

  return PDFPresentationMode;
})();


/* Copyright 2013 Rob Wu <gwnRob@gmail.com>
 * https://github.com/Rob--W/grab-to-pan.js
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

var GrabToPan = (function GrabToPanClosure() {
  /**
   * Construct a GrabToPan instance for a given HTML element.
   * @param options.element {Element}
   * @param options.ignoreTarget {function} optional. See `ignoreTarget(node)`
   * @param options.onActiveChanged {function(boolean)} optional. Called
   *  when grab-to-pan is (de)activated. The first argument is a boolean that
   *  shows whether grab-to-pan is activated.
   */
  function GrabToPan(options) {
    this.element = options.element;
    this.document = options.element.ownerDocument;
    if (typeof options.ignoreTarget === 'function') {
      this.ignoreTarget = options.ignoreTarget;
    }
    this.onActiveChanged = options.onActiveChanged;

    // Bind the contexts to ensure that `this` always points to
    // the GrabToPan instance.
    this.activate = this.activate.bind(this);
    this.deactivate = this.deactivate.bind(this);
    this.toggle = this.toggle.bind(this);
    this._onmousedown = this._onmousedown.bind(this);
    this._onmousemove = this._onmousemove.bind(this);
    this._endPan = this._endPan.bind(this);

    // This overlay will be inserted in the document when the mouse moves during
    // a grab operation, to ensure that the cursor has the desired appearance.
    var overlay = this.overlay = document.createElement('div');
    overlay.className = 'grab-to-pan-grabbing';
  }
  GrabToPan.prototype = {
    /**
     * Class name of element which can be grabbed
     */
    CSS_CLASS_GRAB: 'grab-to-pan-grab',

    /**
     * Bind a mousedown event to the element to enable grab-detection.
     */
    activate: function GrabToPan_activate() {
      if (!this.active) {
        this.active = true;
        this.element.addEventListener('mousedown', this._onmousedown, true);
        this.element.classList.add(this.CSS_CLASS_GRAB);
        if (this.onActiveChanged) {
          this.onActiveChanged(true);
        }
      }
    },

    /**
     * Removes all events. Any pending pan session is immediately stopped.
     */
    deactivate: function GrabToPan_deactivate() {
      if (this.active) {
        this.active = false;
        this.element.removeEventListener('mousedown', this._onmousedown, true);
        this._endPan();
        this.element.classList.remove(this.CSS_CLASS_GRAB);
        if (this.onActiveChanged) {
          this.onActiveChanged(false);
        }
      }
    },

    toggle: function GrabToPan_toggle() {
      if (this.active) {
        this.deactivate();
      } else {
        this.activate();
      }
    },

    /**
     * Whether to not pan if the target element is clicked.
     * Override this method to change the default behaviour.
     *
     * @param node {Element} The target of the event
     * @return {boolean} Whether to not react to the click event.
     */
    ignoreTarget: function GrabToPan_ignoreTarget(node) {
      // Use matchesSelector to check whether the clicked element
      // is (a child of) an input element / link
      return node[matchesSelector](
        'a[href], a[href] *, input, textarea, button, button *, select, option'
      );
    },

    /**
     * @private
     */
    _onmousedown: function GrabToPan__onmousedown(event) {
      if (event.button !== 0 || this.ignoreTarget(event.target)) {
        return;
      }
      if (event.originalTarget) {
        try {
          /* jshint expr:true */
          event.originalTarget.tagName;
        } catch (e) {
          // Mozilla-specific: element is a scrollbar (XUL element)
          return;
        }
      }

      this.scrollLeftStart = this.element.scrollLeft;
      this.scrollTopStart = this.element.scrollTop;
      this.clientXStart = event.clientX;
      this.clientYStart = event.clientY;
      this.document.addEventListener('mousemove', this._onmousemove, true);
      this.document.addEventListener('mouseup', this._endPan, true);
      // When a scroll event occurs before a mousemove, assume that the user
      // dragged a scrollbar (necessary for Opera Presto, Safari and IE)
      // (not needed for Chrome/Firefox)
      this.element.addEventListener('scroll', this._endPan, true);
      event.preventDefault();
      event.stopPropagation();
      this.document.documentElement.classList.add(this.CSS_CLASS_GRABBING);

      var focusedElement = document.activeElement;
      if (focusedElement && !focusedElement.contains(event.target)) {
        focusedElement.blur();
      }
    },

    /**
     * @private
     */
    _onmousemove: function GrabToPan__onmousemove(event) {
      this.element.removeEventListener('scroll', this._endPan, true);
      if (isLeftMouseReleased(event)) {
        this._endPan();
        return;
      }
      var xDiff = event.clientX - this.clientXStart;
      var yDiff = event.clientY - this.clientYStart;
      this.element.scrollTop = this.scrollTopStart - yDiff;
      this.element.scrollLeft = this.scrollLeftStart - xDiff;
      if (!this.overlay.parentNode) {
        document.body.appendChild(this.overlay);
      }
    },

    /**
     * @private
     */
    _endPan: function GrabToPan__endPan() {
      this.element.removeEventListener('scroll', this._endPan, true);
      this.document.removeEventListener('mousemove', this._onmousemove, true);
      this.document.removeEventListener('mouseup', this._endPan, true);
      if (this.overlay.parentNode) {
        this.overlay.parentNode.removeChild(this.overlay);
      }
    }
  };

  // Get the correct (vendor-prefixed) name of the matches method.
  var matchesSelector;
  ['webkitM', 'mozM', 'msM', 'oM', 'm'].some(function(prefix) {
    var name = prefix + 'atches';
    if (name in document.documentElement) {
      matchesSelector = name;
    }
    name += 'Selector';
    if (name in document.documentElement) {
      matchesSelector = name;
    }
    return matchesSelector; // If found, then truthy, and [].some() ends.
  });

  // Browser sniffing because it's impossible to feature-detect
  // whether event.which for onmousemove is reliable
  var isNotIEorIsIE10plus = !document.documentMode || document.documentMode > 9;
  var chrome = window.chrome;
  var isChrome15OrOpera15plus = chrome && (chrome.webstore || chrome.app);
  //                                       ^ Chrome 15+       ^ Opera 15+
  var isSafari6plus = /Apple/.test(navigator.vendor) &&
                      /Version\/([6-9]\d*|[1-5]\d+)/.test(navigator.userAgent);

  /**
   * Whether the left mouse is not pressed.
   * @param event {MouseEvent}
   * @return {boolean} True if the left mouse button is not pressed.
   *                   False if unsure or if the left mouse button is pressed.
   */
  function isLeftMouseReleased(event) {
    if ('buttons' in event && isNotIEorIsIE10plus) {
      // http://www.w3.org/TR/DOM-Level-3-Events/#events-MouseEvent-buttons
      // Firefox 15+
      // Internet Explorer 10+
      return !(event.buttons | 1);
    }
    if (isChrome15OrOpera15plus || isSafari6plus) {
      // Chrome 14+
      // Opera 15+
      // Safari 6.0+
      return event.which === 0;
    }
  }

  return GrabToPan;
})();

var HandTool = {
  initialize: function handToolInitialize(options) {
    var toggleHandTool = options.toggleHandTool;
    this.handTool = new GrabToPan({
      element: options.container,
      onActiveChanged: function(isActive) {
        if (!toggleHandTool) {
          return;
        }
        if (isActive) {
          toggleHandTool.title =
            mozL10n.get('hand_tool_disable.title', null, 'Disable hand tool');
          toggleHandTool.firstElementChild.textContent =
            mozL10n.get('hand_tool_disable_label', null, 'Disable hand tool');
        } else {
          toggleHandTool.title =
            mozL10n.get('hand_tool_enable.title', null, 'Enable hand tool');
          toggleHandTool.firstElementChild.textContent =
            mozL10n.get('hand_tool_enable_label', null, 'Enable hand tool');
        }
      }
    });
    if (toggleHandTool) {
      toggleHandTool.addEventListener('click', this.toggle.bind(this), false);

      window.addEventListener('localized', function (evt) {
        Preferences.get('enableHandToolOnLoad').then(function resolved(value) {
          if (value) {
            this.handTool.activate();
          }
        }.bind(this), function rejected(reason) {});
      }.bind(this));

      window.addEventListener('presentationmodechanged', function (evt) {
        if (evt.detail.switchInProgress) {
          return;
        }
        if (evt.detail.active) {
          this.enterPresentationMode();
        } else {
          this.exitPresentationMode();
        }
      }.bind(this));
    }
  },

  toggle: function handToolToggle() {
    this.handTool.toggle();
    //[Bruce]
    //SecondaryToolbar.close();
  },

  enterPresentationMode: function handToolEnterPresentationMode() {
    if (this.handTool.active) {
      this.wasActive = true;
      this.handTool.deactivate();
    }
  },

  exitPresentationMode: function handToolExitPresentationMode() {
    if (this.wasActive) {
      this.wasActive = null;
      this.handTool.activate();
    }
  }
};


var OverlayManager = {
  overlays: {},
  active: null,

  /**
   * @param {string} name The name of the overlay that is registered. This must
   *                 be equal to the ID of the overlay's DOM element.
   * @param {function} callerCloseMethod (optional) The method that, if present,
   *                   will call OverlayManager.close from the Object
   *                   registering the overlay. Access to this method is
   *                   necessary in order to run cleanup code when e.g.
   *                   the overlay is force closed. The default is null.
   * @param {boolean} canForceClose (optional) Indicates if opening the overlay
   *                  will close an active overlay. The default is false.
   * @returns {Promise} A promise that is resolved when the overlay has been
   *                    registered.
   */
  register: function overlayManagerRegister(name,
                                            callerCloseMethod, canForceClose) {
    return new Promise(function (resolve) {
      var element, container;
      if (!name || !(element = document.getElementById(name)) ||
          !(container = element.parentNode)) {
        throw new Error('Not enough parameters.');
      } else if (this.overlays[name]) {
        throw new Error('The overlay is already registered.');
      }
      this.overlays[name] = { element: element,
                              container: container,
                              callerCloseMethod: (callerCloseMethod || null),
                              canForceClose: (canForceClose || false) };
      resolve();
    }.bind(this));
  },

  /**
   * @param {string} name The name of the overlay that is unregistered.
   * @returns {Promise} A promise that is resolved when the overlay has been
   *                    unregistered.
   */
  unregister: function overlayManagerUnregister(name) {
    return new Promise(function (resolve) {
      if (!this.overlays[name]) {
        throw new Error('The overlay does not exist.');
      } else if (this.active === name) {
        throw new Error('The overlay cannot be removed while it is active.');
      }
      delete this.overlays[name];

      resolve();
    }.bind(this));
  },

  /**
   * @param {string} name The name of the overlay that should be opened.
   * @returns {Promise} A promise that is resolved when the overlay has been
   *                    opened.
   */
  open: function overlayManagerOpen(name) {
    return new Promise(function (resolve) {
      if (!this.overlays[name]) {
        throw new Error('The overlay does not exist.');
      } else if (this.active) {
        if (this.overlays[name].canForceClose) {
          this._closeThroughCaller();
        } else if (this.active === name) {
          throw new Error('The overlay is already active.');
        } else {
          throw new Error('Another overlay is currently active.');
        }
      }
      this.active = name;
      this.overlays[this.active].element.classList.remove('hidden');
      this.overlays[this.active].container.classList.remove('hidden');

      window.addEventListener('keydown', this._keyDown);
      resolve();
    }.bind(this));
  },

  /**
   * @param {string} name The name of the overlay that should be closed.
   * @returns {Promise} A promise that is resolved when the overlay has been
   *                    closed.
   */
  close: function overlayManagerClose(name) {
    return new Promise(function (resolve) {
      if (!this.overlays[name]) {
        throw new Error('The overlay does not exist.');
      } else if (!this.active) {
        throw new Error('The overlay is currently not active.');
      } else if (this.active !== name) {
        throw new Error('Another overlay is currently active.');
      }
      this.overlays[this.active].container.classList.add('hidden');
      this.overlays[this.active].element.classList.add('hidden');
      this.active = null;

      window.removeEventListener('keydown', this._keyDown);
      resolve();
    }.bind(this));
  },

  /**
   * @private
   */
  _keyDown: function overlayManager_keyDown(evt) {
    var self = OverlayManager;
    if (self.active && evt.keyCode === 27) { // Esc key.
      self._closeThroughCaller();
      evt.preventDefault();
    }
  },

  /**
   * @private
   */
  _closeThroughCaller: function overlayManager_closeThroughCaller() {
    if (this.overlays[this.active].callerCloseMethod) {
      this.overlays[this.active].callerCloseMethod();
    }
    if (this.active) {
      this.close(this.active);
    }
  }
};


var PasswordPrompt = {
  overlayName: null,
  updatePassword: null,
  reason: null,
  passwordField: null,
  passwordText: null,
  passwordSubmit: null,
  passwordCancel: null,

  initialize: function secondaryToolbarInitialize(options) {
    this.overlayName = options.overlayName;
    this.passwordField = options.passwordField;
    this.passwordText = options.passwordText;
    this.passwordSubmit = options.passwordSubmit;
    this.passwordCancel = options.passwordCancel;

    // Attach the event listeners.
    this.passwordSubmit.addEventListener('click',
      this.verifyPassword.bind(this));

    this.passwordCancel.addEventListener('click', this.close.bind(this));

    this.passwordField.addEventListener('keydown', function (e) {
      if (e.keyCode === 13) { // Enter key
        this.verifyPassword();
      }
    }.bind(this));

    OverlayManager.register(this.overlayName, this.close.bind(this), true);
  },

  open: function passwordPromptOpen() {
    OverlayManager.open(this.overlayName).then(function () {
      this.passwordField.focus();

      var promptString = mozL10n.get('password_label', null,
        'Enter the password to open this PDF file.');

      if (this.reason === PDFJS.PasswordResponses.INCORRECT_PASSWORD) {
        promptString = mozL10n.get('password_invalid', null,
          'Invalid password. Please try again.');
      }

      this.passwordText.textContent = promptString;
    }.bind(this));
  },

  close: function passwordPromptClose() {
    OverlayManager.close(this.overlayName).then(function () {
      this.passwordField.value = '';
    }.bind(this));
  },

  verifyPassword: function passwordPromptVerifyPassword() {
    var password = this.passwordField.value;
    if (password && password.length > 0) {
      this.close();
      return this.updatePassword(password);
    }
  }
};


/**
 * @typedef {Object} PDFDocumentPropertiesOptions
 * @property {string} overlayName - Name/identifier for the overlay.
 * @property {Object} fields - Names and elements of the overlay's fields.
 * @property {HTMLButtonElement} closeButton - Button for closing the overlay.
 */

/**
 * @class
 */
var PDFDocumentProperties = (function PDFDocumentPropertiesClosure() {
  /**
   * @constructs PDFDocumentProperties
   * @param {PDFDocumentPropertiesOptions} options
   */
  function PDFDocumentProperties(options) {
    this.fields = options.fields;
    this.overlayName = options.overlayName;

    this.rawFileSize = 0;
    this.url = null;
    this.pdfDocument = null;

    // Bind the event listener for the Close button.
    if (options.closeButton) {
      options.closeButton.addEventListener('click', this.close.bind(this));
    }

    this.dataAvailablePromise = new Promise(function (resolve) {
      this.resolveDataAvailable = resolve;
    }.bind(this));

    OverlayManager.register(this.overlayName, this.close.bind(this));
  }

  PDFDocumentProperties.prototype = {
    /**
     * Open the document properties overlay.
     */
    open: function PDFDocumentProperties_open() {
      Promise.all([OverlayManager.open(this.overlayName),
                   this.dataAvailablePromise]).then(function () {
        this._getProperties();
      }.bind(this));
    },

    /**
     * Close the document properties overlay.
     */
    close: function PDFDocumentProperties_close() {
      OverlayManager.close(this.overlayName);
    },

    /**
     * Set the file size of the PDF document. This method is used to
     * update the file size in the document properties overlay once it
     * is known so we do not have to wait until the entire file is loaded.
     *
     * @param {number} fileSize - The file size of the PDF document.
     */
    setFileSize: function PDFDocumentProperties_setFileSize(fileSize) {
      if (fileSize > 0) {
        this.rawFileSize = fileSize;
      }
    },

    /**
     * Set a reference to the PDF document and the URL in order
     * to populate the overlay fields with the document properties.
     * Note that the overlay will contain no information if this method
     * is not called.
     *
     * @param {Object} pdfDocument - A reference to the PDF document.
     * @param {string} url - The URL of the document.
     */
    setDocumentAndUrl:
        function PDFDocumentProperties_setDocumentAndUrl(pdfDocument, url) {
      this.pdfDocument = pdfDocument;
      this.url = url;
      this.resolveDataAvailable();
    },

    /**
     * @private
     */
    _getProperties: function PDFDocumentProperties_getProperties() {
      if (!OverlayManager.active) {
        // If the dialog was closed before dataAvailablePromise was resolved,
        // don't bother updating the properties.
        return;
      }
      // Get the file size (if it hasn't already been set).
      this.pdfDocument.getDownloadInfo().then(function(data) {
        if (data.length === this.rawFileSize) {
          return;
        }
        this.setFileSize(data.length);
        this._updateUI(this.fields['fileSize'], this._parseFileSize());
      }.bind(this));

      // Get the document properties.
      this.pdfDocument.getMetadata().then(function(data) {
        var content = {
          'fileName': getPDFFileNameFromURL(this.url),
          'fileSize': this._parseFileSize(),
          'title': data.info.Title,
          'author': data.info.Author,
          'subject': data.info.Subject,
          'keywords': data.info.Keywords,
          'creationDate': this._parseDate(data.info.CreationDate),
          'modificationDate': this._parseDate(data.info.ModDate),
          'creator': data.info.Creator,
          'producer': data.info.Producer,
          'version': data.info.PDFFormatVersion,
          'pageCount': this.pdfDocument.numPages
        };

        // Show the properties in the dialog.
        for (var identifier in content) {
          this._updateUI(this.fields[identifier], content[identifier]);
        }
      }.bind(this));
    },

    /**
     * @private
     */
    _updateUI: function PDFDocumentProperties_updateUI(field, content) {
      if (field && content !== undefined && content !== '') {
        field.textContent = content;
      }
    },

    /**
     * @private
     */
    _parseFileSize: function PDFDocumentProperties_parseFileSize() {
      var fileSize = this.rawFileSize, kb = fileSize / 1024;
      if (!kb) {
        return;
      } else if (kb < 1024) {
        return mozL10n.get('document_properties_kb', {
          size_kb: (+kb.toPrecision(3)).toLocaleString(),
          size_b: fileSize.toLocaleString()
        }, '{{size_kb}} KB ({{size_b}} bytes)');
      } else {
        return mozL10n.get('document_properties_mb', {
          size_mb: (+(kb / 1024).toPrecision(3)).toLocaleString(),
          size_b: fileSize.toLocaleString()
        }, '{{size_mb}} MB ({{size_b}} bytes)');
      }
    },

    /**
     * @private
     */
    _parseDate: function PDFDocumentProperties_parseDate(inputDate) {
      // This is implemented according to the PDF specification, but note that
      // Adobe Reader doesn't handle changing the date to universal time
      // and doesn't use the user's time zone (they're effectively ignoring
      // the HH' and mm' parts of the date string).
      var dateToParse = inputDate;
      if (dateToParse === undefined) {
        return '';
      }

      // Remove the D: prefix if it is available.
      if (dateToParse.substring(0,2) === 'D:') {
        dateToParse = dateToParse.substring(2);
      }

      // Get all elements from the PDF date string.
      // JavaScript's Date object expects the month to be between
      // 0 and 11 instead of 1 and 12, so we're correcting for this.
      var year = parseInt(dateToParse.substring(0,4), 10);
      var month = parseInt(dateToParse.substring(4,6), 10) - 1;
      var day = parseInt(dateToParse.substring(6,8), 10);
      var hours = parseInt(dateToParse.substring(8,10), 10);
      var minutes = parseInt(dateToParse.substring(10,12), 10);
      var seconds = parseInt(dateToParse.substring(12,14), 10);
      var utRel = dateToParse.substring(14,15);
      var offsetHours = parseInt(dateToParse.substring(15,17), 10);
      var offsetMinutes = parseInt(dateToParse.substring(18,20), 10);

      // As per spec, utRel = 'Z' means equal to universal time.
      // The other cases ('-' and '+') have to be handled here.
      if (utRel === '-') {
        hours += offsetHours;
        minutes += offsetMinutes;
      } else if (utRel === '+') {
        hours -= offsetHours;
        minutes -= offsetMinutes;
      }

      // Return the new date format from the user's locale.
      var date = new Date(Date.UTC(year, month, day, hours, minutes, seconds));
      var dateString = date.toLocaleDateString();
      var timeString = date.toLocaleTimeString();
      return mozL10n.get('document_properties_date_string',
                         {date: dateString, time: timeString},
                         '{{date}}, {{time}}');
    }
  };

  return PDFDocumentProperties;
})();


var PresentationModeState = {
  UNKNOWN: 0,
  NORMAL: 1,
  CHANGING: 2,
  FULLSCREEN: 3,
  //[Bruce]
  CAROUSEL: 4,
};

var IGNORE_CURRENT_POSITION_ON_ZOOM = false;
var DEFAULT_CACHE_SIZE = 10;


var CLEANUP_TIMEOUT = 30000;

var RenderingStates = {
  INITIAL: 0,
  RUNNING: 1,
  PAUSED: 2,
  FINISHED: 3
};

/**
 * Controls rendering of the views for pages and thumbnails.
 * @class
 */
var PDFRenderingQueue = (function PDFRenderingQueueClosure() {
  /**
   * @constructs
   */
  function PDFRenderingQueue() {
    this.pdfViewer = null;
    this.pdfThumbnailViewer = null;
    this.onIdle = null;

    this.highestPriorityPage = null;
    this.idleTimeout = null;
    this.printing = false;
    this.isThumbnailViewEnabled = false;
  }

  PDFRenderingQueue.prototype = /** @lends PDFRenderingQueue.prototype */ {
    /**
     * @param {PDFViewer} pdfViewer
     */
    setViewer: function PDFRenderingQueue_setViewer(pdfViewer) {
      this.pdfViewer = pdfViewer;
    },

    /**
     * @param {PDFThumbnailViewer} pdfThumbnailViewer
     */
    setThumbnailViewer:
        function PDFRenderingQueue_setThumbnailViewer(pdfThumbnailViewer) {
      this.pdfThumbnailViewer = pdfThumbnailViewer;
    },

    /**
     * @param {IRenderableView} view
     * @returns {boolean}
     */
    isHighestPriority: function PDFRenderingQueue_isHighestPriority(view) {
      return this.highestPriorityPage === view.renderingId;
    },

    renderHighestPriority: function
        PDFRenderingQueue_renderHighestPriority(currentlyVisiblePages) {
      if (this.idleTimeout) {
        clearTimeout(this.idleTimeout);
        this.idleTimeout = null;
      }

      // Pages have a higher priority than thumbnails, so check them first.
      if (this.pdfViewer.forceRendering(currentlyVisiblePages)) {
        return;
      }
      // No pages needed rendering so check thumbnails.
      if (this.pdfThumbnailViewer && this.isThumbnailViewEnabled) {
        if (this.pdfThumbnailViewer.forceRendering()) {
          return;
        }
      }

      if (this.printing) {
        // If printing is currently ongoing do not reschedule cleanup.
        return;
      }

      if (this.onIdle) {
        this.idleTimeout = setTimeout(this.onIdle.bind(this), CLEANUP_TIMEOUT);
      }
    },

    getHighestPriority: function
        PDFRenderingQueue_getHighestPriority(visible, views, scrolledDown) {
      // The state has changed figure out which page has the highest priority to
      // render next (if any).
      // Priority:
      // 1 visible pages
      // 2 if last scrolled down page after the visible pages
      // 2 if last scrolled up page before the visible pages
        //
        // When two page view mode is active:
        // 3 if last scrolled down, right-hand page after the visible pages.
        // 3 if last scrolled up, left-hand page after the visible pages.

      var visibleViews = visible.views;

      var numVisible = visibleViews.length;
      if (numVisible === 0) {
        return false;
      }
      for (var i = 0; i < numVisible; ++i) {
        var view = visibleViews[i].view;
        if (!this.isViewFinished(view)) {
          return view;
        }
      }

	  var pageIndex;
      // All the visible views have rendered, try to render next/previous pages.
      if (scrolledDown) {
        pageIndex = visible.last.id;
        // ID's start at 1 so no need to add 1.
        // if (views[nextPageIndex] &&
            // !this.isViewFinished(views[nextPageIndex])) {
          // return views[nextPageIndex];
        // }
      } else {
        pageIndex = visible.first.id - 2;
        // if (views[previousPageIndex] &&
          // !this.isViewFinished(views[previousPageIndex])) {
          // return views[previousPageIndex];
        // }
      }
        var hiddenView = views[pageIndex];
        var viewNeedsRendering = this.checkIfViewNeedsRendering(hiddenView);

        if (viewNeedsRendering) {
            return viewNeedsRendering;
        } else if (TwoPageViewMode.active) {
            hiddenView = views[pageIndex + (scrolledDown ? 1 : -1)];
            return this.checkIfViewNeedsRendering(hiddenView);
        }

      // Everything that needs to be rendered has been.
      return null;
    },

    /**
     * @param {IRenderableView} view
     * @returns {boolean}
     */
    isViewFinished: function PDFRenderingQueue_isViewFinished(view) {
      return view.renderingState === RenderingStates.FINISHED;
    },
    //phoebe, add for twopage view
    checkIfViewNeedsRendering: function pdfViewCheckIfViewNeedsRendering(view) {
        if (view && !this.isViewFinished(view)) {
            return view;
        }
        return false;
    },


    /**
     * Render a page or thumbnail view. This calls the appropriate function
     * based on the views state. If the view is already rendered it will return
     * false.
     * @param {IRenderableView} view
     */
    renderView: function PDFRenderingQueue_renderView(view) {
      var state = view.renderingState;
      switch (state) {
        case RenderingStates.FINISHED:
          return false;
        case RenderingStates.PAUSED:
          this.highestPriorityPage = view.renderingId;
          view.resume();
          break;
        case RenderingStates.RUNNING:
          this.highestPriorityPage = view.renderingId;
          break;
        case RenderingStates.INITIAL:
          this.highestPriorityPage = view.renderingId;
          var continueRendering = function () {
            this.renderHighestPriority();
          }.bind(this);
          view.draw().then(continueRendering, continueRendering);
          break;
      }
      return true;
    },
  };

  return PDFRenderingQueue;
})();


var TEXT_LAYER_RENDER_DELAY = 200; // ms

/**
 * @typedef {Object} PDFPageViewOptions
 * @property {HTMLDivElement} container - The viewer element.
 * @property {number} id - The page unique ID (normally its number).
 * @property {number} scale - The page scale display.
 * @property {PageViewport} defaultViewport - The page viewport.
 * @property {PDFRenderingQueue} renderingQueue - The rendering queue object.
 * @property {IPDFTextLayerFactory} textLayerFactory
 * @property {IPDFAnnotationsLayerFactory} annotationsLayerFactory
 */

/**
 * @class
 * @implements {IRenderableView}
 */
var PDFPageView = (function PDFPageViewClosure() {
  /**
   * @constructs PDFPageView
   * @param {PDFPageViewOptions} options
   */
  function PDFPageView(options) {
    var container = options.container;
    var id = options.id;
    var scale = options.scale;
    var defaultViewport = options.defaultViewport;
    var renderingQueue = options.renderingQueue;
    var textLayerFactory = options.textLayerFactory;
    var annotationsLayerFactory = options.annotationsLayerFactory;

	// [maison]keep original container 
	this.container = container; 
    this.id = id;
    this.renderingId = 'page' + id;

    this.rotation = 0;
    this.scale = scale || 1.0;
    this.viewport = defaultViewport;
    this.pdfPageRotate = defaultViewport.rotation;
    this.hasRestrictedScaling = false;

    this.renderingQueue = renderingQueue;
    this.textLayerFactory = textLayerFactory;
    this.annotationsLayerFactory = annotationsLayerFactory;

    this.renderingState = RenderingStates.INITIAL;
    this.resume = null;

    this.onBeforeDraw = null;
    this.onAfterDraw = null;

    this.textLayer = null;

    this.zoomLayer = null;

    this.annotationLayer = null;

    var div = document.createElement('div');
    div.id = 'pageContainer' + this.id;
    //[Bruce]
    if(PDFViewerApplication.pdfViewer.isInCarouselMode) {
        div.className = 'item';
    } else {
        div.className = 'page';
    }
    //End : [Bruce]
    div.style.width = Math.floor(this.viewport.width) + 'px';
    div.style.height = Math.floor(this.viewport.height) + 'px';
    div.setAttribute('data-page-number', this.id);
    this.div = div;

    //[Bruce]
    if(PDFViewerApplication.pdfViewer.isInCarouselMode) {
        if(options.isOwlCarouselAddedFromHead) {
            $viewerOwl.trigger('add.owl.carousel',[this.div,0]);
        } else {
            $viewerOwl.trigger('add.owl.carousel',[this.div]);
        }
    } else {
        container.appendChild(div);
    }
  }

  PDFPageView.prototype = {
    setPdfPage: function PDFPageView_setPdfPage(pdfPage) {
      this.pdfPage = pdfPage;
      this.pdfPageRotate = pdfPage.rotate;
      var totalRotation = (this.rotation + this.pdfPageRotate) % 360;
      this.viewport = pdfPage.getViewport(this.scale * CSS_UNITS,
                                          totalRotation);
      this.stats = pdfPage.stats;
      this.reset();
    },

    destroy: function PDFPageView_destroy() {
      this.zoomLayer = null;
      this.reset();
      if (this.pdfPage) {
        this.pdfPage.cleanup();
      }
    },

    reset: function PDFPageView_reset(keepZoomLayer, keepAnnotations) {
      if (this.renderTask) {
        this.renderTask.cancel();
      }
      this.resume = null;
      this.renderingState = RenderingStates.INITIAL;

      var div = this.div;
      div.style.width = Math.floor(this.viewport.width) + 'px';
	  //[maison]fix #2208 放大後畫面有白邊
      //div.style.height = Math.floor(this.viewport.height) + 'px';
	  div.style.height = $(document).height(); //拿到全螢幕的高度
		
      var childNodes = div.childNodes;
      var currentZoomLayerNode = (keepZoomLayer && this.zoomLayer) || null;
      var currentAnnotationNode = (keepAnnotations && this.annotationLayer &&
                                   this.annotationLayer.div) || null;
      for (var i = childNodes.length - 1; i >= 0; i--) {
        var node = childNodes[i];
        if (currentZoomLayerNode === node || currentAnnotationNode === node) {
          continue;
        }
        div.removeChild(node);
      }
      div.removeAttribute('data-loaded');

      if (currentAnnotationNode) {
          // Hide annotationLayer until all elements are resized
          // so they are not displayed on the already-resized page
          this.annotationLayer.hide();
      } else {
        this.annotationLayer = null;
      }

      if (this.canvas && !currentZoomLayerNode) {
        // Zeroing the width and height causes Firefox to release graphics
        // resources immediately, which can greatly reduce memory consumption.
        this.canvas.width = 0;
        this.canvas.height = 0;
        delete this.canvas;
      }

      this.loadingIconDiv = document.createElement('div');
      this.loadingIconDiv.className = 'loadingIcon';
      div.appendChild(this.loadingIconDiv);
    },

    update: function PDFPageView_update(scale, rotation) {
      this.scale = scale || this.scale;

      if (typeof rotation !== 'undefined') {
        this.rotation = rotation;
      }

      var totalRotation = (this.rotation + this.pdfPageRotate) % 360;
      this.viewport = this.viewport.clone({
        scale: this.scale * CSS_UNITS,
        rotation: totalRotation
      });

      var isScalingRestricted = false;
      if (this.canvas && PDFJS.maxCanvasPixels > 0) {
        var ctx = this.canvas.getContext('2d');
        var outputScale = getOutputScale(ctx);
        var pixelsInViewport = this.viewport.width * this.viewport.height;
        var maxScale = Math.sqrt(PDFJS.maxCanvasPixels / pixelsInViewport);
        if (((Math.floor(this.viewport.width) * outputScale.sx) | 0) *
            ((Math.floor(this.viewport.height) * outputScale.sy) | 0) >
            PDFJS.maxCanvasPixels) {
          isScalingRestricted = true;
        }
      }

      if (this.canvas) {
        if (PDFJS.useOnlyCssZoom ||
            (this.hasRestrictedScaling && isScalingRestricted)) {
        this.cssTransform(this.canvas, true);

          var event = document.createEvent('CustomEvent');
          event.initCustomEvent('pagerendered', true, true, {
            pageNumber: this.id,
            cssTransform: true,
          });
          this.div.dispatchEvent(event);

        return;
        }
        if (!this.zoomLayer) {
        this.zoomLayer = this.canvas.parentNode;
        this.zoomLayer.style.position = 'absolute';
      }
      }
      if (this.zoomLayer) {
        this.cssTransform(this.zoomLayer.firstChild);
      }
      this.reset(/* keepZoomLayer = */ true, /* keepAnnotations = */ true);
    },

    /**
     * Called when moved in the parent's container.
     */
    updatePosition: function PDFPageView_updatePosition() {
      if (this.textLayer) {
        this.textLayer.render(TEXT_LAYER_RENDER_DELAY);
      }
    },

    cssTransform: function PDFPageView_transform(canvas, redrawAnnotations) {
      // Scale canvas, canvas wrapper, and page container.
      var width = this.viewport.width;
      var height = this.viewport.height;
      var div = this.div;
      canvas.style.width = canvas.parentNode.style.width = div.style.width =
        Math.floor(width) + 'px';
      canvas.style.height = canvas.parentNode.style.height = div.style.height =
        Math.floor(height) + 'px';
      // The canvas may have been originally rotated, rotate relative to that.
      var relativeRotation = this.viewport.rotation - canvas._viewport.rotation;
      var absRotation = Math.abs(relativeRotation);
      var scaleX = 1, scaleY = 1;
      if (absRotation === 90 || absRotation === 270) {
        // Scale x and y because of the rotation.
        scaleX = height / width;
        scaleY = width / height;
      }
      var cssTransform = 'rotate(' + relativeRotation + 'deg) ' +
        'scale(' + scaleX + ',' + scaleY + ')';
      CustomStyle.setProp('transform', canvas, cssTransform);

      if (this.textLayer) {
        // Rotating the text layer is more complicated since the divs inside the
        // the text layer are rotated.
        // TODO: This could probably be simplified by drawing the text layer in
        // one orientation then rotating overall.
        var textLayerViewport = this.textLayer.viewport;
        var textRelativeRotation = this.viewport.rotation -
          textLayerViewport.rotation;
        var textAbsRotation = Math.abs(textRelativeRotation);
        var scale = width / textLayerViewport.width;
        if (textAbsRotation === 90 || textAbsRotation === 270) {
          scale = width / textLayerViewport.height;
        }
        var textLayerDiv = this.textLayer.textLayerDiv;
        var transX, transY;
        switch (textAbsRotation) {
          case 0:
            transX = transY = 0;
            break;
          case 90:
            transX = 0;
            transY = '-' + textLayerDiv.style.height;
            break;
          case 180:
            transX = '-' + textLayerDiv.style.width;
            transY = '-' + textLayerDiv.style.height;
            break;
          case 270:
            transX = '-' + textLayerDiv.style.width;
            transY = 0;
            break;
          default:
            console.error('Bad rotation value.');
            break;
        }
        CustomStyle.setProp('transform', textLayerDiv,
            'rotate(' + textAbsRotation + 'deg) ' +
            'scale(' + scale + ', ' + scale + ') ' +
            'translate(' + transX + ', ' + transY + ')');
        CustomStyle.setProp('transformOrigin', textLayerDiv, '0% 0%');
      }

      if (redrawAnnotations && this.annotationLayer) {
        this.annotationLayer.setupAnnotations(this.viewport);
      }
    },

    get width() {
      return this.viewport.width;
    },

    get height() {
      return this.viewport.height;
    },

    getPagePoint: function PDFPageView_getPagePoint(x, y) {
      return this.viewport.convertToPdfPoint(x, y);
    },

    draw: function PDFPageView_draw() {
      if (this.renderingState !== RenderingStates.INITIAL) {
        console.error('Must be in new state before drawing');
      }

      this.renderingState = RenderingStates.RUNNING;

      var pdfPage = this.pdfPage;
      var viewport = this.viewport;
      var div = this.div;
      // Wrap the canvas so if it has a css transform for highdpi the overflow
      // will be hidden in FF.
      var canvasWrapper = document.createElement('div');
	  
	  //[maison] workaround for issues 2153, using container width as div width 
      //canvasWrapper.style.width = div.style.width;
      canvasWrapper.style.width = this.container.clientWidth + 'px';//div.style.width;
      canvasWrapper.style.height = this.container.clientHeight + 'px'; //div.style.height;
	  
      canvasWrapper.classList.add('canvasWrapper');

      var canvas = document.createElement('canvas');
      canvas.id = 'page' + this.id;
      canvasWrapper.appendChild(canvas);
      if (this.annotationLayer && this.annotationLayer.div) {
        // annotationLayer needs to stay on top
        div.insertBefore(canvasWrapper, this.annotationLayer.div);
      } else {
        div.appendChild(canvasWrapper);
      }
      this.canvas = canvas;

      var ctx = canvas.getContext('2d');
      var outputScale = getOutputScale(ctx);

      if (PDFJS.useOnlyCssZoom) {
        var actualSizeViewport = viewport.clone({scale: CSS_UNITS});
        // Use a scale that will make the canvas be the original intended size
        // of the page.
        outputScale.sx *= actualSizeViewport.width / viewport.width;
        outputScale.sy *= actualSizeViewport.height / viewport.height;
        outputScale.scaled = true;
      }

      if (PDFJS.maxCanvasPixels > 0) {
        var pixelsInViewport = viewport.width * viewport.height;
        var maxScale = Math.sqrt(PDFJS.maxCanvasPixels / pixelsInViewport);
        if (outputScale.sx > maxScale || outputScale.sy > maxScale) {
          outputScale.sx = maxScale;
          outputScale.sy = maxScale;
          outputScale.scaled = true;
          this.hasRestrictedScaling = true;
        } else {
          this.hasRestrictedScaling = false;
        }
      }

      var sfx = approximateFraction(outputScale.sx);
      var sfy = approximateFraction(outputScale.sy);
      canvas.width = roundToDivide(viewport.width * outputScale.sx, sfx[0]);
      canvas.height = roundToDivide(viewport.height * outputScale.sy, sfy[0]);
	  //[maison]workaround for issues 2153 每一頁不同大小的問題, using container width as canvas width
      canvas.style.width = this.container.clientWidth + 'px';//roundToDivide(viewport.width, sfx[1]) + 'px';
      canvas.style.height = roundToDivide(viewport.height, sfy[1]) + 'px';
	  //canvas.style.top = 'calc(50%)'; //垂直置中
	  
      // Add the viewport so it's known what it was originally drawn with.
      canvas._viewport = viewport;

      var textLayerDiv = null;
      var textLayer = null;
      if (this.textLayerFactory) {
        textLayerDiv = document.createElement('div');
        textLayerDiv.className = 'textLayer';
        textLayerDiv.style.width = canvasWrapper.style.width;
        textLayerDiv.style.height = canvasWrapper.style.height;
        if (this.annotationLayer && this.annotationLayer.div) {
          // annotationLayer needs to stay on top
          div.insertBefore(textLayerDiv, this.annotationLayer.div);
        } else {
          div.appendChild(textLayerDiv);
        }

        textLayer = this.textLayerFactory.createTextLayerBuilder(textLayerDiv,
                                                                 this.id - 1,
                                                                 this.viewport);
      }
      this.textLayer = textLayer;

      if (outputScale.scaled) {
        // Used by the mozCurrentTransform polyfill in src/display/canvas.js.
        ctx._transformMatrix = [outputScale.sx, 0, 0, outputScale.sy, 0, 0];
        ctx.scale(outputScale.sx, outputScale.sy);
      }

      var resolveRenderPromise, rejectRenderPromise;
      var promise = new Promise(function (resolve, reject) {
        resolveRenderPromise = resolve;
        rejectRenderPromise = reject;
      });

      // Rendering area

      var self = this;
      function pageViewDrawCallback(error) {
        // The renderTask may have been replaced by a new one, so only remove
        // the reference to the renderTask if it matches the one that is
        // triggering this callback.
        if (renderTask === self.renderTask) {
          self.renderTask = null;
        }

        if (error === 'cancelled') {
          rejectRenderPromise(error);
          return;
        }

        self.renderingState = RenderingStates.FINISHED;

        if (self.loadingIconDiv) {
          div.removeChild(self.loadingIconDiv);
          delete self.loadingIconDiv;
        }

        if (self.zoomLayer) {
          // Zeroing the width and height causes Firefox to release graphics
          // resources immediately, which can greatly reduce memory consumption.
          var zoomLayerCanvas = self.zoomLayer.firstChild;
          zoomLayerCanvas.width = 0;
          zoomLayerCanvas.height = 0;

          div.removeChild(self.zoomLayer);
          self.zoomLayer = null;
        }

        self.error = error;
        self.stats = pdfPage.stats;
        if (self.onAfterDraw) {
          self.onAfterDraw();
        }
        var event = document.createEvent('CustomEvent');
        event.initCustomEvent('pagerendered', true, true, {
          pageNumber: self.id,
          cssTransform: false,
        });
        div.dispatchEvent(event);
        // This custom event is deprecated, and will be removed in the future,
        // please use the |pagerendered| event instead.
        var deprecatedEvent = document.createEvent('CustomEvent');
        deprecatedEvent.initCustomEvent('pagerender', true, true, {
          pageNumber: pdfPage.pageNumber
        });
        div.dispatchEvent(deprecatedEvent);

        if (!error) {
          resolveRenderPromise(undefined);
        } else {
          rejectRenderPromise(error);
        }
      }

      var renderContinueCallback = null;
      if (this.renderingQueue) {
        renderContinueCallback = function renderContinueCallback(cont) {
          if (!self.renderingQueue.isHighestPriority(self)) {
            self.renderingState = RenderingStates.PAUSED;
            self.resume = function resumeCallback() {
              self.renderingState = RenderingStates.RUNNING;
              cont();
            };
            return;
          }
          cont();
        };
      }

      var renderContext = {
        canvasContext: ctx,
        viewport: this.viewport,
        // intent: 'default', // === 'display'
      };
      var renderTask = this.renderTask = this.pdfPage.render(renderContext);
      renderTask.onContinue = renderContinueCallback;

      this.renderTask.promise.then(
        function pdfPageRenderCallback() {
          pageViewDrawCallback(null);
          if (textLayer) {
            self.pdfPage.getTextContent().then(
              function textContentResolved(textContent) {
                textLayer.setTextContent(textContent);
                textLayer.render(TEXT_LAYER_RENDER_DELAY);
              }
            );
          }
        },
        function pdfPageRenderError(error) {
          pageViewDrawCallback(error);
        }
      );

      if (this.annotationsLayerFactory) {
        if (!this.annotationLayer) {
          this.annotationLayer = this.annotationsLayerFactory.
            createAnnotationsLayerBuilder(div, this.pdfPage);
        }
        this.annotationLayer.setupAnnotations(this.viewport);
      }
      div.setAttribute('data-loaded', true);

      if (self.onBeforeDraw) {
        self.onBeforeDraw();
      }
      return promise;
    },

    beforePrint: function PDFPageView_beforePrint() {
      var pdfPage = this.pdfPage;

      var viewport = pdfPage.getViewport(1);
      // Use the same hack we use for high dpi displays for printing to get
      // better output until bug 811002 is fixed in FF.
      var PRINT_OUTPUT_SCALE = 2;
      var canvas = document.createElement('canvas');

      // The logical size of the canvas.
      canvas.width = Math.floor(viewport.width) * PRINT_OUTPUT_SCALE;
      canvas.height = Math.floor(viewport.height) * PRINT_OUTPUT_SCALE;

      // The rendered size of the canvas, relative to the size of canvasWrapper.
      canvas.style.width = (PRINT_OUTPUT_SCALE * 100) + '%';
      canvas.style.height = (PRINT_OUTPUT_SCALE * 100) + '%';

      var cssScale = 'scale(' + (1 / PRINT_OUTPUT_SCALE) + ', ' +
                                (1 / PRINT_OUTPUT_SCALE) + ')';
      CustomStyle.setProp('transform' , canvas, cssScale);
      CustomStyle.setProp('transformOrigin' , canvas, '0% 0%');

      var printContainer = document.getElementById('printContainer');
      var canvasWrapper = document.createElement('div');
      canvasWrapper.style.width = viewport.width + 'pt';
      canvasWrapper.style.height = viewport.height + 'pt';
      canvasWrapper.appendChild(canvas);
      printContainer.appendChild(canvasWrapper);

      canvas.mozPrintCallback = function(obj) {
        var ctx = obj.context;

        ctx.save();
        ctx.fillStyle = 'rgb(255, 255, 255)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
        // Used by the mozCurrentTransform polyfill in src/display/canvas.js.
        ctx._transformMatrix =
          [PRINT_OUTPUT_SCALE, 0, 0, PRINT_OUTPUT_SCALE, 0, 0];
        ctx.scale(PRINT_OUTPUT_SCALE, PRINT_OUTPUT_SCALE);

        var renderContext = {
          canvasContext: ctx,
          viewport: viewport,
          intent: 'print'
        };

        pdfPage.render(renderContext).promise.then(function() {
          // Tell the printEngine that rendering this canvas/page has finished.
          obj.done();
        }, function(error) {
          console.error(error);
          // Tell the printEngine that rendering this canvas/page has failed.
          // This will make the print proces stop.
          if ('abort' in obj) {
            obj.abort();
          } else {
            obj.done();
          }
        });
      };
    },
  };

  return PDFPageView;
})();


var MAX_TEXT_DIVS_TO_RENDER = 100000;

var NonWhitespaceRegexp = /\S/;

function isAllWhitespace(str) {
  return !NonWhitespaceRegexp.test(str);
}

/**
 * @typedef {Object} TextLayerBuilderOptions
 * @property {HTMLDivElement} textLayerDiv - The text layer container.
 * @property {number} pageIndex - The page index.
 * @property {PageViewport} viewport - The viewport of the text layer.
 * @property {PDFFindController} findController
 */

/**
 * TextLayerBuilder provides text-selection functionality for the PDF.
 * It does this by creating overlay divs over the PDF text. These divs
 * contain text that matches the PDF text they are overlaying. This object
 * also provides a way to highlight text that is being searched for.
 * @class
 */
var TextLayerBuilder = (function TextLayerBuilderClosure() {
  function TextLayerBuilder(options) {
    this.textLayerDiv = options.textLayerDiv;
    this.renderingDone = false;
    this.divContentDone = false;
    this.pageIdx = options.pageIndex;
    this.pageNumber = this.pageIdx + 1;
    this.matches = [];
    this.viewport = options.viewport;
    this.textDivs = [];
    this.findController = options.findController || null;
    this._bindMouse();
  }

  TextLayerBuilder.prototype = {
    _finishRendering: function TextLayerBuilder_finishRendering() {
      this.renderingDone = true;

      var endOfContent = document.createElement('div');
      endOfContent.className = 'endOfContent';
      this.textLayerDiv.appendChild(endOfContent);

      var event = document.createEvent('CustomEvent');
      event.initCustomEvent('textlayerrendered', true, true, {
        pageNumber: this.pageNumber
      });
      this.textLayerDiv.dispatchEvent(event);
    },

    renderLayer: function TextLayerBuilder_renderLayer() {
      var textLayerFrag = document.createDocumentFragment();
      var textDivs = this.textDivs;
      var textDivsLength = textDivs.length;
      var canvas = document.createElement('canvas');
      var ctx = canvas.getContext('2d');

      // No point in rendering many divs as it would make the browser
      // unusable even after the divs are rendered.
      if (textDivsLength > MAX_TEXT_DIVS_TO_RENDER) {
        this._finishRendering();
        return;
      }

      var lastFontSize;
      var lastFontFamily;
      for (var i = 0; i < textDivsLength; i++) {
        var textDiv = textDivs[i];
        if (textDiv.dataset.isWhitespace !== undefined) {
          continue;
        }

        var fontSize = textDiv.style.fontSize;
        var fontFamily = textDiv.style.fontFamily;

        // Only build font string and set to context if different from last.
        if (fontSize !== lastFontSize || fontFamily !== lastFontFamily) {
          ctx.font = fontSize + ' ' + fontFamily;
          lastFontSize = fontSize;
          lastFontFamily = fontFamily;
        }

        var width = ctx.measureText(textDiv.textContent).width;
        if (width > 0) {
          textLayerFrag.appendChild(textDiv);
          var transform;
          if (textDiv.dataset.canvasWidth !== undefined) {
            // Dataset values come of type string.
            var textScale = textDiv.dataset.canvasWidth / width;
            transform = 'scaleX(' + textScale + ')';
          } else {
            transform = '';
          }
          var rotation = textDiv.dataset.angle;
          if (rotation) {
            transform = 'rotate(' + rotation + 'deg) ' + transform;
          }
          if (transform) {
            CustomStyle.setProp('transform' , textDiv, transform);
          }
        }
      }

      this.textLayerDiv.appendChild(textLayerFrag);
      this._finishRendering();
      this.updateMatches();
    },

    /**
     * Renders the text layer.
     * @param {number} timeout (optional) if specified, the rendering waits
     *   for specified amount of ms.
     */
    render: function TextLayerBuilder_render(timeout) {
      if (!this.divContentDone || this.renderingDone) {
        return;
      }

      if (this.renderTimer) {
        clearTimeout(this.renderTimer);
        this.renderTimer = null;
      }

      if (!timeout) { // Render right away
        this.renderLayer();
      } else { // Schedule
        var self = this;
        this.renderTimer = setTimeout(function() {
          self.renderLayer();
          self.renderTimer = null;
        }, timeout);
      }
    },

    appendText: function TextLayerBuilder_appendText(geom, styles) {
      var style = styles[geom.fontName];
      var textDiv = document.createElement('div');
      this.textDivs.push(textDiv);
      if (isAllWhitespace(geom.str)) {
        textDiv.dataset.isWhitespace = true;
        return;
      }
      var tx = PDFJS.Util.transform(this.viewport.transform, geom.transform);
      var angle = Math.atan2(tx[1], tx[0]);
      if (style.vertical) {
        angle += Math.PI / 2;
      }
      var fontHeight = Math.sqrt((tx[2] * tx[2]) + (tx[3] * tx[3]));
      var fontAscent = fontHeight;
      if (style.ascent) {
        fontAscent = style.ascent * fontAscent;
      } else if (style.descent) {
        fontAscent = (1 + style.descent) * fontAscent;
      }

      var left;
      var top;
      if (angle === 0) {
        left = tx[4];
        top = tx[5] - fontAscent;
      } else {
        left = tx[4] + (fontAscent * Math.sin(angle));
        top = tx[5] - (fontAscent * Math.cos(angle));
      }
      textDiv.style.left = left + 'px';
      textDiv.style.top = top + 'px';
      textDiv.style.fontSize = fontHeight + 'px';
      textDiv.style.fontFamily = style.fontFamily;

      textDiv.textContent = geom.str;
      // |fontName| is only used by the Font Inspector. This test will succeed
      // when e.g. the Font Inspector is off but the Stepper is on, but it's
      // not worth the effort to do a more accurate test.
      if (PDFJS.pdfBug) {
        textDiv.dataset.fontName = geom.fontName;
      }
      // Storing into dataset will convert number into string.
      if (angle !== 0) {
        textDiv.dataset.angle = angle * (180 / Math.PI);
      }
      // We don't bother scaling single-char text divs, because it has very
      // little effect on text highlighting. This makes scrolling on docs with
      // lots of such divs a lot faster.
      if (geom.str.length > 1) {
        if (style.vertical) {
          textDiv.dataset.canvasWidth = geom.height * this.viewport.scale;
        } else {
          textDiv.dataset.canvasWidth = geom.width * this.viewport.scale;
        }
      }
    },

    setTextContent: function TextLayerBuilder_setTextContent(textContent) {
      this.textContent = textContent;

      var textItems = textContent.items;
      for (var i = 0, len = textItems.length; i < len; i++) {
        this.appendText(textItems[i], textContent.styles);
      }
      this.divContentDone = true;
    },

    convertMatches: function TextLayerBuilder_convertMatches(matches) {
      var i = 0;
      var iIndex = 0;
      var bidiTexts = this.textContent.items;
      var end = bidiTexts.length - 1;
      var queryLen = (this.findController === null ?
                      0 : this.findController.state.query.length);
      var ret = [];

      for (var m = 0, len = matches.length; m < len; m++) {
        // Calculate the start position.
        var matchIdx = matches[m];

        // Loop over the divIdxs.
        while (i !== end && matchIdx >= (iIndex + bidiTexts[i].str.length)) {
          iIndex += bidiTexts[i].str.length;
          i++;
        }

        if (i === bidiTexts.length) {
          console.error('Could not find a matching mapping');
        }

        var match = {
          begin: {
            divIdx: i,
            offset: matchIdx - iIndex
          }
        };

        // Calculate the end position.
        matchIdx += queryLen;

        // Somewhat the same array as above, but use > instead of >= to get
        // the end position right.
        while (i !== end && matchIdx > (iIndex + bidiTexts[i].str.length)) {
          iIndex += bidiTexts[i].str.length;
          i++;
        }

        match.end = {
          divIdx: i,
          offset: matchIdx - iIndex
        };
        ret.push(match);
      }

      return ret;
    },

    renderMatches: function TextLayerBuilder_renderMatches(matches) {
      // Early exit if there is nothing to render.
      if (matches.length === 0) {
        return;
      }

      var bidiTexts = this.textContent.items;
      var textDivs = this.textDivs;
      var prevEnd = null;
      var pageIdx = this.pageIdx;
      var isSelectedPage = (this.findController === null ?
        false : (pageIdx === this.findController.selected.pageIdx));
      var selectedMatchIdx = (this.findController === null ?
                              -1 : this.findController.selected.matchIdx);
      var highlightAll = (this.findController === null ?
                          false : this.findController.state.highlightAll);
      var infinity = {
        divIdx: -1,
        offset: undefined
      };

      function beginText(begin, className) {
        var divIdx = begin.divIdx;
        textDivs[divIdx].textContent = '';
        appendTextToDiv(divIdx, 0, begin.offset, className);
      }

      function appendTextToDiv(divIdx, fromOffset, toOffset, className) {
        var div = textDivs[divIdx];
        var content = bidiTexts[divIdx].str.substring(fromOffset, toOffset);
        var node = document.createTextNode(content);
        if (className) {
          var span = document.createElement('span');
          span.className = className;
          span.appendChild(node);
          div.appendChild(span);
          return;
        }
        div.appendChild(node);
      }

      var i0 = selectedMatchIdx, i1 = i0 + 1;
      if (highlightAll) {
        i0 = 0;
        i1 = matches.length;
      } else if (!isSelectedPage) {
        // Not highlighting all and this isn't the selected page, so do nothing.
        return;
      }

      for (var i = i0; i < i1; i++) {
        var match = matches[i];
        var begin = match.begin;
        var end = match.end;
        var isSelected = (isSelectedPage && i === selectedMatchIdx);
        var highlightSuffix = (isSelected ? ' selected' : '');

        if (this.findController) {
          this.findController.updateMatchPosition(pageIdx, i, textDivs,
                                                  begin.divIdx, end.divIdx);
        }

        // Match inside new div.
        if (!prevEnd || begin.divIdx !== prevEnd.divIdx) {
          // If there was a previous div, then add the text at the end.
          if (prevEnd !== null) {
            appendTextToDiv(prevEnd.divIdx, prevEnd.offset, infinity.offset);
          }
          // Clear the divs and set the content until the starting point.
          beginText(begin);
        } else {
          appendTextToDiv(prevEnd.divIdx, prevEnd.offset, begin.offset);
        }

        if (begin.divIdx === end.divIdx) {
          appendTextToDiv(begin.divIdx, begin.offset, end.offset,
                          'highlight' + highlightSuffix);
        } else {
          appendTextToDiv(begin.divIdx, begin.offset, infinity.offset,
                          'highlight begin' + highlightSuffix);
          for (var n0 = begin.divIdx + 1, n1 = end.divIdx; n0 < n1; n0++) {
            textDivs[n0].className = 'highlight middle' + highlightSuffix;
          }
          beginText(end, 'highlight end' + highlightSuffix);
        }
        prevEnd = end;
      }

      if (prevEnd) {
        appendTextToDiv(prevEnd.divIdx, prevEnd.offset, infinity.offset);
      }
    },

    updateMatches: function TextLayerBuilder_updateMatches() {
      // Only show matches when all rendering is done.
      if (!this.renderingDone) {
        return;
      }

      // Clear all matches.
      var matches = this.matches;
      var textDivs = this.textDivs;
      var bidiTexts = this.textContent.items;
      var clearedUntilDivIdx = -1;

      // Clear all current matches.
      for (var i = 0, len = matches.length; i < len; i++) {
        var match = matches[i];
        var begin = Math.max(clearedUntilDivIdx, match.begin.divIdx);
        for (var n = begin, end = match.end.divIdx; n <= end; n++) {
          var div = textDivs[n];
          div.textContent = bidiTexts[n].str;
          div.className = '';
        }
        clearedUntilDivIdx = match.end.divIdx + 1;
      }

      if (this.findController === null || !this.findController.active) {
        return;
      }

      // Convert the matches on the page controller into the match format
      // used for the textLayer.
      this.matches = this.convertMatches(this.findController === null ?
        [] : (this.findController.pageMatches[this.pageIdx] || []));
      this.renderMatches(this.matches);
    },

    /**
     * Fixes text selection: adds additional div where mouse was clicked.
     * This reduces flickering of the content if mouse slowly dragged down/up.
     * @private
     */
    _bindMouse: function TextLayerBuilder_bindMouse() {
      var div = this.textLayerDiv;
      div.addEventListener('mousedown', function (e) {
        var end = div.querySelector('.endOfContent');
        if (!end) {
          return;
    }
        // On non-Firefox browsers, the selection will feel better if the height
        // of the endOfContent div will be adjusted to start at mouse click
        // location -- this will avoid flickering when selections moves up.
        // However it does not work when selection started on empty space.
        var adjustTop = e.target !== div;
        adjustTop = adjustTop && window.getComputedStyle(end).
          getPropertyValue('-moz-user-select') !== 'none';
        if (adjustTop) {
          var divBounds = div.getBoundingClientRect();
          var r = Math.max(0, (e.pageY - divBounds.top) / divBounds.height);
          end.style.top = (r * 100).toFixed(2) + '%';
        }
        end.classList.add('active');
      });
      div.addEventListener('mouseup', function (e) {
        var end = div.querySelector('.endOfContent');
        if (!end) {
          return;
        }
        end.style.top = '';
        end.classList.remove('active');
      });
    },
  };
  return TextLayerBuilder;
})();

/**
 * @constructor
 * @implements IPDFTextLayerFactory
 */
function DefaultTextLayerFactory() {}
DefaultTextLayerFactory.prototype = {
  /**
   * @param {HTMLDivElement} textLayerDiv
   * @param {number} pageIndex
   * @param {PageViewport} viewport
   * @returns {TextLayerBuilder}
   */
  createTextLayerBuilder: function (textLayerDiv, pageIndex, viewport) {
    return new TextLayerBuilder({
      textLayerDiv: textLayerDiv,
      pageIndex: pageIndex,
      viewport: viewport
    });
  }
};


/**
 * @typedef {Object} AnnotationsLayerBuilderOptions
 * @property {HTMLDivElement} pageDiv
 * @property {PDFPage} pdfPage
 * @property {IPDFLinkService} linkService
 */

/**
 * @class
 */
var AnnotationsLayerBuilder = (function AnnotationsLayerBuilderClosure() {
  /**
   * @param {AnnotationsLayerBuilderOptions} options
   * @constructs AnnotationsLayerBuilder
   */
  function AnnotationsLayerBuilder(options) {
    this.pageDiv = options.pageDiv;
    this.pdfPage = options.pdfPage;
    this.linkService = options.linkService;

    this.div = null;
  }
  AnnotationsLayerBuilder.prototype =
      /** @lends AnnotationsLayerBuilder.prototype */ {

    /**
     * @param {PageViewport} viewport
     */
    setupAnnotations:
        function AnnotationsLayerBuilder_setupAnnotations(viewport) {
      function bindLink(link, dest) {
        link.href = linkService.getDestinationHash(dest);
        link.onclick = function annotationsLayerBuilderLinksOnclick() {
          if (dest) {
            linkService.navigateTo(dest);
          }
          return false;
        };
        if (dest) {
          link.className = 'internalLink';
        }
      }

      function bindNamedAction(link, action) {
        link.href = linkService.getAnchorUrl('');
        link.onclick = function annotationsLayerBuilderNamedActionOnClick() {
          linkService.executeNamedAction(action);
          return false;
        };
        link.className = 'internalLink';
      }

      var linkService = this.linkService;
      var pdfPage = this.pdfPage;
      var self = this;

      pdfPage.getAnnotations().then(function (annotationsData) {
        viewport = viewport.clone({ dontFlip: true });
        var transform = viewport.transform;
        var transformStr = 'matrix(' + transform.join(',') + ')';
        var data, element, i, ii;

        if (self.div) {
          // If an annotationLayer already exists, refresh its children's
          // transformation matrices
          for (i = 0, ii = annotationsData.length; i < ii; i++) {
            data = annotationsData[i];
            element = self.div.querySelector(
                '[data-annotation-id="' + data.id + '"]');
            if (element) {
              CustomStyle.setProp('transform', element, transformStr);
            }
          }
          // See PDFPageView.reset()
          self.div.removeAttribute('hidden');
        } else {
          for (i = 0, ii = annotationsData.length; i < ii; i++) {
            data = annotationsData[i];
            if (!data || !data.hasHtml) {
              continue;
            }

            element = PDFJS.AnnotationUtils.getHtmlElement(data,
              pdfPage.commonObjs);
            element.setAttribute('data-annotation-id', data.id);
            if (typeof mozL10n !== 'undefined') {
              mozL10n.translate(element);
            }

            var rect = data.rect;
            var view = pdfPage.view;
            rect = PDFJS.Util.normalizeRect([
              rect[0],
                view[3] - rect[1] + view[1],
              rect[2],
                view[3] - rect[3] + view[1]
            ]);
            element.style.left = rect[0] + 'px';
            element.style.top = rect[1] + 'px';
            element.style.position = 'absolute';

            CustomStyle.setProp('transform', element, transformStr);
            var transformOriginStr = -rect[0] + 'px ' + -rect[1] + 'px';
            CustomStyle.setProp('transformOrigin', element, transformOriginStr);

            if (data.subtype === 'Link' && !data.url) {
              var link = element.getElementsByTagName('a')[0];
              if (link) {
                if (data.action) {
                  bindNamedAction(link, data.action);
                } else {
                  bindLink(link, ('dest' in data) ? data.dest : null);
                }
              }
            }

            if (!self.div) {
              var annotationLayerDiv = document.createElement('div');
              annotationLayerDiv.className = 'annotationLayer';
              self.pageDiv.appendChild(annotationLayerDiv);
              self.div = annotationLayerDiv;
            }

            self.div.appendChild(element);
          }
        }
      });
    },

    hide: function () {
      if (!this.div) {
        return;
      }
      this.div.setAttribute('hidden', 'true');
    }
  };
  return AnnotationsLayerBuilder;
})();

/**
 * @constructor
 * @implements IPDFAnnotationsLayerFactory
 */
function DefaultAnnotationsLayerFactory() {}
DefaultAnnotationsLayerFactory.prototype = {
  /**
   * @param {HTMLDivElement} pageDiv
   * @param {PDFPage} pdfPage
   * @returns {AnnotationsLayerBuilder}
   */
  createAnnotationsLayerBuilder: function (pageDiv, pdfPage) {
    return new AnnotationsLayerBuilder({
      pageDiv: pageDiv,
      pdfPage: pdfPage,
      linkService: new SimpleLinkService(),
    });
  }
};


/**
 * @typedef {Object} PDFViewerOptions
 * @property {HTMLDivElement} container - The container for the viewer element.
 * @property {HTMLDivElement} viewer - (optional) The viewer element.
 * @property {IPDFLinkService} linkService - The navigation/linking service.
 * @property {PDFRenderingQueue} renderingQueue - (optional) The rendering
 *   queue object.
 * @property {boolean} removePageBorders - (optional) Removes the border shadow
 *   around the pages. The default is false.
 */

/**
 * Simple viewer control to display PDF content/pages.
 * @class
 * @implements {IRenderableView}
 */
var PDFViewer = (function pdfViewer() {
  function PDFPageViewBuffer(size) {
    var data = [];
    this.push = function cachePush(view) {
      var i = data.indexOf(view);
      if (i >= 0) {
        data.splice(i, 1);
      }
      data.push(view);
      if (data.length > size) {
        data.shift().destroy();
      }
    };
    this.resize = function (newSize) {
      size = newSize;
      while (data.length > size) {
        data.shift().destroy();
      }
    };
  }

  function isSameScale(oldScale, newScale) {
    if (newScale === oldScale) {
      return true;
    }
    if (Math.abs(newScale - oldScale) < 1e-15) {
      // Prevent unnecessary re-rendering of all pages when the scale
      // changes only because of limited numerical precision.
      return true;
    }
    return false;
  }

  /**
   * @constructs PDFViewer
   * @param {PDFViewerOptions} options
   */
  function PDFViewer(options) {
    this.container = options.container;
    this.viewer = options.viewer || options.container.firstElementChild;
    this.linkService = options.linkService || new SimpleLinkService();
    //[Bruce]
    //this.removePageBorders = options.removePageBorders || false;
    this.removePageBorders = options.removePageBorders || true;

    this.defaultRenderingQueue = !options.renderingQueue;
    if (this.defaultRenderingQueue) {
      // Custom rendering queue is not specified, using default one
      this.renderingQueue = new PDFRenderingQueue();
      this.renderingQueue.setViewer(this);
    } else {
      this.renderingQueue = options.renderingQueue;
    }

    this.scroll = watchScroll(this.container, this._scrollUpdate.bind(this));
    this.updateInProgress = false;
    //[Bruce]
    //this.presentationModeState = PresentationModeState.UNKNOWN;
    this.presentationModeState = PresentationModeState.CAROUSEL;
    //End : [Bruce]
    this._resetView();

    if (this.removePageBorders) {
      this.viewer.classList.add('removePageBorders');
    }
  }

  PDFViewer.prototype = /** @lends PDFViewer.prototype */{
    get pagesCount() {
      return this._pages.length;
    },

    getPageView: function (index) {
      return this._pages[index];
    },

    get currentPageNumber() {
      return this._currentPageNumber;
    },

    set currentPageNumber(val) {
      if (!this.pdfDocument) {
        this._currentPageNumber = val;
        return;
      }
      
      //[Bruce] NOTE : We must do this before set this._currentPageNumber
      if(this.isInCarouselMode) {
          if(this.currentPageNumber === val)
              return;
      }

      if (!canRead()){
    	window.alert("此書無法閱讀");
        PageAnimation.gotoPage({pageNum:PageAnimation.currentPageNum});
    	return;
      }

      var event = document.createEvent('UIEvents');
      event.initUIEvent('pagechange', true, true, window, 0);
      event.updateInProgress = this.updateInProgress;

      if (!(0 < val && val <= this.pagesCount)) {
        event.pageNumber = this._currentPageNumber;
        event.previousPageNumber = val;
        this.container.dispatchEvent(event);
        return;
      }

      event.previousPageNumber = this._currentPageNumber;
      this._currentPageNumber = val;
      event.pageNumber = val;
      this.container.dispatchEvent(event);

      // Check if the caller is `PDFViewer_update`, to avoid breaking scrolling.
      if (this.updateInProgress) {
        return;
      }
      this.scrollPageIntoView(val);
    },

    /**
     * @returns {number}
     */
    get currentScale() {
      return this._currentScale !== UNKNOWN_SCALE ? this._currentScale :
                                                    DEFAULT_SCALE;
    },

    /**
     * @param {number} val - Scale of the pages in percents.
     */
    set currentScale(val) {
      if (isNaN(val))  {
        throw new Error('Invalid numeric scale');
      }
      if (!this.pdfDocument) {
        this._currentScale = val;
        this._currentScaleValue = val !== UNKNOWN_SCALE ? val.toString() : null;
        return;
      }
      this._setScale(val, false);
    },

    /**
     * @returns {string}
     */
    get currentScaleValue() {
      return this._currentScaleValue;
    },

    /**
     * @param val - The scale of the pages (in percent or predefined value).
     */
    set currentScaleValue(val) {
      if (!this.pdfDocument) {
        this._currentScale = isNaN(val) ? UNKNOWN_SCALE : val;
        this._currentScaleValue = val;
        return;
      }
      this._setScale(val, false);
    },

    /**
     * @returns {number}
     */
    get pagesRotation() {
      return this._pagesRotation;
    },

    /**
     * @param {number} rotation - The rotation of the pages (0, 90, 180, 270).
     */
    set pagesRotation(rotation) {
      this._pagesRotation = rotation;

      for (var i = 0, l = this._pages.length; i < l; i++) {
        var pageView = this._pages[i];
        pageView.update(pageView.scale, rotation);
      }

      this._setScale(this._currentScaleValue, true);

      if (this.defaultRenderingQueue) {
        this.update();
      }
    },

    /**
     * @param pdfDocument {PDFDocument}
     */
    setDocument: function (pdfDocument) {
      if(DEBUG_CHROME_DEV_TOOL) {
          console.time('PDFViewer.setDocument()');
          console.timeStamp('PDFViewer.setDocument()');
      }

      if (this.pdfDocument) {
        this._resetView();
      }

      this.pdfDocument = pdfDocument;
      if (!pdfDocument) {
        return;
      }

      var pagesCount = pdfDocument.numPages;
      var self = this;

      var resolvePagesPromise;
      var pagesPromise = new Promise(function (resolve) {
        resolvePagesPromise = resolve;
      });
      this.pagesPromise = pagesPromise;
      pagesPromise.then(function () {
        var event = document.createEvent('CustomEvent');
        event.initCustomEvent('pagesloaded', true, true, {
          pagesCount: pagesCount
        });
        self.container.dispatchEvent(event);
      });

      var isOnePageRenderedResolved = false;
      var resolveOnePageRendered = null;
      var onePageRendered = new Promise(function (resolve) {
        resolveOnePageRendered = resolve;
      });
      this.onePageRendered = onePageRendered;

      var bindOnAfterAndBeforeDraw = function (pageView) {
        pageView.onBeforeDraw = function pdfViewLoadOnBeforeDraw() {
          // Add the page to the buffer at the start of drawing. That way it can
          // be evicted from the buffer and destroyed even if we pause its
          // rendering.
          self._buffer.push(this);
        };
        // when page is painted, using the image as thumbnail base
        pageView.onAfterDraw = function pdfViewLoadOnAfterDraw() {
          if (!isOnePageRenderedResolved) {
            isOnePageRenderedResolved = true;
            resolveOnePageRendered();
            //[Bruce]
            customEventsManager['onFirstPageRendered'].confirmThisIsReady();
            console.log("(onFirstPageRendered)");
          }
        };
      };

      var firstPagePromise = pdfDocument.getPage(1);
      this.firstPagePromise = firstPagePromise;

      if(DEBUG_CHROME_DEV_TOOL) {
          console.timeEnd('PDFViewer.setDocument()');
      }

      // Fetch a single page so we can get a viewport that will be the default
      // viewport for all pages
      return firstPagePromise.then(function(pdfPage) {
        if(DEBUG_CHROME_DEV_TOOL) {
            console.time('PDFViewer.setDocument() firstPagePromise');
            console.timeStamp('PDFViewer.setDocument() firstPagePromise');
        }

        var scale = this.currentScale;
        var viewport = pdfPage.getViewport(scale * CSS_UNITS);
        // [Bruce]
        // Only push the first two PageView's
        var pagesCountBeforeStart = 1;
        var pagesCountBeforeEnd = (pagesCountBeforeStart == pagesCount)? pagesCountBeforeStart : (pagesCountBeforeStart + 1);

        var pagesAfterStart = pagesCountBeforeEnd + 1;
        var pagesAfterEnd = pagesCount;

        var isOwlCarouselAddedFromHead = direct_reverse;

        //                                 |----(before)(1,2)-----|----(after)-----|
        // |----(direct_reverse after)-----|----(before)(2,1)-----|
        // Get before
        for (var pageNum = pagesCountBeforeStart; pageNum <= pagesCountBeforeEnd; pageNum++) {
          var textLayerFactory = null;
          if (!PDFJS.disableTextLayer) {
            textLayerFactory = this;
          }
          var pageView = new PDFPageView({
            container: this.viewer,
            id: pageNum,
            scale: scale,
            defaultViewport: viewport.clone(),
            renderingQueue: this.renderingQueue,
            textLayerFactory: textLayerFactory,
            annotationsLayerFactory: this,
            isOwlCarouselAddedFromHead: isOwlCarouselAddedFromHead
          });
          bindOnAfterAndBeforeDraw(pageView);
          this._pages.push(pageView);
        }

        // Get after
        if(pagesAfterStart < pagesCount) {
          customEventsManager['onFirstPageRendered'].promise.then(function () {

            for (var pageNum = pagesAfterStart; pageNum <= pagesAfterEnd; pageNum++) {
              var textLayerFactory = null;
              if (!PDFJS.disableTextLayer) {
                textLayerFactory = this;
              }
              var pageView = new PDFPageView({
                container: this.viewer,
                id: pageNum,
                scale: scale,
                defaultViewport: viewport.clone(),
                renderingQueue: this.renderingQueue,
                textLayerFactory: textLayerFactory,
                annotationsLayerFactory: this,
                isOwlCarouselAddedFromHead: isOwlCarouselAddedFromHead
              });
              bindOnAfterAndBeforeDraw(pageView);
              this._pages.push(pageView);

              // We should set proper scale value(the first two PDFPageView has been set in setInitialView() )
              pageView.update(this._currentScale);
            }
            $viewerOwl.trigger('refresh.owl.carousel');
            customEventsManager['onDelayedPageDIVsReady'].confirmThisIsReady();

          }.bind(this));
        }

        /*
        for (var pageNum = 1; pageNum <= pagesCount; ++pageNum) {
          var textLayerFactory = null;
          if (!PDFJS.disableTextLayer) {
            textLayerFactory = this;
          }
          var pageView = new PDFPageView({
            container: this.viewer,
            id: pageNum,
            scale: scale,
            defaultViewport: viewport.clone(),
            renderingQueue: this.renderingQueue,
            textLayerFactory: textLayerFactory,
            annotationsLayerFactory: this
          });
          bindOnAfterAndBeforeDraw(pageView);
          this._pages.push(pageView);
        }
        */
        // End : [Bruce]
        var linkService = this.linkService;
		
        // Fetch all the pages since the viewport is needed before printing
        // starts to create the correct size canvas. Wait until one page is
        // rendered so we don't tie up too many resources early on.
        onePageRendered.then(function () {
          if(DEBUG_CHROME_DEV_TOOL) {
              console.time('PDFViewer.setDocument() firstPagePromise onePageRendered');
              console.timeStamp('PDFViewer.setDocument() firstPagePromise onePageRendered');
          }

          if (!PDFJS.disableAutoFetch) {
            var getPagesLeft = pagesCount;
            for (var pageNum = 1; pageNum <= pagesCount; ++pageNum) {
              pdfDocument.getPage(pageNum).then(function (pageNum, pdfPage) {
                var pageView = self._pages[pageNum - 1];
                if (!pageView.pdfPage) {
                  pageView.setPdfPage(pdfPage);
                }
                linkService.cachePageRef(pageNum, pdfPage.ref);
                getPagesLeft--;
                if (!getPagesLeft) {
                  resolvePagesPromise();
                }
              }.bind(null, pageNum));
            }
          } else {
            // XXX: Printing is semi-broken with auto fetch disabled.
            resolvePagesPromise();
          }

          if(DEBUG_CHROME_DEV_TOOL) {
              console.timeEnd('PDFViewer.setDocument() firstPagePromise onePageRendered');
          }
        });

        var event = document.createEvent('CustomEvent');
        event.initCustomEvent('pagesinit', true, true, null);
        self.container.dispatchEvent(event);

        if (this.defaultRenderingQueue) {
          this.update();
        }

        if (this.findController) {
          this.findController.resolveFirstPage();
        }
        //[Bruce]
        customEventsManager["onOwlLayoutReady"].confirmThisIsReady();
        if(DEBUG_CHROME_DEV_TOOL) {
            console.timeEnd('PDFViewer.setDocument() firstPagePromise');
        }
      }.bind(this));
    },

    _resetView: function () {
      this._pages = [];
      this._currentPageNumber = 1;
      this._currentScale = UNKNOWN_SCALE;
      this._currentScaleValue = null;
      this._buffer = new PDFPageViewBuffer(DEFAULT_CACHE_SIZE);
      this._location = null;
      this._pagesRotation = 0;
      this._pagesRequests = [];

      var container = this.viewer;
      while (container.hasChildNodes()) {
        container.removeChild(container.lastChild);
      }
    },

    _scrollUpdate: function PDFViewer_scrollUpdate() {
      if (this.pagesCount === 0) {
        return;
      }
      this.update();
      for (var i = 0, ii = this._pages.length; i < ii; i++) {
        this._pages[i].updatePosition();
      }
    },

    _setScaleDispatchEvent: function pdfViewer_setScaleDispatchEvent(
        newScale, newValue, preset) {
      var event = document.createEvent('UIEvents');
      event.initUIEvent('scalechange', true, true, window, 0);
      event.scale = newScale;
      if (preset) {
        event.presetValue = newValue;
      }
      this.container.dispatchEvent(event);
    },

    _setScaleUpdatePages: function pdfViewer_setScaleUpdatePages(
        newScale, newValue, noScroll, preset) {
      this._currentScaleValue = newValue;

      if (isSameScale(this._currentScale, newScale)) {
        if (preset) {
          this._setScaleDispatchEvent(newScale, newValue, true);
        }
        return;
      }

      for (var i = 0, ii = this._pages.length; i < ii; i++) {
        this._pages[i].update(newScale);
        //[Phoebe]Copy the width and height of page 1 to page0
        if (i == 0 && TwoPageViewMode.active) {
            var pageEmptyDiv = document.getElementById('pageContainer0');
            pageEmptyDiv.style.width = Math.floor(this._pages[0].width) + 'px';
            pageEmptyDiv.style.height = Math.floor(this._pages[0].height) + 'px';
            //[Phoebe]Fix the null point error.
            if (pageEmptyDiv.children[0].children[0]){
                pageEmptyDiv.children[0].style.width = Math.floor(this._pages[0].width) + 'px';
                pageEmptyDiv.children[0].style.height = Math.floor(this._pages[0].height) + 'px';
                pageEmptyDiv.children[0].children[0].style.width = Math.floor(this._pages[0].width) + 'px';
                pageEmptyDiv.children[0].children[0].style.height = Math.floor(this._pages[0].height) + 'px';
            }else{
                if (pageEmptyDiv.firstChild){
                    pageEmptyDiv.removeChild(pageEmptyDiv.firstChild);
                    var fakeCanvasWrapper = document.createElement("div");
                    fakeCanvasWrapper.class = "canvasWrapper";
                    fakeCanvasWrapper.style.width = Math.floor(this._pages[0].width) + 'px';
                    fakeCanvasWrapper.style.height = Math.floor(this._pages[0].height) + 'px';
                    pageEmptyDiv.appendChild(fakeCanvasWrapper);
                }
            }
        }
      }
      this._currentScale = newScale;

      if (!noScroll) {
        var page = this._currentPageNumber, dest;
        if (this._location && !IGNORE_CURRENT_POSITION_ON_ZOOM &&
            !(this.isInPresentationMode || this.isChangingPresentationMode)) {
          page = this._location.pageNumber;
          dest = [null, { name: 'XYZ' }, this._location.left,
                  this._location.top, null];
        }
        this.scrollPageIntoView(page, dest);
      }

      this._setScaleDispatchEvent(newScale, newValue, preset);

      if (this.defaultRenderingQueue) {
        this.update();
      }
    },

    _setScale: function pdfViewer_setScale(value, noScroll) {
      var scale = parseFloat(value);

      if (scale > 0) {
        this._setScaleUpdatePages(scale, value, noScroll, false);
      } else {
        var currentPage = this._pages[this._currentPageNumber - 1];
        if (!currentPage) {
          return;
        }
        var hPadding = (this.isInPresentationMode || this.removePageBorders) ?
          0 : SCROLLBAR_PADDING;
        var vPadding = (this.isInPresentationMode || this.removePageBorders) ?
          0 : VERTICAL_PADDING;
        var pageWidthScale = (this.container.clientWidth - hPadding) /
                             currentPage.width * currentPage.scale;
        var pageHeightScale = (this.container.clientHeight - vPadding) /
                              currentPage.height * currentPage.scale;

        if (TwoPageViewMode.active) {
            pageWidthScale /= 2;
			pageWidthScale = pageWidthScale - 0.01;
        }

        switch (value) {
          case 'page-actual':
            scale = 1;
            break;
          case 'page-width':
            scale = pageWidthScale;
            break;
          case 'page-height':
            scale = pageHeightScale;
            break;
          case 'page-fit':
            scale = Math.min(pageWidthScale, pageHeightScale);
            break;
          case 'auto':
            var isLandscape = (currentPage.width > currentPage.height);
            // For pages in landscape mode, fit the page height to the viewer
            // *unless* the page would thus become too wide to fit horizontally.
            var horizontalScale = isLandscape ?
              Math.min(pageHeightScale, pageWidthScale) : pageWidthScale;
            scale = Math.min(MAX_AUTO_SCALE, horizontalScale);
            break;
          default:
            console.error('pdfViewSetScale: \'' + value +
              '\' is an unknown zoom value.');
            return;
        }
        this._setScaleUpdatePages(scale, value, noScroll, true);
      }
    },

    /**
     * Scrolls page into view.
     * @param {number} pageNumber
     * @param {Array} dest - (optional) original PDF destination array:
     *   <page-ref> </XYZ|FitXXX> <args..>
     */
    scrollPageIntoView: function PDFViewer_scrollPageIntoView(pageNumber,
                                                              dest) {
      if (!this.pdfDocument) {
        return;
      }
                                                         
      var pageView = this._pages[pageNumber - 1];

      //[Bruce] Carousel mode no need to update page view by ourself
      if(this.isInCarouselMode) {
          if(pageNumber !== PageAnimation.currentPageNum) {
              PageAnimation.gotoPage({pageNum:pageNumber});
          }
          return;
      }
      //End : [Bruce]

      if (this.isInPresentationMode) {
        if (this._currentPageNumber !== pageView.id) {
          // Avoid breaking getVisiblePages in presentation mode.
          this.currentPageNumber = pageView.id;
          return;
        }
        dest = null;
        // Fixes the case when PDF has different page sizes.
        this._setScale(this._currentScaleValue, true);
      }
      if (!dest) {
        //[Bruce]
        //scrollIntoView(pageView.div);
        scrollIntoView_with_X_axis(pageView.div);
        //End : [Bruce]
        return;
      }

      var x = 0, y = 0;
      var width = 0, height = 0, widthScale, heightScale;
      var changeOrientation = (pageView.rotation % 180 === 0 ? false : true);
      var pageWidth = (changeOrientation ? pageView.height : pageView.width) /
        pageView.scale / CSS_UNITS;
      var pageHeight = (changeOrientation ? pageView.width : pageView.height) /
        pageView.scale / CSS_UNITS;
      var scale = 0;
      switch (dest[1].name) {
        case 'XYZ':
          x = dest[2];
          y = dest[3];
          scale = dest[4];
          // If x and/or y coordinates are not supplied, default to
          // _top_ left of the page (not the obvious bottom left,
          // since aligning the bottom of the intended page with the
          // top of the window is rarely helpful).
          //[Bruce]
          //x = x !== null ? x : 0;
          //y = y !== null ? y : pageHeight;
          x = x !== null ? x : pageWidth;
          y = y !== null ? y : 0;
          //End : [Bruce]
          break;
        case 'Fit':
        case 'FitB':
          scale = 'page-fit';
          break;
        case 'FitH':
        case 'FitBH':
          y = dest[2];
          scale = 'page-width';
          // According to the PDF spec, section 12.3.2.2, a `null` value in the
          // parameter should maintain the position relative to the new page.
          if (y === null && this._location) {
            x = this._location.left;
            y = this._location.top;
          }
          break;
        case 'FitV':
        case 'FitBV':
          x = dest[2];
          width = pageWidth;
          height = pageHeight;
          scale = 'page-height';
          break;
        case 'FitR':
          x = dest[2];
          y = dest[3];
          width = dest[4] - x;
          height = dest[5] - y;
          var hPadding = this.removePageBorders ? 0 : SCROLLBAR_PADDING;
          var vPadding = this.removePageBorders ? 0 : VERTICAL_PADDING;

          widthScale = (this.container.clientWidth - hPadding) /
            width / CSS_UNITS;
          heightScale = (this.container.clientHeight - vPadding) /
            height / CSS_UNITS;
          scale = Math.min(Math.abs(widthScale), Math.abs(heightScale));
          break;
        default:
          return;
      }

      if (scale && scale !== this._currentScale) {
        this.currentScaleValue = scale;
      } else if (this._currentScale === UNKNOWN_SCALE) {
        this.currentScaleValue = DEFAULT_SCALE_VALUE;
      }

      if (scale === 'page-fit' && !dest[4]) {
        //[Bruce]
        scrollIntoView_with_X_axis(pageView.div);
        //scrollIntoView(pageView.div);
        //[Bruce]
        return;
      }

      var boundingRect = [
        pageView.viewport.convertToViewportPoint(x, y),
        pageView.viewport.convertToViewportPoint(x + width, y + height)
      ];
      var left = Math.min(boundingRect[0][0], boundingRect[1][0]);
      var top = Math.min(boundingRect[0][1], boundingRect[1][1]);

      //[Bruce]
      scrollIntoView_with_X_axis(pageView.div, { left: left, top: top });
      //scrollIntoView(pageView.div, { left: left, top: top });
      //[Bruce]
    },

    _updateLocation: function (firstPage) {
      var currentScale = this._currentScale;
      var currentScaleValue = this._currentScaleValue;
      var normalizedScaleValue =
        parseFloat(currentScaleValue) === currentScale ?
        Math.round(currentScale * 10000) / 100 : currentScaleValue;

      var pageNumber = firstPage.id;
      var pdfOpenParams = '#page=' + pageNumber;
      pdfOpenParams += '&zoom=' + normalizedScaleValue;
      var currentPageView = this._pages[pageNumber - 1];
      var container = this.container;
      var topLeft = currentPageView.getPagePoint(
        (container.scrollLeft - firstPage.x),
        (container.scrollTop - firstPage.y));
      var intLeft = Math.round(topLeft[0]);
      var intTop = Math.round(topLeft[1]);
      pdfOpenParams += ',' + intLeft + ',' + intTop;
      //phoebe
        var twoPageView = TwoPageViewMode.hashParams;
        if (twoPageView) {
            pdfOpenParams += '&twoPageView=' + twoPageView;
        }

      this._location = {
        pageNumber: pageNumber,
        scale: normalizedScaleValue,
        top: intTop,
        left: intLeft,
        twoPageView: twoPageView,
        pdfOpenParams: pdfOpenParams
      };
    },

    update: function PDFViewer_update() {
      var visible = this._getVisiblePages();
      var visiblePages = visible.views;
      if (visiblePages.length === 0) {
        return;
      }

      this.updateInProgress = true;

      var suggestedCacheSize = Math.max(DEFAULT_CACHE_SIZE,
          2 * visiblePages.length + 1);
      this._buffer.resize(suggestedCacheSize);

      this.renderingQueue.renderHighestPriority(visible);

      var currentId = this._currentPageNumber;
      var firstPage = visible.first;

      for (var i = 0, ii = visiblePages.length, stillFullyVisible = false;
           i < ii; ++i) {
        var page = visiblePages[i];

        if (page.percent < 100) {
          break;
        }
        if (page.id === currentId) {
          stillFullyVisible = true;
          break;
        }
      }

      if (!stillFullyVisible) {
        currentId = visiblePages[0].id;
      }

      if (!this.isInPresentationMode) {
        this.currentPageNumber = currentId;
      }

      this._updateLocation(firstPage);

      this.updateInProgress = false;

      var event = document.createEvent('UIEvents');
      event.initUIEvent('updateviewarea', true, true, window, 0);
      event.location = this._location;
      this.container.dispatchEvent(event);
    },

    containsElement: function (element) {
      return this.container.contains(element);
    },

    focus: function () {
      this.container.focus();
    },

    //[Bruce]
    get isInCarouselMode() {
      return this.presentationModeState === PresentationModeState.CAROUSEL;
    },
    //End : [Bruce]

    get isInPresentationMode() {
      return this.presentationModeState === PresentationModeState.FULLSCREEN;
    },

    get isChangingPresentationMode() {
      return this.PresentationModeState === PresentationModeState.CHANGING;
    },

    get isHorizontalScrollbarEnabled() {
      return (this.isInPresentationMode ?
        false : (this.container.scrollWidth > this.container.clientWidth));
    },

    _getVisiblePages: function () {
      if (!this.isInPresentationMode
        //[Bruce]
             && !this.isInCarouselMode) {
        //return getVisibleElements(this.container, this._pages, true);
        return getVisibleElements_with_X_axis(this.container, this._pages, true);
        //End : [Bruce]
      //[Bruce]
      } else if(this.isInCarouselMode){
        var visible = [];
        var currentPage = this._pages[this._currentPageNumber - 1];
        var nextPage = currentPage;
        visible.push({ id: currentPage.id, view: currentPage });

        // Try to load the next page
        if((currentPage.id - 1) < this._pages.length) {
            var nextPage = this._pages[this._currentPageNumber];
            if(nextPage) {
                visible.push({ id: nextPage.id, view: nextPage });
            } else {
                nextPage = currentPage;
            }
        }
        return { first: currentPage, last: nextPage, views: visible };
      //End : [Bruce]
      } else {
        // The algorithm in getVisibleElements doesn't work in all browsers and
        // configurations when presentation mode is active.
        var visible = [];
        var currentPage = this._pages[this._currentPageNumber - 1];
        visible.push({ id: currentPage.id, view: currentPage });
        return { first: currentPage, last: currentPage, views: visible };
      }
    },

    cleanup: function () {
      for (var i = 0, ii = this._pages.length; i < ii; i++) {
        if (this._pages[i] &&
            this._pages[i].renderingState !== RenderingStates.FINISHED) {
          this._pages[i].reset();
        }
      }
    },

    /**
     * @param {PDFPageView} pageView
     * @returns {PDFPage}
     * @private
     */
    _ensurePdfPageLoaded: function (pageView) {
      if (pageView.pdfPage) {
        return Promise.resolve(pageView.pdfPage);
      }
      var pageNumber = pageView.id;
      if (this._pagesRequests[pageNumber]) {
        return this._pagesRequests[pageNumber];
      }
      var promise = this.pdfDocument.getPage(pageNumber).then(
          function (pdfPage) {
        pageView.setPdfPage(pdfPage);
        this._pagesRequests[pageNumber] = null;
        return pdfPage;
      }.bind(this));
      this._pagesRequests[pageNumber] = promise;
      return promise;
    },

    forceRendering: function (currentlyVisiblePages) {
      var visiblePages = currentlyVisiblePages || this._getVisiblePages();
      var pageView = this.renderingQueue.getHighestPriority(visiblePages,
                                                            this._pages,
                                                            this.scroll.down);
      if (pageView) {
        this._ensurePdfPageLoaded(pageView).then(function () {
          this.renderingQueue.renderView(pageView);
        }.bind(this));
        return true;
      }
      return false;
    },

    getPageTextContent: function (pageIndex) {
      return this.pdfDocument.getPage(pageIndex + 1).then(function (page) {
        return page.getTextContent();
      });
    },

    /**
     * @param {HTMLDivElement} textLayerDiv
     * @param {number} pageIndex
     * @param {PageViewport} viewport
     * @returns {TextLayerBuilder}
     */
    createTextLayerBuilder: function (textLayerDiv, pageIndex, viewport) {
      return new TextLayerBuilder({
        textLayerDiv: textLayerDiv,
        pageIndex: pageIndex,
        viewport: viewport,
        findController: this.isInPresentationMode ? null : this.findController
      });
    },

    /**
     * @param {HTMLDivElement} pageDiv
     * @param {PDFPage} pdfPage
     * @returns {AnnotationsLayerBuilder}
     */
    createAnnotationsLayerBuilder: function (pageDiv, pdfPage) {
      return new AnnotationsLayerBuilder({
        pageDiv: pageDiv,
        pdfPage: pdfPage,
        linkService: this.linkService
      });
    },

    setFindController: function (findController) {
      this.findController = findController;
    },
  };

  return PDFViewer;
})();

var SimpleLinkService = (function SimpleLinkServiceClosure() {
  function SimpleLinkService() {}

  SimpleLinkService.prototype = {
    /**
     * @returns {number}
     */
    get page() {
      return 0;
    },
    /**
     * @param {number} value
     */
    set page(value) {},
    /**
     * @param dest - The PDF destination object.
     */
    navigateTo: function (dest) {},
    /**
     * @param dest - The PDF destination object.
     * @returns {string} The hyperlink to the PDF object.
     */
    getDestinationHash: function (dest) {
      return '#';
    },
    /**
     * @param hash - The PDF parameters/hash.
     * @returns {string} The hyperlink to the PDF object.
     */
    getAnchorUrl: function (hash) {
      return '#';
    },
    /**
     * @param {string} hash
     */
    setHash: function (hash) {},
    /**
     * @param {string} action
     */
    executeNamedAction: function (action) {},
    /**
     * @param {number} pageNum - page number.
     * @param {Object} pageRef - reference to the page.
     */
    cachePageRef: function (pageNum, pageRef) {}
  };
  return SimpleLinkService;
})();


var THUMBNAIL_SCROLL_MARGIN = -19;


var THUMBNAIL_WIDTH = 98; // px
//[Bruce]
var THUMBNAIL_HEIGHT = 98; // px
var THUMBNAIL_CANVAS_BORDER_WIDTH = 1; // px

/**
 * @typedef {Object} PDFThumbnailViewOptions
 * @property {HTMLDivElement} container - The viewer element.
 * @property {number} id - The thumbnail's unique ID (normally its number).
 * @property {PageViewport} defaultViewport - The page viewport.
 * @property {IPDFLinkService} linkService - The navigation/linking service.
 * @property {PDFRenderingQueue} renderingQueue - The rendering queue object.
 */

/**
 * @class
 * @implements {IRenderableView}
 */
var PDFThumbnailView = (function PDFThumbnailViewClosure() {
  function getTempCanvas(width, height) {
    var tempCanvas = PDFThumbnailView.tempImageCache;
    if (!tempCanvas) {
      tempCanvas = document.createElement('canvas');
      PDFThumbnailView.tempImageCache = tempCanvas;
    }
    tempCanvas.width = width;
    tempCanvas.height = height;

    // Since this is a temporary canvas, we need to fill the canvas with a white
    // background ourselves. |_getPageDrawContext| uses CSS rules for this.
    var ctx = tempCanvas.getContext('2d');
    ctx.save();
    ctx.fillStyle = 'rgb(255, 255, 255)';
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
    return tempCanvas;
  }

  /**
   * @constructs PDFThumbnailView
   * @param {PDFThumbnailViewOptions} options
   */
  function PDFThumbnailView(options) {
    var container = options.container;
    var id = options.id;
    var defaultViewport = options.defaultViewport;
    var linkService = options.linkService;
    var renderingQueue = options.renderingQueue;

    //[Bruce]
    var linkItems = options.linkItems;
    //End : [Bruce]

    this.id = id;
    this.renderingId = 'thumbnail' + id;

    this.pdfPage = null;
    this.rotation = 0;
    this.viewport = defaultViewport;
    this.pdfPageRotate = defaultViewport.rotation;

    this.linkService = linkService;
    this.renderingQueue = renderingQueue;

    this.hasImage = false;
    this.resume = null;
    this.renderingState = RenderingStates.INITIAL;

    this.pageWidth = this.viewport.width;
    this.pageHeight = this.viewport.height;
    this.pageRatio = this.pageWidth / this.pageHeight;

    //[Bruce] For horizantal view
    //this.canvasWidth = THUMBNAIL_WIDTH;
    //this.canvasHeight = (this.canvasWidth / this.pageRatio) | 0;
    this.canvasHeight = THUMBNAIL_HEIGHT;
    this.canvasWidth = (this.canvasHeight * this.pageRatio) | 0;
    //End : [Bruce] For horizantal view
    this.scale = this.canvasWidth / this.pageWidth;

    var anchor = document.createElement('a');
    anchor.href = linkService.getAnchorUrl('#page=' + id);
    //[Bruce]
    /*
    anchor.title = mozL10n.get('thumb_page_title', {page: id}, 'Page {{page}}');
    anchor.onclick = function stopNavigation() {
      linkService.page = id;
      return false;
    };
    */
    if(PDFViewerApplication.pdfViewer.isInCarouselMode) {
        anchor.className = 'item';
    }
    //End : [Bruce]

    var div = document.createElement('div');
    div.id = 'thumbnailContainer' + id;
    div.className = 'thumbnail';
    this.div = div;

    //if (id === 1) {
      // Highlight the thumbnail of the first page when no page number is
      // specified (or exists in cache) when the document is loaded.
      //div.classList.add('selected');
    //}

    var ring = document.createElement('div');
    ring.className = 'thumbnailSelectionRing';
    var borderAdjustment = 2 * THUMBNAIL_CANVAS_BORDER_WIDTH;
    ring.style.width = this.canvasWidth + borderAdjustment + 'px';
    ring.style.height = this.canvasHeight + borderAdjustment + 'px';
    this.ring = ring;

    //[Bruce]
    var img = document.createElement('img');
    if(PDFViewerApplication.pdfViewer.isInCarouselMode) {
        if (id < 6) {
            //Force to load first 5 thumbnails.
            img.src = linkItems[this.id - 1];
        } else {
            // the others using lazy load.
            img.className = 'owl-lazy';
            img.setAttribute('data-src', linkItems[this.id - 1]);
        }
    } else {
        img.src = linkItems[this.id - 1];
    }
    ring.appendChild(img);
    var p = document.createElement('p');
    p.className='index';
    p.style.color = 'white';
    p.innerHTML=this.id;
    //End : [Bruce]

    div.appendChild(ring);
    //[Bruce] Append after image
    div.appendChild(p);
    anchor.appendChild(div);

    //[Bruce]
    if(PDFViewerApplication.pdfViewer.isInCarouselMode) {
        $viewThumbnailOwl.trigger('add.owl.carousel',[anchor]);
    } else {
        container.appendChild(anchor);
    }
    //End : [Bruce]
  }

  PDFThumbnailView.prototype = {
    setPdfPage: function PDFThumbnailView_setPdfPage(pdfPage) {
      this.pdfPage = pdfPage;
      this.pdfPageRotate = pdfPage.rotate;
      var totalRotation = (this.rotation + this.pdfPageRotate) % 360;
      this.viewport = pdfPage.getViewport(1, totalRotation);
      this.reset();
    },

    reset: function PDFThumbnailView_reset() {
      if (this.renderTask) {
        this.renderTask.cancel();
      }
      this.hasImage = false;
      this.resume = null;
      this.renderingState = RenderingStates.INITIAL;

      this.pageWidth = this.viewport.width;
      this.pageHeight = this.viewport.height;
      this.pageRatio = this.pageWidth / this.pageHeight;

      this.canvasHeight = (this.canvasWidth / this.pageRatio) | 0;
      this.scale = (this.canvasWidth / this.pageWidth);

      this.div.removeAttribute('data-loaded');
      var ring = this.ring;
      var childNodes = ring.childNodes;
      for (var i = childNodes.length - 1; i >= 0; i--) {
        ring.removeChild(childNodes[i]);
      }
      var borderAdjustment = 2 * THUMBNAIL_CANVAS_BORDER_WIDTH;
      ring.style.width = this.canvasWidth + borderAdjustment + 'px';
      ring.style.height = this.canvasHeight + borderAdjustment + 'px';

      if (this.canvas) {
        // Zeroing the width and height causes Firefox to release graphics
        // resources immediately, which can greatly reduce memory consumption.
        this.canvas.width = 0;
        this.canvas.height = 0;
        delete this.canvas;
      }
      if (this.image) {
        this.image.removeAttribute('src');
        delete this.image;
      }
    },

    update: function PDFThumbnailView_update(rotation) {
      if (typeof rotation !== 'undefined') {
        this.rotation = rotation;
      }
      var totalRotation = (this.rotation + this.pdfPageRotate) % 360;
      this.viewport = this.viewport.clone({
        scale: 1,
        rotation: totalRotation
      });
      this.reset();
    },

    /**
     * @private
     */
    _getPageDrawContext:
        function PDFThumbnailView_getPageDrawContext(noCtxScale) {
      var canvas = document.createElement('canvas');
      canvas.id = this.renderingId;

      canvas.className = 'thumbnailImage';
      canvas.setAttribute('aria-label', mozL10n.get('thumb_page_canvas',
        {page: this.id}, 'Thumbnail of Page {{page}}'));

      this.canvas = canvas;
      this.div.setAttribute('data-loaded', true);
      this.ring.appendChild(canvas);

      var ctx = canvas.getContext('2d');
      var outputScale = getOutputScale(ctx);
      canvas.width = (this.canvasWidth * outputScale.sx) | 0;
      canvas.height = (this.canvasHeight * outputScale.sy) | 0;
      canvas.style.width = this.canvasWidth + 'px';
      canvas.style.height = this.canvasHeight + 'px';
      if (!noCtxScale && outputScale.scaled) {
        ctx.scale(outputScale.sx, outputScale.sy);
      }
      return ctx;
    },

    draw: function PDFThumbnailView_draw() {
      if (this.renderingState !== RenderingStates.INITIAL) {
        console.error('Must be in new state before drawing');
      }
      if (this.hasImage) {
        return Promise.resolve(undefined);
      }
      this.hasImage = true;
      this.renderingState = RenderingStates.RUNNING;

      var resolveRenderPromise, rejectRenderPromise;
      var promise = new Promise(function (resolve, reject) {
        resolveRenderPromise = resolve;
        rejectRenderPromise = reject;
      });

      var self = this;
      function thumbnailDrawCallback(error) {
        // The renderTask may have been replaced by a new one, so only remove
        // the reference to the renderTask if it matches the one that is
        // triggering this callback.
        if (renderTask === self.renderTask) {
          self.renderTask = null;
        }
        if (error === 'cancelled') {
          rejectRenderPromise(error);
          return;
        }
        self.renderingState = RenderingStates.FINISHED;

        if (!error) {
          resolveRenderPromise(undefined);
        } else {
          rejectRenderPromise(error);
        }
      }

      var ctx = this._getPageDrawContext();
      var drawViewport = this.viewport.clone({ scale: this.scale });
      var renderContinueCallback = function renderContinueCallback(cont) {
        if (!self.renderingQueue.isHighestPriority(self)) {
          self.renderingState = RenderingStates.PAUSED;
          self.resume = function resumeCallback() {
            self.renderingState = RenderingStates.RUNNING;
            cont();
          };
          return;
        }
        cont();
      };

      var renderContext = {
        canvasContext: ctx,
        viewport: drawViewport,
        continueCallback: renderContinueCallback
      };
      var renderTask = this.renderTask = this.pdfPage.render(renderContext);

      renderTask.promise.then(
        function pdfPageRenderCallback() {
          thumbnailDrawCallback(null);
        },
        function pdfPageRenderError(error) {
          thumbnailDrawCallback(error);
        }
      );
      return promise;
    },

    setImage: function PDFThumbnailView_setImage(pageView) {
      var img = pageView.canvas;
      if (this.hasImage || !img) {
        return;
      }
      if (!this.pdfPage) {
        this.setPdfPage(pageView.pdfPage);
      }
      this.hasImage = true;
      this.renderingState = RenderingStates.FINISHED;

      var ctx = this._getPageDrawContext(true);
      var canvas = ctx.canvas;

      if (img.width <= 2 * canvas.width) {
        ctx.drawImage(img, 0, 0, img.width, img.height,
                      0, 0, canvas.width, canvas.height);
        return;
      }
      // drawImage does an awful job of rescaling the image, doing it gradually.
      var MAX_NUM_SCALING_STEPS = 3;
      var reducedWidth = canvas.width << MAX_NUM_SCALING_STEPS;
      var reducedHeight = canvas.height << MAX_NUM_SCALING_STEPS;
      var reducedImage = getTempCanvas(reducedWidth, reducedHeight);
      var reducedImageCtx = reducedImage.getContext('2d');

      while (reducedWidth > img.width || reducedHeight > img.height) {
        reducedWidth >>= 1;
        reducedHeight >>= 1;
      }
      reducedImageCtx.drawImage(img, 0, 0, img.width, img.height,
                                0, 0, reducedWidth, reducedHeight);
      while (reducedWidth > 2 * canvas.width) {
        reducedImageCtx.drawImage(reducedImage,
                                  0, 0, reducedWidth, reducedHeight,
                                  0, 0, reducedWidth >> 1, reducedHeight >> 1);
        reducedWidth >>= 1;
        reducedHeight >>= 1;
      }
      ctx.drawImage(reducedImage, 0, 0, reducedWidth, reducedHeight,
                    0, 0, canvas.width, canvas.height);
    }
  };

  return PDFThumbnailView;
})();

PDFThumbnailView.tempImageCache = null;


/**
 * @typedef {Object} PDFThumbnailViewerOptions
 * @property {HTMLDivElement} container - The container for the thumbnail
 *   elements.
 * @property {IPDFLinkService} linkService - The navigation/linking service.
 * @property {PDFRenderingQueue} renderingQueue - The rendering queue object.
 */

/**
 * Simple viewer control to display thumbnails for pages.
 * @class
 * @implements {IRenderableView}
 */
var PDFThumbnailViewer = (function PDFThumbnailViewerClosure() {
  /**
   * @constructs PDFThumbnailViewer
   * @param {PDFThumbnailViewerOptions} options
   */
  function PDFThumbnailViewer(options) {
    this.container = options.container;
    this.renderingQueue = options.renderingQueue;
    this.linkService = options.linkService;

    this.scroll = watchScroll(this.container, this._scrollUpdated.bind(this));
    this._resetView();
  }

  PDFThumbnailViewer.prototype = {
    /**
     * @private
     */
    _scrollUpdated: function PDFThumbnailViewer_scrollUpdated() {
      this.renderingQueue.renderHighestPriority();
    },

    getThumbnail: function PDFThumbnailViewer_getThumbnail(index) {
      return this.thumbnails[index];
    },

    /**
     * @private
     */
    _getVisibleThumbs: function PDFThumbnailViewer_getVisibleThumbs() {
      //[Bruce]
      //return getVisibleElements(this.container, this.thumbnails);
      return getVisibleElements_with_X_axis(this.container, this.thumbnails);
      //End : [Bruce]
    },

    scrollThumbnailIntoView:
        function PDFThumbnailViewer_scrollThumbnailIntoView(page) {
      //[Bruce]
      if(PDFViewerApplication.pdfViewer.isInCarouselMode) {
          $viewThumbnailOwl.trigger('refresh.owl.carousel');
          $viewThumbnailOwl.trigger('to.owl.carousel',[page - 1, 200, true]);
          return;
      }
      //End : [Bruce]
      var selected = document.querySelector('.thumbnail.selected');
      if (selected) {
        selected.classList.remove('selected');
      }
      var thumbnail = document.getElementById('thumbnailContainer' + page);
      if (thumbnail) {
        thumbnail.classList.add('selected');
      }
      var visibleThumbs = this._getVisibleThumbs();
      var numVisibleThumbs = visibleThumbs.views.length;

      // If the thumbnail isn't currently visible, scroll it into view.
      if (numVisibleThumbs > 0) {
        var first = visibleThumbs.first.id;
        // Account for only one thumbnail being visible.
        var last = (numVisibleThumbs > 1 ? visibleThumbs.last.id : first);
        if (page <= first || page >= last) {
          scrollIntoView(thumbnail, { top: THUMBNAIL_SCROLL_MARGIN });
        }
      }
    },

    //[Bruce]
    get isUsingExternalImage() {
      return this._isUsingExternalImage;
    },
    //End : [Bruce]

    get pagesRotation() {
      return this._pagesRotation;
    },

    set pagesRotation(rotation) {
      this._pagesRotation = rotation;
      for (var i = 0, l = this.thumbnails.length; i < l; i++) {
        var thumb = this.thumbnails[i];
        thumb.update(rotation);
      }
    },

    cleanup: function PDFThumbnailViewer_cleanup() {
      var tempCanvas = PDFThumbnailView.tempImageCache;
      if (tempCanvas) {
        // Zeroing the width and height causes Firefox to release graphics
        // resources immediately, which can greatly reduce memory consumption.
        tempCanvas.width = 0;
        tempCanvas.height = 0;
      }
      PDFThumbnailView.tempImageCache = null;
    },

    /**
     * @private
     */
    _resetView: function PDFThumbnailViewer_resetView() {
      this.thumbnails = [];
      this._pagesRotation = 0;
      this._pagesRequests = [];
      //[Bruce]
      this._isUsingExternalImage = true;
    },

    setDocument: function PDFThumbnailViewer_setDocument(pdfDocument) {
      if(DEBUG_CHROME_DEV_TOOL) {
          console.time('PDFThumbnailViewer.setDocument()');
          console.timeStamp('PDFThumbnailViewer.setDocument()');
      }

      if (this.pdfDocument) {
        // cleanup of the elements and views
        var thumbsView = this.container;
        while (thumbsView.hasChildNodes()) {
          thumbsView.removeChild(thumbsView.lastChild);
        }
        this._resetView();
      }

      this.pdfDocument = pdfDocument;
      if (!pdfDocument) {
        return Promise.resolve();
      }

      //[Bruce]
      var firstPagePromise = pdfDocument.getPage(1);
      Promise.all([firstPagePromise,customEventsManager["onThumbnailExternalLinkReady"].promise]).then(function (resultOutPut) {
        if(DEBUG_CHROME_DEV_TOOL) {
            console.time('PDFThumbnailViewer.setDocument() firstPagePromise onThumbnailExternalLinkReady');
            console.timeStamp('PDFThumbnailViewer.setDocument() firstPagePromise onThumbnailExternalLinkReady');
        }
        var firstPage = resultOutPut[0];
        var pagesCount = pdfDocument.numPages;
        var viewport = firstPage.getViewport(1.0);

        // Only push the first two PageView's
        var pagesCountBefore = (pagesCount <= $viewThumbnailOwl.items)?pagesCount:$viewThumbnailOwl.items;
        var pagesCountAfter = pagesCount - pagesCountBefore;

        // Get before
        for (var pageNum = 1; pageNum <= pagesCountBefore; ++pageNum) {
          var thumbnail = new PDFThumbnailView({
            container: this.container,
            id: pageNum,
            defaultViewport: viewport.clone(),
            linkService: this.linkService,
            renderingQueue: this.renderingQueue,
            linkItems: resultOutPut[1],
          });
          this.thumbnails.push(thumbnail);
        }

        // Get after
        if(this.thumbnails.length < pagesCount) {
          customEventsManager['onFirstPageRendered'].doTask(function () {
            for (var pageNum = this.thumbnails.length + 1; pageNum <= pagesCount; ++pageNum) {
              var thumbnail = new PDFThumbnailView({
                container: this.container,
                id: pageNum,
                defaultViewport: viewport.clone(),
                linkService: this.linkService,
                renderingQueue: this.renderingQueue,
                linkItems: resultOutPut[1],
              });
              this.thumbnails.push(thumbnail);
            }
          }.bind(this));
        }

        $('#thumbnailView').on('click', '.owl-item', function(e) {
             //TODO: check ChapterLimit
            if (!canRead()){
    		window.alert("此書無法閱讀");
    		return false;
            } 
            PageAnimation.gotoPage({carouselIndex:($(this).index()),isIncomingTwoPageMode:false});
        });

        if(DEBUG_CHROME_DEV_TOOL) {
            console.timeEnd('PDFThumbnailViewer.setDocument() firstPagePromise onThumbnailExternalLinkReady');
        }
      }.bind(this));

      if(DEBUG_CHROME_DEV_TOOL) {
          console.timeEnd('PDFThumbnailViewer.setDocument()');
      }
      return firstPagePromise;
      /*
      return pdfDocument.getPage(1).then(function (firstPage) {
        var pagesCount = pdfDocument.numPages;
        var viewport = firstPage.getViewport(1.0);
        for (var pageNum = 1; pageNum <= pagesCount; ++pageNum) {
          var thumbnail = new PDFThumbnailView({
            container: this.container,
            id: pageNum,
            defaultViewport: viewport.clone(),
            linkService: this.linkService,
            renderingQueue: this.renderingQueue
          });
          this.thumbnails.push(thumbnail);
        }
      }.bind(this));
      */
      //End : [Bruce]
    },

    /**
     * @param {PDFPageView} pageView
     * @returns {PDFPage}
     * @private
     */
    _ensurePdfPageLoaded:
        function PDFThumbnailViewer_ensurePdfPageLoaded(thumbView) {
      if (thumbView.pdfPage) {
        return Promise.resolve(thumbView.pdfPage);
      }
      var pageNumber = thumbView.id;
      if (this._pagesRequests[pageNumber]) {
        return this._pagesRequests[pageNumber];
      }
      var promise = this.pdfDocument.getPage(pageNumber).then(
        function (pdfPage) {
          thumbView.setPdfPage(pdfPage);
          this._pagesRequests[pageNumber] = null;
          return pdfPage;
        }.bind(this));
      this._pagesRequests[pageNumber] = promise;
      return promise;
    },

    ensureThumbnailVisible:
        function PDFThumbnailViewer_ensureThumbnailVisible(page) {
      // Ensure that the thumbnail of the current page is visible
      // when switching from another view.
      scrollIntoView(document.getElementById('thumbnailContainer' + page));
    },

    forceRendering: function () {
      var visibleThumbs = this._getVisibleThumbs();
      var thumbView = this.renderingQueue.getHighestPriority(visibleThumbs,
                                                             this.thumbnails,
                                                             this.scroll.down);
      if (thumbView) {
        this._ensurePdfPageLoaded(thumbView).then(function () {
          this.renderingQueue.renderView(thumbView);
        }.bind(this));
        return true;
      }
      return false;
    }
  };

  return PDFThumbnailViewer;
})();


var TWO_PAGE_CONTAINER = 'twoPageContainer';

var TwoPageViewMode = {
  active: false,
  showCoverPage: true,    //[Phoebe]Add for new twoPageViewMode(Page: []1  23  45  67  89 ...)
  inProcess : false,
  numPages: 0,
  numTwoPageContainers: 0,
  containers: {},
  isPagePlacedOnRightSideInContainer: {},
  previousPageNumber: null,

  initialize: function twoPageViewModeInitialize(options) {
    this.container = options.container;
    this.viewer = this.container.firstElementChild;

    this.onePageView = options.onePageView;
    this.twoPageView = options.twoPageView;
  },

  _createTwoPageView: function twoPageViewMode_createTwoPageView() {
    this.inProcess = true;
    this.previousPageNumber = PDFViewerApplication.pdfViewer.currentPageNumber;

    this.numPages = PDFViewerApplication.pdfViewer.pagesCount;
    if ((this.numPages & 1) === 0) { // Even number of pages.
      this.numTwoPageContainers = (this.numPages / 2 +
                                    (this.showCoverPage ? 1: 0));
    } else { // Odd number of pages.
      this.numTwoPageContainers = Math.ceil(this.numPages / 2);
    }
    var uid, div;
    for (var i = 1; i <= this.numTwoPageContainers; i++) {
      uid = (2 * i - 1);
      div = this.containers[uid] = document.createElement('div');
      div.id = TWO_PAGE_CONTAINER + uid;
      if (PDFViewerApplication.pdfViewer.isInCarouselMode) {
		div.className = 'owl-item';
      } else {
        div.className = TWO_PAGE_CONTAINER;
	  }
	  this.div=div;
      if(PDFViewerApplication.pdfViewer.isInCarouselMode) {
        if(direct_reverse) {
            // NOTE: We must offset this.numTwoPageContainers because we will call remove.owl.carousel later from carousel-index-0 position
            $viewerOwl.trigger('add.owl.carousel',[this.div,0]);
        } else {
            $viewerOwl.trigger('add.owl.carousel',[this.div]);
        }
      } else {
        this.viewer.appendChild(div);
      }
    }
    var pageDiv, index;
    if(direct_reverse) {
	for (var i = this.numPages; i >= 1 ; i--) {
          pageDiv = PDFViewerApplication.pdfViewer.getPageView(i - 1).div;
          index = i + (this.containers[i] ? 0 : (this.showCoverPage ? 1: -1));
          pageDiv.style.display = "inline-block";
          //[Phoebe]Clone page1 to create fake page0.
          if (i == 1){
              var pageDivTmp = (PDFViewerApplication.pdfViewer.getPageView(0).div).cloneNode(true);
              pageDivTmp.id = 'pageContainer0';
              this.containers[index].appendChild(pageDivTmp);
              this.isPagePlacedOnRightSideInContainer[i] = false;
          }
          this.containers[index].appendChild(pageDiv);
          if ((i & 1) === 0) { // Even page number.
              this.isPagePlacedOnRightSideInContainer[i] = !this.showCoverPage;
          } else { // Odd page number.
              this.isPagePlacedOnRightSideInContainer[i] = (this.showCoverPage &&
                                                         i !== 1);
          }
          //[Phoebe]page 1 should be at right side.
          if (i ==1){
              this.isPagePlacedOnRightSideInContainer[i] = true; 
          }	  
        }
    } else {
        for (var i = 1; i <= this.numPages; i++) {
          pageDiv = PDFViewerApplication.pdfViewer.getPageView(i - 1).div;
          index = i + (this.containers[i] ? 0 : (this.showCoverPage ? 1: -1));
          pageDiv.style.display = "inline-block";
          //[Phoebe]Clone page1 to create fake page0.
          if (i == 1){
              var pageDivTmp = (PDFViewerApplication.pdfViewer.getPageView(0).div).cloneNode(true);
              pageDivTmp.id = 'pageContainer0';
              this.containers[index].appendChild(pageDivTmp);
              this.isPagePlacedOnRightSideInContainer[i] = false;
          }
          this.containers[index].appendChild(pageDiv);
          if ((i & 1) === 0) { // Even page number.
              this.isPagePlacedOnRightSideInContainer[i] = !this.showCoverPage;
          } else { // Odd page number.
              this.isPagePlacedOnRightSideInContainer[i] = (this.showCoverPage &&
                                                         i !== 1);
          }
          //[Phoebe]page 1 should be at right side.
          if (i ==1){
              this.isPagePlacedOnRightSideInContainer[i] = true; 
          }	  
        }
    }
    this.active = true;
    this.inProcess = false;
    if(PDFViewerApplication.pdfViewer.isInCarouselMode) {
        //[Phoebe]Add for new twoPageViewMode(Page: []1  23  45  67  89 ...)        
        if(direct_reverse) {
            for (var i = 1; i <= this.numPages; i++) {
                $viewerOwl.trigger('remove.owl.carousel',this.numTwoPageContainers);
            }
        } else {
            for (var i = 1; i <= this.numPages; i++) {
                $viewerOwl.trigger('remove.owl.carousel',0);
            }
        }
        // NOTE : This must be called after "this.active = true"
        PageAnimation.gotoPage({pageNum:PageAnimation.currentPageNum});
    }
  },

  _destroyTwoPageView: function twoPageViewMode_destroyTwoPageView() {
    this.inProcess = true;	  
    this.previousPageNumber = PDFViewerApplication.pdfViewer.currentPageNumber;

    var pageDiv;
    for (var i = 1, ii = this.numPages; i <= ii; i++) {
        pageDiv = PDFViewerApplication.pdfViewer.getPageView(i - 1).div;
        if(PDFViewerApplication.pdfViewer.isInCarouselMode) {
          if(direct_reverse) {
              $viewerOwl.trigger('add.owl.carousel',[pageDiv,0]);
          } else {
              $viewerOwl.trigger('add.owl.carousel',[pageDiv]);
          }
        } else {
			this.viewer.appendChild(pageDiv);
        }
    }
    //[Phoebe]PageContainer0 will be delete below.
    if(direct_reverse) {
        for (var uid in this.containers) {
            if(PDFViewerApplication.pdfViewer.isInCarouselMode) {
                $viewerOwl.trigger('remove.owl.carousel',this.numPages);
            } else {
                this.viewer.removeChild(this.containers[uid]);
            }
        }
    } else  {
        for (var uid in this.containers) {
            if(PDFViewerApplication.pdfViewer.isInCarouselMode) {
                $viewerOwl.trigger('remove.owl.carousel',0);
            } else {
                this.viewer.removeChild(this.containers[uid]);
            }
        }
    }

    this._resetParameters();
    this.inProcess = false;
    if(PDFViewerApplication.pdfViewer.isInCarouselMode) {
        // NOTE : This must be called after "this._resetParameters()"
        PageAnimation.gotoPage({pageNum:PageAnimation.currentPageNum});
    }
  },

  _resetParameters: function twoPageViewMode_resetParameters() {
    this.active = false;
    this.numPages = 0;
    this.numTwoPageContainers = 0;
    this.containers = {};
    this.isPagePlacedOnRightSideInContainer = {};
  },

  _updateViewarea: function twoPageViewMode_updateViewarea(noResize) {
    if (PDFViewerApplication.pdfViewer.currentScaleValue) {
      if (!noResize) {
        PDFViewerApplication.pdfViewer._setScale(PDFViewerApplication.pdfViewer.currentScaleValue, true);
      }
      PDFViewerApplication.pdfViewer.currentPageNumber = this.previousPageNumber;
      PDFViewerApplication.pdfRenderingQueue.renderHighestPriority();
    }
    this.previousPageNumber = null;
  },

  disable: function twoPageViewModeDisable() {
    if (!this.active) {
      return;
    }
    //this.twoPageView.classList.remove('toggled');
    //this.onePageView.classList.add('toggled');

    if (this.viewer.hasChildNodes()) {
      this._destroyTwoPageView();
      this._updateViewarea();
    } else {
      this._resetParameters();
    }
  },

  enable: function twoPageViewModeEnable() {
    //if (this.active || !this.viewer.hasChildNodes()) {
    //  return;
    //}
    //this.onePageView.classList.remove('toggled');
    //this.twoPageView.classList.add('toggled');

    this._createTwoPageView();
    this._updateViewarea();
  },

  scrollIntoViewPageNumber: function twoPageViewScrollIntoViewPageNumber(id) {
    var dest;

    if (PDFViewerApplication.pdfViewer.isHorizontalScrollbarEnabled) {
      dest = [null, { name: 'XYZ' }, 0, null, null];
      //[Phoebe]Add for new twoPageViewMode(Page: []1  23  45  67  89 ...)	  
      if ((id === 1 && this.showCoverPage) || (id === this.numPages &&
                                                !this.isPagePlacedOnRightSideInContainer[id])) {
          var newPage = PDFViewerApplication.pdfViewer.getPageView(id - 1)
          if ((newPage.width | 0) < (this.container.clientWidth - SCROLLBAR_PADDING)) {
              dest[2] = -(newPage.el.offsetLeft + newPage.el.clientLeft);
          }
      }
    }
    PDFViewerApplication.pdfViewer.getPageView(id - 1).scrollIntoView(dest);
  },

  previousPage: function twoPageViewModePreviousPage() {
    var newPageNumber = PDFViewerApplication.pdfViewer.currentPageNumber - 1, firstPage = 1;

    if (!PDFViewerApplication.pdfViewer.isHorizontalScrollbarEnabled) {
      newPageNumber--;
      if (this.isPagePlacedOnRightSideInContainer[newPageNumber]) {
        newPageNumber--;
      }
    }
    PDFViewerApplication.pdfViewer.currentPageNumber = (newPageNumber < firstPage) ? firstPage : newPageNumber;
  },

  nextPage: function twoPageViewModeNextPage() {
    var newPageNumber = PDFViewerApplication.pdfViewer.currentPageNumber + 1, lastPage = this.getLastPageNumber();

    if (!PDFViewerApplication.pdfViewer.isHorizontalScrollbarEnabled) {
      if (this.isPagePlacedOnRightSideInContainer[newPageNumber]) {
        newPageNumber++;
      }
    }
    PDFViewerApplication.pdfViewer.currentPageNumber = (newPageNumber > lastPage) ? lastPage : newPageNumber;
  },

  getLastPageNumber: function twoPageViewGetLastPageNumber() {
    var lastPage = this.numPages;

    if (!PDFViewerApplication.pdfViewer.isHorizontalScrollbarEnabled &&
        this.isPagePlacedOnRightSideInContainer[lastPage]) {
      lastPage--;
    }
    return lastPage;
  },

  /**
   * Enables the user to set the state of Two Page View Mode through
   * the hash parameter '#twoPageView=value'.
   *
   * @param {Integer} value The current state of Two Page View Mode:
   *  - 0 - One Page View.
   *  - 1 - Two Page View.
   */
  set hashParams(value) {
    value |= 0;

    if (value === 1) {
      this.enable();
    } else {
      this.disable();
    }
  },

  /**
   * Returns the hash parameter corresponding to the current state
   * of Two Page View Mode.
   *
   * @return {Integer} (See above for explanation of the return values.)
   */
  get hashParams() {
      //[Phoebe]Add for new twoPageViewMode(Page: []1  23  45  67  89 ...)
      return ((this.active | 0) + (this.active && (this.showCoverPage | 0)));
  }
};


/**
 * @typedef {Object} PDFOutlineViewOptions
 * @property {HTMLDivElement} container - The viewer element.
 * @property {Array} outline - An array of outline objects.
 * @property {IPDFLinkService} linkService - The navigation/linking service.
 */

/**
 * @class
 */
var PDFOutlineView = (function PDFOutlineViewClosure() {
  /**
   * @constructs PDFOutlineView
   * @param {PDFOutlineViewOptions} options
   */
  function PDFOutlineView(options) {
    this.container = options.container;
    this.outline = options.outline;
    this.linkService = options.linkService;
    this.lastToggleIsShow = true;
  }

  PDFOutlineView.prototype = {
    reset: function PDFOutlineView_reset() {
      var container = this.container;
      while (container.firstChild) {
        container.removeChild(container.firstChild);
      }
      this.lastToggleIsShow = true;
    },

    /**
     * @private
     */
    _dispatchEvent: function PDFOutlineView_dispatchEvent(outlineCount) {
      var event = document.createEvent('CustomEvent');
      event.initCustomEvent('outlineloaded', true, true, {
        outlineCount: outlineCount
      });
      this.container.dispatchEvent(event);
    },

    /**
     * @private
     */
    _bindLink: function PDFOutlineView_bindLink(element, item) {
      var linkService = this.linkService;
      element.href = linkService.getDestinationHash(item.dest);
      element.onclick = function goToDestination(e) {
        linkService.navigateTo(item.dest);
        return false;
      };
    },

    /**
     * Prepend a button before an outline item which allows the user to toggle
     * the visibility of all outline items at that level.
     *
     * @private
     */
    _addToggleButton: function PDFOutlineView_addToggleButton(div) {
      var toggler = document.createElement('div');
      toggler.className = 'outlineItemToggler';
      toggler.onclick = function(event) {
        event.stopPropagation();
        toggler.classList.toggle('outlineItemsHidden');

        if (event.shiftKey) {
          var shouldShowAll = !toggler.classList.contains('outlineItemsHidden');
          this._toggleOutlineItem(div, shouldShowAll);
        }
      }.bind(this);
      div.insertBefore(toggler, div.firstChild);
    },

    /**
     * Toggle the visibility of the subtree of an outline item.
     *
     * @param {Element} root - the root of the outline (sub)tree.
     * @param {boolean} state - whether to show the outline (sub)tree. If false,
     *   the outline subtree rooted at |root| will be collapsed.
     *
     * @private
     */
    _toggleOutlineItem: function PDFOutlineView_toggleOutlineItem(root, show) {
      this.lastToggleIsShow = show;
      var togglers = root.querySelectorAll('.outlineItemToggler');
      for (var i = 0, ii = togglers.length; i < ii; ++i) {
        togglers[i].classList[show ? 'remove' : 'add']('outlineItemsHidden');
      }
    },

    /**
     * Collapse or expand all subtrees of the outline.
     */
    toggleOutlineTree: function PDFOutlineView_toggleOutlineTree() {
      this._toggleOutlineItem(this.container, !this.lastToggleIsShow);
    },

    render: function PDFOutlineView_render() {
      var outline = this.outline;
      var outlineCount = 0;

      this.reset();

      if (!outline) {
        this._dispatchEvent(outlineCount);
        return;
      }

      var fragment = document.createDocumentFragment();
      var queue = [{ parent: fragment, items: this.outline }];
      var hasAnyNesting = false;
      while (queue.length > 0) {
        var levelData = queue.shift();
        for (var i = 0, len = levelData.items.length; i < len; i++) {
          var item = levelData.items[i];
          var div = document.createElement('div');
          div.className = 'outlineItem';
          var element = document.createElement('a');
          this._bindLink(element, item);
          element.textContent = removeNullCharacters(item.title);
          div.appendChild(element);

          if (item.items.length > 0) {
            hasAnyNesting = true;
            this._addToggleButton(div);

            var itemsDiv = document.createElement('div');
            itemsDiv.className = 'outlineItems';
            div.appendChild(itemsDiv);
            queue.push({ parent: itemsDiv, items: item.items });
          }

          levelData.parent.appendChild(div);
          outlineCount++;
        }
      }
      if (hasAnyNesting) {
        this.container.classList.add('outlineWithDeepNesting');
      }

      this.container.appendChild(fragment);

      this._dispatchEvent(outlineCount);
    }
  };

  return PDFOutlineView;
})();


/**
 * @typedef {Object} PDFAttachmentViewOptions
 * @property {HTMLDivElement} container - The viewer element.
 * @property {Array} attachments - An array of attachment objects.
 * @property {DownloadManager} downloadManager - The download manager.
 */

/**
 * @class
 */
var PDFAttachmentView = (function PDFAttachmentViewClosure() {
  /**
   * @constructs PDFAttachmentView
   * @param {PDFAttachmentViewOptions} options
   */
  function PDFAttachmentView(options) {
    this.container = options.container;
    this.attachments = options.attachments;
    this.downloadManager = options.downloadManager;
  }

  PDFAttachmentView.prototype = {
    reset: function PDFAttachmentView_reset() {
      var container = this.container;
      while (container.firstChild) {
        container.removeChild(container.firstChild);
      }
    },

    /**
     * @private
     */
    _dispatchEvent: function PDFAttachmentView_dispatchEvent(attachmentsCount) {
      var event = document.createEvent('CustomEvent');
      event.initCustomEvent('attachmentsloaded', true, true, {
        attachmentsCount: attachmentsCount
      });
      this.container.dispatchEvent(event);
    },

    /**
     * @private
     */
    _bindLink: function PDFAttachmentView_bindLink(button, content, filename) {
      button.onclick = function downloadFile(e) {
        this.downloadManager.downloadData(content, filename, '');
        return false;
      }.bind(this);
    },

    render: function PDFAttachmentView_render() {
      var attachments = this.attachments;
      var attachmentsCount = 0;

      this.reset();

      if (!attachments) {
        this._dispatchEvent(attachmentsCount);
        return;
      }

      var names = Object.keys(attachments).sort(function(a, b) {
        return a.toLowerCase().localeCompare(b.toLowerCase());
      });
      attachmentsCount = names.length;

      for (var i = 0; i < attachmentsCount; i++) {
        var item = attachments[names[i]];
        var filename = getFileName(item.filename);
        var div = document.createElement('div');
        div.className = 'attachmentsItem';
        var button = document.createElement('button');
        this._bindLink(button, item.content, filename);
        button.textContent = removeNullCharacters(filename);
        div.appendChild(button);
        this.container.appendChild(div);
      }

      this._dispatchEvent(attachmentsCount);
    }
  };

  return PDFAttachmentView;
})();


var PDFViewerApplication = {
  initialBookmark: document.location.hash.substring(1),
  initialDestination: null,
  initialized: false,
  fellback: false,
  pdfDocument: null,
  pdfLoadingTask: null,
  sidebarOpen: false,
  printing: false,
  /** @type {PDFViewer} */
  pdfViewer: null,
  /** @type {PDFThumbnailViewer} */
  pdfThumbnailViewer: null,
  /** @type {PDFRenderingQueue} */
  pdfRenderingQueue: null,
  /** @type {PDFPresentationMode} */
  pdfPresentationMode: null,
  /** @type {PDFDocumentProperties} */
  pdfDocumentProperties: null,
  /** @type {PDFLinkService} */
  pdfLinkService: null,
  /** @type {PDFHistory} */
  pdfHistory: null,
  pageRotation: 0,
  isInitialViewSet: false,
  animationStartedPromise: null,
  preferenceSidebarViewOnLoad: SidebarView.NONE,
  preferencePdfBugEnabled: false,
  preferenceShowPreviousViewOnLoad: true,
  preferenceDefaultZoomValue: '',
  preferencetwoPageViewModeOnLoad: -1,
  isViewerEmbedded: (window.parent !== window),
  url: '',
  historyPage: null, //Henry add

  // called once when the document is loaded
  initialize: function pdfViewInitialize() {
    if(DEBUG_CHROME_DEV_TOOL) {
        console.time('PDFViewerApplication.initialize()');
        console.timeStamp('PDFViewerApplication.initialize()');
    }

    var pdfRenderingQueue = new PDFRenderingQueue();
    pdfRenderingQueue.onIdle = this.cleanup.bind(this);
    this.pdfRenderingQueue = pdfRenderingQueue;

    var pdfLinkService = new PDFLinkService();
    this.pdfLinkService = pdfLinkService;

    var container = document.getElementById('viewerContainer');
    var viewer = document.getElementById('viewer');
    this.pdfViewer = new PDFViewer({
      container: container,
      viewer: viewer,
      renderingQueue: pdfRenderingQueue,
      linkService: pdfLinkService
    });
    pdfRenderingQueue.setViewer(this.pdfViewer);
    pdfLinkService.setViewer(this.pdfViewer);


    var thumbnailContainer = document.getElementById('thumbnailView');
    this.pdfThumbnailViewer = new PDFThumbnailViewer({
      container: thumbnailContainer,
      renderingQueue: pdfRenderingQueue,
      linkService: pdfLinkService
    });
    pdfRenderingQueue.setThumbnailViewer(this.pdfThumbnailViewer);

    //[Bruce][TempDisable]
    /*
    Preferences.initialize();
    */
    //End : [Bruce][TempDisable]

    this.pdfHistory = new PDFHistory({
      linkService: pdfLinkService
    });
    pdfLinkService.setHistory(this.pdfHistory);
    /*
    SecondaryToolbar.initialize({
      twoPageViewMode: TwoPageViewMode,
      onePageView: document.getElementById('onePageView'),
      twoPageView: document.getElementById('twoPageView'),
    });
    */

    TwoPageViewMode.initialize({
      container: container,
      onePageView: document.getElementById('onePageView'),
      twoPageView: document.getElementById('twoPageView')
    });

    var initializedPromise = new Promise(function (resolve) {
        PDFJS.disableWebGL = !DEFAULT_PREFERENCES.enableWebGL;
        PDFJS.disableTextLayer = DEFAULT_PREFERENCES.disableTextLayer;
        PDFJS.disableRange = DEFAULT_PREFERENCES.disableRange;
        PDFJS.disableAutoFetch = DEFAULT_PREFERENCES.disableAutoFetch;
        PDFJS.disableFontFace = DEFAULT_PREFERENCES.disableFontFace;
        PDFJS.useOnlyCssZoom = DEFAULT_PREFERENCES.useOnlyCssZoom;
        PDFJS.twoPageViewModeOnLoad = DEFAULT_PREFERENCES.twoPageViewModeOnLoad;
        resolve();
    });

    //[Bruce]
    console.log("(onAppInitialized)")
    customEventsManager["onAppInitialized"].confirmThisIsReady();

    if(DEBUG_CHROME_DEV_TOOL) {
        console.timeEnd('PDFViewerApplication.initialize()');
    }

    return initializedPromise.then(function () {
      PDFViewerApplication.initialized = true;
    });
  },

  zoomIn: function pdfViewZoomIn(ticks) {
    var newScale = this.pdfViewer.currentScale;
    do {
      newScale = (newScale * DEFAULT_SCALE_DELTA).toFixed(2);
      newScale = Math.ceil(newScale * 10) / 10;
      newScale = Math.min(MAX_SCALE, newScale);
    } while (--ticks > 0 && newScale < MAX_SCALE);
    this.setScale(newScale, true);
  },

  zoomOut: function pdfViewZoomOut(ticks) {
    var newScale = this.pdfViewer.currentScale;
    do {
      newScale = (newScale / DEFAULT_SCALE_DELTA).toFixed(2);
      newScale = Math.floor(newScale * 10) / 10;
      //[Bruce]
      //newScale = Math.max(MIN_SCALE, newScale);
      newScale = Math.max(originalScale, newScale);
    } while (--ticks > 0 && newScale > MIN_SCALE);
    this.setScale(newScale, true);
  },

  previousPage: function pdfViewNextPage() {
    if (TwoPageViewMode.active) {
      TwoPageViewMode.previousPage();
    } else {
      this.page--;
    }
  },

  nextPage: function pdfViewNextPage() {
    if (TwoPageViewMode.active) {
      TwoPageViewMode.nextPage();
    } else {
      this.page++;
    }
  },
  //Henry add, for support undo
  undoPage: function pdfUndoPage(current_page) {
      PageAnimation.gotoPage({pageNum:this.historyPage});
      this.historyPage= current_page;
  },

  get lastPageNumber() {
    return (TwoPageViewMode.active ?
            TwoPageViewMode.getLastPageNumber() : this.pdfViewer.pagesCount);
  },


  get pagesCount() {
    return this.pdfDocument.numPages;
  },

  set page(val) {
    this.pdfLinkService.page = val;
  },

  get page() { // TODO remove
    return this.pdfLinkService.page;
  },

  get supportsPrinting() {
    var canvas = document.createElement('canvas');
    var value = 'mozPrintCallback' in canvas;

    return PDFJS.shadow(this, 'supportsPrinting', value);
  },

  get supportsFullscreen() {
    var doc = document.documentElement;
    var support = !!(doc.requestFullscreen || doc.mozRequestFullScreen ||
                     doc.webkitRequestFullScreen || doc.msRequestFullscreen);

    if (document.fullscreenEnabled === false ||
        document.mozFullScreenEnabled === false ||
        document.webkitFullscreenEnabled === false ||
        document.msFullscreenEnabled === false) {
      support = false;
   }
    if (support && PDFJS.disableFullscreen === true) {
      support = false;
    }

    return PDFJS.shadow(this, 'supportsFullscreen', support);
  },

  get supportsIntegratedFind() {
    var support = false;

    return PDFJS.shadow(this, 'supportsIntegratedFind', support);
  },

  get supportsDocumentFonts() {
    var support = true;

    return PDFJS.shadow(this, 'supportsDocumentFonts', support);
  },

  get supportsDocumentColors() {
    var support = true;

    return PDFJS.shadow(this, 'supportsDocumentColors', support);
  },

  get loadingBar() {
    //var bar = new ProgressBar('#loadingBar', {}); //Henry remove
    //return PDFJS.shadow(this, 'loadingBar', bar);
  },

  get supportedMouseWheelZoomModifierKeys() {
    var support = {
      ctrlKey: true,
      metaKey: true,
    };

    return PDFJS.shadow(this, 'supportedMouseWheelZoomModifierKeys', support);
  },


  setTitleUsingUrl: function pdfViewSetTitleUsingUrl(url) {
    this.url = url;
    try {
      this.setTitle(decodeURIComponent(getFileName(url)) || url);
    } catch (e) {
      // decodeURIComponent may throw URIError,
      // fall back to using the unprocessed url in that case
      this.setTitle(url);
    }
  },

  setTitle: function pdfViewSetTitle(title) {
    if (this.isViewerEmbedded) {
      // Embedded PDF viewers should not be changing their parent page's title.
      return;
    }
    document.title = title;
  },

  close: function pdfViewClose() {
    //[Bruce]
    /*
    var errorWrapper = document.getElementById('errorWrapper');
    errorWrapper.setAttribute('hidden', 'true');
    */
    //End : [Bruce]

    if (!this.pdfDocument) {
      return;
    }

    this.pdfDocument.destroy();
    this.pdfDocument = null;

    this.pdfThumbnailViewer.setDocument(null);
    this.pdfViewer.setDocument(null);
    this.pdfLinkService.setDocument(null, null);

    if (typeof PDFBug !== 'undefined') {
      PDFBug.cleanup();
    }
  },

  // TODO(mack): This function signature should really be pdfViewOpen(url, args)
  open: function pdfViewOpen(file, scale, password,
                             //[Bruce]
                             //pdfDataRangeTransport, args) {
                             pdfDataRangeTransport, args , legacy) {
    //[Bruce]
    /*
    if (this.pdfDocument) {
      // Reload the preferences if a document was previously opened.
      Preferences.reload();
    }
    */
    //End : [Bruce]
    this.close();

    var parameters = Object.create(null);
    if (typeof file === 'string') { // URL
      this.setTitleUsingUrl(file);
      parameters.url = file;
    } else if (file && 'byteLength' in file) { // ArrayBuffer
      parameters.data = file;
    } else if (file.url && file.originalUrl) {
      this.setTitleUsingUrl(file.originalUrl);
      parameters.url = file.url;
    }
    if (args) {
      for (var prop in args) {
        parameters[prop] = args[prop];
      }
    }

    var self = this;
    self.downloadComplete = false;

    //[Bruce]
    /*
    var passwordNeeded = function passwordNeeded(updatePassword, reason) {
      PasswordPrompt.updatePassword = updatePassword;
      PasswordPrompt.reason = reason;
      PasswordPrompt.open();
    };

    function getDocumentProgress(progressData) {
      self.progress(progressData.loaded / progressData.total);
    }
    */
    //End : [Bruce]

    //[Bruce]
    /*
    PDFJS.getDocument(parameters, pdfDataRangeTransport, passwordNeeded,
                      getDocumentProgress).then(
    */
    PDFJS.getDocument(parameters, pdfDataRangeTransport, null,
                      null , legacy).then(
    //End : [Bruce]
      function getDocumentCallback(pdfDocument) {
        //[Bruce]
        customEventsManager['onDocumentReady'].confirmThisIsReady(pdfDocument);
        self.load(pdfDocument, scale);
      },
      function getDocumentError(exception) {
        var message = exception && exception.message;
        var loadingErrorMessage = mozL10n.get('loading_error', null,
          'An error occurred while loading the PDF.');

        if (exception instanceof PDFJS.InvalidPDFException) {
          // change error message also for other builds
          loadingErrorMessage = mozL10n.get('invalid_file_error', null,
                                            'Invalid or corrupted PDF file.');
        } else if (exception instanceof PDFJS.MissingPDFException) {
          // special message for missing PDF's
          loadingErrorMessage = mozL10n.get('missing_file_error', null,
                                            'Missing PDF file.');
        } else if (exception instanceof PDFJS.UnexpectedResponseException) {
          loadingErrorMessage = mozL10n.get('unexpected_response_error', null,
                                            'Unexpected server response.');
        }

        var moreInfo = {
          message: message
        };
        self.error(loadingErrorMessage, moreInfo);

        throw new Error(loadingErrorMessage);
      }
    );

    //[Bruce]
    /*
    if (args && args.length) {
      PDFViewerApplication.pdfDocumentProperties.setFileSize(args.length);
    }
    */
    //End : [Bruce]
  },

  download: function pdfViewDownload() {
    function downloadByUrl() {
      downloadManager.downloadUrl(url, filename);
    }

    var url = this.url.split('#')[0];
    var filename = getPDFFileNameFromURL(url);
    var downloadManager = new DownloadManager();
    downloadManager.onerror = function (err) {
      // This error won't really be helpful because it's likely the
      // fallback won't work either (or is already open).
      PDFViewerApplication.error('PDF failed to download.');
    };

    if (!this.pdfDocument) { // the PDF is not ready yet
      downloadByUrl();
      return;
    }

    if (!this.downloadComplete) { // the PDF is still downloading
      downloadByUrl();
      return;
    }

    this.pdfDocument.getData().then(
      function getDataSuccess(data) {
        var blob = PDFJS.createBlob(data, 'application/pdf');
        downloadManager.download(blob, url, filename);
      },
      downloadByUrl // Error occurred try downloading with just the url.
    ).then(null, downloadByUrl);
  },

  fallback: function pdfViewFallback(featureId) {
  },

  /**
   * Show the error box.
   * @param {String} message A message that is human readable.
   * @param {Object} moreInfo (optional) Further information about the error
   *                            that is more technical.  Should have a 'message'
   *                            and optionally a 'stack' property.
   */
  error: function pdfViewError(message, moreInfo) {
    var moreInfoText = mozL10n.get('error_version_info',
      {version: PDFJS.version || '?', build: PDFJS.build || '?'},
      'PDF.js v{{version}} (build: {{build}})') + '\n';
    if (moreInfo) {
      moreInfoText +=
        mozL10n.get('error_message', {message: moreInfo.message},
        'Message: {{message}}');
      if (moreInfo.stack) {
        moreInfoText += '\n' +
          mozL10n.get('error_stack', {stack: moreInfo.stack},
          'Stack: {{stack}}');
      } else {
        if (moreInfo.filename) {
          moreInfoText += '\n' +
            mozL10n.get('error_file', {file: moreInfo.filename},
            'File: {{file}}');
        }
        if (moreInfo.lineNumber) {
          moreInfoText += '\n' +
            mozL10n.get('error_line', {line: moreInfo.lineNumber},
            'Line: {{line}}');
        }
      }
    }

    var errorWrapper = document.getElementById('errorWrapper');
    errorWrapper.removeAttribute('hidden');

    var errorMessage = document.getElementById('errorMessage');
    errorMessage.textContent = message;

    var closeButton = document.getElementById('errorClose');
    closeButton.onclick = function() {
      errorWrapper.setAttribute('hidden', 'true');
    };

    var errorMoreInfo = document.getElementById('errorMoreInfo');
    var moreInfoButton = document.getElementById('errorShowMore');
    var lessInfoButton = document.getElementById('errorShowLess');
    moreInfoButton.onclick = function() {
      errorMoreInfo.removeAttribute('hidden');
      moreInfoButton.setAttribute('hidden', 'true');
      lessInfoButton.removeAttribute('hidden');
      errorMoreInfo.style.height = errorMoreInfo.scrollHeight + 'px';
    };
    lessInfoButton.onclick = function() {
      errorMoreInfo.setAttribute('hidden', 'true');
      moreInfoButton.removeAttribute('hidden');
      lessInfoButton.setAttribute('hidden', 'true');
    };
    moreInfoButton.oncontextmenu = noContextMenuHandler;
    lessInfoButton.oncontextmenu = noContextMenuHandler;
    closeButton.oncontextmenu = noContextMenuHandler;
    moreInfoButton.removeAttribute('hidden');
    lessInfoButton.setAttribute('hidden', 'true');
    errorMoreInfo.value = moreInfoText;
  },

  progress: function pdfViewProgress(level) {
    // var percent = Math.round(level * 100);
    // When we transition from full request to range requests, it's possible
    // that we discard some of the loaded data. This can cause the loading
    // bar to move backwards. So prevent this by only updating the bar if it
    // increases.
    //if (percent > this.loadingBar.percent || isNaN(percent)) {  //Henry remove
    //  this.loadingBar.percent = percent;

      // When disableAutoFetch is enabled, it's not uncommon for the entire file
      // to never be fetched (depends on e.g. the file structure). In this case
      // the loading bar will not be completely filled, nor will it be hidden.
      // To prevent displaying a partially filled loading bar permanently, we
      // hide it when no data has been loaded during a certain amount of time.
      /*  Henry remove
      if (PDFJS.disableAutoFetch && percent) {
        if (this.disableAutoFetchLoadingBarTimeout) {
          clearTimeout(this.disableAutoFetchLoadingBarTimeout);
          this.disableAutoFetchLoadingBarTimeout = null;
        }
        //this.loadingBar.show();

        this.disableAutoFetchLoadingBarTimeout = setTimeout(function () {
          //this.loadingBar.hide();
          this.disableAutoFetchLoadingBarTimeout = null;
        }.bind(this), DISABLE_AUTO_FETCH_LOADING_BAR_TIMEOUT);
      }
    }*/
  },

  load: function pdfViewLoad(pdfDocument, scale) {
    if(DEBUG_CHROME_DEV_TOOL) {
        console.time('PDFViewerApplication.load()');
        console.timeStamp('PDFViewerApplication.load()');
    }
    var self = this;
    scale = scale || UNKNOWN_SCALE;

    //[Bruce]
    /*
    this.findController.reset();
    */
    //End : [Bruce]

    this.pdfDocument = pdfDocument;

    //[Bruce]
    /*
    this.pdfDocumentProperties.setDocumentAndUrl(pdfDocument, this.url);
    */
    //End : [Bruce]

    var downloadedPromise = pdfDocument.getDownloadInfo().then(function() {
      self.downloadComplete = true;
      //self.loadingBar.hide();
    });

    //[Bruce][TempDisable]
    /*
    var pagesCount = pdfDocument.numPages;
    document.getElementById('numPages').textContent =
      mozL10n.get('page_of', {pageCount: pagesCount}, 'of {{pageCount}}');
    document.getElementById('pageNumber').max = pagesCount;
    */
    //End : [Bruce][TempDisable]

    var id = this.documentFingerprint = pdfDocument.fingerprint;
    var store = this.store = new ViewHistory(id);

    var baseDocumentUrl = null;
    this.pdfLinkService.setDocument(pdfDocument, baseDocumentUrl);

    var pdfViewer = this.pdfViewer;
    pdfViewer.currentScale = scale;
    pdfViewer.setDocument(pdfDocument);
    var firstPagePromise = pdfViewer.firstPagePromise;
    var pagesPromise = pdfViewer.pagesPromise;
    var onePageRendered = pdfViewer.onePageRendered;

    this.pageRotation = 0;
    this.isInitialViewSet = false;

    this.pdfThumbnailViewer.setDocument(pdfDocument);

    //[Bruce]
    //firstPagePromise.then(function(pdfPage) {
    Promise.all([firstPagePromise, customEventsManager['onOwlLayoutReady'].promise]).then(function(pdfPage) {
      if(DEBUG_CHROME_DEV_TOOL) {
          console.time('PDFViewerApplication.load() firstPagePromise onOwlLayoutReady');
          console.timeStamp('PDFViewerApplication.load() firstPagePromise onOwlLayoutReady');
      }

      downloadedPromise.then(function () {
        var event = document.createEvent('CustomEvent');
        event.initCustomEvent('documentload', true, true, {});
        window.dispatchEvent(event);
      });

      //[Bruce][TempDisable]
      /*
      self.loadingBar.setWidth(document.getElementById('viewer'));
      */
      //End : [Bruce][TempDisable]

      if (!PDFJS.disableHistory && !self.isViewerEmbedded) {
        // The browsing history is only enabled when the viewer is standalone,
        // i.e. not when it is embedded in a web page.
        if (!self.preferenceShowPreviousViewOnLoad) {
          self.pdfHistory.clearHistoryState();
        }
        self.pdfHistory.initialize(self.documentFingerprint);

        if (self.pdfHistory.initialDestination) {
          self.initialDestination = self.pdfHistory.initialDestination;
        } else if (self.pdfHistory.initialBookmark) {
          self.initialBookmark = self.pdfHistory.initialBookmark;
        }
      }

      //[Bruce]
      /*
      var initialParams = {
        destination: self.initialDestination,
        bookmark: self.initialBookmark,
        hash: null,
      };

      store.initializedPromise.then(function resolved() {
        var storedHash = null;
        if (self.preferenceShowPreviousViewOnLoad &&
            store.get('exists', false)) {
          var pageNum = store.get('page', '1');
          var zoom = self.preferenceDefaultZoomValue ||
                     store.get('zoom', DEFAULT_SCALE_VALUE);
          var left = store.get('scrollLeft', '0');
          var top = store.get('scrollTop', '0');

          storedHash = 'page=' + pageNum + '&zoom=' + zoom + ',' +
                       left + ',' + top;
        } else if (self.preferenceDefaultZoomValue) {
                  storedHash = 'page=1&zoom=' + self.preferenceDefaultZoomValue;
                }
        self.setInitialView(storedHash, scale);

        initialParams.hash = storedHash;

        // Make all navigation keys work on document load,
        // unless the viewer is embedded in a web page.
        if (!self.isViewerEmbedded) {
          self.pdfViewer.focus();
        }
      }, function rejected(reason) {
        console.error(reason);
        self.setInitialView(null, scale);
      });
      */
      self.setInitialView(null, scale);
      if (!self.isViewerEmbedded) {
        self.pdfViewer.focus();
      }
      //End : [Bruce]
      if(DEBUG_CHROME_DEV_TOOL) {
          console.timeEnd('PDFViewerApplication.load() firstPagePromise onOwlLayoutReady');
      }
    });

    pagesPromise.then(function() {
      if (self.supportsPrinting) {
        pdfDocument.getJavaScript().then(function(javaScript) {
          if (javaScript.length) {
            console.warn('Warning: JavaScript is not supported');
            self.fallback(PDFJS.UNSUPPORTED_FEATURES.javaScript);
          }
          // Hack to support auto printing.
          var regex = /\bprint\s*\(/;
          for (var i = 0, ii = javaScript.length; i < ii; i++) {
            var js = javaScript[i];
            if (js && regex.test(js)) {
              setTimeout(function() {
                window.print();
              });
              return;
            }
          }
        });
      }
    });

    // outline depends on pagesRefMap
    var promises = [pagesPromise, this.animationStartedPromise];
    Promise.all(promises).then(function() {
      if(DEBUG_CHROME_DEV_TOOL) {
          console.time('PDFViewerApplication.load() pagesPromise, this.animationStartedPromise');
          console.timeStamp('PDFViewerApplication.load() pagesPromise, this.animationStartedPromise');
      }
      pdfDocument.getOutline().then(function(outline) {
        //[Bruce]
        customEventsManager['onOutlineReady'].confirmThisIsReady(outline);
        /*
        var container = document.getElementById('outlineView');
        self.outline = new PDFOutlineView({
          container: container,
          outline: outline,
          linkService: self.pdfLinkService
        });
        self.outline.render();
        document.getElementById('viewOutline').disabled = !outline;

        if (!outline && !container.classList.contains('hidden')) {
          self.switchSidebarView('thumbs');
        }
        if (outline &&
            self.preferenceSidebarViewOnLoad === SidebarView.OUTLINE) {
          self.switchSidebarView('outline', true);
        }
        */
        //End : [Bruce]
      });
      pdfDocument.getAttachments().then(function(attachments) {
        //[Bruce]
        /*
        var container = document.getElementById('attachmentsView');
        self.attachments = new PDFAttachmentView({
          container: container,
          attachments: attachments,
          downloadManager: new DownloadManager()
        });
        self.attachments.render();
        document.getElementById('viewAttachments').disabled = !attachments;

        if (!attachments && !container.classList.contains('hidden')) {
          self.switchSidebarView('thumbs');
        }
        if (attachments &&
            self.preferenceSidebarViewOnLoad === SidebarView.ATTACHMENTS) {
          self.switchSidebarView('attachments', true);
        }
        */
        //End : [Bruce]
      });
      if(DEBUG_CHROME_DEV_TOOL) {
          console.timeEnd('PDFViewerApplication.load() pagesPromise, this.animationStartedPromise');
      }
    });

    if (self.preferenceSidebarViewOnLoad === SidebarView.THUMBS) {
      Promise.all([firstPagePromise, onePageRendered]).then(function () {
        self.switchSidebarView('thumbs', true);
      });
    }

    pdfDocument.getMetadata().then(function(data) {
      if(DEBUG_CHROME_DEV_TOOL) {
          console.time('PDFViewerApplication.load() pdfDocument.getMetadata()');
          console.timeStamp('PDFViewerApplication.load() pdfDocument.getMetadata()');
      }

      var info = data.info, metadata = data.metadata;
      self.documentInfo = info;
      self.metadata = metadata;

      //[Bruce]
      customEventsManager["onMetadataReady"].confirmThisIsReady(data);

      // Provides some basic debug information
      console.log('PDF ' + pdfDocument.fingerprint + ' [' +
                  info.PDFFormatVersion + ' ' + (info.Producer || '-').trim() +
                  ' / ' + (info.Creator || '-').trim() + ']' +
                  ' (PDF.js: ' + (PDFJS.version || '-') +
                  (!PDFJS.disableWebGL ? ' [WebGL]' : '') + ')');

      var pdfTitle;
      if (metadata && metadata.has('dc:title')) {
        var title = metadata.get('dc:title');
        // Ghostscript sometimes return 'Untitled', sets the title to 'Untitled'
        if (title !== 'Untitled') {
          pdfTitle = title;
        }
      }

      if (!pdfTitle && info && info['Title']) {
        pdfTitle = info['Title'];
      }

      if (pdfTitle) {
        self.setTitle(pdfTitle + ' - ' + document.title);
      }

      if (info.IsAcroFormPresent) {
        console.warn('Warning: AcroForm/XFA is not supported');
        self.fallback(PDFJS.UNSUPPORTED_FEATURES.forms);
      }

      if(DEBUG_CHROME_DEV_TOOL) {
          console.timeEnd('PDFViewerApplication.load() pdfDocument.getMetadata()');
      }
    });

    if(DEBUG_CHROME_DEV_TOOL) {
        console.timeEnd('PDFViewerApplication.load()');
    }
  },

  setInitialView: function pdfViewSetInitialView(storedHash, scale) {
    this.isInitialViewSet = true;

    // When opening a new file, when one is already loaded in the viewer,
    // ensure that the 'pageNumber' element displays the correct value.
    //[Bruce]
    /*
    document.getElementById('pageNumber').value =
      this.pdfViewer.currentPageNumber;
    */
    //End : [Bruce]

    if (this.initialDestination) {
      this.pdfLinkService.navigateTo(this.initialDestination);
      this.initialDestination = null;
    } else if (this.initialBookmark) {
      this.pdfLinkService.setHash(this.initialBookmark);
      this.pdfHistory.push({ hash: this.initialBookmark }, true);
      this.initialBookmark = null;
    } else if (storedHash) {
      this.pdfLinkService.setHash(storedHash);
    } else if (scale) {
      this.pdfViewer.currentScaleValue = scale;
      this.page = 1;
    }

    if (!this.pdfViewer.currentScaleValue) {
      // Scale was not initialized: invalid bookmark or scale was not specified.
      // Setting the default one.
      this.pdfViewer.currentScaleValue = DEFAULT_SCALE_VALUE;
    }
  },

  cleanup: function pdfViewCleanup() {
    if (!this.pdfDocument) {
      return; // run cleanup when document is loaded
    }
    this.pdfViewer.cleanup();
    this.pdfThumbnailViewer.cleanup();
    this.pdfDocument.cleanup();
  },

  forceRendering: function pdfViewForceRendering() {
    this.pdfRenderingQueue.printing = this.printing;
    this.pdfRenderingQueue.isThumbnailViewEnabled = this.sidebarOpen;
    this.pdfRenderingQueue.renderHighestPriority();
  },

  refreshThumbnailViewer: function pdfViewRefreshThumbnailViewer() {
    //[Bruce]
    if(PDFViewerApplication.pdfThumbnailViewer.isUsingExternalImage) {
        /*
        var pdfViewer = this.pdfViewer;
        var thumbnailViewer = this.pdfThumbnailViewer;

        // set thumbnail images of rendered pages
        var pagesCount = pdfViewer.pagesCount;
        for (var pageIndex = 0; pageIndex < pagesCount; pageIndex++) {
            var thumbnailView = thumbnailViewer.getThumbnail(pageIndex);
            thumbnailView.setImage(pageView);
        }

        thumbnailViewer.scrollThumbnailIntoView(this.page);
        */
        var thumbnailViewer = this.pdfThumbnailViewer;
        thumbnailViewer.scrollThumbnailIntoView(this.page);

        return;
    }
    //End : [Bruce]

    var pdfViewer = this.pdfViewer;
    var thumbnailViewer = this.pdfThumbnailViewer;

    // set thumbnail images of rendered pages
    var pagesCount = pdfViewer.pagesCount;
    for (var pageIndex = 0; pageIndex < pagesCount; pageIndex++) {
      var pageView = pdfViewer.getPageView(pageIndex);
      if (pageView && pageView.renderingState === RenderingStates.FINISHED) {
        var thumbnailView = thumbnailViewer.getThumbnail(pageIndex);
        thumbnailView.setImage(pageView);
      }
    }

    thumbnailViewer.scrollThumbnailIntoView(this.page);
  },

  switchSidebarView: function pdfViewSwitchSidebarView(view, openSidebar) {
    if (openSidebar && !this.sidebarOpen) {
      document.getElementById('sidebarToggle').click();
    }
    var thumbsView = document.getElementById('thumbnailView');
    var outlineView = document.getElementById('outlineView');
    var attachmentsView = document.getElementById('attachmentsView');

    var thumbsButton = document.getElementById('viewThumbnail');
    var outlineButton = document.getElementById('viewOutline');
    var attachmentsButton = document.getElementById('viewAttachments');

    switch (view) {
      case 'thumbs':
        var wasAnotherViewVisible = thumbsView.classList.contains('hidden');

        thumbsButton.classList.add('toggled');
        outlineButton.classList.remove('toggled');
        attachmentsButton.classList.remove('toggled');
        thumbsView.classList.remove('hidden');
        outlineView.classList.add('hidden');
        attachmentsView.classList.add('hidden');

        this.forceRendering();

        if (wasAnotherViewVisible) {
          this.pdfThumbnailViewer.ensureThumbnailVisible(this.page);
        }
        break;

      case 'outline':
        if (outlineButton.disabled) {
          return;
        }
        thumbsButton.classList.remove('toggled');
        outlineButton.classList.add('toggled');
        attachmentsButton.classList.remove('toggled');
        thumbsView.classList.add('hidden');
        outlineView.classList.remove('hidden');
        attachmentsView.classList.add('hidden');
        break;

      case 'attachments':
        if (attachmentsButton.disabled) {
          return;
        }
        thumbsButton.classList.remove('toggled');
        outlineButton.classList.remove('toggled');
        attachmentsButton.classList.add('toggled');
        thumbsView.classList.add('hidden');
        outlineView.classList.add('hidden');
        attachmentsView.classList.remove('hidden');
        break;
    }
  },

  beforePrint: function pdfViewSetupBeforePrint() {
    if (!this.supportsPrinting) {
      var printMessage = mozL10n.get('printing_not_supported', null,
          'Warning: Printing is not fully supported by this browser.');
      this.error(printMessage);
      return;
    }

    var alertNotReady = false;
    var i, ii;
    if (!this.pdfDocument || !this.pagesCount) {
      alertNotReady = true;
    } else {
      for (i = 0, ii = this.pagesCount; i < ii; ++i) {
        if (!this.pdfViewer.getPageView(i).pdfPage) {
          alertNotReady = true;
          break;
        }
      }
    }
    if (alertNotReady) {
      var notReadyMessage = mozL10n.get('printing_not_ready', null,
          'Warning: The PDF is not fully loaded for printing.');
      window.alert(notReadyMessage);
      return;
    }

    this.printing = true;
    this.forceRendering();

    var body = document.querySelector('body');
    body.setAttribute('data-mozPrintCallback', true);

    if (!this.hasEqualPageSizes) {
      console.warn('Not all pages have the same size. The printed result ' +
          'may be incorrect!');
    }

    // Insert a @page + size rule to make sure that the page size is correctly
    // set. Note that we assume that all pages have the same size, because
    // variable-size pages are not supported yet (at least in Chrome & Firefox).
    // TODO(robwu): Use named pages when size calculation bugs get resolved
    // (e.g. https://crbug.com/355116) AND when support for named pages is
    // added (http://www.w3.org/TR/css3-page/#using-named-pages).
    // In browsers where @page + size is not supported (such as Firefox,
    // https://bugzil.la/851441), the next stylesheet will be ignored and the
    // user has to select the correct paper size in the UI if wanted.
    this.pageStyleSheet = document.createElement('style');
    var pageSize = this.pdfViewer.getPageView(0).pdfPage.getViewport(1);
    this.pageStyleSheet.textContent =
      // "size:<width> <height>" is what we need. But also add "A4" because
      // Firefox incorrectly reports support for the other value.
      '@supports ((size:A4) and (size:1pt 1pt)) {' +
      '@page { size: ' + pageSize.width + 'pt ' + pageSize.height + 'pt;}' +
      // The canvas and each ancestor node must have a height of 100% to make
      // sure that each canvas is printed on exactly one page.
      '#printContainer {height:100%}' +
      '#printContainer > div {width:100% !important;height:100% !important;}' +
      '}';
    body.appendChild(this.pageStyleSheet);

    for (i = 0, ii = this.pagesCount; i < ii; ++i) {
      this.pdfViewer.getPageView(i).beforePrint();
    }

  },

  // Whether all pages of the PDF have the same width and height.
  get hasEqualPageSizes() {
    var firstPage = this.pdfViewer.getPageView(0);
    for (var i = 1, ii = this.pagesCount; i < ii; ++i) {
      var pageView = this.pdfViewer.getPageView(i);
      if (pageView.width !== firstPage.width ||
          pageView.height !== firstPage.height) {
        return false;
      }
    }
    return true;
  },

  afterPrint: function pdfViewSetupAfterPrint() {
    var div = document.getElementById('printContainer');
    while (div.hasChildNodes()) {
      div.removeChild(div.lastChild);
    }

    if (this.pageStyleSheet && this.pageStyleSheet.parentNode) {
      this.pageStyleSheet.parentNode.removeChild(this.pageStyleSheet);
      this.pageStyleSheet = null;
    }

    this.printing = false;
    this.forceRendering();
  },

  setScale: function (value, resetAutoSettings) {
    this.pdfViewer.currentScaleValue = value;
  },

  rotatePages: function pdfViewRotatePages(delta) {
    var pageNumber = this.page;
    this.pageRotation = (this.pageRotation + 360 + delta) % 360;
    this.pdfViewer.pagesRotation = this.pageRotation;
    this.pdfThumbnailViewer.pagesRotation = this.pageRotation;

    this.forceRendering();

    this.pdfViewer.scrollPageIntoView(pageNumber);
  },

  requestPresentationMode: function pdfViewRequestPresentationMode() {
    if (!this.pdfPresentationMode) {
      return;
    }
    this.pdfPresentationMode.request();
  },

  /**
   * @param {number} delta - The delta value from the mouse event.
   */
  scrollPresentationMode: function pdfViewScrollPresentationMode(delta) {
    if (!this.pdfPresentationMode) {
      return;
    }
    this.pdfPresentationMode.mouseScroll(delta);
  }
};
window.PDFView = PDFViewerApplication; // obsolete name, using it as an alias


function webViewerLoad(evt) {
  _App.getPageDirection("pageDirectionCallback"); //workaround, we have to get pageDirection before webViewerInitialized()
  Promise.all([PDFViewerApplication.initialize(), customEventsManager['onPageDirectionReady'].promise]).then(webViewerInitialized);
}

function pageDirectionCallback(pageDirection){
    console.log("pageDirectionCallback: "+ pageDirection);
    if(pageDirection == PAGE_DIRECTION_RIGHT)
       direct_reverse=true;
    customEventsManager["onPageDirectionReady"].confirmThisIsReady();
}

function webViewerInitialized() {
    var locale = PDFJS.locale || navigator.language;   //Henry add here.
    mozL10n.setLanguage(locale);

    // Listen for unsupported features to trigger the fallback UI.
    //PDFJS.UnsupportedManager.listen(PDFViewerApplication.fallback.bind(PDFViewerApplication));

    //Henry add, to decide book direction
    if(!direct_reverse){
        $viewerOwl = $('#viewer').owlCarousel({
            mouseDrag: false,
            touchDrag: false,
            items: 1,
            margin: 0,
            onInitialized: onViewerCarouselInitialized,
        });
        $viewThumbnailOwl = $('#thumbnailView').owlCarousel({
            stagePadding:50,
            items: 7,
            autoWidth:true,
            center:true,
            lazyLoad: true,
            onInitialized: onThumbnailViewCarouselInitialized,
        });
    }else{
        $viewerOwl = $('#viewer').owlCarousel({
            mouseDrag: false,
            touchDrag: false,
            items: 1,
            margin: 0,
            //rtl:true, //pdf.js font not support rtl, we can't use it
            onInitialized: onViewerCarouselInitialized,
        });
        $viewThumbnailOwl = $('#thumbnailView').owlCarousel({
            stagePadding:50,
            items: 7,
            autoWidth:true,
            lazyLoad: true,
            rtl:true,
            center:true,
            onInitialized: onThumbnailViewCarouselInitialized,
        });
    }

    if(direct_reverse){
      $(".undo.arrow_1").hide();
      $(".undo.arrow_1.reverse").css('display','inline-block');
      $(".thumbnailbtn").hide();
      $(".thumbnailbtn.reverse").css('display','inline-block');
      $("#paginate").hide();
      $("#paginate_reverse").show();
    }
    console.log("(webViewerInitialized)");
}

document.addEventListener('DOMContentLoaded', webViewerLoad, true);

document.addEventListener('pagerendered', function (e) {
  var pageNumber = e.detail.pageNumber;
  var pageIndex = pageNumber - 1;
  var pageView = PDFViewerApplication.pdfViewer.getPageView(pageIndex);

  if (PDFViewerApplication.sidebarOpen) {
    var thumbnailView = PDFViewerApplication.pdfThumbnailViewer.
                        getThumbnail(pageIndex);
    thumbnailView.setImage(pageView);
  }

  if (PDFJS.pdfBug && Stats.enabled && pageView.stats) {
    Stats.add(pageNumber, pageView.stats);
  }

  if (pageView.error) {
    PDFViewerApplication.error(mozL10n.get('rendering_error', null,
      'An error occurred while rendering the page.'), pageView.error);
  }

  //[Bruce]
  /*
  // If the page is still visible when it has finished rendering,
  // ensure that the page number input loading indicator is hidden.
  if (pageNumber === PDFViewerApplication.page) {
    var pageNumberInput = document.getElementById('pageNumber');
    pageNumberInput.classList.remove(PAGE_NUMBER_LOADING_INDICATOR);
  }
  */
  //End : [Bruce]

}, true);

document.addEventListener('textlayerrendered', function (e) {
  var pageIndex = e.detail.pageNumber - 1;
  var pageView = PDFViewerApplication.pdfViewer.getPageView(pageIndex);

}, true);

document.addEventListener('pagemode', function (evt) {
  if (!PDFViewerApplication.initialized) {
    return;
  }
  // Handle the 'pagemode' hash parameter, see also `PDFLinkService_setHash`.
  var mode = evt.detail.mode;
  switch (mode) {
    case 'bookmarks':
      // Note: Our code calls this property 'outline', even though the
      //       Open Parameter specification calls it 'bookmarks'.
      mode = 'outline';
      /* falls through */
    case 'thumbs':
    case 'attachments':
      PDFViewerApplication.switchSidebarView(mode, true);
      break;
    case 'none':
      if (PDFViewerApplication.sidebarOpen) {
        document.getElementById('sidebarToggle').click();
      }
      break;
  }
}, true);

document.addEventListener('namedaction', function (e) {
  if (!PDFViewerApplication.initialized) {
    return;
  }
  // Processing couple of named actions that might be useful.
  // See also PDFLinkService.executeNamedAction
  var action = e.detail.action;
  switch (action) {
    case 'GoToPage':
      document.getElementById('pageNumber').focus();
      break;

    case 'Find':
      if (!PDFViewerApplication.supportsIntegratedFind) {
        PDFViewerApplication.findBar.toggle();
      }
      break;
  }
}, true);

window.addEventListener('presentationmodechanged', function (e) {
  var active = e.detail.active;
  var switchInProgress = e.detail.switchInProgress;
  PDFViewerApplication.pdfViewer.presentationModeState =
    switchInProgress ? PresentationModeState.CHANGING :
    active ? PresentationModeState.FULLSCREEN : PresentationModeState.NORMAL;
});

function updateViewarea() {
  if (!PDFViewerApplication.initialized) {
    return;
  }
  PDFViewerApplication.pdfViewer.update();
}

window.addEventListener('updateviewarea', function (evt) {
  if (!PDFViewerApplication.initialized) {
    return;
  }
  var location = evt.location;

  //[Bruce]
  /*
  PDFViewerApplication.store.initializedPromise.then(function() {
    PDFViewerApplication.store.setMultiple({
      'exists': true,
      'page': location.pageNumber,
      'zoom': location.scale,
      'scrollLeft': location.left,
      'scrollTop': location.top
      'twoPageView': location.twoPageView,
    }).catch(function() {
      // unable to write to storage
    });
  });

  var href =
    PDFViewerApplication.pdfLinkService.getAnchorUrl(location.pdfOpenParams);
  document.getElementById('viewBookmark').href = href;
  document.getElementById('secondaryViewBookmark').href = href;

  // Update the current bookmark in the browsing history.
  PDFViewerApplication.pdfHistory.updateCurrentBookmark(location.pdfOpenParams,
                                                        location.pageNumber);

  // Show/hide the loading indicator in the page number input element.
  var pageNumberInput = document.getElementById('pageNumber');
  var currentPage =
    PDFViewerApplication.pdfViewer.getPageView(PDFViewerApplication.page - 1);

  if (currentPage.renderingState === RenderingStates.FINISHED) {
    pageNumberInput.classList.remove(PAGE_NUMBER_LOADING_INDICATOR);
  } else {
    pageNumberInput.classList.add(PAGE_NUMBER_LOADING_INDICATOR);
  }
  */
  //End : [Bruce]
}, true);

window.addEventListener('resize', function webViewerResize(evt) {
  if (PDFViewerApplication.initialized) {
    var currentScaleValue = PDFViewerApplication.pdfViewer.currentScaleValue;
    if (currentScaleValue === 'auto' ||
        currentScaleValue === 'page-fit' ||
        currentScaleValue === 'page-width') {
        // Note: the scale is constant for 'page-actual'.
        PDFViewerApplication.pdfViewer.currentScaleValue = currentScaleValue;
    } else if (!currentScaleValue) {
      // Normally this shouldn't happen, but if the scale wasn't initialized
      // we set it to the default value in order to prevent any issues.
      // (E.g. the document being rendered with the wrong scale on load.)
      PDFViewerApplication.pdfViewer.currentScaleValue = DEFAULT_SCALE_VALUE;
    }
    PDFViewerApplication.pdfViewer.update();
  }
  updateViewarea();

  // Set the 'max-height' CSS property of the secondary toolbar.
  //SecondaryToolbar.setMaxHeight(document.getElementById('viewerContainer'));
});

window.addEventListener('hashchange', function webViewerHashchange(evt) {
  // [Bruce] We will use carousel 'click' event to change page instead of 'href=#page + pagenumber'
  /*
  if (PDFViewerApplication.pdfHistory.isHashChangeUnlocked) {
    var hash = document.location.hash.substring(1);
    if (!hash) {
      return;
    }
    if (!PDFViewerApplication.isInitialViewSet) {
      PDFViewerApplication.initialBookmark = hash;
    } else {
      PDFViewerApplication.pdfLinkService.setHash(hash);
    }
  }
  */
  // End : [Bruce]
});

window.addEventListener('change', function webViewerChange(evt) {
  var files = evt.target.files;
  if (!files || files.length === 0) {
    return;
  }
  var file = files[0];

  if (!PDFJS.disableCreateObjectURL &&
      typeof URL !== 'undefined' && URL.createObjectURL) {
    PDFViewerApplication.open(URL.createObjectURL(file), 0);
  } else {
    // Read the local file into a Uint8Array.
    var fileReader = new FileReader();
    fileReader.onload = function webViewerChangeFileReaderOnload(evt) {
      var buffer = evt.target.result;
      var uint8Array = new Uint8Array(buffer);
      PDFViewerApplication.open(uint8Array, 0);
    };
    fileReader.readAsArrayBuffer(file);
  }

  PDFViewerApplication.setTitleUsingUrl(file.name);

  // URL does not reflect proper document location - hiding some icons.
  document.getElementById('viewBookmark').setAttribute('hidden', 'true');
  document.getElementById('secondaryViewBookmark').
    setAttribute('hidden', 'true');
  document.getElementById('download').setAttribute('hidden', 'true');
  document.getElementById('secondaryDownload').setAttribute('hidden', 'true');
}, true);

function selectScaleOption(value) {
  var options = document.getElementById('scaleSelect').options;
  var predefinedValueFound = false;
  for (var i = 0, ii = options.length; i < ii; i++) {
    var option = options[i];
    if (option.value !== value) {
      option.selected = false;
      continue;
    }
    option.selected = true;
    predefinedValueFound = true;
  }
  return predefinedValueFound;
}

window.addEventListener('localized', function localized(evt) {
  document.getElementsByTagName('html')[0].dir = mozL10n.getDirection();

  //[Bruce]
  /*
  PDFViewerApplication.animationStartedPromise.then(function() {
    // Adjust the width of the zoom box to fit the content.
    // Note: If the window is narrow enough that the zoom box is not visible,
    //       we temporarily show it to be able to adjust its width.
    var container = document.getElementById('scaleSelectContainer');
    if (container.clientWidth === 0) {
      container.setAttribute('style', 'display: inherit;');
    }
    if (container.clientWidth > 0) {
      var select = document.getElementById('scaleSelect');
      select.setAttribute('style', 'min-width: inherit;');
      var width = select.clientWidth + SCALE_SELECT_CONTAINER_PADDING;
      select.setAttribute('style', 'min-width: ' +
                                   (width + SCALE_SELECT_PADDING) + 'px;');
      container.setAttribute('style', 'min-width: ' + width + 'px; ' +
                                      'max-width: ' + width + 'px;');
    }

    // Set the 'max-height' CSS property of the secondary toolbar.
    SecondaryToolbar.setMaxHeight(document.getElementById('viewerContainer'));
  });
  */
  //End : [Bruce]
}, true);

window.addEventListener('scalechange', function scalechange(evt) {
  //[Bruce]
  /*
  document.getElementById('zoomOut').disabled = (evt.scale === MIN_SCALE);
  document.getElementById('zoomIn').disabled = (evt.scale === MAX_SCALE);
  */
  //End : [Bruce]

  if (evt.presetValue) {
    //[Bruce]
    /*
    selectScaleOption(evt.presetValue);
    */
    //End : [Bruce]
    updateViewarea();
    return;
  }

  //[Bruce]
  /*
  var predefinedValueFound = selectScaleOption('' + evt.scale);
  if (!predefinedValueFound) {
    var customScaleOption = document.getElementById('customScaleOption');
    var customScale = Math.round(evt.scale * 10000) / 100;
    customScaleOption.textContent =
      mozL10n.get('page_scale_percent', { scale: customScale }, '{{scale}}%');
    customScaleOption.selected = true;
  }
  */
  //End : [Bruce]
  updateViewarea();
}, true);

window.addEventListener('pagechange', function pagechange(evt) {
  var page = evt.pageNumber;
  if (evt.previousPageNumber !== page) {
    // Update footbar page info
    if(toolBarVisible) {
      //Phoebe add for show 2 page numbers at twoPageViewMode, bug#214
      if (TwoPageViewMode.active) {
          //[Phoebe]Add for new twoPageViewMode(Page: []1  23  45  67  89 ...)
          if (page == 1){
              document.getElementById('current_page_now').textContent = "";
              document.getElementById('pages_hyphen').textContent = "";
              document.getElementById('current_page_next').textContent = "1";
          }else {
              if ((page % 2) == 1){
                  page = page -1;
              }
              document.getElementById('current_page_next').textContent = ((page+1)<= PageAnimation.totalPageNum)? (page+1):("");
              document.getElementById('pages_hyphen').textContent = ((page+1)<= PageAnimation.totalPageNum)? ("-"):("");
              document.getElementById('current_page_now').textContent = page;
          }
      } else {        
        document.getElementById('current_page').textContent = page;
      }
      if(!direct_reverse)
          document.getElementById('paginate').value = page;
      else
          document.getElementById('paginate_reverse').value = -page;
    }
    // Info App
    App.onChangePage(page, page, page, PageAnimation.totalPageNum);
    updateBookmarkIcon(); //[HW] update Bookmark Icon
    // Update thumbnail
    if(thumbnailBarVisible) {
        PDFViewerApplication.pdfThumbnailViewer.scrollThumbnailIntoView(page);
    }
  }
  //[Bruce]
  /*
  var numPages = PDFViewerApplication.pagesCount;

  document.getElementById('previous').disabled = (page <= 1);
  document.getElementById('next').disabled = (page >= numPages);

  document.getElementById('firstPage').disabled = (page <= 1);
  document.getElementById('lastPage').disabled = (page >= numPages);
  */
  PDFViewerApplication.pdfViewer.update();
  //End : [Bruce]

  // we need to update stats
  if (PDFJS.pdfBug && Stats.enabled) {
    var pageView = PDFViewerApplication.pdfViewer.getPageView(page - 1);
    if (pageView.stats) {
      Stats.add(page, pageView.stats);
    }
  }
}, true);

function handleMouseWheel(evt) {
  var MOUSE_WHEEL_DELTA_FACTOR = 40;
  var ticks = (evt.type === 'DOMMouseScroll') ? -evt.detail :
              evt.wheelDelta / MOUSE_WHEEL_DELTA_FACTOR;
  var direction = (ticks < 0) ? 'zoomOut' : 'zoomIn';

  var pdfViewer = PDFViewerApplication.pdfViewer;
  if (pdfViewer.isInPresentationMode) {
    evt.preventDefault();
    PDFViewerApplication.scrollPresentationMode(ticks *
                                                MOUSE_WHEEL_DELTA_FACTOR);
  } else if (evt.ctrlKey || evt.metaKey) {
    var support = PDFViewerApplication.supportedMouseWheelZoomModifierKeys;
    if ((evt.ctrlKey && !support.ctrlKey) ||
        (evt.metaKey && !support.metaKey)) {
      return;
    }
    // Only zoom the pages, not the entire viewer.
    evt.preventDefault();

    var previousScale = pdfViewer.currentScale;

    PDFViewerApplication[direction](Math.abs(ticks));

    var currentScale = pdfViewer.currentScale;
    if (previousScale !== currentScale) {
      // After scaling the page via zoomIn/zoomOut, the position of the upper-
      // left corner is restored. When the mouse wheel is used, the position
      // under the cursor should be restored instead.
      var scaleCorrectionFactor = currentScale / previousScale - 1;
      var rect = pdfViewer.container.getBoundingClientRect();
      var dx = evt.clientX - rect.left;
      var dy = evt.clientY - rect.top;
      pdfViewer.container.scrollLeft += dx * scaleCorrectionFactor;
      pdfViewer.container.scrollTop += dy * scaleCorrectionFactor;
    }
  }
}

window.addEventListener('DOMMouseScroll', handleMouseWheel);
window.addEventListener('mousewheel', handleMouseWheel);

/*
window.addEventListener('click', function click(evt) {
  if (SecondaryToolbar.opened &&
      PDFViewerApplication.pdfViewer.containsElement(evt.target)) {
    SecondaryToolbar.close();
  }
}, false);
*/
window.addEventListener('keydown', function keydown(evt) {
  if (OverlayManager.active) {
    return;
  }

  var handled = false;
  var cmd = (evt.ctrlKey ? 1 : 0) |
            (evt.altKey ? 2 : 0) |
            (evt.shiftKey ? 4 : 0) |
            (evt.metaKey ? 8 : 0);

  var pdfViewer = PDFViewerApplication.pdfViewer;
  var isViewerInPresentationMode = pdfViewer && pdfViewer.isInPresentationMode;

  // First, handle the key bindings that are independent whether an input
  // control is selected or not.
  if (cmd === 1 || cmd === 8 || cmd === 5 || cmd === 12) {
    // either CTRL or META key with optional SHIFT.
    switch (evt.keyCode) {
      case 70: // f
        if (!PDFViewerApplication.supportsIntegratedFind) {
          PDFViewerApplication.findBar.open();
          handled = true;
        }
        break;
      case 71: // g
        if (!PDFViewerApplication.supportsIntegratedFind) {
          PDFViewerApplication.findBar.dispatchEvent('again',
                                                     cmd === 5 || cmd === 12);
          handled = true;
        }
        break;
      case 61: // FF/Mac '='
      case 107: // FF '+' and '='
      case 187: // Chrome '+'
      case 171: // FF with German keyboard
        if (!isViewerInPresentationMode) {
          PDFViewerApplication.zoomIn();
        }
        handled = true;
        break;
      case 173: // FF/Mac '-'
      case 109: // FF '-'
      case 189: // Chrome '-'
        if (!isViewerInPresentationMode) {
          PDFViewerApplication.zoomOut();
        }
        handled = true;
        break;
      case 48: // '0'
      case 96: // '0' on Numpad of Swedish keyboard
        if (!isViewerInPresentationMode) {
          // keeping it unhandled (to restore page zoom to 100%)
          setTimeout(function () {
            // ... and resetting the scale after browser adjusts its scale
            pdfViewer.currentScaleValue = DEFAULT_SCALE_VALUE;
          });
          handled = false;
        }
        break;
    }
  }

  // CTRL or META without shift
  if (cmd === 1 || cmd === 8) {
    switch (evt.keyCode) {
      case 83: // s
        PDFViewerApplication.download();
        handled = true;
        break;
    }
  }

  // CTRL+ALT or Option+Command
  if (cmd === 3 || cmd === 10) {
    switch (evt.keyCode) {
      case 80: // p
        PDFViewerApplication.requestPresentationMode();
        handled = true;
        break;
      case 71: // g
        // focuses input#pageNumber field
        document.getElementById('pageNumber').select();
        handled = true;
        break;
    }
  }

  if (handled) {
    evt.preventDefault();
    return;
  }

  // Some shortcuts should not get handled if a control/input element
  // is selected.
  var curElement = document.activeElement || document.querySelector(':focus');
  var curElementTagName = curElement && curElement.tagName.toUpperCase();
  if (curElementTagName === 'INPUT' ||
      curElementTagName === 'TEXTAREA' ||
      curElementTagName === 'SELECT') {
    // Make sure that the secondary toolbar is closed when Escape is pressed.
    if (evt.keyCode !== 27) { // 'Esc'
      return;
    }
  }
  var ensureViewerFocused = false;

  if (cmd === 0) { // no control key pressed at all.
    switch (evt.keyCode) {
      case 38: // up arrow
      case 33: // pg up
      case 8: // backspace
        if (!isViewerInPresentationMode &&
            pdfViewer.currentScaleValue !== 'page-fit') {
          break;
        }
        /* in presentation mode */
        /* falls through */
      case 37: // left arrow
        // horizontal scrolling using arrow keys
        if (pdfViewer.isHorizontalScrollbarEnabled) {
          break;
        }
        /* falls through */
      case 75: // 'k'
      case 80: // 'p'
        PDFViewerApplication.previousPage();//phoebe
        handled = true;
        break;
      case 27: // esc key
        /*
        if (SecondaryToolbar.opened) {
          SecondaryToolbar.close();
          handled = true;
        }
        */
        if (!PDFViewerApplication.supportsIntegratedFind &&
            PDFViewerApplication.findBar.opened) {
          PDFViewerApplication.findBar.close();
          handled = true;
        }
        break;
      case 40: // down arrow
      case 34: // pg down
      case 32: // spacebar
        if (!isViewerInPresentationMode &&
            pdfViewer.currentScaleValue !== 'page-fit') {
          break;
        }
        /* falls through */
      case 39: // right arrow
        // horizontal scrolling using arrow keys
        if (pdfViewer.isHorizontalScrollbarEnabled) {
          break;
        }
        /* falls through */
      case 74: // 'j'
      case 78: // 'n'
        PDFViewerApplication.nextPage();//phoebe
        handled = true;
        break;

      case 36: // home
        if (isViewerInPresentationMode || PDFViewerApplication.page > 1) {
          PDFViewerApplication.page = 1;
          handled = true;
          ensureViewerFocused = true;
        }
        break;
      case 35: // end
        var lastPage = PDFViewerApplication.lastPageNumber;
        if (isViewerInPresentationMode || (PDFViewerApplication.pdfDocument &&
          PDFViewerApplication.page < PDFViewerApplication.pagesCount) || PDFViewerApplication.page < lastPage) {
          PDFViewerApplication.page = lastPage;//phoebe
          handled = true;
          ensureViewerFocused = true;
        }
        break;

      case 72: // 'h'
        if (!isViewerInPresentationMode) {
          HandTool.toggle();
        }
        break;
      case 82: // 'r'
        PDFViewerApplication.rotatePages(90);
        break;
    }
  }

  if (cmd === 4) { // shift-key
    switch (evt.keyCode) {
      case 32: // spacebar
        if (!isViewerInPresentationMode &&
            pdfViewer.currentScaleValue !== 'page-fit') {
          break;
        }
        PDFViewerApplication.previousPage();//phoebe
        handled = true;
        break;

      case 82: // 'r'
        PDFViewerApplication.rotatePages(-90);
        break;
    }
  }

  if (!handled && !isViewerInPresentationMode) {
    // 33=Page Up  34=Page Down  35=End    36=Home
    // 37=Left     38=Up         39=Right  40=Down
    // 32=Spacebar
    if ((evt.keyCode >= 33 && evt.keyCode <= 40) ||
        (evt.keyCode === 32 && curElementTagName !== 'BUTTON')) {
      ensureViewerFocused = true;
    }
  }

  if (cmd === 2) { // alt-key
    switch (evt.keyCode) {
      case 37: // left arrow
        if (isViewerInPresentationMode) {
          PDFViewerApplication.pdfHistory.back();
          handled = true;
        }
        break;
      case 39: // right arrow
        if (isViewerInPresentationMode) {
          PDFViewerApplication.pdfHistory.forward();
          handled = true;
        }
        break;
    }
  }

  if (ensureViewerFocused && !pdfViewer.containsElement(curElement)) {
    // The page container is not focused, but a page navigation key has been
    // pressed. Change the focus to the viewer container to make sure that
    // navigation by keyboard works as expected.
    pdfViewer.focus();
  }

  if (handled) {
    evt.preventDefault();
  }
});

window.addEventListener('beforeprint', function beforePrint(evt) {
  PDFViewerApplication.beforePrint();
});

window.addEventListener('afterprint', function afterPrint(evt) {
  PDFViewerApplication.afterPrint();
});

(function animationStartedClosure() {
  // The offsetParent is not set until the pdf.js iframe or object is visible.
  // Waiting for first animation.
  PDFViewerApplication.animationStartedPromise = new Promise(
      function (resolve) {
    window.requestAnimationFrame(resolve);
  });
})();


