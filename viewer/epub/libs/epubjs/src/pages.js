/* 
 * 
 * It performs a calculation of printing-like pages number (x of y), loading silently 
 * and progressly all the contents of the book and formatting them to fit the actual render dimensions.
 * You should call this function after the render is displayed and has formatted the layout (e.g. the first time of "renderer:chapterDisplayed").
 * You can listen from it two events:
 * "renderer:pagesNumChanged" -> dispatched after the operation is completed (returns the totalPages)
 * "renderer:pagesNumProgress" -> dispatched during the operation (returns an object with pagesLoaded and pagesTotal)
 * 
 * After having called this, you can use the utils/display methods to retrieve the formatted pages number, reading percentage etc.
 * See below.
 * 
 */
EPUBJS.Renderer.prototype.calculateNumberOfPages = function(avoidCalcOnResize){

    console.log("EPUBJS.Renderer.prototype.calculateNumberOfPages");

    // destroy any previous operations
    if (this.tempIFrame){
        document.body.removeChild(render.tempIFrame);
        this.tempIFrame = null;
    }

    // FLAG STATUS
    this.isScanningComplete = false;
    // the total pages of the book
    this.totalPages = 0;
    // loading index
    this.currPageScanned = -1;
    // object to store info
    this.chaptersPages = {};
    // timeout for delay in resize
    this.resizeTimeOutID = -1;
    //this.book.spine = [];

    // add an event listener on resize, so we can compute again
    if (!this.resizeEventAdded && avoidCalcOnResize !== true){
        this.on("renderer:resized",this.onResizeNumPages,this);
        this.resizeEventAdded = true;
    }

    // set as instance of Render so we can resolve it after the loading
    this.promiseCalcPages = new RSVP.Promise();

    // check if we have a copy in localStorage that fits the actual dimensions (in mobile device it's quite usual) so we can use it, without performing again the operation
    var savedData = this.loadPagesNum();
    if (savedData != null && !this.book.settings.reload){ // reload on settings.reload
        this.isScanningComplete = true;
        this.chaptersPages = savedData.chaptersPages;
        this.totalPages = savedData.totalPages;
        this.promiseCalcPages.resolve(this.totalPages);
        this.lastPercent = savedData.lastPercent;
        console.log("EPUBJS.Renderer.prototype.calculateNumberOfPages->using localStorage:",this.totalPages);
        this.trigger("renderer:pagesNumChanged",this.totalPages);
        this.book.trigger("renderer:pagesNumChanged",this.totalPages);
        return this.promiseCalcPages;
    }

    this.calcNextPage();

    return this.promiseCalcPages;
}

/* Return the page num for the first page of a chapter */ 
EPUBJS.Renderer.prototype.firstPageOfChapter = function(chapter){
    if (!this.isScanningComplete) return -1;
    console.log("firstPageOfChapter",this.chaptersPages[chapter.spinePos].firstPage, this.chapterPos);
    return this.chaptersPages[chapter.spinePos].firstPage;
}
/* Return the current page */ 
EPUBJS.Renderer.prototype.getCurrentPage = function(){
    if (!this.isScanningComplete) return -1;
    return this.firstPageOfChapter(this.currentChapter) + this.chapterPos;

}
/* Return a formated page num like "1 / 120".
 * You can pass a separator to format the result and/or a loading indicator in HTML
 * You should call this functon everytime the page is changed ("renderer:pageChanged" and "renderer:pagesNumChanged")
 */ 
EPUBJS.Renderer.prototype.getCurrentPageOfTotPages = function(separator,loadingIndicator){
    loadingIndicator || (loadingIndicator = "...");
    if (!this.isScanningComplete) return loadingIndicator;

    separator || (separator = " / ");
    return  this.getCurrentPage() + separator + this.totalPages;
}

/* Return a percent of reading (from 0 to 1) 
 * This could be usefull to build a slider.
 */
EPUBJS.Renderer.prototype.getReadingPercentage = function(){
    if (!this.isScanningComplete) return null;
    // to return a "real" 0 to 1 rappresentation we should force this to 0 even if, logically, the first page should be considered as read when displayed, so > 0.
    if (this.getCurrentPage() == 1) return 0;
    return  this.getCurrentPage() / this.totalPages;
}
/*
 * Go to page num of the book
 */
EPUBJS.Renderer.prototype.gotoPageNum = function(pageNum){
    if (!this.isScanningComplete) return false;
    var render = this;
    for (var spinePos in this.chaptersPages) {
        var chapter = this.chaptersPages[spinePos]; 
        if (pageNum > chapter.firstPage  && pageNum <= (chapter.firstPage+chapter.pages))
        {
            var chapterPos = pageNum - chapter.firstPage;
            if (this.book.spinePos != spinePos){

                this.book.spinePos = Number(spinePos);
                this.book.displayChapter(this.book.spinePos).then(function(chapter){
                    render.page(chapterPos);
                })
            }
            else{
                this.page(chapterPos);
            }
            return true
        }
    };

    return false;
}
/*
 * Go to percentage of reading.
 * percent => from 0 to 1;
 * (usefull for slider bars)
 */
