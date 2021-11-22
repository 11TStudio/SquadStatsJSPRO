const express = require("express"),
	CheckAuth = require("../auth/CheckAuth"),
	router = express.Router(),
	multiparty = require("multiparty"),
	fs = require("fs"),
	BM = require("@leventhan/battlemetrics");

router.get("/", CheckAuth, async (req, res) => {
	return res.json("Welcome to the SquadStatsJSPRO api!");
});

/**
 * @api {get} /squad-api/getServerInfo Request server info
 * @apiName getServerInfo
 * @apiGroup Server
 *
 * @apiParam (Login) {String} apiToken Your api token
 *
 * @apiSuccess {Object} data Server information.
 * @apiSuccess {Array} included Included.
 * @apiSuccessExample {json} Success-Response:
 *    HTTP/1.1 200 OK
 * {
	"data": {
		"type": "server",
		"id": "10281405",
		"attributes": {
			"id": "10281405",
			"name": "✪✪✪ GERMAN SQUAD #1 ✪✪✪ @GER-SQUAD.community",
			"address": null,
			"ip": "194.26.183.182",
			"port": 27015,
			"players": 99,
			"maxPlayers": 100,
			"rank": 20,
			"location": [
				8.10812,
				50.518749
			],
			"status": "online",
			"details": {
				"map": "Yehorivka_RAAS_v1",
				"gameMode": "RAAS",
				"version": "V2.11.0.25.64014",
				"secure": 0,
				"licensedServer": true,
				"licenseId": "809942",
				"numPubConn": 99,
				"numPrivConn": 1,
				"numOpenPrivConn": 1,
				"modded": false,
				"serverSteamId": "90150709607385097"
			},
			"private": false,
			"createdAt": "2021-02-19T13:52:06.986Z",
			"updatedAt": "2021-08-28T18:41:12.307Z",
			"portQuery": 27016,
			"country": "DE",
			"queryStatus": "valid"
		},
		"relationships": {
			"game": {
				"data": {
					"type": "game",
					"id": "squad"
				}
			}
		}
	},
	"included": []
}
 */
router.get("/getServerInfo", CheckAuth, async (req, res) => {
	const options = {
		token: req.client.config.apiKeys.battleMetrics,
		serverID: req.client.config.squadBattleMetricsID,
		game: process.env.GAMENAME || 'squad'
	};

	const battleMetrics = new BM(options);

	const response = await battleMetrics.getServerInfoById(
		battleMetrics.serverID
	);
	
	const steamAccount = {
		steam64id:
			req.session?.passport?.user?.id || req.session?.passport?.user?.steamid,
		displayName:
			req.session?.passport?.user?.displayName ||
			req.session?.passport?.user?.personaname,
		identifier:
			req.session?.passport?.user?.identifier ||
			req.session?.passport?.user?.profileurl,
	};
	const discordAccount = {
		id: req.session?.user?.id,
		username: req.session?.user?.username,
		discriminator: req.session?.user?.discriminator,
	};

	const log = await req.client.addLog({
		action: "GET_SERVER_INFO",
		author: { discord: discordAccount, steam: steamAccount },
		ip: null,
		details: { details: req.session.user },
	});
	await log.save();
	return res.json(response);
});

/**
 * @api {get} /squad-api/getPlayersList Request current active players
 * @apiName getPlayersList
 * @apiGroup Server
 *
 * @apiParam (Login) {String} apiToken Your api token
 *
 * @apiSuccess {Object[]} data Players info.
 * @apiSuccessExample {json} Success-Response:
 *    HTTP/1.1 200 OK
 *   {
 *    {
 *      "playerID": "62",
 *      "steamID": "76561197988878542",
 *      "name": "!Flöt3nFranZ!",
 *      "teamID": "1",
 *      "squadID": "2",
 *      "squad": {
 *          "squadID": "2",
 *          "squadName": "Squad 2",
 *          "size": "9",
 *          "locked": "False",
 *          "teamID": "1",
 *          "teamName": "British Armed Forces"
 *      },
 *      "suffix": "!Flöt3nFranZ!",
 *      "possessClassname": "BP_Brit_Util_Truck_Logi"
 *   },
 * 	 {...},
 *    ...
 * }
 */
router.get("/getPlayersList", CheckAuth, async (req, res) => {
	req.client.socket.emit("players", async (data) => {
		const steamAccount = {
			steam64id:
				req.session?.passport?.user?.id || req.session?.passport?.user?.steamid,
			displayName:
				req.session?.passport?.user?.displayName ||
				req.session?.passport?.user?.personaname,
			identifier:
				req.session?.passport?.user?.identifier ||
				req.session?.passport?.user?.profileurl,
		};
		const discordAccount = {
			id: req.session?.user?.id,
			username: req.session?.user?.username,
			discriminator: req.session?.user?.discriminator,
		};
		const log = await req.client.addLog({
			action: "GET_PLAYERS_LIST",
			author: { discord: discordAccount, steam: steamAccount },
			ip: req.session.user.lastIp,
			details: { details: null },
		});
		await log.save();
		return res.json(data);
	});
});

/**
 * @api {get} /squad-api/getNextMap Request next layer
 * @apiName getNextMap
 * @apiGroup Server
 *
 * @apiParam (Login) {String} apiToken Your api token
 *
 * @apiSuccess {String} level Map name.
 * @apiSuccess {String} layer Layer name.
 * @apiSuccessExample {json} Success-Response:
 *    HTTP/1.1 200 OK
	{
		"level": "Narva",
		"layer": "Narva AAS v2"
	}
 */
router.get("/getNextMap", CheckAuth, async (req, res) => {
	req.client.socket.emit("rcon.getNextMap", async (data) => {
		const steamAccount = {
			steam64id:
				req.session?.passport?.user?.id || req.session?.passport?.user?.steamid,
			displayName:
				req.session?.passport?.user?.displayName ||
				req.session?.passport?.user?.personaname,
			identifier:
				req.session?.passport?.user?.identifier ||
				req.session?.passport?.user?.profileurl,
		};
		const discordAccount = {
			id: req.session?.user?.id,
			username: req.session?.user?.username,
			discriminator: req.session?.user?.discriminator,
		};
		const log = await req.client.addLog({
			action: "GET_NEXT_MAP",
			author: { discord: discordAccount, steam: steamAccount },
			ip: req.session.user.lastIp,
			details: { details: null },
		});
		await log.save();
		return res.json(data);
	});
});

/**
 * @api {get} /squad-api/setNextMap Set next layer
 * @apiName setNextMap
 * @apiGroup Server
 *
 * @apiParam (Login) {String} apiToken Your api token
 *
 * @apiSuccess {Object} status The status of the request.
 * @apiSuccessExample {json} Success-Response:
 *    HTTP/1.1 200 OK
	{
		"status": "ok",
		"message": "Next map set!"
	}
 * @apiErrorExample {json} Error-Response:
 * {
		"status": "nok",
		"message": "You are doing something wrong."
	}
 */
