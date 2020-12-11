"use strict";

const util      = require('util');
const spawn     = require('child_process').spawn;
const merge     = require('mout/object/merge');

const Server    = require('./_server');


class RpiServer extends Server {

    constructor(server, opts) {
	super(server, merge({
	    fps : 12,
	}, opts));
    }

    get_feed() {
	var msk = "raspivid -t 0 -o - -w %d -h %d -fps %d";
	var cmd = util.format(msk, this.options.width, this.options.height, this.options.fps);
	console.log(cmd);
	this.raspiProcess = spawn('raspivid', ['-t', '0', '-ISO', '800','-b', '800000','-o', '-', '-w', this.options.width, '-h', this.options.height, '-fps', this.options.fps, '-pf', 'baseline']);
	this.raspiProcess.on("exit", function(code,signal){
	    console.log("Exit Code ", code);
	    console.log("Signal ", signal);
	    this.raspiProcess = null;
	});

	return this.raspiProcess.stdout;
    }
    stop_feed() {
	if (this.raspiProcess != null){
	    this.raspiProcess.kill();
	}
    }

};



module.exports = RpiServer;
