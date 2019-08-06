import { Client } from 'espn-fantasy-football-api/node';
import axios from 'axios';

'use strict'

const slack = require('slack')
const _ = require('lodash')
const config = require('./config')

let bot = slack.rtm.client()
let leagueId = process.env.LEAGUE_ID;
let seasonId = process.env.SEASON_ID;
let espnS2 = process.env.ESPN_S2;
let swid = process.env.SWID;
let teamIdMap = JSON.parse(process.env.TEAM_ID_MAP);
let thisUrl = process.env.THIS_URL;
//will use the api once it has the methods I need.
//const ffClient = new Client({ leagueId: leagueId });
axios.defaults.baseURL = "https://fantasy.espn.com/apis/v3/games/ffl/seasons/"
const routeBase = `${seasonId}/segments/0/leagues/${leagueId}`;


// keep dyno from falling asleep.
var reqTimer = setTimeout(function wakeUp() {
   request(thisUrl, function() {
         console.log("WAKE UP DYNO");
      });
   return reqTimer = setTimeout(wakeUp, 1200000);
}, 1200000);

function getMessage() {
	return `beep boop! ${leagueId} ${seasonId}"`
}

/**
 * Correctly builds an axios config with cookies, if set on the instance
 * @param  {object} config An axios config.
 * @return {object}        An axios config with cookies added if set on instance
 *  @private
 *
 */
function _buildAxiosConfig(config) {
	if ((espnS2 && swid)) {
		const headers = { Cookie: `espn_s2=${espnS2}; SWID=${swid};` };
		return _.merge({}, config, { headers, withCredentials: true });
	}
	return config;
}

function getPlayersOnTeam(teamUniqueId, scoringPeriodId) {
    const teamId = teamIdMap[teamUniqueId];
    //http://fantasy.espn.com/apis/v3/games/ffl/seasons/2019/segments/0/leagues/168284
    //const routeBase = `${seasonId}/segments/0/leagues/${leagueId}`;
    const playerRouteParams = `?forTeamId=${teamId}&scoringPeriodId=${scoringPeriodId}&view=mRoster`;
    const getPlayersRoute = `${routeBase}${playerRouteParams}`;

    return axios.get(getPlayersRoute, _buildAxiosConfig()).then((response) => {
        const players = _.get(response.data, 'teams');
        console.log("len " + players.length);
        let id = players[0].id + "";
        if (id === teamId) {
            let thisTeamsPlayers = _.get(players[0], ['roster', 'entries']);
            thisTeamsPlayers.forEach((i) => {
                console.log("keys: " + Object.keys(i.playerPoolEntry.player ));
                delete i.playerPoolEntry.player.rankings;
            });
            return thisTeamsPlayers;
        }
    })
    .catch((err) => {
        console.log(`getPlayersOnTeam failed: ${err} ${JSON.stringify(err)}`);
    })
}

function getTeamsInLeague() {
    //http://fantasy.espn.com/apis/v3/games/ffl/seasons/2019/segments/0/leagues/168284
    const teamRouteParams = `?view=mRoster&view=mTeam&view=modular&view=mNav`;
	const getTeamsRoute = `${routeBase}${teamRouteParams}`;

	return axios.get(getTeamsRoute, _buildAxiosConfig()).then((response) => {
		const members = _.get(response.data, 'members');
		return members;
	})
    .catch((err) => {
		console.log(`getTeamsInLeague failed: ${err} ${JSON.stringify(err)}`);
	});
}

function slackPost(msg, outgoing) {
    slack.chat.postMessage({
        token: config('SLACK_TOKEN'),
        icon_emoji: config('ICON_EMOJI'),
        channel: msg.channel,
        username: 'C ⚛ H ⛾ A ☭ O ⛐ S  ☉ M ☲ O ☬ N ⚰ K ♛ E ⛤ Y',
        text: `${JSON.stringify(outgoing)}`
    }, (err, data) => {
        if (err) throw err
        let txt = _.truncate(data.message.text)
        console.log(`🤖  bleep bloop: I responded with "${txt}"`)
    })
        /*
    .catch((err) => {
        console.log(`slack post message failed ${err} ${JSON.stringify(err)}`);
    });
         */
}

bot.started((payload) => {
	bot.self = payload.self
	console.log(`BOT: leagueid: ${leagueId} seasonid: ${seasonId}`);
	console.log(`auth: swid: ${swid} espnS2: ${espnS2}`);
	console.log(`teamIdMap teamIdmap: ${JSON.stringify(teamIdMap)}`)
});

bot.message((msg) => {
	if (!msg.user) return
	if (!_.includes(msg.text.match(/<@([A-Z0-9])+>/igm), `<@${bot.self.id}>`)) return

	getTeamsInLeague().then((teams) => {
	    let newTeams = [];
	    teams.forEach((m, idx, arr) => {
	        let newMember = m;
	        let teamId = m.id;
	        console.log("m: " + JSON.stringify(m));
	        getPlayersOnTeam(teamId, 0).then((players) => {
                newMember.players = players;
                console.log("players " + players.length);
                newTeams.push(newMember);
                slackPost(msg, newMember);
            });
        });
	});
});

module.exports = bot
