const express  = require('express');
const app = express();
const http = require('http').Server(app);
const fileUpload = require('express-fileupload');
const fs = require('fs');
const bodyParser = require('body-parser');
const io = require('socket.io')(http,{
	cookie: true
});
//const sock = require('socket.io');
const pth = require('path');
const debug = false;

var file = {
    name: "",
    mv : "",
    mimetype : "",
    data : "",
    client_id:"",
	eva:null
};

var eva;

// default options
app.use(fileUpload());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Index.html and other js and css files
app.use(express.static(pth.join(__dirname,"/../client")));
app.get("/",function(req,res){
	res.set('Content-Type', 'text/html');
    	res.sendFile(pth.join(__dirname+"/index.html"));
	res.set('Content-Type', 'text/javascript');
	res.sendFile(pth.join(__dirname+"/default.js"));
	res.sendFile(pth.join(__dirname+"/narrow.js"));
	res.setHeader('Content-Type', 'text/css');
	res.sendFile(pth.join(__dirname+"/index.css"));
});


// On Upload
app.post('/upload', function(req, res) {
    if (!req.files){
		if(req.body){
			var t;
			var tighttext = req.body.tight_form_text;
			var lines = tighttext.split('\n');
			var u = '';
			for (s = 0; s < lines.length; s++){
				
				try {t = eval('(function(){'+lines[s]+'}())'); u = u + t + '\n';} catch(err){return res.status(400).send(err);}
			}
			
			var tight_json = split_lines(u);
			fs.writeFile("tmp/"+req.body.tight_form_id, tight_json, function(err) {
				if(err) {
					return console.log(err);
				}

				if(debug) console.log("The file "+req.body.tight_form_id+" was saved!");
			}); 
		} else 
			return res.status(400).send('No files were uploaded nor any input was given.');
	} else {
		// The name of the input field (i.e. "sampleFile") is used to retrieve the uploaded file
		//console.log(req.body.fileName);
		let sampleFile = req.files.sampleFile;
		if(debug) console.log(sampleFile);
		

		if(debug) console.log("file uploaded: "+ sampleFile.name);
		// Use the mv() method to place the file somewhere on your server
		var newFileName = 'tmp/'+req.body.fileName;//req.files.sampleFile.name;
		sampleFile.mv(newFileName, function(err) {
			if (err)
				return res.status(500).send(err);
			file.name = req.body.fileName;//req.files.sampleFile.name;
			file.mv = req.files.sampleFile.mv;
			file.mimetype = req.files.sampleFile.mimetype;
			file.data = req.files.sampleFile.data;
			//file.eva = eval('('+file.data+')');
			//console.log(file.eva.signal.length);
			//eva = eval('('+file.data+')');
			//console.log("Signal Length"+eva.signal.length);
			//res.send('File '+newFileName+' uploaded!\n'+file.data);
		});
	}
	res.writeHead(302,{'Location':'index.html'});
	res.end();
});

// On client connect
io.on('connection',function(socket){
	console.log("A User connected " + socket.id);
	socket.emit('initdata', socket.id);
	socket.on('disconnect',function(){
	   console.log('A User disconnected');
        });
	var k;

//On client sent data
	socket.on('clientdata', function(data){
		console.log(data.filename+"\n"+data.socketid+": \n start time:"+data.start_time+"\n window size:"+data.window_size+ "\n element start: "+data.v_start_time+"\n element end:"+data.v_size+"\n zoom"+data.server_source.config);
		if(k != undefined && k.signal !=undefined){ //Makes sure k is defined
			data.server_source.signal = k.signal.slice(data.v_start_time,data.v_size+1);
			if(debug) console.log("Source" + data.server_source);
			console.log(data.zoom);
		}
		var a = 0;
		//if(file.eva != null)
		//	a = eva.signal.length;
		socket.emit('serverdata', data);
	});
	
//On client request file data
	socket.on('requestfile', function(userdata){
		//console.log("user data prior\n"+ userdata.server_source.signal);
		if(userdata.filename != null){
			fs.readFile("tmp/"+userdata.filename,'utf8',function(err,data){
			if(err) console.log(err);
			else{
				//console.log("Data:\n "+data);
				try {
					k = eval('('+data+')');
					userdata.source_size = k.signal.length;
					if(debug) console.log("size: "+ userdata.source_size + "\n"+userdata);
					userdata.server_source.signal = k.signal.slice(userdata.v_start_time,userdata.v_size+1);
					if(debug) console.log("Chunk of data \n" + JSON.stringify(userdata.server_source.signal,null,4));
					socket.emit('serverdata', userdata);
				}
				catch(err) {
					console.log(err);
				}
			}
		});
		}
		//socket.emit('serverdata', data);
	});
	
});

//On client send file
	
// Start Server
var server = http.listen(5901, function(){
    console.log('Listening on port %d', server.address().port);
});

function split_lines(examples){
	var coordinates = examples.split( "\n" );
	var final_string = [];
	final_string += '{ signal : ['
	for( var i = 0; i < coordinates.length -1; ++i ) {
		var res = generate_tight(coordinates[i],i);
		if(i != 0)
			final_string += ',';
		final_string += res;
		
	}
	final_string += ']}';
	return final_string;
	//console.log(final_string);
}

function generate_tight(array,ind){
	if (array != null || array != '' || !array.includes('\n')){
		var obj = require('csv-string'),
		arr = obj.parse(array);
		if(debug) console.log(arr);
		//{signal:[{ name: 'I-18', wave: '=...=', node: '\u0012', data: [ 'iAALU' ] }]}
		var result = '{name: "I-'+ind.toString(16)+'", wave:\'';
		for (p =0 ; p < arr[0].length;p++){
			result += '=';
		}
		result += '\', node: \'\\u000'+ind.toString(16)+'\', data:[';
		for (p =0 ; p < arr[0].length;p++){
			if(p !=0){
				result += ',';
			}
			result += '\''+arr[0][p]+'\'';
		}
		result += '] }';
		if(debug) console.log(result);
	}
	return result;
}

String.prototype.replaceAt=function(index, replacement) {
    return this.substr(0, index) + replacement+ this.substr(index + replacement.length);
}
