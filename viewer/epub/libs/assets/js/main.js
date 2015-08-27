/* 全域變數 */
var listBook_offset = 0;

$(document).ready(function(){
	 //api_listBook(0);
	 
	 /* 需登入 */
	 api_listMemberReadList();
});


function api_listBook(offset)
{
		var data = {};
		data.type = 'all';
		data.offset = offset;
		data.last_updated_time = moment().format();
		data.page_size = 30;
		data.cms_token = 'guest_fjadsioffkladsjfl';

		$.get("http://bookapi.booksdev.benqguru.com:8080/V1.1/CMSAppApi/ListBook/",data,function(r){
			
			if(r.records.length){
				
				$('.book_num').html(r.total_records);
			
				$.each(r.records,function(key,value){
					/* 塞資料*/
					var html = '<li>\
										  <label class="icon icon1">\
											<input type="checkbox">\
											<ul>\
												<li class="bg">分類至</li>\
												<li><a href="#">密碼書單</a></li>\
												<li><a href="#">個人書單1</a></li>\
												<li><a href="#">個人書單2</a></li>\
												<li><a href="#">個人書單3</a></li>\
											</ul>\
										</label>\
										<label class="icon icon2">\
											<input type="checkbox">\
											<ul>\
												<li><a href="#">前往書籍介紹</a></li>\
												<li><a href="#">開啟線上閱讀</a></li>\
												<li><a href="#">前往閱讀紀錄</a></li>\
												<li><a href="javascript:" onclick="document.getElementById(\'sealing\').style.display = \'block\'">封存</a></li>\
											</ul>\
										</label>\
										<a href="#" class="img" src="' + value.efile_cover_url + '"></a>\
										<h3><a href="#">' + value.c_title + '</a></h3>\
										<em>作者： ' + value.author + ' | 出版社：' + value.publisher_title +' | 出版日期：' + value.publish_date +'</em>\
										<br clear="both">\
										<label class="check hideElement">\
											<input type="checkbox" >\
											<i></i>\
										</label>\
									</li>';
					$('.box').append(html);
				});
			}
			
			
			listBook_offset = listBook_offset + r.records.length;
		},"json");
		
}

function api_listMemberReadList()
{
	var data = {};
	data.last_updated_time = moment().format();
	data.cms_token = 'guest_fjadsioffkladsjfl';

	$.get("http://bookapi.booksdev.benqguru.com:8080/V1.1/CMSAppApi/ListMemberReadList",data,function(r){
			console.log(r," - 取得個人隸屬書單介接API");
			if(r.records.length){
				$.each(r.records,function(key,value){
					var html = '<li><a href="#">' + value.title + '</a></li>';
					$('.book_type_list').append(html);
				});
			}
	},"json");
}

function editBookList(e)
{
	if($.trim($(e).children().find('input').val()).length <= 0){
		alert("請輸入新的書單名稱");
	}else{

		var put = {};
		put.custom_type_id = 'custom1';
		put.custom_type_name = $(e).children().find('input').val();
		put.cms_token = 'fhadsjkfhadjklhjk';
		console.log(put," - 修改個人隸屬自訂書單名稱介接API 傳遞參數（PUT）");
		$.ajax({
			url: 'http://bookapi.booksdev.benqguru.com:8080/V1.1/CMSAppApi/MemberReadList',
			type: 'PUT',
			dataType: 'json',
			data: put
		})
		.done(function(r) {
			console.log(r," - 修改個人隸屬自訂書單名稱介接API「參數應傳遞正確，但目前皆回傳錯誤，需確認」");
		});
		
		alert("修改完成。");
		$(e).prev().prop("checked","");
	}
	return false;
}

function delBookList(e)
{	
	alert("已成功刪除書單。");
	$(e).prev().prop("checked","");
	return false;
}

function sealingClose(e)
{
	$(e).parent().parent().hide();
	$('.icon2').find('input').prop("checked","");

}

function sealingShow(id)
{
	$('#sealing').show();
	$('#sealing').find('input').val(id);

	console.log($('#sealing').find('input').val());
	return false;
}

