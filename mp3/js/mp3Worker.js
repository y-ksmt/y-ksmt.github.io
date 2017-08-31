importScripts('libmp3lame.min.js');

var mp3codec;

self.onmessage = function(e) {
	console.log("--self.onmessage start");
	switch (e.data.cmd) {
	case 'init':
		console.log("----self.onmessage init start");
		if (!e.data.config) {
			e.data.config = { };
		}
		mp3codec = Lame.init();

		Lame.set_mode(mp3codec, e.data.config.mode || Lame.JOINT_STEREO);
		Lame.set_num_channels(mp3codec, e.data.config.channels || 2);
		Lame.set_num_samples(mp3codec, e.data.config.samples || -1);
		Lame.set_in_samplerate(mp3codec, e.data.config.samplerate || 44100);
		Lame.set_out_samplerate(mp3codec, e.data.config.samplerate || 44100);
		Lame.set_bitrate(mp3codec, e.data.config.bitrate || 128);

		Lame.init_params(mp3codec);
		console.log('Version :', Lame.get_version() + ' / ',
			'Mode: '+Lame.get_mode(mp3codec) + ' / ',
			'Samples: '+Lame.get_num_samples(mp3codec) + ' / ',
			'Channels: '+Lame.get_num_channels(mp3codec) + ' / ',
			'Input Samplate: '+ Lame.get_in_samplerate(mp3codec) + ' / ',
			'Output Samplate: '+ Lame.get_in_samplerate(mp3codec) + ' / ',
			'Bitlate :' +Lame.get_bitrate(mp3codec) + ' / ',
			'VBR :' + Lame.get_VBR(mp3codec));
		console.log("----self.onmessage init end");
		break;
	case 'encode':
		console.log("----self.onmessage encode start");
		console.log(mp3codec);
		console.log(e.data.buf);
		console.log(e.data.buf);
		console.log("----self.onmessage encode 1 次でout of memory発生");
		var mp3data = Lame.encode_buffer_ieee_float(mp3codec, e.data.buf, e.data.buf);
		console.log("----self.onmessage encode 2");
		self.postMessage({cmd: 'data', buf: mp3data.data});
		console.log("----self.onmessage encode end");
		break;
	case 'finish':
		console.log("----self.onmessage finish start");
		var mp3data = Lame.encode_flush(mp3codec);
		self.postMessage({cmd: 'end', buf: mp3data.data});
		Lame.close(mp3codec);
		mp3codec = null;
		console.log("----self.onmessage finish end");
		break;
	}
	console.log("--self.onmessage end");
};