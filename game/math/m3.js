(function () {
	var m3;

	window.m3 = m3 = {};

	m3.create = function (m) {
		var d;
		d = new nums(9);
		if (m) {
			d[0] = m[0];
			d[1] = m[1];
			d[2] = m[2];
			d[3] = m[3];
			d[4] = m[4];
			d[5] = m[5];
			d[6] = m[6];
			d[7] = m[7];
			d[8] = m[8];
		}
		return d;
	};

	m3.set = function (m, d) {
		d[0] = m[0];
		d[1] = m[1];
		d[2] = m[2];
		d[3] = m[3];
		d[4] = m[4];
		d[5] = m[5];
		d[6] = m[6];
		d[7] = m[7];
		d[8] = m[8];
		return d;
	};

	m3.identity = function (d) {
		d[0] = 1;
		d[1] = 0;
		d[2] = 0;
		d[3] = 0;
		d[4] = 1;
		d[5] = 0;
		d[6] = 0;
		d[7] = 0;
		d[8] = 1;
		return d;
	};

	m3.transpose = function (m, d) {
		var a01, a02, a12;
		if (d == null || m === d) {
			// if no d or matrixes are same
			// we must use this method
			a01 = m[1];
			a02 = m[2];
			a12 = m[5];
			m[1] = m[3];
			m[2] = m[6];
			m[3] = a01;
			m[5] = m[7];
			m[6] = a02;
			m[7] = a12;
			return m;
		}
		d[0] = m[0];
		d[1] = m[3];
		d[2] = m[6];
		d[3] = m[1];
		d[4] = m[4];
		d[5] = m[7];
		d[6] = m[2];
		d[7] = m[5];
		d[8] = m[8];
		return d;
	};

	m3.to_m4 = function (m, d) {
		if (d == null) {
			d = m4.create();
		}
		d[0] = m[0];
		d[1] = m[1];
		d[2] = m[2];
		d[3] = 0;
		d[4] = m[3];
		d[5] = m[4];
		d[6] = m[5];
		d[7] = 0;
		d[8] = m[6];
		d[9] = m[7];
		d[10] = m[8];
		d[11] = 0;
		d[12] = 0;
		d[13] = 0;
		d[14] = 0;
		d[15] = 1;
		return d;
	};

	m3.str = function (m) {
		return "[#{m[0]},#{m[1]},#{m[2]},#{m[3]},#{m[4]},#{m[5]},#{m[6]},#{m[7]},#{m[8]}]";
	};
}).call(this);
