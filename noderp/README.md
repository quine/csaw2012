	----------------------
    | quine's "Noderper" |
    | for CSAW CTF 2012  |
    | qualifier round    |
    |                    |
    | a.k.a.             |
    | the definitively   |
    | bad Node.js        |
    | replacement        |
    | for last year's    |
    | definitely bad     |
    | and unreliable     |
    | Python-based       |
	| challenge          |
	----------------------

Preamble
========

This is my second year writing challenges for CSAW CTF,
and like last year, it was a blast writing this one, even if
it was a bit frustrating for me *and* for challengers at times.

I also used this challenge as an opportunity to learn a bit
more about Node.js, as I hadn't really done much with it before. My code
easily violates numerous design patterns for Node, JavaScript,
etc., and was written during free time in a couple of days...
But, hey...

Congratulations to the teams who qualified for CSAW CTF, and to those
who took advantage of my oversights in this challenge ;), and a huge
thanks to the teams who were considerate and kind enough to offer
their gratitude; compliments and feedback; and for reporting issues to help
improve this and future challenges.

Overview
========

Noderper uses Node.js, a V8 based server-side JavaScript runtime,
featuring numerous extensions/add-ons, and a large, active dev community. Due
to the non-blocking, asynchronous nature of Node.js, Noderper should have been
able handle multiple connections with little to no problem.

Basically, Noderper sets up an HTTP server listening on (all interfaces)
8080/tcp, and presents an AJAX-y UI to the user, with a dropdown menu
featuring a series of links corresponding to different functions on the
backend. When clicked, these links would call a function, using jQuery,
that will fire an XmlHttpRequest to the `/handler` URL of Noderper.
In this XHR was a JSON blob, and in there was a parameter specifying the
`message` (or what to do on the backend), and possibly additional information.

`sendmsg()` function in index.html:

    function sendMsg(message, extenderpurl) {
        $.ajax({
            url: "/handler",
            type: "post",
            dataType: "json",
            contentType: 'application/json; charset=utf-8',
            cache: false,
            timeout: 5000,
            data: JSON.stringify({
                "message": message,
                "extenderpurl": extenderpurl
            }),
            success: function (response) {
                if (response.file) {
                    $("#output")
                        .html(unescape(response.file)
                        .toString())
                } else {
                    $("#output")
                        .text(unescape(response.message))
                }
            },
            error: function (jqXHR, textStatus, errorThrown) {
                console.log(jqXHR.responseText);
                console.log('Error: ' + textStatus + " " + errorThrown)
            }
        })
    }

This message was then consumed by Noderper to decide what, if anything, to execute.
For instance, the `uname` link has an attribute that was sent in this XHR
-- `uname -a` -- that was tested on the backend, and if it matched *exactly*
that string, Noderper would execute `uname -a` and return stdout in a JSON response.
If the user attempted to change the link's attribute to, say, `uname -a; someothercommand`,
the test would fail and they would be greeted with a funny cat GIF:

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
        ...
        default:
            //Fall through to cats
            res.writeHead(200, {'Content-Type': 'text/plain'});
            res.end(JSON.stringify({'file': "<img src=\"cat.gif\">"}));

           
Challenge Goals (or how to "win")
---------------------------------

The challenger would likely be intrigued by the `Test Extenderp` link at
the bottom of the menu, as this differs from all the other links preceding it.
Notably, this link features an additional attribute specifying a URL -- 
ultimately, the vector is akin to a Remote File Inclusion vulnerability. The
content of the `extenderpurl` attribute is used by Noderper to retrive
(via HTTP) and load a custom module (which can be either C/C++ or JavaScript,
but in both cases must conform to Node's standards for exposing/exporting and
initializing functions):

`extenderp` in index.html:

	            <a href="#" class="sublink" id="extenderp" title="Test the Extenderp Interface"
	            extenderpurl="http://127.0.0.1:8080/test/extenderptest.node">Test Extenderp</a>


The `extenderptest` module specified in the
`extenderpurl` attribute should have served as a guide for challengers to
discover/explore more about Node and hopefully quickly write up their own
module. Admittedly, some challengers may have gone the easy route and just
written theirs in JavaScript rather than fighting with building native
modules, which presented its own challenge for the CSAW CTF team (see *Caveats*).

The `key` file, containing the key to submit, proving completion of the
challenge, was found in `/opt/noderp/htdocs/key` (see also *Operational
Considerations*)). The goal, ultimately, was to utilize the RFI issue and
`extenderptest` to retrieve a specially crafted module (in either C/C++ or
JavaScript) that would facilitate code or command execution, subsequently
granting the challenger access to the contents of the key file.

Naturally, there are numerous ways to achieve this in C/C++ (think `exec*()`,
`system()`, sockets, so forth and so on), but are out of the scope of this
write-up. As for JavaScript, Node.js offers a rich API that includes execution
of shell commands, creation of sockets, reading/writing of files, and more,
thus offering the challenger an equivalent, if not more elegant, means of
gaining access.

(Per the *Caveats* section, however, there are some serious issues with loading
and execution of native modules.)

