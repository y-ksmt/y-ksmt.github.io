(function(window){

  var WORKER_PATH = 'js/recorderWorker.js';
  var encoderWorker = new Worker('js/mp3Worker.js');

  var Recorder = function(source, cfg){
    var config = cfg || {};
    var bufferLen = config.bufferLen || 4096;
    var numChannels = config.numChannels || 2;
    this.context = source.context;
    this.node = (this.context.createScriptProcessor ||
                 this.context.createJavaScriptNode).call(this.context,
                 bufferLen, numChannels, numChannels);
    var worker = new Worker(config.workerPath || WORKER_PATH);
    worker.postMessage({
      command: 'init',
      config: {
        sampleRate: this.context.sampleRate,
        numChannels: numChannels
      }
    });
    var recording = false,
    currCallback;

    this.node.onaudioprocess = function(e){
      if (!recording) return;
      var buffer = [];
      for (var channel = 0; channel < numChannels; channel++){
          buffer.push(e.inputBuffer.getChannelData(channel));
      }
      worker.postMessage({
        command: 'record',
        buffer: buffer
			});
    }

    this.configure = function(cfg){
      for (var prop in cfg){
        if (cfg.hasOwnProperty(prop)){
          config[prop] = cfg[prop];
        }
			}
			console.log("--this.configure");
    }

    this.record = function(){
			recording = true;
			console.log("--this.record");
    }

    this.stop = function(){
			recording = false;
			console.log("--this.stop");
    }

    this.clear = function(){
			worker.postMessage({ command: 'clear' });
			console.log("--this.clear");
    }

    this.getBuffer = function(cb) {
      currCallback = cb || config.callback;
			worker.postMessage({ command: 'getBuffer' })
			console.log("--this.getBuffer");
    }

    this.exportWAV = function(cb, type){
      currCallback = cb || config.callback;
      type = type || config.type || 'audio/wav';
      if (!currCallback) throw new Error('Callback not set');
      worker.postMessage({
        command: 'exportWAV',
        type: type
			});
			console.log("--this.exportWAV");
		}

		//Mp3 conversion
    worker.onmessage = function(e){
			console.log("--worker.onmessage start");
      var blob = e.data;
	  	console.log("the blob " +  blob + " " + blob.size + " " + blob.type);

	  	var arrayBuffer;
	  	var fileReader = new FileReader();

	  	fileReader.onload = function(){
				arrayBuffer = this.result;
				var buffer = new Uint8Array(arrayBuffer),
						data = parseWav(buffer);

				console.log(data);
				console.log("Converting to Mp3");
				log.innerHTML += "\n" + "Converting to Mp3";

				encoderWorker.postMessage({ cmd: 'init', config:{
					mode : 3,
					channels:1,
					samplerate: data.sampleRate,
					bitrate: data.bitsPerSample
				}});
				console.log("--encoderWorker.postMessage:init");

				encoderWorker.postMessage({ cmd: 'encode', buf: Uint8ArrayToFloat32Array(data.samples) });
				console.log("--encoderWorker.postMessage:encode");

				encoderWorker.postMessage({ cmd: 'finish'});
				console.log("--encoderWorker.postMessage:finish");

				console.log("--encoderWorker.onmessage start");
				encoderWorker.onmessage = function(e) {
					console.log("--encoderWorker.onmessage 1");
					if (e.data.cmd == 'data') {
						console.log("Done converting to Mp3");
						log.innerHTML += "\n" + "Done converting to Mp3";

						/*var audio = new Audio();
						audio.src = 'data:audio/mp3;base64,'+encode64(e.data.buf);
						audio.play();*/
						//console.log ("The Mp3 data " + e.data.buf);

						var mp3Blob = new Blob([new Uint8Array(e.data.buf)], {type: 'audio/mp3'});
						uploadAudio(mp3Blob);

						var url = 'data:audio/mp3;base64,'+encode64(e.data.buf);
						var li = document.createElement('li');
						var au = document.createElement('audio');
						var hf = document.createElement('a');

						au.controls = true;
						au.src = url;
						hf.href = url;
						hf.download = 'audio_recording_' + new Date().getTime() + '.mp3';
						hf.innerHTML = hf.download;
						li.appendChild(au);
						li.appendChild(hf);
						recordingslist.appendChild(li);
					}
					console.log("--encoderWorker.onmessage 2");
				};
				console.log("--encoderWorker.onmessage end");
	  	};

			console.log("----fileReader.readAsArrayBuffer(blob) start");
			fileReader.readAsArrayBuffer(blob);
			console.log("----fileReader.readAsArrayBuffer(blob) end");

			console.log("----currCallback(blob) start");
			currCallback(blob);
			console.log("----currCallback(blob) end");
			
			console.log("--worker.onmessage end");
    }

		function encode64(buffer) {
			var binary = '',
				bytes = new Uint8Array( buffer ),
				len = bytes.byteLength;

			for (var i = 0; i < len; i++) {
				binary += String.fromCharCode( bytes[ i ] );
			}
			return window.btoa( binary );
		}

		function parseWav(wav) {
			function readInt(i, bytes) {
				var ret = 0,
					shft = 0;

				while (bytes) {
					ret += wav[i] << shft;
					shft += 8;
					i++;
					bytes--;
				}
				return ret;
			}
			if (readInt(20, 2) != 1) throw 'Invalid compression code, not PCM';
			if (readInt(22, 2) != 1) throw 'Invalid number of channels, not 1';
			return {
				sampleRate: readInt(24, 4),
				bitsPerSample: readInt(34, 2),
				samples: wav.subarray(44)
			};
		}

		function Uint8ArrayToFloat32Array(u8a){
			var f32Buffer = new Float32Array(u8a.length);
			for (var i = 0; i < u8a.length; i++) {
				var value = u8a[i<<1] + (u8a[(i<<1)+1]<<8);
				if (value >= 0x8000) value |= ~0x7FFF;
				f32Buffer[i] = value / 0x8000;
			}
			return f32Buffer;
		}

		function uploadAudio(mp3Data){
			var reader = new FileReader();
			reader.onload = function(event){
				var fd = new FormData();
				var mp3Name = encodeURIComponent('audio_recording_' + new Date().getTime() + '.mp3');
				console.log("mp3name = " + mp3Name);
				fd.append('fname', mp3Name);
				fd.append('data', event.target.result);
				$.ajax({
					type: 'POST',
					url: 'upload.php',
					data: fd,
					processData: false,
					contentType: false
				}).done(function(data) {
					//console.log(data);
					log.innerHTML += "\n" + data;
				});
			};
			reader.readAsDataURL(mp3Data);
		}

    source.connect(this.node);
    this.node.connect(this.context.destination);    //this should not be necessary
  };

  /*Recorder.forceDownload = function(blob, filename){
	console.log("Force download");
    var url = (window.URL || window.webkitURL).createObjectURL(blob);
    var link = window.document.createElement('a');
    link.href = url;
    link.download = filename || 'output.wav';
    var click = document.createEvent("Event");
    click.initEvent("click", true, true);
    link.dispatchEvent(click);
  }*/

  window.Recorder = Recorder;

})(window);
