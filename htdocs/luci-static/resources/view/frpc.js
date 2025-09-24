'use strict';
'require view';
'require ui';
'require form';
'require rpc';
'require fs';
'require tools.widgets as widgets';

//	[Widget, Option, Title, Description, {Param: 'Value'}],
var startupConf = [
	[form.Flag, 'enabled', _('Enabled'), _('Enable or disable the frpc service (init.enabled).')],
	[form.Flag, 'stdout', _('Log stdout')],
	[form.Flag, 'stderr', _('Log stderr')],
	[widgets.UserSelect, 'user', _('Run daemon as user')],
	[widgets.GroupSelect, 'group', _('Run daemon as group')],
	[form.Flag, 'respawn', _('Respawn when crashed')],
	[form.DynamicList, 'env', _('Environment variable'), _('OS environments pass to frp for config file template, see <a href="https://github.com/fatedier/frp#configuration-file-template">frp README</a>'), {placeholder: 'ENV_NAME=value'}],
	[form.DynamicList, 'conf_inc', _('Additional configs'), _('Config files include in temporary config file'), {placeholder: '/etc/frp/frpc.d/frpc_full.ini'}]
];

// 分页分组：将原 Common Settings 拆分为多个逻辑标签页
var grpBasic = [
	[form.Value, 'server_addr', _('Server address'), _('ServerAddr specifies the address of the server to connect to.<br />By default, this value is "127.0.0.1".'), {datatype: 'host'}],
	[form.Value, 'server_port', _('Server port'), _('ServerPort specifies the port to connect to the server on.<br />By default, this value is 7000.'), {datatype: 'port'}],
	[form.ListValue, 'protocol', _('Protocol'), _('Protocol specifies the transport protocol used to connect frpc to frps. Valid values are "tcp", "kcp", "quic" and "websocket".<br />By default, this value is "tcp".'), {values: ['tcp', 'kcp', 'quic', 'websocket']}],
	[form.Value, 'http_proxy', _('HTTP proxy'), _('HttpProxy specifies a proxy address to connect to the server through. If this value is "", the server will be connected to directly.<br />By default, this value is read from the "http_proxy" environment variable.')],
	[form.Value, 'dial_server_timeout', _('Dial server timeout'), _('transport.dialServerTimeout seconds (connect timeout).'), {datatype: 'uinteger'}],
	[form.Value, 'dial_server_keepalive', _('Dial server keepalive'), _('transport.dialServerKeepalive seconds (TCP keepalive between frpc and frps).'), {datatype: 'uinteger'}],
	[form.Value, 'connect_server_local_ip', _('Connect server local IP'), _('transport.connectServerLocalIP: local bind address when dialing server (tcp/websocket).'), {datatype: 'ipaddr'}],
	[form.Flag, 'tcp_mux', _('TCP mux'), _('TcpMux toggles TCP stream multiplexing. This allows multiple requests from a client to share a single TCP connection. If this value is true, the server must have TCP multiplexing enabled as well.<br />By default, this value is true.'), {datatype: 'bool', default: 'true'}],
	[form.Value, 'tcp_mux_keepalive_interval', _('TCP mux keepalive interval'), _('tcpMuxKeepaliveInterval (seconds).'), {datatype: 'uinteger'}],
	[form.Value, 'heartbeat_interval', _('Heartbeat interval'), _('HeartBeatInterval specifies at what interval heartbeats are sent to the server, in seconds. It is not recommended to change this value.<br />By default, this value is 30.'), {datatype: 'uinteger'}],
	[form.Value, 'heartbeat_timeout', _('Heartbeat timeout'), _('HeartBeatTimeout specifies the maximum allowed heartbeat response delay before the connection is terminated, in seconds. It is not recommended to change this value.<br />By default, this value is 90.'), {datatype: 'uinteger'}],
	[form.Value, 'udp_packet_size', _('UDP packet size'), _('udpPacketSize bytes (default 1500).'), {datatype: 'uinteger'}],
	[form.Value, 'user', _('User'), _('User specifies a prefix for proxy names to distinguish them from other clients. If this value is not "", proxy names will automatically be changed to "{user}.{proxy_name}".<br />By default, this value is "".')],
	[form.Flag, 'login_fail_exit', _('Exit when login fail'), _('LoginFailExit controls whether or not the client should exit after a failed login attempt. If false, the client will retry until a login attempt succeeds.<br />By default, this value is true.'), {datatype: 'bool', default: 'true'}]
];

