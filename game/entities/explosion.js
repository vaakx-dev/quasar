(function () {
	var Explosion;

	Explosion = function () {
		class Explosion extends Particle {}

		Explosion.prototype.image = "img/unitBar/pip1.png";

		Explosion.prototype.maxLife = 30;

		Explosion.prototype.radius = 2;

		Explosion.prototype.sound = "sounds/weapons/thud2.wav";

		Explosion.prototype.soundVolume = 0.1;

		return Explosion;
	}.call(this);

	types.HitExplosion = function () {
		class HitExplosion extends Explosion {
			constructor() {
				super();
				this.frame = 0;
				this.hitImage = `parts/hit${choose([1, 2, 3, 4, 5])}.png`;
				this.rot = Math.random() * Math.PI * 2;
			}
		}

		HitExplosion.prototype.image = "img/fire02.png";

		HitExplosion.prototype.maxLife = 30;

		HitExplosion.prototype.radius = 2;

		HitExplosion.prototype.sound = "sounds/weapons/thud1.wav";

		HitExplosion.prototype.soundVolume = 0.1;

		return HitExplosion;
	}.call(this);

	types.SmallHitExplosion = function () {
		class SmallHitExplosion extends Explosion {
			constructor() {
				super();
				this.frame = 0;
				this.hitImage = `parts/hitAuto${choose([1, 2, 3])}.png`;
				this.rot = Math.random() * Math.PI * 2;
			}
		}

		SmallHitExplosion.prototype.sound = "sounds/weapons/thud4.wav";

		return SmallHitExplosion;
	}.call(this);

	types.RingHitExplosion = function () {
		class RingHitExplosion extends Explosion {
			constructor() {
				super();
				this.frame = 0;
			}
		}

		RingHitExplosion.prototype.image = "img/fire02.png";

		RingHitExplosion.prototype.maxLife = 30;

		return RingHitExplosion;
	}.call(this);

	types.ShipExplosion = function () {
		class ShipExplosion extends Explosion {
			constructor(sound) {
				super();
				this.sound = sound;
			}
		}

		ShipExplosion.prototype.image = "img/fire02.png";

		ShipExplosion.prototype.maxLife = 15;

		ShipExplosion.prototype.radius = 2;

		ShipExplosion.prototype.sound = "sounds/weapons/explode1.wav";

		ShipExplosion.prototype.soundVolume = 0.1;

		return ShipExplosion;
	}.call(this);

	types.AoeExplosion = function () {
		class AoeExplosion extends Explosion {
			tick() {
				if (!this.damaged) {
					this.damaged = true;
					return sim.unitSpaces[otherSide(this.side)].findInRange(
						this.pos,
						this.aoe + 500,
						(unit) => {
							var distance, fallOff;
							distance = Math.max(
								v2.distance(this.pos, unit.pos) - unit.radius,
								0,
							);
							if (distance < this.aoe) {
								fallOff = 1 - distance / this.aoe;
								if (typeof unit.applyDamage === "function") {
									unit.applyDamage(this.damage * fallOff);
								}
								if (this.energyDamage > 1) {
									if (
										typeof unit.applyEnergyDamage ===
										"function"
									) {
										unit.applyEnergyDamage(
											this.energyDamage * fallOff,
										);
									}
								}
								if (this.burnAmount > 1) {
									if (
										typeof unit.applyBurnAmount ===
										"function"
									) {
										unit.applyBurnAmount(
											this.burnAmount * fallOff,
										);
									}
								}
							}
							return false;
						},
					);
				}
			}
		}

		AoeExplosion.prototype.image = "img/point02.png";

		AoeExplosion.prototype.maxLife = 10;

		AoeExplosion.prototype.radius = 2;

		AoeExplosion.prototype.sound = "sounds/weapons/thud3.wav";

		AoeExplosion.prototype.soundVolume = 0.5;

		AoeExplosion.prototype.damage = 0;

		AoeExplosion.prototype.aoe = 0;

		return AoeExplosion;
	}.call(this);

	types.FrameExplosion = function () {
		class FrameExplosion extends Explosion {
			constructor() {
				super();
			}
		}

		FrameExplosion.prototype.image = "img/fx/fire1/f#.png";

		FrameExplosion.prototype.nFrames = 8;

		FrameExplosion.prototype.maxLife = 16;

		FrameExplosion.prototype.radius = 2;

		FrameExplosion.prototype.sound = "sounds/weapons/explode1.wav";

		FrameExplosion.prototype.soundVolume = 0.1;

		return FrameExplosion;
	}.call(this);
}).call(this);
