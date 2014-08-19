var events = require('events'),
    util = require('util'),
    redis = require('redis');

var Sentinel = function(host, port) {
  if(false === this instanceof Sentinel) {
    return new Sentinel(host, port);
  }
  
  events.EventEmitter.call(this);
  
  this.host = host;
  this.port = port;

  this.commandClient = redis.createClient(port, host);

  this.commandClient.on('error', function(err) {
    console.log('Redis Sentinel Error: ' + err);
  });

  this.subscribingClient = redis.createClient(port, host);
  this.subscribingClient.on('pmessage', this.handler());
  this.subscribingClient.on('error', function(err) {
    console.log('Redis Sentinel Error: ' + err);
  });
  this.subscribingClient.psubscribe('*');

  return this;
}

util.inherits(Sentinel, events.EventEmitter);

Sentinel.prototype.handler = function() {
  var self = this;
  return function(p, ch, msg) {

    function _parseInstanceDetails(details) {
      var aux = details.split(' '),
          ret =  {
            type: aux[0],
            name: aux[1],
            ip: aux[2],
            port: aux[3]
          };

      if(aux[4] === '#starting') ret['starting-millis'] = aux[6];
      if(aux[4] === '#quorum') ret['quorum'] = aux[5];
      if(aux[4] === '#duplicate') ret['duplicateof'] = {name: aux[6], runid: aux[8]};
      if(aux[4] === '@') {
        ret['master-name'] = aux[5];
        ret['master-ip'] = aux[6];
        ret['master-port'] = aux[7];
      }
      return ret;
    }

    function _parseSwitchMasterDetails(details) {
      var aux = details.split(' '),
          ret =  {
            'master-name': aux[0],
            'old-ip': aux[1],
            'old-port': aux[2],
            'new-ip': aux[3],
            'new-port': aux[4]
          };

      return ret;      
    }

    switch(ch) {
      //The master was reset.
      case '+reset-master':
        self.emit('reset-master', {details: _parseInstanceDetails(msg)});
      break;
      //A new slave was detected and attached.
      case '+slave':
        self.emit('new-slave', {details: _parseInstanceDetails(msg)});
      break;
      //Failover state changed to reconf-slaves state.
      case '+failover-state-reconf-slaves':
        self.emit('failover-status',{status: 'reconfigure-slaves', details: _parseInstanceDetails(msg)});
      break;
      //A failover started by another Sentinel or any other external entity was detected (An attached slave turned into a master).
      case '+failover-detected':
        self.emit('failover-detected', {details: _parseInstanceDetails(msg)});
      break;
      //The leader sentinel sent the SLAVEOF command to this instance in order to reconfigure it for the new slave.
      case '+slave-reconf-sent':
        self.emit('slave-reconf-status', {status: 'started', details: _parseInstanceDetails(msg)});
      break;
      //The slave being reconfigured showed to be a slave of the new master ip:port pair, but the synchronization process is not yet complete.
      case '+slave-reconf-inprog':
        self.emit('slave-reconf-status', {status: 'in-progress', details: _parseInstanceDetails(msg)});
      break;
      //The slave is now synchronized with the new master.
      case '+slave-reconf-done':
        self.emit('slave-reconf-status', {status: 'done', details: _parseInstanceDetails(msg)});
      break;
      //The failover aborted so we sent a SLAVEOF command to the specified instance to reconfigure it back to the original master instance.
      case '-slave-reconf-undo':
        self.emit('slave-reconf-status', {status: 'aborted', details: _parseInstanceDetails(msg)});
      break;
      //One or more sentinels for the specified master were removed as duplicated (this happens for instance when a Sentinel instance is restarted).
      case '-dup-sentinel':
        self.emit('dup-sentinel-removed', {details: _parseInstanceDetails(msg)});
      break;
      //A new sentinel for this master was detected and attached.
      case '+sentinel':
        self.emit('new-sentinel', {details: _parseInstanceDetails(msg)});
      break;
      //The specified instance is now in Subjectively Down state.
      case '+sdown':
        self.emit('instance-sdown', {details: _parseInstanceDetails(msg)});
      break;
      //The specified instance is no longer in Subjectively Down state.
      case '-sdown':
        self.emit('instance-sdown-recover', {details: _parseInstanceDetails(msg)});
      break;
      //The specified instance is now in Objectively Down state.
      case '+odown':
        self.emit('instance-odown', {details: _parseInstanceDetails(msg)});
      break;
      //The specified instance is no longer in Objectively Down state.
      case '-odown':
        self.emit('instance-odown-recover', {details: _parseInstanceDetails(msg)});
      break;
      //25% of the configured failover timeout has elapsed, but this sentinel can't see any progress, and is the new leader. It starts to act as the new leader reconfiguring the remaining slaves to replicate with the new master.
      case '+failover-takedown':
        self.emit('failover-takedown', {details: _parseInstanceDetails(msg)});
      break;
      //We are starting a new failover as a the leader sentinel.
      case '+failover-triggered':
        self.emit('failover-triggered', {details: _parseInstanceDetails(msg)});
      break;
      //New failover state is wait-start: we are waiting a fixed number of seconds, plus a random number of seconds before starting the failover.
      case '+failover-state-wait-start':
        self.emit('failover-status', {status: 'wait-start', details: _parseInstanceDetails(msg)});
      break;
      //New failover state is select-slave: we are trying to find a suitable slave for promotion.
      case '+failover-state-select-slave':
        self.emit('failover-status', {status: 'selecting-slave', details: _parseInstanceDetails(msg)});
      break;
      //There is no good slave to promote. Currently we'll try after some time, but probably this will change and the state machine will abort the failover at all in this case.
      case '-failover-abort-no-good-slave':
        self.emit('failover-status', {status: 'abort-no-good-slave-found', details: _parseInstanceDetails(msg)});
      break;
      //We found the specified good slave to promote.
      case '+selected-slave':
        self.emit('failover-status', {status: 'slave-selected', details: _parseInstanceDetails(msg)});
      break;
      //We are trynig to reconfigure the promoted slave as master, waiting for it to switch.
      case '+failover-state-send-slaveof-noone':
        self.emit('failover-status', {status: 'sent-slaveof-noone', details: _parseInstanceDetails(msg)});
      break;
      //The failover terminated for timeout. If we are the failover leader, we sent a best effort SLAVEOF command to all the slaves yet to reconfigure.
      case '+failover-end-for-timeout':
        self.emit('failover-status', {status: 'timeout', details: _parseInstanceDetails(msg)});
      break;
      //The failover terminated with success. All the slaves appears to be reconfigured to replicate with the new master.
      case '+failover-end':
        self.emit('failover-status', {status: 'succeeded', details: _parseInstanceDetails(msg)});
      break;
      //We are starting to monitor the new master, using the same name of the old one. The old master will be completely removed from our tables.
      case '+switch-master':
        self.emit('switch-master', {details: _parseSwitchMasterDetails(msg)});
      break;
      //After the failover, at some point the old master may return back online. Starting with Redis 2.6.13 Sentinel is able to handle this condition by automatically reconfiguring the old master as a slave of the new master.
      case '+demote-old-slave':
        self.emit('demote-old-slave', {details: _parseInstanceDetails(msg)});
      break;
      //The failover was undoed (aborted) because the promoted slave appears to be in extended SDOWN state.
      case '-failover-abort-x-sdown':
        self.emit('failover-status', {status: 'abort-x-sdown', details: _parseInstanceDetails(msg)});
      break;
      //Tilt mode entered.
      case '+tilt':
        self.emit('tilt-mode-entered', {details: _parseInstanceDetails(msg)});
      break;
      //Tilt mode exited.
      case '-tilt':
        self.emit('tilt-mode-exited', {details: _parseInstanceDetails(msg)});
      break;
      /**** Not Documented messages ****/
      //Not documented
      case '-failover-abort-master-is-back':
        self.emit('failover-status', {status: 'abort-master-is-back', details: _parseInstanceDetails(msg)});
      break;
      //Not documented
      case '+failover-state-wait-promotion':
        self.emit('failover-status', {status: 'wait-promotion', details: _parseInstanceDetails(msg)});
      break;
      //Not documented
      case '+promoted-slave':
        self.emit('promoted-slave', {details: _parseInstanceDetails(msg)});
      break;
    }
  };
};