Assuming the challengers picked up on a few cues, and successfully analyzed the
provided `extenderp.node` module, they would ascertain that there is a default,
hardcoded function being invoked: `test()`. They *must* have written their module to
initialize and export this function, as Noderper is already set to call this
function upon loading the supplied module. Failure to properly export or 
initialize this module would result in a vaugely suggestive error being
returned.

	// extenderptest.cc
	
    #include <node.h>
    #include <v8.h>

    using namespace v8;

    Handle<Value> Method(const Arguments& args) {
      HandleScope scope;
      return scope.Close(String::New("Extenderp interface test passed! We hope..."));
    }

    void init(Handle<Object> target) {
      NODE_SET_METHOD(target, "test", Method);
    }

    NODE_MODULE(extenderptest, init);

As it turns out, a mistake/oversight in the URL check test facilitated a
fairly simple traversal vuln -- challengers couldn't request `/key` or
`/key.txt`, but *could* request `/./key` and retrieve the keyfile that way:

    else if(req.url ==  "/key" || req.url == "/key.txt") {
        //NO KEY FOR YOU!
        res.writeHead(200);
        res.end("So close, but no derp.");

This was fixed about halfway through the competition:

    else if(require('path').basename(require('url').parse(req.url).pathname) ==  "key" || 
        require('path').basename(require('url').parse(req.url).pathname) == "key.txt") {
        //NO KEY FOR YOU!
        res.writeHead(200);
        res.end("So close, but no derp.");

Some of the team write-ups mention this as their vector, though some also
combined the RFI with the directory traversal.

----------------------------------
Operational Considerations / Notes
----------------------------------

Noderper was stored in `/opt/noderper`, with the following directories and
files, along with their role/purpose:

    /opt/noderp/: main directory
    /opt/noderp/httpserv.js: Noderper script itself
    /opt/noderp/htdocs/: Webroot & content
    /opt/noderp/htdocs/test/extenderptest.node: "example" compiled C++ module
    /opt/noderp/htdocs/extender/: challengers' (auto)downloaded modules
    /opt/noderp/node_modules/: support modules, like log4js

The Fedora 17 VMware VM on which Noderper ran uses systemd to manage
starting the service at boot time, as well as restarting it in the event of a
crash (see *Caveats*). Originally, Noderper was set to drop privileges upon
startup, to the **noderp** user. One team noted that there was an oversight in
dropping supplemental group membership in Noderper's startup (only `setuid`-ing):

    process.setuid(1000);
    logger.trace('New uid: ' + process.getuid());

This was fixed later, to setgid() as well:

    process.setgid(1000);
    process.setuid(1000);
    logger.trace('New uid: ' + process.getuid());
    logger.trace('New gid: ' + process.getgid());

though it ultimately didn't matter, as later the systemd service configuration
was changed to spawn Noderper as the **noderp** user directly.

Though Noderper logged to the console, since it was started by systemd, the logs
would otherwise go off into the ether. Therefore, log4js, the logging subsystem
used by Noderper, was configured to write to /home/noderp/noderp.log

Consideration was given to using the Cluster module of Node.js, so that one instance
of the service would be fork()'d for each CPU available, but this was thought to be
overkill. Additional "real world" QA (i.e. CTF) later reversed this decision; and
it was added back in:

    if (cluster.isMaster) {
      // Fork workers.
      logger.debug("I am the master: " + process.pid);
      for (var i = 0; i < numCPUs; i++) {
        logger.debug("Forked: " + process.pid);
        cluster.fork();
      }

      cluster.on('exit', function(worker, code, signal) {
        logger.warn("Worker " + worker.process.pid + " died");
        cluster.fork();
      });
    }

This was due to some challengers' corrupt, invalid, or
just malicious modules killing Node. This seems to have generally helped; even
though we were only fork()'ing once, upon death of the child process, the
Noderper 'master' re-fork()s.

We also set a cron job to periodically restart Noderper (first every 5 minutes, then every 2).
This helped a *bit* with stability, but wasn't perfect...


-------------------------
Caveats / Lessons Learned
-------------------------

Unbeknownst until the day before this write-up, and perhaps resultant of the
kludgy and slipshod nature of the code in the challenge itself, there is a
damning problem with loading native C/C++ modules in Node: a nasty segfault.
To wit, loading the module led to unpredictable behavior -- Node would either
load the module and execute the `test()` function (as mentioned in "Challenge
Goals") or would crash. Effectively, it's a 50/50 shot on the first load/exec of
the module and function, but would likely succeed on the second try (if it
crashed the first time). In the event of a crash, systemd would restart
Noderper.

Other quick notes:

* Better segmentation of users would have helped, as would have tightening SSH access and what-not, as a couple of teams tossed their SSH key into noderp's `authorized_keys` file and SSH'ed in (no problem with this, you earned it)
* Sandboxing using Node's `vm` module would have probably been an interesting twist to the whole thing, but perhaps that's for the future...


----------
References
----------
* Node.js
	* http://nodejs.org/
* V8
	* https://code.google.com/p/v8/
* jQuery
	* http://jquery.com/
* How To Module
	* http://howtonode.org/how-to-module
* Writing Node.js modules in C++
	* http://www.lupomontero.com/writing-node-js-modules-in-cpp/
* LSE Blog: CSAW CTF 2012: Web 500 writeup
	* http://blog.lse.epita.fr/articles/27-csaw-ctf-2012-web-500-writeup.html
* DE EINDBAZEN: CSAW 2012 – Web 500
	* http://eindbazen.net/2012/09/csaw-2012-web-500/
* log4js-node
	* https://github.com/nomiddlename/log4js-node