EPUBJS.Renderer.prototype.gotoPercent = function(percent){
    var currPage = Math.round(this.totalPages*percent);
    currPage = currPage == 0 ? 1 : currPage;
    //console.log("EPUBJS.Renderer.prototype.gotoPercent",percent,currPage);
    this.gotoPageNum(currPage);

}


// UTILS // INTERNAL //
EPUBJS.Renderer.prototype.onResizeNumPages = function(e){
    console.log("EPUBJS.Renderer.prototype.onResizeNumPages");
    clearTimeout(this.resizeTimeOutID);
    // because the operation requires a lot of resources, we wait long enough before recalculating, being sure of the new dimensions
    // Anyway flag as scanning
    this.isScanningComplete = false;
    this.resizeTimeOutID = setTimeout(this.recalcPages,2500,this); // pass the scope
}

EPUBJS.Renderer.prototype.recalcPages = function(render){
    render.calculateNumberOfPages(true);
}

EPUBJS.Renderer.prototype.calcNextPage = function(){

    if (this.book.spine[this.currPageScanned+1]){

        this.currPageScanned++;

        this.tempIFrame = document.createElement('iframe');

        document.body.appendChild(this.tempIFrame);

        this.tempIFrame.src = this.book.spine[this.currPageScanned].href;

        this.tempIFrame.width = this.el.clientWidth;
        this.tempIFrame.height = this.el.clientHeight;
        this.tempIFrame.style.visibility = "hidden";

        var render = this;

        this.tempIFrame.onload = function(){
            //console.log("PagesCalc-scanNext-onLoad");

            var docEl = render.tempIFrame.contentDocument.documentElement;
            var bodyEl = render.tempIFrame.contentDocument.body;

            if(render.book.settings.fixedLayout) { // TODO, test if it works -> copied from Render.fixedLayout  (probably we should use a seprated function to have a the same format)

                docEl.style.width = render.tempIFrame.width;

                //-- Adjust height
                docEl.style.height = "auto";

                //-- Remove columns
                // this.docEl.style[EPUBJS.core.columnWidth] = "auto";

                //-- Scroll
                docEl.style.overflow = "auto";
            }
            else{ // TESTED -> copied from Render.formatSpread (probably we should use a seprated function to have a the same format)

                //-- Clear Margins
                bodyEl.style.margin = "0";

                docEl.style.overflow = "hidden";

                docEl.style.width = render.tempIFrame.width  + "px";

                //-- Adjust height
                docEl.style.height = render.tempIFrame.height  + "px";

                //-- Add columns
                docEl.style[EPUBJS.Renderer.columnAxis] = "horizontal";
                docEl.style[EPUBJS.Renderer.columnGap] = render.gap+"px";
                docEl.style[EPUBJS.Renderer.columnWidth] = render.colWidth+"px";

            }
            // calc pages
            var totalWidth = docEl.scrollWidth;

            var displayedPages = Math.ceil(totalWidth / render.spreadWidth);
            // save with index, so we can retrieve after from spinePos
            render.chaptersPages[render.book.spine[render.currPageScanned].index] = {firstPage:render.totalPages,pages:displayedPages};
            render.totalPages += displayedPages;

            //console.log("scanNext-pages",displayedPages,render.book.spine[render.currPageScanned].href);

            document.body.removeChild(render.tempIFrame);
            render.tempIFrame = null;

            var progEventData = {pagesLoaded:(render.currPageScanned+1),pagesTotal:render.book.spine.length}
            render.trigger("renderer:pagesNumProgress", progEventData);
            render.book.trigger("renderer:pagesNumProgress", progEventData);

            render.calcNextPage();
        }
    }
    else{
        this.isScanningComplete = true;
        this.promiseCalcPages.resolve(this.totalPages);
        this.trigger("renderer:pagesNumChanged",this.totalPages);
        this.book.trigger("renderer:pagesNumChanged",this.totalPages);
        this.savePagesNum();
    }
}


/* save in localStorage */ 
EPUBJS.Renderer.prototype.savePagesNum = function(){
    if (!localStorage || !this.isScanningComplete) return;
    var pagesNumKey = this.book.settings.bookPath + ":pages:" + this.book.settings.version;
    var pagesObject = {width:this.el.clientWidth, height:this.el.clientHeight, totalPages:this.totalPages, chaptersPages:this.chaptersPages, lastPercent:this.getReadingPercentage()};
    localStorage.setItem(pagesNumKey,JSON.stringify(pagesObject))
}
/* load from localStorage */
EPUBJS.Renderer.prototype.loadPagesNum = function(){
    if (!localStorage) return null;

    var pagesNumKey = this.book.settings.bookPath + ":pages:" + this.book.settings.version,
        fromStore = localStorage.getItem(pagesNumKey);

    if(fromStore && fromStore != 'undefined' && fromStore != 'null'){
        var pagesObject = JSON.parse(fromStore);
        // we can use it only if we are at the same dimensions we had calculate before
        if (pagesObject.width == this.el.clientWidth && pagesObject.height ==  this.el.clientHeight){
            return pagesObject;
        }
    }
    return null;
}
