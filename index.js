window.addEventListener('load', function() {
	var texts = {};

	var phrases = [];
	var phrase_no;

	var audioContext = typeof AudioContext !== 'undefined' ? new AudioContext() : null;
	var userAudio, textAudioBuffer;

	var isMobile = (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator && navigator.userAgent || ''));

	var $pages = {
		error: document.querySelector('#page-error'),
		text: document.querySelector('#page-text'),
		phrase: document.querySelector('#page-phrase'),
		voices: document.querySelector('#page-voices'), 
		help: document.querySelector('#page-help') 
	}	

	var $buttons = {
		continue: document.querySelector('#button-continue'),
		record: document.querySelector('#button-record'),
		listen: document.querySelector('#button-listen'),
		prev_phrase: document.querySelector('#button-prev-phrase'),
		next_phrase:document.querySelector('#button-next-phrase'),
		record: document.querySelector('#button-record'),
		help: document.querySelector('#button-help')
	}

	var $text = document.querySelector('#text');
	var $texts = document.querySelector('#texts');
	var $phrase = document.querySelector('#phrase');
	var $phrase_number = document.querySelector('#phrase-number');
	var $phrase_number_input = document.querySelector('#phrase-number-input');
	var $panel_phrase = document.querySelector('#panel-phrase');	
	var $voices = document.querySelector('#voices');
	var $voice_speed = document.querySelector('#voice-speed');
	var $panel_recognition = document.querySelector('#panel-recognition');	
	var $recognition = document.querySelector('#recognition');
	var $compare = document.querySelector('#compare');
	var $audio_compare = document.querySelector('#audio-compare');
	var $switch_mode = document.querySelector('#switch-mode');
	var $upload = document.querySelector('#upload');

	$pages.error.removeAttribute('error');
	if (typeof webkitSpeechRecognition == 'undefined')
		return $pages.error.setAttribute('error', 'speech-recognition');

	var AudioPlayer = {
		audio: null,
		timer: null,
		playing: false,
		play: function (url, from, to) {
			var audio = $text.querySelector('#audio-player');	
			if (!audio)
				return;
			
			AudioPlayer.stop();
			audio.onended = () => self.stop();

			if (audio.readyState) 
				audio.currentTime = from || 0;
			else 
				audio.oncanplay = () => (audio.oncanplay = null) && (audio.currentTime = from || 0);

			to = to || audio.duration || 1;
			this.timer = setTimeout(() => AudioPlayer.stop(), (to - from) * 1000);
			audio.play();
			this.playing = true;
			this.audio = audio;
		},
		stop: function () {
			if (this.audio && !this.audio.paused)
				this.audio.pause();
				
			clearTimeout(this.timer);
			this.playing = false;
		} 
	}	

	TEXTS.forEach((e) => e.text = e.text.split('\n').map((e2) => e2.trim()).join('\n'));
	TEXTS.push({id: 'custom', name: 'Your text', text: localStorage.getItem('custom') || 'Input any text: one line is one phrase.'})
	TEXTS.push({id: 'upload', name: 'Load from file...'});
	
	TEXTS.forEach(function (e, i) {
		var $option = document.createElement('option');
		$option.setAttribute('value', e.id);
		$option.innerHTML = e.name;
		$texts.appendChild($option);

		texts[e.id] = e;
	});

	function loadFile() {
		var file = $upload.files[0];
		if (!file) 
			return;
		
		var reader = new FileReader();
		reader.onload = function(event) {
			texts.custom.text = event.target.result;
			$texts.dispatchEvent(new Event('change'));
		};
		reader.readAsText(file);
	}
	$upload.addEventListener('change', loadFile, false);

	$texts.addEventListener('change', function (event) {
		var e = texts[this.value];
		$text.innerHTML = '';

		if (e.id == 'upload') {
			$texts.value = 'custom';
			$texts.dispatchEvent(new Event('change'));
			return $upload.click();
		}

		if (e.audio)
			$text.innerHTML += '<audio id = "audio-player" controls = "controls"><source src="' + e.audio + '"/></audio>';
		
		$text.innerHTML += e.text;
		$text.setAttribute('contenteditable', e.id == 'custom');
	});
	$texts.value = localStorage.getItem('text-id') || $texts.children[0].value;
	$texts.dispatchEvent(new Event('change'));

	$phrase.addEventListener('click', function () {
		var text = texts[$texts.value];
		if (!text.audio || !text.timemarks) 
			return $voices.querySelector('*[current="true"]').dispatchEvent(new Event('click'));

		if (AudioPlayer.playing)	
			return AudioPlayer.stop();
		
		AudioPlayer.play(text.audio, text.timemarks[phrase_no], text.timemarks[phrase_no + 1]);
	});

	if (isMobile) {
		$phrase_number_input.setAttribute('type', 'number');
		$phrase.addEventListener('contextmenu', function (event) {
			event.stopImmediatePropagation();
			showPage('voices');
		});
		var $panel = $pages.phrase.querySelector('#panel-voices');
		$pages.voices.appendChild($panel);

		$phrase_number_input.addEventListener('focus', function () {
			$panel_phrase.style.display = 'none';
			$panel_recognition.style.display = 'none';
		});

		$phrase_number_input.addEventListener('blur', function () {
			$panel_phrase.style.display = 'block';
			$panel_recognition.style.display = 'block';
		});

		var touch = {start: 0, end: 0};
		$panel_recognition.addEventListener('touchstart', (event) => touch.start = event.changedTouches[0].screenX, false);
		$panel_recognition.addEventListener('touchend', function (event) {
			touch.end = event.changedTouches[0].screenX;
				
			if (Math.abs(touch.start - touch.end) > 20)
			    setPhrase(phrase_no + (touch.start < touch.end ? -1 : 1));
		})
	}
   
	$phrase_number.addEventListener('click', function () {
		$phrase_number_input.value = phrase_no + 1;
		$phrase_number_input.focus();
	});

	$phrase_number_input.addEventListener('keypress', function (event) {
  		if (event.keyCode == 13 && !isNaN(this.value)) 	
			setPhrase(this.value - 1);
	});

	function setPhrase(no) {
		if (phrase_no == no && $phrase.textContent == phrases[phrase_no])
			return;	

		if (no < 0)
			return setPhrase(0);

		if (no > phrases.length - 1)
			return setPhrase(phrases.length - 1);

		$pages.phrase.style.display = 'block';
		$phrase.innerHTML = phrases[no].split(' ').map((e) => e.indexOf('<') == -1 ? '<span>' + e + '</span>' : e).join(' ');
		$phrase.querySelectorAll('*').forEach((e) => e.addEventListener('click', speakWord));
		$phrase_number.innerHTML = (no + 1) + '/' + phrases.length;
		$buttons.prev_phrase.style.visibility = no == 0 ? 'hidden' : 'visible';
		$buttons.next_phrase.style.visibility = no == phrases.length - 1 ? 'hidden' : 'visible';
		$voice_speed.value = localStorage.getItem('voice-speed') || 1;
		$panel_recognition.removeAttribute('mode');	
		$recognition.innerHTML = '';
		$recognition.removeAttribute('correct');
		$recognition.removeAttribute('confidence');
		$compare.innerHTML = '';
		$buttons.listen.setAttribute('hidden', true);
		$buttons.record.removeAttribute('record');
		$phrase_number_input.blur();

		phrase_no = no;
	}

	function speakWord (event) {
		event.stopImmediatePropagation();
		var evt = new CustomEvent('speak-text', {detail: this.textContent});
		document.dispatchEvent(evt);
	}

	$buttons.continue.addEventListener('click', function () {
		var id = $texts.value;
		var e = texts[id];
		localStorage.setItem('text-id', id);
			
		if (id == 'custom') {
			var customText = $text.innerText.split('\n').map((e2) => e2.trim()).join('\n');
			localStorage.setItem('custom', customText);
			texts.custom.text = customText;	
		}

		if (e.audio)
			$text.querySelector('audio').pause(); 

		if (audioContext && e.audio && e.timemarks) {
			var request = new XMLHttpRequest();
			request.open('GET', e.audio, true);
			request.responseType = 'arraybuffer';
			request.onload = () => audioContext.decodeAudioData(request.response, (buffer) => textAudioBuffer = buffer);
			request.send();
		} else 
			textAudioBuffer = null;

		phrases = texts[id].text.split('\n').map((e) => e.trim()).filter((e) => !!e);
		showPage('phrase');
		$pages.phrase.querySelector('#caption').innerHTML = texts[id].name;
		setPhrase(0);
	});

	if (typeof speechSynthesis !== 'undefined') {
		var voices = [];
		var current_voice = localStorage.getItem('voice');
		$voice_speed.addEventListener('input', (event) => localStorage.setItem('voice-speed', event.target.value));

		document.addEventListener('speak-text', (event) => speakText(event.detail));

		function speakText(text) {
			var utterance = new SpeechSynthesisUtterance(text);
			utterance.voice = voices[current_voice];
			utterance.rate = $voice_speed.value || 1;
			speechSynthesis.speak(utterance);
		};

		function loadVoices () {
			$voices.innerHTML = '';
			voices = window.speechSynthesis.getVoices();
			voices.forEach(function(e, i) {
				if (e.lang.indexOf('en') == 0 && (e.lang.indexOf('US') != -1 || e.lang.indexOf('UK') != -1 || e.lang.indexOf('GB') != -1)) {
					var $voice = document.createElement('div');
					$voice.setAttribute('class', 'button speak');
					$voice.setAttribute('current', i == current_voice);
					$voice.setAttribute('voice', i);
					$voice.setAttribute('title', e.name);
					$voice.innerHTML = '&#1010' + ($voices.children.length + 2) + ';'; 
					$voices.appendChild($voice);
				}	
			});

			if (!$voices.querySelector('*[current="true"]') && $voices.children.length > 0) {
				var $e = $voices.children[0];
				$e.setAttribute('current', true);
				current_voice = $e.getAttribute('voice');
			}
			
			for (var i = 0; i < $voices.children.length; i++) 
				$voices.children[i].addEventListener('click', function (event) {
					var voice = this.getAttribute('voice');
					if (current_voice == voice) 
						return speechSynthesis.speaking ? speechSynthesis.cancel() : speakText($phrase.textContent);
					
					$voices.querySelector('*[current="true"]').removeAttribute('current');
					$voices.querySelector('*[voice="' + voice + '"]').setAttribute('current', true);	

					current_voice = voice;
					localStorage.setItem('voice', voice);
					speakText($phrase.textContent);
				});
		}
		
		loadVoices();
		if (speechSynthesis.onvoiceschanged !== undefined) {
			speechSynthesis.onvoiceschanged = loadVoices;
		}
	}
	
	$buttons.listen.addEventListener('click', function (event) {
		event.stopImmediatePropagation();

		if (!userAudio || !userAudio.duration)
			return;

		if (userAudio.paused)
			return userAudio.play();

		userAudio.pause();
		userAudio.currentTime = 0;
	});

	function showPage(page) {
		for (var p in $pages)
			$pages[p].style.display = 'none';

		$pages[page].style.display = 'block';
		AudioPlayer.stop();
	}
	
	document.querySelectorAll('.close').forEach(function ($e) {
		var back = $e.getAttribute('back') || 'text';
		$e.addEventListener('click', () => showPage(back));
	});

	history.pushState({}, '', window.location.pathname);
	window.addEventListener('popstate', function(event) {
		if ($pages.text.style.display == 'block')
			return history.back();

		if ($pages.voices.style.display == 'block')
			return showPage('phrase');

		history.pushState(null, null, window.location.pathname);
		showPage('text');
	}, false);

	$buttons.prev_phrase.addEventListener('click', () => setPhrase(phrase_no - 1));
	$buttons.next_phrase.addEventListener('click', () => setPhrase(phrase_no + 1));

	$buttons.help.addEventListener('click', () => showPage('help'));
	
	navigator.mediaDevices.getUserMedia({audio: true}).then (function (stream) {
		showPage('text');		
 			
		var recognition = new webkitSpeechRecognition();
		var chunks;

		var mediaRecorder = new MediaRecorder(stream);
		mediaRecorder.addEventListener('dataavailable', event => chunks.push(event.data));

		var time;

		function startRecord(event) {
			event.stopImmediatePropagation();

			if (event.type != 'touchstart' && event.type == 'mousedown' && event.which != 1)
				return;

			if ($buttons.record.hasAttribute('record'))
				return;

			time = new Date().getTime();
			$buttons.record.setAttribute('record', true);
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

				var phrase = $phrase.textContent.trim();
				var transcript = (res.transcript || '').replace(/\d+/g, num2text);
				transcript = homophones.replace(phrase, transcript);

				$recognition.innerHTML = transcript.split(' ').map((e) => '<span>' + e + '</span>').join(' ');
				$recognition.querySelectorAll('*').forEach((e) => e.addEventListener('click', speakWord));
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

			mediaRecorder.stop();
			$buttons.listen.removeAttribute('hidden');
			$buttons.record.removeAttribute('record');

			if (recognition)
				recognition.stop();

			setTimeout(function () {
				var blob = new Blob(chunks, {type : 'audio/ogg; codecs=opus'});
				var url = URL.createObjectURL(blob);
				userAudio = new Audio(url);

				if (audioContext && textAudioBuffer) {
					var $canvas = $audio_compare.querySelector('canvas');
					var h = Math.min($panel_recognition.offsetHeight, 100);
					var w = $panel_recognition.offsetWidth;
					$canvas.width = w;
					$canvas.height = h;
					var ctx = $canvas.getContext('2d');
					ctx.clearRect(0, 0, w, h);
					var tms = texts[$texts.value].timemarks;

					function drawAudioBuffer(buffer, is_text) {
						var data = buffer.getChannelData(0);

						var from = is_text ? buffer.sampleRate * tms[phrase_no] : 0.3 * buffer.sampleRate;
						var to = is_text && buffer.sampleRate * tms[phrase_no + 1] || (data.length - 1);
						data = data.slice(from, to);
	
						var min = Math.min(...data);
						var max = Math.max(...data);
						data = data.map((e) => (e - min) * 2/ (max - min) - 1)

						// remove silence
						from = data.findIndex((e) => e > 0.25);
						to = data.length - 1;
						while(data[to] < 0.25 && to > 0)
							to--;
						data = data.slice(from, to);
				
						ctx.strokeStyle = is_text ? '#bbb' : 'rgba(0, 0, 255, 0.3)';
				
						var step = Math.ceil(data.length / w) ;
						var pos = is_text ? h * 0.25 : h * 0.75;
						ctx.beginPath();
						for (var i = 0; i < w; i++) {
							var chunk = data.slice(i * step, (i + 1) * step);	
							ctx.moveTo(i, pos - Math.min(...chunk) * h / 4);
							ctx.lineTo(i, pos - Math.max(...chunk) * h / 4);
						}
						ctx.stroke();
					}

					fetch(url)
						.then(response => response.arrayBuffer())
						.then(arrayBuffer => audioContext.decodeAudioData(arrayBuffer))
						.then(buffer => drawAudioBuffer(textAudioBuffer, true) || drawAudioBuffer(buffer));
				}
			}, 500);
		}

		$buttons.record.addEventListener('click', (event) => event.stopImmediatePropagation());
		$buttons.record.addEventListener(isMobile ? 'touchstart' : 'mousedown', startRecord);
		$buttons.record.addEventListener(isMobile ? 'touchend' : 'mouseup', stopRecord);

		$panel_recognition.addEventListener('click', function (event) {
			var mode = this.getAttribute('mode');
			this.setAttribute('mode', 
				mode == 'recognition' && $compare.textContent.trim() ? 'compare' :
				mode == 'recognition' && !$compare.textContent.trim() && textAudioBuffer ? 'audio-compare' :
				'recognition');
		})
	}).catch((err) => $pages.error.setAttribute('error', 'microphone'));

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