var grpAuth = [
	[form.ListValue, 'auth_method', _('Auth method'), _('Authentication method to connect frpc to frps. Valid values: "token" (default) or "oidc".'), {values: ['token', 'oidc'], default: 'token'}],
	[form.Value, 'token', _('Token'), _('Token specifies the shared authorization token (auth.method=token). Leave empty to disable token authentication.'), {depends: {auth_method: 'token'}}],
	[form.Value, 'oidc_client_id', _('OIDC Client ID'), _('OIDC clientID used when auth.method = "oidc".'), {depends: {auth_method: 'oidc'}}],
	[form.Value, 'oidc_client_secret', _('OIDC Client Secret'), _('OIDC clientSecret used when auth.method = "oidc".'), {password: true, depends: {auth_method: 'oidc'}}],
	[form.Value, 'oidc_audience', _('OIDC Audience'), _('OIDC audience used when auth.method = "oidc".'), {depends: {auth_method: 'oidc'}}],
	[form.Value, 'oidc_token_endpoint_url', _('OIDC Token Endpoint URL'), _('OIDC token endpoint URL used when auth.method = "oidc".'), {depends: {auth_method: 'oidc'}}]
];

// Security & TLS (合并 TLS 与 QUIC)
var grpSecurityTLS = [
	[form.Flag, 'tls_enable', _('TLS'), _('TLSEnable specifies whether or not TLS should be used when communicating with the server.'), {datatype: 'bool'}],
	[form.Value, 'tls_cert_file', _('TLS cert file'), _('Client TLS certFile path.'), {datatype: 'file'}],
	[form.Value, 'tls_key_file', _('TLS key file'), _('Client TLS keyFile path.'), {datatype: 'file'}],
	[form.Value, 'tls_trusted_ca_file', _('TLS trusted CA file'), _('Client TLS trustedCaFile path.'), {datatype: 'file'}],
	[form.Value, 'tls_server_name', _('TLS server name'), _('Override TLS serverName for SNI.')],
	[form.Flag, 'tls_disable_custom_first_byte', _('TLS disable custom first byte'), _('Disable custom first byte when using TLS.'), {datatype: 'bool'}],
	[form.Value, 'quic_keepalive_period', _('QUIC keepalive period'), _('QUIC keepalivePeriod (seconds).'), {datatype: 'uinteger'}],
	[form.Value, 'quic_max_idle_timeout', _('QUIC max idle timeout'), _('QUIC maxIdleTimeout (seconds).'), {datatype: 'uinteger'}],
	[form.Value, 'quic_max_incoming_streams', _('QUIC max incoming streams'), _('QUIC maxIncomingStreams.'), {datatype: 'uinteger'}]
];

var grpWeb = [
	[form.Value, 'webserver_addr', _('WebServer address'), _('WebServer address specifies the address that the admin server binds to.<br />By default, this value is "127.0.0.1".'), {datatype: 'ipaddr'}],
	[form.Value, 'webserver_port', _('WebServer port'), _('WebServer port specifies the port for the admin server to listen on. If this value is 0, the admin server will not be started.<br />By default, this value is 0.'), {datatype: 'port'}],
	[form.Value, 'webserver_user', _('WebServer user'), _('WebServer user specifies the username that the admin server will use for login.<br />By default, this value is "admin".')],
	[form.Value, 'webserver_pwd', _('WebServer password'), _('WebServer password specifies the password that the admin server will use for login.<br />By default, this value is "admin".'), {password: true}],
	[form.Value, 'assets_dir', _('Assets dir'), _('AssetsDir specifies the local directory that the admin server will load resources from. If this value is "", assets will be loaded from the bundled executable using statik.<br />By default, this value is "".')],
	[form.Value, 'webserver_cert_file', _('WebServer TLS cert file'), _('TLS certificate file path for HTTPS admin UI (cert+key required).')],
	[form.Value, 'webserver_key_file', _('WebServer TLS key file'), _('TLS private key file path for HTTPS admin UI.')],
	[form.Value, 'webserver_ca_file', _('WebServer TLS CA file'), _('Optional trusted CA file path for client certificate verification.')]
];


