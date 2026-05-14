(function () {
	window.Bullet = function () {
		class Bullet extends Particle {
			constructor() {
				super();
			}

			applyDamage() {
				// TODO REMOVE?
				return (this.dead = true);
			}

			move() {
				if (this.dead) {
					return;
				}
				v2.add(this.pos, this.vel);
				return (this.life += 1);
			}

			tick() {
				var exp;
				if (this.life > this.maxLife) {
					this.dead = true;
					return;
				}
				if (this.explode === false) {
					this.dead = true;
					return;
				}
				this.scan();
				if (this.dead) {
					exp = new types[this.hitExplosion]();
					exp.z = 1000;
					exp.pos = [this.pos[0], this.pos[1]];
					if (this.t !== null) {
						v2.add(exp.pos, v2.scale(this.vel, this.t));
					}
					exp.vel = [0, 0];
					exp.rot = 0;
					exp.radius = 0.75;
					return (sim.things[exp.id] = exp);
				}
			}

			scan() {
				sim.unitSpaces[otherSide(this.side)].findInRange(
					this.pos,
					this.radius + this.speed + 500,
					(unit) => {
						if (this.collide(unit)) {
							this.hitUnit(unit);
							if (this.hitsMultiple) {
								return false;
							}
							return true;
						}
						return false;
					},
				);
				if (this.hitsMissiles) {
					return sim.bulletSpaces[otherSide(this.side)].findInRange(
						this.pos,
						this.radius + this.speed + 100,
						(missle) => {
							if (missle.missile && this.collide(missle)) {
								this.hitMissle(missle);
								if (this.hitsMultiple) {
									return false;
								}
								return true;
							}
							return false;
						},
					);
				}
			}

			hitUnit(thing) {
				thing.applyDamage(this.damage);
				if (this.energyDamage) {
					thing.applyEnergyDamage(this.energyDamage);
				}
				if (!this.hitsMultiple) {
					return (this.dead = true);
				}
			}

			hitMissle(thing) {
				thing.life = thing.maxLife;
				return (thing.explode = false);
			}

			_collide(thing) {
				var distance, speed;
				distance = v2.distance(this.pos, thing.pos);
				speed = v2.mag(thing.vel) + v2.mag(this.vel);
				return distance < thing.radius; //+ speed
			}

			collide(thing) {
				var c, distance, r, speed, t1, t2, ta, tb, tc, v;
				if (!this.hitsCloak && thing.cloak && thing.cloaked()) {
					return false;
				}
				// check if we are inside the object
				distance = v2.distance(this.pos, thing.pos);
				if (distance < thing.radius + this.radius) {
					return true;
				}
				// check if we can't possibly hit
				speed = v2.mag(thing.vel) + v2.mag(this.vel);
				if (distance > thing.radius + this.radius + speed) {
					return false;
				}
				this.t = null;
				c = [0, 0];
				v2.sub(this.pos, thing.pos, c);
				v = [0, 0];
				v2.sub(this.vel, thing.vel, v);
				r = this.radius + thing.radius;
				ta = -(c[0] * v[0] + c[1] * v[1]);
				tb = Math.sqrt(
					r * r * (v[0] * v[0] + v[1] * v[1]) -
						Math.pow(c[0] * v[1] - c[1] * v[0], 2),
				);
				tc = v[0] * v[0] + v[1] * v[1];
				t1 = (ta - tb) / tc;
				t2 = (ta + tb) / tc;
				if (t1 > 0 && t1 < t2) {
					this.t = t1;
				}
				if (t2 > 0 && t2 < t1) {
					this.t = t2;
				}
				if (this.t !== null) {
					return this.t > 0 && this.t < 1;
				}
				return false;
			}

			__collide(thing) {
				var distance, j, len, part, ref, speed;
				if (!this.hitsCloak && thing.cloak && thing.cloaked()) {
					return false;
				}
				// check if we can't possibly hit
				speed = v2.mag(thing.vel) + v2.mag(this.vel);
				if (distance > thing.radius + this.radius + speed) {
					return false;
				}
				// check if we are inside the object
				distance = v2.distance(this.pos, thing.pos);
				if (distance < thing.radius + this.radius) {
					ref = thing.parts;
					for (j = 0, len = ref.length; j < len; j++) {
						part = ref[j];
						distance =
							v2.distance(this.pos, part.worldPos) -
							this.radius -
							10;
						if (distance < 0) {
							return true;
						}
					}
				}
				return false;
			}
		}

		Bullet.prototype.image = "img/unitBar/pip1.png";

		Bullet.prototype.damage = 1;

		Bullet.prototype.speed = 10;

		Bullet.prototype.size = [1, 1];

		Bullet.prototype.bullet = true;

		Bullet.prototype.radius = 10;

		Bullet.prototype.hitsMultiple = false;

		Bullet.prototype.hitExplosion = "HitExplosion";

		Bullet.prototype.side = null;

		Bullet.prototype.hitsCloak = false;

		return Bullet;
	}.call(this);

	window.LaserBullet = function () {
		class LaserBullet extends Bullet {
			move() {}

			tick() {
				if (this.dead) {
					return;
				}
				this.life += 1;
				if (this.life > this.maxLife) {
					return (this.dead = true);
				}
			}
		}

		LaserBullet.prototype.image = "img/laser01.png";

		LaserBullet.prototype.size = [1, 1];

		LaserBullet.prototype.color = [179, 207, 255, 255];

		LaserBullet.prototype.speed = 2000;

		LaserBullet.prototype.damage = 2.5;

		LaserBullet.prototype.maxLife = 3;

		return LaserBullet;
	}.call(this);

	window.AoeBullet = function () {
		class AoeBullet extends Bullet {
			move() {
				if (this.dead) {
					return;
				}
				return v2.add(this.pos, this.vel);
			}

			tick() {
				var exp;
				this.life += 1;
				if (this.life > this.maxLife) {
					this.dead = true;
					if (this.explode) {
						// set the position on the last frame to be target pos
						exp = new types[this.explodeClass]();
						exp.z = 1000;
						exp.pos = [this.hitPos[0], this.hitPos[1]];
						exp.vel = [0, 0];
						exp.rot = 0;
						exp.aoe = this.aoe;
						exp.side = this.side;
						exp.damage = this.damage;
						return (sim.things[exp.id] = exp);
					}
				}
			}
		}

		AoeBullet.prototype.image = "img/unitBar/pip1.png";

		AoeBullet.prototype.size = [1, 1];

		AoeBullet.prototype.color = [100, 100, 100, 255];

		AoeBullet.prototype.speed = 30;

		AoeBullet.prototype.aoe = 50;

		AoeBullet.prototype.damage = 3;

		AoeBullet.prototype.explode = true;

		AoeBullet.prototype.explodeClass = "AoeExplosion";

		return AoeBullet;
	}.call(this);
}).call(this);
