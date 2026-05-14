(function () {
	window.turnAngle = function (a, b, speed) {
		var turn;
		speed = speed;
		turn = b - a;
		if (turn > Math.PI) {
			a += 2 * Math.PI;
		} else if (turn < -Math.PI) {
			a -= 2 * Math.PI;
		}
		turn = b - a;
		if (turn < speed && turn > -speed) {
			return b;
		}
		if (turn > speed) {
			turn = speed;
		}
		if (turn < -speed) {
			turn = -speed;
		}
		return a + turn;
	};

	window.angleBetween = function (a, b) {
		var turn;
		turn = b - a;
		while (turn > Math.PI) {
			turn -= 2 * Math.PI;
		}
		while (turn < -Math.PI) {
			turn += 2 * Math.PI;
		}
		return turn;
	};
}).call(this);