router.post("/setNextMap", CheckAuth, async function (req, res) {
	if (!req.body.layer)
		return res.json({
			status: "nok",
			message: "You are doing something wrong.",
		});

	const userRole = await req.client.getRoles(req.session?.user?.id);

	const canUser = await req.client.whoCan("setNextMap");

	if (!canUser.some((role) => userRole.includes(role)))
		return res.json({
			status: "nok2",
			message: "You are not allowed to do this.",
		});

	const steamAccount = {
		steam64id:
			req.session?.passport?.user?.id || req.session?.passport?.user?.steamid,
		displayName:
			req.session?.passport?.user?.displayName ||
			req.session?.passport?.user?.personaname,
		identifier:
			req.session?.passport?.user?.identifier ||
			req.session?.passport?.user?.profileurl,
	};
	const discordAccount = {
		id: req.session?.user?.id,
		username: req.session?.user?.username,
		discriminator: req.session?.user?.discriminator,
	};
	const moreDetails = {
		nextLayer: req.body.layer,
	};

	const socket = req.client.socket;
	socket.emit(
		"rcon.execute",
		`AdminSetNextLayer ${moreDetails.nextLayer}`,
		async () => {
			const log = await req.client.addLog({
				action: "SET_NEXT_MAP",
				author: { discord: discordAccount, steam: steamAccount },
				ip: req.session.user.lastIp,
				details: { details: moreDetails },
			});
			await log.save();
			return res.json({ status: "ok", message: "Next Map set!" });
		}
	);
});

router.post("/setCurrentMap", CheckAuth, async function (req, res) {
	if (!req.body.layer)
		return res.json({
			status: "nok",
			message: "You are doing something wrong.",
		});

	const userRole = await req.client.getRoles(req.session?.user?.id);

	const canUser = await req.client.whoCan("setCurrentMap");

	if (!canUser.some((role) => userRole.includes(role)))
		return res.json({
			status: "nok2",
			message: "You are not allowed to do this.",
		});

	const steamAccount = {
		steam64id:
			req.session?.passport?.user?.id || req.session?.passport?.user?.steamid,
		displayName:
			req.session?.passport?.user?.displayName ||
			req.session?.passport?.user?.personaname,
		identifier:
			req.session?.passport?.user?.identifier ||
			req.session?.passport?.user?.profileurl,
	};
	const discordAccount = {
		id: req.session?.user?.id,
		username: req.session?.user?.username,
		discriminator: req.session?.user?.discriminator,
	};
	const moreDetails = {
		nextLayer: req.body.layer,
	};

	const socket = req.client.socket;

	// { action: action, author: {discord: discordDetails, steam: steamDetails}, details: {details: moreDetails} }
	socket.emit(
		"rcon.execute",
		`AdminChangeLayer ${moreDetails.nextLayer}`,
		async () => {
			const log = await req.client.addLog({
				action: "CHANGE_CURRENT_MAP",
				author: { discord: discordAccount, steam: steamAccount },
				ip: req.session.user.lastIp,
				details: { details: moreDetails },
			});
			await log.save();
			return res.json({ status: "ok", message: "Next Map set!" });
		}
	);
});

/**
 * @api {get} /squad-api/currentMap Request current layer
 * @apiName currentMap
 * @apiGroup Server
 *
 * @apiParam (Login) {String} apiToken Your api token
 *
 * @apiSuccess {String} level Map name.
 * @apiSuccess {String} layer Layer name.
 * @apiSuccessExample {json} Success-Response:
 *    HTTP/1.1 200 OK
	{
		"level": "Narva",
		"layer": "Narva AAS v2"
	}
 */
router.get("/getCurrentMap", CheckAuth, async (req, res) => {
	req.client.socket.emit("rcon.getCurrentMap", async (data) => {
		const steamAccount = {
			steam64id:
				req.session?.passport?.user?.id || req.session?.passport?.user?.steamid,
			displayName:
				req.session?.passport?.user?.displayName ||
				req.session?.passport?.user?.personaname,
			identifier:
				req.session?.passport?.user?.identifier ||
				req.session?.passport?.user?.profileurl,
		};
		const discordAccount = {
			id: req.session?.user?.id,
			username: req.session?.user?.username,
			discriminator: req.session?.user?.discriminator,
		};
		const log = await req.client.addLog({
			action: "GET_CURRENT_MAP",
			author: { discord: discordAccount, steam: steamAccount },
			ip: req.session.user.lastIp,
			details: { details: null },
		});
		await log.save();
		return res.json(data);
	});
});

/**
 * @api {post} /squad-api/broadcast Send broadcast to sever
 * @apiName broadcast
 * @apiGroup Admin
 *
 * @apiParam (Login) {String} apiToken Your api token
 *
 * @apiSuccess {Object} status The status of the request.
 * @apiSuccessExample {json} Success-Response:
 *    HTTP/1.1 200 OK
	{
		"status": "ok",
		"message": "Broadcast sent!"
	}
 * @apiErrorExample {json} Error-Response:
 * {
		"status": "nok",
		"message": "You are doing something wrong."
	}
 */
router.post("/broadcast", CheckAuth, async function (req, res) {
	if (!req.body.content)
		return res.json({
			status: "nok",
			message: "You are doing something wrong.",
		});

	const userRole = await req.client.getRoles(req.session?.user?.id);

	const canUser = await req.client.whoCan("broadcast");

	if (!canUser.some((role) => userRole.includes(role)))
		return res.json({
			status: "nok2",
			message: "You are not allowed to do this.",
		});

	const steamAccount = {
		steam64id:
			req.session?.passport?.user?.id || req.session?.passport?.user?.steamid,
		displayName:
			req.session?.passport?.user?.displayName ||
			req.session?.passport?.user?.personaname,
		identifier:
			req.session?.passport?.user?.identifier ||
			req.session?.passport?.user?.profileurl,
	};
	const discordAccount = {
		id: req.session?.user?.id,
		username: req.session?.user?.username,
		discriminator: req.session?.user?.discriminator,
	};
	const moreDetails = {
		broadcast: req.body.content,
	};
	// { action: action, author: {discord: discordDetails, steam: steamDetails}, details: {details: moreDetails} }
	const log = await req.client.addLog({
		action: "ADMIN_BROADCAST",
		author: { discord: discordAccount, steam: steamAccount },
		ip: req.session.user.lastIp,
		details: { details: moreDetails },
	});
	await log.save();

	res.json({ status: "ok", message: "Broadcast sent!" });
});

