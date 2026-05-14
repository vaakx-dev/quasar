(function () {
	window.ais = {};

	window.allAiRules = {};

	allAiRules["energy"] = [
		["Field # at start", 2],
		["Field # at priority #", 1, 2],
		["Try to field # every # seconds", 2, 30],
		//["Field # for # of enemy @unitTypes at priority #", 1, 1, "Battleship", 3]
		["Field # for # of ship in slot # at priority #", 1, 1, 1, 5],
		[
			"Field # for # of @needTypes at priority #",
			1,
			1,
			"point defense need",
			3,
		],
		["Field # when money over # at priority #", 1, 1000, 1],
	];

	allAiRules["engines"] = [
		["@capTypes command points within #m", "Capture", 10000],
		["Goto @locationTypes", "enemy spawn"],
		["Stay in #m range of friendly units", 500],
		["Stay in #m range of slot # units", 500, 1],
		["Stayaway in #m range from slot # units", 400, 1],
		["Finish player orders"],
	];

	allAiRules["weapons"] = [
		["@attackTypes enemy within #m", "Attack", 1000],
		//["@attackTypes enemy @unitTypes within #m", "Attack", "Battleship", 1000]
		[
			"@attackTypes enemy that is @relativeTypes and @relativeTypes within #m",
			"Attack",
			"slower",
			"weaker",
			1000,
		],
		[
			"@attackTypes enemy that is @absoluteTypes then # within #m",
			"Attack",
			"slower",
			100,
			1000,
		],
	];

	allAiRules["armor"] = [
		["Avoid everything"],
		["Avoid #dps danger areas", 5],
		["Avoid over #damage shots", 20],
		["Avoid over #damage @bulletTypes shots", 20, "any"],
		["When Shields down to #%, flee", 30],
		["When #% of energy, @chargeTypes", 20, "find recharger"],
		["When below #% cloak, rest", 60],
		["Find units that are out of energy"],
	];

	allAiRules["decal"] = [];
}).call(this);