function submitSealing(e)
{
	console.log($(e).find("input").val());

	var post = {};
	var id_array = [$(e).find("input").val()];
	post.book_uni_id =id_array;
	post.to_readlist = 'archive';
	post.action 	 = 'add to archive list';

	$.post('http://bookapi.booksdev.benqguru.com:8080/V1.1/CMSAppApi/UpdateBookReadList', post, function(data, textStatus, xhr) {
		/*optional stuff to do after success */
		console.log(data," - 變更書籍書單隸屬介接API（參數需確認");
	});

	alert("此書籍已封存");
	$(e).hide();
	$('.icon2').find('input').prop("checked","");

	return false;
}

function changeSort(e)
{
	$(e).parent().prev().prop('checked','');
	$(e).parent().parent().find("b").html($(e).find('a').html());
}

function changeListShowModel(type)
{
	if(type == 'box'){
		$('#show2').css("display","inline-block");
		$('#show1').css("display","none");
		$('#list').addClass(type);
	}else{
		$('#show1').css("display","inline-block");
		$('#show2').css("display","none");
		$('#list').removeClass();
	}

}

function removeBookFromList()
{
	$('.check').show();
	$('#operation1').css("display","none");
	$('#operation2').css("display","inline-block");
}

function checkRemoveBookFromList()
{
	if($('.check').find('input[type=checkbox]:checked').length > 0){
		$('#delete').show();
	}else{
		alert("請至少選取一本書籍。");
	}
}

function cancelRemoveBookFromList()
{
	$('.check').hide();
	$('.check').find("input[type=checkbox]").prop("checked","");
	$('#icon3').click();
	$('#operation1').css("display","inline-block");
	$('#operation2').css("display","none");
}

function submitRemoveBookFromList(e)
{
	alert("您選取的書籍已移除。");
	var post = {};
	var id_array = [];

	$.each($('.check').find('input[type=checkbox]:checked'),function(index, el) {
		id_array.push($(el).val());
	});	
	
	post.book_uni_id =id_array;
	post.to_readlist = 'all';
	post.action 	 = 'remove';
	console.log(post,"批次」變更書籍書單隸屬介接API 傳遞");

	$.post('http://bookapi.booksdev.benqguru.com:8080/V1.1/CMSAppApi/UpdateBookReadList', post, function(data, textStatus, xhr) {
		/*optional stuff to do after success */
		console.log(data," - 「批次」變更書籍書單隸屬介接API（參數需確認，to_readlist應傳遞什麼參數，action web專用僅有解封存)");
	});
	$(e).hide();
	cancelRemoveBookFromList();
}

function batchCancelSealing(e)
{
	$('.check').hide();
	$('.check').find("input[type=checkbox]").prop("checked","");
	$('#icon3').click();
	$('#operation1').css("display","inline-block");
	$('#operation3').css("display","none");
}

function batchSealingShow()
{
	$('.check').show();
	$('#operation3').css("display","inline-block");
	$('#operation1').css("display","none");
}

function checkBatchSealing()
{
	if($('.check').find('input[type=checkbox]:checked').length > 0){
		$('.batch_sealing').show();
	}else{
		alert("請至少選取一本書籍。");
	}
}

function submitBatchSealing(e)
{
	alert("您選取的書籍已封存。");
	var post = {};
	var id_array = [];
	
	$.each($('.check').find('input[type=checkbox]:checked'),function(index, el) {
		id_array.push($(el).val());
	});	
	
	post.book_uni_id =id_array;
	post.to_readlist = 'archive';
	post.action 	 = 'add to archive list';
	console.log(post,"「批次 封存」變更書籍書單隸屬介接API 傳遞");

	$.post('http://bookapi.booksdev.benqguru.com:8080/V1.1/CMSAppApi/UpdateBookReadList', post, function(data, textStatus, xhr) {
		/*optional stuff to do after success */
		console.log(data," - 「批次 封存」變更書籍書單隸屬介接API（action web專用僅有解封存)");
	});

	$(e).hide();
	batchCancelSealing();
	return false;
}

