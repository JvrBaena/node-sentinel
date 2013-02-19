# node-sentinel
=============

Redis Sentinel wrapper for Node.js.
Provides methods and events for the Redis Sentinel API.

![Sentinel](https://raw.github.com/JvrBaena/node-sentinel/master/stuff/sentinel.gif)


## Installation
```
  npm install node-sentinel
```  
## Usage

```javascript

var Sentinel = require('node-sentinel'),
    //init with ip and port for the sentinel server
    s = new Sentinel('127.0.0.1','26379');
    /******* Sentinel API examples *******/

    s.ping(function(err, pong) {
      ...
    });

    s.masters(function(err, masters) {
    
      /* masters contains
      [ { name: 'mymaster',
        ip: '127.0.0.1',
        port: '6379',
        runid: '',
        flags: 'master',
        'pending-commands': '0',
        'last-ok-ping-reply': '613',
        'last-ping-reply': '613',
        'info-refresh': '9101',
        'num-slaves': '1',
        'num-other-sentinels': '2',
        quorum: '2' },

        ... ]    
        */
    });

    s.slaves('mymaster', function(err, slaves) {

      /* slaves contains
      [ { name: '127.0.0.1:6380',
          ip: '127.0.0.1',
          port: '6380',
          runid: '',
          flags: 'slave',
          'pending-commands': '0',
          'last-ok-ping-reply': '389',
          'last-ping-reply': '389',
          'info-refresh': '1195',
          'master-link-down-time': '0',
          'master-link-status': 'ok',
          'master-host': '127.0.0.1',
          'master-port': '6379',
          'slave-priority': '100' },

          ... ]      

       */
    });

    s.sentinels('mymaster', function(err, sentinels) {

      /* sentinels contains
        [ { name: '127.0.0.1:26381',
            ip: '127.0.0.1',
            port: '26381',
            runid: '8ba13b49bafd6154967b918039cc489c5857d4c7',
            flags: 'sentinel',
            'pending-commands': '0',
            'last-ok-ping-reply': '560',
            'last-ping-reply': '560',
            'last-hello-message': '2902',
            'can-failover-its-master': '1' },

          ... ]
       */

    });

    s.reset('mymaster', function(err, success) {

      ...

    });
    
    s.getMasterAddress('mymaster', function(err, masterInfo) {
      /* masterInfo contains
      { ip: '127.0.0.1', port: '6379' }
      */
    });
    
    s.isMasterDown('127.0.0.1', '6379', function(err, isMasterDown) {
      /* isMasterDown contains
      { isDown: false,  leaderSentinel: '7ca87187f80adc20979fb61efec296f965bee515' }
      */
    });

    
    s.isLeader(masterHost, masterPort, function(err, isLeader) {

      ...

    });


    /******* Sentinel pub/sub messages events *******/
    

    //The master was reset.
    s.on('reset-master', function(data) {
      ...
    });

    //A new slave was detected and attached.
    s.on('new-slave', function(data) {
      ...
    });

    //A failover started by another Sentinel or any other external entity was detected (An attached slave turned into a master).
    s.on('failover-detected', function(data) {
      ...
    });

    s.on('slave-reconf-status', function(data) {
      switch(data.status) {

        //The leader sentinel sent the SLAVEOF command to this instance in order to reconfigure it for the new slave.
        case 'started':
          ...
        break;

        //The slave being reconfigured showed to be a slave of the new master ip:port pair, but the synchronization process is not yet complete.
        case 'in-progress':
          ...
        break;

        //The slave is now synchronized with the new master.
        case 'done':
          ...
        break;

        //The failover aborted so we sent a SLAVEOF command to the specified instance to reconfigure it back to the original master instance.
        case 'aborted':
          ...
        break;
      }
    });

    //One or more sentinels for the specified master were removed as duplicated (this happens for instance when a Sentinel instance is restarted).
    s.on('dup-sentinel-removed', function(data) {
      ...
    });

    //A new sentinel for this master was detected and attached.
    s.on('new-sentinel', function(data) {
      ...
    });

    //The specified instance is now in Subjectively Down state.
    s.on('instance-sdown', function(data) {
      ...
    });
  
    //The specified instance is no longer in Subjectively Down state.
    s.on('instance-sdown-recover', function(data) {
      ...
    });
      
    //The specified instance is now in Objectively Down state.
    s.on('instance-odown', function(data) {
      ...
    });
    
    //The specified instance is no longer in Objectively Down state.
    s.on('instance-odown-recover', function(data) {
      ...
    });

    //25% of the configured failover timeout has elapsed, but this sentinel can't see any progress, and is the new leader. It starts to act as the new leader reconfiguring the remaining slaves to replicate with the new master.
    s.on('failover-takedown', function(data) {
      ...
    });
    
    //We are starting a new failover as a the leader sentinel.
    s.on('failover-triggered', function(data) {
      ...
    });
    
    s.on('failover-status', function(data) {
      switch(data.status) {

        //New failover state is wait-start: we are waiting a fixed number of seconds, plus a random number of seconds before starting the failover.
        case 'wait-start':
          ...
        break;

        //New failover state is select-slave: we are trying to find a suitable slave for promotion.
        case 'selecting-slave':
          ...
        break;

        //We found the specified good slave to promote.
        case 'slave-selected':
          ...
        break;

        //We are trying to reconfigure the promoted slave as master, waiting for it to switch.
        case 'sent-slaveof-noone':
          ...
        break;

        //Not documented
        case 'wait-promotion':
          ...
        break;

        //Failover state changed to reconf-slaves state.
        case 'reconfigure-slaves':
          ...
        break;

        //The failover terminated with success. All the slaves appears to be reconfigured to replicate with the new master.
        case 'succeeded':
          ...
        break;

        //There is no good slave to promote. Currently we'll try after some time, but probably this will change and the state machine will abort the failover at all in this case.
        case 'abort-no-good-slave-found':
          ...
        break;

        //Not documented
        case 'abort-master-is-back':
          ...
        break;

        //The failover was undoed (aborted) because the promoted slave appears to be in extended SDOWN state.
        case 'abort-x-sdown':
          ...
        break;
      }
    });
    
    //We are starting to monitor the new master, using the same name of the old one. The old master will be completely removed from our tables.
    s.on('switch-master', function(event) {
      ...
    });

    //Tilt mode entered.
    s.on('tilt-mode-entered', function(event) {
      ...
    });

    //Tilt mode exited.
    s.on('tilt-mode-exited', function(event) {
      ...
    });

    //Not documented
    s.on('promoted-slave', function(event) {
      ...
    });

```
**TODO: Add description for each API method and each event**



## License

**MIT License**

Copyright (c) 2013 Javier Baena

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
