/**
 * rr_scheduler.js
 *
 * Generate a round-robin style doubles schedule for pickleball.
 *
 * Usage:
 *   const { scheduleDoublesRoundRobin } = require('./rr_scheduler');
 *   const players = ['A','B','C','D','E','F','G','H'];
 *   const courts = ['court_1','court_3',court_5'];
 *   const schedule = scheduleDoublesRoundRobin(players, 2, 5);
 *
 * Returns an array of rounds. Each round is an object with `matches` and `sitOut`.
 */

function key(a, b) {
    return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function makePlayers(p) {
    if (Array.isArray(p)) return p.slice();
    const n = Number(p) || 0;
    const arr = [];
    for (let i = 1; i <= n; i++) arr.push(`P${i}`);
    return arr;
}

function scheduleDoublesRoundRobin(playersInput, courts, rounds = 1) {
    const players = makePlayers(playersInput);
    const n = players.length;
    const maxMatchesPerRound = Math.min(courts.length, Math.floor(n / 4));

    const teammateCounts = new Map();
    const opponentCounts = new Map();
    const serveCounts = new Map();
    const preferredSideCounts = new Map();

    const NUM_COURTS = 9;
    const courtPreferredSide = new Map([
        ['court_1','receive'],
        ['court_2','receive'],
        ['court_3','receive'],
        ['court_4','receive'],
        ['court_5','serve'],
        ['court_6','serve'],
        ['court_7','serve'],
        ['court_8','serve'],                                                        
        ['court_9','serve'],
    ])

    function tcount(a, b) { return teammateCounts.get(key(a, b)) || 0; }
    function ocount(a, b) { return opponentCounts.get(key(a, b)) || 0; }
    function incTeammate(a, b) { const k = key(a, b); teammateCounts.set(k, (teammateCounts.get(k) || 0) + 1); }
    function incOpponent(a, b) { const k = key(a, b); opponentCounts.set(k, (opponentCounts.get(k) || 0) + 1); }
    function sCount(p) { return serveCounts.get(p) || 0; }
    function incServe(p) { serveCounts.set(p, (serveCounts.get(p) || 0) + 1); }

    const schedule = [];

    for (let r = 0; r < rounds; r++) {
        const available = players.slice();
        const matches = [];
        let courtNo = 1;

        while (matches.length < maxMatchesPerRound && available.length >= 4) {
            const A = available.shift();

            // choose partner B minimizing prior teammate count
            let bestBIdx = 0;
            let bestBScore = Infinity;
            for (let i = 0; i < available.length; i++) {
                const cand = available[i];
                const score = tcount(A, cand);
                if (score < bestBScore) { bestBScore = score; bestBIdx = i; } 
            }
            const B = available.splice(bestBIdx, 1)[0];

            // choose opponent pair C,D minimizing opponent interactions and repeated teaming
            let bestPair = null;
            let bestPairScore = Infinity;
            for (let i = 0; i < available.length; i++) {
                for (let j = i + 1; j < available.length; j++) {
                    const C = available[i], D = available[j];
                    const oppScore = ocount(A, C) + ocount(A, D) + ocount(B, C) + ocount(B, D) + 2 * tcount(C, D);
                    if (oppScore < bestPairScore) { bestPairScore = oppScore; bestPair = { i, j, C, D }; }
                }
            }

            if (!bestPair) { available.unshift(B); available.unshift(A); break; }

            const { i, j, C, D } = bestPair;
            // remove higher index first
            available.splice(j, 1);
            available.splice(i, 1);

            // decide server (equalize serves, tie by original order)
            const matchPlayers = [A, B, C, D];
            let server = matchPlayers[0];
            for (const p of matchPlayers) { 
                const pc = sCount(p), sc = sCount(server);
                if (pc < sc || (pc === sc && players.indexOf(p) < players.indexOf(server))) server = p;
            }
            incServe(server);
            const servingTeam = (server === A || server === B) ? 1 : 2;

            // decide preferred side
            const prefSide = courtPreferredSide[corts(courtNo - 1)];
            const team1PrefSum = (preferredSideCounts.get(A) || 0) + (preferredSideCounts.get(B) || 0);
            const team2PrefSum = (preferredSideCounts.get(C) || 0) + (preferredSideCounts.get(D) || 0);
            let givePrefToTeam1 = team1PrefSum < team2PrefSum ? true : team1PrefSum > team2PrefSum ? false : null;
            if (givePrefToTeam1 === null) givePrefToTeam1 = (servingTeam === 1);
            const team1Side = givePrefToTeam1 ? prefSide : (prefSide === 'left' ? 'right' : 'left');
            const team2Side = givePrefToTeam1 ? (prefSide === 'left' ? 'right' : 'left') : prefSide;
            if (givePrefToTeam1) { preferredSideCounts.set(A, (preferredSideCounts.get(A) || 0) + 1); preferredSideCounts.set(B, (preferredSideCounts.get(B) || 0) + 1); }
            else { preferredSideCounts.set(C, (preferredSideCounts.get(C) || 0) + 1); preferredSideCounts.set(D, (preferredSideCounts.get(D) || 0) + 1); }

            matches.push({ court: courtNo++, teams: [[A, B], [C, D]], servingTeam, server, sides: { team1: team1Side, team2: team2Side } });

            incTeammate(A, B); incTeammate(C, D);
            incOpponent(A, C); incOpponent(A, D); incOpponent(B, C); incOpponent(B, D);
        }

        schedule.push({ round: r + 1, matches, sitOut: available.slice() });
    }

    return schedule;
}

module.exports = { scheduleDoublesRoundRobin };
