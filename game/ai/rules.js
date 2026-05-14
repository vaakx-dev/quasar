(function () {
	var _, g, j, len, r;

	ais.allRuleSet = {};

	ais.allRuleLens = {};

	for (_ in allAiRules) {
		g = allAiRules[_];
		for (j = 0, len = g.length; j < len; j++) {
			r = g[j];
			ais.allRuleSet[r[0]] = true;
			ais.allRuleLens[r[0]] = r.length;
		}
	}

	ais.isInvalidRule = function (rule) {
		var ref;
		// To prevent exploits, check that ai rules are valid.
		return (
			(rule != null
				? (ref = rule.constructor) != null
					? ref.name
					: void 0
				: void 0) !== "Array" ||
			rule.length === 0 ||
			typeof rule[0] !== "string"
		);
	};

	ais.goodRule = function (rule) {
		return !ais.isInvalidRule(rule) && ais.allRuleSet[rule[0]] === true;
	};

	ais.ruleToStr = function (rule) {
		var count, i, l, len1, part, parts, string;
		if (ais.isInvalidRule(rule)) {
			return;
		}
		string = "";
		count = 1;
		parts = rule[0].split(/(\#|\@\w+)/);
		for (i = l = 0, len1 = parts.length; l < len1; i = ++l) {
			part = parts[i];
			if (part === "#" || part[0] === "@") {
				string += rule[count];
				count += 1;
			} else {
				string += part;
			}
		}
		return string;
	};
}).call(this);
