// Extracted from game/core/maths.js (CoffeeScript 2.7.0 output)
(function () {
	var v3;

	window.v3 = v3 = {};

	v3.create = function (a) {
		var d;
		d = new nums(3);
		if (a != null) {
			d[0] = a[0];
			d[1] = a[1];
			d[2] = a[2];
		}
		return d;
	};

	v3.zero = function (d) {
		d[0] = 0;
		d[1] = 0;
		d[2] = 0;
		return d;
	};

	v3.set = function (a, d) {
		d[0] = a[0];
		d[1] = a[1];
		d[2] = a[2];
		return d;
	};

	v3.add = function (a, b, d) {
		if (d == null) {
			d = a;
		}
		d[0] = a[0] + b[0];
		d[1] = a[1] + b[1];
		d[2] = a[2] + b[2];
		return d;
	};

	v3.sub = function (a, b, d) {
		if (d == null) {
			d = a;
		}
		d[0] = a[0] - b[0];
		d[1] = a[1] - b[1];
		d[2] = a[2] - b[2];
		return d;
	};

	v3.neg = function (a, d) {
		if (d == null) {
			d = a;
		}
		d[0] = -a[0];
		d[1] = -a[1];
		d[2] = -a[2];
		return d;
	};

	v3.scale = function (v, n, d) {
		if (d == null) {
			d = v;
		}
		d[0] = v[0] * n;
		d[1] = v[1] * n;
		d[2] = v[2] * n;
		return d;
	};

	v3.norm = function (a, d) {
		var len, x, y, z;
		if (d == null) {
			d = a;
		}
		x = a[0];
		y = a[1];
		z = a[2];
		len = Math.sqrt(x * x + y * y + z * z);
		if (len === 0) {
			d[0] = 0;
			d[1] = 0;
			d[2] = 0;
			return d;
		} else if (len === 1) {
			d[0] = x;
			d[1] = y;
			d[2] = z;
			return d;
		}
		d[0] = x / len;
		d[1] = y / len;
		d[2] = z / len;
		return d;
	};

	v3.cross = function (a, b, d) {
		var x, y, z;
		if (d == null) {
			d = a;
		}
		x = a[0];
		y = a[1];
		z = a[2];
		d[0] = y * b[2] - z * b[1];
		d[1] = z * b[0] - x * b[2];
		d[2] = x * b[1] - y * b[0];
		return d;
	};

	v3.angle = function (a, b) {
		var cosa, cross, mg, sina, th;
		mg = v3.mag(a) * v3.mag(b);
		cross = v3.cross(a, b, v3.create());
		sina = v3.mag(cross);
		sina /= mg;
		cosa = v3.dot(a, b);
		cosa /= mg;
		th = Math.atan(sina, cosa);
		return th;
	};

	v3.mag = function (v) {
		var x, y, z;
		x = v[0];
		y = v[1];
		z = v[2];
		return Math.sqrt(x * x + y * y + z * z);
	};

	v3.dot = function (a, b) {
		return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
	};

	v3.direction = function (from, to, d) {
		if (d == null) {
			d = from;
		}
		v3.sub(from, to, d);
		v3.norm(d);
		return d;
	};

	v3.distance = function (from, to) {
		var x, y, z;
		x = to[0] - from[0];
		y = to[1] - from[1];
		z = to[2] - from[2];
		return Math.sqrt(x * x + y * y + z * z);
	};

	v3.lerp = function (a, b, lerp, d) {
		if (d == null) {
			d = a;
		}
		d[0] = a[0] + lerp * (b[0] - a[0]);
		d[1] = a[1] + lerp * (b[1] - a[1]);
		d[2] = a[2] + lerp * (b[2] - a[2]);
		return d;
	};

	v3.random = function (v) {
		v[0] = Math.random() - 0.5;
		v[1] = Math.random() - 0.5;
		v[2] = Math.random() - 0.5;
		return v3.norm(v);
	};

	v3.str = function (v) {
		return `(${Math.round((v[0])*10000)/10000},${Math.round((v[1])*10000)/10000},${Math.round((v[2])*10000)/10000})`;
	};
}).call(this);
