window.addEventListener('load', function() {
	if (typeof speechSynthesis == 'undefined' || typeof webkitSpeechRecognition == 'undefined')
		return;

	var texts, homophones;
	var current_phrase_no, nextPhraseTimer;
	var $success = new Audio('correct.mp3');	

	Promise.all(['texts.txt', 'homophones.txt'].map(f => fetch(f).then(res => res.text())))	
		.then(function (res) {
			texts = parseTexts(res[0]);
			homophones = parseHomophones(res[1]);

			for (id in texts)
				addText(id, texts[id].name, texts[id].text);

			loadVoices(initOptions);
			if (speechSynthesis.onvoiceschanged !== undefined) 
				speechSynthesis.onvoiceschanged = () => loadVoices(initOptions);

			$('#page-start #loading').remove();
		});

	$('#page-start #button-start').addEventListener('click', function () {
		setPage('main');
		var $e = $('#page-text-selector #texts div[id = "' + localStorage.getItem('speech-current-text') + '"]') || $('#texts').children[0];
		if ($e)
			$e.click();
	});
	$('#page-option #speech-success-ring [value="yes"]').addEventListener('click', () => $success.play());
	$('#page-main #button-help').addEventListener('click', () => setPage('help'));
	$('#page-main #button-option').addEventListener('click', () => setPage('option'));
	$('#page-main #button-text-selector').addEventListener('click', function () {
		setPage('text-selector');
		$('#page-text-selector #texts').scrollTop = $('#texts div[current]').offsetTop;
	});
	$('#page-main #phrase').addEventListener('click', (event) => speakText(event.target.textContent));
	$('.close', $e => $e.addEventListener('click', () => setPage($e.getAttribute('back'))));

	$('#page-text-selector #button-text-add').addEventListener('click', function () {
		$('#page-text-add #caption').value = '';
		$('#page-text-add #text').value = '';
		setPage('text-add');
	});

	$('#page-text-add #button-text-save').addEventListener('click', function () {
		setPage('text-selector');

		var caption = $('#page-text-add #caption').value.trim() || 'My text';
		var text = $('#page-text-add #text').value.trim();
		if (!text) 
			return;

		var id = new Date().getTime();
		texts[id] = {id, name, text, phrases: text.split('\n').map(e => e.trim()).filter(e => !!e)};
		addText(id, caption, text);
		$('#page-text-selector #texts div[id = "'+ id + '"]').click();
		$('#page-text-selector #texts').scrollTop = $('#texts').scrollHeight;

		var user_texts = (localStorage.getItem('speech-user-texts') || '');
		var user_text = '\nid: ' + id + '\nname: ' + caption + '\n\n' + text;
		localStorage.setItem('speech-user-texts', user_texts + '\n===' + user_text);
	})
	
	function addText(id, name, text) {
		var $div = document.createElement('div');
		$div.setAttribute('id', id);
		$div.innerHTML = name;
		$div.addEventListener('click', function () {
			if ($div.hasAttribute('current'))
				return;
	
			for (var i = 0; i < $('#texts').children.length; i++)
				$('#texts').children[i].removeAttribute('current');
			this.setAttribute('current', true);

			$('#text').innerHTML = text;
			localStorage.setItem('speech-current-text', this.id);
			setPhrase($('.page[current]').id == 'page-text-selector' ? 0 : localStorage.getItem('speech-phrase'));
		});

		var $view = document.createElement('div');
		$view.setAttribute('id', 'view');
		$view.innerHTML = '&#10148;';	
		$view.addEventListener('click', function (event) {
			event.stopImmediatePropagation();

			if (!$div.hasAttribute('current')) 
				$div.click();

			setPage('text-view');
			$('#page-text-view .caption').children[0].innerHTML = name;
			$('#page-text-view .content').innerHTML = text;
		})
		$div.appendChild($view);

		var $remove = document.createElement('div');
		$remove.setAttribute('id', 'remove');
		$remove.innerHTML = '&#10006;';
		$remove.addEventListener('click', function (event) {
			event.stopImmediatePropagation();

			if (!confirm('Are you sure you want to remove "' + name +'"?'))
				return;

			if ($div.hasAttribute('current')) 
				($div.previousSibling || $div.nextSibling).click();
			
			var deleted = localStorage.getItem('speech-deleted-texts') || '';
			localStorage.setItem('speech-deleted-texts', deleted + ';' + id);
			$div.remove();	
		})
		$div.appendChild($remove);

		$('#texts').appendChild($div);
	}

	function loadFile() {
		var file = $('#page-text-add #upload').files[0];
		if (file) {
			var reader = new FileReader();
			reader.onload = (event) => $('#page-text-add #text').value = event.target.result;
			reader.readAsText(file);
		}
	}
	$('#page-text-add #upload').addEventListener('change', loadFile, false);
	$('#page-text-add #button-load-file').addEventListener('click', () => $('#page-text-add #upload').click());	

	$('#page-main #phrase-number').addEventListener('click', function () {
		$('#page-main #phrase-number-input').style.display = 'inline-block';
		$('#page-main #phrase-number-input').value = current_phrase_no + 1;
		$('#page-main #phrase-number-input').focus();
	});

	$('#page-main #phrase-number-input').addEventListener('blur', (event) => event.target.style.display = 'none');
	$('#page-main #phrase-number-input').addEventListener('keypress', function (event) {
  		if (event.keyCode == 13 && !isNaN(this.value)) {	
			this.blur();	
			setPhrase(this.value - 1);
		}
	});
	$('#page-main #panel-counter #button-prev-phrase').addEventListener('click', () => setPhrase(current_phrase_no - 1));
	$('#page-main #panel-counter #button-next-phrase').addEventListener('click', () => setPhrase(current_phrase_no + 1));

	function setPhrase (no) {
		clearTimeout(nextPhraseTimer);

		no = parseInt(no) || 0;
		var id = $('#texts div[current]').id;
		var text = texts[id];

		if (no < 0)
			return setPhrase(0);

		if (no > text.phrases.length - 1)
			return setPhrase(text.phrases.length - 1);		

		current_phrase_no = no;
		$('#page-main #panel-counter #button-prev-phrase').style.visibility = no == 0 ? 'hidden' : 'visible';
		$('#page-main #panel-counter #button-next-phrase').style.visibility = no == text.phrases.length - 1 ? 'hidden' : 'visible';

		$('#page-main #phrase-number').innerHTML = no + 1 + '/' + text.phrases.length;
		$('#page-main #panel-counter #caption').innerHTML = text.name;
		$('#page-main #phrase').innerHTML = text.phrases[no].split(' ').map((e) => e.indexOf('<') == -1 ? '<span>' + e + '</span>' : e).join(' ');
		$('#page-main #phrase > *', e => e.addEventListener('click', (event) => event.stopImmediatePropagation() || speakText(event.target.textContent)));
		$('#page-main #button-listen').setAttribute('hidden', true);
		$('#page-main #recognition').innerHTML = '';
		$('#page-main #recognition').removeAttribute('confidence');
		$('#page-main #compare').innerHTML = '';

		if (getOption('speech-auto-read') == 'yes' && $('#page-main').hasAttribute('current'))
			speakText(text.phrases[no]);

		localStorage.setItem('speech-phrase', no);
	}

	function initOptions() {
		$('#page-option .content > div', function ($opt) {	
			var opt = $opt.id;
			var $e = $('#' + opt);
			for(var i = 0; i < $e.children.length; i++)
				$e.children[i].addEventListener('click', (event) => setOption(opt, event.target.getAttribute('value')));
			setOption(opt, localStorage.getItem(opt));
		});
	}

	function setOption(opt, value) {
		var $e = $('#' + opt);
		var def = $e.getAttribute('default');
		localStorage.setItem(opt, value || def);
		for(var i = 0; i < $e.children.length; i++)
			$e.children[i].removeAttribute('current');

		var $curr = $e.querySelector('[value="' + value + '"]') || $e.querySelector('[value="' + def + '"]')
		$curr.setAttribute('current', true);
	}

	function getOption(opt) {
		var $e = $('#' + opt + ' [current]');
		return $e ? $e.getAttribute('value') : $('#' + opt).getAttribute('default');
	}

	var voices = [];
	function speakText(text) {
		var utterance = new SpeechSynthesisUtterance(text);
		utterance.voice = voices[getOption('speech-voice')];
		utterance.rate = getOption('speech-voice-speed') || 1;
		speechSynthesis.speak(utterance);
	};

	function loadVoices (cb) {
		voices = speechSynthesis.getVoices();
		var $voices = $('#page-option #speech-voice');
		if ($voices.innerHTML.trim())
			return;

		function speakExample () {
			setTimeout(() => speakText('Where is a cat?'), 200);
		}

		voices.forEach(function(e, i) {
			if (e.lang.indexOf('en') == 0 && (e.lang.indexOf('US') != -1 || e.lang.indexOf('UK') != -1 || e.lang.indexOf('GB') != -1)) {
				var $div = document.createElement('div');
				$div.setAttribute('value', i);
				$div.setAttribute('title', e.name);
				$div.innerHTML = $voices.children.length + 1; 
				$div.addEventListener('click', speakExample);
				$voices.appendChild($div);
				$voices.appendChild(document.createTextNode(' '));
			}	
		});

		if (!$voices.children.length)
			return;

		var current = ($('#page-option #speech-voice [value="' + localStorage.getItem('speech-voice') + '"]') || $voices.children[0]).getAttribute('value');
		$voices.setAttribute('default', current);
		$voices.classList.add('col' + $voices.children.length);
		setOption('speech-voice', current);

		$('#page-option #speech-voice-speed > div', $e => $e.onclick = speakExample);
		cb();
	}

	navigator.mediaDevices.getUserMedia({audio: true}).then (function (stream) {
		$('#page-start #microphone').remove();

		var recognition = new webkitSpeechRecognition();
		var chunks, userAudio;

		var mediaRecorder = new MediaRecorder(stream);
		mediaRecorder.addEventListener('dataavailable', event => chunks.push(event.data));

		var time;
		var isMobile = (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator && navigator.userAgent || ''));

		var $panel_recognition = $('#page-main #panel-recognition');
		var $recognition = $('#page-main #recognition');
		var $compare = $('#page-main #compare');

		function startRecord(event) {
			event.stopImmediatePropagation();

			if (event.type != 'touchstart' && event.type == 'mousedown' && event.which != 1)
				return;

			if ($('#page-main #button-record').hasAttribute('record'))
				return;

			time = new Date().getTime();
			$('#page-main #button-record').setAttribute('record', true);
			$panel_recognition.setAttribute('mode', 'recognition');
			$compare.innerHTML = '';
			$recognition.innerHTML = '';
			$recognition.removeAttribute('confidence');

			chunks = [];
			userAudio = null;

			var dmp = new diff_match_patch();
			dmp.Diff_Timeout = parseFloat(100);	
			dmp.Diff_EditCost = parseFloat(4);

			mediaRecorder.start();

			recognition.lang = isMobile ? 'en-US' : 'en-UK';
			recognition.interimResults = false;
			recognition.continuous = false;

			recognition.onresult = function (event) {
				var res = event.results[0][0];

				var event = new MouseEvent('mouseup', {'which': 1});
				$('#page-main #button-record').dispatchEvent(event);

				var phrase = $('#page-main #phrase').textContent.trim();
				var transcript = (res.transcript || '').replace(/\d+/g, num2text);
				transcript = replaceHomophones(phrase, transcript);

				$recognition.innerHTML = transcript.split(' ').map((e) => '<span>' + e + '</span>').join(' ');
				$recognition.querySelectorAll('*').forEach((e) => e.addEventListener('click', (event) => speakText(event.target.textContent)));
				$recognition.setAttribute('confidence', (parseInt(res.confidence * 100) + '%'));

				var clear = (text) => text.replace(/[^\w\s]|_/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
				phrase = clear(phrase);
				transcript = clear(transcript);

				$panel_recognition.setAttribute('mode', (transcript.length || 0) < phrase.length * 0.7 || phrase == transcript ? 'recognition' : 'compare');

				var compare = '';
				if (phrase != transcript) {
					var d = dmp.diff_main(phrase, transcript);
					dmp.diff_cleanupEfficiency(d);
					compare = dmp.diff_prettyHtml(d);
				}
				
				$compare.innerHTML = compare;
				$recognition.setAttribute('correct', phrase == transcript);

				if (phrase == transcript && getOption('speech-auto-next') == 'yes')
					nextPhraseTimer = setTimeout(() => setPhrase(current_phrase_no + 1), 1500);

				if (phrase == transcript && getOption('speech-success-ring') == 'yes')
					$success.play();
			}

			recognition.onerror = function (event) {
				$panel_recognition.setAttribute('mode', 'recognition');
				$recognition.removeAttribute('confidence');
				$recognition.innerHTML = 'Error: ' + event.message;
			}	

			recognition.start();			
		}

		function stopRecord(event) {
			event.stopImmediatePropagation();

			if (event.type != 'touchend' && event.type == 'mouseup' && event.which != 1)
				return;

			if (new Date().getTime() - time < 300)
				return;

			if (mediaRecorder.state == 'recording')
				mediaRecorder.stop();
			$('#page-main #button-listen').removeAttribute('hidden');
			$('#page-main #button-record').removeAttribute('record');

			if (recognition)
				recognition.stop();

			setTimeout(function () {
				var blob = new Blob(chunks, {type : 'audio/ogg; codecs=opus'});
				var url = URL.createObjectURL(blob);
				userAudio = new Audio(url);
			}, 500);
		}

		$('#page-main #button-record').addEventListener('click', (event) => event.stopImmediatePropagation());
		$('#page-main #button-record').addEventListener(isMobile ? 'touchstart' : 'mousedown', startRecord);
		$('#page-main #button-record').addEventListener(isMobile ? 'touchend' : 'mouseup', stopRecord);
		$('#page-main #button-listen').addEventListener('click', function() {
			event.stopImmediatePropagation();
	
			if (!userAudio || !userAudio.duration)
				return;
	
			if (userAudio.paused)
				return userAudio.play();
	
			userAudio.pause();
			userAudio.currentTime = 0;			
		});

		$panel_recognition.addEventListener('click', function (event) {
			var mode = this.getAttribute('mode');
			this.setAttribute('mode', mode == 'recognition' && $compare.textContent.trim() ? 'compare' : 'recognition');
		})
	}).catch((err) => alert(err.message));

	function setPage(page) {
		$('audio', $e => $e.pause());
		$('.page', $e => $e.removeAttribute('current'));
		$('#page-' + page).setAttribute('current', true);
	}

	history.pushState({}, '', window.location.pathname);
	window.addEventListener('popstate', function(event) {
		var page = $('.page[current]');
		if (page.id == 'page-start')
			return history.back();

		history.pushState(null, null, window.location.pathname);
		if (page.id == 'page-main')
			return setPage('start');

		page.querySelector('.close').click();
	}, false);

	function $ (selector, apply) {
		return apply ? Array.prototype.slice.call(document.querySelectorAll(selector) || []).forEach(apply) : document.querySelector(selector);
	}

	// UTILS
	function parseTexts (data) {
		var texts = {};
		var deleted = (localStorage.getItem('speech-deleted-texts') || '').split(';');

		data += '===' + (localStorage.getItem('speech-user-texts') || '');
		data.split('===').forEach(function(text) {
			var e = {phrases: []};

			var header_mode = true;				
			text.split('\n').forEach(function (line, i) {					
				line = line.trim();

				if (!line && i == 0)	
					return;

				if (!line)
					header_mode = false;

				if (line && header_mode) 
					e[line.substr(0, line.indexOf(':')).trim()] = line.substr(line.indexOf(':') + 1).trim();
				else
					e.phrases.push(line);
			})
			
			e.text = (e.audio ? '<audio controls = "controls"><source src="' + e.audio + '"/></audio>' : '') + e.phrases.join('\n').trim();
			e.phrases = e.phrases.filter(e => !!e);

			if (e.id && e.phrases.length > 0 && e.name && deleted.indexOf(e.id) == -1)
				texts[e.id] = e;
		})

		return texts;
	}

	function parseHomophones(data) {
		var res = {};
		data.split('\n').map(e => e.split(';')).forEach(e => e.forEach(w => res[w] = e));
		return res;
	}
	
	function replaceHomophones (phrase, transcript) {
		var phrase_words = phrase.split(' ').map((w) => w.toLowerCase().replace(/(^\W*)|(\W*$)/g, ''));
		return transcript.split(' ').map(function(word, i) {
			var w = word.toLowerCase();
			var ws = homophones[w];
			if (!ws)
				return word;
	
			var check = (w) => i > 1 && phrase_words[i - 1] == w || phrase_words[i] == w || i + 1 < phrase_words.length && phrase_words[i + 1] == w
			for (var j = 0; j < ws.length; j++) {
				if (check(ws[j]))
					return ws[j];
			}
	
			return word;
		}).join(' ');
	}	
		
	var num = 'zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen'.split(' ');
	var tens = 'twenty thirty forty fifty sixty seventy eighty ninety'.split(' ');
	function num2text(n){
	    if (n < 20) return num[n];
	    var digit = n%10;
	    if (n < 100) return tens[~~(n/10)-2] + (digit? ' ' + num[digit]: '');
	    if (n < 1000) return num[~~(n/100)] +' hundred' + (n%100 == 0? '': ' ' + num2text(n%100));
	    return num2text(~~(n/1000)) + ' thousand' + (n%1000 != 0? ' ' + num2text(n%1000): '');
	}
});