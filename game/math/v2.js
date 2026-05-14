(function () {
	var v2;

	window.v2 = v2 = {};

	v2.created = 0;

	v2.create = function (a) {
		var d;
		v2.created += 1;
		d = new nums(2);
		if (a != null) {
			d[0] = a[0];
			d[1] = a[1];
		}
		return d;
	};

	v2.zero = function (d) {
		d[0] = 0;
		d[1] = 0;
		return d;
	};

	v2.set = function (a, d) {
		d[0] = a[0];
		d[1] = a[1];
		return d;
	};

	v2.add = function (a, b, d) {
		if (d == null) {
			d = a;
		}
		d[0] = a[0] + b[0];
		d[1] = a[1] + b[1];
		return d;
	};

	v2.sub = function (a, b, d) {
		if (d == null) {
			d = a;
		}
		d[0] = a[0] - b[0];
		d[1] = a[1] - b[1];
		return d;
	};

	v2.neg = function (a, d) {
		if (d == null) {
			d = a;
		}
		d[0] = -a[0];
		d[1] = -a[1];
		return d;
	};

	v2.scale = function (v, n, d) {
		if (d == null) {
			d = v;
		}
		d[0] = v[0] * n;
		d[1] = v[1] * n;
		return d;
	};

	v2.norm = function (a, d) {
		var len, x, y;
		if (d == null) {
			d = a;
		}
		x = a[0];
		y = a[1];
		len = Math.sqrt(x * x + y * y);
		if (len === 0) {
			d[0] = 0;
			d[1] = 0;
			return d;
		} else if (len === 1) {
			d[0] = x;
			d[1] = y;
			return d;
		}
		d[0] = x / len;
		d[1] = y / len;
		return d;
	};

	v2.angle = function (a) {
		a = Math.atan2(a[1], a[0]) + Math.PI / 2;
		while (a > Math.PI) {
			a -= Math.PI * 2;
		}
		while (a < -Math.PI) {
			a += Math.PI * 2;
		}
		return a;
	};

	v2.angleBetween = function (a, b) {
		return Math.atan2(a[1] - b[1], a[0] - b[1]);
	};

	v2.mag = function (v) {
		var x, y;
		x = v[0];
		y = v[1];
		return Math.sqrt(x * x + y * y);
	};

	v2.dot = function (a, b) {
		return a[0] * b[0] + a[1] * b[1];
	};

	v2.direction = function (from, to, d) {
		if (d == null) {
			d = from;
		}
		v2.sub(from, to, d);
		v2.norm(d);
		return d;
	};

	v2.distance = function (from, to) {
		var x, y;
		x = to[0] - from[0];
		y = to[1] - from[1];
		return Math.sqrt(x * x + y * y);
	};

	v2.distanceSq = function (from, to) {
		var x, y;
		x = to[0] - from[0];
		y = to[1] - from[1];
		return x * x + y * y;
	};

	v2.lerp = function (a, b, lerp, d) {
		if (d == null) {
			d = a;
		}
		d[0] = a[0] + lerp * (b[0] - a[0]);
		d[1] = a[1] + lerp * (b[1] - a[1]);
		return d;
	};

	v2.random = function (v) {
		v[0] = Math.random() - 0.5;
		v[1] = Math.random() - 0.5;
		return v2.norm(v);
	};

	v2.rotate = function (v, th, d) {
		var cos, sin, v0, v1;
		if (d == null) {
			d = v;
		}
		sin = Math.sin(th);
		cos = Math.cos(th);
		v0 = v[0];
		v1 = v[1];
		d[0] = v0 * cos - v1 * sin;
		d[1] = v0 * sin + v1 * cos;
		return d;
	};

	v2.pointTo = function (d, th) {
		d[0] = Math.cos(th - Math.PI / 2);
		d[1] = Math.sin(th - Math.PI / 2);
		return d;
	};

	v2.str = function (v) {
		return `(${Math.round((v[0])*10000)/10000},${Math.round((v[1])*10000)/10000})`;
	};
}).call(this);
