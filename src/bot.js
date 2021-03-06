import { Client } from 'espn-fantasy-football-api/node';
import axios from 'axios';

'use strict'

const slack = require('slack')
const _ = require('lodash')
const config = require('./config')
const request = require('request');

let bot = slack.rtm.client()
let leagueId = process.env.LEAGUE_ID;
let seasonId = process.env.SEASON_ID;
let espnS2 = process.env.ESPN_S2;
let swid = process.env.SWID;
let teamIdMap = JSON.parse(process.env.TEAM_ID_MAP);
let thisUrl = process.env.THIS_URL;
let timeout = Number(process.env.TIMEOUT);
//will use the api once it has the methods I need.
//const ffClient = new Client({ leagueId: leagueId });
axios.defaults.baseURL = "https://fantasy.espn.com/apis/v3/games/ffl/seasons/"
const routeBase = `${seasonId}/segments/0/leagues/${leagueId}`;

// keep dyno from falling asleep.
var reqTimer = setTimeout(function wakeUp() {
   request(thisUrl, function() {
         console.log("WAKE UP DYNO");
      });
   return reqTimer = setTimeout(wakeUp, timeout);
}, timeout);

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
        //console.log("len " + players.length);
        let id = players[0].id + "";
        if (id === teamId) {
            let thisTeamsPlayers = _.get(players[0], ['roster', 'entries']);
            thisTeamsPlayers.forEach((i) => {
                //console.log("keys: " + Object.keys(i.playerPoolEntry.player ));
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
}

bot.started((payload) => {
	bot.self = payload.self
	console.log(`BOT: leagueid: ${leagueId} seasonid: ${seasonId}`);
	console.log(`auth: swid: ${swid} espnS2: ${espnS2}`);
	console.log(`teamIdMap teamIdmap: ${JSON.stringify(teamIdMap)}`)
});

function getRandomInt(max) {
  return Math.floor(Math.random() * Math.floor(max));
}

function isEligible(targetPlayer) {
    if (targetPlayer.playerPoolEntry.player.injuryStatus === "DOUBTFUL") {
        return false;
    }
    else {
        return targetPlayer.playerPoolEntry.player.injured !== true;
    }
}

function pickTeamAndPlayer(teams) {
    let aTeam = {};

    let leagueSize = teams.length;
    let targetTeamidx = getRandomInt(leagueSize);
    let targetTeam = teams[targetTeamidx];
    let teamSize = targetTeam.players.length;
    let targetPlayerIdx = getRandomInt(teamSize);
    let targetPlayer = targetTeam.players[targetPlayerIdx];

    if (isEligible(targetPlayer)) {
        aTeam.team = targetTeam;
        aTeam.player = targetPlayer;
    }
    else {
        //console.log("not eligible, re-rolling: " + JSON.stringify(targetPlayer.playerPoolEntry.player));
        console.log("not eligible, re-rolling.");
        return pickTeamAndPlayer(teams);
    }
    return aTeam;
}

function getPositionIdOfPlayer(player) {
    let playerId =  player.playerPoolEntry.player.defaultPositionId;
    //console.log("target player " + JSON.stringify(player.playerPoolEntry.player));
    //console.log("defaultPositionId " + JSON.stringify(playerId));
    return playerId;
}

const positionMap = {1:"qb", 2:"rb", 3:"wr", 4:"te", 5:"k", 16:"d"};
const playerTradeGroup = [5, 16]; //decision to group kickers and defense together.
const auctionDraftTiers = {"tier1": {"min": 30.0, "max": 200.0},
                "tier2":{"min":15.0,"max":30.0},
                "tier3":{"min":0.0, "max":15.0}};

const specialTierGroup = [1, 4];
const specialRankTier = {"tier1": {"min": 0, "max": 4}, "tier2": {"min":4, "max": 12}, "tier3": {"min":12, "max": 1000000}};
const normalRankTier = {"tier1": {"min": 0, "max": 12}, "tier2": {"min":12, "max": 40}, "tier3": {"min":40, "max": 1000000}};

function getRankValueOfPlayer(player) {
    //this is the GLOBAL average for all of the players
    //TODO maybe make note if we over/under valued a player.
    let value = player.playerPoolEntry.ratings[0].positionalRanking;
    //console.log("for player: " + JSON.stringify(player.playerPoolEntry.player.ownership));
    //console.log("auctionDraftValue: " + value);
    return value;
}

function getAuctionDraftValueOfPlayer(player) {
    //this is the GLOBAL average for all of the players
    //TODO maybe make note if we over/under valued a player.
    let value = player.playerPoolEntry.player.ownership.auctionValueAverage;
    //console.log("for player: " + JSON.stringify(player.playerPoolEntry.player.ownership));
    //console.log("auctionDraftValue: " + value);
    return value;
}

function checkTier(value, tiers) {
    let tierVal;
    for (let i = 0; i < Object.keys(tiers).length; ++i) {
        let tierKey = Object.keys(tiers)[i];
        let tier = tiers[tierKey];
        let min = tier.min;
        let max = tier.max;
        if (value >= min && value < max) {
            tierVal = tierKey;
            break;
        }
    }
    return tierVal;
}

function getPositionRankTier(rankValue, positionId) {
    if (_.includes(specialTierGroup, positionId)) {
        return checkTier(rankValue, specialRankTier)
    }
    else {
        return checkTier(rankValue, normalRankTier)
    }
}

function getAuctionDraftTier(auctionDraftValue) {
    return checkTier(auctionDraftValue, auctionDraftTiers);
}

function getPlayerTier(player, scoringPeriod) {
    let positionId = getPositionIdOfPlayer(player);
    if (scoringPeriod >= 4) {
        let rankValue = getRankValueOfPlayer(player);
        return getPositionRankTier(rankValue, positionId);
    }
    else {
        let auctionDraftValue = getAuctionDraftValueOfPlayer(player);
        return getAuctionDraftTier(auctionDraftValue);
    }
}

function arePlayersInSameTier(firstTeamAndPlayer, secondTeamAndPlayer, scoringPeriod) {
    let firstPlayerTier = getPlayerTier(firstTeamAndPlayer.player, scoringPeriod);
    let secondPlayerTier = getPlayerTier(secondTeamAndPlayer.player, scoringPeriod);
    return firstPlayerTier === secondPlayerTier;
}

function arePlayersInSameGroup(firstTeamAndPlayer, secondTeamAndPlayer, scoringPeriod) {
    let firstTeamPositionId = getPositionIdOfPlayer(firstTeamAndPlayer.player);
    let secondTeamPositionId = getPositionIdOfPlayer(secondTeamAndPlayer.player);
    let firstTeamPlayerInGroup = playerTradeGroup.includes(firstTeamPositionId);
    let secondTeamPlayerInGroup = playerTradeGroup.includes(secondTeamPositionId);

    let arePlayersInSameGroup = (firstTeamPlayerInGroup && secondTeamPlayerInGroup) || (!firstTeamPlayerInGroup && !secondTeamPlayerInGroup);
    return arePlayersInSameGroup;
}

function teamsAreDifferent(firstTeamAndPlayer, secondTeamAndPlayer) {
    let teamOne = firstTeamAndPlayer.team;
    let teamTwo = secondTeamAndPlayer.team;
    return teamOne.id !== teamTwo.id;
}

function chaosRoll(msg, teams, scoringPeriod) {
    let firstTeamAndPlayer = pickTeamAndPlayer(teams);
    let secondTeamAndPlayer = pickTeamAndPlayer(teams);

    console.log("CHAOS ROLL!!!!!");
    while(!(teamsAreDifferent(firstTeamAndPlayer, secondTeamAndPlayer)
            && arePlayersInSameGroup(firstTeamAndPlayer, secondTeamAndPlayer, scoringPeriod)
            && arePlayersInSameTier(firstTeamAndPlayer, secondTeamAndPlayer, scoringPeriod))) {
        console.log("looking for new second player");
        secondTeamAndPlayer = pickTeamAndPlayer(teams);
    }
    console.log("CHAOS ROLL DONE!!!!!");

    let choice = {};
    choice.firstTeam = firstTeamAndPlayer.team.firstName;
    choice.firstPlayer = firstTeamAndPlayer.player.playerPoolEntry.player.fullName;
    choice.secondTeam = secondTeamAndPlayer.team.firstName;
    choice.secondPlayer = secondTeamAndPlayer.player.playerPoolEntry.player.fullName;
    /*
    choice.firstPlayerPositionId = positionMap[firstTeamAndPlayer.player.playerPoolEntry.player.defaultPositionId];
    choice.secondPlayerPositionId = positionMap[secondTeamAndPlayer.player.playerPoolEntry.player.defaultPositionId];
    if (scoringPeriod >= 4) {
        choice.firstPlayerValue = firstTeamAndPlayer.player.playerPoolEntry.ratings[0].positionalRanking;
        choice.secondPlayerValue = secondTeamAndPlayer.player.playerPoolEntry.ratings[0].positionalRanking;
    }
    else {
        choice.firstPlayerValue = firstTeamAndPlayer.player.playerPoolEntry.player.ownership.auctionValueAverage;
        choice.secondPlayerValue = secondTeamAndPlayer.player.playerPoolEntry.player.ownership.auctionValueAverage;
    }
     */

    // we're good
    slackPost(msg, choice);
}

function determineIfChaosRollReady(msg, teams, leagueSize, scoringPeriod) {
    if (teams.length === leagueSize) {
        //console.log(teams.length);
        //console.log(JSON.stringify(teams[0]));
        chaosRoll(msg, teams, scoringPeriod);
        //slackPost(msg, teams[0]);
    }
}

bot.message((msg) => {
	if (!msg.user) return
	let id = `<@${bot.self.id}>`;
	if (!_.includes(msg.text.match(/<@([A-Z0-9])+>/igm), id)) return

	let text = msg.text;
	let scoringPeriodId = text.replace(id, "");
	text = scoringPeriodId;
	let invalidScoringPeriodId = true;
	let scoringPeriod = undefined;
	if (scoringPeriodId !== undefined) {
		scoringPeriod = Number(scoringPeriodId.trim());
	}
	if (!!scoringPeriod) {
		getTeamsInLeague().then((teams) => {
			let newTeams = [];
			let leagueSize = teams.length;
			teams.forEach((m, idx, arr) => {
				let newMember = m;
				let teamId = m.id;
				//TODO make this a parameter!!! do not hardcode 0!!!
				getPlayersOnTeam(teamId, scoringPeriod).then((players) => {
					newMember.players = players;
					//console.log("players " + players.length);
					newTeams.push(newMember);
					determineIfChaosRollReady(msg, newTeams, leagueSize, scoringPeriod);
				});
			});
		});
	}
	else {
		slackPost(msg, "invalid request: " + text + ". Pass me a number. How about the current week of the season? ...Ignore anything brock says.");
	}
});

module.exports = bot