Sentinel.prototype.ping = function(callback) {
  var self = this;

  self.commandClient.send_command('PING', [], function(err, pong) {
    if(err) return callback(err);
    return callback(null, pong);
  });
};

Sentinel.prototype.masters = function(callback) {
  var self = this;

  self.commandClient.send_command('SENTINEL', ['masters'], function(err, infoMasters) {
    if(err) return callback(err);
    var data = infoMasters.map(function(master) {
      return {
        name: master[1],
        ip: master[3],
        port: master[5],
        runid: master[7],
        flags: master[9],
        'pending-commands': master[11],
        'last-ok-ping-reply': master[13],
        'last-ping-reply': master[15],
        'info-refresh': master[17],
        'num-slaves': master[19],
        'num-other-sentinels': master[21],
        quorum: master[23]
      }
    });
    return callback(null, data);
  });
};

Sentinel.prototype.slaves = function(master, callback) {
  if(typeof master !== 'string') return callback(new Error('master should be a string'));
  var self = this;

  self.commandClient.send_command('SENTINEL', ['slaves', master], function(err, infoSlaves) {
    if(err) return callback(err);
    var data = infoSlaves.map(function(slave) {
      return {
        name: slave[1],
        ip: slave[3],
        port: slave[5],
        runid: slave[7],
        flags: slave[9],
        'pending-commands': slave[11],
        'last-ok-ping-reply': slave[13],
        'last-ping-reply': slave[15],
        'info-refresh': slave[17],
        'master-link-down-time': slave[19],
        'master-link-status': slave[21],
        'master-host': slave[23],
        'master-port': slave[25],
        'slave-priority': slave[27]
      }
    });
    return callback(null, data);
  });
};