/**
 * @api {post} /squad-api/kick Kick players
 * @apiName kick
 * @apiGroup Admin
 *
 * @apiParam (Login) {String} apiToken Your api token
 * @apiParam {String} steamID The steamID of the player to be kicked.
 * @apiParam {String} reason The reason of the kick.
 *
 * @apiSuccess {Object} status The status of the request.
 * @apiSuccessExample {json} Success-Response:
 *    HTTP/1.1 200 OK
	{
		"status": "ok",
		"message": "Player kicked!"
	}
 * @apiErrorExample {json} Error-Response:
 * {
		"status": "nok",
		"message": "You are doing something wrong."
	}
 */
router.post("/kick", CheckAuth, async function (req, res) {
	if (!req.body.steamUID || !req.body.reason)
		return res.json({
			status: "nok",
			message: "You are doing something wrong.",
		});

	const userRole = await req.client.getRoles(req.session?.user?.id);

	const canUser = await req.client.whoCan("kick");

	if (!canUser.some((role) => userRole.includes(role)))
		return res.json({
			status: "nok2",
			message: "You are not allowed to do this.",
		});

	const steamAccount = {
		steam64id:
			req.session?.passport?.user?.id || req.session?.passport?.user?.steamid,
		displayName:
			req.session?.passport?.user?.displayName ||
			req.session?.passport?.user?.personaname,
		identifier:
			req.session?.passport?.user?.identifier ||
			req.session?.passport?.user?.profileurl,
	};
	const discordAccount = {
		id: req.session?.user?.id,
		username: req.session?.user?.username,
		discriminator: req.session?.user?.discriminator,
	};
	const moreDetails = {
		player: req.body.steamUID,
		reason: req.body.reason,
	};

	// { action: action, author: {discord: discordDetails, steam: steamDetails}, details: {details: moreDetails} }
	const socket = req.client.socket;
	// debug
	socket.emit(
		"rcon.execute",
		`AdminKick ${moreDetails.player} ${moreDetails.reason}`,
		async () => {
			const log = await req.client.addLog({
				action: "PLAYER_KICKED",
				author: { discord: discordAccount, steam: steamAccount },
				ip: req.session.user.lastIp,
				details: { details: moreDetails },
			});
			await log.save();
			const moderation = await req.client.addModeration({
				steamID: req.body.steamUID,
				moderatorSteamID:
					req.session?.passport?.user?.id ||
					req.session?.passport?.user?.steamid,
				moderatorName: req.session.user.username,
				moderator: req.session?.user?.id,
				typeModeration: "kick",
				reason: req.body.reason,
				endDate: null,
			});
			await moderation.save();
			return res.json({ status: "ok", message: "Player kicked!" });
		}
	);
});

/**
 * @api {post} /squad-api/warn Warn players
 * @apiName warn
 * @apiGroup Admin
 *
 * @apiParam (Login) {String} apiToken Your api token
 * @apiParam {String} steamID The steamID of the player to be warned.
 * @apiParam {String} reason The warning message.
 *
 * @apiSuccess {Object} status The status of the request.
 * @apiSuccessExample {json} Success-Response:
 *    HTTP/1.1 200 OK
	{
		"status": "ok",
		"message": "Player warned!"
	}
 * @apiErrorExample {json} Error-Response:
 * {
		"status": "nok",
		"message": "You are doing something wrong."
	}
 */
router.post("/warn", CheckAuth, async function (req, res) {
	if (!req.body.steamUID || !req.body.reason)
		return res.json({
			status: "nok",
			message: "You are doing something wrong.",
		});

	const userRole = await req.client.getRoles(req.session?.user?.id);

	const canUser = await req.client.whoCan("warn");

	if (!canUser.some((role) => userRole.includes(role)))
		return res.json({
			status: "nok2",
			message: "You are not allowed to do this.",
		});

	const steamAccount = {
		steam64id:
			req.session?.passport?.user?.id || req.session?.passport?.user?.steamid,
		displayName:
			req.session?.passport?.user?.displayName ||
			req.session?.passport?.user?.personaname,
		identifier:
			req.session?.passport?.user?.identifier ||
			req.session?.passport?.user?.profileurl,
	};
	const discordAccount = {
		id: req.session?.user?.id,
		username: req.session?.user?.username,
		discriminator: req.session?.user?.discriminator,
	};
	const moreDetails = {
		player: req.body.steamUID,
		reason: req.body.reason,
	};

	// { action: action, author: {discord: discordDetails, steam: steamDetails}, details: {details: moreDetails} }
	const socket = req.client.socket;
	// debug
	socket.emit("rcon.warn", moreDetails.player, moreDetails.reason, async () => {
		const log = await req.client.addLog({
			action: "PLAYER_WARNED",
			author: { discord: discordAccount, steam: steamAccount },
			ip: req.session.user.lastIp,
			details: { details: moreDetails },
		});
		await log.save();
		const moderation = await req.client.addModeration({
			steamID: req.body.steamUID,
			moderatorSteamID:
				req.session?.passport?.user?.id || req.session?.passport?.user?.steamid,
			moderatorName: req.session.user.username,
			moderator: req.session?.user?.id,
			typeModeration: "warn",
			reason: req.body.reason,
			endDate: null,
		});
		await moderation.save();
		return res.json({ status: "ok", message: "Player warned!" });
	});
});

/**
 * @api {post} /squad-api/ban Ban players
 * @apiName ban
 * @apiGroup Admin
 *
 * @apiParam (Login) {String} apiToken Your api token
 * @apiParam {String} steamID The steamID of the player to be banned.
 * @apiParam {String} reason The reason of the ban.
 * @apiParam {String} duration The duration of the ban.
 *
 * @apiSuccess {Object} status The status of the request.
 * @apiSuccessExample {json} Success-Response:
 *    HTTP/1.1 200 OK
	{
		"status": "ok",
		"message": "Player banned!"
	}
 * @apiErrorExample {json} Error-Response:
 * {
		"status": "nok",
		"message": "You are doing something wrong."
	}
 */
