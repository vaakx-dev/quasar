(function () {
	types.Rock = function () {
		class Rock {
			constructor() {
				this.image = "img/rocks/srock01.png";
				if (typeof sim !== "undefined" && sim !== null) {
					this.color = sim.theme.fillColor;
				}
				this.id = sim.nid();
				this.dead = false;
				this.hp = this.maxHP;
				this.pos = v2.create([0, 0]);
				this.vel = v2.create([0, 0]);
				this.rot = 0;
				this.size = v2.create([1, 1]);
			}

			move() {}
		}

		Rock.prototype.image = "img/unitBar/pip1.png";

		Rock.prototype.size = [1, 1];

		Rock.prototype.static = true;

		Rock.prototype.maxHP = 1000;

		return Rock;
	}.call(this);

	types.CommandPoint = function () {
		class CommandPoint {
			constructor() {
				this.id = sim.nid();
				this.dead = false;
				this.z = 0.01;
				this.hp = this.maxHP;
				this.pos = v2.create(0, 0);
				this.vel = [0, 0];
				this.rot = 0;
				this.color = [255, 255, 255, 255];
				this.side = "neutral";
				this.capping = 0;
			}

			tick() {
				var _,
					distance,
					id,
					j,
					k,
					len,
					p,
					player,
					playerOnPoint,
					ref,
					ref1,
					results,
					sides,
					thing;
				if (sim.state !== "running") {
					return;
				}
				// tick every second only
				if (sim.step % 16 === 0) {
					// give money to players
					if (this.side !== null) {
						ref = sim.players;
						for (_ in ref) {
							p = ref[_];
							if (p && p.side === this.side) {
								if (p.gainsMoney && sim.gainsMoney) {
									p.earnMoney(1);
								}
							}
						}
					}
					sides = {};
					playerOnPoint = [];
					ref1 = sim.things;
					for (id in ref1) {
						thing = ref1[id];
						if (thing.unit && thing.canCapture) {
							distance = v2.distance(this.pos, thing.pos);
							if (distance < this.radius) {
								sides[thing.side] = true;
								player = sim.players[thing.owner];
								if (player) {
									playerOnPoint.push(player);
								}
							}
						}
					}
					sides = (function () {
						var results;
						results = [];
						for (k in sides) {
							results.push(k);
						}
						return results;
					})();
					if (sides.length === 1 && this.side !== sides[0]) {
						this.capping += 1;
						if (this.capping >= this.maxCapp) {
							this.side = sides[0];
							sim.captures += 1;
							this.capping = 0;
							this.bonus(this.side, 100);
							results = [];
							for (
								j = 0, len = playerOnPoint.length;
								j < len;
								j++
							) {
								p = playerOnPoint[j];
								results.push((p.capps += 1));
							}
							return results;
						}
					} else {
						if (this.capping > 0) {
							return (this.capping -= 1);
						}
					}
				}
			}

			bonus(side, amount) {
				var _, p, ref, results;
				ref = sim.players;
				results = [];
				for (_ in ref) {
					p = ref[_];
					if (p.side === this.side) {
						if (p.gainsMoney && sim.gainsMoney) {
							results.push(p.earnMoney(amount));
						} else {
							results.push(void 0);
						}
					} else {
						results.push(void 0);
					}
				}
				return results;
			}
		}

		CommandPoint.prototype.image = "img/point02.png";

		// TODO: Oscar - Change sliceImage to modify the capture progress bar
		CommandPoint.prototype.sliceImage = "img/map/slice02.png";

		CommandPoint.prototype.maxHP = 1000;

		CommandPoint.prototype.size = [1, 1];

		CommandPoint.prototype.maxHP = 1000;

		CommandPoint.prototype.radius = 250;

		CommandPoint.prototype.commandPoint = true;

		CommandPoint.prototype.capping = 0;

		// TODO: Oscar - Mess with maxCapp to change CP times, it breaks the visuals though
		CommandPoint.prototype.maxCapp = 10;

		return CommandPoint;
	}.call(this);

	types.SpawnPoint = function () {
		class SpawnPoint {
			constructor() {
				this.id = sim.nid();
				this.dead = false;
				this.z = 0.01;
				this.hp = this.maxHP;
				this.pos = v2.create(0, 0);
				this.vel = [0, 0];
				this.rot = 0;
				this.color = [255, 255, 255, 255];
				this.side = "neutral";
			}
		}

		SpawnPoint.prototype.image = "";

		SpawnPoint.prototype.sliceImage = "img/map/spawnSlice.png";

		SpawnPoint.prototype.maxHP = 1000;

		SpawnPoint.prototype.size = [1, 1];

		SpawnPoint.prototype.maxHP = 1000;

		SpawnPoint.prototype.static = true;

		SpawnPoint.prototype.radius = 400;

		SpawnPoint.prototype.spawn = true;

		SpawnPoint.prototype.side = null;

		return SpawnPoint;
	}.call(this);
}).call(this);
