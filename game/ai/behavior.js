(function () {
	var _,
		_aAvgPos,
		_angleVec,
		_apos,
		_avec,
		_avoidVec,
		_backPos,
		_goto,
		_leftVec,
		_lvec,
		_mid,
		_next,
		_rightVec,
		_rvec,
		_upos,
		_uvec,
		attack,
		attackFilter,
		attackMoves,
		backstab,
		capAI,
		capAndGuardCP,
		chargeAI,
		circle,
		closest,
		counterNeed,
		doUnitAi,
		doUnitRules,
		g,
		goAway,
		goInRange,
		goThere,
		gotoLocation,
		gotoNoStop,
		gotoNoStopSmooth,
		ifAbsolute,
		ifRelative,
		j,
		kite,
		len,
		r,
		ram,
		run_by,
		spreadCapCP,
		stayClose,
		stayInRange,
		thingsMiddle,
		unitCompair,
		willBeAt;

	closest = function (pos, fn, maxDist = 10000000) {
		var dist, minDist, minT, ref, t;
		minDist = 0;
		minT = null;
		ref = sim.things;
		for (_ in ref) {
			t = ref[_];
			if (fn(t)) {
				dist = v2.distance(pos, t.pos);
				if (dist > maxDist) {
					continue;
				}
				if (dist < minDist || minT === null) {
					minDist = dist;
					minT = t;
				}
			}
		}
		return minT;
	};

	goThere = function (unit, thing) {
		if (!thing) {
			return false;
		}
		goInRange(thing.radius * 0.5, thing.radius, unit, thing);
		return true;
	};

	stayInRange = function (range, unit, thing) {
		// is there a thing?
		if (!thing) {
			return false;
		}
		g = v2.create();
		v2.sub(unit.pos, thing.pos, g);
		v2.norm(g);
		v2.scale(g, range);
		v2.add(g, thing.pos, g);
		return unit.aiOrder({
			type: "Move",
			dest: g,
		});
	};

	goInRange = function (spread, range, unit, thing) {
		// is there a thing?
		if (!thing) {
			return false;
		}
		// we are right on top of it, just sit there
		if (v2.distance(unit.pos, thing.pos) < range) {
			return true;
		}
		if (
			unit.topOrderIs("Move") &&
			v2.distance(unit.orders[0].dest, thing.pos) < spread
		) {
			// already going there
			return true;
		}
		r = v2.create();
		v2.random(r);
		v2.scale(r, spread * Math.random());
		v2.add(r, thing.pos);
		unit.aiOrder({
			type: "Move",
			dest: r,
			range: range,
		});
		return true;
	};

	goAway = function (unit, thing, range) {
		var dest, dist;
		if (!thing || !thing.pos || !unit || !unit.pos) {
			return false;
		}
		dist = v2.distance(unit.pos, thing.pos);
		// we are far a way, we should do another rule
		if (dist > range) {
			return false;
		}
		dest = v2.create();
		v2.sub(unit.pos, thing.pos, dest);
		v2.add(unit.pos, dest, dest);
		unit.aiOrder({
			type: "Move",
			dest: dest,
			range: 0,
		});
		return true;
	};

	unitCompair = function (unit, enemy) {
		var enemyKillsIn, unitKillsIn;
		enemyKillsIn = unit.hp / enemy.weaponDPS;
		unitKillsIn = enemy.hp / unit.weaponDPS;
		if (unitKillsIn > enemyKillsIn) {
			return enemyKillsIn / unitKillsIn - 1;
		} else {
			return 1 - unitKillsIn / enemyKillsIn;
		}
	};

	willBeAt = function (unit, thing) {
		if (!thing || !unit || unit.dead) {
			return false;
		}
		if (unit.topOrderIs("Move")) {
			if (
				unit.orders[0].dest &&
				v2.distance(unit.orders[0].dest, thing.pos) < thing.radius
			) {
				// going to the thing
				return true;
			}
		} else if (unit.topOrderIs("Follow")) {
			if (
				unit.orders[0].target &&
				v2.distance(unit.orders[0].target.pos, thing.pos) < thing.radius
			) {
				// going to something close to the thing
				return true;
			}
		} else {
			if (v2.distance(unit.pos, thing.pos) < thing.radius) {
				// at the thing
				return true;
			}
		}
		return false;
	};

	spreadCapCP = function (unit, rule) {
		var closestUnguarded, cp, guarded, ref, ref1, tallyCps, u;
		if (
			unit.gardingCP &&
			(unit.gardingCP.side !== unit.side || unit.gardingCP.capping > 0)
		) {
			goThere(unit, unit.gardingCP);
			return true;
		}
		tallyCps = [];
		ref = sim.things;
		for (_ in ref) {
			cp = ref[_];
			if (cp.commandPoint && (cp.side !== unit.side || cp.capping > 0)) {
				guarded = 0;
				ref1 = sim.things;
				for (_ in ref1) {
					u = ref1[_];
					if (
						u.unit &&
						u.side === unit.side &&
						u.id !== unit.id &&
						u.number === unit.number
					) {
						if (u.gardingCP === cp) {
							guarded += 1;
						}
					}
				}
				tallyCps.push({
					cp: cp,
					dist: v2.distance(cp.pos, unit.pos),
					guarded: guarded,
				});
			}
		}
		if (tallyCps.length === 0) {
			return false;
		}
		tallyCps.sort(function (a, b) {
			if (a.guarded !== b.guarded) {
				return a.guarded - b.guarded;
			} else {
				return a.dist - b.dist;
			}
		});
		closestUnguarded = tallyCps[0];
		goThere(unit, closestUnguarded.cp);
		unit.gardingCP = closestUnguarded.cp;
		return true;
	};

	capAndGuardCP = function (unit) {
		var closestUnguarded, cp, guarded, ref, ref1, tallyCps, u;
		tallyCps = [];
		ref = sim.things;
		for (_ in ref) {
			cp = ref[_];
			if (cp.commandPoint) {
				guarded = false;
				ref1 = sim.things;
				for (_ in ref1) {
					u = ref1[_];
					if (
						u.unit &&
						u.side === unit.side &&
						u.id !== unit.id &&
						u.number === unit.number
					) {
						if (willBeAt(u, cp)) {
							guarded = true;
							break;
						}
					}
				}
				if (!guarded) {
					tallyCps.push({
						cp: cp,
						dist: v2.distance(cp.pos, unit.pos),
					});
				}
			}
		}
		if (tallyCps.length === 0) {
			return;
		}
		tallyCps.sort(function (a, b) {
			return a.dist - b.dist;
		});
		closestUnguarded = tallyCps[0];
		goThere(unit, closestUnguarded.cp);
		return true;
	};

	attack = function (enemy, unit) {
		if (enemy) {
			unit.aiOrder({
				type: "Follow",
				targetId: enemy.id,
			});
			unit.softTarget = enemy;
			return true;
		}
	};

	kite = function (enemy, unit) {
		var distacne, w;
		if (!enemy) {
			return false;
		}
		w = unit.weapons[0];
		if (w) {
			distacne = v2.distance(enemy.pos, unit.pos);
			if (
				w.arc !== 360 &&
				w.reload === 0 &&
				distacne < unit.weaponRange
			) {
				return true;
			}
		}
		if (stayInRange(unit.weaponRange, unit, enemy)) {
			return true;
		}
	};

	ram = function (enemy, unit) {
		if (enemy && goInRange(0, unit.radius + enemy.radius, unit, enemy)) {
			return true;
		}
	};

	run_by = function (enemy, unit) {
		return gotoNoStop(unit, enemy.pos);
	};

	stayClose = function (enemy, unit) {
		if (enemy && goInRange(0, enemy.radius, unit, enemy)) {
			return true;
		}
	};

	_angleVec = v2.create();

	_leftVec = v2.create();

	_rightVec = v2.create();

	circle = function (enemy, unit) {
		var dist, k, range, th;
		v2.direction(unit.pos, enemy.pos, _angleVec);
		dist = v2.distance(unit.pos, enemy.pos);
		range = Math.max(enemy.weaponRange, 300);
		// turning factor thingy
		k = 3;
		th = v2.angle(_angleVec);
		v2.pointTo(_leftVec, th + Math.PI / 2);
		v2.scale(_leftVec, range * k);
		v2.pointTo(_rightVec, th - Math.PI / 2);
		v2.scale(_rightVec, range * k);
		v2.add(_leftVec, enemy.pos);
		v2.add(_rightVec, enemy.pos);
		v2.add(unit.pos, unit.vel, _angleVec);
		if (
			v2.distance(_angleVec, _leftVec) < v2.distance(_angleVec, _rightVec)
		) {
			unit.aiOrder({
				type: "Move",
				dest: _leftVec,
			});
		} else {
			unit.aiOrder({
				type: "Move",
				dest: _rightVec,
			});
		}
		return true;
	};

	_backPos = v2.create();

	backstab = function (enemy, unit, amount = 0.7) {
		v2.pointTo(_backPos, enemy.rot + Math.PI);
		v2.scale(_backPos, unit.weaponRange * amount);
		v2.add(_backPos, enemy.pos);
		return unit.aiOrder({
			type: "Move",
			dest: v2.create(_backPos),
		});
	};

	attackFilter = function (enemy, unit, type, range) {
		if (!enemy) {
			return false;
		}
		if (!enemy.unit) {
			return false;
		}
		if (enemy.side === unit.side) {
			return false;
		}
		if (enemy.cloakFade > 0) {
			type = type.toLowerCase();
			if (type === "ram" || type === "circle" || type === "flee") {
				return true;
			}
			return false;
		}
		return true;
	};

	attackMoves = function (enemy, unit, type, range) {
		var wiggle;
		if (!enemy) {
			return false;
		}
		switch (type.toLowerCase()) {
			case "attack":
				return attack(enemy, unit);
			case "flee":
				return goAway(
					unit,
					enemy,
					enemy.weaponRange + enemy.radius + enemy.maxSpeed * 16,
				);
			case "kite":
				return kite(enemy, unit);
			case "ram":
				return ram(enemy, unit);
			case "run-by":
				if (v2.distance(enemy.pos, unit.pos) > 500) {
					return run_by(enemy, unit);
				} else {
					// very close to unit
					return true;
				}
				break;
			case "bomb":
				// if unit has less then 10s move energy ignore bombing
				if (unit.energy < unit.moveEnergy * 160) {
					return false;
				}
				if (
					unit.weapons.length > 0 &&
					unit.weapons[0].reload > unit.weapons[0].reloadTime * 0.5
				) {
					unit.message += "[coast]";
					return true;
				} else {
					unit.message += "[run-by]";
					run_by(enemy, unit);
					return true;
				}
				break;
			case "circle":
				return circle(enemy, unit);
			case "backstab":
				return backstab(enemy, unit);
			case "wiggle":
				if (unit.wiggling > 0) {
					unit.wiggling -= 1;
					return true;
				} else if (Math.random() < 0.2) {
					unit.wiggling = 2;
					wiggle = v2.create();
					v2.random(wiggle);
					v2.scale(wiggle, 1000);
					v2.add(wiggle, unit.pos);
					unit.aiOrder({
						type: "Move",
						dest: wiggle,
					});
					return true;
				}
				break;
			case "stay at range":
				return goAway(
					unit,
					enemy,
					enemy.weaponRange + enemy.radius + unit.radius,
				);
		}
	};

	gotoNoStop = function (unit, goto) {
		var go;
		v2.sub(goto, unit.pos, _next);
		v2.scale(_next, 10000 / v2.mag(_next));
		go = v2.create();
		v2.add(unit.pos, _next, go);
		return unit.aiOrder({
			type: "Move",
			dest: go,
			noStop: true,
		});
	};

	_goto = v2.create();

	_next = v2.create();

	gotoNoStopSmooth = function (unit, goto) {
		var dest, i, l;
		v2.sub(_goto, unit.pos, _next);
		v2.scale(_next, 10000 / v2.mag(_next));
		v2.add(unit.pos, _next, _goto);
		if (unit.topOrderIs("Move")) {
			dest = v2.create();
			for (i = l = 0; l < 1; i = ++l) {
				dest[i] = unit.orders[0].dest[i] * 0.7 + _goto[i] * 0.3;
			}
			return unit.aiOrder({
				type: "Move",
				dest: dest,
				noStop: true,
			});
		} else {
			return unit.aiOrder({
				type: "Move",
				dest: v2.create(_goto),
				noStop: true,
			});
		}
	};

	capAI = function (unit, rule) {
		var cp;
		switch (rule[1].toLowerCase()) {
			case "capture":
				cp = closest(
					unit.pos,
					function (t) {
						return (
							t.commandPoint &&
							(t.side !== unit.side || t.capping > 0)
						);
					},
					rule[2],
				);
				if (cp && goThere(unit, cp)) {
					return true;
				}
				break;
			case "spread to":
				// test this
				if (spreadCapCP(unit, rule, rule[2])) {
					return true;
				}
				break;
			case "guard":
				if (capAndGuardCP(unit, rule, rule[2])) {
					return true;
				}
				break;
			case "protect":
				cp = closest(
					unit.pos,
					function (t) {
						return (
							t.commandPoint &&
							t.side === unit.side &&
							t.capping > 0
						);
					},
					rule[2],
				);
				if (cp && goThere(unit, cp)) {
					return true;
				}
				break;
			default:
				return console.log("invalid capAI option", rule);
		}
	};

	chargeAI = function (unit, rule) {
		var enemy, filter, friendly, recharger;
		if (
			!unit.needsFullCharge &&
			unit.energy / unit.storeEnergy < rule[1] / 100
		) {
			switch (rule[2].toLowerCase()) {
				case "find recharger":
					filter = function (t) {
						return (
							t.unit &&
							t.id !== unit.id &&
							t.side === unit.side &&
							t.energyCaster
						);
					};
					recharger = closest(unit.pos, filter);
					if (recharger) {
						if (v2.distance(unit.pos, recharger.pos) < 600) {
							// TODO: see if this fixes:
							// unit.needsFullCharge = true
							return true;
						} else {
							goInRange(400, 600, unit, recharger);
							return true;
						}
					}
					return false;
				case "rest":
					unit.needsFullCharge = true;
					break;
				case "flee enemies":
					enemy = closest(
						unit.pos,
						function (t) {
							return t.unit && t.side !== unit.side;
						},
						3000,
					);
					if (attackMoves(enemy, unit, "flee", 3000)) {
						return true;
					}
					break;
				case "return to spawn":
					if (gotoLocation(unit, ["-", "friendly spawn"])) {
						return true;
					} else {
						unit.needsFullCharge = true;
					}
					break;
				case "find friendlies":
				case "find friendies":
					friendly = closest(unit.pos, function (t) {
						return (
							t.unit && t.id !== unit.id && t.side === unit.side
						);
					});
					if (friendly && v2.distance(unit.pos, friendly.pos) > 500) {
						stayClose(friendly, unit);
						return true;
					}
					break;
				default:
					console.log("invalid chargeAI option", rule);
			}
		}
		if (unit.needsFullCharge) {
			if (unit.energy > unit.storeEnergy * 0.98) {
				unit.needsFullCharge = false;
				return false;
			} else {
				unit.aiOrder({
					type: "Stop",
				});
				return true;
			}
		}
	};

	_mid = v2.create();

	thingsMiddle = function (fn) {
		var number, ref, thing;
		v2.zero(_mid);
		number = 0;
		ref = sim.things;
		for (_ in ref) {
			thing = ref[_];
			if (fn(thing)) {
				v2.add(_mid, thing.pos);
				number += 1;
			}
		}
		if (number === 0) {
			return false;
		}
		v2.scale(_mid, 1 / number);
		return _mid;
	};

	gotoLocation = function (unit, rule) {
		var cp, pos, spawn;
		pos = null;
		switch (rule[1].toLowerCase()) {
			case "enemy spawn":
				spawn = closest(unit.pos, function (t) {
					return t.spawn && t.side !== unit.side;
				});
				if (spawn) {
					pos = spawn.pos;
				}
				break;
			case "friendly spawn":
				spawn = closest(unit.pos, function (t) {
					return t.spawn && t.side === unit.side;
				});
				if (spawn) {
					pos = spawn.pos;
				}
				break;
			case "enemy home point":
				spawn = closest(unit.pos, function (t) {
					return t.spawn && t.side !== unit.side;
				});
				if (spawn) {
					cp = closest(spawn.pos, function (t) {
						return t.commandPoint;
					});
				}
				if (cp) {
					pos = cp.pos;
				}
				break;
			case "friendly home point":
				spawn = closest(unit.pos, function (t) {
					return t.spawn && t.side === unit.side;
				});
				if (spawn) {
					cp = closest(spawn.pos, function (t) {
						return t.commandPoint;
					});
				}
				if (cp) {
					pos = cp.pos;
				}
				break;
			case "enemy army middle":
				pos = thingsMiddle(function (t) {
					return t.unit && t.side !== unit.side;
				});
				break;
			case "friendly army middle":
				pos = thingsMiddle(function (t) {
					return t.unit && t.side === unit.side;
				});
		}
		if (pos) {
			if (v2.distance(unit.pos, pos) > 300) {
				unit.aiOrder({
					type: "Move",
					dest: pos,
				});
				return true;
			}
		}
	};

	ifRelative = function (clause, unit, other) {
		var l, len1, len2, m, ref, ref1, w;
		switch (clause.toLowerCase()) {
			case "---":
				return true;
			case "stronger":
				return unitCompair(unit, other) <= 0;
			case "weaker":
				return unitCompair(unit, other) >= 0;
			case "faster":
				return other.maxSpeed >= unit.maxSpeed;
			case "slower":
				return other.maxSpeed <= unit.maxSpeed;
			case "more range":
				return other.weaponRange >= unit.weaponRange;
			case "less range":
				return other.weaponRange <= unit.weaponRange;
			case "more hp":
				return other.hp >= unit.hp;
			case "less hp":
				return other.hp <= unit.hp;
			case "more expensive":
				return other.cost >= unit.cost;
			case "less expensive":
				return other.cost <= unit.cost;
			case "has pd":
				ref = other.weapons;
				for (l = 0, len1 = ref.length; l < len1; l++) {
					w = ref[l];
					if (w.hitsMissiles) {
						return true;
					}
				}
				return false;
			case "no pd":
				ref1 = other.weapons;
				for (m = 0, len2 = ref1.length; m < len2; m++) {
					w = ref1[m];
					if (w.hitsMissiles) {
						return false;
					}
				}
				return true;
			case "cloaked":
				return other.cloaked();
			case "not cloaked":
				return !other.cloaked();
			case "more dps":
				return other.weaponDPS >= unit.weaponDPS;
			case "less dps":
				return other.weaponDPS <= unit.weaponDPS;
			case "more brawling value":
				if (other.cost === 0 || unit.cost === 0) {
					return false;
				}
				return (
					(other.hp * other.weaponDPS) / other.cost >=
					(unit.hp * unit.weaponDPS) / unit.cost
				);
			case "less brawling value":
				if (other.cost === 0 || unit.cost === 0) {
					return false;
				}
				return (
					(other.hp * other.weaponDPS) / other.cost <=
					(unit.hp * unit.weaponDPS) / unit.cost
				);
			case "armed":
				return other.weaponDPS >= 0.01;
			case "unarmed":
				return other.weaponDPS <= 0;
			default:
				return console.log("clause not defined", clause);
		}
	};

	ifAbsolute = function (clause, value, unit) {
		switch (clause.toLowerCase()) {
			case "---":
				return true;
			case "faster":
				return unit.maxSpeed * 16 >= value;
			case "slower":
				return unit.maxSpeed * 16 <= value;
			case "more range":
				return unit.weaponRange >= value;
			case "less range":
				return unit.weaponRange <= value;
			case "more hp":
				return unit.hp >= value;
			case "less hp":
				return unit.hp <= value;
			case "more expensive":
				return unit.cost >= value;
			case "less expensive":
				return unit.cost <= value;
			case "more dps":
				return unit.weaponDPS * 16 >= value;
			case "less dps":
				return unit.weaponDPS * 16 <= value;
			case "more arc":
				return unit.weaponArc >= value;
			case "less arc":
				return unit.weaponArc <= value;
			default:
				return console.log("clause not defined", clause);
		}
	};

	counterNeed = function (needType, player) {
		var l, len1, need, part, ref, ref1, ref2, ref3, u;
		need = 0;
		switch (needType.toLowerCase()) {
			case "point defense need":
				ref = sim.things;
				for (_ in ref) {
					u = ref[_];
					if (u.unit && u.side !== player.side) {
						ref1 = u.parts;
						for (l = 0, len1 = ref1.length; l < len1; l++) {
							part = ref1[l];
							if (
								part.weapon &&
								part.bulletCls.prototype.missile
							) {
								need += part.dps;
							}
						}
					}
				}
				break;
			case "fighter counter need":
				ref2 = sim.things;
				for (_ in ref2) {
					u = ref2[_];
					if (u.unit && u.side !== player.side) {
						if (u.maxHP < 100 && u.maxSpeed * 16 > 200) {
							need += 0.25;
						}
					}
				}
				break;
			case "cloak counter need":
				ref3 = sim.things;
				for (_ in ref3) {
					u = ref3[_];
					if (u.unit && u.side !== player.side) {
						if (u.cloaked()) {
							need += 1;
						}
					}
				}
		}
		return need;
	};

	_rvec = v2.create();

	_lvec = v2.create();

	_upos = v2.create();

	_uvec = v2.create();

	_avec = v2.create();

	_apos = v2.create();

	_aAvgPos = v2.create();

	_avoidVec = v2.create();

	ais.avoidShots = function (unit, avoidDamage, bulletType) {
		v2.zero(_avoidVec);
		sim.bulletSpaces[otherSide(unit.side)].findInRange(
			unit.pos,
			unit.radius + 500,
			(b) => {
				var i, l, ref, ref1, results;
				// ignore bullets below damage threshold
				if (b.damage < avoidDamage) {
					return;
				}
				// ignore missiles if only targeting PD Immune shots
				if (bulletType === "PD immune" && b.missile) {
					return;
				}
				if (
					b.missile &&
					b.tracking &&
					((ref = b.target) != null ? ref.id : void 0) === unit.id
				) {
					// run a way from a missile
					v2.sub(unit.pos, b.pos, _avec);
					if (v2.mag(_avec) < 600) {
						v2.norm(_avec);
						return v2.add(_avoidVec, _avec);
					}
				} else if (b.hitPos) {
					// will bullet explode were I am?
					v2.sub(unit.pos, b.hitPos, _avec);
					if (v2.mag(_avec) < b.aoe + unit.radius + 100) {
						// go away from it!
						v2.norm(_avec);
						return v2.add(_avoidVec, _avec);
					}
				} else {
					// regular bullet, will it hit me?
					v2.sub(unit.pos, b.pos, _avec);
					if (
						v2.mag(_avec) <
						unit.radius + (b.maxLife - b.life) * b.speed
					) {
						// lets do a little sim :)
						v2.set(unit.pos, _upos);
						v2.set(unit.vel, _uvec);
						v2.set(b.pos, _apos);
						v2.set(b.vel, _avec);
						results = [];
						for (
							i = l = 0, ref1 = Math.min(64, b.maxLife - b.life);
							0 <= ref1 ? l < ref1 : l > ref1;
							i = 0 <= ref1 ? ++l : --l
						) {
							if (v2.distance(_upos, _apos) < unit.radius + 100) {
								// boom
								v2.sub(_apos, _upos, _avec);
								// flee left or right
								v2.pointTo(_lvec, unit.rot + 0.3);
								v2.pointTo(_rvec, unit.rot - 0.3);
								if (
									v2.distance(_lvec, _avec) >
									v2.distance(_rvec, _avec)
								) {
									results.push(v2.add(_avoidVec, _lvec));
								} else {
									results.push(v2.add(_avoidVec, _rvec));
								}
							} else {
								v2.add(_upos, _uvec);
								results.push(v2.add(_apos, _avec));
							}
						}
						return results;
					}
				}
			},
		);
		if (v2.mag(_avoidVec) > 0.1) {
			v2.scale(_avoidVec, 10);
			v2.add(_avoidVec, unit.pos, _apos);
			gotoNoStopSmooth(unit, _apos);
			return true;
		}
		return false;
	};

	window.doPlayerAIRules = function (player) {
		var b,
			buildPriority,
			buildQ,
			countsFielded,
			countsTotal,
			enemyHave,
			enemysFielded,
			l,
			len1,
			len2,
			len3,
			len4,
			m,
			myUnits,
			need,
			number,
			o,
			otherSlot,
			p,
			priorityBuild,
			ratio,
			ref,
			ref1,
			ref2,
			results,
			rule,
			rules,
			start,
			type,
			u,
			unit;
		// disable all AI on 1v1t
		if (sim.serverType === "1v1t") {
			return;
		}
		countsTotal = 0;
		enemysFielded = {};
		countsFielded = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
		ref = sim.things;
		for (_ in ref) {
			u = ref[_];
			if (u.unit && u.owner === player.number && u.side === player.side) {
				countsFielded[u.number] += 1;
				countsTotal += 1;
			}
			if (u.unit && u.owner !== player.number && u.side !== player.side) {
				type = ais.classifyShip(u);
				enemysFielded[type] = (enemysFielded[type] || 0) + 1;
			}
		}
		// clear build Q
		buildQ = [];
		// priority build stuff
		buildPriority = [];
		priorityBuild = function (need, priority, number) {
			var i, l, ref1, results;
			if (need > 100) {
				need = 100;
			}
			results = [];
			for (
				i = l = 0, ref1 = need;
				0 <= ref1 ? l < ref1 : l > ref1;
				i = 0 <= ref1 ? ++l : --l
			) {
				results.push(
					buildPriority.push({
						number: number,
						priority: priority + Math.random() * 0.1,
					}),
				);
			}
			return results;
		};
		ref1 = player.aiRules;
		for (number = l = 0, len1 = ref1.length; l < len1; number = ++l) {
			rules = ref1[number];
			for (m = 0, len2 = rules.length; m < len2; m++) {
				rule = rules[m];
				if (ais.isInvalidRule(rule)) {
					continue;
				}
				switch (rule[0].toLowerCase()) {
					case "field # at priority #":
						need = rule[1] - countsFielded[number];
						if (need > 0) {
							priorityBuild(need, rule[2], number);
						}
						break;
					case "field # for # of enemy * at priority #":
						ratio = rule[1] / rule[2];
						enemyHave = enemysFielded[rule[3]] || 0;
						need =
							Math.floor(enemyHave * ratio) -
							countsFielded[number];
						if (need > 0) {
							priorityBuild(need, rule[4], number);
						}
						break;
					case "field # for # of ship in slot # at priority #":
						ratio = rule[1] / rule[2];
						otherSlot = parseInt(rule[3]) - 1;
						need =
							Math.floor(countsFielded[otherSlot] * ratio) -
							countsFielded[number];
						if (need > 0) {
							priorityBuild(need, rule[4], number);
						}
						break;
					case "try to field # every # seconds":
						if (sim.step !== 0 && sim.step % (rule[2] * 16) === 0) {
							need = rule[1];
							priorityBuild(need, 0, number);
						}
						break;
					case "field # at start":
						if (sim.step < 16 * 5) {
							need = rule[1] - countsFielded[number];
							priorityBuild(need, 0, number);
						}
						break;
					case "field # for # of @needtypes at priority #":
						ratio =
							(rule[1] / rule[2]) * counterNeed(rule[3], player);
						need = Math.floor(ratio - countsFielded[number]);
						if (need > 0) {
							priorityBuild(need, rule[4], number);
						}
						break;
					case "field # when money over # at priority #":
						if (player.money > rule[2]) {
							priorityBuild(rule[1], rule[3], number);
						}
				}
			}
		}
		buildPriority.sort(function (a, b) {
			return a.priority - b.priority;
		});
		for (o = 0, len3 = buildPriority.length; o < len3; o++) {
			b = buildPriority[o];
			buildQ.push(b.number);
		}
		if (buildQ.length !== 0) {
			player.buildQ = buildQ;
		}
		// per unit rules
		myUnits = [];
		ref2 = sim.things;
		for (_ in ref2) {
			unit = ref2[_];
			// don't give orders if player gave orders in this selection
			if (unit.underPlayerControl) {
				unit.message = ""; //"Under player control"
				continue;
			}
			if (unit.unit && unit.owner === player.number) {
				myUnits.push(unit);
			}
		}
		start = now();
		myUnits = shuffle(myUnits);
		results = [];
		for (p = 0, len4 = myUnits.length; p < len4; p++) {
			unit = myUnits[p];
			doUnitAi(unit, player.aiRules[unit.number], player);
			if (now() - start > 2) {
				break;
			} else {
				results.push(void 0);
			}
		}
		return results;
	};

	doUnitAi = function (unit, rules, player) {
		var l, len1, results, rule, used;
		unit.message = "";
		if (unit.wait && unit.wait > 0) {
			unit.wait -= 1;
			return;
		}
		if (rules.length) {
			results = [];
			for (l = 0, len1 = rules.length; l < len1; l++) {
				rule = rules[l];
				if (ais.isInvalidRule(rule)) {
					continue;
				}
				used = false;
				used = doUnitRules(unit, rule, player);
				if (used) {
					unit.message += ais.ruleToStr(rule);
					break;
				} else {
					results.push(void 0);
				}
			}
			return results;
		}
	};

	doUnitRules = function (unit, rule, player) {
		var clause,
			clause1,
			clause2,
			enemy,
			filter,
			friendly,
			range,
			target,
			type,
			value;
		if (!Array.isArray(rule) || typeof rule[0] !== "string") {
			return true;
		}
		switch (rule[0].toLowerCase()) {
			case "@captypes command points within #m":
				return capAI(unit, rule);
			case "@attacktypes enemy within #m":
				range = rule[2];
				filter = function (t) {
					return attackFilter(t, unit, rule[1], rule[2]);
				};
				enemy = closest(unit.pos, filter, range);
				if (attackMoves(enemy, unit, rule[1], rule[2])) {
					return true;
				}
				break;
			case "@attacktypes enemy @unittypes within #m":
				range = rule[3];
				filter = function (t) {
					if (!attackFilter(t, unit, rule[1], rule[2])) {
						return false;
					}
					return ais.classifyShip(t) === rule[2];
				};
				enemy = closest(unit.pos, filter, range);
				if (attackMoves(enemy, unit, rule[1], rule[2])) {
					return true;
				}
				break;
			case "@attacktypes enemy that is @relativetypes and @relativetypes within #m":
				type = rule[1];
				clause1 = rule[2];
				clause2 = rule[3];
				range = rule[4];
				filter = function (t) {
					if (!attackFilter(t, unit, rule[1], rule[2])) {
						return false;
					}
					return (
						ifRelative(clause1, unit, t) &&
						ifRelative(clause2, unit, t)
					);
				};
				enemy = closest(unit.pos, filter, range);
				if (attackMoves(enemy, unit, type, range)) {
					return true;
				}
				break;
			case "@attacktypes enemy that is @absolutetypes then # within #m":
				type = rule[1];
				clause = rule[2];
				value = rule[3];
				range = rule[4];
				filter = function (t) {
					if (!attackFilter(t, unit, rule[1], rule[2])) {
						return false;
					}
					return ifAbsolute(clause, value, t);
				};
				enemy = closest(unit.pos, filter, range);
				if (attackMoves(enemy, unit, type, range)) {
					return true;
				}
				break;
			case "find units that are out of energy":
				target = closest(unit.pos, function (t) {
					return (
						t.unit &&
						t.id !== unit.id &&
						t.side === unit.side &&
						t.energy < t.storeEnergy * 0.75
					);
				});
				if (target) {
					goInRange(500, 600, unit, target);
					return true;
				}
				break;
			case "when #% of energy, @chargetypes":
				return chargeAI(unit, rule);
			case "when below #% cloak, rest":
				if (unit.cloak / unit.mass < rule[1] / 100 || unit.needsCloak) {
					if (unit.cloak < unit.mass) {
						unit.needsCloak = true;
						unit.aiOrder({
							type: "Stop",
						});
						return true;
					} else {
						return (unit.needsCloak = false);
					}
				}
				break;
			case "when shields down to #%, flee":
				if (unit.shield / unit.maxShield < rule[1] / 100) {
					enemy = closest(unit.pos, function (t) {
						return t.unit && t.side !== unit.side;
					});
					if (enemy) {
						goAway(unit, enemy, enemy.weaponRange * 1.5);
						return true;
					}
				}
				break;
			case "stay in #m range of friendly units":
				friendly = closest(unit.pos, function (t) {
					return t.unit && t.id !== unit.id && t.side === unit.side;
				});
				if (friendly && v2.distance(unit.pos, friendly.pos) > rule[1]) {
					stayClose(friendly, unit);
					return true;
				}
				break;
			case "stay in #m range of slot # units":
				friendly = closest(unit.pos, function (t) {
					return (
						t.unit &&
						t.number === parseInt(rule[2]) - 1 &&
						t.id !== unit.id &&
						t.side === unit.side &&
						t.owner === unit.owner
					);
				});
				if (friendly && v2.distance(unit.pos, friendly.pos) > rule[1]) {
					stayClose(friendly, unit);
					return true;
				}
				break;
			case "stayaway in #m range from slot # units":
				friendly = closest(unit.pos, function (t) {
					return (
						t.unit &&
						t.number === parseInt(rule[2]) - 1 &&
						t.id !== unit.id &&
						t.side === unit.side &&
						t.owner === unit.owner
					);
				});
				if (friendly && goAway(unit, friendly, rule[1])) {
					return true;
				}
				break;
			case "goto @locationtypes":
				return gotoLocation(unit, rule);
			case "avoid everything":
				if (
					ais.avoidShots(unit, 1, "Any") ||
					ais.avoidEnemies(unit, 1)
				) {
					return true;
				}
				break;
			case "avoid #dps danger areas":
				if (ais.avoidEnemies(unit, rule[1])) {
					return true;
				}
				break;
			case "avoid over #damage @bullettypes shots":
				if (ais.avoidShots(unit, rule[1], rule[2])) {
					return true;
				}
				break;
			case "avoid over #damage shots":
				if (ais.avoidShots(unit, rule[1], "any")) {
					return true;
				}
				break;
			case "finish player orders":
				if (unit.hasHumanOrder()) {
					if (unit.orders[0].ai) {
						unit.orders.shift();
					}
					return true;
				}
				return false;
		}
	};

	ais.avoidEnemies = function (unit, dps) {
		var doWhat, minDist, minEnemy, stayAwayRange;
		minDist = 9000000;
		minEnemy = null;
		doWhat = null;
		stayAwayRange = 0;
		sim.unitSpaces[otherSide(unit.side)].findInRange(
			unit.pos,
			3000,
			(enemy) => {
				var dist;
				if (enemy.weaponDPS * 16 > dps) {
					dist = v2.distance(unit.pos, enemy.pos);
					if (dist < minDist) {
						stayAwayRange =
							enemy.weaponRange +
							enemy.radius +
							unit.radius +
							enemy.maxSpeed * 16;
						if (dist < stayAwayRange) {
							minDist = dist;
							minEnemy = enemy;
							return (doWhat = "Flee");
						} else if (dist < stayAwayRange * 1.1) {
							minDist = dist;
							minEnemy = enemy;
							return (doWhat = "Stop");
						}
					}
				}
			},
		);
		if (doWhat === "Flee") {
			goAway(unit, minEnemy, stayAwayRange);
			return true;
		}
		if (doWhat === "Stop") {
			unit.aiOrder({
				type: "Stop",
			});
			return true;
		}
	};

	ais.classifyShip = function (unit) {
		var rymarq_system, saktoth_system;
		if (unit.shipClass != null) {
			return unit.shipClass;
		}
		rymarq_system = function () {
			var k, l, len1, list, part, ref, type, v;
			type = {};
			if (unit.weapons.length === 0) {
				type.brick = (unit.hp + unit.shield) * 2;
				type.scout = unit.maxSpeed * 16 * 2;
			} else {
				if (unit.cost < 150) {
					type.swarmer = (210 - unit.cost) * 5;
				}
				if (unit.maxSpeed * 16 > 200 && unit.weaponDPS * 16 > 20) {
					type.fighter =
						unit.weaponDPS * 16 * 6 +
						unit.maxSpeed * 16 * 1.5 +
						(unit.hp + unit.shield);
				}
				if (unit.weaponDamage >= 200) {
					type.bomber =
						unit.weaponDamage * 4 + unit.maxSpeed * 16 * 0.5 - 100;
					ref = unit.parts;
					for (l = 0, len1 = ref.length; l < len1; l++) {
						part = ref[l];
						if (part.name === "Phase Bomb Launcher") {
							type.bomber += 100;
						}
					}
				}
				if (unit.maxSpeed * 16 > 400) {
					type.interceptor =
						unit.weaponDPS * 16 * 2 +
						unit.maxSpeed * 16 * 3 +
						unit.weaponDamage * 2 -
						20;
				}
				if (unit.weaponRange > 500 && unit.cost > 150) {
					type.destroyer =
						unit.maxSpeed * 16 * 3 + unit.weaponRange * 3 - 700;
				}
				if (unit.maxSpeed * 16 > 100) {
					type.cruiser =
						unit.maxSpeed * 16 * 1.5 +
						unit.weaponDPS * 16 * 3 +
						(unit.hp + unit.shield * 2) * 2;
				}
				if (unit.hp > 500) {
					type.battleship =
						(unit.hp + unit.shield) * 2 +
						unit.weaponRange * 3 -
						700;
				}
			}
			if (unit.energyCaster) {
				type.carrier =
					200 + unit.genEnergy * 16 * 10 + unit.storeEnergy / 800;
			}
			type.support = 10;
			list = (function () {
				var results;
				results = [];
				for (k in type) {
					v = type[k];
					results.push([Math.floor(v), k]);
				}
				return results;
			})();
			list = list.sort(function (a, b) {
				return b[0] - a[0];
			});
			return list[0][1];
		};
		saktoth_system = function () {
			var ref, ref1;
			if (unit.weaponDPS === 0) {
				return "scout";
			}
			if (unit.turnSpeed * 16 > 0.7 && unit.weaponRange > 700) {
				if (unit.maxSpeed * 16 > 300) {
					return "destroyer";
				} else {
					return "cruiser";
				}
			}
			if (400 < (ref = unit.maxSpeed * 16) && ref < 600) {
				return "interceptor";
			}
			if (250 < (ref1 = unit.maxSpeed * 16) && ref1 < 400) {
				return "fighter";
			}
			if (unit.energyCaster) {
				return "carrier";
			}
			if (unit.cost > 800 || unit.hp > 1000) {
				return "battleship";
			}
			if (unit.weaponDPS * 16 > 370) {
				return "godslayer";
			}
			return "unknown";
		};
		unit.shipClass = rymarq_system();
		return unit.shipClass;
	};

	ais.useAiFleet = function (aiName, side, aiBuildBar) {
		var color, i, l, len1, player, u;
		if (!aiName) {
			return;
		}
		if (side === "beta") {
			color = [46, 204, 113, 255];
		} else {
			color = [230, 126, 34, 255];
		}
		for (i = l = 0, len1 = aiBuildBar.length; l < len1; i = ++l) {
			u = aiBuildBar[i];
			if (typeof u === "object") {
				aiBuildBar[i] = JSON.stringify(u);
			}
		}
		player = sim.playerJoin(
			"",
			"ai" + rid(),
			aiName,
			color,
			aiBuildBar,
			ais.buildBar2aiRules(aiBuildBar),
			true,
		);
		player.side = side;
		player.afk = false;
		player.connected = true;
		player.ready = true;
		player.ai = true;
		return player;
	};

	ais.buildBar2aiRules = function (buildBar) {
		var aiRules, data, l, len1, unitSpec;
		// unpack AI rules from the build bar
		aiRules = [];
		for (l = 0, len1 = buildBar.length; l < len1; l++) {
			unitSpec = buildBar[l];
			if (unitSpec && unitSpec[0] === "{") {
				data = JSON.parse(unitSpec);
				if (data.aiRules) {
					aiRules.push(data.aiRules);
					continue;
				}
			}
			if (typeof unitSpec === "object") {
				aiRules.push(unitSpec.aiRules);
				continue;
			}
			aiRules.push([]);
		}
		return aiRules;
	};
}).call(this);