router.post("/ban", CheckAuth, async function (req, res) {
	if (!req.body.steamUID || !req.body.reason || !req.body.duration)
		return res.json({
			status: "nok",
			message: "You are doing something wrong.",
		});

	const userRole = await req.client.getRoles(req.session?.user?.id);

	const canUser = await req.client.whoCan("ban");

	if (!canUser.some((role) => userRole.includes(role)))
		return res.json({
			status: "nok2",
			message: "You are not allowed to do this.",
		});

	// TODO: check if the duration is valid
	const steamAccount = {
		steam64id:
			req.session?.passport?.user?.id || req.session?.passport?.user?.steamid,
		displayName:
			req.session?.passport?.user?.displayName ||
			req.session?.passport?.user?.personaname,
		identifier:
			req.session?.passport?.user?.identifier ||
			req.session?.passport?.user?.profileurl,
	};
	const discordAccount = {
		id: req.session?.user?.id,
		username: req.session?.user?.username,
		discriminator: req.session?.user?.discriminator,
	};
	const moreDetails = {
		player: req.body.steamUID,
		reason: req.body.reason,
		duration: req.body.duration,
	};
	// { action: action, author: {discord: discordDetails, steam: steamDetails}, details: {details: moreDetails} }
	const socket = req.client.socket;
	// debug
	const check = await req.client.moderation
		.find({ steamID: moreDetails.player })
		.where("endDate")
		.gt(Date.now());
	if (check.length == 0) {
		socket.emit(
			"rcon.execute",
			`AdminBan ${moreDetails.player} ${moreDetails.duration} ${moreDetails.reason}`,
			async () => {
				let banNumber = moreDetails.duration.match(/\d+/g);
				banNumber = parseInt(banNumber);
				const banLetter = moreDetails.duration.match(/[a-zA-Z]/g)[0];
				let epochDuration;
				switch (banLetter) {
					case "m":
						epochDuration = Date.now() + banNumber * 1000 * 60;
						break;
					case "d":
						epochDuration = Date.now() + banNumber * 1000 * 60 * 60 * 24;
						break;
					case "M":
						epochDuration = Date.now() + banNumber * 1000 * 60 * 60 * 24 * 30;
						break;
					case "P":
						epochDuration = 0;
						break;
					default:
						epochDuration = Date.now() + 1 * 1000 * 60; // 1 minute ban FAST BAN
						break;
				}
				const log = await req.client.addLog({
					action: "PLAYER_BANNED",
					author: { discord: discordAccount, steam: steamAccount },
					ip: req.session.user.lastIp,
					details: { details: moreDetails },
				});
				await log.save();
				const moderation = await req.client.addModeration({
					steamID: req.body.steamUID,
					moderatorSteamID:
						req.session?.passport?.user?.id ||
						req.session?.passport?.user?.steamid,
					moderatorName: req.session.user.username,
					moderator: req.session?.user?.id,
					typeModeration: "ban",
					reason: req.body.reason,
					endDate: epochDuration,
				});
				await moderation.save();
				return res.json({ status: "ok", message: "Player banned!" });
			}
		);
	} else {
		return res.json({ status: "nok3", message: "Player already banned!" });
	}
});

/**
 * @api {post} /squad-api/disbandSquad Disband squads
 * @apiName disbandSquad
 * @apiGroup Admin
 *
 * @apiParam (Login) {String} apiToken Your api token
 * @apiParam {String} squadID The squadID of the player's squad to be disband.
 * @apiParam {String} teamID The teamID (side 1 or 2) of the player's squad.
 *
 * @apiSuccess {Object} status The status of the request.
 * @apiSuccessExample {json} Success-Response:
 *    HTTP/1.1 200 OK
	{
		"status": "ok",
		"message": "Squad is disband!"
	}
 * @apiErrorExample {json} Error-Response:
 * {
		"status": "nok",
		"message": "You are doing something wrong."
	}
 */
router.post("/disbandSquad", CheckAuth, async function (req, res) {
	if (!req.body.squadID || !req.body.teamID)
		return res.json({
			status: "nok",
			message: "You are doing something wrong.",
		});

	const userRole = await req.client.getRoles(req.session?.user?.id);

	const canUser = await req.client.whoCan("disbandSquad");

	if (!canUser.some((role) => userRole.includes(role)))
		return res.json({
			status: "nok2",
			message: "You are not allowed to do this.",
		});

	const steamAccount = {
		steam64id:
			req.session?.passport?.user?.id || req.session?.passport?.user?.steamid,
		displayName:
			req.session?.passport?.user?.displayName ||
			req.session?.passport?.user?.personaname,
		identifier:
			req.session?.passport?.user?.identifier ||
			req.session?.passport?.user?.profileurl,
	};
	const discordAccount = {
		id: req.session?.user?.id,
		username: req.session?.user?.username,
		discriminator: req.session?.user?.discriminator,
	};
	const moreDetails = {
		teamID: req.body.teamID,
		squadID: req.body.squadID,
	};

	// { action: action, author: {discord: discordDetails, steam: steamDetails}, details: {details: moreDetails} }
	const socket = req.client.socket;
	socket.emit(
		"rcon.execute",
		`AdminDisbandSquad ${moreDetails.teamID} ${moreDetails.squadID}`,
		async (response) => {
			const log = await req.client.addLog({
				action: "SQUAD_DISBAND",
				author: { discord: discordAccount, steam: steamAccount },
				ip: req.session.user.lastIp,
				details: { details: moreDetails },
			});
			await log.save();
			return res.json({ status: "ok", message: response });
		}
	);
});

/**
 * @api {post} /squad-api/removeFromSquad Remove players from squad
 * @apiName removeFromSquad
 * @apiGroup Admin
 *
 * @apiParam (Login) {String} apiToken Your api token
 * @apiParam {String} steamID The steamID of the player to be kicked from squad (not from the game!).
 *
 * @apiSuccess {Object} status The status of the request.
 * @apiSuccessExample {json} Success-Response:
 *    HTTP/1.1 200 OK
	{
		"status": "ok",
		"message": "Player removed from squad!"
	}
 * @apiErrorExample {json} Error-Response:
 * {
		"status": "nok",
		"message": "You are doing something wrong."
	}
 */
router.post("/removeFromSquad", CheckAuth, async function (req, res) {
	if (!req.body.steamID)
		return res.json({
			status: "nok",
			message: "You are doing something wrong.",
		});

	const userRole = await req.client.getRoles(req.session?.user?.id);

	const canUser = await req.client.whoCan("removeFromSquad");

	if (!canUser.some((role) => userRole.includes(role)))
		return res.json({
			status: "nok2",
			message: "You are not allowed to do this.",
		});

	const steamAccount = {
		steam64id:
			req.session?.passport?.user?.id || req.session?.passport?.user?.steamid,
		displayName:
			req.session?.passport?.user?.displayName ||
			req.session?.passport?.user?.personaname,
		identifier:
			req.session?.passport?.user?.identifier ||
			req.session?.passport?.user?.profileurl,
	};
	const discordAccount = {
		id: req.session?.user?.id,
		username: req.session?.user?.username,
		discriminator: req.session?.user?.discriminator,
	};
	const moreDetails = {
		steamUID: req.body.steamID,
	};

	// { action: action, author: {discord: discordDetails, steam: steamDetails}, details: {details: moreDetails} }
	const socket = req.client.socket;
	socket.emit(
		"rcon.execute",
		`AdminRemovePlayerFromSquad	${moreDetails.steamUID}`,
		async (response) => {
			const log = await req.client.addLog({
				action: "KICK_PLAYER_FROM_SQUAD",
				author: { discord: discordAccount, steam: steamAccount },
				ip: req.session.user.lastIp,
				details: { details: moreDetails },
			});
			await log.save();
			return res.json({ status: "ok", message: response });
		}
	);
});

