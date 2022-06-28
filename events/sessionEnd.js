const chalk = require("chalk");
const version = require("../package.json").version;
const axios = require("axios");

module.exports = class {
    constructor(client) {
        this.client = client;
    }

    async run(playerData) {
        let isNewGame = false;
        const client = this.client;
        const socket = client.socket;
        socket.on("NEW_GAME", async (data) => {
            isNewGame = true;
        })
        // to be sure that this not a false alarm ( NEW GAME event triggers player disconnect event ETA time for NEW_GAME is 25-30 seconds )
        if (!isNewGame) {
            setTimeout(async () => {
                const user = await client.findUserByID(playerData?.player?.steamID);
                if (!user) return;
                const inList = client.players.find((p) => p.player.steamID === user.steam.steamid);
                if (inList) {
                    const playTime = Date.now() - inList.entry;
                    user.squad.playTime = user.squad.playTime ? user.squad.playTime + playTime : playTime;
                    user.squad.lastOnline = Date.now();
                    user.squad.sessions ? user.squad.sessions.push(inList.session) : user.squad.sessions = [inList.session];
                    user.markModified("squad");
                    await user.save();
                    client.players.splice(client.players.indexOf(inList), 1);
                }
            }, 25000);
        }
    }
}