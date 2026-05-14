(function () {
	var _color,
		_offset,
		ref,
		boundMethodCheck = function (instance, Constructor) {
			if (!(instance instanceof Constructor)) {
				throw new Error(
					"Bound instance method accessed before binding",
				);
			}
		};

	window.Part = function () {
		class Part {
			flippedSize() {
				var xsize, ysize;
				xsize = this.size[0];
				ysize = this.size[1];
				if (this.dir % 2 === 0) {
					return [xsize, ysize];
				} else {
					return [ysize, xsize];
				}
			}

			constructor() {
				this.pos = v2.create();
				this.worldPos = v2.create();
				this.orignalImage = this.image;
			}

			computeWorldPos() {
				v2.set(this.pos, this.worldPos);
				v2.sub(this.worldPos, this.unit.center);
				v2.rotate(
					this.worldPos,
					Math.PI + this.unit.rot,
					this.worldPos,
				);
				return v2.add(this.worldPos, this.unit.pos);
			}

			tick() {}
		}

		Part.prototype.hp = 10;

		Part.prototype.cost = 10;

		Part.prototype.mass = 40;

		Part.prototype.rot = 0;

		Part.prototype.dir = 0;

		Part.prototype.canRotate = true;

		Part.prototype.flip = true;

		Part.prototype.scale = 1;

		Part.prototype.opacity = 1;

		return Part;
	}.call(this);

	_color = [0, 0, 0, 0];

	window.Engine = function () {
		class Engine extends Part {
		}

		Engine.prototype.trailSize = 0.1;

		Engine.prototype.trailTime = 32;

		Engine.prototype.canRotate = false;

		return Engine;
	}.call(this);

	_offset = [0, 0];

	ref = window.Turret = function () {
		class Turret extends Part {
			constructor() {
				super();
				this.canShoot = this.canShoot.bind(this);
				this.reload = 0;
				this.rot = 0;
				this.fireTimer = 0;
				this.pos = v2.create();
				this.worldPos = v2.create();
				this.orignalImage = this.image;
				this._rot = 0;
				this._rot2 = 0;
			}

			init() {
				var j, len, part, ref1, results;
				ref1 = this.unit.parts;
				results = [];
				for (j = 0, len = ref1.length; j < len; j++) {
					part = ref1[j];
					if (part.mount && v2.distance(part.pos, this.pos) < 0.1) {
						part.turret = this;
						this.arc = part.arc;
						results.push(
							typeof part.initTurret === "function"
								? part.initTurret(this)
								: void 0,
						);
					} else {
						results.push(void 0);
					}
				}
				return results;
			}

			applyBuffs() {
				this.range *= this.weaponRange;
				this.range += this.weaponRangeFlat;
				this.damage *= this.weaponDamage;
				this.energyDamage *= this.weaponDamage;
				this.bulletSpeed *= this.weaponSpeed;
				this.minRange *= 1 + (this.weaponSpeed - 1) / 2;
				this.reloadTime *= this.weaponReload;
				this.shotEnergy *= this.weaponEnergy;
				this.reloadTime = Math.ceil(this.reloadTime);
				this.fireEnergy = this.shotEnergy / this.reloadTime;
				return (this.dps = this.damage / this.reloadTime);
			}

			tick() {
				var angle, halfArc;
				if (this.reload > 0) {
					this.reload -= 1;
				}
				this.working =
					this.reload <= 1 && this.unit.energy > this.shotEnergy;
				// slowly turn to face forward
				if (!this.target) {
					this.rot = turnAngle(this.rot, this.unit.rot, 0.075);
				}
				// make sure turret is never over its arc
				halfArc = ((this.arc / 180) * Math.PI) / 2;
				angle = angleBetween(this.unit.rot, this.rot);
				if (angle > halfArc) {
					this.rot = this.unit.rot + halfArc;
				}
				if (angle < -halfArc) {
					this.rot = this.unit.rot - halfArc;
				}
				if (
					this.unit.target !== null &&
					this.canShoot(this.unit.target)
				) {
					this.target = this.unit.target;
					return this.fire();
				} else if (this.target !== null && this.canShoot(this.target)) {
					return this.fire();
				} else {
					//sim.timeIt "findTarget", =>
					return this.findTarget();
				}
			}

			clientTick() {
				var ditance, target, th;
				target = intp.things[this.targetId];
				if (target) {
					// aim and predict were the target will be
					[th, ditance] = this.aim(target);
					this._rot = th;
				} else {
					return (this._rot = turnAngle(
						this._rot,
						this.unit.rot,
						0.075,
					));
				}
			}

			aim(thing) {
				sim.timeStart("aim");
				var rx = thing.pos[0] - this.worldPos[0];
				var ry = thing.pos[1] - this.worldPos[1];

				// Instant fire
				if (this.instant) {
					sim.timeEnd("aim");
					return [
						v2.angle([rx, ry]),
						Math.hypot(rx, ry) - thing.radius,
					];
				}

				var vx = thing.vel[0];
				var vy = thing.vel[1];
				var s = this.bulletSpeed;
				var R = thing.radius;
				var rr = rx * rx + ry * ry;
				var rmag = Math.sqrt(rr);

				// Already inside radius
				if (rmag <= R) {
					sim.timeEnd("aim");
					return [v2.angle([rx, ry]), 0];
				}

				var vr = rx * vx + ry * vy;
				var vv = vx * vx + vy * vy;
				var a = vv - s * s;
				var b = 2 * (vr - s * R);
				var c = rr - R * R;
				var t = -1;
				var max_time = this.range / s;

				if (a * a < 1e-24) {
					if (b * b > 1e-18) {
						var tl = -c / b;
						if (tl >= 0 && tl <= max_time) t = tl;
					}
				} else {
					var disc = b * b - 4 * a * c;
					if (disc >= 0) {
						var sd = Math.sqrt(disc);
						var t1 = (-b - sd) / (2 * a);
						var t2 = (-b + sd) / (2 * a);
						if (t1 >= 0 && t1 <= max_time) t = t1;
						if (t2 >= 0 && t2 <= max_time && (t < 0 || t2 < t))
							t = t2;
					}
				}

				var px, py;
				if (t < 0) {
					var tca =
						vv > 1e-9
							? Math.max(0, Math.min(-vr / vv, max_time))
							: 0;
					px = rx + vx * tca;
					py = ry + vy * tca;
				} else {
					px = rx + vx * t;
					py = ry + vy * t;
				}

				sim.timeEnd("aim");
				return [v2.angle([px, py]), Math.hypot(px, py) - R];
			}

			canShoot(other) {
				var aimDistance, arcAngle, distance, th;
				boundMethodCheck(this, ref);
				if (!other.unit && !(other.missile && this.hitsMissiles)) {
					return false;
				}
				if (other.dead || other.hp <= 0 || other.applyDamage == null) {
					return false;
				}
				if (this.unit.id === other.id) {
					return false;
				}
				// side constraint
				if (this.unit.side === other.side) {
					return false;
				}
				if (other.missile && other.explode === false) {
					return false;
				}
				if (other.cloak > 0 && other.cloaked()) {
					return false;
				}
				distance = v2.distance(this.worldPos, other.pos);
				// optimization, if unit is way far just ignore it
				if (distance > this.range * 2) {
					return false;
				}
				// if must be in
				if (this.onlyInRange) {
					if (
						distance + other.radius < this.minRange ||
						distance - other.radius > this.range
					) {
						return false;
					}
				}
				[th, aimDistance] = this.aim(other);
				// distance constraint
				if (aimDistance < this.minRange || aimDistance > this.range) {
					return false;
				}
				arcAngle = angleBetween(this.unit.rot, th);
				if ((Math.abs(arcAngle) / Math.PI) * 180 > this.arc / 2) {
					return false;
				}
				if (this.noOverkill) {
					// Force target (f lock) overrides overkill logic
					if (this.unit.target) {
						if (this.unit.target.id === other.id) {
							return true;
						} else {
							return false;
						}
					}

					// Don't shoot if either HP or energy would overkill (check current values)
					var hpOverkill = other.hp * 2 < this.damage;
					var energyOverkill = this.energyDamage && other.energy * 2 < this.energyDamage;

					if (hpOverkill || energyOverkill) {
						return false;
					}
				}
				return true;
			}

			findTarget() {
				var j, l, len, len1, m, ref1, ref2, results, u;
				if (this.unit.target && !this.hitsMissiles) {
					this.target = this.unit.target;
					return;
				}
				this.target = null;
				if (this.hitsMissiles) {
					ref1 = this.unit.closestEnemyBullets();
					for (j = 0, len = ref1.length; j < len; j++) {
						m = ref1[j];
						if (this.canShoot(m)) {
							this.target = m;
							break;
						}
					}
					if (this.target) {
						return;
					}
				}
				ref2 = this.unit.closestEnemies();
				results = [];
				for (l = 0, len1 = ref2.length; l < len1; l++) {
					u = ref2[l];
					if (this.canShoot(u)) {
						this.target = u;
						break;
					} else {
						results.push(void 0);
					}
				}
				return results;
			}

			fire() {
				var angleLeft, dist, rot;
				[rot, dist] = this.aim(this.target);
				this.rot = turnAngle(this.rot, rot, 1);
				angleLeft = angleBetween(this.rot, rot);
				// if not ameing at target
				if (Math.abs(angleLeft) > 0.01) {
					return;
				}
				if (this.reload > 0) {
					return;
				}
				if (this.unit.energy < this.shotEnergy) {
					return;
				}
				// acctually fire here
				this.reload = this.reloadTime;
				this.unit.energy -= this.shotEnergy;
				return this.makeBullet(dist);
			}

			makeBullet(distance) {
				var exp, particle;
				this.unit.cloak = 0;
				particle = new this.bulletCls();
				sim.things[particle.id] = particle;
				particle.side = this.unit.side;
				particle.life = 0;
				particle.dead = false;
				particle.z = this.unit.z + 0.001;
				particle.turretNum = this.turretNum;
				particle.origin = this.unit;
				particle.weapon = this;
				particle.target = this.target;
				particle.speed = this.bulletSpeed;
				particle.damage = this.damage;
				particle.energyDamage = this.energyDamage;
				particle.hitsMissiles = this.hitsMissiles;
				particle.aoe = this.aoe;
				particle.burnAmount = this.burnAmount;
				v2.set(this.worldPos, particle.pos);
				v2.pointTo(particle.vel, this.rot);
				v2.scale(particle.vel, particle.speed);
				particle.rot = this.rot;
				if (this.instant) {
					particle.targetPos = v2.create(particle.target.pos);
					if (this.target.maxLife) {
						this.target.life = this.target.maxLife;
						this.target.explode = false;
						// add little puffs for missiles going a way
						exp = new types.HitExplosion();
						exp.z = 1000;
						exp.pos = [this.target.pos[0], this.target.pos[1]];
						exp.vel = [0, 0];
						exp.rot = 0;
						exp.radius = 0.5;
						sim.things[exp.id] = exp;
					} else {
						this.target.applyDamage(particle.damage);
					}
				} else if (this.exactRange) {
					particle.maxLife = Math.floor(distance / particle.speed);
					// compute final position
					particle.hitPos = v2.create();
					v2.add(particle.hitPos, particle.vel);
					v2.scale(particle.hitPos, distance / particle.speed);
					v2.add(particle.hitPos, particle.pos);
				} else {
					particle.maxLife = Math.floor(
						(this.range / particle.speed) * (1 + this.overshoot),
					);
				}
				return typeof particle.postFire === "function"
					? particle.postFire()
					: void 0;
			}
		}

		Turret.prototype.tab = "weapons";

		Turret.prototype.image = "turret01.png";

		Turret.prototype.gimble = true;

		Turret.prototype.weapon = true;

		Turret.prototype.canRotate = false;

		Turret.prototype.target = null;

		Turret.prototype.bulletCls = types.FlyerBullet;

		Turret.prototype.range = 500;

		Turret.prototype.damage = 0;

		Turret.prototype.energyDamage = 0;

		Turret.prototype.bulletSpeed = 1;

		Turret.prototype.reloadTime = 10;

		Turret.prototype.overshoot = 0.3;

		Turret.prototype.minRange = -1000;

		Turret.prototype.instant = false;

		Turret.prototype.accuracy = 0;

		Turret.prototype.exactRange = false;

		Turret.prototype.arc = 0;

		// regular mods
		Turret.prototype.weaponRange = 1;

		Turret.prototype.weaponRangeFlat = 0;

		Turret.prototype.weaponDamage = 1;

		Turret.prototype.weaponEnergyDamage = 1;

		Turret.prototype.weaponSpeed = 1;

		Turret.prototype.weaponReload = 1;

		Turret.prototype.weaponEnergy = 1;

		// ai mods
		Turret.prototype.noOverkill = false;

		return Turret;
	}.call(this);
}).call(this);
