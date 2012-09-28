/*
noderp v0.1b - CSAW CTF 2012's definitively terrible
successor to 2011's Python-based haderp(er)

Author: quine
*/

//Set logging parameters
var log4js = require('log4js');
log4js.loadAppender('file');
log4js.addAppender(log4js.appenders.file('/home/noderp/noderp.log'));
var logger = log4js.getLogger();

//Write our PID
var pidfile = '/var/run/noderp.pid';
try {
    require('fs').writeFileSync(pidfile, process.pid.toString(), 'ascii');
} catch (e) {
    logger.error("Error writing PID file: " + e);
}


//Attempt to drop privs
if (process.getuid && process.setuid) {
  logger.trace('Current uid: ' + process.getuid());
  try {
    process.setuid(1000);
    logger.trace('New uid: ' + process.getuid());
  }
  catch (err) {
    logger.error('Failed to set uid: ' + err);
  }
}

//import some basic modules
var fs = require('fs'),
http = require('http');

//Command execution function
function cmdexec(cmd, cb) {
    try {
        var exec = require('child_process').exec;
        child = exec(cmd, {cwd: "/tmp"});
        child.stdout.on('data', function(data) {
            cb(data);
            logger.info("Executed: " + cmd);
            logger.info("stdout: " + data);
            child.kill();
        });
        child.stderr.on('data',function(data) {
            cb(data);
            logger.error("stderr: " + data);
        });
    }
    catch(e) {
        logger.error("Error executing command: " + cmd);
    }
}

