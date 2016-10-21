// Originally written by Felix Turner @felixturner
// Modified by Matthew Chiang

var AudioHandler = function() {

	var waveData = []; //waveform - from 0 - 1. no sound is 0.5. Array [binCount]
	var levelsData = []; //levels of each frequency - from 0 - 1. no sound is 0. Array [levelsCount]
	var level = 0; // averaged normalized level from 0-1
	var bpmTime = 0; // bpmTime ranges from 0 to 1. 0 = on beat. Based on tap bpm
	var ratedBPMTime = 550; // time between beats (msec) multiplied by BPMRate
	var levelHistory = []; // last 256 ave norm levels
	var bpmStart = 0;

	// var sampleAudioURL;
	var BEAT_HOLD_TIME = 40; // num of frames to hold a beat
	var BEAT_DECAY_RATE = 0.98;
	var BEAT_MIN = 0.2; // a volume less than this is no beat

	// BPM STUFF
	var count = 0;
	var msecsFirst = 0;
	var msecsPrevious = 0;
	var msecsAvg = 633; // time between beats (msec)

	var timer;
	var gotBeat = false;
	var beatCutOff = 0;
	var beatTime = 0;

	var freqByteData; // bars - bar data is from 0-256 in 512 bins. no sound is 0.
	var timeByteData; // waveform - waveform data is 0-256 for 512 bins. no sound is 128.
	var levelsCount = 16; // should be a factor of 512

	var binCount; // 512
	var levelBins;

	var isPlayingAudio = false;

	var source;
	var buffer;
	var audioBuffer;
	var dropArea;
	var audioContext;
	var analyser;

	// Canvas variables
	var fps = 25;
	var now;
	var then = Date.now();
	var interval = 1000/fps;
	var delta;
	var circles = [];

	function init() {

		// EVENT HANDLERS
		events.on("update", update);

		// Create the audio context and analyser
		audioContext = new window.AudioContext();
		analyser = audioContext.createAnalyser();
		analyser.smoothingTimeConstant = 0.8; // 0 <-> 1. 0 is no time smoothing
		analyser.fftSize = 1024;
		analyser.connect(audioContext.destination);
		binCount = analyser.frequencyBinCount; // = 512

		levelBins = Math.floor(binCount / levelsCount); // number of bins in each level

		freqByteData = new Uint8Array(binCount);
		timeByteData = new Uint8Array(binCount);

		var length = 256;
		for (var i = 0; i < length; i++) {
			levelHistory.push(0);
		}

	}

	function initSound() {
		source = audioContext.createBufferSource();
		analyser = audioContext.createAnalyser();
		analyser.smoothingTimeConstant = 0.8; // 0 <-> 1. 0 is no time smoothing
		analyser.fftSize = 1024;
		analyser.connect(audioContext.destination);
		source.connect(analyser);
	}

	// load sample MP3
	function loadSampleAudio() {
		stopSound();

		initSound();

		// Load the sample song asynchronously
		var request = new XMLHttpRequest();
		request.open("GET", ControlsHandler.audioParams.sampleURL, true);
		request.responseType = "arraybuffer";

		// When loaded, decode the song's data
		request.onload = function() {
			audioContext.decodeAudioData(request.response, function(buffer) {
				audioBuffer = buffer;
				startSound();
			}, function(e) {
				console.log(e);
				alert("error in requesting the sample");
			});
		};
		request.send();
	}

	function onTogglePlay() {

		if (ControlsHandler.audioParams.play) { // where is this .play from?
			startSound();
		} else {
			stopSound();
		}
	}

	function startSound() {
		source.buffer = audioBuffer;
		source.loop = true;
		source.start(0.0);
		isPlayingAudio = true;
	}

	function stopSound() {
		isPlayingAudio = false;
		if (source) {
			// source.stop();
			source.disconnect(); // what does disconnect with no parameters do?
		}
	}

	function onUseMic() {
		// console.log("onUseMic:" + ControlsHandler.audioParams.useMic);
		if (ControlsHandler.audioParams.useMic) {
			ControlsHandler.audioParams.useSample = false;
			getMicInput();
		} else {
			ControlsHandler.audioParams.useSample = true;
			onUseSample(); //
		}
	}

	function onUseSample() {
		if (ControlsHandler.audioParams.useSample) {
			loadSampleAudio();
		} else {
			stopSound();
		}
	}

	// load dropped MP3
	function onMP3Drop(evt) {

		// TODO - uncheck mic and sample in CP
		ControlsHandler.audioParams.useSample = false;
		ControlsHandler.audioParams.useMic = false;
		// console.log("onMP3Drop:" + ControlsHandler.audioParams.useMic);

		stopSound();

		initSound();

		/* woah, what's goin on here?
		*/
		var droppedFiles = evt.dataTransfer.files;
		var reader = new FileReader();
		reader.onload = function(fileEvent) {
			var data = fileEvent.target.result;
			onDroppedMP3Loaded(data);
		};
		reader.readAsArrayBuffer(droppedFiles[0]);
	}

	// called from dropped MP3
	function onDroppedMP3Loaded(data) {

		if (audioContext.decodeAudioData) {
			audioContext.decodeAudioData(data, function(buffer) {
				audioBuffer = buffer;
				startSound();
			}, function(e) {
				console.log(e);
			});
		} else {
			audioBuffer = audioContext.createBuffer(data, false);
			startSound();
		}
	}

	function getMicInput() {

		stopSound();

		// x-browser (look into getting mic user input)
		navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia;

		if (navigator.getUserMedia) {

			navigator.getUserMedia(

				{audio: true},

				function(stream) {

					//re-init here or get an echo on the mic
					source = audioContext.createBufferSource();
					analyser = audioContext.createAnalyser();
					analyser.fftSize = 1024;
					analyser.smoothingTimeConstant = 0.3;

					microphone = audioContext.createMediaStreamSource(stream);
					microphone.connect(analyser);
					isPlayingAudio = true;
				},

				// errorCallback
				function(err) {
					alert("The following error occurred: " + err);
				}
			);
		} else {
			alert("Could not getUserMedia");
		}
	}

	function onBeat() {
		gotBeat = true;
		if (ControlsHandler.audioParams.bpmMode) return;
		events.emit("onBeat");
	}

	// called every frame
	// update published viz data
	function update() {

		if (!isPlayingAudio) {
			return;
		}

		// GET DATA
		analyser.getByteFrequencyData(freqByteData); // bar chart. Lower bins refer to lower frequency intervals (~86 Hz)
		analyser.getByteTimeDomainData(timeByteData); // waveform

		// console.log(freqByteData);
		//normalize waveform data (add constant volume gain)
		for (var i = 0; i < binCount; i++) {
			waveData[i] = ((timeByteData[i] - 128) / 128) * ControlsHandler.audioParams.volSens;
		}

		//TODO - cap levels at 1 and -1?

		//normalize levelsData from freqByteData
		for (var i = 0; i < levelsCount; i++) {
			var sum = 0;
			for (var j = 0; j < levelBins; j++) {
				sum += freqByteData[(i * levelBins) + j];
			}
			levelsData[i] = sum / levelBins/256 * ControlsHandler.audioParams.volSens; // freqData maxes at 256
			// sum of bins per level, then divide by bins per level and 256, the frequency max

			// adjust for the fact that lower levels are perceived more quietly
			// make lower levels smaller
			// levelsData[i] *= 1 + (i/levelsCount)/2;
		}

		//TODO - cap levels at 1?

		// GET AVG LEVEL volume
		var sum = 0;
		for (var j = 0; j < levelsCount; j++) {
			sum += levelsData[j];
		}

		level = sum / levelsCount;

		levelHistory.push(level);
		levelHistory.shift(1);
		// BEAT DETECTION
		if (level > beatCutOff && level > BEAT_MIN) {
			onBeat();
			// console.log("onBeat");
			beatCutOff = level * 1.1;
			beatTime = 0;
		} else {
			if (beatTime <= ControlsHandler.audioParams.beatHoldTime) {
				beatTime++;
			} else {
				beatCutOff *= ControlsHandler.audioParams.beatDecayRate;
				beatCutOff = Math.max(beatCutOff, BEAT_MIN);
			}
		}

		bpmTime = (new Date().getTime() - bpmStart)/msecsAvg;
		// trace (bpmStart);
		makeWeightedFreqByteData();
	}

	function getLevel() {
		// console.log(level);
		return level;
	}

	function getFreqByteData() {
		// console.log(freqByteData);
		return freqByteData;
	}

	/*
		Source: http://greenboy.us/fEARful/frequencytables.htm
		Audio Context sample rate: 44100Hz so each bin is ~86Hz
		Bass: 0-250Hz so first 3 bins
		Mid: 250 to 2000Hz so 4th to 24th bins
		Treble: 2000Hz+ so 25th bin and on

		Returns a single value
	 */
	function makeWeightedFreqByteData() {
		var arr = getFreqByteData();
		var sum = 0;

		// Give more weight to lower bass frequencies since they are harder to hear
		for (var i = 0; i < 3; i++) {
			sum += arr[i] * .001;
		}
		for (var i = 3; i < 24; i++) {
			// sum += arr[i] * .0001;
		}
		for (var i = 25; i < arr.length; i++) {
			// sum += arr[i] * 0.05;
		}
		var result = sum / arr.length * ControlsHandler.audioParams.volSens;
		// console.log(result);
		return result;
	}

	return {
		onMP3Drop: onMP3Drop,
		onUseMic:onUseMic,
		onUseSample:onUseSample,
		update:update,
		init:init,
		getLevel: getLevel,
		getWeightedFreqByteData: makeWeightedFreqByteData,
		onTogglePlay:onTogglePlay
	};
}();