var grpLogging = [
	[form.Value, 'log_to', _('Log output target'), _('Preferred new key. Use file path or special values: "console", "/dev/null". Empty = upstream default (console).')],
	[form.Value, 'log_file', _('(Deprecated) legacy log_file'), _('Deprecated legacy key retained for compatibility; value will be migrated in-memory to log_to. Please move to "Log output target".'), {placeholder: '/var/log/frpc.log'}],
	[form.ListValue, 'log_level', _('Log level'), _('Minimum log level.'), {values: ['trace', 'debug', 'info', 'warn', 'error']}],
	[form.Value, 'log_max_days', _('Log max days'), _('Maximum days to retain file logs (file mode only).'), {datatype: 'uinteger'}],
	[form.Flag, 'disable_log_color', _('Disable log color'), _('Disable ANSI color in console logs.'), {datatype: 'bool', default: 'false'}],
	[form.Value, 'pool_count', _('Pool count'), _('transport.poolCount: number of pre-established connections (default 1).'), {datatype: 'uinteger'}],
	[form.DynamicList, 'start_list', _('Start proxies list'), _('Only enable these proxies; empty means enable all defined proxies.') , {placeholder: 'proxyA'}]
];

// Renamed '_' -> 'extra_settings' (keep backward compatibility)
var grpExtra = [
	[form.DynamicList, 'extra_settings', _('Additional settings'), _('This list can be used to specify some additional parameters which have not been included in this LuCI.'), {placeholder: 'Key-A=Value-A'}]
];

var baseProxyConf = [
	[form.Value, 'name', _('Proxy name'), undefined, {rmempty: false, optional: false}],
	[form.ListValue, 'type', _('Proxy type'), _('ProxyType specifies the type of this proxy. Valid values include "tcp", "udp", "http", "https", "stcp", and "xtcp".<br />By default, this value is "tcp".'), {values: ['tcp', 'udp', 'http', 'https', 'stcp', 'xtcp']}],
	[form.Flag, 'use_encryption', _('Encryption'), _('UseEncryption controls whether or not communication with the server will be encrypted. Encryption is done using the tokens supplied in the server and client configuration.<br />By default, this value is false.'), {datatype: 'bool'}],
	[form.Flag, 'use_compression', _('Compression'), _('UseCompression controls whether or not communication with the server will be compressed.<br />By default, this value is false.'), {datatype: 'bool'}],
	[form.Value, 'local_ip', _('Local IP'), _('LocalIp specifies the IP address or host name to proxy to.'), {datatype: 'host'}],
	[form.Value, 'local_port', _('Local port'), _('LocalPort specifies the port to proxy to.'), {datatype: 'port'}],
];

var bindInfoConf = [
	[form.Value, 'remote_port', _('Remote port'), _('If remote_port is 0, frps will assign a random port for you'), {datatype: 'port'}]
];

var domainConf = [
	[form.Value, 'custom_domains', _('Custom domains')],
	[form.Value, 'subdomain', _('Subdomain')],
];

var httpProxyConf = [
	[form.Value, 'locations', _('Locations')],
	[form.Value, 'http_user', _('HTTP user')],
	[form.Value, 'http_pwd', _('HTTP password')],
	[form.Value, 'host_header_rewrite', _('Host header rewrite')],
	// [form.Value, 'headers', _('Headers')], // FIXME
];

var stcpProxyConf = [
	[form.ListValue, 'role', _('Role'), undefined, {values: ['server', 'visitor']}],
	[form.Value, 'server_name', _('Server name'), undefined, {depends: [{role: 'visitor'}]}],
	[form.Value, 'sk', _('Sk')],
];