router.get("/whitelist/:token", async function (req, res) {
	const providedToken = req.params.token;
	const realToken = await req.client.getWhitelistToken();
	if (providedToken === realToken) {
		const groups = await req.client.getWhitelistRoles();
		const users = await req.client.getWhitelistUsers();
		return res.render("whitelist", {
			roles: groups,
			memberData: users,
		});
	}
	return res.json({ status: "nok", message: "Something went wrong!" });
});

router.post("/moderation/getCount", CheckAuth, async function (req, res) {
	if (!req.body.steamid)
		return res.json({
			status: "nok",
			message: "You are doing something wrong.",
		});
	const kick = await req.client.moderation.count({
		steamID: `${req.body.steamid}`,
		typeModeration: "kick",
	});
	const warn = await req.client.moderation.count({
		steamID: `${req.body.steamid}`,
		typeModeration: "warn",
	});
	const ban = await req.client.moderation.count({
		steamID: `${req.body.steamid}`,
		typeModeration: "ban",
	});
	return res.json({
		status: "ok",
		count: { kick: `${kick}`, ban: `${ban}`, warn: `${warn}` },
	});
});

router.post("/whitelist/import", CheckAuth, async function (req, res, next) {
	const userRole = await req.client.getRoles(req.session?.user?.id);
	const canSee = await req.client.canAccess("roles", req.userInfos.id);
	if (!canSee) return next(new Error("You can't access this page"));
	if (!userRole.includes("owner"))
		return res.json({
			status: "nok",
			message: "Only the owner can update the admin.cfg!",
		});

	const steamAccount = {
		steam64id:
			req.session?.passport?.user?.id || req.session?.passport?.user?.steamid,
		displayName:
			req.session?.passport?.user?.displayName ||
			req.session?.passport?.user?.personaname,
		identifier:
			req.session?.passport?.user?.identifier ||
			req.session?.passport?.user?.profileurl,
	};
	const discordAccount = {
		id: req.session?.user?.id,
		username: req.session?.user?.username,
		discriminator: req.session?.user?.discriminator,
	};
	const form = new multiparty.Form();
	form.parse(req, async function (err, fields, files) {
		if (err) return next(err);
		if (!files.whitelistfile) return next(new Error("No file found"));
		if (files.whitelistfile.length > 1)
			return next(new Error("Too many files"));
		const file = files.whitelistfile[0];
		if (file.originalFilename.split(".").pop() !== "cfg")
			return next(new Error("File is not a .cfg file"));
		if (file.originalFilename.split(".").shift().toLowerCase() !== "admins")
			return next(new Error("File name should be admins."));
		const fileContent = fs.readFileSync(file.path);
		// Regex to get the string between Group= and :
		const regex = /^Group=(.*?):(.*)/gm;
		// make object roles to include group and permissions
		const roles = {};
		let match;
		while ((match = regex.exec(fileContent)) !== null) {
			// add match[1] to the roles with the index as index
			const tempArray = [];
			const permissions = match[2].split(",");
			for (const permission of permissions) {
				tempArray.push(permission.trim());
			}
			roles[match[1]] = {
				permissions: tempArray,
			};
		}

		// Regex to get the string between Admin= and :
		const regex2 = /Admin=(.*?):(.*)\/\/(.*)/gm;
		// make object roles to include group and permissions
		const whitelisted = {};
		let match2;
		while ((match2 = regex2.exec(fileContent)) !== null) {
			// add match[1] to the roles with the steamID as index
			whitelisted[match2[1]] = {
				role: match2[2],
				description: match2[3].trim(),
			};
		}

		await req.client.importWhitelist({
			roles: roles,
			whitelisted: whitelisted,
		});
		const log = await req.client.addLog({
			action: "WHITELIST_IMPORTED",
			author: { discord: discordAccount, steam: steamAccount },
			ip: req.session.user.lastIp,
			details: { details: null },
		});
		await log.save();
		// Send the roles to the client
		res.redirect(303, "/roles");
	});
});

router.get("/banlist/:token", async function (req, res) {
	const providedToken = req.params.token;
	const realToken = await req.client.getWhitelistToken();
	if (providedToken === realToken) {
		const banData = await req.client.getBanlist();
		return res.render("banlist", {
			bans: banData,
		});
	}
	return res.json({ status: "nok", message: "Something went wrong!" });
});

router.post("/banlist/removeUserBanlist", CheckAuth, async function (req, res) {
	if (!req.body.steamUID || !req.body.reason || !req.body.endDate)
		return res.json({
			status: "nok",
			message: "You are doing something wrong.",
		});
	const steamAccount = {
		steam64id:
			req.session?.passport?.user?.id || req.session?.passport?.user?.steamid,
		displayName:
			req.session?.passport?.user?.displayName ||
			req.session?.passport?.user?.personaname,
		identifier:
			req.session?.passport?.user?.identifier ||
			req.session?.passport?.user?.profileurl,
	};
	const discordAccount = {
		id: req.session?.user?.id,
		username: req.session?.user?.username,
		discriminator: req.session?.user?.discriminator,
	};
	const moreDetails = {
		player: req.body.steamUID,
		reason: req.body.reason,
	};
	await req.client.removeUserBanlist(req.body.steamUID, req.body.endDate);
	const log = await req.client.addLog({
		action: "PLAYER_BANLIST_REMOVED",
		author: { discord: discordAccount, steam: steamAccount },
		ip: req.session.user.lastIp,
		details: { details: moreDetails },
	});
	await log.save();
	return res.json({ status: "ok", message: "Player removed from banlist!" });
});

router.post("/mapvote/start", CheckAuth, async function (req, res) {
	const layers = [
		"Layer 1",
		"Layer 2",
		"Layer 3"
	];
	console.log("API IS GOING TO EMIT");
	await req.client.emit("ditIsTest", layers);
	console.log("API DID EMIT AND PROCEED");
	return res.json({ status: "ok", message: "Mapvote started!" });
});

/**
 * @api {get} /roles/url Get the URL of the whitelists
 * @apiName whitelistURL
 * @apiGroup WhiteList
 *
 * @apiParam (Login) {String} apiToken Your api token
 *
 * @apiSuccess {String} url The URL of the whitelists
 * @apiSuccessExample {json} Success-Response:
 *    HTTP/1.1 200 OK
	{
		"status": "ok",
		"message": "URL sent",
		"url": "localhost/whitelist/ABCDabcd1234_56789EfgIkLm"
	}
 * @apiErrorExample {json} Error-Response:
 * {
		"status": "nok",
		"message": "You are doing something wrong."
	}
 *	@apiErrorExample {json} Error-Response:
 * {
		"status": "nok",
		"message": "Only the owner can get regenerate the url!"
	}
	@apiDescription Only the owner can get the url of the whitelists
 */
