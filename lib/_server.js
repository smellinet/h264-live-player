"use strict";


const WebSocket = require('ws');
const Splitter        = require('stream-split');
const merge           = require('mout/object/merge');

const NALseparator    = new Buffer([0,0,0,1]);//NAL break


class _Server {
  constructor(server, options) {

    this.options = merge({
        width : 1024,
        height: 768,
    }, options);

      this.wss = new WebSocket.Server({ server });
      
      this.new_client = this.new_client.bind(this);
      this.start_feed = this.start_feed.bind(this);
      this.broadcast  = this.broadcast.bind(this);
      
      this.wss.on('connection', this.new_client);
      this.readStream = null;
      this.headerStream = [];
  }
  

    start_feed() {
	if (this.readStream == null){
	    var readStream = this.get_feed();
	    
	    readStream = readStream.pipe(new Splitter(NALseparator));
	    readStream.on("data", this.broadcast);
	    this.readStream = readStream;
	    var self = this;
	    readStream.on("end",function() {
		console.log("End Stream");
		self.readStream = null;
		self.headerStream = [];
	    });
	    readStream.on("error",function() {
		console.log("Error Stream");
		self.stop_feed();
		self.readStream = null;
		self.headerStream = [];
	    });
	    
	}
    }

    get_feed() {
	throw new Error("to be implemented");
    }

    stop_feed() {
	throw new Error("to be implemented");
    }

    broadcast(data) {
	let dataToSend =Buffer.concat([NALseparator, data]);
	let self = this;

	//debug NAL
	var nalu = data[0];
	var nal_ref_idc = (nalu >> 5) & 0x03
	var nal_unit_type = nalu & 0x1f;
	//console.log("nal_ref_idc:"+nal_ref_idc+", nal_unit_type:"+nal_unit_type);

	
	if (nal_unit_type >= 6){ //NON-VCL UNIT
	    self.headerStream.push(dataToSend);
	    console.log("keep header :"+self.headerStream.length +" , size:"+dataToSend.length);
	} else {
	    self.wss.clients.forEach(function(socket) {
		if (socket.readyState == WebSocket.OPEN){
		    if(socket.paused){
			return;
		    }
		    if(socket.packetNoSend > 5){
			console.log("pass data");
			return;
		    }
		    
		    if (!socket.init){
			let shallowCopy = self.headerStream.slice();
			shallowCopy.push(dataToSend);
			dataToSend = Buffer.concat(shallowCopy);
			socket.init=true;
		    }
		    //console.log("send: "+ dataToSend.length);
		    socket.packetNoSend++;
		    socket.send(dataToSend, { binary: true}, function ack(error) {
			socket.packetNoSend--;
		    });
		}
	    });
	}
    }

  new_client(socket) {
  
    var self = this;
    console.log('New guy');

      socket.paused=true;
      socket.init=false;
      socket.packetNoSend=0;
      
    socket.send(JSON.stringify({
      action : "init",
      width  : this.options.width,
      height : this.options.height,
    }));

    socket.on("message", function(data){
      var cmd = "" + data, action = data.split(' ')[0];
      console.log("Incomming action '%s'", action);

	if(action == "REQUESTSTREAM"){
	    socket.paused=false;
            self.start_feed();
	} else if(action == "STOPSTREAM" && self.readStream != null){
	    socket.paused=true;
	}	    
    });

    socket.on('close', function() {
	if (self.readStream != null){
	    if (self.wss.clients.size == 0){
		self.stop_feed();
	    }
	}
	console.log('stopping client interval');
    });
  }


};


module.exports = _Server;