var pluginConf = [
	[form.ListValue, 'plugin', _('Plugin'), undefined, {values: ['', 'http_proxy', 'socks5', 'unix_domain_socket'], rmempty: true}],
	[form.Value, 'plugin_http_user', _('HTTP user'), undefined, {depends: {plugin: 'http_proxy'}}],
	[form.Value, 'plugin_http_passwd', _('HTTP password'), undefined, {depends: {plugin: 'http_proxy'}}],
	[form.Value, 'plugin_user', _('SOCKS5 user'), undefined, {depends: {plugin: 'socks5'}}],
	[form.Value, 'plugin_passwd', _('SOCKS5 password'), undefined, {depends: {plugin: 'socks5'}}],
	[form.Value, 'plugin_unix_path', _('Unix domain socket path'), undefined, {depends: {plugin: 'unix_domain_socket'}, optional: false, rmempty: false,
		datatype: 'file', placeholder: '/var/run/docker.sock', default: '/var/run/docker.sock'}],
];

// Batch B advanced proxy parameters
var advProxyConf = [
	[form.Value, 'bandwidth_limit', _('Bandwidth limit'), _('transport.bandwidthLimit, e.g. 1MB, 100KB, 1GB.'), {modalonly: true}],
	[form.ListValue, 'bandwidth_limit_mode', _('Bandwidth limit mode'), _('transport.bandwidthLimitMode.'), {values: ['client', 'server'], modalonly: true}],
	[form.ListValue, 'proxy_protocol_version', _('Proxy protocol version'), _('transport.proxyProtocolVersion.'), {values: ['', 'v1', 'v2'], modalonly: true}],
	[form.Value, 'lb_group', _('LoadBalancer group'), _('loadBalancer.group name.'), {modalonly: true}],
	[form.Value, 'lb_group_key', _('LoadBalancer group key'), _('loadBalancer.groupKey secret.'), {modalonly: true}],
	[form.ListValue, 'hc_type', _('Health check type'), _('healthCheck.type'), {values: ['', 'tcp', 'http'], modalonly: true}],
	[form.Value, 'hc_path', _('Health check path'), _('healthCheck.path (HTTP only).'), {modalonly: true, depends: {hc_type: 'http'}}],
	[form.Value, 'hc_timeout', _('Health check timeout(s)'), _('healthCheck.timeoutSeconds'), {datatype: 'uinteger', modalonly: true}],
	[form.Value, 'hc_max_failed', _('Health check max failed'), _('healthCheck.maxFailed'), {datatype: 'uinteger', modalonly: true}],
	[form.Value, 'hc_interval', _('Health check interval(s)'), _('healthCheck.intervalSeconds'), {datatype: 'uinteger', modalonly: true}],
	[form.Value, 'server_user', _('Server user (visitor)'), _('serverUser for visitor role'), {modalonly: true, depends: {role: 'visitor'}}],
	[form.DynamicList, 'extra_options', _('Extra options'), _('Append raw key=value lines at end of this proxy block'), {placeholder: 'foo.bar=value', modalonly: true}],
	[form.DynamicList, 'extra_options_plugin', _('Extra plugin options'), _('Append raw key=value lines inside [proxies.plugin] section'), {placeholder: 'extraKey=extraValue', modalonly: true, depends: {plugin: 'http_proxy'}}]
];

function setParams(o, params) {
	if (!params) return;
	for (var key in params) {
		var val = params[key];
		if (key === 'values') {
			for (var j = 0; j < val.length; j++) {
				var args = val[j];
				if (!Array.isArray(args))
					args = [args];
				o.value.apply(o, args);
			}
		} else if (key === 'depends') {
			if (!Array.isArray(val))
				val = [val];

			// Merge with existing dependency rules if present; guard against undefined
			var existing = Array.isArray(o.deps) ? o.deps : [];
			var deps = [];
			for (var j = 0; j < val.length; j++) {
				var d = {};
				for (var vkey in val[j])
					d[vkey] = val[j][vkey];
				for (var k = 0; k < existing.length; k++) {
					for (var dkey in existing[k]) {
						d[dkey] = existing[k][dkey];
					}
				}
				deps.push(d);
			}
			o.deps = deps;
		} else {
			o[key] = params[key];
		}
	}
	if (params['datatype'] === 'bool') {
		o.enabled = 'true';
		o.disabled = 'false';
	}
}

