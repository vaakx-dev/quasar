(function () {
	window.Particle = function () {
		class Particle {
			constructor() {
				this.id = sim.nid();
				this.color = [255, 255, 255, 255];
				this.life = 0;
				this.dead = false;
				this.z = Math.random();
				this.pos = v2.create();
				this.vel = v2.create();
				this._pos = v2.create();
				this._pos2 = v2.create();
				this.rot = 0;
			}

			move() {
				if (this.dead) {
					return;
				}
				v2.add(this.pos, this.vel);
				this.life += 1;
				if (this.life > this.maxLife) {
					return (this.dead = true);
				}
			}
		}

		Particle.prototype.image = null;

		Particle.prototype.size = [0.1, 0.1];

		Particle.prototype.maxLife = 60;

		Particle.prototype.radius = 1;

		return Particle;
	}.call(this);
}).call(this);
