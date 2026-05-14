(function () {
	window.toShort = function (spec) {
		if (!spec) {
			return null;
		}
		return JSON.stringify(spec);
	};
	window.fromShort = function (rawShort) {
		var e, spec;
		if (!rawShort) {
			return {
				parts: [],
			};
		}
		if (typeof rawShort === "object") {
			if (rawShort.parts != null) return rawShort;
			return { parts: [] };
		}
		try {
			spec = JSON.parse(rawShort);
			if (!spec.parts) {
				spec = {
					parts: [],
				};
			}
			return spec;
		} catch (error) {
			e = error;
			console.log("Can't decode ship", e, rawShort);
		}
		return {
			parts: [],
		};
	};

	window.specCost = function (spec) {
		var cost, j, len, part, partCls, ref1;
		cost = 0;
		if (!Array.isArray(spec)) {
			spec = fromShort(spec);
		}
		ref1 = spec.parts;
		for (j = 0, len = ref1.length; j < len; j++) {
			part = ref1[j];
			partCls = window.parts[part.type];
			if (partCls) {
				cost += partCls.prototype.cost;
			}
		}
		return cost;
	};
}).call(this);