function defTabOpts(s, t, opts, params) {
	for (var i = 0; i < opts.length; i++) {
		var opt = opts[i];
		var o = s.taboption(t, opt[0], opt[1], opt[2], opt[3]);
		setParams(o, opt[4]);
		setParams(o, params);
		if (o instanceof form.DynamicList) {
			(function(orig) {
				o.remove = function(section_id) {
					var cur = this.map.data.get(this.map.config, section_id, this.option);
					if (cur == null)
						return Promise.resolve();
					return orig.apply(this, arguments);
				};
			})(o.remove);
		}
	}
}

function defOpts(s, opts, params) {
	for (var i = 0; i < opts.length; i++) {
		var opt = opts[i];
		var o = s.option(opt[0], opt[1], opt[2], opt[3]);
		setParams(o, opt[4]);
		setParams(o, params);
	}
}

const callServiceList = rpc.declare({
	object: 'service',
	method: 'list',
	params: ['name'],
	expect: { '': {} }
});

function getServiceStatus() {
	return L.resolveDefault(callServiceList('frpc'), {}).then(function (res) {
		var isRunning = false;
		try {
			isRunning = res['frpc']['instances']['instance1']['running'];
		} catch (e) { }
		return isRunning;
	});
}

function renderStatus(isRunning) {
	var renderHTML = "";
	var spanTemp = '<em><span style="color:%s"><strong>%s %s</strong></span></em>';

	if (isRunning) {
		renderHTML += String.format(spanTemp, 'green', _("frp Client"), _("RUNNING"));
	} else {
		renderHTML += String.format(spanTemp, 'red', _("frp Client"), _("NOT RUNNING"));
	}

	return renderHTML;
}

// Execute init script action
function serviceAction(action) {
	return fs.exec('/etc/init.d/frpc', [ action ]).catch(function(e){ return { code: -1, stderr: (e && e.message) || '' }; });
}

function fmtNow() {
	try { return new Date().toLocaleString(); } catch (e) { return new Date().toISOString(); }
}

function updateActionStatus(action, res) {
	var el = document.getElementById('service_action_status');
	if (!el) return;
	var code = (res && typeof res.code !== 'undefined') ? res.code : 'n/a';
	var msg = (res && res.stderr) ? ('' + res.stderr).trim() : '';
	var ok = (code === 0);
	el.innerText = String.format('%s: %s (code=%s) @ %s%s',
		action.toUpperCase(), ok ? _('OK') : _('Failed'), code, fmtNow(), msg ? (' - ' + msg) : '');
	el.style.color = ok ? 'green' : 'red';
}