//Spin this server up!
http.createServer(function (req, res) {
    //'/handler' does all the AJAX dirty work
    if(req.url == "/handler") {
        var reqdata = '';
        var resdata = '';
        var output = '';

        //When we receive data, we put the data chunks together :O~~~~
        req.addListener('data', function(chunk) {reqdata += chunk; }); 

        //When the request is complete
        req.addListener('end', function() { 
            try {
                //Parse the JSON message in the XHR
                var msg = JSON.parse(reqdata);

                //I inverted what lolcats means...
                var lolcats = false;
                logger.info(req.connection.remoteAddress + " - Data = " + reqdata);
            
                var cmd;

                //Check for what the command is in XHR, set it, return it to cmdexec()
                //We're nasty, and we match the string entirely to be jerks.
                switch(msg.message) {
                    case "uname -a":
                        cmd = "uname -a";
                        break;
                    case "ps":
                        cmd = "ps";
                        break;
                    case "ping -c 1 4.2.2.1":
                        cmd = "ping -c 1 4.2.2.1";
                        break;
                    case "uptime":
                        cmd = "uptime";
                        break;
                    case "cat":
                        //LOLOLOL
                        res.writeHead(200, {'Content-Type': 'text/plain'});
                        res.end(JSON.stringify({'file': "<img src=\"cat.gif\">"}));
                        lolcats = true;
                        break;
                    case "extenderp":
                        //The bidness...it's here.
                        var dhttp = require('http');
                        var extenderppath = require('path').basename(require('url').parse(msg.extenderpurl).pathname); //parse the filename
                        logger.debug("extenderpurl: " + msg.extenderpurl);
                        logger.debug("extenderppath: " + extenderppath);
                        try {
                            //First try retrieving the remote file
                            dhttp.get(msg.extenderpurl, function(response) {
                                logger.info("Making request...");
                                logger.info("HTTP response: " + response.statusCode);
                                if(response.statusCode !== 200) {
                                    //polite error message returned if !HTTP 200
                                    res.writeHead(200, {'Content-Type': 'text/plain'});
                                    res.end(JSON.stringify({'message': 'Error. Derp harder.'}));
                                    logger.error("Error retrieving module: " + msg.extenderpurl);
                                }
                                try {
                                    //Create the output file returned in the HTTP response
                                    var outputfile = fs.createWriteStream(__dirname + "/htdocs/extender/" + extenderppath, {'flags': 'w'});
                                    //Chunk chunk chunk
                                    response.on('data',function(chunk) {
                                        outputfile.write(chunk);
                                    }).on('end', function() {
                                        //Finished? Chunkzzzz COMPLETE!
                                        outputfile.end(function(err) {
                                            if(err !== null) {
                                                logger.error(err);
                                            }
                                            try {
                                                //Now try to load the file just retrieved
                                                logger.info("Loading file");
                                                var extenderptest = require(__dirname + "/htdocs/extender/" + extenderppath);
                                                try {
                                                    //Now try to call the hello() function...
                                                    //the...only...function... :>
                                                    logger.warn("Calling extenderptest.test()");
                                                    extenderpoutput = extenderptest.test();
                                                    res.writeHead(200, {'Content-Type': 'text/plain'});
                                                    logger.debug("Sending JSON response");
                                                    res.end(JSON.stringify({'message': extenderpoutput}));
                                                    logger.debug(extenderppath + " module output: " + extenderpoutput);
                                                }
                                                catch(e) {
                                                    //Function didn't exist or error'ed out
                                                    res.writeHead(200, {'Content-Type': 'text/plain'});
                                                    res.end(JSON.stringify({'message': 'Error with your function, bub. Derp harder.'}));
                                                    logger.error("Error calling function in module '" + extenderptest + "': " + e);
                                                }
                                            }
                                            catch(e) {
                                                //Module didn't load successfully
                                                res.writeHead(200, {'Content-Type': 'text/plain'});
                                                res.end(JSON.stringify({'message': 'Error loading, bub. Derp harder.'}));
                                                logger.error("Error loading module: " + extenderppath);
                                            }
                                        });
                                    });
                                }
                                catch(e) {
                                    //Module wasn't saved correctly
                                    res.writeHead(200, {'Content-Type': 'text/plain'});
                                    res.end(JSON.stringify({'message': 'Error writing, bub. Derp harder.'}));
                                    logger.error("Error retrieving module: " + msg.extenderpurl);
                                }
                            }).on('error', function(err) {
                                    res.writeHead(200, {'Content-Type': 'text/plain'});
                                    res.end(JSON.stringify({'message': 'Socket Error. Derp harder.'}));
                                    logger.error("Error retrieving module: " + err);
                                });
                        }
                        catch(e) {
                            // FAILED
                            res.writeHead(200, {'Content-Type': 'text/plain'});
                            res.end(JSON.stringify({'message': 'Some kind of failure, bub. Derp harder.'}));
                            logger.error(e);
                        }
                        lolcats = true;
                        break;
                    default:
                        //Fall through to cats
                        res.writeHead(200, {'Content-Type': 'text/plain'});
                        res.end(JSON.stringify({'file': "<img src=\"cat.gif\">"}));
                        lolcats = true;
                }
                if(lolcats == false) {
                    // alright, alright...call cmdexec
                    cmdexec(cmd, function(stdout) {
                        res.writeHead(200, {'Content-Type': 'application/json'});
                        res.end(JSON.stringify({'message': escape(stdout.toString())}));
                        });
                }
            }
            catch (e) {
                //Just fall all the way through.
                res.writeHead(200, {'Content-Type': 'application/json'});
                res.end(JSON.stringify({"message": "You're just having all sorts of derpiness, eh, bub? Try harder."}));
                res.end('\n');
            }
        });
        //Log requests
        logger.info(req.connection.remoteAddress + " - " + "\"" + req.method + " " + req.url + "\" " + res.statusCode);
    }
    else if(req.url == "/key" || req.url == "/key.txt") {
        //NO KEY FOR YOU!
        res.writeHead(200);
        res.end("So close, but no derp.");
        logger.info(req.connection.remoteAddress + " - " + "\"" + req.method + " " + req.url + "\" " + res.statusCode);
        return;
    }
    else if(req.url == "/") {
        //Just redir to index.html
            res.writeHead(302, {
                'Location': '/index.html'
            });
            res.end();
    }
    else {
    // Just read something already
    fs.readFile(__dirname + "/htdocs/" + req.url , function(err,data) {
        if(err) {
            res.writeHead(404);
            res.end(JSON.stringify(err));
            return;
        }
        res.writeHead(200);
        res.end(data);
        logger.info(req.connection.remoteAddress + " - " + "\"" + req.method + " " + req.url + "\" " + res.statusCode);
    });}
}).listen(process.env.PORT || 8080, "0.0.0.0");

logger.trace("Listening on 0.0.0.0:8080");