router.get("/url", CheckAuth, async function (req, res) {
	const userRole = await req.client.getRoles(req.session?.user?.id);
	const canSee = await req.client.canAccess("roles", req.userInfos.id);
	if (!canSee) return res.json({ status: "nok", message: "No access!" });
	// Check if userRole has any of ["owner"]
	if (!userRole.includes("owner"))
		return res.json({
			status: "nok",
			message: "Only the owner can get the url!",
		});

	const steamAccount = {
		steam64id:
			req.session?.passport?.user?.id || req.session?.passport?.user?.steamid,
		displayName:
			req.session?.passport?.user?.displayName ||
			req.session?.passport?.user?.personaname,
		identifier:
			req.session?.passport?.user?.identifier ||
			req.session?.passport?.user?.profileurl,
	};
	const discordAccount = {
		id: req.session?.user?.id,
		username: req.session?.user?.username,
		discriminator: req.session?.user?.discriminator,
	};

	const token = await req.client.getWhitelistToken();
	const log = await req.client.addLog({
		action: "WHITELIST_URL",
		author: { discord: discordAccount, steam: steamAccount },
		ip: req.session.user.lastIp,
		details: { details: null },
	});
	await log.save();
	res.json({ status: "ok", message: "URL sent!", token: token });
});

/**
 * @api {get} /roles/url Regenerate the token for the whitelists
 * @apiName reGenerateWhitelistURL
 * @apiGroup WhiteList
 *
 * @apiParam (Login) {String} apiToken Your api token
 *
 * @apiSuccess {String} url The URL of the whitelists
 * @apiSuccessExample {json} Success-Response:
 *    HTTP/1.1 200 OK
	{
		"status": "ok",
		"message": "URL sent",
		"url": "localhost/whitelist/ThisNewTokenBdc78_457qwe1455sadASD"
	}
 * @apiErrorExample {json} Error-Response:
 * {
		"status": "nok",
		"message": "You are doing something wrong."
	}
 *	@apiErrorExample {json} Error-Response:
 * {
		"status": "nok",
		"message": "Only the owner can get regenerate the url!"
	}
	@apiDescription Only the owner can regenerate the url of the whitelists
 */
router.get("/url/regenerate", CheckAuth, async function (req, res) {
	const userRole = await req.client.getRoles(req.session?.user?.id);
	const canSee = await req.client.canAccess("roles", req.userInfos.id);
	if (!canSee) return res.json({ status: "nok", message: "No access!" });
	// Check if userRole has any of ["owner"]
	if (!userRole.includes("owner"))
		return res.json({
			status: "nok",
			message: "Only the owner can get regenerate the url!",
		});

	const steamAccount = {
		steam64id:
			req.session?.passport?.user?.id || req.session?.passport?.user?.steamid,
		displayName:
			req.session?.passport?.user?.displayName ||
			req.session?.passport?.user?.personaname,
		identifier:
			req.session?.passport?.user?.identifier ||
			req.session?.passport?.user?.profileurl,
	};
	const discordAccount = {
		id: req.session?.user?.id,
		username: req.session?.user?.username,
		discriminator: req.session?.user?.discriminator,
	};

	const token = await req.client.regenerateToken();
	const log = await req.client.addLog({
		action: "WHITELIST_URL_REGENERATED",
		author: { discord: discordAccount, steam: steamAccount },
		ip: req.session.user.lastIp,
		details: { details: null },
	});
	await log.save();
	res.json({ status: "ok", message: "URL sent!", token: token });
});

/**
 * @api {post} /roles/whitelist/removeUserWhitelist Remove the whitelist from a player
 * @apiName RemoveWhitelistPlayer
 * @apiGroup WhiteList
 *
 * @apiParam (Login) {String} apiToken Your api token
 * @apiParam {String} steamID The steamID of the player to be removed from the whitelist.
 * @apiParam {String} reason The reason.
 *
 * @apiSuccess {Object} status The status of the request.
 * @apiSuccessExample {json} Success-Response:
 *    HTTP/1.1 200 OK
	{
		"status": "ok",
		"message": "Whitelist removed from the player!"
	}
 * @apiErrorExample {json} Error-Response:
 * {
		"status": "nok",
		"message": "You are doing something wrong."
	}
 */
router.post(
	"/whitelist/removeUserWhitelist",
	CheckAuth,
	async function (req, res) {
		if (!req.body.steamUID || !req.body.reason)
			return res.json({
				status: "nok",
				message: "You are doing something wrong.",
			});
		const steamAccount = {
			steam64id:
				req.session?.passport?.user?.id || req.session?.passport?.user?.steamid,
			displayName:
				req.session?.passport?.user?.displayName ||
				req.session?.passport?.user?.personaname,
			identifier:
				req.session?.passport?.user?.identifier ||
				req.session?.passport?.user?.profileurl,
		};
		const discordAccount = {
			id: req.session?.user?.id,
			username: req.session?.user?.username,
			discriminator: req.session?.user?.discriminator,
		};
		const moreDetails = {
			player: req.body.steamUID,
			reason: req.body.reason,
		};
		await req.client.removeUserWhitelist(req.body.steamUID);
		const log = await req.client.addLog({
			action: "PLAYER_WHITELIST_REMOVED",
			author: { discord: discordAccount, steam: steamAccount },
			ip: req.session.user.lastIp,
			details: { details: moreDetails },
		});
		await log.save();
		return res.json({
			status: "ok",
			message: "Whitelist removed from the player!",
		});
	}
);

router.post("/players/update/stats", CheckAuth, async function (req, res) {
	if (!req.body.userID)
		return res.json({
			status: "nok",
			message: "You are doing something wrong.",
		});

	await req.client.updateStats(req.body.userID);
	return res.json({ status: "ok", message: "Stats updated!" });
});

router.post("/players/get/leaderboard", CheckAuth, async function (req, res) {
	const response = await req.client.getLeaderboard();
	return res.json(response);
});