return view.extend({
	render: function() {
		let m, s, o;

		m = new form.Map('frpc', _('frp Client'));

		s = m.section(form.NamedSection, '_status');
		s.anonymous = true;
		s.render = function (section_id) {
			var refresh = function() {
				return L.resolveDefault(getServiceStatus()).then(function(res) {
					var view = document.getElementById('service_status');
					if (view) view.innerHTML = renderStatus(res);
				});
			};

			L.Poll.add(refresh);

			return E('div', { class: 'cbi-map' },
				E('fieldset', { class: 'cbi-section'}, [
					E('p', { id: 'service_status' }, _('Collecting data ...')),
					E('div', { class: 'cbi-section-actions' }, [
						E('button', { class: 'btn cbi-button-action', click: function(){ serviceAction('start').then(function(res){ updateActionStatus('start', res); }).then(refresh); } }, _('Start now')),
						E('button', { class: 'btn cbi-button-reset', click: function(){ serviceAction('stop').then(function(res){ updateActionStatus('stop', res); }).then(refresh); } }, _('Stop')),
						E('button', { class: 'btn cbi-button-reload', click: function(){ serviceAction('restart').then(function(res){ updateActionStatus('restart', res); }).then(refresh); } }, _('Restart'))
					]),
					E('div', { class: 'cbi-value-description' }, [
						E('small', { id: 'service_action_status', style: 'opacity:0.85' }, _('No actions yet.'))
					])
				])
			);
		}

		s = m.section(form.NamedSection, 'common', 'conf');
		s.dynamic = true;

		// 新分页标签
		s.tab('basic', _('Basic'));
		s.tab('auth', _('Authentication'));
		s.tab('securitytls', _('Security & TLS'));
		s.tab('web', _('Web Admin'));
		s.tab('logging', _('Logging'));
		s.tab('extra', _('Additional'));
		s.tab('init', _('Startup Settings'));

		defTabOpts(s, 'basic', grpBasic);
		defTabOpts(s, 'auth', grpAuth);
		defTabOpts(s, 'securitytls', grpSecurityTLS);
		defTabOpts(s, 'web', grpWeb);
		defTabOpts(s, 'logging', grpLogging);
		defTabOpts(s, 'extra', grpExtra);

		// Backward compatibility: migrate old '_' list if present
		var oldList = m.data.get('frpc', 'common', '_');
		var newList = m.data.get('frpc', 'common', 'extra_settings');
		if (oldList && (!newList || newList.length === 0)) {
			m.data.set('frpc', 'common', 'extra_settings', oldList);
		}

		o = s.taboption('init', form.SectionValue, 'init', form.TypedSection, 'init', _('Startup Settings'));
		s = o.subsection;
		s.anonymous = true;
		s.dynamic = true;

		defOpts(s, startupConf);

		s = m.section(form.GridSection, 'conf', _('Proxy Settings'));
		s.anonymous = true;
		s.addremove = true;
		s.sortable = true;
		s.addbtntitle = _('Add new proxy...');

		s.filter = function(s) { return s !== 'common'; };

		s.tab('general', _('General Settings'));
		s.tab('http', _('HTTP Settings'));
		s.tab('plugin', _('Plugin Settings'));

		s.option(form.Value, 'name', _('Proxy name')).modalonly = false;
		s.option(form.Value, 'type', _('Proxy type')).modalonly = false;
		s.option(form.Value, 'local_ip', _('Local IP')).modalonly = false;
		s.option(form.Value, 'local_port', _('Local port')).modalonly = false;
		o = s.option(form.Value, 'remote_port', _('Remote port'));
		o.modalonly = false;
		o.depends('type', 'tcp');
		o.depends('type', 'udp');
		o.cfgvalue = function() {
			var v = this.super('cfgvalue', arguments);
			return v&&v!='0'?v:'#';
		};

		defTabOpts(s, 'general', baseProxyConf, {modalonly: true});

		// TCP and UDP
		defTabOpts(s, 'general', bindInfoConf, {optional: true, modalonly: true, depends: [{type: 'tcp'}, {type: 'udp'}]});

		// HTTP and HTTPS
		defTabOpts(s, 'http', domainConf, {optional: true, modalonly: true, depends: [{type: 'http'}, {type: 'https'}]});

		// HTTP
		defTabOpts(s, 'http', httpProxyConf, {optional: true, modalonly: true, depends: {type: 'http'}});

		// STCP and XTCP
		defTabOpts(s, 'general', stcpProxyConf, {modalonly: true, depends: [{type: 'stcp'}, {type: 'xtcp'}]});

		// Plugin
		defTabOpts(s, 'plugin', pluginConf, {modalonly: true});

		// Advanced
		s.tab('advanced', _('Advanced Settings'));
		defTabOpts(s, 'advanced', advProxyConf, {optional: true});

		return m.render();
	}
,
	// Restart frpc after Save & Apply so new config takes effect immediately
	handleSaveApply: function(ev) {
		var self = this;
		return this.super('handleSaveApply', ev).then(function(res) {
			return fs.exec('/etc/init.d/frpc', [ 'restart' ]).catch(function(e){ return null; }).then(function(){ return res; });
		});
	}
});
