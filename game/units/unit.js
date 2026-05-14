(function () {
	var _where;

	_where = [0, 0];

	types.Unit = function () {
		class Unit {
			constructor(spec1) {
				this.closestEnemy = this.closestEnemy.bind(this);
				// Returns the closest uncloaked unit within range or the closest unit
				this.closestUncloaked = this.closestUncloaked.bind(this);
				this.spec = spec1;
				if (this.spec === null) {
					this.spec = [];
				}
				this.id =
					typeof sim !== "undefined" && sim !== null
						? sim.nid()
						: void 0;
				this.side = 0;
				this.color = [255, 0, 0, 255];
				this.z = Math.random();
				this.center = v2.create();
				this.parts = [];
				this.weapons = [];
				this.fromSpec(this.spec);
				this.dead = false;
				this.pos = v2.create();
				this.vel = v2.create();
				this.active = true;
				this.rot = 0;
				this.warpIn = 0;
				this.testIntp = [];
				this.testStep = [];
				this.orders = [];
				this.preOrders = [];
				this.closestEnemiesCache = null;
				this.closestFriendsCache = null;
				this.closestEnemyBulletsCache = null;
			}

			fromSpec(spec) {
				var data,
					i,
					j,
					l,
					len,
					len1,
					len2,
					len3,
					len4,
					n,
					o,
					p,
					part,
					partNum,
					q,
					reachRange,
					ref,
					ref1,
					ref2,
					ref3,
					ref4,
					results,
					stasisRange,
					thrust,
					w;
				this.cost = 0;
				this.hp = 5;
				this.jumpDistance = 0;
				this.jumpCount = 0;
				this.speed = 0;
				this.turnSpeed = 1;
				this.mass = 0;
				this.energy = 0;
				this.baseGenEnergy = 2.5;
				this.genEnergy = this.baseGenEnergy;
				this.storeEnergy = 0;
				this.genShield = 0;
				this.shield = 0;
				this.cloak = 0;
				this.maxSlow = 0;
				this.radius = 20;
				this.weaponArc = 0;
				this.minArc = 0;
				this.maxRange = 0;
				thrust = 0;
				data = fromShort(spec);
				this.name = data.name || "";
				this.aiRules = data.aiRules || [];
				ref = data.parts;
				for (
					partNum = j = 0, len = ref.length;
					j < len;
					partNum = ++j
				) {
					p = ref[partNum];
					if (!window.parts[p.type]) {
						continue;
					}
					part = new window.parts[p.type]();
					part.unit = this;
					part.pos = v2.create(p.pos);
					part.dir = p.dir || 0;
					part.partNum = partNum;
					if (part.weapon) {
						this.weapons.push(part);
					}
					if (p.ghostCopy) {
						part.ghostCopy = true;
					}
					this.parts.push(part);
					this.cost += part.cost || 0;
					this.hp += part.hp || 0;
					thrust += part.thrust || 0;
					this.mass += part.mass;
					this.turnSpeed += part.turnSpeed || 0;
					this.genEnergy += part.genEnergy || 0;
					this.storeEnergy += part.storeEnergy || 0;
					this.genShield += part.genShield || 0;
					this.shield += part.shield || 0;
					this.jumpCount += part.jumpCount || 0;
					this.limitBonus += part.limitBonus || 0;
					if (part.arc && this.weaponArc < part.arc) {
						this.weaponArc = part.arc;
					}
					if (
						part.arc &&
						(this.minArc === 0 || this.minArc > part.arc)
					) {
						this.minArc = part.arc;
					}
					if (p.type === "EnergyTransfer") {
						if (part.range > this.maxRange) {
							this.maxRange = part.range;
						}
					}
					if (p.type === "StasisField") {
						stasisRange =
							part.range +
							v2.distance(part.pos, this.center) +
							100;
						if (stasisRange > this.maxRange) {
							this.maxRange = stasisRange;
						}
					}
				}
				this.maxHP = this.hp;
				this.energy = this.storeEnergy;
				if (this.mass > 0) {
					this.turnSpeed = this.turnSpeed / this.mass;
					this.maxSpeed = (thrust / this.mass) * 9;
					this.jumpDistance = this.jump =
						Math.min(1, (41 * this.jumpCount) / this.mass) * 600;
				} else {
					this.turnSpeed = 0;
					this.maxSpeed = 0;
					this.jumpDistance = this.jump = 0;
				}
				this.maxShield = this.shield;
				this.damageRatio = 1;
				this.computeCenter();
				ref1 = this.parts;
				for (l = 0, len1 = ref1.length; l < len1; l++) {
					part = ref1[l];
					if (typeof part.init === "function") {
						part.init();
					}
				}
				this.computeRadius();
				this.weaponRange = 0;
				this.weaponDPS = 0;
				this.weaponDamage = 0;
				ref2 = this.weapons;
				for (n = 0, len2 = ref2.length; n < len2; n++) {
					w = ref2[n];
					w.applyBuffs();
					w.reloadTime = Math.ceil(w.reloadTime);
					if (w.reloadTime < 1) {
						w.reloadTime = 1;
					}
					if (w.range > this.weaponRange) {
						this.weaponRange = w.range;
					}
					reachRange = w.range + v2.distance(w.pos, this.center);
					if (reachRange > this.maxRange) {
						this.maxRange = reachRange;
					}
					w.dps = w.damage / w.reloadTime;
					this.weaponDamage += w.damage;
					this.weaponDPS += w.dps;
				}
				this.weapons.sort(function (a, b) {
					return b.dps - a.dps;
				});
				this.mainWeapon = this.weapons[0];
				ref3 = this.weapons;
				for (i = o = 0, len3 = ref3.length; o < len3; i = ++o) {
					w = ref3[i];
					w.turretNum = i;
				}
				this.moveEnergy = 0;
				this.fireEnergy = 0;
				this.maxSlow = 0;
				ref4 = this.parts;
				results = [];
				for (q = 0, len4 = ref4.length; q < len4; q++) {
					part = ref4[q];
					if (part.thrust > 0) {
						this.moveEnergy += part.useEnergy;
					}
					if (part.fireEnergy > 0) {
						this.fireEnergy += part.fireEnergy;
					}
					if (part.maxSlow > 0) {
						results.push((this.maxSlow += part.maxSlow));
					} else {
						results.push(void 0);
					}
				}
				return results;
			}

			toSpecObj() {
				var j, len, part, partSpec, ref, specParts;
				specParts = [];
				ref = this.parts;
				for (j = 0, len = ref.length; j < len; j++) {
					part = ref[j];
					partSpec = {
						pos: [part.pos[0], part.pos[1]],
						type: part.constructor.name,
						dir: part.dir,
					};
					if (this.ghostCopy || part.ghostCopy) {
						partSpec.ghostCopy = true;
						if (part.decal) {
							continue;
						}
					}
					specParts.push(partSpec);
				}
				return {
					parts: specParts,
					name: this.name,
					aiRules: this.aiRules,
				};
			}

			toSpec() {
				return toShort(this.toSpecObj());
			}

			computeCenter() {
				var ix, iy, j, len, part, partArea, ref, totalArea;
				ix = 0;
				iy = 0;
				totalArea = 0;
				ref = this.parts;
				for (j = 0, len = ref.length; j < len; j++) {
					part = ref[j];
					if (part.mass > 0 && !(part instanceof Turret)) {
						partArea = part.size[0] * part.size[1];
						totalArea += partArea;
						ix += partArea * part.pos[0];
						iy += partArea * part.pos[1];
					}
				}
				if (totalArea > 0) {
					this.center[0] = ix / totalArea;
					return (this.center[1] = iy / totalArea);
				} else {
					this.center[0] = 0;
					return (this.center[1] = 0);
				}
			}

			computeRadius() {
				var j, len, part, radius, ref, v;
				v = v2.create();
				ref = this.parts;
				for (j = 0, len = ref.length; j < len; j++) {
					part = ref[j];
					if (!!part.decal) {
						continue;
					}
					v2.set(part.pos, v);
					v2.sub(v, this.center);
					radius = v2.mag(v);
					if (radius > this.radius) {
						this.radius = radius;
					}
				}
				if (this.radius > 500) {
					return (this.radius = 500);
				}
			}

			applyDamage(d) {
				this.shield -= d;
				if (this.shield < 0) {
					this.hp += this.shield;
					return (this.shield = 0);
				}
			}

			applyEnergyDamage(d) {
				return (this.energy -= d);
			}

			applyBurnAmount(d) {
				this.maxBurn = (this.hp + this.shield) * 1.0;
				if (this.burn < this.maxBurn) {
					this.burn += d;
					if (this.burn > this.maxBurn) {
						return (this.burn = this.maxBurn);
					}
				}
			}

			postDeath() {
				var j, len, part, ref;
				ref = this.parts;
				for (j = 0, len = ref.length; j < len; j++) {
					part = ref[j];
					if (typeof part.postDeath === "function") {
						part.postDeath();
					}
				}
				return (sim.deaths += 1);
			}

			createDebree() {
				var exp, j, len, part, ref, results;
				ref = this.parts;
				results = [];
				for (j = 0, len = ref.length; j < len; j++) {
					part = ref[j];
					if (Math.random() < 0.5 || part.decal) {
						continue;
					}
					exp = new types.Debree();
					if (part.stripe) {
						exp.image = "parts/gray-" + part.image;
					} else {
						exp.image = "parts/" + part.image;
					}
					exp.z = this.z + rand() * 0.01;
					exp.pos = [0, 0];
					part.computeWorldPos();
					v2.set(part.worldPos, exp.pos);
					v2.set(this.vel, exp.vel);
					exp.vel[0] +=
						(part.worldPos[0] - this.pos[0]) * 0.1 + rand();
					exp.vel[1] +=
						(part.worldPos[1] - this.pos[1]) * 0.1 + rand();
					exp.rot = this.rot;
					exp.vrot = rand();
					results.push((intp.particles[exp.id] = exp));
				}
				return results;
			}

			gotoAndStop(goto) {
				return this.setOrder({
					type: "Move",
					dest: goto,
					noStop: true,
				});
			}

			gotoNoStop(goto) {
				return this.setOrder({
					type: "Move",
					dest: goto,
					noStop: true,
				});
			}

			cloaked() {
				return this.cloakFade > 0;
			}

			tick() {
				var burnTick,
					cloakOn,
					cloakRange,
					exp,
					j,
					l,
					len,
					len1,
					len2,
					n,
					part,
					ref,
					ref1,
					ref2,
					ref3,
					sound,
					speed,
					target;
				ref = this.parts;
				for (j = 0, len = ref.length; j < len; j++) {
					part = ref[j];
					part.computeWorldPos();
				}
				this.slowed = false; // used for stasis field non-overlap
				if (this.warpIn < 1) {
					this.warpIn += 1 / 16;
				} else {
					this.warpIn = 1;
				}
				this.closestEnemiesCache = null;
				this.closestFriendsCache = null;
				this.closestEnemyBulletsCache = null;
				this.cloakFade = 0;
				if (this.cloak > 0) {
					speed = v2.mag(this.vel);
					if (speed > 1) {
						this.cloak -= (0.2 / 16) * this.mass;
					}
					if (sim.step % 16 === 0) {
						this.cloak -= 0.01 * this.mass;
					}
					cloakOn = this.mass * 0.5;
					if (this.cloak > cloakOn) {
						cloakRange = this.mass - cloakOn;
						this.cloakFade = (this.cloak - cloakOn) / cloakRange;
					}
				}
				if (this.cloak > 0) {
					target = this.closestEnemy();
					if (
						target &&
						v2.distance(target.pos, this.pos) -
							target.radius -
							this.radius <
							100
					) {
						this.cloak = 0;
					}
				}
				if (this.cloak < 0) {
					this.cloak = 0;
				}
				// target the enemy follow unit
				if (
					this.topOrderIs("Follow") &&
					sim.things[this.orders[0].targetId] != null &&
					sim.things[this.orders[0].targetId].side !== this.side
				) {
					this.target = sim.things[this.orders[0].targetId];
				}
				if (this.energy < -this.genEnergy * 16 * 3) {
					this.energy = -this.genEnergy * 16 * 3;
				}
				this.energy += this.baseGenEnergy;
				ref1 = this.parts;
				for (l = 0, len1 = ref1.length; l < len1; l++) {
					part = ref1[l];
					if (part.genEnergy) {
						this.energy += part.genEnergy;
					}
				}
				ref2 = this.parts;
				for (n = 0, len2 = ref2.length; n < len2; n++) {
					part = ref2[n];
					//sim.timeIt "part:" + part.name, ->
					part.tick();
				}
				if (this.energy > this.storeEnergy) {
					this.energy = this.storeEnergy;
				}
				if (this.shield > this.maxShield) {
					this.shield = this.maxShield;
				}
				if ((ref3 = this.target) != null ? ref3.dead : void 0) {
					this.target = null;
				}
				if (sim.step % 16 === 0) {
					if (this.burn > 4) {
						if (this.hp < 4) {
							this.burn = 0;
						}
						burnTick = this.burn * 0.04;
						this.applyDamage(burnTick);
						this.burn -= burnTick;
					} else {
						this.burn = 0;
					}
				}
				if (this.hp <= 0) {
					sound =
						this.maxHP < 100
							? "sounds/weapons/explode1.wav"
							: this.maxHP < 600
								? "sounds/weapons/explode3.wav"
								: "sounds/weapons/explode4.wav";
					exp = new types.ShipExplosion(sound);
					exp.z = 1000;
					exp.pos = [this.pos[0], this.pos[1]];
					exp.vel = [0, 0];
					exp.rot = 0;
					exp.radius = Math.max(this.mass / 5, 50);
					sim.things[exp.id] = exp;
					this.dead = true;
					if (this.building) {
						// kill anything that is being built by the unit too
						return (this.building.dead = true);
					}
				}
			}

			canBuildHere() {
				return true;
			}

			move() {
				this.movement();
				if (this.orders.length === 0) {
					//sim.timeIt "idleAI", =>
					return this.idleAI();
				}
			}

			movement() {
				var curspeed, s;
				this.runOrders();
				v2.scale(this.vel, this.stopFriction);
				curspeed = v2.mag(this.vel);
				if (curspeed < 0.01) {
					this.vel[0] = 0;
					this.vel[1] = 0;
				} else {
					v2.add(this.pos, this.vel);
				}
				// map bounds
				s = 20000;
				if (this.pos[0] > s) {
					this.pos[0] = s;
				}
				if (this.pos[0] < -s) {
					this.pos[0] = -s;
				}
				if (this.pos[1] > s) {
					this.pos[1] = s;
				}
				if (this.pos[1] < -s) {
					return (this.pos[1] = -s);
				}
			}

			lookAt(goto) {
				var rot;
				v2.sub(goto, this.pos, _where);
				rot = v2.angle(_where);
				if (rot != null) {
					return (this.rot = turnAngle(
						this.rot,
						rot,
						this.turnSpeed,
					));
				}
			}

			moveTo(goto, noStop = false) {
				var arriveIn,
					curspeed,
					force,
					j,
					len,
					part,
					ratio,
					ref,
					rot,
					stopSpeed,
					turnIn;
				if (goto == null) {
					return;
				}
				v2.sub(goto, this.pos, _where);
				this.gotoDistance = v2.mag(_where);
				rot = v2.angle(_where);
				if (rot != null) {
					this.rot = turnAngle(this.rot, rot, this.turnSpeed);
				}
				if (this.holdPosition) {
					return;
				}
				// time to get there
				arriveIn = this.gotoDistance / this.maxSpeed;
				turnIn = Math.abs(angleBetween(this.rot, rot)) / this.turnSpeed;
				curspeed = v2.mag(this.vel);
				this.stopDistance = 0;
				if (!noStop) {
					stopSpeed = curspeed;
					while (stopSpeed > 1) {
						this.stopDistance += stopSpeed;
						stopSpeed = stopSpeed * this.stopFriction;
					}
				}
				if (
					turnIn < arriveIn * 0.2 &&
					this.gotoDistance > this.stopDistance &&
					this.energy > 0
				) {
					force = 0;
					ref = this.parts;
					for (j = 0, len = ref.length; j < len; j++) {
						part = ref[j];
						if (part.thrust) {
							if (part.useEnergy < this.energy) {
								ratio = 1;
							} else {
								ratio = this.energy / part.useEnergy;
							}
							force += part.thrust * ratio;
							this.energy -= part.useEnergy * ratio;
						}
					}
					v2.pointTo(_where, this.rot);
					v2.scale(_where, force / this.mass);
					v2.add(this.vel, _where);
				}
			}

			closestEnemies() {
				if (this.closestEnemiesCache === null) {
					this.closestEnemiesCache = [];
					sim.unitSpaces[otherSide(this.side)].findInRange(
						this.pos,
						this.maxRange + 500,
						(u) => {
							if (u.id !== this.id) {
								this.closestEnemiesCache.push(u);
							}
							return false;
						},
					);
					this.closestEnemiesCache.sort((a, b) => {
						return (
							v2.distanceSq(a.pos, this.pos) -
							v2.distanceSq(b.pos, this.pos)
						);
					});
				}
				return this.closestEnemiesCache;
			}

			closestFriends() {
				if (this.closestFriendsCache === null) {
					this.closestFriendsCache = [];
					sim.unitSpaces[this.side].findInRange(
						this.pos,
						this.maxRange + 500,
						(u) => {
							if (u.id !== this.id) {
								this.closestFriendsCache.push(u);
							}
							return false;
						},
					);
					this.closestFriendsCache.sort((a, b) => {
						return (
							v2.distanceSq(a.pos, this.pos) -
							v2.distanceSq(b.pos, this.pos)
						);
					});
				}
				return this.closestFriendsCache;
			}

			closestEnemyBullets() {
				if (this.closestEnemyBulletsCache === null) {
					this.closestEnemyBulletsCache = [];
					sim.bulletSpaces[otherSide(this.side)].findInRange(
						this.pos,
						this.maxRange + this.radius + 500,
						(b) => {
							this.closestEnemyBulletsCache.push(b);
							return false;
						},
					);
					this.closestEnemyBulletsCache.sort((a, b) => {
						return (
							v2.distanceSq(a.pos, this.pos) -
							v2.distanceSq(b.pos, this.pos)
						);
					});
				}
				return this.closestEnemyBulletsCache;
			}

			closestEnemy() {
				var enemy, j, len, ref, u;
				enemy = null;
				ref = this.closestEnemies();
				for (j = 0, len = ref.length; j < len; j++) {
					u = ref[j];
					enemy = u;
					break;
				}
				return enemy;
			}

			closestUncloaked(range) {
				var enemyC, j, len, ref, u;
				enemyC = null;
				ref = this.closestEnemies();
				for (j = 0, len = ref.length; j < len; j++) {
					u = ref[j];
					if (u.cloaked() && !enemyC) {
						enemyC = u;
					} else {
						return u;
					}
				}
				return enemyC;
			}

			idleAI() {
				var dist, lookAt, rot, target;
				if (this.target) {
					this.softTarget = this.target;
				} else if (sim.step % 16 === 0) {
					this.softTarget = null;
					target = this.closestUncloaked();
					if (
						target &&
						v2.distance(target.pos, this.pos) < this.weaponRange * 3
					) {
						this.softTarget = target;
					}
				}
				if (this.softTarget && this.minArc < 360) {
					lookAt = this.softTarget.pos;
					v2.sub(lookAt, this.pos, _where);
					rot = v2.angle(_where);
					dist = v2.mag(_where);
					return (this.rot = turnAngle(
						this.rot,
						rot,
						this.turnSpeed,
					));
				}
			}

			clientTick() {
				var cloakOn, cloakRange, j, len, ref, w;
				ref = this.weapons;
				for (j = 0, len = ref.length; j < len; j++) {
					w = ref[j];
					if (typeof w.clientTick === "function") {
						w.clientTick();
					}
				}
				if (this.burn > 0) {
					this.createFlameEffect();
				}
				this.cloakFade = 0;
				if (this.cloak > 0) {
					cloakOn = this.mass * 0.5;
					if (this.cloak > cloakOn) {
						cloakRange = this.mass - cloakOn;
						return (this.cloakFade =
							(this.cloak - cloakOn) / cloakRange);
					}
				}
			}

			addOrder(order) {
				if (this.orders.length < 50) {
					return this.orders.push(order);
				}
			}

			setOrder(order) {
				this.orders = [order];
				return (this.target = null);
			}

			aiOrder(order) {
				order.ai = true;
				if (
					this.orders.length > 0 &&
					(this.orders[0].ai || this.orders[0].rally)
				) {
					return (this.orders[0] = order);
				} else {
					return this.orders.unshift(order);
				}
			}

			stopAi() {
				if (this.orders.length && this.orders[0].ai) {
					this.orders.shift();
					return (this.onOrderId += 1);
				}
			}

			hasHumanOrder() {
				var j, len, order, ref;
				ref = this.orders;
				for (j = 0, len = ref.length; j < len; j++) {
					order = ref[j];
					if (!order.ai) {
						return true;
					}
				}
				return false;
			}

			giveOrder(order, additive) {
				if (additive) {
					return this.addOrder(order);
				} else {
					return this.setOrder(order);
				}
			}

			topOrderIs(type) {
				return this.orders.length > 0 && this.orders[0].type === type;
			}

			runOrders() {
				var running, topOrder;
				if (this.dead || this.orders.length === 0) {
					return;
				}
				while (this.orders.length > 0) {
					topOrder = this.orders[0];
					this.onOrderId = topOrder.id;
					running = this.runOrder(topOrder);
					if (running || topOrder.ai) {
						break;
					}
					this.orders.shift();
					this.onOrderId += 1;
				}
			}

			runOrder(order) {
				var dest, dir, dist, pos, range, ref, target;
				switch (order.type) {
					case "Follow":
						target = sim.things[order.targetId];
						if (!target || target.dead) {
							this.target = null;
							return false;
						}
						if (target.side !== this.side) {
							this.target = target;
						}
						if (!order.range) {
							if (this.warhead) {
								order.range = 0;
							} else {
								if (
									target.side !== this.side &&
									this.weapons.length > 0
								) {
									order.range = this.mainWeapon.range * 0.95;
								} else {
									order.range =
										(this.radius + target.radius) * 1.5;
								}
							}
						}
						range = order.range;
						if (
							target.side !== this.side &&
							this.weapons.length > 0
						) {
							// weapon speed * time = target speed * time + range <= weapon range
							// time = range / (weapon speed - target speed) = weapon range / weapon speed
							// range = (weapon range) * (weapon speed - target speed) / weapon speed
							dir = v2.norm(
								v2.sub(target.pos, this.pos, v2.create()),
							);
							range = Math.max(
								0,
								(this.mainWeapon.range *
									(this.mainWeapon.bulletSpeed -
										v2.dot(target.vel, dir))) /
									this.mainWeapon.bulletSpeed,
							);
						}
						if (
							target.cloak > 0 &&
							target.cloaked() &&
							target.side !== this.side
						) {
							range = Math.min(range, 150);
						}
						if (this.maxSlow > 0 && target.side !== this.side) {
							range = 150;
						}
						return (
							this.moveWithinRange(
								target.pos,
								range,
								order.noStop,
							) ||
							this.orders.length === 1 ||
							target.side !== this.side ||
							!(this.target = null)
						);
					case "Move":
						if (order.dest == null) {
							return false;
						}
						range = (ref = order.range) != null ? ref : 1;
						// if we have other orders the range we need to go to grows
						if (this.orders.length > 1) {
							range += this.radius * 3;
						}
						return this.moveWithinRange(
							order.dest,
							range,
							order.noStop,
						);
					case "Flee":
						pos = order.pos;
						if (!pos) {
							pos = order.target.pos;
						}
						if (!order.distance) {
							order.distance = 10000; //infinity
						}
						dist = v2.distance(this.pos, pos);
						if (dist > order.distance) {
							return order.noFinish;
						}
						dest = v2.create();
						v2.sub(this.pos, pos, dest);
						v2.scale(dest, order.distance / v2.mag(dest));
						v2.add(dest, this.pos);
						return this.moveWithinRange(
							dest,
							0,
							order.noStop,
							order.noFinish,
						);
					// Allows for AIs to rest
					case "Stop":
						return true;
					default:
						sim.say("invalid order" + JSON.stringify(order));
				}
				return true;
			}

			selfDestruct() {
				return (this.hp = 0);
			}

			toggleHoldPosition() {
				return (this.holdPosition = !this.holdPosition);
			}

			stopAndClearOrders() {
				if (this.orders.length > 0) {
					this.onOrderId = this.orders[this.orders.length - 1].id + 1;
					this.orders = [];
				}
				this.holdPosition = false;
				return (this.target = null);
			}

			moveWithinRange(pos, range, noStop) {
				var dist, hasJump, jumpDist, jumpVec;
				// have we arrived?
				dist = v2.distance(this.pos, pos);
				hasJump = this.minJump > 0 && this.jump >= this.minJump;
				if (
					!hasJump &&
					(dist < range || (noStop && dist <= this.maxSpeed))
				) {
					if (noStop || !this.shouldLookAt(pos)) {
						this.stopDistance = 0;
						this.gotoDistance = Number.MAX_SAFE_INTEGER;
						return false;
					}
					return true;
				}
				// should we move via jump drive?
				if (this.jump >= this.minJump && !this.holdPosition) {
					jumpDist = Math.min(this.jumpDistance, this.jump);
					if (v2.distance(this.pos, pos) < jumpDist) {
						this.cloak -= 0.25 * this.mass;
						jumpVec = v2.create();
						v2.sub(pos, this.pos, jumpVec);
						v2.add(this.pos, jumpVec);
						v2.zero(this.vel);
						this.warpIn = 0;
						this.jump = 0;
						this.rot = v2.angle(jumpVec);
						return false;
					}
				}
				// move normally
				this.moveTo(pos, noStop);
				// are we within stopping distance and moving towards the target?
				if (
					!hasJump &&
					!noStop &&
					this.gotoDistance <= this.stopDistance &&
					v2.dot(v2.sub(pos, this.pos, _where), this.vel) > 0
				) {
					return false;
				}
				return true;
			}

			shouldLookAt(pos) {
				var dif, rot;
				dif = v2.create();
				v2.sub(pos, this.pos, dif);
				if (v2.mag(dif) < 0.1) {
					return false;
				}
				rot = v2.angle(dif);
				if (Math.abs(rot - this.rot) < 0.1) {
					return false;
				} else {
					this.lookAt(pos);
					return true;
				}
			}
		}

		Unit.prototype.name = "";

		Unit.prototype.canCapture = true;

		Unit.prototype.multiShoot = false;

		Unit.prototype.unit = true;

		Unit.prototype.maxHP = 10;

		Unit.prototype.buildHP = 0;

		Unit.prototype.buildSpeed = 10;

		Unit.prototype.buildRadius = 500;

		Unit.prototype.radius = 60;

		Unit.prototype.fixed = false;

		Unit.prototype.maxSpeed = 100;

		Unit.prototype.turnSpeed = 1;

		Unit.prototype.cloak = 0;

		Unit.prototype.burn = 0;

		Unit.prototype.jump = 0;

		Unit.prototype.minJump = 150;

		Unit.prototype.limitBonus = 0;

		Unit.prototype.overCharge = 1;

		Unit.prototype.cost = 100;

		Unit.prototype.image = null;

		Unit.prototype.size = [1, 1];

		Unit.prototype.building = false;

		Unit.prototype.gotoMode = null;

		Unit.prototype.target = null;

		Unit.prototype.holdPosition = false;

		Unit.prototype.stopFriction = 0.9;

		// this is needed for AI/player play
		Unit.prototype.underPlayerControl = false;

		Unit.prototype.orders = null;

		return Unit;
	}.call(this);
}).call(this);
