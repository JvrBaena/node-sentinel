# node-sentinel
=============

Redis Sentinel wrapper for Node.js.
Provides methods and events for the Redis Sentinel API.

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
        quorum: '2' }]    
        */
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
    /******* Sentinel pub/sub messages events *******/
    
    s.on('failover-triggered', function(data) {
      ...
    });
    
    s.on('failover-status', function(data) {
      switch(data.status) {
        case 'wait-start':
          ...
        break;
        case 'selecting-slave':
          ...
        break:
        case 'slave-selected':
          ...
        break;
        case 'sent-slaveof-noone':
          ...
        break;
        case 'wait-promotion':
          ...
        break;
        case 'reconfigure-slaves':
          ...
        break;
        case 'succeeded':
          ...
        break;
        case 'abort-no-good-slave-found':
          ...
        break;
        case 'abort-master-is-back':
          ...
        break;
        case 'abort-x-sdown':
          ...
        break;
      }
    });
    
    s.on('switch-master', function(event) {
      ...
    });

```
