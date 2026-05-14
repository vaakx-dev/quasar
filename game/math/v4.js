(function () {
	var v4;

	window.v4 = v4 = {};

	v4.create = function (a) {
		var d;
		d = new nums(4);
		if (a != null) {
			d[0] = a[0];
			d[1] = a[1];
			d[2] = a[2];
			d[3] = a[3];
		}
		return d;
	};

	v4.str = function (v) {
		return `(${Math.round((v[0])*10000)/10000},${Math.round((v[1])*10000)/10000},${Math.round((v[2])*10000)/10000},${Math.round((v[3])*10000)/10000})`;
	};
}).call(this);
