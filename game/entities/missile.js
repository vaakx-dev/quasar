(function () {
	window.StraightMissile = function () {
		class StraightMissile extends Bullet {}

		StraightMissile.prototype.trailSize = 0.1;

		StraightMissile.prototype.trailTime = 94;

		return StraightMissile;
	}.call(this);

	window.TrackingMissile = function () {
		class TrackingMissile extends Bullet {
			move() {
				if (this.dead) {
					return;
				}
				if (
					this.target &&
					!this.target.dead &&
					!this.target.cloaked()
				) {
					v2.sub(this.target.pos, this.pos, this.vel);
					v2.norm(this.vel);
					v2.scale(this.vel, this.speed);
				}
				v2.add(this.pos, this.vel);
				this.rot = v2.angle(this.vel);
				return (this.life += 1);
			}

			tick() {
				var exp;
				if (this.life > this.maxLife) {
					this.dead = true;
					return;
				}
				sim.unitSpaces[otherSide(this.side)].findInRange(
					this.pos,
					this.radius + this.speed + 500,
					(unit) => {
						if (this.collide(unit)) {
							this.hitUnit(unit);
							return true;
						}
						return false;
					},
				);
				if (this.dead) {
					exp = new types.HitExplosion();
					exp.z = 1000;
					exp.pos = [this.pos[0], this.pos[1]];
					exp.vel = [0, 0];
					exp.rot = 0;
					exp.radius = 0.5;
					return (sim.things[exp.id] = exp);
				}
			}
		}

		TrackingMissile.prototype.image = "img/unitBar/pip1.png";

		TrackingMissile.prototype.size = [1, 1];

		TrackingMissile.prototype.color = [0, 0, 0, 255];

		TrackingMissile.prototype.speed = 15;

		TrackingMissile.prototype.damage = 8;

		TrackingMissile.prototype.radius = 10;

		TrackingMissile.prototype.missile = true;

		TrackingMissile.prototype.trailSize = 0.1;

		TrackingMissile.prototype.trailTime = 94;

		return TrackingMissile;
	}.call(this);

	types.Debree = function () {
		class Debree extends Particle {
			tick() {
				return (this.rot += this.vrot);
			}
		}

		Debree.prototype.image = null;

		Debree.prototype.maxLife = 16 * 5;

		Debree.prototype.radius = 2;

		Debree.prototype.size = [1, 1];

		return Debree;
	}.call(this);
}).call(this);
