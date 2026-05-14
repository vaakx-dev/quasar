(function () {
	window.Player = function () {
		class Player {
			constructor(id1) {
				this.id = id1;
				this.side = this.id;
				this.color = randColor(200);
				this.reset();
			}

			reset() {
				var n;
				this.money = sim.defaultMoney;
				this.mouse = [0, 0];
				this.rallyPoint = [0, 0];
				this.selection = [];
				this.buildQ = [];
				this.validBar = (function () {
					var j, results;
					results = [];
					for (n = j = 0; j < 10; n = ++j) {
						results.push(true);
					}
					return results;
				})();
				this.actions = 0;
				this.apm = 0;
				this.capps = 0;
				this.kills = 0;
				this.unitsBuilt = 0;
				this.moneyEarned = 0;
				return (this.mouseTrail = []);
			}

			earnMoney(amount) {
				amount *= this.moneyRatio;
				this.money += amount;
				return (this.moneyEarned += amount);
			}

			tick() {
				if (sim.step % 16 === 0) {
					if (this.gainsMoney && sim.gainsMoney) {
						this.earnMoney(10);
					}
					this.apm = this.actions / (sim.step / 16 / 60);
				}
				if (this.aiRules) {
					sim.timeIt("ai", () => {
						return doPlayerAIRules(this);
					});
				}
				return this.wave();
			}

			wave() {
				var build, i, j, len, n, ref, slot, waitTime;
				waitTime = 16 * 2;
				if (sim.step > waitTime && sim.step % 16 === 0) {
					build = false;
					ref = this.buildQ;
					for (i = j = 0, len = ref.length; j < len; i = ++j) {
						slot = ref[i];
						if (this.rqUnit(slot)) {
							this.buildQ[i] = null;
							build = true;
						} else {
							break;
						}
					}
					if (build) {
						return (this.buildQ = function () {
							var l, len1, ref1, results;
							ref1 = this.buildQ;
							results = [];
							for (l = 0, len1 = ref1.length; l < len1; l++) {
								n = ref1[l];
								if (n !== null) {
									results.push(n);
								}
							}
							return results;
						}.call(this));
					}
				}
			}

			rqUnit(slot) {
				var spawn, unit;
				if (sim.serverType === "survival" && this.side === "beta") {
					unit = survival.rqUnit(sim, this.number, slot);
				} else {
					spawn = sim.findSpawnPoint(this.side);
					if (spawn) {
						unit = sim.buildUnit(this.number, slot, spawn.pos);
						if (unit) {
							v2.random(unit.pos);
							v2.scale(
								unit.pos,
								100 + Math.random() * (spawn.radius - 100),
							);
							v2.add(unit.pos, spawn.pos);
						}
					}
				}
				if (unit) {
					this.unitsBuilt += 1;
					if (this.rallyPoint[0] !== 0 && this.rallyPoint[1] !== 0) {
						unit.setOrder({
							type: "Move",
							dest: this.rallyPoint,
							rally: true,
						});
					}
					return unit;
				}
				return null;
			}

		}

		Player.prototype.gainsMoney = true; // stop player from making money

		Player.prototype.ready = false;

		Player.prototype.actions = 0;

		Player.prototype.apm = 0;

		Player.prototype.capps = 0;

		Player.prototype.kills = 0;

		Player.prototype.unitsBuilt = 0;

		Player.prototype.moneyEarned = 0;

		Player.prototype.moneyRatio = 1;

		Player.prototype.aiRules = null;

		Player.prototype.host = false;

		Player.prototype.ai = false;

		return Player;
	}.call(this);
}).call(this);