Sentinel.prototype.sentinels = function(master, callback) {
  if(typeof master !== 'string') return callback(new Error('master should be a string'));
  var self = this;

  self.commandClient.send_command('SENTINEL', ['sentinels', master], function(err, infoSlaves) {
    if(err) return callback(err);
    var data = infoSlaves.map(function(slave) {
      return {
        name: slave[1],
        ip: slave[3],
        port: slave[5],
        runid: slave[7],
        flags: slave[9],
        'pending-commands': slave[11],
        'last-ok-ping-reply': slave[13],
        'last-ping-reply': slave[15],
        'last-hello-message': slave[17],
        'can-failover-its-master': slave[19]
      }
    });
    return callback(null, data);
  });
};

Sentinel.prototype.isMasterDown = function(host, port, callback) {
  if(typeof host !== 'string' || typeof port !== 'string') return callback(new Error('host and port are mandatories'));
  var self = this;
  self.commandClient.send_command('SENTINEL', ['is-master-down-by-addr', host, port], function(err, masterDown) {
    if(err) return callback(err);
    return callback(null, {isDown: masterDown[0] === 1, leaderSentinel: masterDown[1]});
  });
};

Sentinel.prototype.getMasterAddress = function(master, callback) {
  if(typeof master !== 'string') return callback(new Error('master should be a string'));
  var self = this;

  self.commandClient.send_command('SENTINEL', ['get-master-addr-by-name', master], function(err, infoMaster) {
    if(err) return callback(err);
    return callback(null, {ip: infoMaster[0], port: infoMaster[1]});
  });
};

Sentinel.prototype.reset = function(master, callback) {
  if(typeof master !== 'string') return callback(new Error('master should be a string'));
  var self = this;

  self.commandClient.send_command('SENTINEL', ['reset', master], function(err, res) {
    if(err) return callback(err);
    return callback(null, res === 1);
  });
};

Sentinel.prototype.isLeader = function(masterHost, masterPort, callback) {
  if(typeof masterHost !== 'string' || typeof masterPort !== 'string') return callback(new Error('master should be a string'));
  var self = this;

  self.isMasterDown(masterHost, masterPort, function(err, infoMaster) {
    if(err) return callback(err);
    self.commandClient.info(function(err, info) {
      if(err) return callback(err);
      return callback(null, info.indexOf('run_id:' + infoMaster.leaderSentinel) !== -1);
    });
  })
};

module.exports = Sentinel;