router.post(
	"/whitelist/roles/addPermission",
	CheckAuth,
	async function (req, res) {
		if (!req.body.role || !req.body.permission)
			return res.json({
				status: "nok",
				message: "You are doing something wrong.",
			});

		const steamAccount = {
			steam64id:
				req.session?.passport?.user?.id || req.session?.passport?.user?.steamid,
			displayName:
				req.session?.passport?.user?.displayName ||
				req.session?.passport?.user?.personaname,
			identifier:
				req.session?.passport?.user?.identifier ||
				req.session?.passport?.user?.profileurl,
		};
		const discordAccount = {
			id: req.session?.user?.id,
			username: req.session?.user?.username,
			discriminator: req.session?.user?.discriminator,
		};
		const moreDetails = {
			role: req.body.role,
			permission: req.body.permission,
		};
		await req.client.addWhitelistRolePermission(
			req.body.role,
			req.body.permission
		);
		const log = await req.client.addLog({
			action: "WHITELIST_GROUPE_PERM_ADD",
			author: { discord: discordAccount, steam: steamAccount },
			ip: req.session.user.lastIp,
			details: { details: moreDetails },
		});
		await log.save();
		return res.json({ status: "ok", message: "Permission added!" });
	}
);
router.post(
	"/whitelist/roles/removePermission",
	CheckAuth,
	async function (req, res) {
		if (!req.body.role || !req.body.permission)
			return res.json({
				status: "nok",
				message: "You are doing something wrong.",
			});
		const steamAccount = {
			steam64id:
				req.session?.passport?.user?.id || req.session?.passport?.user?.steamid,
			displayName:
				req.session?.passport?.user?.displayName ||
				req.session?.passport?.user?.personaname,
			identifier:
				req.session?.passport?.user?.identifier ||
				req.session?.passport?.user?.profileurl,
		};
		const discordAccount = {
			id: req.session?.user?.id,
			username: req.session?.user?.username,
			discriminator: req.session?.user?.discriminator,
		};
		const moreDetails = {
			role: req.body.role,
			permission: req.body.permission,
		};

		const log = await req.client.addLog({
			action: "WHITELIST_GROUPE_PERM_REMOVE",
			author: { discord: discordAccount, steam: steamAccount },
			ip: req.session.user.lastIp,
			details: { details: moreDetails },
		});
		await log.save();
		await req.client.removeWhitelistRolePermission(
			req.body.role,
			req.body.permission
		);
		return res.json({ status: "ok", message: "Permission removed!" });
	}
);

router.post("/whitelist/addGroup", CheckAuth, async function (req, res) {
	if (!req.body.group)
		return res.json({
			status: "nok",
			message: "You are doing something wrong.",
		});
	const steamAccount = {
		steam64id:
			req.session?.passport?.user?.id || req.session?.passport?.user?.steamid,
		displayName:
			req.session?.passport?.user?.displayName ||
			req.session?.passport?.user?.personaname,
		identifier:
			req.session?.passport?.user?.identifier ||
			req.session?.passport?.user?.profileurl,
	};
	const discordAccount = {
		id: req.session?.user?.id,
		username: req.session?.user?.username,
		discriminator: req.session?.user?.discriminator,
	};

	// trim and make sure group is not empty and has no special characters or spaces
	const group = req.body.group.trim().replace(/[^a-zA-Z0-9_]/g, "");
	if (!group)
		return res.json({
			status: "nok",
			message: "You are doing something wrong.",
		});

	const moreDetails = {
		group: group,
	};
	await req.client.addWhitelistGroup(group);
	const log = await req.client.addLog({
		action: "WHITELIST_GROUP_ADD",
		author: { discord: discordAccount, steam: steamAccount },
		ip: req.session.user.lastIp,
		details: { details: moreDetails },
	});
	await log.save();
	return res.redirect(303, "/roles");
});

router.post(
	"/whitelist/addUserWhitelist",
	CheckAuth,
	async function (req, res) {
		if (!req.body.steamID || !req.body.description || !req.body.role)
			return res.json({
				status: "nok",
				message: "You are doing something wrong.",
			});
		const steamAccount = {
			steam64id:
				req.session?.passport?.user?.id || req.session?.passport?.user?.steamid,
			displayName:
				req.session?.passport?.user?.displayName ||
				req.session?.passport?.user?.personaname,
			identifier:
				req.session?.passport?.user?.identifier ||
				req.session?.passport?.user?.profileurl,
		};
		const discordAccount = {
			id: req.session?.user?.id,
			username: req.session?.user?.username,
			discriminator: req.session?.user?.discriminator,
		};
		const moreDetails = {
			player: req.body.steamID,
			description: req.body.description,
			role: req.body.role,
		};
		await req.client.addUserWhitelist(
			req.body.steamID,
			req.body.role,
			req.body.description
		);
		const log = await req.client.addLog({
			action: "PLAYER_WHITELIST_ADD",
			author: { discord: discordAccount, steam: steamAccount },
			ip: req.session.user.lastIp,
			details: { details: moreDetails },
		});
		await log.save();
		return res.redirect(303, "/roles");
	}
);

router.post("/whitelist/removeGroup", CheckAuth, async function (req, res) {
	if (!req.body.group)
		return res.json({
			status: "nok",
			message: "You are doing something wrong.",
		});
	const steamAccount = {
		steam64id:
			req.session?.passport?.user?.id || req.session?.passport?.user?.steamid,
		displayName:
			req.session?.passport?.user?.displayName ||
			req.session?.passport?.user?.personaname,
		identifier:
			req.session?.passport?.user?.identifier ||
			req.session?.passport?.user?.profileurl,
	};
	const discordAccount = {
		id: req.session?.user?.id,
		username: req.session?.user?.username,
		discriminator: req.session?.user?.discriminator,
	};
	const moreDetails = {
		group: req.body.group,
	};
	await req.client.removeWhitelistRole(req.body.group);
	const log = await req.client.addLog({
		action: "WHITELIST_GROUP_REMOVE",
		author: { discord: discordAccount, steam: steamAccount },
		ip: req.session.user.lastIp,
		details: { details: moreDetails },
	});
	await log.save();
	// return ok status
	return res.json({ status: "ok", message: "Group removed!" });
});

router.post("/roles/toggleRole", CheckAuth, async function (req, res) {
	if (!req.body.userId || !req.body.role)
		return res.json({
			status: "nok",
			message: "You are doing something wrong.",
		});
	const steamAccount = {
		steam64id:
			req.session?.passport?.user?.id || req.session?.passport?.user?.steamid,
		displayName:
			req.session?.passport?.user?.displayName ||
			req.session?.passport?.user?.personaname,
		identifier:
			req.session?.passport?.user?.identifier ||
			req.session?.passport?.user?.profileurl,
	};
	const discordAccount = {
		id: req.session?.user?.id,
		username: req.session?.user?.username,
		discriminator: req.session?.user?.discriminator,
	};
	const moreDetails = {
		userId: req.body.userId,
		role: req.body.role,
	};
	const status = await req.client.toggleUserRole(
		req.body.userId,
		req.body.role
	);
	const log = await req.client.addLog({
		action: `ROLE_${status.toUpperCase()}`,
		author: { discord: discordAccount, steam: steamAccount },
		ip: req.session.user.lastIp,
		details: { details: moreDetails },
	});
	await log.save();
	// return ok status
	return res.json({ status: "ok", message: `${status.toUpperCase()}` });
});

