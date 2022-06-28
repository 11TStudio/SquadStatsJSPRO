const express = require("express"),
	CheckAuth = require("../auth/CheckAuth"),
	router = express.Router(),
	utils = require("../utils");

router.get("/", CheckAuth, async (req, res) => {
	const canSeeArray = await req.client.getAllCanSee();
	const user = await req.client.findUserByID(req.user.id);
	res.render("profile", {
		c: req.client,
		ownerID: req.client.config.owner.id,
		userRoles: await req.client.getRoles(req.session.user.id),
		allCanSee: canSeeArray,
		serverID: req.client.config.serverID,
		userDiscord: req.userInfos,
		playerAmount: await req.client.getPlayersLength(),
		userSteam: req.session?.passport?.user || req.userInfos.steam,
		user: user,
		translate: req.translate,
		repoVersion: req.client.config.version,
		currentURL: `${req.client.config.dashboard.baseURL}/${req.originalUrl}`,
		config: req.client.config,
		usage: (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2),
	});
});

module.exports = router;