router.post("/roles/toggleWhoCan", CheckAuth, async function (req, res) {
	if (!req.body.typeAction || !req.body.role)
		return res.json({
			status: "nok",
			message: "You are doing something wrong.",
		});
	const steamAccount = {
		steam64id:
			req.session?.passport?.user?.id || req.session?.passport?.user?.steamid,
		displayName:
			req.session?.passport?.user?.displayName ||
			req.session?.passport?.user?.personaname,
		identifier:
			req.session?.passport?.user?.identifier ||
			req.session?.passport?.user?.profileurl,
	};
	const discordAccount = {
		id: req.session?.user?.id,
		username: req.session?.user?.username,
		discriminator: req.session?.user?.discriminator,
	};
	const moreDetails = {
		typeAction: req.body.typeAction,
		role: req.body.role,
	};
	const status = await req.client.toggleWhoCan(
		req.body.typeAction,
		req.body.role
	);
	if(!status) return res.json({ status: "nok", message: "Something is not good with the permissions schema!" });
	const msg = status === "added" ? "ADDED" : "REMOVED";
	const log = await req.client.addLog({
		action: `WHO_CAN_${req.body.typeAction.toUpperCase()}_${msg.toUpperCase()}_${req.body.role.toUpperCase()}`,
		author: { discord: discordAccount, steam: steamAccount },
		ip: req.session.user.lastIp,
		details: { details: moreDetails },
	});
	await log.save();
	// return ok status
	return res.json({ status: "ok", message: `${status.toUpperCase()}` });
});

router.post("/roles/toggleCanSee", CheckAuth, async function (req, res) {
	if (!req.body.page || !req.body.role)
		return res.json({
			status: "nok",
			message: "You are doing something wrong.",
		});

	const steamAccount = {
		steam64id:
			req.session?.passport?.user?.id || req.session?.passport?.user?.steamid,
		displayName:
			req.session?.passport?.user?.displayName ||
			req.session?.passport?.user?.personaname,
		identifier:
			req.session?.passport?.user?.identifier ||
			req.session?.passport?.user?.profileurl,
	};
	const discordAccount = {
		id: req.session?.user?.id,
		username: req.session?.user?.username,
		discriminator: req.session?.user?.discriminator,
	};
	const moreDetails = {
		page: req.body.page,
		role: req.body.role,
	};
	const status = await req.client.toggleCanSee(
		req.body.page,
		req.body.role
	);
	if(!status) return res.json({ status: "nok", message: "Something is not good with the permissions schema!" });
	const msg = status === "added" ? "ADDED" : "REMOVED";	
	const log = await req.client.addLog({
		action: `CAN_SEE_${req.body.page.toUpperCase()}_${msg.toUpperCase()}_${req.body.role.toUpperCase()}`,
		author: { discord: discordAccount, steam: steamAccount },
		ip: req.session.user.lastIp,
		details: { details: moreDetails },
	});
	await log.save();
	// return ok status
	return res.json({ status: "ok", message: `${status.toUpperCase()}` });
});

router.post("/roles/addRole", CheckAuth, async function (req, res) {
	if (!req.body.role)
		return res.json({
			status: "nok",
			message: "You are doing something wrong.",
		});

	const steamAccount = {
		steam64id:
			req.session?.passport?.user?.id || req.session?.passport?.user?.steamid,
		displayName:
			req.session?.passport?.user?.displayName ||
			req.session?.passport?.user?.personaname,
		identifier:
			req.session?.passport?.user?.identifier ||
			req.session?.passport?.user?.profileurl,
	};
	const discordAccount = {
		id: req.session?.user?.id,
		username: req.session?.user?.username,
		discriminator: req.session?.user?.discriminator,
	};
	const moreDetails = {
		role: req.body.role,
	};
		
	const status = await req.client.addUserRole(
		req.body.role
	);
	if(!status) return res.json({ status: "nok", message: "Something is not good with the permissions schema!" });
	const log = await req.client.addLog({
		action: "ADD_NEW_ROLE",
		author: { discord: discordAccount, steam: steamAccount },
		ip: req.session.user.lastIp,
		details: { details: moreDetails },
	});
	await log.save();
	// return ok status
	return res.json({ status: "ok", message: "The new role is added!" });
});

router.post("/roles/removeRole", CheckAuth, async function (req, res) {
	if (!req.body.role)
		return res.json({
			status: "nok",
			message: "You are doing something wrong.",
		});
	
	if(req.body.role === "owner") return res.json({ status: "nok", message: "You can't remove the owner role!" });
	const steamAccount = {
		steam64id:
			req.session?.passport?.user?.id || req.session?.passport?.user?.steamid,
		displayName:
			req.session?.passport?.user?.displayName ||
			req.session?.passport?.user?.personaname,
		identifier:
			req.session?.passport?.user?.identifier ||
			req.session?.passport?.user?.profileurl,
	};
	const discordAccount = {
		id: req.session?.user?.id,
		username: req.session?.user?.username,
		discriminator: req.session?.user?.discriminator,
	};
	const moreDetails = {
		role: req.body.role,
	};
		
	const status = await req.client.removeUserRole(
		req.body.role
	);
	if(!status) return res.json({ status: "nok", message: "Something is not good with the permissions schema!" });
	const log = await req.client.addLog({
		action: "REMOVE_ROLE",
		author: { discord: discordAccount, steam: steamAccount },
		ip: req.session.user.lastIp,
		details: { details: moreDetails },
	});
	await log.save();
	// return ok status
	return res.json({ status: "ok", message: "The new role is added!" });
});


router.post(
	"/dashboard/toggleShowNotifications",
	CheckAuth,
	async function (req, res) {
		if (!req.body.actionType)
			return res.json({
				status: "nok",
				message: "You are doing something wrong.",
			});
		await req.client.toggleShowNotifications(req.body.actionType);
		// return ok status
		return res.json({ status: "ok", message: "Toggled the notification!" });
	}
);

router.post(
	"/dashboard/toggleUpdatePlayersTable",
	CheckAuth,
	async function (req, res) {
		if (!req.body.actionType)
			return res.json({
				status: "nok",
				message: "You are doing something wrong.",
			});
		await req.client.toggleUpdatePlayersTable(req.body.actionType);
		// return ok status
		return res.json({ status: "ok", message: "Toggled the notification!" });
	}
);

router.get(
	"/dashboard/getShowNotifications",
	CheckAuth,
	async function (req, res) {
		const showNotifications = await req.client.getShowNotifications();
		return res.json({ status: "ok", showNotifications: showNotifications });
	}
);

router.get(
	"/dashboard/getUpdatePlayersTable",
	CheckAuth,
	async function (req, res) {
		const showUpdatePlayersTable = await req.client.getUpdatePlayersTable();
		return res.json({
			status: "ok",
			showUpdatePlayersTable: showUpdatePlayersTable,
		});
	}
);

router.post(
	"/dashboard/toggleDashboardSettings",
	CheckAuth,
	async function (req, res) {
		if (!req.body.onSetting || !req.body.typeSetting)
			return res.json({
				status: "nok",
				message: "You are doing something wrong.",
			});
		
		await req.client.toggleDashboardSettings(req.body.typeSetting, req.body.onSetting);
		return res.json({ status: "ok", message: "Toggled!" });
	}
);

module.exports = router;
